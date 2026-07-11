import { afterEach, describe, expect, test } from "bun:test";
import type { ZohoConfig } from "../src/config.js";
import { clearTokenCache } from "../src/auth.js";
import { ZohoApiError, formatZohoDate, htmlToPlainText, zohoFetch, zohoJson } from "../src/client.js";

const originalFetch = globalThis.fetch;

function config(overrides: Partial<ZohoConfig> = {}): ZohoConfig {
  return {
    clientId: `client-${Math.random()}`,
    clientSecret: "secret",
    refreshToken: "refresh",
    datacenter: "eu",
    mailApiBase: "https://mail.example/api",
    oauthBase: "https://accounts.example/oauth/v2",
    requestTimeoutMs: 1_000,
    maxRetries: 2,
    rateLimitPerMinute: 10_000,
    ...overrides,
  };
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  clearTokenCache();
});

describe("zohoFetch", () => {
  test("refreshes OAuth once and retries a throttled API request", async () => {
    const calls: string[] = [];
    let apiCalls = 0;
    globalThis.fetch = (async (input) => {
      const url = String(input);
      calls.push(url);
      if (url.includes("/token")) {
        return Response.json({ access_token: "token", expires_in: 3600, token_type: "Bearer", api_domain: "" });
      }
      apiCalls += 1;
      if (apiCalls === 1) return Response.json({ status: { description: "slow down" } }, { status: 429, headers: { "Retry-After": "0" } });
      return Response.json({ status: { code: 200 }, data: { ok: true } });
    }) as typeof fetch;

    const response = await zohoFetch(config(), "/accounts");
    expect(response.status).toBe(200);
    expect(calls).toHaveLength(3);
  });
});

describe("zohoJson", () => {
  test("surfaces structured Zoho error details", async () => {
    const response = Response.json({
      status: { code: 400, description: "Invalid Input" },
      data: { moreInfo: "Unknown message ID" },
    }, { status: 400 });

    try {
      await zohoJson(response, "/messages/1");
      throw new Error("Expected zohoJson to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(ZohoApiError);
      expect((error as Error).message).toContain("Unknown message ID");
    }
  });
});

test("htmlToPlainText removes unsafe markup and preserves readable breaks", () => {
  expect(htmlToPlainText("<style>x</style><p>Hello &amp; welcome</p><script>x</script><br>Done"))
    .toBe("Hello & welcome\n\nDone");
});

test("formatZohoDate converts millisecond epoch strings", () => {
  expect(formatZohoDate("1709856408000")).toBe("2024-03-08T00:06:48.000Z");
});
