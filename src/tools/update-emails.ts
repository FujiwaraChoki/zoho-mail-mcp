/** Bulk update messages using Zoho Mail's updatemessage endpoint. */

import { z } from "zod";
import type { ZohoConfig } from "../config.js";
import { getAccountId, zohoJson, zohoFetch } from "../client.js";

const actionSchema = z.enum([
  "mark_read",
  "mark_unread",
  "move",
  "set_flag",
  "apply_labels",
  "remove_labels",
  "remove_all_labels",
  "archive",
  "unarchive",
  "mark_spam",
  "mark_not_spam",
]);

export const updateEmailsSchema = z.object({
  action: actionSchema.describe("Bulk action to perform."),
  messageIds: z.array(z.string()).min(1).max(200).describe("One or more Zoho message IDs."),
  destinationFolderId: z.string().optional().describe("Destination folder ID; required for move."),
  labelIds: z.array(z.string()).min(1).optional().describe("Label IDs; required for apply_labels/remove_labels."),
  flag: z.enum(["info", "important", "followup", "flag_not_set"]).optional().describe("Flag value; required for set_flag."),
  folderId: z.string().optional().describe("Limit the action to messages in this folder."),
  includeArchived: z.boolean().optional().describe("Include archived messages where supported."),
});

export type UpdateEmailsInput = z.infer<typeof updateEmailsSchema>;

const MODES: Record<z.infer<typeof actionSchema>, string> = {
  mark_read: "markAsRead",
  mark_unread: "markAsUnread",
  move: "moveMessage",
  set_flag: "setFlag",
  apply_labels: "applyLabel",
  remove_labels: "removeLabel",
  remove_all_labels: "removeAllLabels",
  archive: "archiveMails",
  unarchive: "unArchiveMails",
  mark_spam: "moveToSpam",
  mark_not_spam: "markNotSpam",
};

export async function updateEmails(config: ZohoConfig, input: UpdateEmailsInput): Promise<string> {
  if (input.action === "move" && !input.destinationFolderId) {
    throw new Error("destinationFolderId is required for move");
  }
  if (["apply_labels", "remove_labels"].includes(input.action) && !input.labelIds?.length) {
    throw new Error("labelIds is required for label actions");
  }
  if (input.action === "set_flag" && !input.flag) {
    throw new Error("flag is required for set_flag");
  }

  const payload: Record<string, unknown> = {
    mode: MODES[input.action],
    messageId: input.messageIds,
  };
  if (input.destinationFolderId) payload.destfolderId = input.destinationFolderId;
  if (input.labelIds) payload.labelId = input.labelIds;
  if (input.flag) payload.flagid = input.flag;
  if (input.folderId) {
    payload.isFolderSpecific = true;
    payload.folderId = input.folderId;
  }
  if (input.includeArchived !== undefined) payload.isArchive = input.includeArchived;

  const accountId = await getAccountId(config);
  const path = `/accounts/${accountId}/updatemessage`;
  const response = await zohoFetch(config, path, { method: "PUT", body: JSON.stringify(payload) });
  await zohoJson(response, path, "PUT");
  return `${input.action} completed for ${input.messageIds.length} email(s).`;
}
