export interface FirestoreStatus {
  configured: boolean;
  projectId: string;
  databaseId: string;
  keyFile?: string;
  keyFileFound?: boolean;
  clientEmail?: string;
}

export interface FirestoreTestResult {
  success: boolean;
  message: string;
  projectId?: string;
  databaseId?: string;
  latencyMs?: number;
  collections?: string[];
  tokenSaved?: boolean;
  tokenMessage?: string;
  tokenCollection?: string;
  error?: string;
}
