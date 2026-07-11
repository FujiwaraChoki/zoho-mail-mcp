/** List the Zoho Mail accounts available to the current OAuth identity. */

import { z } from "zod";
import type { ZohoConfig } from "../config.js";
import { getAccounts } from "../client.js";

export const listAccountsSchema = z.object({
  refresh: z.boolean().optional().describe("Refresh cached account information."),
});

export type ListAccountsInput = z.infer<typeof listAccountsSchema>;

export async function listAccounts(config: ZohoConfig, input: ListAccountsInput): Promise<string> {
  const accounts = await getAccounts(config, input.refresh ?? false);
  return accounts.map((account) => {
    const selected = account.accountId === config.accountId
      || (!config.accountId && config.accountEmail
        && [account.primaryEmailAddress, ...(account.emailAddress ?? [])]
          .some((email) => email.toLowerCase() === config.accountEmail));
    return `- ${account.displayName || account.primaryEmailAddress}${selected ? " [selected]" : ""}\n  Primary: ${account.primaryEmailAddress}\n  ID: ${account.accountId}`;
  }).join("\n\n");
}
