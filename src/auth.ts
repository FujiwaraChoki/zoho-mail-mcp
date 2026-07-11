/** OAuth2 token management for Zoho API. */

import type { ZohoConfig } from "./config.js";
import type { ZohoTokenResponse } from "./types.js";

interface TokenState {
  token: string | null;
  expiry: number;
  refreshPromise: Promise<string> | null;
}

const states = new Map<string, TokenState>();

function stateFor(config: ZohoConfig): TokenState {
  const key = `${config.oauthBase}:${config.clientId}:${config.refreshToken}`;
  let state = states.get(key);
  if (!state) {
    state = { token: null, expiry: 0, refreshPromise: null };
    states.set(key, state);
  }
  return state;
}

/** Returns a valid access token, refreshing if needed. */
export async function getAccessToken(config: ZohoConfig): Promise<string> {
  const state = stateFor(config);
  if (state.token && Date.now() < state.expiry) {
    return state.token;
  }

  // Mutex: if a refresh is already in progress, wait for it
  if (state.refreshPromise) {
    return state.refreshPromise;
  }

  state.refreshPromise = refreshAccessToken(config, state);
  try {
    const token = await state.refreshPromise;
    return token;
  } finally {
    state.refreshPromise = null;
  }
}

/** Clears the cached token, forcing a refresh on next call. */
export function clearTokenCache(config?: ZohoConfig): void {
  if (!config) {
    states.clear();
    return;
  }
  const state = stateFor(config);
  state.token = null;
  state.expiry = 0;
}

async function refreshAccessToken(config: ZohoConfig, state: TokenState): Promise<string> {
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

  state.token = data.access_token;
  // Expire 60 seconds early to avoid edge cases
  state.expiry = Date.now() + Math.max(1, (data.expires_in ?? 3600) - 60) * 1000;

  console.error("[auth] Token refreshed successfully");
  return state.token;
}
