# Sophie Dashboard — Lokale Dev-Umgebung (Spur A)

Dieses Dokument beschreibt die Einrichtung der lokalen Entwicklungsumgebung für
das Sophie-Dashboard-Projekt auf Basis des Paperclip-Forks.

**Fork:** `rockstein-consulting/paperclip` (Fork von `paperclipai/paperclip`)  
**Projekt:** ROC-4023 — Sophie Dashboard für Günther Rockstein  
**Ziel-Server:** Günther VM (`gue.rockstein-consulting.de`)

---

## Voraussetzungen

- Docker Engine 24+ und Docker Compose v2
- Git
- GitHub-Zugang zum `rockstein-consulting`-Account (julianrcks)

Node.js wird nur für lokale Entwicklung ohne Docker benötigt. Für den Dev-Server
reicht Docker.

---

## Fork klonen

```bash
git clone https://github.com/rockstein-consulting/paperclip.git
cd paperclip
```

Oder mit Token (für CI/automatisierte Setups):

```bash
git clone https://julianrcks:${GH_TOKEN}@github.com/rockstein-consulting/paperclip.git
```

---

## Dev-Umgebung starten (Docker)

Die Dev-Umgebung läuft auf **Port 3101** (unabhängig von der Prod-Instanz auf Port 3100).

### 1. Dev-Compose starten

```bash
docker compose -f docker-compose.dev.yml up -d
```

Startet:
- `db-dev` — PostgreSQL 17 auf Port 5433
- `server-dev` — Paperclip Server auf Port 3101 (gebaut aus dem Fork-Dockerfile)

### 2. Erster Start (Build)

Beim ersten Start muss das Docker-Image gebaut werden (~3–5 Minuten):

```bash
docker compose -f docker-compose.dev.yml build
docker compose -f docker-compose.dev.yml up -d
```

### 3. Zugriff

```
http://localhost:3101
```

### 4. Stoppen

```bash
docker compose -f docker-compose.dev.yml down
```

---

## Entwicklung (Hot-Reload ohne Docker)

Für schnelle Code-Iteration ohne Docker-Rebuilds:

### Voraussetzungen

- Node.js 20+ (LTS)
- pnpm 9.15+: `corepack enable && corepack use pnpm@9.15.4`
- PostgreSQL (lokal oder via Docker: `docker compose -f docker-compose.dev.yml up -d db-dev`)

### Setup

```bash
# Dependencies installieren
pnpm install --frozen-lockfile

# .env aus .env.example erstellen (einmalig)
cp .env.example .env
# DATABASE_URL in .env anpassen falls nötig

# Dev-Server mit Watch-Modus starten
pnpm dev
```

Der Dev-Server startet auf `http://localhost:3100` und buildet automatisch bei
Code-Änderungen neu.

---

## Umgebungsvariablen (.env)

| Variable | Standard | Beschreibung |
|----------|----------|--------------|
| `DATABASE_URL` | `postgres://paperclip:paperclip@localhost:5432/paperclip` | PostgreSQL-Verbindungsstring |
| `PORT` | `3100` | Server-Port |
| `SERVE_UI` | `false` | UI mitservieren (true für Produktion) |
| `BETTER_AUTH_SECRET` | `paperclip-dev-secret` | Geheimnis für Auth-Tokens (min. 32 Zeichen für Produktion) |
| `PAPERCLIP_DEPLOYMENT_MODE` | — | `local_trusted` (lokal) oder `authenticated` (Produktion) |
| `PAPERCLIP_DEPLOYMENT_EXPOSURE` | — | `private` oder `public` |
| `PAPERCLIP_PUBLIC_URL` | — | Externe URL (z.B. `https://gue.rockstein-consulting.de`) |
| `DISCORD_WEBHOOK_URL` | — | Optional: Discord-Webhook für Daily-Digest |

### Wichtige Hinweise zu BETTER_AUTH_SECRET

- Mindestens 32 zufällige Zeichen in Produktion
- Generieren: `openssl rand -hex 32`
- Niemals in Git committen — immer über Umgebungsvariablen setzen

---

## Fork aktuell halten

Den Fork mit dem Upstream synchronisieren:

```bash
# Upstream einmalig hinzufügen
git remote add upstream https://github.com/paperclipai/paperclip.git

# Fork aktualisieren
git fetch upstream
git rebase upstream/master
git push origin master
```

---

## Projektstruktur (Sophie-relevante Bereiche)

```
paperclip/
├── server/src/          # Backend (Express.js + Drizzle ORM)
│   ├── routes/          # API-Endpoints
│   └── index.ts         # Server-Einstiegspunkt
├── ui/src/              # Frontend (React 18 + TanStack)
│   ├── pages/           # Seiten-Komponenten
│   └── components/      # Wiederverwendbare UI-Komponenten
├── packages/
│   ├── db/              # Datenbank-Schema (Drizzle)
│   └── shared/          # Gemeinsame Typen
├── docker-compose.dev.yml   # Dev-Umgebung (Port 3101)
└── SOPHIE-DEV.md            # Diese Datei
```

---

## Status (Stand 2026-06-22)

- [x] Fork `rockstein-consulting/paperclip` erstellt (aus `paperclipai/paperclip`)
- [x] Lokale Dependencies installierbar (`pnpm install` erfolgreich)
- [x] Dev-Docker-Setup erstellt (`docker-compose.dev.yml`)
- [x] Paperclip startet erfolgreich auf Port 3101 (HTTP 200 verifiziert)
- [ ] Sophie-spezifische Modifikationen (folgt in separaten Issues)
