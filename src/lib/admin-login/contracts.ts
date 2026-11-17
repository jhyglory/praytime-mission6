export interface AdminLoginCredentials {
  email: string;
  password: string;
}

/** Resolve only after the server has verified a real session. Never authorizes an API by itself. */
export type AdminLoginAuthenticator = (credentials: AdminLoginCredentials, signal: AbortSignal) => Promise<void>;

export class AdminLoginAuthenticationError extends Error {
  constructor(readonly code: "invalid-credentials" | "unavailable") {
    super(code);
    this.name = "AdminLoginAuthenticationError";
  }
}
