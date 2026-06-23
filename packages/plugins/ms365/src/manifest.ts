import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

export const PLUGIN_ID = "rockstein.ms365";
export const PLUGIN_VERSION = "1.0.0";
export const SETTINGS_SLOT_ID = "ms365-settings";
export const SETTINGS_EXPORT_NAME = "MS365SettingsPage";

const MS365_SCOPES = [
  "Mail.ReadWrite",
  "Mail.Send",
  "MailboxSettings.ReadWrite",
  "Calendars.ReadWrite",
  "Files.ReadWrite.All",
  "offline_access",
].join(" ");

export { MS365_SCOPES };

const manifest: PaperclipPluginManifestV1 = {
  id: PLUGIN_ID,
  apiVersion: 1,
  version: PLUGIN_VERSION,
  displayName: "Microsoft 365",
  description:
    "Verbindet Paperclip mit Microsoft 365: Mail, Kalender, OneDrive und Mailbox-Einstellungen. Sophie kann damit E-Mails lesen/senden, Termine verwalten und Dateien abrufen.",
  author: "Rockstein Consulting GmbH",
  categories: ["connector", "automation"],
  capabilities: [
    "api.routes.register",
    "http.outbound",
    "plugin.state.read",
    "plugin.state.write",
    "secrets.read-ref",
    "ui.page.register",
  ],
  instanceConfigSchema: {
    type: "object" as const,
    properties: {
      tenantId: {
        type: "string" as const,
        title: "Azure Tenant ID",
        description: "ID des Microsoft Entra Tenants (z.B. 3d2a7d43-...)",
      },
      clientId: {
        type: "string" as const,
        title: "Azure Client ID (Application ID)",
        description: "Client ID der registrierten Azure App",
      },
      clientSecretRef: {
        type: "string" as const,
        title: "Client Secret (Paperclip Secret-Ref)",
        description: "Name des Paperclip-Secrets mit dem Azure Client Secret",
      },
      baseUrl: {
        type: "string" as const,
        title: "Paperclip Base URL",
        description:
          "Basis-URL der Paperclip-Instanz (z.B. https://gue.rockstein-consulting.de) — wird für die OAuth Redirect URI verwendet",
      },
    },
    required: ["tenantId", "clientId", "clientSecretRef", "baseUrl"],
  },
  apiRoutes: [
    // Auth
    {
      routeKey: "auth-authorize",
      method: "GET",
      path: "/auth/authorize",
      auth: "board-or-agent",
      capability: "api.routes.register",
      companyResolution: { from: "query", key: "companyId" },
    },
    {
      routeKey: "auth-exchange",
      method: "POST",
      path: "/auth/exchange",
      auth: "board-or-agent",
      capability: "api.routes.register",
      companyResolution: { from: "body", key: "companyId" },
    },
    {
      routeKey: "auth-status",
      method: "GET",
      path: "/auth/status",
      auth: "board-or-agent",
      capability: "api.routes.register",
      companyResolution: { from: "query", key: "companyId" },
    },
    {
      routeKey: "auth-disconnect",
      method: "DELETE",
      path: "/auth/disconnect",
      auth: "board-or-agent",
      capability: "api.routes.register",
      companyResolution: { from: "query", key: "companyId" },
    },
    // Mail — exact paths before parameterized
    {
      routeKey: "mail-search",
      method: "GET",
      path: "/messages/search",
      auth: "board-or-agent",
      capability: "api.routes.register",
      companyResolution: { from: "query", key: "companyId" },
    },
    {
      routeKey: "mail-list",
      method: "GET",
      path: "/messages",
      auth: "board-or-agent",
      capability: "api.routes.register",
      companyResolution: { from: "query", key: "companyId" },
    },
    {
      routeKey: "mail-create",
      method: "POST",
      path: "/messages",
      auth: "board-or-agent",
      capability: "api.routes.register",
      companyResolution: { from: "body", key: "companyId" },
    },
    {
      routeKey: "mail-get",
      method: "GET",
      path: "/messages/:id",
      auth: "board-or-agent",
      capability: "api.routes.register",
      companyResolution: { from: "query", key: "companyId" },
    },
    {
      routeKey: "mail-send",
      method: "POST",
      path: "/messages/:id/send",
      auth: "board-or-agent",
      capability: "api.routes.register",
      companyResolution: { from: "query", key: "companyId" },
    },
    {
      routeKey: "mail-delete",
      method: "DELETE",
      path: "/messages/:id",
      auth: "board-or-agent",
      capability: "api.routes.register",
      companyResolution: { from: "query", key: "companyId" },
    },
    // Calendar
    {
      routeKey: "calendar-list",
      method: "GET",
      path: "/events",
      auth: "board-or-agent",
      capability: "api.routes.register",
      companyResolution: { from: "query", key: "companyId" },
    },
    {
      routeKey: "calendar-create",
      method: "POST",
      path: "/events",
      auth: "board-or-agent",
      capability: "api.routes.register",
      companyResolution: { from: "body", key: "companyId" },
    },
    {
      routeKey: "calendar-update",
      method: "PATCH",
      path: "/events/:id",
      auth: "board-or-agent",
      capability: "api.routes.register",
      companyResolution: { from: "query", key: "companyId" },
    },
    {
      routeKey: "calendar-delete",
      method: "DELETE",
      path: "/events/:id",
      auth: "board-or-agent",
      capability: "api.routes.register",
      companyResolution: { from: "query", key: "companyId" },
    },
    {
      routeKey: "calendar-respond",
      method: "POST",
      path: "/events/:id/respond",
      auth: "board-or-agent",
      capability: "api.routes.register",
      companyResolution: { from: "query", key: "companyId" },
    },
    // Mailbox-Einstellungen
    {
      routeKey: "settings-get",
      method: "GET",
      path: "/settings",
      auth: "board-or-agent",
      capability: "api.routes.register",
      companyResolution: { from: "query", key: "companyId" },
    },
    {
      routeKey: "settings-signature",
      method: "PATCH",
      path: "/settings/signature",
      auth: "board-or-agent",
      capability: "api.routes.register",
      companyResolution: { from: "body", key: "companyId" },
    },
    {
      routeKey: "settings-autoreplies",
      method: "PATCH",
      path: "/settings/automatic-replies",
      auth: "board-or-agent",
      capability: "api.routes.register",
      companyResolution: { from: "body", key: "companyId" },
    },
    // OneDrive — exact paths before parameterized
    {
      routeKey: "files-search",
      method: "GET",
      path: "/files/search",
      auth: "board-or-agent",
      capability: "api.routes.register",
      companyResolution: { from: "query", key: "companyId" },
    },
    {
      routeKey: "files-list",
      method: "GET",
      path: "/files",
      auth: "board-or-agent",
      capability: "api.routes.register",
      companyResolution: { from: "query", key: "companyId" },
    },
    {
      routeKey: "files-upload",
      method: "POST",
      path: "/files",
      auth: "board-or-agent",
      capability: "api.routes.register",
      companyResolution: { from: "body", key: "companyId" },
    },
    {
      routeKey: "files-download",
      method: "GET",
      path: "/files/:id/content",
      auth: "board-or-agent",
      capability: "api.routes.register",
      companyResolution: { from: "query", key: "companyId" },
    },
  ],
  ui: {
    slots: [
      {
        type: "settingsPage",
        id: SETTINGS_SLOT_ID,
        displayName: "Microsoft 365",
        exportName: SETTINGS_EXPORT_NAME,
      },
    ],
  },
};

export default manifest;
