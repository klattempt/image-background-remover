"use client";

import {
  AlertTriangle,
  ArrowRight,
  Check,
  Download,
  ImageIcon,
  Layers3,
  LoaderCircle,
  LockKeyhole,
  LogIn,
  LogOut,
  PackageCheck,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type ItemStatus = "ready" | "processing" | "completed" | "failed" | "cancelled";

type ImageItem = {
  id: string;
  file: File;
  originalUrl: string;
  resultBlob?: Blob;
  resultUrl?: string;
  status: ItemStatus;
  error?: ErrorCode;
  attempts: number;
  duration?: number;
};

type ErrorCode =
  | "INVALID_FILE_TYPE"
  | "FILE_TOO_LARGE"
  | "BATCH_AUTH_REQUIRED"
  | "RATE_LIMITED"
  | "NO_FOREGROUND"
  | "UPSTREAM_UNAVAILABLE"
  | "DAILY_BUDGET_REACHED"
  | "INVALID_REQUEST"
  | "CONFIGURATION_ERROR"
  | "INTERNAL_ERROR";

type SessionResponse = { token: string; batchId: string; expiresAt: number };
type AuthUser = { id: string; email: string; name: string | null; avatarUrl: string | null };

declare global {
  interface Window {
    turnstile?: {
      render: (element: HTMLElement, options: Record<string, unknown>) => string;
      reset: (widgetId?: string) => void;
    };
  }
}

const MAX_FILES = 20;
const MAX_FILE_BYTES = 15 * 1024 * 1024;
const MAX_DIMENSION = 10_000;
const MAX_ZIP_BYTES = 150 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const TURNSTILE_SITE_KEY =
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "0x4AAAAAAD1I9KHrA_OCn76_";

const errorCopy: Record<ErrorCode, string> = {
  INVALID_FILE_TYPE: "This file type is not supported.",
  FILE_TOO_LARGE: "This image is larger than 15 MB.",
  BATCH_AUTH_REQUIRED: "Please verify again to continue this batch.",
  RATE_LIMITED: "Too many requests. Please wait and try again.",
  NO_FOREGROUND: "We could not detect a clear product in this image.",
  UPSTREAM_UNAVAILABLE: "Background removal is temporarily unavailable.",
  DAILY_BUDGET_REACHED: "Today’s free processing limit has been reached.",
  INVALID_REQUEST: "This image could not be processed.",
  CONFIGURATION_ERROR: "The processing service is not configured yet.",
  INTERNAL_ERROR: "Something went wrong. Please try again.",
};

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function safeFileName(name: string) {
  const base = name.replace(/\.[^.]+$/u, "").replace(/[^a-zA-Z0-9-_]+/gu, "-");
  return `${base || "product"}-white-bg.jpg`;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

async function validateImage(file: File) {
  if (!ALLOWED_TYPES.has(file.type)) return "INVALID_FILE_TYPE" as const;
  if (file.size > MAX_FILE_BYTES) return "FILE_TOO_LARGE" as const;
  try {
    const bitmap = await createImageBitmap(file);
    const tooLarge = Math.max(bitmap.width, bitmap.height) > MAX_DIMENSION;
    bitmap.close();
    return tooLarge ? ("INVALID_REQUEST" as const) : null;
  } catch {
    return "INVALID_REQUEST" as const;
  }
}

async function createWhiteProductImage(transparent: Blob) {
  const bitmap = await createImageBitmap(transparent);
  const scanScale = Math.min(1, 1024 / Math.max(bitmap.width, bitmap.height));
  const scanWidth = Math.max(1, Math.round(bitmap.width * scanScale));
  const scanHeight = Math.max(1, Math.round(bitmap.height * scanScale));
  const scan = document.createElement("canvas");
  scan.width = scanWidth;
  scan.height = scanHeight;
  const scanContext = scan.getContext("2d", { willReadFrequently: true });
  if (!scanContext) throw new Error("INTERNAL_ERROR");
  scanContext.drawImage(bitmap, 0, 0, scanWidth, scanHeight);
  const pixels = scanContext.getImageData(0, 0, scanWidth, scanHeight).data;

  let minX = scanWidth;
  let minY = scanHeight;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < scanHeight; y += 1) {
    for (let x = 0; x < scanWidth; x += 1) {
      if (pixels[(y * scanWidth + x) * 4 + 3] >= 16) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }
  if (maxX < minX || maxY < minY) {
    bitmap.close();
    throw new Error("NO_FOREGROUND");
  }

  const sourceMinX = minX / scanScale;
  const sourceMinY = minY / scanScale;
  const sourceMaxX = (maxX + 1) / scanScale;
  const sourceMaxY = (maxY + 1) / scanScale;
  const boxWidth = sourceMaxX - sourceMinX;
  const boxHeight = sourceMaxY - sourceMinY;
  const scale = 1700 / Math.max(boxWidth, boxHeight);
  const centerX = (sourceMinX + sourceMaxX) / 2;
  const centerY = (sourceMinY + sourceMaxY) / 2;

  const output = document.createElement("canvas");
  output.width = 2000;
  output.height = 2000;
  const context = output.getContext("2d");
  if (!context) {
    bitmap.close();
    throw new Error("INTERNAL_ERROR");
  }
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, 2000, 2000);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(
    bitmap,
    1000 - centerX * scale,
    1000 - centerY * scale,
    bitmap.width * scale,
    bitmap.height * scale,
  );
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    output.toBlob(resolve, "image/jpeg", 0.92),
  );
  output.width = 1;
  output.height = 1;
  scan.width = 1;
  scan.height = 1;
  if (!blob) throw new Error("INTERNAL_ERROR");
  return blob;
}

async function readErrorCode(response: Response): Promise<ErrorCode> {
  try {
    const body = (await response.json()) as { error?: { code?: ErrorCode } };
    return body.error?.code ?? "INTERNAL_ERROR";
  } catch {
    return response.status === 429 ? "RATE_LIMITED" : "INTERNAL_ERROR";
  }
}

function sendEvent(event: string, properties: Record<string, unknown> = {}) {
  void fetch("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event, properties }),
    keepalive: true,
  }).catch(() => undefined);
}

export function BackgroundRemover() {
  const [items, setItems] = useState<ImageItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(
    TURNSTILE_SITE_KEY ? null : "dev-bypass",
  );
  const [downloadedIds, setDownloadedIds] = useState<Set<string>>(new Set());
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authLoaded, setAuthLoaded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const turnstileRef = useRef<HTMLDivElement>(null);
  const turnstileWidgetId = useRef<string | null>(null);
  const abortControllers = useRef(new Map<string, AbortController>());

  const completed = items.filter((item) => item.status === "completed");
  const failed = items.filter((item) => item.status === "failed");
  const processed = items.filter((item) =>
    ["completed", "failed", "cancelled"].includes(item.status),
  ).length;
  const totalResultBytes = completed.reduce((total, item) => total + (item.resultBlob?.size ?? 0), 0);
  const progress = items.length ? Math.round((processed / items.length) * 100) : 0;
  const hasUndownloadedResults = completed.some((item) => !downloadedIds.has(item.id));

  useEffect(() => {
    const authError = new URLSearchParams(window.location.search).get("auth_error");
    if (authError) {
      window.history.replaceState({}, "", window.location.pathname);
      window.setTimeout(
        () => setNotice("Google sign-in could not be completed. Please try again."),
        0,
      );
    }
    void fetch("/api/auth/session", { headers: { Accept: "application/json" } })
      .then((response) => response.json() as Promise<{ user: AuthUser | null }>)
      .then(({ user }) => setAuthUser(user))
      .catch(() => setAuthUser(null))
      .finally(() => setAuthLoaded(true));
  }, []);

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY || !turnstileRef.current) return;

    const renderWidget = () => {
      if (!window.turnstile || !turnstileRef.current || turnstileWidgetId.current) return;
      turnstileWidgetId.current = window.turnstile.render(turnstileRef.current, {
        sitekey: TURNSTILE_SITE_KEY,
        theme: "light",
        size: "flexible",
        callback: (token: string) => setTurnstileToken(token),
        "expired-callback": () => setTurnstileToken(null),
      });
    };

    const existing = document.querySelector<HTMLScriptElement>("script[data-cutline-turnstile]");
    if (existing) {
      renderWidget();
      existing.addEventListener("load", renderWidget, { once: true });
      return () => existing.removeEventListener("load", renderWidget);
    }

    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    script.dataset.cutlineTurnstile = "true";
    script.addEventListener("load", renderWidget, { once: true });
    document.head.appendChild(script);
    return () => script.removeEventListener("load", renderWidget);
  }, []);

  useEffect(() => {
    const shouldWarn = isRunning || hasUndownloadedResults;
    if (!shouldWarn) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [hasUndownloadedResults, isRunning]);

  useEffect(
    () => () => {
      for (const item of items) {
        URL.revokeObjectURL(item.originalUrl);
        if (item.resultUrl) URL.revokeObjectURL(item.resultUrl);
      }
    },
    // Object URLs are also revoked on individual removal and clear; this handles navigation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const updateItem = useCallback((id: string, patch: Partial<ImageItem>) => {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  }, []);

  const addFiles = useCallback(async (files: File[]) => {
    setNotice(null);
    const available = Math.max(0, MAX_FILES - items.length);
    const selected = files.slice(0, available);
    if (files.length > available) {
      setNotice(`Only ${MAX_FILES} images fit in one batch.`);
    }

    const additions: ImageItem[] = [];
    let rejected = 0;
    for (const file of selected) {
      const error = await validateImage(file);
      if (error) {
        rejected += 1;
        continue;
      }
      additions.push({
        id: crypto.randomUUID(),
        file,
        originalUrl: URL.createObjectURL(file),
        status: "ready",
        attempts: 0,
      });
    }

    if (rejected) {
      setNotice(`${rejected} image${rejected === 1 ? " was" : "s were"} skipped. Use JPG, PNG, or WebP up to 15 MB.`);
    }
    if (additions.length) {
      setItems((current) => [...current, ...additions]);
      sendEvent("batch_created", { count: additions.length });
    }
  }, [items.length]);

  async function createSession(count: number) {
    if (!turnstileToken) throw new Error("BATCH_AUTH_REQUIRED");
    const response = await fetch("/api/batch-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ count, turnstileToken }),
    });
    if (!response.ok) throw new Error(await readErrorCode(response));
    setTurnstileToken(TURNSTILE_SITE_KEY ? null : "dev-bypass");
    if (TURNSTILE_SITE_KEY && window.turnstile && turnstileWidgetId.current) {
      window.turnstile.reset(turnstileWidgetId.current);
    }
    return (await response.json()) as SessionResponse;
  }

  async function processItem(item: ImageItem, sessionToken: string) {
    const started = performance.now();
    const controller = new AbortController();
    abortControllers.current.set(item.id, controller);
    updateItem(item.id, { status: "processing", error: undefined, attempts: item.attempts + 1 });

    try {
      let response: Response | null = null;
      let lastError: ErrorCode = "INTERNAL_ERROR";
      for (let attempt = 0; attempt < 3; attempt += 1) {
        response = await fetch("/api/remove-background", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${sessionToken}`,
            "Content-Type": item.file.type,
          },
          body: item.file,
          signal: controller.signal,
        });
        if (response.ok) break;
        lastError = await readErrorCode(response);
        if (!["UPSTREAM_UNAVAILABLE", "RATE_LIMITED"].includes(lastError) || attempt === 2) {
          throw new Error(lastError);
        }
        const retryAfter = Number(response.headers.get("retry-after") ?? 2);
        await new Promise((resolve) => window.setTimeout(resolve, Math.min(retryAfter, 10) * 1000));
      }

      if (!response?.ok) throw new Error(lastError);
      const transparent = await response.blob();
      const resultBlob = await createWhiteProductImage(transparent);
      const resultUrl = URL.createObjectURL(resultBlob);
      updateItem(item.id, {
        status: "completed",
        resultBlob,
        resultUrl,
        duration: Math.round(performance.now() - started),
      });
      sendEvent("image_succeeded", { durationMs: Math.round(performance.now() - started) });
    } catch (error) {
      if (controller.signal.aborted) {
        updateItem(item.id, { status: "cancelled" });
      } else {
        const code = error instanceof Error && error.message in errorCopy
          ? (error.message as ErrorCode)
          : "INTERNAL_ERROR";
        updateItem(item.id, { status: "failed", error: code });
        sendEvent("image_failed", { code });
      }
    } finally {
      abortControllers.current.delete(item.id);
    }
  }

  async function runBatch() {
    const pending = items.filter((item) => item.status === "ready");
    if (!pending.length || isRunning) return;
    setNotice(null);
    setIsRunning(true);
    sendEvent("batch_started", { count: pending.length });
    try {
      const session = await createSession(pending.length);
      let cursor = 0;
      const runner = async () => {
        while (cursor < pending.length) {
          const index = cursor;
          cursor += 1;
          await processItem(pending[index], session.token);
        }
      };
      await Promise.all(Array.from({ length: Math.min(3, pending.length) }, () => runner()));
      sendEvent("batch_completed", { count: pending.length });
    } catch (error) {
      const code = error instanceof Error && error.message in errorCopy
        ? (error.message as ErrorCode)
        : "INTERNAL_ERROR";
      setNotice(errorCopy[code]);
    } finally {
      setIsRunning(false);
    }
  }

  async function retryItem(item: ImageItem) {
    if (isRunning) return;
    setNotice(null);
    setIsRunning(true);
    try {
      const session = await createSession(1);
      await processItem(item, session.token);
    } catch (error) {
      const code = error instanceof Error && error.message in errorCopy
        ? (error.message as ErrorCode)
        : "INTERNAL_ERROR";
      setNotice(errorCopy[code]);
    } finally {
      setIsRunning(false);
    }
  }

  function removeItem(id: string) {
    const target = items.find((item) => item.id === id);
    if (!target) return;
    abortControllers.current.get(id)?.abort();
    URL.revokeObjectURL(target.originalUrl);
    if (target.resultUrl) URL.revokeObjectURL(target.resultUrl);
    setItems((current) => current.filter((item) => item.id !== id));
    setDownloadedIds((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
  }

  function clearAll() {
    for (const controller of abortControllers.current.values()) controller.abort();
    for (const item of items) {
      URL.revokeObjectURL(item.originalUrl);
      if (item.resultUrl) URL.revokeObjectURL(item.resultUrl);
    }
    sendEvent("batch_cleared", { count: items.length });
    setItems([]);
    setDownloadedIds(new Set());
    setNotice(null);
  }

  function downloadItem(item: ImageItem) {
    if (!item.resultBlob) return;
    downloadBlob(item.resultBlob, safeFileName(item.file.name));
    setDownloadedIds((current) => new Set(current).add(item.id));
    sendEvent("image_downloaded", { mode: "single" });
  }

  async function downloadAll() {
    if (!completed.length || totalResultBytes > MAX_ZIP_BYTES) return;
    const { zipSync } = await import("fflate");
    const files: Record<string, Uint8Array> = {};
    const names = new Map<string, number>();
    for (const item of completed) {
      if (!item.resultBlob) continue;
      let name = safeFileName(item.file.name);
      const count = names.get(name) ?? 0;
      names.set(name, count + 1);
      if (count) name = name.replace(/\.jpg$/u, `-${count + 1}.jpg`);
      files[name] = new Uint8Array(await item.resultBlob.arrayBuffer());
    }
    const zipped = zipSync(files, { level: 3 });
    downloadBlob(new Blob([zipped], { type: "application/zip" }), `product-images-${new Date().toISOString().slice(0, 10)}.zip`);
    setDownloadedIds(new Set(completed.map((item) => item.id)));
    sendEvent("image_downloaded", { mode: "zip", count: completed.length });
  }

  async function logout() {
    const response = await fetch("/api/auth/logout", { method: "POST" });
    if (response.ok) setAuthUser(null);
  }

  const stats = useMemo(
    () => [
      { label: "In batch", value: String(items.length).padStart(2, "0") },
      { label: "Finished", value: String(completed.length).padStart(2, "0") },
      { label: "Needs review", value: String(failed.length).padStart(2, "0") },
    ],
    [completed.length, failed.length, items.length],
  );

  return (
    <>
      <nav className="site-nav">
        <a className="brand" href="#top" aria-label="Cutline home">
          <span className="brand-mark"><span /></span>
          CUTLINE
        </a>
        <div className="nav-meta">
          <span><ShieldCheck size={15} /> No image storage</span>
          <a href="#faq">FAQ</a>
          {authLoaded && authUser ? (
            <div className="account-menu">
              <a className="account-profile-link" href="/account" aria-label="Open your account">
                {authUser.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={authUser.avatarUrl} alt="" referrerPolicy="no-referrer" />
                ) : null}
                <span>{authUser.name ?? authUser.email}</span>
              </a>
              <button type="button" onClick={() => void logout()} aria-label="Sign out">
                <LogOut size={15} />
              </button>
            </div>
          ) : (
            <div className="signed-out-actions">
              <a className="register-link" href="/register">Register</a>
              <a className="login-link" href="/api/auth/google" aria-busy={!authLoaded}>
                <LogIn size={15} /> Sign in
              </a>
            </div>
          )}
        </div>
      </nav>

      <section className="hero" id="top">
        <div className="hero-copy">
          <div className="eyebrow"><span>01</span> Batch product studio</div>
          <h1>From raw shot<br />to <em>retail ready.</em></h1>
          <p className="hero-lede">
            Remove backgrounds from up to 20 product photos. One batch in,
            one consistent white-background catalog out.
          </p>
          <div className="hero-proof">
            <div><strong>20</strong><span>images / batch</span></div>
            <div><strong>3×</strong><span>parallel processing</span></div>
            <div><strong>0</strong><span>images stored</span></div>
          </div>
        </div>

        <div className="studio-shell">
          <div className="studio-topbar">
            <div>
              <span className="status-dot" />
              <span>NEW PRODUCTION</span>
            </div>
            <span>{new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }).toUpperCase()}</span>
          </div>

          {!items.length ? (
            <div
              className={`drop-zone ${isDragging ? "is-dragging" : ""}`}
              onDragEnter={(event) => { event.preventDefault(); setIsDragging(true); }}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node)) setIsDragging(false);
              }}
              onDrop={(event) => {
                event.preventDefault();
                setIsDragging(false);
                void addFiles(Array.from(event.dataTransfer.files));
              }}
            >
              <div className="drop-visual" aria-hidden="true">
                <div className="crop-corner crop-a" />
                <div className="crop-corner crop-b" />
                <ImageIcon size={46} strokeWidth={1.2} />
                <Sparkles className="spark" size={22} />
              </div>
              <div className="drop-copy">
                <span className="step-label">STEP 01 / SELECT</span>
                <h2>Drop the product set.</h2>
                <p>JPG, PNG or WebP · up to 15 MB each</p>
              </div>
              <button className="primary-button" type="button" onClick={() => inputRef.current?.click()}>
                Select images <ArrowRight size={18} />
              </button>
              <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                hidden
                onChange={(event) => {
                  void addFiles(Array.from(event.target.files ?? []));
                  event.target.value = "";
                }}
              />
            </div>
          ) : (
            <div className="batch-panel">
              <div className="batch-summary">
                <div>
                  <span className="step-label">LIVE BATCH</span>
                  <h2>{isRunning ? "Cutting the background." : completed.length ? "Review the results." : "Ready for production."}</h2>
                </div>
                <div className="batch-actions">
                  {!isRunning && items.length < MAX_FILES && !completed.length && (
                    <button className="text-button" type="button" onClick={() => inputRef.current?.click()}>
                      <UploadCloud size={16} /> Add images
                    </button>
                  )}
                  <button className="icon-button" type="button" onClick={clearAll} aria-label="Clear batch">
                    <Trash2 size={17} />
                  </button>
                </div>
              </div>

              <div className="progress-track" aria-label={`${progress}% complete`}>
                <span style={{ width: `${progress}%` }} />
              </div>

              <div className="stat-row">
                {stats.map((stat) => (
                  <div key={stat.label}><strong>{stat.value}</strong><span>{stat.label}</span></div>
                ))}
              </div>

              <div className="image-grid">
                {items.map((item, index) => (
                  <article className={`image-card status-${item.status}`} key={item.id}>
                    <div className="image-stage checkerboard">
                      {/* User-selected local object URLs never leave this tab except via the processing request. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={item.resultUrl ?? item.originalUrl} alt={`Product image ${index + 1}`} />
                      <span className="image-index">{String(index + 1).padStart(2, "0")}</span>
                      {item.status === "processing" && (
                        <div className="processing-layer"><LoaderCircle className="spin" /><span>Cutting</span></div>
                      )}
                      {item.status === "completed" && <span className="success-badge"><Check size={14} /> Ready</span>}
                      {item.status === "failed" && <span className="error-badge"><AlertTriangle size={14} /> Review</span>}
                    </div>
                    <div className="image-info">
                      <div className="filename-row">
                        <span title={item.file.name}>{item.file.name}</span>
                        <small>{formatBytes(item.file.size)}</small>
                      </div>
                      {item.error && <p className="item-error">{errorCopy[item.error]}</p>}
                      <div className="card-actions">
                        {item.status === "completed" && (
                          <button type="button" onClick={() => downloadItem(item)}><Download size={15} /> Download</button>
                        )}
                        {item.status === "failed" && (
                          <button type="button" onClick={() => void retryItem(item)}><RotateCcw size={15} /> Retry</button>
                        )}
                        <button className="remove-button" type="button" onClick={() => removeItem(item.id)} aria-label={`Remove ${item.file.name}`}>
                          <X size={15} />
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>

              <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                hidden
                onChange={(event) => {
                  void addFiles(Array.from(event.target.files ?? []));
                  event.target.value = "";
                }}
              />

              <div className="production-footer">
                <div className="privacy-note"><LockKeyhole size={16} /><span>Processed in transit.<br /><strong>Never stored.</strong></span></div>
                {!completed.length ? (
                  <button className="primary-button start-button" type="button" disabled={isRunning || !turnstileToken} onClick={() => void runBatch()}>
                    {isRunning ? <><LoaderCircle className="spin" size={18} /> Processing {processed}/{items.length}</> : <>Remove backgrounds <ArrowRight size={18} /></>}
                  </button>
                ) : (
                  <button
                    className="primary-button start-button"
                    type="button"
                    disabled={totalResultBytes > MAX_ZIP_BYTES}
                    onClick={() => void downloadAll()}
                  >
                    <PackageCheck size={18} /> Download all ({completed.length})
                  </button>
                )}
              </div>
              {totalResultBytes > MAX_ZIP_BYTES && (
                <p className="zip-warning">This result set is over 150 MB. Download images individually to protect browser memory.</p>
              )}
            </div>
          )}

          {notice && <div className="notice"><AlertTriangle size={16} /> {notice}<button onClick={() => setNotice(null)} aria-label="Dismiss"><X size={14} /></button></div>}
          <div ref={turnstileRef} className="turnstile-slot" aria-label="Security verification" />
        </div>
      </section>

      <section className="process-strip" aria-label="How it works">
        <div><span>01</span><UploadCloud /><p><strong>Select</strong>Up to 20 product shots</p></div>
        <div><span>02</span><Layers3 /><p><strong>Process</strong>Three images in parallel</p></div>
        <div><span>03</span><PackageCheck /><p><strong>Ship</strong>One consistent catalog set</p></div>
      </section>
    </>
  );
}
