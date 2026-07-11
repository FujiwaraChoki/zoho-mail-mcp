# Zoho Mail MCP Server

An [MCP (Model Context Protocol)](https://modelcontextprotocol.io) server that connects AI assistants to Zoho Mail. Read, search, send, schedule, organize, and download mail through the official Zoho Mail REST API.

## Tools

| Tool | Description |
|------|-------------|
| `list_accounts` | Inspect accessible accounts and the selected account |
| `list_folders` | List mail folders with unread/total counts |
| `manage_folder` | Create, rename, move, mark read, empty, or delete folders |
| `list_labels` | List labels with colors and IDs |
| `manage_label` | Create, update, or delete labels |
| `list_emails` | List emails with rich filtering, sorting, and pagination |
| `read_email` | Read the full content of a specific email |
| `search_emails` | Search with plain text or Zoho's advanced syntax |
| `send_email` | Send or schedule email with receipts and attachments |
| `save_draft` | Save a draft or template, including reply threading |
| `reply_email` | Reply or reply-all immediately or on a schedule |
| `update_emails` | Bulk read, move, flag, label, archive, and spam actions |
| `list_attachments` | List attachment names, sizes, and IDs |
| `download_attachment` | Safely download an attachment locally |
| `delete_email` | Trash or permanently delete with explicit confirmation |

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
   ZohoMail.accounts.READ,ZohoMail.folders.ALL,ZohoMail.messages.ALL,ZohoMail.tags.ALL
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
| `ZOHO_DATACENTER` | No | Zoho datacenter: `eu` (default), `us`, `in`, `au`, `jp`, `ca`, `sa`, or `uk` |
| `ZOHO_ACCOUNT_ID` | No | Select a specific accessible account ID |
| `ZOHO_ACCOUNT_EMAIL` | No | Select an account by primary address or alias |
| `ZOHO_REQUEST_TIMEOUT_MS` | No | Per-request timeout; defaults to `30000` |
| `ZOHO_MAX_RETRIES` | No | Network/429/5xx retries; defaults to `3` |
| `ZOHO_RATE_LIMIT_PER_MINUTE` | No | Local request throttle; defaults to `30` |

## Features

- **OAuth2 with serialized auto-refresh** - concurrent requests share token refreshes
- **Resilient HTTP client** - timeouts, exponential retry, `Retry-After`, and structured Zoho errors
- **Multi-datacenter and multi-account support** - route to eight Zoho regions and select the mailbox explicitly
- **Safe destructive operations** - permanent deletion, folder emptying, and overwrites require confirmation
- **Rich search** - plain text, exact phrases, fields, folders, labels, dates, flags, attachments, and conversations
- **Mailbox workflows** - drafts, templates, scheduling, reply-all, attachments, labels, folders, and bulk updates
- **HTML to plain text** - email content is converted to clean plain text for AI consumption

## Search behavior

`search_emails` translates normal text to Zoho's required search syntax. For example, `quarterly report` searches for both words across the entire message. Use `exactPhrase=true` for an exact phrase, select a `field` such as `subject` or `sender`, or pass a complete expression such as `subject:Invoice::has:attachment` with `rawSyntax=true`.

## Development

```bash
bun install
bun run typecheck
bun test
```

## Requirements

- [Bun](https://bun.sh) runtime
- A Zoho Mail account with API access

## License

MIT
