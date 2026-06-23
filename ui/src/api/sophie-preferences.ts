import type { SophiePreferencesMap } from "@paperclipai/shared";

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const resp = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`HTTP ${resp.status}: ${text}`);
  }
  if (resp.status === 204) return undefined as T;
  return resp.json() as Promise<T>;
}

export const sophiePreferencesApi = {
  getMap(companyId: string): Promise<SophiePreferencesMap> {
    return fetchJson(`/api/companies/${companyId}/sophie-preferences/me/map`);
  },

  upsertMany(companyId: string, prefs: Partial<SophiePreferencesMap>): Promise<void> {
    return fetchJson(`/api/companies/${companyId}/sophie-preferences/me`, {
      method: "PUT",
      body: JSON.stringify(prefs),
    });
  },

  upsertOne(companyId: string, key: string, value: unknown): Promise<void> {
    return fetchJson(`/api/companies/${companyId}/sophie-preferences/me/${key}`, {
      method: "PUT",
      body: JSON.stringify({ value }),
    });
  },
};
