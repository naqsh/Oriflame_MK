/** Shared by the proxy, Server Actions and pages; no server-only imports here. */
export const ADMIN_COOKIE = "admin_session";
export const ADMIN_PATH = "/admin";
export const LOGIN_PATH = "/admin/login";

export const INVALID_LOGIN = "Invalid email or password.";
export const LOGIN_UNAVAILABLE = "Sign-in is unavailable right now. Please try again shortly.";
export const TOO_MANY_ATTEMPTS = "Too many attempts. Please wait a minute and try again.";

export interface LoginState {
  error: string | null;
  fieldErrors?: { email?: string; password?: string };
}

export interface SyncActionState {
  ok: boolean;
  message: string;
}
