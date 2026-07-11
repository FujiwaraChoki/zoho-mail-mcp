/** Zoho Mail MCP configuration loaded from environment variables. */

export interface ZohoConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  datacenter: string;
  mailApiBase: string;
  oauthBase: string;
  accountId?: string;
  accountEmail?: string;
  requestTimeoutMs: number;
  maxRetries: number;
  rateLimitPerMinute: number;
}

const DATA_CENTERS: Record<string, { accounts: string; mail: string }> = {
  us: { accounts: "accounts.zoho.com", mail: "mail.zoho.com" },
  eu: { accounts: "accounts.zoho.eu", mail: "mail.zoho.eu" },
  in: { accounts: "accounts.zoho.in", mail: "mail.zoho.in" },
  au: { accounts: "accounts.zoho.com.au", mail: "mail.zoho.com.au" },
  jp: { accounts: "accounts.zoho.jp", mail: "mail.zoho.jp" },
  ca: { accounts: "accounts.zohocloud.ca", mail: "mail.zohocloud.ca" },
  sa: { accounts: "accounts.zoho.sa", mail: "mail.zoho.sa" },
  uk: { accounts: "accounts.zoho.uk", mail: "mail.zoho.uk" },
};

function integerAtLeast(name: string, fallback: number, minimum: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new Error(`${name} must be an integer of at least ${minimum}`);
  }
  return value;
}

/** Loads and validates configuration from environment variables. */
export function loadConfig(): ZohoConfig {
  const clientId = process.env.ZOHO_CLIENT_ID;
  const clientSecret = process.env.ZOHO_CLIENT_SECRET;
  const refreshToken = process.env.ZOHO_REFRESH_TOKEN;
  const datacenter = (process.env.ZOHO_DATACENTER ?? "eu").toLowerCase();

  if (!clientId) throw new Error("Missing ZOHO_CLIENT_ID environment variable");
  if (!clientSecret) throw new Error("Missing ZOHO_CLIENT_SECRET environment variable");
  if (!refreshToken) throw new Error("Missing ZOHO_REFRESH_TOKEN environment variable");

  const domains = DATA_CENTERS[datacenter];
  if (!domains) {
    throw new Error(`Unsupported ZOHO_DATACENTER "${datacenter}". Expected one of: ${Object.keys(DATA_CENTERS).join(", ")}`);
  }

  return {
    clientId,
    clientSecret,
    refreshToken,
    datacenter,
    mailApiBase: `https://${domains.mail}/api`,
    oauthBase: `https://${domains.accounts}/oauth/v2`,
    accountId: process.env.ZOHO_ACCOUNT_ID,
    accountEmail: process.env.ZOHO_ACCOUNT_EMAIL?.toLowerCase(),
    requestTimeoutMs: integerAtLeast("ZOHO_REQUEST_TIMEOUT_MS", 30_000, 1),
    maxRetries: integerAtLeast("ZOHO_MAX_RETRIES", 3, 0),
    rateLimitPerMinute: integerAtLeast("ZOHO_RATE_LIMIT_PER_MINUTE", 30, 1),
  };
}
