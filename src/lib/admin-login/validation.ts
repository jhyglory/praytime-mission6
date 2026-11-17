import { z } from "zod";
import type { AdminLoginCredentials } from "./contracts";

export type AdminLoginFieldErrors = Partial<Record<keyof AdminLoginCredentials, string>>;
const emailSchema = z.email();

export function validateAdminLogin(credentials: AdminLoginCredentials): AdminLoginFieldErrors {
  const errors: AdminLoginFieldErrors = {};
  const email = credentials.email.trim();
  if (!email) errors.email = "이메일을 입력해 주세요.";
  else if (email.length > 254 || !emailSchema.safeParse(email).success) errors.email = "이메일 주소 형식을 확인해 주세요.";
  if (!credentials.password) errors.password = "비밀번호를 입력해 주세요.";
  return errors;
}
