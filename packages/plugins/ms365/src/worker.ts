import { randomUUID } from "node:crypto";
import {
  definePlugin,
  runWorker,
  type PluginApiRequestInput,
  type PluginApiResponse,
  type PluginContext,
} from "@paperclipai/plugin-sdk";
import { MS365_SCOPES } from "./manifest.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MS365Config {
  tenantId: string;
  clientId: string;
  clientSecretRef: string;
  baseUrl: string;
}

interface TokenData {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  scope: string;
  userId: string;
  email?: string;
}

interface PendingAuth {
  userId: string;
  nonce: string;
  expiresAt: string;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  error?: string;
  error_description?: string;
}

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

function str(val: unknown): string | null {
  return typeof val === "string" && val.trim().length > 0 ? val.trim() : null;
}

function queryStr(query: Record<string, string | string[]>, key: string): string | null {
  const v = query[key];
  if (typeof v === "string") return v || null;
  if (Array.isArray(v) && typeof v[0] === "string") return v[0] || null;
  return null;
}

function bodyStr(body: unknown, key: string): string | null {
  if (body && typeof body === "object" && !Array.isArray(body)) {
    return str((body as Record<string, unknown>)[key]);
  }
  return null;
}

function bodyVal(body: unknown, key: string): unknown {
  if (body && typeof body === "object" && !Array.isArray(body)) {
    return (body as Record<string, unknown>)[key];
  }
  return undefined;
}

function err(status: number, message: string): PluginApiResponse {
  return { status, body: { error: message } };
}

// ---------------------------------------------------------------------------
// The actual plugin implementation uses module-level ctx captured in setup
// ---------------------------------------------------------------------------

// ctx is set once during setup() and reused in all subsequent handler calls
let ctx!: PluginContext;

// ---------------------------------------------------------------------------
// Config + secrets
// ---------------------------------------------------------------------------

async function getConfig(): Promise<MS365Config | null> {
  const config = await ctx.config.get();
  const tenantId = str(config.tenantId);
  const clientId = str(config.clientId);
  const clientSecretRef = str(config.clientSecretRef);
  const baseUrl = str(config.baseUrl);
  if (!tenantId || !clientId || !clientSecretRef || !baseUrl) return null;
  return { tenantId, clientId, clientSecretRef, baseUrl: baseUrl.replace(/\/$/, "") };
}

async function getClientSecret(ref: string): Promise<string> {
  const resolved = await ctx.secrets.resolve(ref);
  if (!resolved) throw new Error(`Secret not found: ${ref}`);
  return resolved;
}

// ---------------------------------------------------------------------------
// Token state helpers
// ---------------------------------------------------------------------------

function tokenKey(companyId: string, userId: string) {
  return { scopeKind: "company" as const, scopeId: companyId, namespace: "ms365-tokens", stateKey: userId };
}

function pendingKey(companyId: string, userId: string) {
  return { scopeKind: "company" as const, scopeId: companyId, namespace: "ms365-pending-auth", stateKey: userId };
}

async function getTokens(companyId: string, userId: string): Promise<TokenData | null> {
  const raw = await ctx.state.get(tokenKey(companyId, userId));
  if (!raw || typeof raw !== "object") return null;
  const t = raw as Partial<TokenData>;
  if (!t.accessToken || !t.refreshToken || !t.expiresAt) return null;
  return raw as TokenData;
}

async function setTokens(companyId: string, userId: string, tokens: TokenData): Promise<void> {
  await ctx.state.set(tokenKey(companyId, userId), tokens);
}

async function deleteTokens(companyId: string, userId: string): Promise<void> {
  await ctx.state.delete(tokenKey(companyId, userId));
}

// ---------------------------------------------------------------------------
// OAuth helpers
// ---------------------------------------------------------------------------

function buildRedirectUri(baseUrl: string): string {
  return `${baseUrl}/api/plugins/rockstein.ms365/api/auth/exchange`;
}

async function exchangeOrRefresh(
  cfg: MS365Config,
  secret: string,
  params: URLSearchParams,
): Promise<TokenResponse> {
  const resp = await ctx.http.fetch(
    `https://login.microsoftonline.com/${cfg.tenantId}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    },
  );
  return (await resp.json()) as TokenResponse;
}

async function refreshAccessToken(cfg: MS365Config, secret: string, tokens: TokenData): Promise<TokenData> {
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    client_secret: secret,
    refresh_token: tokens.refreshToken,
    grant_type: "refresh_token",
    scope: MS365_SCOPES,
  });
  const tokenResp = await exchangeOrRefresh(cfg, secret, params);
  if (tokenResp.error) {
    throw new Error(`Token refresh failed: ${tokenResp.error_description ?? tokenResp.error}`);
  }
  return {
    ...tokens,
    accessToken: tokenResp.access_token,
    refreshToken: tokenResp.refresh_token ?? tokens.refreshToken,
    expiresAt: new Date(Date.now() + tokenResp.expires_in * 1000).toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Graph API helpers
// ---------------------------------------------------------------------------

async function graphFetch(
  accessToken: string,
  method: string,
  graphPath: string,
  body?: unknown,
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const url = graphPath.startsWith("https://")
    ? graphPath
    : `https://graph.microsoft.com/v1.0${graphPath}`;
  const resp = await ctx.http.fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = resp.status === 204 || resp.status === 202 ? null : await resp.json().catch(() => null);
  return { ok: resp.ok, status: resp.status, data };
}

async function withValidToken(
  cfg: MS365Config,
  secret: string,
  companyId: string,
  userId: string,
  tokens: TokenData,
  method: string,
  graphPath: string,
  body?: unknown,
): Promise<PluginApiResponse> {
  let current = tokens;
  const expiresMs = new Date(tokens.expiresAt).getTime();
  if (expiresMs - Date.now() < 5 * 60 * 1000) {
    current = await refreshAccessToken(cfg, secret, tokens);
    await setTokens(companyId, userId, current);
  }
  const result = await graphFetch(current.accessToken, method, graphPath, body);
  if (!result.ok) {
    return { status: result.status, body: { error: "Microsoft Graph API error", details: result.data } };
  }
  return { status: result.status >= 200 && result.status < 300 ? result.status : 200, body: result.data };
}

// ---------------------------------------------------------------------------
// Actor / userId resolution
// ---------------------------------------------------------------------------

function resolveUserId(input: PluginApiRequestInput): string | null {
  if (input.actor.userId) return input.actor.userId;
  const fromQuery = queryStr(input.query, "userId");
  if (fromQuery) return fromQuery;
  return bodyStr(input.body, "userId");
}

// ---------------------------------------------------------------------------
// withTokens wrapper — loads tokens + secret, calls handler
// ---------------------------------------------------------------------------

type TokenedHandler = (
  cfg: MS365Config,
  secret: string,
  tokens: TokenData,
  userId: string,
) => Promise<PluginApiResponse>;

async function withTokens(
  cfg: MS365Config,
  input: PluginApiRequestInput,
  handler: TokenedHandler,
): Promise<PluginApiResponse> {
  const userId = resolveUserId(input);
  if (!userId) return err(400, "userId required: pass as query param or authenticate as board user");
  const tokens = await getTokens(input.companyId, userId);
  if (!tokens) return err(401, "Not connected to Microsoft 365. Call GET /auth/authorize first.");
  const secret = await getClientSecret(cfg.clientSecretRef);
  return handler(cfg, secret, tokens, userId);
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

async function handleAuthAuthorize(cfg: MS365Config, input: PluginApiRequestInput): Promise<PluginApiResponse> {
  const userId = resolveUserId(input);
  if (!userId) return err(400, "userId required");

  const nonce = randomUUID();
  const pending: PendingAuth = {
    userId,
    nonce,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  };
  await ctx.state.set(pendingKey(input.companyId, userId), pending);

  // Encode companyId + userId + nonce in state param so exchange can resolve them
  const state = Buffer.from(JSON.stringify({ companyId: input.companyId, userId, nonce })).toString("base64url");
  const redirectUri = buildRedirectUri(cfg.baseUrl);

  const params = new URLSearchParams({
    client_id: cfg.clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    scope: MS365_SCOPES,
    state,
    response_mode: "query",
  });

  const oauthUrl = `https://login.microsoftonline.com/${cfg.tenantId}/oauth2/v2.0/authorize?${params.toString()}`;
  return { status: 200, body: { oauthUrl, redirectUri } };
}

async function handleAuthExchange(cfg: MS365Config, secret: string, input: PluginApiRequestInput): Promise<PluginApiResponse> {
  const body = input.body;
  const code = bodyStr(body, "code");
  const stateRaw = bodyStr(body, "state");
  if (!code || !stateRaw) return err(400, "code and state required in request body");

  let statePayload: { companyId?: string; userId?: string; nonce?: string };
  try {
    statePayload = JSON.parse(Buffer.from(stateRaw, "base64url").toString("utf-8")) as {
      companyId?: string;
      userId?: string;
      nonce?: string;
    };
  } catch {
    return err(400, "Invalid state parameter");
  }

  const companyId = statePayload.companyId ?? input.companyId;
  const userId = statePayload.userId;
  if (!companyId || !userId) return err(400, "Invalid state: missing companyId or userId");

  // Validate nonce against stored pending auth
  const rawPending = await ctx.state.get(pendingKey(companyId, userId));
  if (!rawPending || typeof rawPending !== "object") return err(400, "No pending auth found — start from /auth/authorize");
  const pendingAuth = rawPending as PendingAuth;
  if (pendingAuth.nonce !== statePayload.nonce) return err(400, "Nonce mismatch — possible CSRF");
  if (new Date(pendingAuth.expiresAt) < new Date()) return err(400, "Auth request expired (10 min window)");

  const params = new URLSearchParams({
    client_id: cfg.clientId,
    client_secret: secret,
    code,
    redirect_uri: buildRedirectUri(cfg.baseUrl),
    grant_type: "authorization_code",
  });
  const tokenResp = await exchangeOrRefresh(cfg, secret, params);
  if (tokenResp.error) return err(400, `Token exchange failed: ${tokenResp.error_description ?? tokenResp.error}`);

  const tokens: TokenData = {
    accessToken: tokenResp.access_token,
    refreshToken: tokenResp.refresh_token ?? "",
    expiresAt: new Date(Date.now() + tokenResp.expires_in * 1000).toISOString(),
    scope: tokenResp.scope,
    userId,
  };

  // Fetch user email for display
  try {
    const meResult = await graphFetch(tokens.accessToken, "GET", "/me?$select=mail,userPrincipalName");
    if (meResult.ok && meResult.data && typeof meResult.data === "object") {
      const me = meResult.data as Record<string, unknown>;
      tokens.email = str(me.mail ?? me.userPrincipalName) ?? undefined;
    }
  } catch { /* non-critical */ }

  await setTokens(companyId, userId, tokens);
  await ctx.state.delete(pendingKey(companyId, userId));
  ctx.logger.info(`MS365 connected: userId=${userId} email=${tokens.email ?? "?"} companyId=${companyId}`);
  return { status: 200, body: { connected: true, email: tokens.email, scope: tokens.scope } };
}

async function handleAuthStatus(input: PluginApiRequestInput): Promise<PluginApiResponse> {
  const userId = resolveUserId(input) ?? queryStr(input.query, "userId");
  if (!userId) return err(400, "userId required");
  const tokens = await getTokens(input.companyId, userId);
  if (!tokens) return { status: 200, body: { connected: false } };
  return { status: 200, body: { connected: true, email: tokens.email ?? null, expiresAt: tokens.expiresAt, scope: tokens.scope } };
}

async function handleAuthDisconnect(input: PluginApiRequestInput): Promise<PluginApiResponse> {
  const userId = resolveUserId(input) ?? queryStr(input.query, "userId");
  if (!userId) return err(400, "userId required");
  await deleteTokens(input.companyId, userId);
  ctx.logger.info(`MS365 disconnected: userId=${userId} companyId=${input.companyId}`);
  return { status: 200, body: { disconnected: true } };
}

// ---------------------------------------------------------------------------
// Plugin definition
// ---------------------------------------------------------------------------

const plugin = definePlugin({
  async setup(pluginCtx) {
    ctx = pluginCtx;
    ctx.logger.info("MS365 plugin worker started");
  },

  async onHealth() {
    return { status: "ok", message: "MS365 plugin ready" };
  },

  async onApiRequest(input: PluginApiRequestInput): Promise<PluginApiResponse> {
    const cfg = await getConfig();
    if (!cfg) return err(503, "MS365 plugin not configured — set tenantId, clientId, clientSecretRef, baseUrl in plugin config");

    try {
      switch (input.routeKey) {
        // ---- Auth ----
        case "auth-authorize":
          return handleAuthAuthorize(cfg, input);

        case "auth-exchange": {
          const secret = await getClientSecret(cfg.clientSecretRef);
          return handleAuthExchange(cfg, secret, input);
        }

        case "auth-status":
          return handleAuthStatus(input);

        case "auth-disconnect":
          return handleAuthDisconnect(input);

        // ---- Mail ----
        case "mail-list":
          return withTokens(cfg, input, async (c, secret, tokens, userId) => {
            const top = queryStr(input.query, "top") ?? "20";
            const skip = queryStr(input.query, "skip") ?? "0";
            const filter = queryStr(input.query, "filter");
            const folder = queryStr(input.query, "folder") ?? "inbox";
            let url = `/me/mailFolders/${folder}/messages?$top=${top}&$skip=${skip}&$orderby=receivedDateTime desc`;
            if (filter) url += `&$filter=${encodeURIComponent(filter)}`;
            return withValidToken(c, secret, input.companyId, userId, tokens, "GET", url);
          });

        case "mail-search":
          return withTokens(cfg, input, async (c, secret, tokens, userId) => {
            const q = queryStr(input.query, "q");
            if (!q) return err(400, "Query parameter 'q' required");
            return withValidToken(c, secret, input.companyId, userId, tokens, "GET",
              `/me/messages?$search="${encodeURIComponent(q)}"&$top=20&$orderby=receivedDateTime desc`);
          });

        case "mail-get":
          return withTokens(cfg, input, async (c, secret, tokens, userId) =>
            withValidToken(c, secret, input.companyId, userId, tokens, "GET", `/me/messages/${input.params.id}`));

        case "mail-create":
          return withTokens(cfg, input, async (c, secret, tokens, userId) => {
            const b = input.body as Record<string, unknown> | null;
            const draft = { subject: bodyStr(b, "subject"), body: bodyVal(b, "body"), toRecipients: bodyVal(b, "toRecipients"), ccRecipients: bodyVal(b, "ccRecipients") };
            const result = await withValidToken(c, secret, input.companyId, userId, tokens, "POST", "/me/messages", draft);
            return { ...result, status: result.status === 200 ? 201 : result.status };
          });

        case "mail-send":
          return withTokens(cfg, input, async (c, secret, tokens, userId) =>
            withValidToken(c, secret, input.companyId, userId, tokens, "POST", `/me/messages/${input.params.id}/send`));

        case "mail-delete":
          return withTokens(cfg, input, async (c, secret, tokens, userId) =>
            withValidToken(c, secret, input.companyId, userId, tokens, "DELETE", `/me/messages/${input.params.id}`));

        // ---- Calendar ----
        case "calendar-list":
          return withTokens(cfg, input, async (c, secret, tokens, userId) => {
            const start = queryStr(input.query, "start") ?? new Date().toISOString();
            const end = queryStr(input.query, "end") ?? new Date(Date.now() + 7 * 24 * 3600000).toISOString();
            return withValidToken(c, secret, input.companyId, userId, tokens, "GET",
              `/me/calendarView?startDateTime=${encodeURIComponent(start)}&endDateTime=${encodeURIComponent(end)}&$orderby=start/dateTime&$top=50`);
          });

        case "calendar-create":
          return withTokens(cfg, input, async (c, secret, tokens, userId) => {
            const result = await withValidToken(c, secret, input.companyId, userId, tokens, "POST", "/me/events", input.body);
            return { ...result, status: result.status === 200 ? 201 : result.status };
          });

        case "calendar-update":
          return withTokens(cfg, input, async (c, secret, tokens, userId) =>
            withValidToken(c, secret, input.companyId, userId, tokens, "PATCH", `/me/events/${input.params.id}`, input.body));

        case "calendar-delete":
          return withTokens(cfg, input, async (c, secret, tokens, userId) =>
            withValidToken(c, secret, input.companyId, userId, tokens, "DELETE", `/me/events/${input.params.id}`));

        case "calendar-respond":
          return withTokens(cfg, input, async (c, secret, tokens, userId) => {
            const b = input.body as Record<string, unknown> | null;
            const action = bodyStr(b, "action") ?? "accept";
            if (!["accept", "tentativelyAccept", "decline"].includes(action))
              return err(400, "action must be: accept | tentativelyAccept | decline");
            return withValidToken(c, secret, input.companyId, userId, tokens, "POST",
              `/me/events/${input.params.id}/${action}`, { comment: bodyStr(b, "comment") ?? "" });
          });

        // ---- Mailbox-Einstellungen ----
        case "settings-get":
          return withTokens(cfg, input, async (c, secret, tokens, userId) =>
            withValidToken(c, secret, input.companyId, userId, tokens, "GET", "/me/mailboxSettings"));

        case "settings-signature":
          return withTokens(cfg, input, async (c, secret, tokens, userId) => {
            const b = input.body as Record<string, unknown> | null;
            const contentType = bodyStr(b, "contentType") ?? "html";
            const value = bodyStr(b, "value") ?? "";
            const sigName = bodyStr(b, "name") ?? "Signatur";
            const data = { signature: { "@odata.type": "#microsoft.graph.emailSignature", name: sigName, contentType, text: value, htmlContent: contentType === "html" ? value : undefined } };
            return withValidToken(c, secret, input.companyId, userId, tokens, "PATCH", "/me/mailboxSettings", data);
          });

        case "settings-autoreplies":
          return withTokens(cfg, input, async (c, secret, tokens, userId) => {
            const b = input.body as Record<string, unknown> | null;
            const data = {
              automaticRepliesSetting: {
                status: bodyStr(b, "status") ?? "disabled",
                externalAudience: bodyStr(b, "externalAudience") ?? "none",
                internalReplyMessage: bodyStr(b, "internalReplyMessage"),
                externalReplyMessage: bodyStr(b, "externalReplyMessage"),
                scheduledStartDateTime: bodyVal(b, "scheduledStartDateTime"),
                scheduledEndDateTime: bodyVal(b, "scheduledEndDateTime"),
              },
            };
            return withValidToken(c, secret, input.companyId, userId, tokens, "PATCH", "/me/mailboxSettings", data);
          });

        // ---- OneDrive ----
        case "files-list":
          return withTokens(cfg, input, async (c, secret, tokens, userId) => {
            const folderId = queryStr(input.query, "folderId");
            const url = folderId ? `/me/drive/items/${folderId}/children?$top=50` : "/me/drive/root/children?$top=50";
            return withValidToken(c, secret, input.companyId, userId, tokens, "GET", url);
          });

        case "files-search":
          return withTokens(cfg, input, async (c, secret, tokens, userId) => {
            const q = queryStr(input.query, "q");
            if (!q) return err(400, "Query parameter 'q' required");
            return withValidToken(c, secret, input.companyId, userId, tokens, "GET",
              `/me/drive/root/search(q='${encodeURIComponent(q)}')?$top=20`);
          });

        case "files-upload":
          return withTokens(cfg, input, async (c, secret, tokens, userId) => {
            const b = input.body as Record<string, unknown> | null;
            const name = bodyStr(b, "name");
            const content = bodyVal(b, "content");
            const folderId = bodyStr(b, "folderId") ?? "root";
            if (!name || content === undefined) return err(400, "name and content required");
            const path = folderId === "root" ? `root:/${encodeURIComponent(name)}` : `items/${folderId}:/${encodeURIComponent(name)}`;
            const result = await withValidToken(c, secret, input.companyId, userId, tokens, "PUT", `/me/drive/${path}:/content`, content);
            return { ...result, status: result.status === 200 ? 201 : result.status };
          });

        case "files-download":
          return withTokens(cfg, input, async (c, secret, tokens, userId) =>
            withValidToken(c, secret, input.companyId, userId, tokens, "GET", `/me/drive/items/${input.params.id}/content`));

        default:
          return err(404, `Unknown route key: ${input.routeKey}`);
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      ctx.logger.error(`MS365 route error [${input.routeKey}]: ${message}`);
      return err(500, `Internal error: ${message}`);
    }
  },
});

export default plugin;
runWorker(plugin, import.meta.url);
