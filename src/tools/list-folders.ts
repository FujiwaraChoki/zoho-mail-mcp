/** List all mail folders with unread counts. */

import { z } from "zod";
import type { ZohoConfig } from "../config.js";
import type { ZohoFolder } from "../types.js";
import { zohoFetch, getAccountId } from "../client.js";

export const listFoldersSchema = z.object({});

let cachedFolders: ZohoFolder[] | null = null;

export async function listFolders(config: ZohoConfig): Promise<string> {
  if (cachedFolders) {
    return formatFolders(cachedFolders);
  }

  const accountId = await getAccountId(config);
  const response = await zohoFetch(config, `/accounts/${accountId}/folders`);

  if (!response.ok) {
    throw new Error(`Failed to list folders: ${response.status} ${await response.text()}`);
  }

  const body = await response.json();
  const folders = (body as { data: ZohoFolder[] }).data;
  cachedFolders = folders;

  return formatFolders(folders);
}

function formatFolders(folders: ZohoFolder[]): string {
  if (!folders || folders.length === 0) {
    return "No folders found.";
  }

  const lines = folders.map((f) =>
    `- ${f.folderName} (ID: ${f.folderId}) - ${f.unreadMessageCount} unread / ${f.messageCount} total`
  );

  return `Mail Folders:\n${lines.join("\n")}`;
}
