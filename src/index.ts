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
import { listAccountsSchema, listAccounts } from "./tools/list-accounts.js";
import { updateEmailsSchema, updateEmails } from "./tools/update-emails.js";
import { manageFolderSchema, manageFolder } from "./tools/manage-folders.js";
import { listLabelsSchema, manageLabelSchema, listLabels, manageLabel } from "./tools/labels.js";
import { saveDraftSchema, saveDraft } from "./tools/save-draft.js";
import {
  downloadAttachmentSchema,
  listAttachmentsSchema,
  downloadAttachment,
  listAttachments,
} from "./tools/attachments.js";

const config = loadConfig();

const server = new McpServer({
  name: "zoho-mail",
  version: "2.0.0",
});

server.tool(
  "list_accounts",
  "List accessible Zoho Mail accounts and show the configured account selection.",
  listAccountsSchema.shape,
  async (input) => {
    try {
      return { content: [{ type: "text", text: await listAccounts(config, input) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error: ${(error as Error).message}` }], isError: true };
    }
  },
);

server.tool(
  "list_folders",
  "List all mail folders with unread/total counts.",
  listFoldersSchema.shape,
  async (input) => {
    try {
      const result = await listFolders(config, input.refresh);
      return { content: [{ type: "text", text: result }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

server.tool(
  "manage_folder",
  "Create, rename, move, mark read, empty, or delete a mail folder. Destructive actions require confirmation.",
  manageFolderSchema.shape,
  async (input) => {
    try {
      return { content: [{ type: "text", text: await manageFolder(config, input) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error: ${(error as Error).message}` }], isError: true };
    }
  },
);

server.tool(
  "list_labels",
  "List mail labels with colors and IDs.",
  listLabelsSchema.shape,
  async () => {
    try {
      return { content: [{ type: "text", text: await listLabels(config) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error: ${(error as Error).message}` }], isError: true };
    }
  },
);

server.tool(
  "manage_label",
  "Create, update, or delete a Zoho Mail label.",
  manageLabelSchema.shape,
  async (input) => {
    try {
      return { content: [{ type: "text", text: await manageLabel(config, input) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error: ${(error as Error).message}` }], isError: true };
    }
  },
);

server.tool(
  "list_emails",
  "List and filter emails, optionally within a folder. Returns subject, sender, date, and IDs.",
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
  "Search emails across all folders using plain text or Zoho's advanced search syntax and filters.",
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
  "Send or schedule an email, optionally with read receipt and local file attachments.",
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
  "save_draft",
  "Save an email as a draft or template, optionally with attachments and reply threading headers.",
  saveDraftSchema.shape,
  async (input) => {
    try {
      return { content: [{ type: "text", text: await saveDraft(config, input) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error: ${(error as Error).message}` }], isError: true };
    }
  },
);

server.tool(
  "reply_email",
  "Reply or reply-all to an existing email immediately or on a schedule.",
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

server.tool(
  "update_emails",
  "Bulk mark read/unread, move, flag, label, archive/unarchive, or mark messages as spam/not spam.",
  updateEmailsSchema.shape,
  async (input) => {
    try {
      return { content: [{ type: "text", text: await updateEmails(config, input) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error: ${(error as Error).message}` }], isError: true };
    }
  },
);

server.tool(
  "list_attachments",
  "List attachment names, sizes, and IDs for an email.",
  listAttachmentsSchema.shape,
  async (input) => {
    try {
      return { content: [{ type: "text", text: await listAttachments(config, input) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error: ${(error as Error).message}` }], isError: true };
    }
  },
);

server.tool(
  "download_attachment",
  "Download an email attachment to a local directory.",
  downloadAttachmentSchema.shape,
  async (input) => {
    try {
      return { content: [{ type: "text", text: await downloadAttachment(config, input) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error: ${(error as Error).message}` }], isError: true };
    }
  },
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
