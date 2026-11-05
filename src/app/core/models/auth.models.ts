export interface TokenPayload {
  sub?: string;
  clientId?: string;
  userName?: string;
  iat?: number;
  exp?: number;
  [key: string]: unknown;
}

export interface TokenInspection {
  configured: boolean;
  status: 'ACTIVE' | 'EXPIRING_SOON' | 'EXPIRED' | 'MISSING';
  statusText: string;
  clientId?: string;
  tokenMasked?: string;
  issuedAtSec?: number;
  expiresAtSec?: number;
  issuedAtIST?: string;
  expiresAtIST?: string;
  secondsRemaining: number;
  timeRemainingFormatted?: string;
  isExpired: boolean;
  isExpiringSoon: boolean;
  payload?: TokenPayload | null;
}

export interface TokenVerifyResult {
  valid: boolean;
  status?: string;
  message?: string;
  profile?: {
    clientId?: string;
    dhanClientId?: string;
    userName?: string;
    email?: string;
  };
}

export interface TokenUpdateDto {
  token: string;
  clientId?: string;
}
