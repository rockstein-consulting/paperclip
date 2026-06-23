CREATE TABLE user_sophie_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  user_id text NOT NULL,
  company_id text NOT NULL,
  key text NOT NULL,
  value jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX user_sophie_preferences_user_company_key_uq ON user_sophie_preferences USING btree (user_id,company_id,key);
