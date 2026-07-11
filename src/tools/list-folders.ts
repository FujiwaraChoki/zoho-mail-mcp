/** List all mail folders with unread counts. */

import { z } from "zod";
import type { ZohoConfig } from "../config.js";
import type { ZohoFolder } from "../types.js";
import { zohoData, getAccountId } from "../client.js";

export const listFoldersSchema = z.object({
  refresh: z.boolean().optional().describe("Refresh counts instead of using the short-lived cache."),
});

let cache: { folders: ZohoFolder[]; expiresAt: number } | null = null;

export async function listFolders(config: ZohoConfig, refresh = false): Promise<string> {
  if (!refresh && cache && Date.now() < cache.expiresAt) {
    return formatFolders(cache.folders);
  }

  const accountId = await getAccountId(config);
  const folders = await zohoData<ZohoFolder[]>(config, `/accounts/${accountId}/folders`);
  cache = { folders, expiresAt: Date.now() + 30_000 };

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
