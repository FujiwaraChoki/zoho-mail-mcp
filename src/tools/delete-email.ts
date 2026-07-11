/** Delete an email (soft delete by default). */

import { z } from "zod";
import type { ZohoConfig } from "../config.js";
import { zohoFetch, zohoJson, getAccountId } from "../client.js";

export const deleteEmailSchema = z.object({
  messageId: z.string().describe("The message ID to delete."),
  folderId: z.string().describe("The folder ID containing the message."),
  permanent: z.boolean().optional().describe("Permanently delete instead of moving to trash (default: false)."),
  confirmPermanent: z.boolean().optional().describe("Must be true when permanent=true."),
});

export type DeleteEmailInput = z.infer<typeof deleteEmailSchema>;

export async function deleteEmail(config: ZohoConfig, input: DeleteEmailInput): Promise<string> {
  const accountId = await getAccountId(config);
  if (input.permanent && !input.confirmPermanent) {
    throw new Error("confirmPermanent=true is required for permanent deletion");
  }

  const expunge = input.permanent ? "?expunge=true" : "";
  const response = await zohoFetch(
    config,
    `/accounts/${accountId}/folders/${input.folderId}/messages/${input.messageId}${expunge}`,
    { method: "DELETE" }
  );

  await zohoJson(response, `/accounts/${accountId}/folders/${input.folderId}/messages/${input.messageId}${expunge}`, "DELETE");

  const action = input.permanent ? "permanently deleted" : "moved to trash";
  return `Email ${action} successfully.`;
}
