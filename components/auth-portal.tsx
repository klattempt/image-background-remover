"use client";

import { ArrowLeft, ArrowRight, Check, LogIn, LogOut, ShieldCheck, UserRound } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

type AuthUser = {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  createdAt: string;
  lastLoginAt: string;
};

export function AuthPortal({ mode }: { mode: "register" | "account" }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    void fetch("/api/auth/session", { headers: { Accept: "application/json" } })
      .then((response) => response.json() as Promise<{ user: AuthUser | null }>)
      .then(({ user: sessionUser }) => setUser(sessionUser))
      .catch(() => setUser(null))
      .finally(() => setLoaded(true));
  }, []);

  async function logout() {
    const response = await fetch("/api/auth/logout", { method: "POST" });
    if (response.ok) window.location.href = "/";
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
            <h1>One account.<br /><em>No extra password.</em></h1>
            <p>
              Register with Google to keep your Cutline identity simple. Your images still move
              through the processing pipeline without being stored.
            </p>
          </div>

          <div className="auth-card">
            <div className="auth-card-index">REG / 01</div>
            <div className="auth-icon"><UserRound size={30} /></div>
            <h2>{user ? "Your account is ready." : "Register with Google"}</h2>
            <p>
              {user
                ? `You are signed in as ${user.email}.`
                : "Your verified Google email creates your account securely in one step."}
            </p>
            {user ? (
              <Link className="auth-primary" href="/account">
                Open personal center <ArrowRight size={17} />
              </Link>
            ) : (
              <a className="auth-primary" href="/api/auth/google?return_to=/account">
                <LogIn size={17} /> Continue with Google
              </a>
            )}
            <div className="auth-benefits">
              <span><Check size={14} /> No new password</span>
              <span><Check size={14} /> Verified email only</span>
              <span><ShieldCheck size={14} /> Images are never saved</span>
            </div>
            <small>Already registered? <a href="/api/auth/google?return_to=/account">Sign in</a></small>
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
                <div><small>Google account</small><h2>{user.name ?? "Cutline user"}</h2></div>
              </div>
              <dl className="profile-details">
                <div><dt>Email</dt><dd>{user.email}</dd></div>
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
              <p>Your personal center is available after registering or signing in with Google.</p>
              <a className="auth-primary" href="/api/auth/google?return_to=/account">
                <LogIn size={17} /> Sign in with Google
              </a>
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
