import { useCallback, useEffect, useState } from "react";
import type { CSSProperties } from "react";
import {
  useHostContext,
  type PluginSettingsPageProps,
} from "@paperclipai/plugin-sdk/ui";

const PLUGIN_ID = "rockstein.ms365";

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

async function pluginFetch<T>(
  method: string,
  routePath: string,
  body?: unknown,
): Promise<T> {
  const resp = await fetch(`/api/plugins/${PLUGIN_ID}/api${routePath}`, {
    method,
    credentials: "include",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await resp.text();
  if (!resp.ok) {
    let msg = `Request failed: ${resp.status}`;
    try {
      const parsed = JSON.parse(text) as { error?: string };
      if (parsed.error) msg = parsed.error;
    } catch { /* ignore */ }
    throw new Error(msg);
  }
  return text ? (JSON.parse(text) as T) : ({} as T);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AuthStatus {
  connected: boolean;
  email?: string | null;
  expiresAt?: string;
  scope?: string;
}

// ---------------------------------------------------------------------------
// Settings page component
// ---------------------------------------------------------------------------

export function MS365SettingsPage(_props: PluginSettingsPageProps) {
  const context = useHostContext();
  const companyId = context.companyId;
  const userId = context.userId;

  const [status, setStatus] = useState<AuthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Handle OAuth callback: detect code+state in URL after Microsoft redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");
    if (!code || !state) return;

    // Decode state to get companyId + userId
    let statePayload: { companyId?: string; userId?: string } = {};
    try {
      statePayload = JSON.parse(atob(state.replace(/-/g, "+").replace(/_/g, "/"))) as {
        companyId?: string;
        userId?: string;
      };
    } catch {
      setErrorMsg("Ungültiger State-Parameter — bitte erneut versuchen");
      return;
    }

    const cId = statePayload.companyId ?? companyId;
    const uId = statePayload.userId ?? userId;
    if (!cId || !uId) return;

    setActionLoading(true);
    setErrorMsg(null);

    pluginFetch<{ connected?: boolean; email?: string; error?: string }>(
      "POST",
      `/auth/exchange`,
      { companyId: cId, userId: uId, code, state },
    )
      .then((result) => {
        if (result.connected) {
          setSuccessMsg(`Microsoft 365 verbunden${result.email ? ` als ${result.email}` : ""}`);
          const url = new URL(window.location.href);
          url.searchParams.delete("code");
          url.searchParams.delete("state");
          window.history.replaceState({}, "", url.toString());
          return loadStatus(cId, uId);
        }
      })
      .catch((e: Error) => setErrorMsg(e.message))
      .finally(() => setActionLoading(false));
  }, []); // run once on mount

  const loadStatus = useCallback(async (cId: string, uId: string) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const result = await pluginFetch<AuthStatus>(
        "GET",
        `/auth/status?companyId=${encodeURIComponent(cId)}&userId=${encodeURIComponent(uId)}`,
      );
      setStatus(result);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Fehler beim Laden");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (companyId && userId) {
      void loadStatus(companyId, userId);
    }
  }, [companyId, userId, loadStatus]);

  const handleConnect = useCallback(async () => {
    if (!companyId || !userId) return;
    setActionLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const result = await pluginFetch<{ oauthUrl: string }>(
        "GET",
        `/auth/authorize?companyId=${encodeURIComponent(companyId)}&userId=${encodeURIComponent(userId)}`,
      );
      window.location.href = result.oauthUrl;
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Fehler beim Starten der Verbindung");
      setActionLoading(false);
    }
  }, [companyId, userId]);

  const handleDisconnect = useCallback(async () => {
    if (!companyId || !userId) return;
    setActionLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await pluginFetch<unknown>(
        "DELETE",
        `/auth/disconnect?companyId=${encodeURIComponent(companyId)}&userId=${encodeURIComponent(userId)}`,
      );
      setStatus({ connected: false });
      setSuccessMsg("Microsoft 365 Verbindung getrennt.");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Fehler beim Trennen");
    } finally {
      setActionLoading(false);
    }
  }, [companyId, userId]);

  // ---------------------------------------------------------------------------
  // Styles (Rockstein design tokens)
  // ---------------------------------------------------------------------------
  const s = {
    outer: { fontFamily: "Inter, system-ui, sans-serif", color: "#E5E5E5", padding: "32px" } as CSSProperties,
    card: { background: "#111118", border: "1px solid #1E1E2C", borderRadius: "12px", padding: "28px", maxWidth: "480px" } as CSSProperties,
    heading: { fontSize: "20px", fontWeight: 600, color: "#FFFFFF", marginBottom: "6px", marginTop: 0 } as CSSProperties,
    sub: { fontSize: "14px", color: "#888", marginBottom: "24px", lineHeight: 1.5, marginTop: 0 } as CSSProperties,
    badge: (on: boolean): CSSProperties => ({ display: "inline-flex", alignItems: "center", gap: "6px", padding: "4px 12px", borderRadius: "20px", fontSize: "13px", fontWeight: 500, background: on ? "rgba(34,197,94,0.12)" : "rgba(148,163,184,0.1)", color: on ? "#4ade80" : "#94a3b8", marginBottom: "16px" }),
    emailRow: { fontSize: "14px", color: "#aaa", marginBottom: "20px" } as CSSProperties,
    btn: (primary: boolean, danger = false): CSSProperties => ({ padding: "10px 22px", borderRadius: "8px", border: "none", cursor: actionLoading ? "not-allowed" : "pointer", fontWeight: 500, fontSize: "14px", background: danger ? "rgba(127,29,29,0.8)" : primary ? "#C9A962" : "#1E1E2C", color: danger ? "#fca5a5" : primary ? "#0A0A0F" : "#E5E5E5", opacity: actionLoading ? 0.5 : 1, transition: "opacity 0.15s" }),
    success: { fontSize: "13px", color: "#4ade80", marginTop: "14px" } as CSSProperties,
    error: { fontSize: "13px", color: "#f87171", marginTop: "14px" } as CSSProperties,
    spinner: { color: "#888", fontSize: "14px" } as CSSProperties,
  };

  if (loading) {
    return (
      <div style={s.outer}>
        <div style={s.card}>
          <p style={s.heading}>Microsoft 365</p>
          <p style={s.spinner}>Laden…</p>
        </div>
      </div>
    );
  }

  const connected = status?.connected ?? false;

  return (
    <div style={s.outer}>
      <div style={s.card}>
        <p style={s.heading}>Microsoft 365 Verbindung</p>
        <p style={s.sub}>
          Verbinde deinen Microsoft 365 Account, damit Sophie E-Mails lesen/senden, Kalender-Termine verwalten
          und OneDrive-Dateien abrufen kann.
        </p>

        <div style={s.badge(connected)}>
          <span>{connected ? "●" : "○"}</span>
          <span>{connected ? "Verbunden" : "Nicht verbunden"}</span>
        </div>

        {connected && status?.email && (
          <div style={s.emailRow}>Account: {status.email}</div>
        )}

        <div>
          {!connected ? (
            <button style={s.btn(true)} disabled={actionLoading} onClick={() => void handleConnect()}>
              {actionLoading ? "Weiterleitung…" : "Mit Microsoft 365 verbinden"}
            </button>
          ) : (
            <button style={s.btn(false, true)} disabled={actionLoading} onClick={() => void handleDisconnect()}>
              {actionLoading ? "Trenne…" : "Verbindung trennen"}
            </button>
          )}
        </div>

        {successMsg && <div style={s.success}>{successMsg}</div>}
        {errorMsg && <div style={s.error}>Fehler: {errorMsg}</div>}
      </div>
    </div>
  );
}
