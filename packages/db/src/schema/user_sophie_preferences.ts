import { pgTable, uuid, text, timestamp, jsonb, uniqueIndex } from "drizzle-orm/pg-core";

export const userSophiePreferences = pgTable(
  "user_sophie_preferences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    companyId: text("company_id").notNull(),
    key: text("key").notNull(),
    value: jsonb("value").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userCompanyKeyUq: uniqueIndex("user_sophie_preferences_user_company_key_uq").on(
      table.userId,
      table.companyId,
      table.key,
    ),
  }),
);
