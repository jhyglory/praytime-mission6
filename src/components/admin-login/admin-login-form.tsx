"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { AdminLoginAuthenticationError, type AdminLoginAuthenticator, type AdminLoginCredentials } from "@/lib/admin-login/contracts";
import { ADMIN_LOGIN_USERNAME_MAX_LENGTH, validateAdminLogin, type AdminLoginFieldErrors } from "@/lib/admin-login/validation";

interface AdminLoginFormProps {
  initialUsername?: string;
  initialPassword?: string;
  authenticate?: AdminLoginAuthenticator;
  onAuthenticated?: () => void;
  disabled?: boolean;
}

export function AdminLoginForm({ initialUsername = "", initialPassword = "", authenticate, onAuthenticated, disabled = false }: AdminLoginFormProps) {
  const id = useId();
  const [values, setValues] = useState<AdminLoginCredentials>(() => ({ username: initialUsername, password: initialPassword }));
  const [errors, setErrors] = useState<AdminLoginFieldErrors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const usernameInput = useRef<HTMLInputElement>(null);
  const passwordInput = useRef<HTMLInputElement>(null);
  const request = useRef<AbortController | null>(null);
  const busy = useRef(false);
  useEffect(() => () => request.current?.abort(), []);
  const unavailable = !authenticate;
  const locked = disabled || pending;

  function change(field: keyof AdminLoginCredentials, value: string) {
    setValues(previous => ({ ...previous, [field]: value }));
    setErrors(previous => ({ ...previous, [field]: undefined }));
    setError("");
  }
  function validateField(field: keyof AdminLoginCredentials) {
    const problem = validateAdminLogin(values)[field];
    setErrors(previous => ({ ...previous, [field]: problem }));
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current || disabled) return;
    const problems = validateAdminLogin(values);
    setErrors(problems);
    setError("");
    if (problems.username || problems.password) {
      (problems.username ? usernameInput : passwordInput).current?.focus();
      return;
    }
    // No fallback transport, Basic header, local session flag, or success simulation.
    if (!authenticate) return;
    const controller = new AbortController();
    request.current = controller;
    busy.current = true;
    setPending(true);
    try {
      await authenticate({ username: values.username.trim(), password: values.password }, controller.signal);
      if (!controller.signal.aborted) {
        setValues(previous => ({ ...previous, password: "" }));
        onAuthenticated?.();
      }
    } catch (reason) {
      if (!controller.signal.aborted) setError(reason instanceof AdminLoginAuthenticationError && reason.code === "invalid-credentials"
        ? "아이디 또는 비밀번호를 확인해 주세요."
        : reason instanceof AdminLoginAuthenticationError && reason.code === "rate-limited"
          ? "로그인 요청이 많습니다. 잠시 후 다시 시도해 주세요."
          : "로그인하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      busy.current = false;
      if (!controller.signal.aborted) setPending(false);
    }
  }

  return <form className="admin-login-form" aria-label="관리자 로그인" aria-busy={pending || undefined} noValidate onSubmit={submit}>
    <div className="admin-login-field">
      <label className="admin-login-label" htmlFor={`${id}-username`}>아이디</label>
      <input className="text-input admin-login-input" id={`${id}-username`} name="username" ref={usernameInput} type="text" inputMode="text" autoComplete="username" autoCapitalize="none" spellCheck={false} maxLength={ADMIN_LOGIN_USERNAME_MAX_LENGTH} placeholder="아이디를 입력하세요." value={values.username} disabled={locked} required aria-invalid={Boolean(errors.username)} aria-describedby={errors.username ? `${id}-username-error` : undefined} onChange={event => change("username", event.target.value)} onBlur={() => validateField("username")} />
      {errors.username && <p className="admin-login-field-error" id={`${id}-username-error`} aria-live="polite">{errors.username}</p>}
    </div>
    <div className="admin-login-field">
      <label className="admin-login-label" htmlFor={`${id}-password`}>비밀번호</label>
      <div className="admin-login-password">
        <input className="text-input admin-login-input" id={`${id}-password`} name="password" ref={passwordInput} type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="비밀번호를 입력하세요." value={values.password} disabled={locked} required aria-invalid={Boolean(errors.password)} aria-describedby={errors.password ? `${id}-password-error` : undefined} onChange={event => change("password", event.target.value)} onBlur={() => validateField("password")} />
        <button className="admin-login-password-toggle" type="button" aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 표시"} aria-pressed={showPassword} aria-controls={`${id}-password`} disabled={locked} onClick={() => setShowPassword(previous => !previous)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" />{showPassword && <path d="m3 3 18 18" />}</svg>
        </button>
      </div>
      {errors.password && <p className="admin-login-field-error" id={`${id}-password-error`} aria-live="polite">{errors.password}</p>}
    </div>
    {error && <p className="admin-login-error" role="alert">{error}</p>}
    <Button type="submit" className="admin-login-submit" state={pending ? "submitting" : disabled || unavailable ? "disabled" : "default"} aria-describedby={unavailable ? `${id}-connection-note` : undefined}>{pending ? "로그인 중..." : "로그인"}</Button>
    {unavailable && <p className="admin-login-connection-note" id={`${id}-connection-note`}>로그인 연결을 준비 중입니다. 현재 화면에서는 계정 정보를 전송하지 않습니다.</p>}
  </form>;
}
