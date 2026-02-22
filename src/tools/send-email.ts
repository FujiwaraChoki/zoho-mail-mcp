/** Send a new email. */

import { z } from "zod";
import type { ZohoConfig } from "../config.js";
import type { ZohoAccount } from "../types.js";
import { zohoFetch, getAccountId } from "../client.js";

export const sendEmailSchema = z.object({
  toAddress: z.string().describe("Recipient email address."),
  subject: z.string().describe("Email subject line."),
  content: z.string().describe("Email body content."),
  ccAddress: z.string().optional().describe("CC recipients (comma-separated)."),
  bccAddress: z.string().optional().describe("BCC recipients (comma-separated)."),
});

export type SendEmailInput = z.infer<typeof sendEmailSchema>;

export async function sendEmail(config: ZohoConfig, input: SendEmailInput): Promise<string> {
  const accountId = await getAccountId(config);

  // Get sender address from account
  const accountResponse = await zohoFetch(config, `/accounts`);
  const accountBody = await accountResponse.json();
  const accounts = (accountBody as { data: ZohoAccount[] }).data;
  const fromAddress = accounts[0]?.primaryEmailAddress || accounts[0]?.emailAddress?.[0];

  if (!fromAddress) {
    throw new Error("Could not determine sender email address");
  }

  const payload: Record<string, string> = {
    fromAddress,
    toAddress: input.toAddress,
    subject: input.subject,
    content: input.content,
    mailFormat: "plaintext",
  };

  if (input.ccAddress) payload.ccAddress = input.ccAddress;
  if (input.bccAddress) payload.bccAddress = input.bccAddress;

  const response = await zohoFetch(config, `/accounts/${accountId}/messages`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Failed to send email: ${response.status} ${await response.text()}`);
  }

  return `Email sent successfully to ${input.toAddress} with subject "${input.subject}".`;
}
