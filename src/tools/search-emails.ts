/** Search emails by keyword. */

import { z } from "zod";
import type { ZohoConfig } from "../config.js";
import type { ZohoSearchResult } from "../types.js";
import { zohoFetch, getAccountId } from "../client.js";

export const searchEmailsSchema = z.object({
  query: z.string().describe("Search query string."),
  limit: z.number().min(1).max(100).optional().describe("Max results to return (default 20)."),
  start: z.number().optional().describe("Start index for pagination (0-based)."),
});

export type SearchEmailsInput = z.infer<typeof searchEmailsSchema>;

export async function searchEmails(config: ZohoConfig, input: SearchEmailsInput): Promise<string> {
  const accountId = await getAccountId(config);
  const limit = input.limit ?? 20;
  const start = input.start ?? 0;

  const params = new URLSearchParams({
    searchKey: input.query,
    limit: limit.toString(),
    start: start.toString(),
  });

  const response = await zohoFetch(
    config,
    `/accounts/${accountId}/messages/search?${params.toString()}`
  );

  if (!response.ok) {
    throw new Error(`Failed to search emails: ${response.status} ${await response.text()}`);
  }

  const body = await response.json();
  const results = (body as { data: ZohoSearchResult[] }).data;

  if (!results || results.length === 0) {
    return `No emails found matching "${input.query}".`;
  }

  const lines = results.map((e) => {
    const date = e.sentDateInGMT || e.receivedTime;
    const attachment = e.hasAttachment === "1" ? " [attachment]" : "";
    return `- **${e.subject}**${attachment}\n  From: ${e.sender} <${e.fromAddress}>\n  Date: ${date}\n  ID: ${e.messageId} | Folder: ${e.folderId}\n  ${e.summary || ""}`;
  });

  return `Search results for "${input.query}" (${results.length} results):\n\n${lines.join("\n\n")}`;
}
