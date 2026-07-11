/** Send a new email. */

import { z } from "zod";
import type { ZohoConfig } from "../config.js";
import { zohoFetch, zohoJson, getAccount } from "../client.js";
import { uploadAttachment } from "./attachments.js";

export const sendEmailSchema = z.object({
  toAddress: z.string().describe("Recipient email address."),
  subject: z.string().describe("Email subject line."),
  content: z.string().describe("Email body content."),
  mailFormat: z.enum(["html", "plaintext"]).optional().describe("Email format (default: html)."),
  ccAddress: z.string().optional().describe("CC recipients (comma-separated)."),
  bccAddress: z.string().optional().describe("BCC recipients (comma-separated)."),
  askReceipt: z.boolean().optional().describe("Request a read receipt."),
  attachmentPaths: z.array(z.string()).max(10).optional().describe("Local file paths to upload and attach."),
  scheduleType: z.number().int().min(1).max(6).optional().describe("Schedule preset: 1h, 2h, 4h, next morning, next afternoon, or custom (6)."),
  scheduleTime: z.string().optional().describe("Custom time in MM/DD/YYYY HH:MM:SS format; required for scheduleType 6."),
  timeZone: z.string().optional().describe("Zoho timezone label; required for scheduleType 6."),
});

export type SendEmailInput = z.infer<typeof sendEmailSchema>;

export async function sendEmail(config: ZohoConfig, input: SendEmailInput): Promise<string> {
  if (input.scheduleType === 6 && (!input.scheduleTime || !input.timeZone)) {
    throw new Error("scheduleTime and timeZone are required when scheduleType is 6");
  }
  const account = await getAccount(config);
  const accountId = account.accountId;
  const fromAddress = account.primaryEmailAddress || account.emailAddress?.[0];

  if (!fromAddress) {
    throw new Error("Could not determine sender email address");
  }

  const payload: Record<string, unknown> = {
    fromAddress,
    toAddress: input.toAddress,
    subject: input.subject,
    content: input.content,
    mailFormat: input.mailFormat ?? "html",
  };

  if (input.ccAddress) payload.ccAddress = input.ccAddress;
  if (input.bccAddress) payload.bccAddress = input.bccAddress;
  if (input.askReceipt !== undefined) payload.askReceipt = input.askReceipt ? "yes" : "no";
  if (input.attachmentPaths?.length) {
    payload.attachments = await Promise.all(input.attachmentPaths.map((path) => uploadAttachment(config, path)));
  }
  if (input.scheduleType) {
    payload.isSchedule = true;
    payload.scheduleType = input.scheduleType;
    if (input.scheduleTime) payload.scheduleTime = input.scheduleTime;
    if (input.timeZone) payload.timeZone = input.timeZone;
  }

  const response = await zohoFetch(config, `/accounts/${accountId}/messages`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

  await zohoJson(response, `/accounts/${accountId}/messages`, "POST");

  return `Email sent successfully to ${input.toAddress} with subject "${input.subject}".`;
}
