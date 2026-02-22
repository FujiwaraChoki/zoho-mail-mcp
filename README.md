# Zoho Mail MCP Server

An [MCP (Model Context Protocol)](https://modelcontextprotocol.io) server that connects AI assistants like Claude to your Zoho Mail account. Read, send, search, reply to, and delete emails directly from your AI workflow.

## Tools

| Tool | Description |
|------|-------------|
| `list_folders` | List all mail folders with unread/total counts |
| `list_emails` | List emails in a folder with filtering and pagination |
| `read_email` | Read the full content of a specific email |
| `search_emails` | Search emails by keyword across all folders |
| `send_email` | Send a new email |
| `reply_email` | Reply to an existing email (reply / reply-all) |
| `delete_email` | Delete an email (trash or permanent) |

## Setup

### 1. Create a Zoho API Client

1. Go to the [Zoho API Console](https://api-console.zoho.eu/) (use `.com` for US datacenter)
2. Click **Add Client** > **Self Client**
3. Note your **Client ID** and **Client Secret**

### 2. Generate a Refresh Token

Run the interactive setup helper:

```bash
bun run setup.ts
```

Or manually:

1. In the Self Client, generate a grant code with these scopes:
   ```
   ZohoMail.accounts.READ,ZohoMail.folders.READ,ZohoMail.messages.READ,ZohoMail.messages.CREATE,ZohoMail.messages.DELETE
   ```
2. Set duration to 10 minutes, add a description, and click **Create**
3. Copy the generated code and exchange it using the setup script

### 3. Verify Credentials

```bash
ZOHO_CLIENT_ID=your_id ZOHO_CLIENT_SECRET=your_secret ZOHO_REFRESH_TOKEN=your_token bun run setup.ts --verify
```

### 4. Configure Your MCP Client

#### Claude Code (`~/.claude.json`)

```json
{
  "mcpServers": {
    "zoho-mail": {
      "command": "bun",
      "args": ["run", "/path/to/zoho-mail-mcp/src/index.ts"],
      "env": {
        "ZOHO_CLIENT_ID": "your_client_id",
        "ZOHO_CLIENT_SECRET": "your_client_secret",
        "ZOHO_REFRESH_TOKEN": "your_refresh_token",
        "ZOHO_DATACENTER": "eu"
      }
    }
  }
}
```

#### Claude Desktop (`claude_desktop_config.json`)

```json
{
  "mcpServers": {
    "zoho-mail": {
      "command": "bun",
      "args": ["run", "/path/to/zoho-mail-mcp/src/index.ts"],
      "env": {
        "ZOHO_CLIENT_ID": "your_client_id",
        "ZOHO_CLIENT_SECRET": "your_client_secret",
        "ZOHO_REFRESH_TOKEN": "your_refresh_token",
        "ZOHO_DATACENTER": "eu"
      }
    }
  }
}
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ZOHO_CLIENT_ID` | Yes | OAuth2 Client ID from Zoho API Console |
| `ZOHO_CLIENT_SECRET` | Yes | OAuth2 Client Secret |
| `ZOHO_REFRESH_TOKEN` | Yes | OAuth2 Refresh Token (generated via setup) |
| `ZOHO_DATACENTER` | No | Zoho datacenter: `eu` (default), `us`, `in`, `au`, `jp` |

## Features

- **OAuth2 with auto-refresh** - tokens are refreshed automatically, no manual intervention needed
- **Rate limiting** - built-in sliding window rate limiter (30 req/min) to stay within Zoho API limits
- **Retry on 401** - automatically refreshes token and retries on authentication failures
- **HTML to plain text** - email content is converted to clean plain text for AI consumption

## Requirements

- [Bun](https://bun.sh) runtime
- A Zoho Mail account with API access

## License

MIT
