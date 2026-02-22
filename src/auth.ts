/** OAuth2 token management for Zoho API. */

import type { ZohoConfig } from "./config.js";
import type { ZohoTokenResponse } from "./types.js";

let cachedToken: string | null = null;
let tokenExpiry = 0;
let refreshPromise: Promise<string> | null = null;

/** Returns a valid access token, refreshing if needed. */
export async function getAccessToken(config: ZohoConfig): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) {
    return cachedToken;
  }

  // Mutex: if a refresh is already in progress, wait for it
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = refreshAccessToken(config);
  try {
    const token = await refreshPromise;
    return token;
  } finally {
    refreshPromise = null;
  }
}

/** Clears the cached token, forcing a refresh on next call. */
export function clearTokenCache(): void {
  cachedToken = null;
  tokenExpiry = 0;
}

async function refreshAccessToken(config: ZohoConfig): Promise<string> {
  console.error("[auth] Refreshing access token...");

  const params = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: config.refreshToken,
  });

  const response = await fetch(`${config.oauthBase}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Token refresh failed (${response.status}): ${text}`);
  }

  const data = (await response.json()) as ZohoTokenResponse;

  if (!data.access_token) {
    throw new Error(`Token refresh returned no access_token: ${JSON.stringify(data)}`);
  }

  cachedToken = data.access_token;
  // Expire 60 seconds early to avoid edge cases
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;

  console.error("[auth] Token refreshed successfully");
  return cachedToken;
}
