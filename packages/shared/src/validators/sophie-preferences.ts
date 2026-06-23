import { z } from "zod";

export const SOPHIE_PREFERENCE_KEYS = [
  "email_style_examples",
  "formality_level",
  "language",
  "greeting_name",
  "timezone",
  "onboarding_completed",
  "brand_primary_color",
  "brand_secondary_color",
  "brand_website_url",
  "brand_logo_url",
] as const;

export const sophiePreferenceKeySchema = z.enum(SOPHIE_PREFERENCE_KEYS);

export const sophiePreferenceValueSchema = z.union([
  z.string(),
  z.boolean(),
  z.number(),
  z.array(z.string()),
  z.null(),
]);

export const upsertSophiePreferenceSchema = z.object({
  value: sophiePreferenceValueSchema,
});

export type UpsertSophiePreference = z.infer<typeof upsertSophiePreferenceSchema>;

export const sophiePreferenceSchema = z.object({
  id: z.string().uuid(),
  userId: z.string(),
  companyId: z.string(),
  key: sophiePreferenceKeySchema,
  value: sophiePreferenceValueSchema,
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type SophiePreferenceResponse = z.infer<typeof sophiePreferenceSchema>;
