import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "@/lib/router";
import { authApi } from "../api/auth";
import { queryKeys } from "../lib/queryKeys";
import { getRememberedInvitePath } from "../lib/invite-memory";
import { Button } from "@/components/ui/button";

type AuthMode = "sign_in" | "sign_up";

export function AuthPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<AuthMode>("sign_in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [microsoftEnabled, setMicrosoftEnabled] = useState(false);
  const errorId = "auth-error";

  const nextPath = useMemo(
    () => searchParams.get("next") || getRememberedInvitePath() || "/",
    [searchParams],
  );

  useEffect(() => {
    authApi.getProviders().then((p) => setMicrosoftEnabled(p.microsoftEntraId)).catch(() => undefined);
  }, []);

  const { data: session, isLoading: isSessionLoading } = useQuery({
    queryKey: queryKeys.auth.session,
    queryFn: () => authApi.getSession(),
    retry: false,
  });

  useEffect(() => {
    if (session) {
      navigate(nextPath, { replace: true });
    }
  }, [session, navigate, nextPath]);

  const microsoftMutation = useMutation({
    mutationFn: () => authApi.signInMicrosoft(nextPath),
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Microsoft-Anmeldung fehlgeschlagen");
    },
  });

  const mutation = useMutation({
    mutationFn: async () => {
      if (mode === "sign_in") {
        await authApi.signInEmail({ email: email.trim(), password });
        return;
      }
      await authApi.signUpEmail({
        name: name.trim(),
        email: email.trim(),
        password,
      });
    },
    onSuccess: async () => {
      setError(null);
      await queryClient.invalidateQueries({ queryKey: queryKeys.auth.session });
      await queryClient.invalidateQueries({ queryKey: queryKeys.companies.all });
      navigate(nextPath, { replace: true });
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Anmeldung fehlgeschlagen");
    },
  });

  const canSubmit =
    email.trim().length > 0 &&
    password.trim().length > 0 &&
    (mode === "sign_in" || (name.trim().length > 0 && password.trim().length >= 8));

  if (isSessionLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Laden…</p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background">
      {/* Centered login card */}
      <div className="w-full max-w-sm px-8 py-10 rounded-lg border border-border bg-card shadow-2xl">
        {/* Logo + brand name */}
        <div className="flex flex-col items-center mb-8">
          <img
            src="/rockstein-logo.png"
            alt="Rockstein AI OS"
            className="h-16 w-auto mb-4 object-contain"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "#C9A962" }}>
            Rockstein AI OS
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            {mode === "sign_in" ? "Anmelden" : "Konto erstellen"}
          </p>
        </div>

        {/* Microsoft SSO — primary option when enabled */}
        {microsoftEnabled && mode === "sign_in" && (
          <div className="mb-6">
            <Button
              type="button"
              className="w-full font-semibold"
              style={{ background: "#C9A962", color: "#0A0A0F" }}
              disabled={microsoftMutation.isPending}
              onClick={() => {
                setError(null);
                microsoftMutation.mutate();
              }}
            >
              {microsoftMutation.isPending ? "Weiterleitung…" : "Mit Microsoft anmelden"}
            </Button>
            <div className="relative flex items-center justify-center text-xs text-muted-foreground mt-4 before:flex-1 before:border-t before:border-border after:flex-1 after:border-t after:border-border before:mr-3 after:ml-3">
              oder
            </div>
          </div>
        )}

        <form
          className="space-y-4"
          method="post"
          action={mode === "sign_up" ? "/api/auth/sign-up/email" : "/api/auth/sign-in/email"}
          onSubmit={(event) => {
            event.preventDefault();
            if (mutation.isPending) return;
            if (!canSubmit) {
              setError("Bitte alle Pflichtfelder ausfüllen.");
              return;
            }
            mutation.mutate();
          }}
        >
          {mode === "sign_up" && (
            <div>
              <label htmlFor="name" className="text-xs text-muted-foreground mb-1 block">Name</label>
              <input
                id="name"
                name="name"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50"
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoComplete="name"
                required
                aria-required="true"
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? errorId : undefined}
                autoFocus
              />
            </div>
          )}
          <div>
            <label htmlFor="email" className="text-xs text-muted-foreground mb-1 block">E-Mail</label>
            <input
              id="email"
              name="email"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="username"
              required
              aria-required="true"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
              autoFocus={mode === "sign_in"}
            />
          </div>
          <div>
            <label htmlFor="password" className="text-xs text-muted-foreground mb-1 block">Passwort</label>
            <input
              id="password"
              name="password"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={mode === "sign_in" ? "current-password" : "new-password"}
              required
              aria-required="true"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
            />
          </div>
          {error && (
            <p id={errorId} role="alert" className="text-xs text-destructive">
              {error}
            </p>
          )}
          <Button
            type="submit"
            variant="outline"
            disabled={mutation.isPending}
            aria-disabled={!canSubmit || mutation.isPending}
            className={`w-full ${!canSubmit && !mutation.isPending ? "opacity-50" : ""}`}
          >
            {mutation.isPending
              ? "Bitte warten…"
              : mode === "sign_in"
                ? "Anmelden"
                : "Konto erstellen"}
          </Button>
        </form>

        <div className="mt-5 text-center text-sm text-muted-foreground">
          {mode === "sign_in" ? "Kein Konto?" : "Bereits registriert?"}{" "}
          <button
            type="button"
            className="font-medium text-foreground underline underline-offset-2"
            onClick={() => {
              setError(null);
              setMode(mode === "sign_in" ? "sign_up" : "sign_in");
            }}
          >
            {mode === "sign_in" ? "Erstellen" : "Anmelden"}
          </button>
        </div>
      </div>
    </div>
  );
}
