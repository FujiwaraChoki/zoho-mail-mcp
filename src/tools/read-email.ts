/** Read a specific email's full content. */

import { z } from "zod";
import type { ZohoConfig } from "../config.js";
import type { ZohoEmailContent, ZohoEmailDetails } from "../types.js";
import { formatZohoDate, zohoData, getAccountId, htmlToPlainText } from "../client.js";

export const readEmailSchema = z.object({
  messageId: z.string().describe("The message ID to read."),
  folderId: z.string().describe("The folder ID containing the message."),
});

export type ReadEmailInput = z.infer<typeof readEmailSchema>;

export async function readEmail(config: ZohoConfig, input: ReadEmailInput): Promise<string> {
  const accountId = await getAccountId(config);
  const basePath = `/accounts/${accountId}/folders/${input.folderId}/messages/${input.messageId}`;

  // Fetch metadata and content in parallel.
  // The /details endpoint returns metadata (from, to, subject, etc.)
  // The /content endpoint returns the HTML body.
  const [details, contentData] = await Promise.all([
    zohoData<ZohoEmailDetails>(config, `${basePath}/details`),
    zohoData<ZohoEmailContent>(config, `${basePath}/content`),
  ]);

  const plainText = htmlToPlainText(contentData.content || "");

  const parts: string[] = [
    `**Subject:** ${details.subject}`,
    `**From:** ${details.sender} <${details.fromAddress}>`,
    `**To:** ${details.toAddress}`,
  ];

  if (details.ccAddress) {
    parts.push(`**CC:** ${details.ccAddress}`);
  }

  parts.push(`**Date:** ${formatZohoDate(details.sentDateInGMT || details.receivedTime)}`);

  if (details.hasAttachment === "1") {
    parts.push(`**Attachments:** Yes`);
  }

  parts.push("", "---", "", plainText);

  return parts.join("\n");
}
