import { describe, expect, test } from "bun:test";
import { deleteEmailSchema } from "../src/tools/delete-email.js";
import { manageLabelSchema } from "../src/tools/labels.js";
import { updateEmailsSchema } from "../src/tools/update-emails.js";
import { buildListEmailsParams, listEmailsSchema } from "../src/tools/list-emails.js";
import { buildSearchKey, buildSearchParams, getSearchReceivedTime, searchEmailsSchema } from "../src/tools/search-emails.js";
import { formatFolders } from "../src/tools/list-folders.js";
import { resolveMailFormat } from "../src/tools/send-email.js";

describe("tool schemas", () => {
  test("accepts supported bulk actions", () => {
    expect(updateEmailsSchema.parse({ action: "archive", messageIds: ["1", "2"] })).toEqual({
      action: "archive",
      messageIds: ["1", "2"],
    });
  });

  test("rejects malformed label colors", () => {
    expect(() => manageLabelSchema.parse({ action: "create", displayName: "Work", color: "yellow" })).toThrow();
  });

  test("supports explicit permanent-delete confirmation", () => {
    expect(deleteEmailSchema.parse({ messageId: "1", folderId: "2", permanent: true, confirmPermanent: true }))
      .toMatchObject({ permanent: true, confirmPermanent: true });
  });
});

describe("mail query construction", () => {
  test("turns plain words into valid Zoho entire-search clauses", () => {
    expect(buildSearchKey({ query: "quarterly report" })).toBe("entire:quarterly::entire:report");
  });

  test("supports exact phrases and structured filters", () => {
    expect(buildSearchKey({
      query: "quarterly report",
      exactPhrase: true,
      folderName: "Client Work",
      hasAttachment: true,
      fromDate: "01-Jan-2026",
    })).toBe('entire:"quarterly report"::in:"Client Work"::has:attachment::fromDate:01-Jan-2026');
  });

  test("preserves existing Zoho search syntax for backwards compatibility", () => {
    expect(buildSearchKey({ query: "subject:Bill::sender:billing@example.com" }))
      .toBe("subject:Bill::sender:billing@example.com");
  });

  test("uses one-based pagination and the correct archived/sort parameters", () => {
    const params = buildListEmailsParams({ includeArchived: true, sortBy: "size", sortAscending: true });
    expect(params.get("start")).toBe("1");
    expect(params.get("includearchive")).toBe("true");
    expect(params.get("sortBy")).toBe("size");
    expect(params.get("sortorder")).toBe("true");
  });

  test("searches through the current instant and encodes recipient options", () => {
    const params = buildSearchParams({ query: "R&D report", includeRecipients: true }, 1_700_000_000_000);
    expect(params.get("searchKey")).toBe("entire:R&D::entire:report");
    expect(params.get("receivedTime")).toBe("1700000000000");
    expect(params.get("start")).toBe("1");
    expect(params.get("includeto")).toBe("true");
    expect(params.toString()).toContain("R%26D");
  });

  test("rejects zero-based pagination and allows Zoho's 200-result search limit", () => {
    expect(() => listEmailsSchema.parse({ start: 0 })).toThrow();
    expect(searchEmailsSchema.parse({ query: "invoice", limit: 200 }).limit).toBe(200);
    expect(() => searchEmailsSchema.parse({ query: "invoice", limit: 201 })).toThrow();
  });
});

describe("Zoho response normalization", () => {
  test("formats folders without nonexistent count fields", () => {
    expect(formatFolders([{ folderId: "1", folderName: "Inbox", folderType: "Inbox" }]))
      .toBe("Mail Folders:\n- Inbox (ID: 1)");
  });

  test("uses lowercase receivedtime from search responses", () => {
    expect(getSearchReceivedTime({ receivedtime: 1709856468000 })).toBe(1709856468000);
    expect(getSearchReceivedTime({ receivedTime: "1709856408000", receivedtime: 1709856468000 }))
      .toBe("1709856408000");
  });

  test("keeps omitted mail format plaintext without HTML guessing", () => {
    expect(resolveMailFormat(undefined)).toBe("plaintext");
    expect(resolveMailFormat("html")).toBe("html");
  });
});
