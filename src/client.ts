/** Zoho Mail REST API client with auth, rate limiting, and retry. */

import type { ZohoConfig } from "./config.js";
import type { ZohoAccount } from "./types.js";
import { getAccessToken, clearTokenCache } from "./auth.js";
import { waitForSlot } from "./rate-limiter.js";

let cachedAccountId: string | null = null;

/** Makes an authenticated request to the Zoho Mail API. */
export async function zohoFetch(
  config: ZohoConfig,
  path: string,
  options: RequestInit = {},
  retryOn401 = true,
): Promise<Response> {
  await waitForSlot();

  const token = await getAccessToken(config);
  const url = path.startsWith("http") ? path : `${config.mailApiBase}${path}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  // Retry once on 401 (token may have expired)
  if (response.status === 401 && retryOn401) {
    console.error("[client] Got 401, refreshing token and retrying...");
    clearTokenCache();
    return zohoFetch(config, path, options, false);
  }

  return response;
}

/** Returns the Zoho account ID, caching after first call. */
export async function getAccountId(config: ZohoConfig): Promise<string> {
  if (cachedAccountId) return cachedAccountId;

  const response = await zohoFetch(config, "/accounts");
  if (!response.ok) {
    throw new Error(`Failed to fetch accounts: ${response.status} ${await response.text()}`);
  }

  const body = await response.json();
  const accounts = (body as { data: ZohoAccount[] }).data;

  if (!accounts || accounts.length === 0) {
    throw new Error("No Zoho Mail accounts found");
  }

  cachedAccountId = accounts[0]!.accountId;
  console.error(`[client] Using account: ${cachedAccountId}`);
  return cachedAccountId;
}

/** Strips HTML to plain text for email content. */
export function htmlToPlainText(html: string): string {
  let text = html;
  // Remove style and script tags with content
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
  text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
  // Convert br and p tags to newlines
  text = text.replace(/<br\s*\/?>/gi, "\n");
  text = text.replace(/<\/p>/gi, "\n\n");
  text = text.replace(/<\/div>/gi, "\n");
  text = text.replace(/<\/li>/gi, "\n");
  text = text.replace(/<li[^>]*>/gi, "- ");
  // Strip remaining HTML tags
  text = text.replace(/<[^>]+>/g, "");
  // Decode common HTML entities
  text = text.replace(/&nbsp;/g, " ");
  text = text.replace(/&amp;/g, "&");
  text = text.replace(/&lt;/g, "<");
  text = text.replace(/&gt;/g, ">");
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  text = text.replace(/&#x27;/g, "'");
  // Clean up whitespace
  text = text.replace(/\n{3,}/g, "\n\n");
  text = text.trim();
  return text;
}
