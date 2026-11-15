export interface UserProfile {
  username: string;
  role: string;
}

export interface LoginDto {
  username: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: UserProfile;
}

export interface RefreshTokenDto {
  refreshToken: string;
}

export interface RefreshResponse {
  accessToken: string;
  user?: UserProfile;
}

export interface ChangePasswordDto {
  currentPassword: string;
  newPassword: string;
}

export interface UserSummary {
  username: string;
  role: string;
  createdAt: string;
  updatedAt: string;
  sessionCount: number;
}

export interface CreateUserPayload {
  username: string;
  password: string;
  role?: string;
}

export interface UpdateUserPayload {
  password?: string;
  role?: string;
}

export interface ActiveSession {
  id: string;
  username: string;
  userAgent?: string;
  browser: string;
  os: string;
  deviceType: string;
  ip?: string;
  createdAt: string;
  expiresAt: string;
  isCurrent: boolean;
}
