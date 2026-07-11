/** Reply to an existing email. */

import { z } from "zod";
import type { ZohoConfig } from "../config.js";
import type { ZohoEmailDetails } from "../types.js";
import { zohoData, zohoFetch, zohoJson, getAccount } from "../client.js";

export const replyEmailSchema = z.object({
  messageId: z.string().describe("The message ID to reply to."),
  folderId: z.string().describe("The folder ID containing the message."),
  content: z.string().describe("Reply body content."),
  mailFormat: z.enum(["html", "plaintext"]).optional().describe("Email format (default: html)."),
  replyAll: z.boolean().optional().describe("Reply to all recipients (default: false)."),
  askReceipt: z.boolean().optional().describe("Request a read receipt."),
  scheduleType: z.number().int().min(1).max(6).optional().describe("Schedule preset: 1h, 2h, 4h, next morning, next afternoon, or custom (6)."),
  scheduleTime: z.string().optional().describe("Custom time in MM/DD/YYYY HH:MM:SS format."),
  timeZone: z.string().optional().describe("Zoho timezone label for custom scheduling."),
});

export type ReplyEmailInput = z.infer<typeof replyEmailSchema>;

export async function replyEmail(config: ZohoConfig, input: ReplyEmailInput): Promise<string> {
  const account = await getAccount(config);
  const accountId = account.accountId;

  // Fetch account info and original email metadata in parallel.
  // Use /details (not /content) to get metadata like fromAddress.
  const originalEmail = await zohoData<ZohoEmailDetails>(
    config,
    `/accounts/${accountId}/folders/${input.folderId}/messages/${input.messageId}/details`,
  );
  const fromAddress = account.primaryEmailAddress || account.emailAddress?.[0];

  if (!fromAddress) {
    throw new Error("Could not determine sender email address");
  }

  const toAddress = originalEmail.fromAddress;

  if (!toAddress) {
    throw new Error("Could not determine recipient address from original email");
  }
  if (input.scheduleType === 6 && (!input.scheduleTime || !input.timeZone)) {
    throw new Error("scheduleTime and timeZone are required when scheduleType is 6");
  }

  const ownAddresses = new Set(
    [account.primaryEmailAddress, ...(account.emailAddress ?? [])]
      .filter(Boolean)
      .map((address) => address.toLowerCase()),
  );
  const otherRecipients = input.replyAll
    ? extractAddresses(`${originalEmail.toAddress ?? ""},${originalEmail.ccAddress ?? ""}`)
      .filter((address) => !ownAddresses.has(address.toLowerCase()) && address.toLowerCase() !== toAddress.toLowerCase())
    : [];

  const payload: Record<string, unknown> = {
    fromAddress,
    toAddress,
    content: input.content,
    mailFormat: input.mailFormat ?? "html",
    action: "reply",
  };
  if (otherRecipients.length) payload.ccAddress = otherRecipients.join(",");
  if (input.askReceipt !== undefined) payload.askReceipt = input.askReceipt ? "yes" : "no";
  if (input.scheduleType) {
    payload.isSchedule = true;
    payload.scheduleType = input.scheduleType;
    if (input.scheduleTime) payload.scheduleTime = input.scheduleTime;
    if (input.timeZone) payload.timeZone = input.timeZone;
  }

  const response = await zohoFetch(config, `/accounts/${accountId}/messages/${input.messageId}`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

  await zohoJson(response, `/accounts/${accountId}/messages/${input.messageId}`, "POST");

  return `Reply sent successfully${input.replyAll ? " to all recipients" : ""}.`;
}

function extractAddresses(value: string): string[] {
  return [...new Set(value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? [])];
}
