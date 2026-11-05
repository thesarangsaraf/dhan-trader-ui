export interface TelegramStatus {
  configured: boolean;
  chatId: string;
  botConfigured: boolean;
}

export interface TelegramUpdateDto {
  botToken: string;
  chatId: string;
}
