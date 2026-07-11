/** Create, update, empty, or delete mail folders. */

import { z } from "zod";
import type { ZohoConfig } from "../config.js";
import { getAccountId, zohoData, zohoFetch, zohoJson } from "../client.js";

export const manageFolderSchema = z.object({
  action: z.enum(["create", "rename", "move", "mark_read", "empty", "delete"]),
  folderId: z.string().optional().describe("Folder ID (required except for create)."),
  folderName: z.string().min(1).optional().describe("Name for create or rename."),
  parentFolderId: z.string().optional().describe("Parent folder ID for create or move."),
  previousFolderId: z.string().optional().describe("Optional sibling ID used to position a moved folder."),
  confirmDestructive: z.boolean().optional().describe("Must be true for empty or delete."),
});

export type ManageFolderInput = z.infer<typeof manageFolderSchema>;

export async function manageFolder(config: ZohoConfig, input: ManageFolderInput): Promise<string> {
  const accountId = await getAccountId(config);
  const base = `/accounts/${accountId}/folders`;

  if (input.action === "create") {
    if (!input.folderName) throw new Error("folderName is required for create");
    const folder = await zohoData<{ folderId: string; folderName: string }>(config, base, {
      method: "POST",
      body: JSON.stringify({ folderName: input.folderName, ...(input.parentFolderId && { parentFolderId: input.parentFolderId }) }),
    });
    return `Folder "${folder.folderName}" created (ID: ${folder.folderId}).`;
  }

  if (!input.folderId) throw new Error("folderId is required for this action");
  if (["empty", "delete"].includes(input.action) && !input.confirmDestructive) {
    throw new Error("confirmDestructive=true is required for empty or delete");
  }
  const path = `${base}/${input.folderId}`;
  if (input.action === "delete") {
    const response = await zohoFetch(config, path, { method: "DELETE" });
    await zohoJson(response, path, "DELETE");
    return `Folder ${input.folderId} deleted.`;
  }

  let payload: Record<string, unknown>;
  switch (input.action) {
    case "rename":
      if (!input.folderName) throw new Error("folderName is required for rename");
      payload = { mode: "rename", folderName: input.folderName };
      break;
    case "move":
      if (!input.parentFolderId) throw new Error("parentFolderId is required for move");
      payload = { mode: "move", parentFolderId: input.parentFolderId, ...(input.previousFolderId && { previousFolderId: input.previousFolderId }) };
      break;
    case "mark_read": payload = { mode: "markAsRead" }; break;
    case "empty": payload = { mode: "emptyFolder" }; break;
    default: throw new Error(`Unsupported folder action: ${input.action}`);
  }
  const response = await zohoFetch(config, path, { method: "PUT", body: JSON.stringify(payload) });
  await zohoJson(response, path, "PUT");
  return `Folder action ${input.action} completed for ${input.folderId}.`;
}
