export interface FirestoreStatus {
  configured: boolean;
  projectId: string;
  databaseId: string;
  keyFile?: string;
  keyFileFound?: boolean;
  clientEmail?: string;
}
