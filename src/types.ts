/** TypeScript interfaces for Zoho Mail API responses. */

export interface ZohoAccount {
  accountId: string;
  displayName: string;
  emailAddress: string[];
  primaryEmailAddress: string;
}

export interface ZohoFolder {
  folderId: string;
  folderName: string;
  folderPath: string;
  messageCount: number;
  unreadMessageCount: number;
  folderType: string;
}

export interface ZohoEmailSummary {
  messageId: string;
  folderId: string;
  subject: string;
  sender: string;
  fromAddress: string;
  toAddress: string;
  receivedTime: string;
  sentDateInGMT: string;
  hasAttachment: string;
  status2: string;
  summary: string;
}

/** Response from the /details endpoint (email metadata). */
export interface ZohoEmailDetails {
  messageId: string;
  folderId: string;
  subject: string;
  sender: string;
  fromAddress: string;
  toAddress: string;
  ccAddress: string;
  receivedTime: string;
  sentDateInGMT: string;
  hasAttachment: string;
  status2: string;
  size: string;
  priority: string;
}

/** Response from the /content endpoint (email body only). */
export interface ZohoEmailContent {
  messageId: string;
  content: string;
}

export interface ZohoTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  api_domain: string;
}

export interface ZohoApiResponse<T> {
  status: { code: number; description: string };
  data: T;
}

export interface ZohoSearchResult {
  messageId: string;
  folderId: string;
  subject: string;
  sender: string;
  fromAddress: string;
  receivedTime: string;
  sentDateInGMT: string;
  hasAttachment: string;
  summary: string;
}
