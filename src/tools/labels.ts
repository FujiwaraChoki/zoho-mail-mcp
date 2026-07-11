/** List and manage Zoho Mail labels. */

import { z } from "zod";
import type { ZohoConfig } from "../config.js";
import type { ZohoLabel } from "../types.js";
import { getAccountId, zohoData, zohoFetch, zohoJson } from "../client.js";

export const listLabelsSchema = z.object({});
export const manageLabelSchema = z.object({
  action: z.enum(["create", "update", "delete"]),
  labelId: z.string().optional().describe("Label ID for update/delete."),
  displayName: z.string().min(1).optional().describe("Label name for create/update."),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().describe("Six-digit hex color, such as #FFD700."),
  confirmDelete: z.boolean().optional().describe("Must be true to delete a label."),
});

export type ManageLabelInput = z.infer<typeof manageLabelSchema>;

export async function listLabels(config: ZohoConfig): Promise<string> {
  const accountId = await getAccountId(config);
  const labels = await zohoData<ZohoLabel[]>(config, `/accounts/${accountId}/labels`);
  if (!labels?.length) return "No labels found.";
  return `Mail Labels:\n${labels.map((label) => `- ${label.displayName} (${label.color}) — ID: ${label.labelId}`).join("\n")}`;
}

export async function manageLabel(config: ZohoConfig, input: ManageLabelInput): Promise<string> {
  const accountId = await getAccountId(config);
  const base = `/accounts/${accountId}/labels`;
  if (input.action === "create") {
    if (!input.displayName) throw new Error("displayName is required for create");
    const label = await zohoData<ZohoLabel>(config, base, {
      method: "POST",
      body: JSON.stringify({ displayName: input.displayName, ...(input.color && { color: input.color }) }),
    });
    return `Label "${label.displayName}" created (ID: ${label.labelId}).`;
  }
  if (!input.labelId) throw new Error("labelId is required for update/delete");
  const path = `${base}/${input.labelId}`;
  if (input.action === "delete") {
    if (!input.confirmDelete) throw new Error("confirmDelete=true is required to delete a label");
    const response = await zohoFetch(config, path, { method: "DELETE" });
    await zohoJson(response, path, "DELETE");
    return `Label ${input.labelId} deleted.`;
  }
  if (!input.displayName && !input.color) throw new Error("displayName or color is required for update");
  const response = await zohoFetch(config, path, {
    method: "PUT",
    body: JSON.stringify({ ...(input.displayName && { displayName: input.displayName }), ...(input.color && { color: input.color }) }),
  });
  await zohoJson(response, path, "PUT");
  return `Label ${input.labelId} updated.`;
}
