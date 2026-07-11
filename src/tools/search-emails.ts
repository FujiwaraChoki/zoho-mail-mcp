/** Search emails using Zoho Mail's structured search syntax. */

import { z } from "zod";
import type { ZohoConfig } from "../config.js";
import type { ZohoSearchResult } from "../types.js";
import { formatZohoDate, zohoData, getAccountId } from "../client.js";

const searchFieldSchema = z.enum(["entire", "content", "subject", "sender", "to", "cc", "fileName", "fileContent"]);
const zohoDateSchema = z.string().regex(/^\d{2}-[A-Za-z]{3}-\d{4}$/, "Use DD-MMM-YYYY, for example 12-Sep-2025");

export const searchEmailsSchema = z.object({
  query: z.string().trim().min(1).describe("Text to search for, or a complete Zoho searchKey when rawSyntax=true."),
  field: searchFieldSchema.optional().describe("Field for a plain-text query (default: entire email)."),
  exactPhrase: z.boolean().optional().describe("Treat a plain-text query as one exact phrase."),
  rawSyntax: z.boolean().optional().describe("Pass query as Zoho search syntax without rewriting it."),
  folderName: z.string().trim().min(1).optional().describe("Only search this folder name."),
  labelName: z.string().trim().min(1).optional().describe("Only search emails with this label name."),
  hasAttachment: z.boolean().optional().describe("Require an attachment when true."),
  hasFlags: z.boolean().optional().describe("Require a flag when true."),
  hasConversation: z.boolean().optional().describe("Require conversation membership when true."),
  fromDate: zohoDateSchema.optional().describe("Inclusive start date in DD-MMM-YYYY format."),
  toDate: zohoDateSchema.optional().describe("Inclusive end date in DD-MMM-YYYY format."),
  includeSpamTrash: z.boolean().optional().describe("Include Spam and Trash results."),
  groupByConversation: z.boolean().optional().describe("Group results from the same conversation."),
  receivedBefore: z.number().int().positive().optional().describe("Only messages received before this Unix timestamp in milliseconds; defaults to now."),
  includeRecipients: z.boolean().optional().describe("Include To details in results."),
  limit: z.number().int().min(1).max(200).optional().describe("Max results to return (default 20, max 200)."),
  start: z.number().int().min(1).optional().describe("One-based start position for pagination (default 1)."),
});

export type SearchEmailsInput = z.infer<typeof searchEmailsSchema>;

function quoteSearchValue(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function looksLikeZohoSearchKey(value: string): boolean {
  return /^(?:entire|content|subject|sender|to|cc|fileName|fileContent|has|in|label|fromDate|toDate|inclspamtrash|groupResult):/i.test(value)
    || value.includes("::")
    || value.includes(":or:");
}

/** Builds a valid Zoho searchKey from the user-facing search options. */
export function buildSearchKey(input: SearchEmailsInput): string {
  const clauses: string[] = [];
  const query = input.query.trim();

  if (input.rawSyntax || looksLikeZohoSearchKey(query)) {
    clauses.push(query);
  } else {
    const field = input.field ?? "entire";
    if (input.exactPhrase || /^(["']).*\1$/.test(query)) {
      clauses.push(`${field}:${quoteSearchValue(query.replace(/^(["'])(.*)\1$/, "$2"))}`);
    } else {
      const terms = query.split(/\s+/).filter(Boolean);
      clauses.push(...terms.map((term) => `${field}:${term.includes(":") ? quoteSearchValue(term) : term}`));
    }
  }

  if (input.folderName) clauses.push(`in:${quoteSearchValue(input.folderName)}`);
  if (input.labelName) clauses.push(`label:${quoteSearchValue(input.labelName)}`);
  if (input.hasAttachment) clauses.push("has:attachment");
  if (input.hasFlags) clauses.push("has:flags");
  if (input.hasConversation) clauses.push("has:convo");
  if (input.fromDate) clauses.push(`fromDate:${input.fromDate}`);
  if (input.toDate) clauses.push(`toDate:${input.toDate}`);
  if (input.includeSpamTrash) clauses.push("inclspamtrash:true");
  if (input.groupByConversation) clauses.push("groupResult:true");
  return clauses.join("::");
}

/** Builds the documented Zoho /messages/search query parameters. */
export function buildSearchParams(input: SearchEmailsInput, now = Date.now()): URLSearchParams {
  const params = new URLSearchParams({
    searchKey: buildSearchKey(input),
    receivedTime: String(input.receivedBefore ?? now),
    limit: String(input.limit ?? 20),
    start: String(input.start ?? 1),
  });
  if (input.includeRecipients !== undefined) params.set("includeto", String(input.includeRecipients));
  return params;
}

export async function searchEmails(config: ZohoConfig, input: SearchEmailsInput): Promise<string> {
  const accountId = await getAccountId(config);
  const start = input.start ?? 1;
  const params = buildSearchParams(input);

  const results = await zohoData<ZohoSearchResult[]>(
    config,
    `/accounts/${accountId}/messages/search?${params.toString()}`,
  );

  if (!results?.length) {
    return `No emails found matching "${input.query}".`;
  }

  const lines = results.map((email) => {
    const received = email.receivedTime ?? (email.receivedtime !== undefined ? String(email.receivedtime) : undefined);
    const date = formatZohoDate(String(email.sentDateInGMT || received || ""));
    const attachment = String(email.hasAttachment) === "1" ? " [attachment]" : "";
    const unread = email.status === "unread" || email.status === "0" ? " [unread]" : "";
    return `- **${email.subject}**${unread}${attachment}\n  From: ${email.sender} <${email.fromAddress}>\n  Date: ${date}\n  ID: ${email.messageId} | Folder: ${email.folderId}\n  ${email.summary || ""}`;
  });

  return `Search results for "${input.query}" (${results.length} results, starting at ${start}):\n\n${lines.join("\n\n")}`;
}
