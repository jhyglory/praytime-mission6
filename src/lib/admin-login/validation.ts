import type { AdminLoginCredentials } from "./contracts";

export type AdminLoginFieldErrors = Partial<Record<keyof AdminLoginCredentials, string>>;
export const ADMIN_LOGIN_USERNAME_MAX_LENGTH = 80;

export function validateAdminLogin(credentials: AdminLoginCredentials): AdminLoginFieldErrors {
  const errors: AdminLoginFieldErrors = {};
  const username = credentials.username.trim();
  if (!username) errors.username = "아이디를 입력해 주세요.";
  else if (username.length > ADMIN_LOGIN_USERNAME_MAX_LENGTH) errors.username = "아이디는 80자 이하로 입력해 주세요.";
  if (!credentials.password) errors.password = "비밀번호를 입력해 주세요.";
  return errors;
}
