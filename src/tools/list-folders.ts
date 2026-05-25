/** List all mail folders, optionally with paginated unread/total counts. */

import { z } from "zod";
import type { ZohoConfig } from "../config.js";
import type { ZohoFolder } from "../types.js";
import { zohoFetch, getAccountId } from "../client.js";

export const listFoldersSchema = z.object({
  includeCounts: z
    .boolean()
    .optional()
    .describe(
      "If true, paginate each folder to compute unread/total counts. Slow on large mailboxes — off by default."
    ),
});

let cachedFolders: ZohoFolder[] | null = null;

const PAGE_SIZE = 200;

export async function listFolders(
  config: ZohoConfig,
  input: { includeCounts?: boolean } = {}
): Promise<string> {
  const accountId = await getAccountId(config);

  let folders = cachedFolders;
  if (!folders) {
    const response = await zohoFetch(config, `/accounts/${accountId}/folders`);
    if (!response.ok) {
      throw new Error(`Failed to list folders: ${response.status} ${await response.text()}`);
    }
    const body = await response.json();
    folders = (body as { data: ZohoFolder[] }).data;
    cachedFolders = folders;
  }

  if (!input.includeCounts) {
    return formatFolders(folders);
  }

  // Sequential per folder — Zoho rate limit is 30 req/min, and large folders need
  // many pages. Parallelism just stacks up rate-limiter waits and risks the server
  // dropping connections.
  const byId = new Map<string, { unread: number; total: number }>();
  for (const f of folders) {
    const total = await countMessages(config, accountId, f.folderId);
    const unread = await countMessages(config, accountId, f.folderId, "unread");
    byId.set(f.folderId, { total, unread });
  }
  return formatFolders(folders, byId);
}

async function countMessages(
  config: ZohoConfig,
  accountId: string,
  folderId: string,
  status?: "unread"
): Promise<number> {
  let total = 0;
  let start = 1;
  while (true) {
    const params = new URLSearchParams({
      folderId,
      start: String(start),
      limit: String(PAGE_SIZE),
    });
    if (status) params.set("status", status);
    const r = await zohoFetch(
      config,
      `/accounts/${accountId}/messages/view?${params.toString()}`
    );
    if (!r.ok) {
      throw new Error(`Failed to count messages: ${r.status} ${await r.text()}`);
    }
    const body = (await r.json()) as { data?: unknown[] };
    const len = body.data?.length ?? 0;
    total += len;
    if (len < PAGE_SIZE) break;
    start += PAGE_SIZE;
  }
  return total;
}

function formatFolders(
  folders: ZohoFolder[],
  counts?: Map<string, { unread: number; total: number }>
): string {
  if (!folders || folders.length === 0) {
    return "No folders found.";
  }

  const lines = folders.map((f) => {
    const c = counts?.get(f.folderId);
    const suffix = c ? ` - ${c.unread} unread / ${c.total} total` : "";
    return `- ${f.folderName} (ID: ${f.folderId})${suffix}`;
  });

  return `Mail Folders:\n${lines.join("\n")}`;
}
