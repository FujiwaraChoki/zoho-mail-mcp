/** List emails in a folder. */

import { z } from "zod";
import type { ZohoConfig } from "../config.js";
import type { ZohoEmailSummary } from "../types.js";
import { zohoFetch, getAccountId } from "../client.js";

export const listEmailsSchema = z.object({
  folderId: z.string().optional().describe("Folder ID (defaults to Inbox). Use list_folders to get IDs."),
  limit: z.number().min(1).max(200).optional().describe("Number of emails to return (default 20, max 200)."),
  start: z.number().optional().describe("Start index for pagination (0-based)."),
  status: z.enum(["unread", "read", "all"]).optional().describe("Filter by read status (default: all)."),
});

export type ListEmailsInput = z.infer<typeof listEmailsSchema>;

export async function listEmails(config: ZohoConfig, input: ListEmailsInput): Promise<string> {
  const accountId = await getAccountId(config);
  const limit = input.limit ?? 20;
  const start = input.start ?? 0;

  // Build query params
  const params = new URLSearchParams({
    limit: limit.toString(),
    start: start.toString(),
  });

  if (input.folderId) {
    params.set("folderId", input.folderId);
  }

  if (input.status && input.status !== "all") {
    params.set("status", input.status);
  }

  const response = await zohoFetch(
    config,
    `/accounts/${accountId}/messages/view?${params.toString()}`
  );

  if (!response.ok) {
    throw new Error(`Failed to list emails: ${response.status} ${await response.text()}`);
  }

  const body = await response.json();
  const emails = (body as { data: ZohoEmailSummary[] }).data;

  if (!emails || emails.length === 0) {
    return "No emails found.";
  }

  const lines = emails.map((e) => {
    const date = e.sentDateInGMT || e.receivedTime;
    const attachment = e.hasAttachment === "1" ? " [attachment]" : "";
    const unread = e.status2 === "0" ? " [unread]" : "";
    return `- **${e.subject}**${unread}${attachment}\n  From: ${e.sender} <${e.fromAddress}>\n  Date: ${date}\n  ID: ${e.messageId} | Folder: ${e.folderId}`;
  });

  return `Emails (${emails.length} results, starting at ${start}):\n\n${lines.join("\n\n")}`;
}
