/** Delete an email (soft delete by default). */

import { z } from "zod";
import type { ZohoConfig } from "../config.js";
import { zohoFetch, getAccountId } from "../client.js";

export const deleteEmailSchema = z.object({
  messageId: z.string().describe("The message ID to delete."),
  folderId: z.string().describe("The folder ID containing the message."),
  permanent: z.boolean().optional().describe("Permanently delete instead of moving to trash (default: false)."),
});

export type DeleteEmailInput = z.infer<typeof deleteEmailSchema>;

export async function deleteEmail(config: ZohoConfig, input: DeleteEmailInput): Promise<string> {
  const accountId = await getAccountId(config);

  const expunge = input.permanent ? "?expunge=true" : "";
  const response = await zohoFetch(
    config,
    `/accounts/${accountId}/folders/${input.folderId}/messages/${input.messageId}${expunge}`,
    { method: "DELETE" }
  );

  if (!response.ok) {
    throw new Error(`Failed to delete email: ${response.status} ${await response.text()}`);
  }

  const action = input.permanent ? "permanently deleted" : "moved to trash";
  return `Email ${action} successfully.`;
}
