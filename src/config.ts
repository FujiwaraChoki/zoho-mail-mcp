/** Zoho Mail MCP configuration loaded from environment variables. */

export interface ZohoConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  datacenter: string;
  mailApiBase: string;
  oauthBase: string;
}

/** Loads and validates configuration from environment variables. */
export function loadConfig(): ZohoConfig {
  const clientId = process.env.ZOHO_CLIENT_ID;
  const clientSecret = process.env.ZOHO_CLIENT_SECRET;
  const refreshToken = process.env.ZOHO_REFRESH_TOKEN;
  const datacenter = process.env.ZOHO_DATACENTER ?? "eu";

  if (!clientId) throw new Error("Missing ZOHO_CLIENT_ID environment variable");
  if (!clientSecret) throw new Error("Missing ZOHO_CLIENT_SECRET environment variable");
  if (!refreshToken) throw new Error("Missing ZOHO_REFRESH_TOKEN environment variable");

  const tld = datacenter === "us" ? "com" : datacenter;

  return {
    clientId,
    clientSecret,
    refreshToken,
    datacenter,
    mailApiBase: `https://mail.zoho.${tld}/api`,
    oauthBase: `https://accounts.zoho.${tld}/oauth/v2`,
  };
}
