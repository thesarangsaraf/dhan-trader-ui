export interface NotificationChannelStatus {
  enabled: boolean;
  configured: boolean;
  chatId?: string;
  botConfigured?: boolean;
}

export interface NtfyChannelStatus {
  enabled: boolean;
  configured: boolean;
  topic: string;
  serverUrl: string;
  subscriptionUrl?: string;
}

export interface NotificationSettings {
  telegram: NotificationChannelStatus;
  ntfy: NtfyChannelStatus;
  updatedAt?: string;
}

export interface UpdateNotificationSettingsPayload {
  telegramEnabled?: boolean;
  ntfyEnabled?: boolean;
  ntfyTopic?: string;
  ntfyServerUrl?: string;
}

export interface NotificationTestResult {
  telegram: { sent: boolean; reason?: string; error?: string };
  ntfy: { sent: boolean; reason?: string; error?: string };
}
