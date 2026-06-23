import { and, eq } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { userSophiePreferences } from "@paperclipai/db";
import type { SophiePreferenceKey, SophiePreferencesMap } from "@paperclipai/shared";

export function sophiePreferencesService(db: Db) {
  return {
    async getAll(userId: string, companyId: string) {
      return db.query.userSophiePreferences.findMany({
        where: and(
          eq(userSophiePreferences.userId, userId),
          eq(userSophiePreferences.companyId, companyId),
        ),
        orderBy: (table, { asc }) => [asc(table.key)],
      });
    },

    async getMap(userId: string, companyId: string): Promise<SophiePreferencesMap> {
      const rows = await db.query.userSophiePreferences.findMany({
        where: and(
          eq(userSophiePreferences.userId, userId),
          eq(userSophiePreferences.companyId, companyId),
        ),
      });
      const map: Record<string, unknown> = {};
      for (const row of rows) {
        map[row.key] = row.value;
      }
      return map as SophiePreferencesMap;
    },

    async upsert(userId: string, companyId: string, key: SophiePreferenceKey, value: unknown) {
      const now = new Date();
      const [row] = await db
        .insert(userSophiePreferences)
        .values({ userId, companyId, key, value, updatedAt: now })
        .onConflictDoUpdate({
          target: [
            userSophiePreferences.userId,
            userSophiePreferences.companyId,
            userSophiePreferences.key,
          ],
          set: { value, updatedAt: now },
        })
        .returning();
      return row;
    },

    async upsertMany(
      userId: string,
      companyId: string,
      preferences: Partial<SophiePreferencesMap>,
    ) {
      const now = new Date();
      const entries = Object.entries(preferences) as [SophiePreferenceKey, unknown][];
      if (entries.length === 0) return [];
      return db
        .insert(userSophiePreferences)
        .values(entries.map(([key, value]) => ({ userId, companyId, key, value, updatedAt: now })))
        .onConflictDoUpdate({
          target: [
            userSophiePreferences.userId,
            userSophiePreferences.companyId,
            userSophiePreferences.key,
          ],
          set: { value: userSophiePreferences.value, updatedAt: now },
        })
        .returning();
    },

    async delete(userId: string, companyId: string, key: SophiePreferenceKey) {
      await db
        .delete(userSophiePreferences)
        .where(
          and(
            eq(userSophiePreferences.userId, userId),
            eq(userSophiePreferences.companyId, companyId),
            eq(userSophiePreferences.key, key),
          ),
        );
    },
  };
}
