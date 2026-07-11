/** Zoho Mail REST API client with auth, throttling, timeout, and retry. */

import type { ZohoConfig } from "./config.js";
import type { ZohoAccount, ZohoApiResponse } from "./types.js";
import { clearTokenCache, getAccessToken } from "./auth.js";
import { waitForSlot } from "./rate-limiter.js";

const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);
const accountCache = new Map<string, ZohoAccount[]>();

/** An HTTP or Zoho API failure with structured context. */
export class ZohoApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly method: string,
    public readonly path: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ZohoApiError";
  }
}

function retryDelay(response: Response | undefined, attempt: number): number {
  const retryAfter = response?.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
    const date = Date.parse(retryAfter);
    if (Number.isFinite(date)) return Math.max(0, date - Date.now());
  }
  return Math.min(10_000, 500 * 2 ** attempt) + Math.floor(Math.random() * 250);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Makes an authenticated request to the Zoho Mail API. */
export async function zohoFetch(
  config: ZohoConfig,
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const url = path.startsWith("http") ? path : `${config.mailApiBase}${path}`;
  let refreshed = false;

  for (let attempt = 0; ; attempt += 1) {
    await waitForSlot(config.rateLimitPerMinute);
    const token = await getAccessToken(config);
    const headers = new Headers(options.headers);
    headers.set("Authorization", `Zoho-oauthtoken ${token}`);
    if (!headers.has("Accept")) headers.set("Accept", "application/json");
    if (options.body && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    let response: Response | undefined;
    try {
      response = await fetch(url, {
        ...options,
        headers,
        signal: options.signal
          ? AbortSignal.any([options.signal, AbortSignal.timeout(config.requestTimeoutMs)])
          : AbortSignal.timeout(config.requestTimeoutMs),
      });
    } catch (error) {
      if (attempt >= config.maxRetries || options.signal?.aborted) throw error;
      await delay(retryDelay(undefined, attempt));
      continue;
    }

    if (response.status === 401 && !refreshed) {
      refreshed = true;
      clearTokenCache(config);
      continue;
    }

    if (RETRYABLE_STATUS.has(response.status) && attempt < config.maxRetries) {
      await response.body?.cancel();
      await delay(retryDelay(response, attempt));
      continue;
    }

    return response;
  }
}

/** Parses JSON and throws a consistent, informative error for failed responses. */
export async function zohoJson<T>(response: Response, path: string, method = "GET"): Promise<T> {
  const text = await response.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : undefined;
  } catch {
    body = text;
  }

  if (!response.ok) {
    const api = body as { status?: { description?: string }; data?: { moreInfo?: string } } | undefined;
    const detail = api?.data?.moreInfo ?? api?.status?.description ?? (typeof body === "string" ? body : undefined);
    throw new ZohoApiError(
      `Zoho Mail ${method} ${path} failed (${response.status})${detail ? `: ${detail}` : ""}`,
      response.status,
      method,
      path,
      body,
    );
  }
  return body as T;
}

/** Performs a request and returns the Zoho response data. */
export async function zohoData<T>(
  config: ZohoConfig,
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await zohoFetch(config, path, options);
  const body = await zohoJson<ZohoApiResponse<T>>(response, path, options.method ?? "GET");
  return body.data;
}

/** Returns all accessible Zoho Mail accounts. */
export async function getAccounts(config: ZohoConfig, refresh = false): Promise<ZohoAccount[]> {
  const key = `${config.mailApiBase}:${config.clientId}:${config.refreshToken}`;
  if (!refresh && accountCache.has(key)) return accountCache.get(key)!;
  const accounts = await zohoData<ZohoAccount[]>(config, "/accounts");
  if (!accounts?.length) throw new Error("No Zoho Mail accounts found");
  accountCache.set(key, accounts);
  return accounts;
}

/** Returns the configured account, or the only/first accessible account. */
export async function getAccount(config: ZohoConfig): Promise<ZohoAccount> {
  const accounts = await getAccounts(config);
  const account = config.accountId
    ? accounts.find((item) => item.accountId === config.accountId)
    : config.accountEmail
      ? accounts.find((item) =>
          [item.primaryEmailAddress, ...(item.emailAddress ?? [])]
            .some((email) => email.toLowerCase() === config.accountEmail),
        )
      : accounts[0];
  if (!account) {
    throw new Error(`Configured Zoho account was not found among ${accounts.length} accessible account(s)`);
  }
  return account;
}

/** Returns the selected Zoho account ID. */
export async function getAccountId(config: ZohoConfig): Promise<string> {
  return (await getAccount(config)).accountId;
}

/** Formats Zoho's epoch timestamp strings as ISO dates when possible. */
export function formatZohoDate(value: string | undefined): string {
  if (!value) return "Unknown";
  if (/^\d{10,13}$/.test(value)) {
    const numeric = Number(value);
    const milliseconds = value.length === 10 ? numeric * 1000 : numeric;
    return new Date(milliseconds).toISOString();
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? value : new Date(parsed).toISOString();
}

/** Converts common HTML email markup to readable plain text. */
export function htmlToPlainText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(?:39|x27);/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
