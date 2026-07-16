"use client";

import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  LockKeyhole,
  LogIn,
  LogOut,
  Mail,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { type FormEvent, useEffect, useState } from "react";

type AuthUser = {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  createdAt: string;
  lastLoginAt: string;
  authProvider: string;
  plan: string | null;
  creditsRemaining: number | null;
  creditsTotal: number | null;
  validUntil: string | null;
};

type CredentialMode = "register" | "login";

export function AuthPortal({ mode }: { mode: "register" | "account" }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [credentialMode, setCredentialMode] = useState<CredentialMode>("register");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [returnTo, setReturnTo] = useState("/account");

  useEffect(() => {
    const hashTimer = window.setTimeout(() => {
      if (window.location.hash === "#login") setCredentialMode("login");
      const requestedReturn = new URLSearchParams(window.location.search).get("return_to");
      if (requestedReturn?.startsWith("/checkout?plan=")) setReturnTo(requestedReturn);
    }, 0);
    void fetch("/api/auth/session", { headers: { Accept: "application/json" } })
      .then((response) => response.json() as Promise<{ user: AuthUser | null }>)
      .then(({ user: sessionUser }) => setUser(sessionUser))
      .catch(() => setUser(null))
      .finally(() => setLoaded(true));
    return () => window.clearTimeout(hashTimer);
  }, []);

  async function logout() {
    const response = await fetch("/api/auth/logout", { method: "POST" });
    if (response.ok) window.location.href = "/";
  }

  async function submitCredentials(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    if (password.length < 8) {
      setFormError("Password must contain at least 8 characters.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`/api/auth/${credentialMode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (response.ok) {
        window.location.href = returnTo;
        return;
      }

      const body = (await response.json()) as { error?: { code?: string } };
      const code = body.error?.code;
      setFormError(
        code === "EMAIL_IN_USE"
          ? "An account already uses this email. Sign in instead."
          : code === "RATE_LIMITED"
            ? "Too many attempts. Please wait and try again."
            : credentialMode === "login"
              ? "Email or password is incorrect."
              : "Check your email and password, then try again.",
      );
    } catch {
      setFormError("The account service is unavailable. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function switchCredentialMode(nextMode: CredentialMode) {
    setCredentialMode(nextMode);
    setFormError(null);
    window.history.replaceState({}, "", nextMode === "login" ? "/register#login" : "/register");
  }

  return (
    <main className="auth-page">
      <nav className="auth-nav">
        <Link className="brand" href="/" aria-label="Cutline home">
          <span className="brand-mark"><span /></span>
          CUTLINE
        </Link>
        <Link className="back-home" href="/"><ArrowLeft size={15} /> Back to studio</Link>
      </nav>

      {mode === "register" ? (
        <section className="auth-layout">
          <div className="auth-intro">
            <div className="eyebrow"><span>01</span> Create your workspace</div>
            <h1>One account.<br /><em>Your way in.</em></h1>
            <p>
              Create an account with your email, or continue with Google. Your images still move
              through the processing pipeline without being stored.
            </p>
          </div>

          <div className="auth-card">
            <div className="auth-card-index">REG / 01</div>
            {user ? (
              <>
                <div className="auth-icon"><UserRound size={30} /></div>
                <h2>Your account is ready.</h2>
                <p>You are signed in as {user.email}.</p>
                <Link className="auth-primary" href="/account">
                  Open personal center <ArrowRight size={17} />
                </Link>
              </>
            ) : (
              <>
                <div className="credential-heading">
                  <div className="auth-icon"><UserRound size={27} /></div>
                  <div>
                    <small>{credentialMode === "register" ? "New workspace" : "Welcome back"}</small>
                    <h2>{credentialMode === "register" ? "Create your account" : "Sign in to Cutline"}</h2>
                  </div>
                </div>

                <form className="credential-form" onSubmit={(event) => void submitCredentials(event)}>
                  <label htmlFor="auth-email">Email address</label>
                  <div className="credential-input">
                    <Mail size={16} />
                    <input
                      id="auth-email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      placeholder="you@company.com"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      required
                    />
                  </div>

                  <label htmlFor="auth-password">Password</label>
                  <div className="credential-input">
                    <LockKeyhole size={16} />
                    <input
                      id="auth-password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete={credentialMode === "register" ? "new-password" : "current-password"}
                      placeholder="At least 8 characters"
                      minLength={8}
                      maxLength={128}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      required
                    />
                    <button
                      type="button"
                      className="password-toggle"
                      onClick={() => setShowPassword((visible) => !visible)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>

                  {formError ? <div className="credential-error" role="alert">{formError}</div> : null}
                  <button className="auth-primary" type="submit" disabled={submitting}>
                    {submitting
                      ? "Please wait…"
                      : credentialMode === "register"
                        ? "Create account"
                        : "Sign in"}
                    {!submitting ? <ArrowRight size={17} /> : null}
                  </button>
                </form>

                <div className="auth-divider"><span>or</span></div>
                <a className="google-button" href={`/api/auth/google?return_to=${encodeURIComponent(returnTo)}`}>
                  <span className="google-mark" aria-hidden="true">G</span>
                  Continue with Google
                </a>

                <small className="credential-switch">
                  {credentialMode === "register" ? "Already registered?" : "New to Cutline?"}{" "}
                  <button
                    type="button"
                    onClick={() => switchCredentialMode(credentialMode === "register" ? "login" : "register")}
                  >
                    {credentialMode === "register" ? "Sign in" : "Create an account"}
                  </button>
                </small>
                <p className="credential-privacy"><ShieldCheck size={14} /> Passwords are encrypted. Images are never saved.</p>
              </>
            )}
          </div>
        </section>
      ) : (
        <section className="account-layout">
          <header className="account-heading">
            <div className="eyebrow"><span>02</span> Personal center</div>
            <h1>Your Cutline<br /><em>identity.</em></h1>
          </header>

          {!loaded ? (
            <div className="account-card account-loading" aria-live="polite">Loading account…</div>
          ) : user ? (
            <div className="account-card">
              <div className="account-card-topline"><span>ACCOUNT / ACTIVE</span><i /></div>
              <div className="profile-header">
                {user.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.avatarUrl} alt="" referrerPolicy="no-referrer" />
                ) : (
                  <div className="profile-placeholder"><UserRound size={32} /></div>
                )}
                <div><small>{user.authProvider}</small><h2>{user.name ?? "Cutline user"}</h2></div>
              </div>
              <dl className="profile-details">
                <div><dt>Email</dt><dd>{user.email}</dd></div>
                <div><dt>Current plan</dt><dd>{user.plan ? user.plan.charAt(0).toUpperCase() + user.plan.slice(1) : "Free"}</dd></div>
                <div><dt>Image credits</dt><dd>{user.creditsRemaining ?? 0} / {user.creditsTotal ?? 3} remaining</dd></div>
                <div><dt>Valid until</dt><dd>{user.validUntil ? formatDate(user.validUntil) : "No expiry"}</dd></div>
                <div><dt>Member since</dt><dd>{formatDate(user.createdAt)}</dd></div>
                <div><dt>Last sign in</dt><dd>{formatDate(user.lastLoginAt)}</dd></div>
              </dl>
              <div className="account-actions">
                <Link className="auth-primary" href="/">Open product studio <ArrowRight size={17} /></Link>
                <button type="button" className="auth-secondary" onClick={() => void logout()}>
                  <LogOut size={16} /> Sign out
                </button>
              </div>
              <p className="privacy-line"><ShieldCheck size={15} /> Account details are stored securely. Product images are not stored.</p>
            </div>
          ) : (
            <div className="account-card signed-out-card">
              <div className="auth-icon"><UserRound size={30} /></div>
              <h2>Sign in to view your account.</h2>
              <p>Your personal center is available after registering or signing in.</p>
              <Link className="auth-primary" href="/register#login">
                <LogIn size={17} /> Sign in
              </Link>
              <small>New to Cutline? <Link href="/register">Create an account</Link></small>
            </div>
          )}
        </section>
      )}
    </main>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en", { year: "numeric", month: "short", day: "2-digit" }).format(date);
}
