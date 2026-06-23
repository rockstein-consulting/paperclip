# Sophie Skill: ms365-mcp-bridge

Dieses Dokument beschreibt, wie Sophie das MS365-Plugin via HTTP aufruft.
Alle Routen laufen über: `https://gue.rockstein-consulting.de/api/plugins/rockstein.ms365/api/`

## Auth-Header

Sophie ruft Plugin-Routen als Agent auf. Der Paperclip-Agent-JWT wird automatisch
via `Authorization: Bearer $PAPERCLIP_API_KEY` gesetzt.

Alle GET-Routen erwarten `companyId` als Query-Parameter.
Alle POST/PATCH-Routen erwarten `companyId` im Request-Body.
`userId` ist optional — wird automatisch aus dem Agent-Token aufgelöst.

## Auth-Status prüfen

```bash
GET /api/plugins/rockstein.ms365/api/auth/status?companyId={companyId}&userId={userId}
```

Response:
- `{ connected: true, email: "j.rockstein@...", expiresAt: "...", scope: "..." }`
- `{ connected: false }`

## Mail lesen

```bash
GET /api/plugins/rockstein.ms365/api/messages?companyId={cid}&top=20&skip=0&folder=inbox
```

Parameter:
- `top`: Anzahl Nachrichten (default 20)
- `skip`: Offset für Paginierung (default 0)
- `folder`: `inbox` | `sentitems` | `drafts` | beliebige Folder-ID (default `inbox`)
- `filter`: OData-Filter (z.B. `isRead eq false`)

## Mail lesen (einzeln)

```bash
GET /api/plugins/rockstein.ms365/api/messages/{messageId}?companyId={cid}
```

## Mail suchen

```bash
GET /api/plugins/rockstein.ms365/api/messages/search?companyId={cid}&q={suchbegriff}
```

## Entwurf erstellen

```bash
POST /api/plugins/rockstein.ms365/api/messages
Content-Type: application/json

{
  "companyId": "{cid}",
  "subject": "Betreff",
  "body": {
    "contentType": "html",
    "content": "<p>Inhalt</p>"
  },
  "toRecipients": [
    { "emailAddress": { "address": "empfaenger@example.com", "name": "Name" } }
  ],
  "ccRecipients": []
}
```

Response: `201` mit dem erstellten Message-Objekt (inkl. `id`).

## Entwurf senden

```bash
POST /api/plugins/rockstein.ms365/api/messages/{draftId}/send?companyId={cid}
```

Response: `202` (asynchron, kein Body).

## Mail löschen

```bash
DELETE /api/plugins/rockstein.ms365/api/messages/{messageId}?companyId={cid}
```

## Kalender-Termine abrufen

```bash
GET /api/plugins/rockstein.ms365/api/events?companyId={cid}&start={ISO8601}&end={ISO8601}
```

Parameter:
- `start`: Startdatum (default: jetzt)
- `end`: Enddatum (default: jetzt + 7 Tage)

## Termin erstellen

```bash
POST /api/plugins/rockstein.ms365/api/events
Content-Type: application/json

{
  "companyId": "{cid}",
  "subject": "Meeting",
  "start": { "dateTime": "2026-06-24T10:00:00", "timeZone": "Europe/Berlin" },
  "end": { "dateTime": "2026-06-24T11:00:00", "timeZone": "Europe/Berlin" },
  "attendees": [
    { "emailAddress": { "address": "teilnehmer@example.com" }, "type": "required" }
  ],
  "body": { "contentType": "html", "content": "<p>Agenda</p>" }
}
```

Response: `201` mit dem erstellten Event-Objekt (inkl. `id`).

## Termin bearbeiten

```bash
PATCH /api/plugins/rockstein.ms365/api/events/{eventId}?companyId={cid}
Content-Type: application/json

{
  "subject": "Neuer Titel",
  "start": { "dateTime": "...", "timeZone": "Europe/Berlin" }
}
```

## Termin löschen

```bash
DELETE /api/plugins/rockstein.ms365/api/events/{eventId}?companyId={cid}
```

## Einladung beantworten

```bash
POST /api/plugins/rockstein.ms365/api/events/{eventId}/respond?companyId={cid}
Content-Type: application/json

{
  "action": "accept",
  "comment": "Ich bin dabei."
}
```

`action`: `accept` | `tentativelyAccept` | `decline`

## Mailbox-Einstellungen abrufen

```bash
GET /api/plugins/rockstein.ms365/api/settings?companyId={cid}
```

## Signatur setzen

```bash
PATCH /api/plugins/rockstein.ms365/api/settings/signature
Content-Type: application/json

{
  "companyId": "{cid}",
  "name": "Signatur",
  "contentType": "html",
  "value": "<p>Julian Rockstein<br>Geschäftsführer</p>"
}
```

## Abwesenheitsnotiz konfigurieren

```bash
PATCH /api/plugins/rockstein.ms365/api/settings/automatic-replies
Content-Type: application/json

{
  "companyId": "{cid}",
  "status": "scheduled",
  "scheduledStartDateTime": { "dateTime": "2026-07-01T08:00:00", "timeZone": "Europe/Berlin" },
  "scheduledEndDateTime": { "dateTime": "2026-07-14T18:00:00", "timeZone": "Europe/Berlin" },
  "internalReplyMessage": "<p>Ich bin im Urlaub.</p>",
  "externalReplyMessage": "<p>I am on vacation until July 14th.</p>",
  "externalAudience": "all"
}
```

`status`: `disabled` | `alwaysEnabled` | `scheduled`

## OneDrive — Dateien auflisten

```bash
GET /api/plugins/rockstein.ms365/api/files?companyId={cid}
GET /api/plugins/rockstein.ms365/api/files?companyId={cid}&folderId={folderId}
```

## OneDrive — Datei suchen

```bash
GET /api/plugins/rockstein.ms365/api/files/search?companyId={cid}&q={suchbegriff}
```

## OneDrive — Datei herunterladen

```bash
GET /api/plugins/rockstein.ms365/api/files/{itemId}/content?companyId={cid}
```

## OneDrive — Datei hochladen

```bash
POST /api/plugins/rockstein.ms365/api/files
Content-Type: application/json

{
  "companyId": "{cid}",
  "name": "dokument.txt",
  "content": "Dateiinhalt als String",
  "folderId": "root"
}
```

`folderId`: `root` oder eine Drive-Item-ID. Response: `201`.

## Fehlerbehandlung

Alle Fehler folgen dem Schema `{ "error": "Beschreibung" }`:
- `401`: Nicht mit MS365 verbunden. Verbindung über Plugin-Settings herstellen.
- `400`: Ungültige Parameter.
- `503`: Plugin nicht konfiguriert (tenantId, clientId, clientSecretRef, baseUrl fehlen).

## Plugin-Konfiguration (für Administratoren)

Das Plugin muss in Paperclip installiert und konfiguriert sein:

| Feld | Wert |
|------|------|
| `tenantId` | `3d2a7d43-2137-491d-bf60-279021dcb84f` |
| `clientId` | Azure App Registration Client ID |
| `clientSecretRef` | Name des Paperclip-Secrets mit dem Azure Client Secret |
| `baseUrl` | `https://gue.rockstein-consulting.de` |

**Redirect URI (Azure App Registration):**
```
https://gue.rockstein-consulting.de/company/plugins/rockstein.ms365/settings
```
Dieser URI muss in der Azure App Registration unter "Redirect URIs" (Platform: Web) eingetragen sein.

**Erforderliche MS Graph Delegated Permissions:**
- `Mail.ReadWrite`
- `Mail.Send`
- `MailboxSettings.ReadWrite`
- `Calendars.ReadWrite`
- `Files.ReadWrite.All`
- `offline_access`
