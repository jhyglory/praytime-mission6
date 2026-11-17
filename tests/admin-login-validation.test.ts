import { describe, expect, it } from "vitest";
import { validateAdminLogin } from "../src/lib/admin-login/validation";

describe("admin login input validation", () => {
  it("identifies both missing inputs", () => {
    expect(validateAdminLogin({ email: "  ", password: "" })).toEqual({ email: "이메일을 입력해 주세요.", password: "비밀번호를 입력해 주세요." });
  });
  it.each(["invalid", "name@", "name@example", "a".repeat(250) + "@example.com"])("rejects an invalid email %s", email => {
    expect(validateAdminLogin({ email, password: "test-only-password" })).toEqual({ email: "이메일 주소 형식을 확인해 주세요." });
  });
  it("accepts an email after removing surrounding whitespace without changing the password", () => {
    const credentials = { email: " admin@example.com ", password: " 한글 : password " };
    expect(validateAdminLogin(credentials)).toEqual({});
    expect(credentials.password).toBe(" 한글 : password ");
  });
});
