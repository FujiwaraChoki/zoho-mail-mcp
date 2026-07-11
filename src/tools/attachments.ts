/** Inspect, upload, and download email attachments. */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { z } from "zod";
import type { ZohoConfig } from "../config.js";
import type { ZohoAttachment, ZohoAttachmentInfo } from "../types.js";
import { getAccountId, zohoData, zohoFetch, zohoJson } from "../client.js";

export interface UploadedAttachment {
  storeName: string;
  attachmentName: string;
  attachmentPath: string;
}

export const listAttachmentsSchema = z.object({
  messageId: z.string(),
  folderId: z.string(),
  includeInline: z.boolean().optional(),
});

export const downloadAttachmentSchema = z.object({
  messageId: z.string(),
  folderId: z.string(),
  attachmentId: z.string(),
  fileName: z.string().optional().describe("Output filename; defaults to the name reported by Zoho."),
  outputDirectory: z.string().optional().describe("Output directory; defaults to the system temp zoho-mail-mcp folder."),
  confirmOverwrite: z.boolean().optional().describe("Allow replacing an existing file (default: false)."),
});

export type ListAttachmentsInput = z.infer<typeof listAttachmentsSchema>;
export type DownloadAttachmentInput = z.infer<typeof downloadAttachmentSchema>;

export async function listAttachments(config: ZohoConfig, input: ListAttachmentsInput): Promise<string> {
  const accountId = await getAccountId(config);
  const params = new URLSearchParams({ includeInline: String(input.includeInline ?? false) });
  const path = `/accounts/${accountId}/folders/${input.folderId}/messages/${input.messageId}/attachmentinfo?${params}`;
  const info = await zohoData<ZohoAttachmentInfo>(config, path);
  const format = (item: ZohoAttachment, kind: string) =>
    `- ${item.attachmentName} (${item.attachmentSize} bytes, ${kind})\n  ID: ${item.attachmentId}`;
  const items = [
    ...(info.attachments ?? []).map((item) => format(item, "attachment")),
    ...(info.inline ?? []).map((item) => format(item, "inline")),
  ];
  return items.length ? `Attachments:\n${items.join("\n")}` : "No attachments found.";
}

export async function uploadAttachment(config: ZohoConfig, filePath: string): Promise<UploadedAttachment> {
  const accountId = await getAccountId(config);
  const bytes = await readFile(filePath);
  const params = new URLSearchParams({ fileName: basename(filePath), isInline: "false" });
  const path = `/accounts/${accountId}/messages/attachments?${params}`;
  const response = await zohoFetch(config, path, {
    method: "POST",
    headers: { "Content-Type": "application/octet-stream" },
    body: bytes,
  });
  const body = await zohoJson<{ data: UploadedAttachment }>(response, path, "POST");
  return body.data;
}

export async function downloadAttachment(config: ZohoConfig, input: DownloadAttachmentInput): Promise<string> {
  const accountId = await getAccountId(config);
  const infoPath = `/accounts/${accountId}/folders/${input.folderId}/messages/${input.messageId}/attachmentinfo`;
  const info = await zohoData<ZohoAttachmentInfo>(config, infoPath);
  const attachment = [...(info.attachments ?? []), ...(info.inline ?? [])]
    .find((item) => item.attachmentId === input.attachmentId);
  if (!attachment && !input.fileName) throw new Error("Attachment ID was not found; provide fileName to download it anyway");

  const safeName = basename(input.fileName ?? attachment!.attachmentName);
  const outputDirectory = resolve(input.outputDirectory ?? `${tmpdir()}/zoho-mail-mcp`);
  const outputPath = resolve(outputDirectory, safeName);
  if (dirname(outputPath) !== outputDirectory) throw new Error("Invalid output filename");

  const path = `/accounts/${accountId}/folders/${input.folderId}/messages/${input.messageId}/attachments/${input.attachmentId}`;
  const response = await zohoFetch(config, path, { headers: { Accept: "application/octet-stream" } });
  if (!response.ok) await zohoJson(response, path);
  const bytes = new Uint8Array(await response.arrayBuffer());
  await mkdir(outputDirectory, { recursive: true });
  try {
    await writeFile(outputPath, bytes, { flag: input.confirmOverwrite ? "w" : "wx" });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      throw new Error(`Output file already exists: ${outputPath}. Set confirmOverwrite=true to replace it.`);
    }
    throw error;
  }
  return `Attachment saved to ${outputPath} (${bytes.byteLength} bytes).`;
}
