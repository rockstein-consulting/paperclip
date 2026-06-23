export type SophiePreferenceKey =
  | "email_style_examples"
  | "formality_level"
  | "language"
  | "greeting_name"
  | "timezone"
  | "onboarding_completed";

export interface SophiePreference {
  id: string;
  userId: string;
  companyId: string;
  key: SophiePreferenceKey;
  value: unknown;
  createdAt: Date;
  updatedAt: Date;
}

export type FormalityLevel = "formal" | "informal";

export interface SophiePreferencesMap {
  email_style_examples?: string[];
  formality_level?: FormalityLevel;
  language?: string;
  greeting_name?: string;
  timezone?: string;
  onboarding_completed?: boolean;
}
