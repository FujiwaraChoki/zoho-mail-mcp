/** List emails in a folder. */

import { z } from "zod";
import type { ZohoConfig } from "../config.js";
import type { ZohoEmailSummary } from "../types.js";
import { formatEmailTimestamps, zohoData, getAccountId } from "../client.js";

export const listEmailsSchema = z.object({
  folderId: z.string().optional().describe("Optionally limit results to a folder ID. Use list_folders to get IDs."),
  limit: z.number().min(1).max(200).optional().describe("Number of emails to return (default 20, max 200)."),
  start: z.number().int().min(1).optional().describe("One-based start position for pagination (default 1)."),
  status: z.enum(["unread", "read", "all"]).optional().describe("Filter by read status (default: all)."),
  labelId: z.string().optional().describe("Only emails with this label ID."),
  flag: z.enum(["none", "info", "important", "followup"]).optional(),
  hasAttachments: z.boolean().optional(),
  includeArchived: z.boolean().optional(),
  includeSent: z.boolean().optional().describe("Include sent messages."),
  includeRecipients: z.boolean().optional().describe("Include To details."),
  sortBy: z.enum(["date", "messageId", "size"]).optional(),
  sortAscending: z.boolean().optional(),
  hasInlineImages: z.boolean().optional(),
  flaggedOnly: z.boolean().optional(),
  respondedOnly: z.boolean().optional(),
  threadedOnly: z.boolean().optional(),
  threadId: z.string().optional(),
});

export type ListEmailsInput = z.infer<typeof listEmailsSchema>;

/** Builds the documented Zoho /messages/view query parameters. */
export function buildListEmailsParams(input: ListEmailsInput): URLSearchParams {
  const limit = input.limit ?? 20;
  const start = input.start ?? 1;
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
  if (input.labelId) params.set("labelid", input.labelId);
  if (input.flag) params.set("flagid", String({ none: 0, info: 1, important: 2, followup: 3 }[input.flag]));
  if (input.hasAttachments !== undefined) params.set("attachedMails", String(input.hasAttachments));
  if (input.includeArchived !== undefined) params.set("includearchive", String(input.includeArchived));
  if (input.includeSent !== undefined) params.set("includesent", String(input.includeSent));
  if (input.includeRecipients !== undefined) params.set("includeto", String(input.includeRecipients));
  if (input.sortBy) params.set("sortBy", input.sortBy);
  if (input.sortAscending !== undefined) params.set("sortorder", String(input.sortAscending));
  if (input.hasInlineImages !== undefined) params.set("inlinedMails", String(input.hasInlineImages));
  if (input.flaggedOnly !== undefined) params.set("flaggedMails", String(input.flaggedOnly));
  if (input.respondedOnly !== undefined) params.set("respondedMails", String(input.respondedOnly));
  if (input.threadedOnly !== undefined) params.set("threadedMails", String(input.threadedOnly));
  if (input.threadId) params.set("threadId", input.threadId);
  return params;
}

export async function listEmails(config: ZohoConfig, input: ListEmailsInput): Promise<string> {
  const accountId = await getAccountId(config);
  const params = buildListEmailsParams(input);
  const start = input.start ?? 1;

  const emails = await zohoData<ZohoEmailSummary[]>(
    config,
    `/accounts/${accountId}/messages/view?${params.toString()}`
  );

  if (!emails || emails.length === 0) {
    return "No emails found.";
  }

  const lines = emails.map((e) => {
    const timestamps = formatEmailTimestamps(e.sentDateInGMT, e.receivedTime);
    const attachment = String(e.hasAttachment) === "1" ? " [attachment]" : "";
    const unread = e.status === "0" || e.status === "unread" ? " [unread]" : "";
    const timeLines = [
      timestamps.sent && `  Sent: ${timestamps.sent}`,
      timestamps.received && `  Received: ${timestamps.received}`,
    ].filter(Boolean).join("\n");
    return `- **${e.subject}**${unread}${attachment}\n  From: ${e.sender} <${e.fromAddress}>\n${timeLines}\n  ID: ${e.messageId} | Folder: ${e.folderId}`;
  });

  return `Emails (${emails.length} results, starting at ${start}):\n\n${lines.join("\n\n")}`;
}
