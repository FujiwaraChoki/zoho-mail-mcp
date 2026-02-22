/** Zoho Mail MCP Server - provides email tools via Zoho REST API. */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config.js";
import { listFoldersSchema, listFolders } from "./tools/list-folders.js";
import { listEmailsSchema, listEmails } from "./tools/list-emails.js";
import { readEmailSchema, readEmail } from "./tools/read-email.js";
import { searchEmailsSchema, searchEmails } from "./tools/search-emails.js";
import { sendEmailSchema, sendEmail } from "./tools/send-email.js";
import { replyEmailSchema, replyEmail } from "./tools/reply-email.js";
import { deleteEmailSchema, deleteEmail } from "./tools/delete-email.js";

const config = loadConfig();

const server = new McpServer({
  name: "zoho-mail",
  version: "1.0.0",
});

server.tool(
  "list_folders",
  "List all mail folders with unread/total counts.",
  listFoldersSchema.shape,
  async () => {
    try {
      const result = await listFolders(config);
      return { content: [{ type: "text", text: result }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

server.tool(
  "list_emails",
  "List emails in a folder (default: Inbox). Returns subject, sender, date, and IDs.",
  listEmailsSchema.shape,
  async (input) => {
    try {
      const result = await listEmails(config, input);
      return { content: [{ type: "text", text: result }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

server.tool(
  "read_email",
  "Read the full content of a specific email. Requires messageId and folderId.",
  readEmailSchema.shape,
  async (input) => {
    try {
      const result = await readEmail(config, input);
      return { content: [{ type: "text", text: result }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

server.tool(
  "search_emails",
  "Search emails by keyword across all folders.",
  searchEmailsSchema.shape,
  async (input) => {
    try {
      const result = await searchEmails(config, input);
      return { content: [{ type: "text", text: result }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

server.tool(
  "send_email",
  "Send a new email from your Zoho account.",
  sendEmailSchema.shape,
  async (input) => {
    try {
      const result = await sendEmail(config, input);
      return { content: [{ type: "text", text: result }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

server.tool(
  "reply_email",
  "Reply to an existing email. Supports reply and reply-all.",
  replyEmailSchema.shape,
  async (input) => {
    try {
      const result = await replyEmail(config, input);
      return { content: [{ type: "text", text: result }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

server.tool(
  "delete_email",
  "Delete an email (moves to trash by default, or permanently with permanent=true).",
  deleteEmailSchema.shape,
  async (input) => {
    try {
      const result = await deleteEmail(config, input);
      return { content: [{ type: "text", text: result }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[zoho-mail-mcp] Server started");
}

main().catch((error) => {
  console.error("[zoho-mail-mcp] Fatal error:", error);
  process.exit(1);
});
