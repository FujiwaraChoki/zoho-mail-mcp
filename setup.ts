/**
 * Zoho Mail MCP - OAuth Setup Helper
 *
 * Usage:
 *   bun run setup.ts           # Interactive setup to get refresh token
 *   bun run setup.ts --verify  # Verify existing credentials work
 */

const DATA_CENTERS: Record<string, { accounts: string; mail: string; console: string }> = {
  us: { accounts: "accounts.zoho.com", mail: "mail.zoho.com", console: "api-console.zoho.com" },
  eu: { accounts: "accounts.zoho.eu", mail: "mail.zoho.eu", console: "api-console.zoho.eu" },
  in: { accounts: "accounts.zoho.in", mail: "mail.zoho.in", console: "api-console.zoho.in" },
  au: { accounts: "accounts.zoho.com.au", mail: "mail.zoho.com.au", console: "api-console.zoho.com.au" },
  jp: { accounts: "accounts.zoho.jp", mail: "mail.zoho.jp", console: "api-console.zoho.jp" },
  ca: { accounts: "accounts.zohocloud.ca", mail: "mail.zohocloud.ca", console: "api-console.zohocloud.ca" },
  sa: { accounts: "accounts.zoho.sa", mail: "mail.zoho.sa", console: "api-console.zoho.sa" },
  uk: { accounts: "accounts.zoho.uk", mail: "mail.zoho.uk", console: "api-console.zoho.uk" },
};

function getDataCenter(value = process.env.ZOHO_DATACENTER ?? "eu") {
  const id = value.toLowerCase();
  const domains = DATA_CENTERS[id];
  if (!domains) throw new Error(`Unsupported data center: ${id}`);
  return { id, ...domains };
}

async function verify() {
  const clientId = process.env.ZOHO_CLIENT_ID;
  const clientSecret = process.env.ZOHO_CLIENT_SECRET;
  const refreshToken = process.env.ZOHO_REFRESH_TOKEN;
  const dc = getDataCenter();

  if (!clientId || !clientSecret || !refreshToken) {
    console.error("Missing environment variables. Need: ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_REFRESH_TOKEN");
    process.exit(1);
  }

  console.log("Verifying credentials...");

  const params = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
  });

  const tokenRes = await fetch(`https://${dc.accounts}/oauth/v2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  const tokenData = await tokenRes.json();

  if (!tokenRes.ok || !(tokenData as { access_token?: string }).access_token) {
    console.error("Token refresh failed:", tokenData);
    process.exit(1);
  }

  console.log("Token refresh: OK");

  // Test account access
  const accountRes = await fetch(`https://${dc.mail}/api/accounts`, {
    headers: { Authorization: `Zoho-oauthtoken ${(tokenData as { access_token: string }).access_token}` },
  });

  const accountData = await accountRes.json();

  if (!accountRes.ok) {
    console.error("Account fetch failed:", accountData);
    process.exit(1);
  }

  const accounts = (accountData as { data: Array<{ primaryEmailAddress: string; accountId: string }> }).data;
  console.log(`Account access: OK (${accounts[0]?.primaryEmailAddress}, ID: ${accounts[0]?.accountId})`);
  console.log("\nAll checks passed! Your credentials are working.");
}

async function setup() {
  const dataCenterInput = prompt("Zoho data center (us/eu/in/au/jp/ca/sa/uk) [eu]: ") || "eu";
  const dc = getDataCenter(dataCenterInput);
  console.log(`
=== Zoho Mail MCP - OAuth Setup ===

Steps to get your credentials:

1. Go to https://${dc.console}/
2. Click "Add Client" -> "Self Client"
3. Note down your Client ID and Client Secret
4. In the Self Client, generate a grant code with these scopes:
   ZohoMail.accounts.READ,ZohoMail.folders.ALL,ZohoMail.messages.ALL,ZohoMail.tags.ALL

5. Set the time duration to 10 minutes
6. Enter the scope description (e.g., "Claude Code email access")
7. Click "Create" and copy the generated code

Now enter your details below:
`);

  const clientId = prompt("Client ID: ");
  const clientSecret = prompt("Client Secret: ");
  const grantCode = prompt("Grant Code: ");

  if (!clientId || !clientSecret || !grantCode) {
    console.error("All fields are required.");
    process.exit(1);
  }

  console.log("\nExchanging grant code for refresh token...");

  const params = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: clientId,
    client_secret: clientSecret,
    code: grantCode,
  });

  const response = await fetch(`https://${dc.accounts}/oauth/v2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  const data = await response.json();
  const typed = data as { refresh_token?: string; access_token?: string; error?: string };

  if (!response.ok || !typed.refresh_token) {
    console.error("Failed to get refresh token:", data);
    if (typed.error) {
      console.error(`\nHint: "${typed.error}" usually means the grant code expired. Generate a new one and try again.`);
    }
    process.exit(1);
  }

  console.log("\nSuccess! Here's your configuration:");
  console.log(`
Add this to your ~/.claude.json under "mcpServers":

"zoho-mail": {
  "command": "bun",
  "args": ["run", "/path/to/shiori/tools/zoho-mail-mcp/src/index.ts"],
  "env": {
    "ZOHO_CLIENT_ID": "${clientId}",
    "ZOHO_CLIENT_SECRET": "${clientSecret}",
    "ZOHO_REFRESH_TOKEN": "${typed.refresh_token}",
    "ZOHO_DATACENTER": "${dc.id}"
  }
}

Refresh Token: ${typed.refresh_token}
`);
}

// CLI entry point
const args = process.argv.slice(2);
if (args.includes("--verify")) {
  verify();
} else {
  setup();
}
