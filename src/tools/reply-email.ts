/** Reply to an existing email. */

import { z } from "zod";
import type { ZohoConfig } from "../config.js";
import type { ZohoAccount, ZohoEmailDetails } from "../types.js";
import { zohoFetch, getAccountId } from "../client.js";

export const replyEmailSchema = z.object({
  messageId: z.string().describe("The message ID to reply to."),
  folderId: z.string().describe("The folder ID containing the message."),
  content: z.string().describe("Reply body content."),
  replyAll: z.boolean().optional().describe("Reply to all recipients (default: false)."),
});

export type ReplyEmailInput = z.infer<typeof replyEmailSchema>;

export async function replyEmail(config: ZohoConfig, input: ReplyEmailInput): Promise<string> {
  const accountId = await getAccountId(config);

  // Fetch account info and original email metadata in parallel.
  // Use /details (not /content) to get metadata like fromAddress.
  const [accountResponse, originalResponse] = await Promise.all([
    zohoFetch(config, `/accounts`),
    zohoFetch(
      config,
      `/accounts/${accountId}/folders/${input.folderId}/messages/${input.messageId}/details`,
    ),
  ]);

  const accountBody = await accountResponse.json();
  const accounts = (accountBody as { data: ZohoAccount[] }).data;
  const fromAddress = accounts[0]?.primaryEmailAddress || accounts[0]?.emailAddress?.[0];

  if (!fromAddress) {
    throw new Error("Could not determine sender email address");
  }

  if (!originalResponse.ok) {
    throw new Error(
      `Failed to fetch original email details: ${originalResponse.status} ${await originalResponse.text()}`,
    );
  }

  const originalBody = await originalResponse.json();
  const originalEmail = (originalBody as { data: ZohoEmailDetails }).data;
  const toAddress = originalEmail.fromAddress;

  if (!toAddress) {
    throw new Error("Could not determine recipient address from original email");
  }

  const action = input.replyAll ? "replyall" : "reply";

  const payload = {
    fromAddress,
    toAddress,
    content: input.content,
    mailFormat: "plaintext",
    action,
  };

  const response = await zohoFetch(config, `/accounts/${accountId}/messages/${input.messageId}`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Failed to reply: ${response.status} ${await response.text()}`);
  }

  return `Reply sent successfully (${action}).`;
}
