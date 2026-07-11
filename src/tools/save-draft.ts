/** Save an email as a draft or reusable template. */

import { z } from "zod";
import type { ZohoConfig } from "../config.js";
import { getAccount, zohoData } from "../client.js";
import { uploadAttachment } from "./attachments.js";

export const saveDraftSchema = z.object({
  mode: z.enum(["draft", "template"]).optional().describe("Save as draft (default) or template."),
  toAddress: z.string().min(1),
  subject: z.string().optional(),
  content: z.string().optional(),
  mailFormat: z.enum(["html", "plaintext"]).optional(),
  ccAddress: z.string().optional(),
  bccAddress: z.string().optional(),
  askReceipt: z.boolean().optional(),
  inReplyTo: z.string().optional().describe("RFC Message-ID when saving a reply draft."),
  refHeader: z.string().optional().describe("Space-separated prior RFC Message-IDs for threaded replies."),
  attachmentPaths: z.array(z.string()).max(10).optional().describe("Local file paths to upload and attach."),
});

export type SaveDraftInput = z.infer<typeof saveDraftSchema>;

export async function saveDraft(config: ZohoConfig, input: SaveDraftInput): Promise<string> {
  const account = await getAccount(config);
  const fromAddress = account.primaryEmailAddress || account.emailAddress?.[0];
  if (!fromAddress) throw new Error("Could not determine sender email address");
  const attachments = input.attachmentPaths?.length
    ? await Promise.all(input.attachmentPaths.map((path) => uploadAttachment(config, path)))
    : undefined;
  const payload = {
    fromAddress,
    toAddress: input.toAddress,
    mode: input.mode ?? "draft",
    subject: input.subject ?? "",
    content: input.content ?? "",
    mailFormat: input.mailFormat ?? "html",
    ...(input.ccAddress && { ccAddress: input.ccAddress }),
    ...(input.bccAddress && { bccAddress: input.bccAddress }),
    ...(input.askReceipt !== undefined && { askReceipt: input.askReceipt ? "yes" : "no" }),
    ...(input.inReplyTo && { inReplyTo: input.inReplyTo }),
    ...(input.refHeader && { refHeader: input.refHeader }),
    ...(attachments && { attachments }),
  };
  const result = await zohoData<{ messageId?: string }>(config, `/accounts/${account.accountId}/messages`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return `${input.mode ?? "draft"} saved successfully${result?.messageId ? ` (ID: ${result.messageId})` : ""}.`;
}
