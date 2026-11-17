import { describe, expect, it } from "vitest";
import { ADMIN_LOGIN_USERNAME_MAX_LENGTH, validateAdminLogin } from "../src/lib/admin-login/validation";

describe("admin login input validation", () => {
  it("identifies both missing inputs", () => {
    expect(validateAdminLogin({ username: "  ", password: "" })).toEqual({ username: "아이디를 입력해 주세요.", password: "비밀번호를 입력해 주세요." });
  });
  it.each(["review-operator", "review_operator", "review.operator", "review123"])("accepts a non-email identifier %s", username => {
    expect(validateAdminLogin({ username, password: "test-only-password" })).toEqual({});
  });
  it("uses trimmed identifier validation without changing credentials or the raw password", () => {
    const credentials = { username: " review-operator ", password: " 한글 : password " };
    expect(validateAdminLogin(credentials)).toEqual({});
    expect(credentials.username).toBe(" review-operator ");
    expect(credentials.password).toBe(" 한글 : password ");
  });
  it("accepts the identifier length boundary and rejects an oversized identifier", () => {
    expect(validateAdminLogin({ username: "a".repeat(ADMIN_LOGIN_USERNAME_MAX_LENGTH), password: "test-only-password" })).toEqual({});
    expect(validateAdminLogin({ username: "a".repeat(ADMIN_LOGIN_USERNAME_MAX_LENGTH + 1), password: "test-only-password" })).toEqual({ username: "아이디는 80자 이하로 입력해 주세요." });
  });
  it("reports a missing password without rejecting a valid identifier", () => {
    expect(validateAdminLogin({ username: "review-operator", password: "" })).toEqual({ password: "비밀번호를 입력해 주세요." });
  });
});
