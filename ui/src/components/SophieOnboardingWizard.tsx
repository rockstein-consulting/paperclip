import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogPortal } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { sophiePreferencesApi } from "@/api/sophie-preferences";
import type { FormalityLevel, SophiePreferencesMap } from "@paperclipai/shared";

const TIMEZONES = [
  "Europe/Berlin",
  "Europe/Vienna",
  "Europe/Zurich",
  "UTC",
  "America/New_York",
  "America/Los_Angeles",
];

const LANGUAGES = [
  { value: "de", label: "Deutsch" },
  { value: "en", label: "English" },
];

interface DesignExtractResult {
  siteName: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  logoUrl: string | null;
  topColors: string[];
}

interface SophieOnboardingWizardProps {
  companyId: string;
  userName: string;
  onComplete: () => void;
}

export function SophieOnboardingWizard({ companyId, userName, onComplete }: SophieOnboardingWizardProps) {
  const [step, setStep] = useState(1);
  const totalSteps = 6;

  // Step 1 — Welcome (no inputs)

  // Step 2 — Design Extraktion
  const [websiteUrl, setWebsiteUrl] = useState("https://rockstein-versichert.de");
  const [extractResult, setExtractResult] = useState<DesignExtractResult | null>(null);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [primaryColor, setPrimaryColor] = useState("#C9A962");
  const [secondaryColor, setSecondaryColor] = useState("#0A0A0F");
  const [extracting, setExtracting] = useState(false);

  // Step 3 — Email style
  const [emailExamples, setEmailExamples] = useState("");

  // Step 4 — Preferences
  const [greetingName, setGreetingName] = useState(userName);
  const [formality, setFormality] = useState<FormalityLevel>("formal");
  const [language, setLanguage] = useState("de");
  const [timezone, setTimezone] = useState("Europe/Berlin");

  // Step 5 — MS365 (info only)
  // Step 6 — Done

  const queryClient = useQueryClient();

  async function runExtraction() {
    if (!websiteUrl.trim()) return;
    setExtracting(true);
    setExtractError(null);
    try {
      const resp = await fetch(`/api/companies/${companyId}/design-extract`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: websiteUrl }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error ?? `HTTP ${resp.status}`);
      }
      const data = await resp.json() as DesignExtractResult;
      setExtractResult(data);
      if (data.primaryColor) setPrimaryColor(data.primaryColor);
      if (data.secondaryColor) setSecondaryColor(data.secondaryColor);
    } catch (err) {
      setExtractError(err instanceof Error ? err.message : String(err));
    } finally {
      setExtracting(false);
    }
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const prefs: Partial<SophiePreferencesMap> = {
        greeting_name: greetingName,
        formality_level: formality,
        language,
        timezone,
        onboarding_completed: true,
        brand_primary_color: primaryColor || undefined,
        brand_secondary_color: secondaryColor || undefined,
        brand_website_url: websiteUrl || undefined,
      };
      if (emailExamples.trim()) {
        prefs.email_style_examples = emailExamples.split("\n---\n").map((s) => s.trim()).filter(Boolean);
      }
      await sophiePreferencesApi.upsertMany(companyId, prefs);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sophie-preferences", companyId] });
      onComplete();
    },
  });

  function next() {
    if (step < totalSteps) setStep(step + 1);
    else saveMutation.mutate();
  }

  function back() {
    if (step > 1) setStep(step - 1);
  }

  const canNext =
    step === 1 ||
    step === 2 ||
    step === 3 ||
    (step === 4 && greetingName.trim().length > 0) ||
    step === 5 ||
    step === 6;

  return (
    <Dialog open>
      <DialogPortal>
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-[#0A0A0F] border border-[#C9A962]/30 rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-8">
            {/* Progress */}
            <div className="flex gap-1.5 mb-8">
              {Array.from({ length: totalSteps }).map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "h-1 flex-1 rounded-full transition-colors",
                    i < step ? "bg-[#C9A962]" : "bg-white/10",
                  )}
                />
              ))}
            </div>

            {/* Step content */}
            <div className="min-h-[280px]">

              {/* Step 1: Welcome */}
              {step === 1 && (
                <div className="space-y-4">
                  <h2 className="text-2xl font-semibold text-white">Willkommen bei Sophie</h2>
                  <p className="text-white/60 text-sm leading-relaxed">
                    Sophie ist Ihre persönliche KI-Assistentin. Sie liest und schreibt E-Mails, verwaltet
                    Aufgaben und kennt Ihre Projekte. In wenigen Schritten richten wir Sophie genau nach
                    Ihren Wünschen ein.
                  </p>
                  <div className="bg-[#C9A962]/10 border border-[#C9A962]/20 rounded-lg p-4 space-y-2">
                    <p className="text-[#C9A962] text-sm font-medium">Sophie kann:</p>
                    <ul className="text-white/60 text-sm space-y-1 list-disc list-inside">
                      <li>E-Mails im gewünschten Stil schreiben</li>
                      <li>Aufgaben und Projekte verwalten</li>
                      <li>Dokumente analysieren (Word, PDF, Bilder, Audio)</li>
                      <li>Microsoft 365 anbinden (Postfach, OneDrive, Kalender)</li>
                    </ul>
                  </div>
                </div>
              )}

              {/* Step 2: KI-Design-Extraktion */}
              {step === 2 && (
                <div className="space-y-4">
                  <h2 className="text-2xl font-semibold text-white">Corporate Design</h2>
                  <p className="text-white/60 text-sm leading-relaxed">
                    Sophie kann das Branding Ihrer Website erkennen und Ausgaben in Ihrem
                    Corporate Design erstellen. Geben Sie Ihre Website-URL ein.
                  </p>
                  <div className="flex gap-2">
                    <Input
                      className="bg-white/5 border-white/10 text-white flex-1"
                      placeholder="https://ihre-website.de"
                      value={websiteUrl}
                      onChange={(e) => setWebsiteUrl(e.target.value)}
                    />
                    <Button
                      variant="outline"
                      className="border-[#C9A962]/40 text-[#C9A962] hover:bg-[#C9A962]/10 shrink-0"
                      onClick={runExtraction}
                      disabled={extracting || !websiteUrl.trim()}
                    >
                      {extracting ? <LoaderCircle size={16} className="animate-spin" /> : "Analysieren"}
                    </Button>
                  </div>

                  {extractError && (
                    <p className="text-red-400 text-xs">{extractError} — Sie können die Farben manuell eingeben.</p>
                  )}

                  {extractResult && (
                    <div className="bg-white/5 border border-white/10 rounded-lg p-3 space-y-1">
                      <p className="text-[#C9A962] text-xs font-medium">
                        Erkannt: {extractResult.siteName ?? "Ihre Website"}
                      </p>
                      {extractResult.topColors.length > 0 && (
                        <div className="flex gap-1.5 flex-wrap mt-1">
                          {extractResult.topColors.map((c) => (
                            <button
                              key={c}
                              type="button"
                              title={c}
                              onClick={() => setPrimaryColor(c)}
                              className="w-6 h-6 rounded border-2 transition-all"
                              style={{
                                backgroundColor: c,
                                borderColor: primaryColor === c ? "#C9A962" : "transparent",
                              }}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4 pt-1">
                    <div className="space-y-2">
                      <Label className="text-white/60 text-xs">Primärfarbe</Label>
                      <div className="flex gap-2 items-center">
                        <input
                          type="color"
                          value={primaryColor}
                          onChange={(e) => setPrimaryColor(e.target.value)}
                          className="w-8 h-8 rounded border border-white/20 bg-transparent cursor-pointer"
                        />
                        <Input
                          className="bg-white/5 border-white/10 text-white font-mono text-xs h-8"
                          value={primaryColor}
                          onChange={(e) => setPrimaryColor(e.target.value)}
                          maxLength={7}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-white/60 text-xs">Sekundärfarbe</Label>
                      <div className="flex gap-2 items-center">
                        <input
                          type="color"
                          value={secondaryColor}
                          onChange={(e) => setSecondaryColor(e.target.value)}
                          className="w-8 h-8 rounded border border-white/20 bg-transparent cursor-pointer"
                        />
                        <Input
                          className="bg-white/5 border-white/10 text-white font-mono text-xs h-8"
                          value={secondaryColor}
                          onChange={(e) => setSecondaryColor(e.target.value)}
                          maxLength={7}
                        />
                      </div>
                    </div>
                  </div>
                  <p className="text-white/30 text-xs">Optional — kann jederzeit in den Einstellungen geändert werden.</p>
                </div>
              )}

              {/* Step 3: Email style */}
              {step === 3 && (
                <div className="space-y-4">
                  <h2 className="text-2xl font-semibold text-white">E-Mail-Stil</h2>
                  <p className="text-white/60 text-sm">
                    Fügen Sie Beispiel-E-Mails ein, die Ihren Schreibstil zeigen. Sophie lernt daraus,
                    wie sie für Sie schreiben soll. Trennen Sie mehrere Beispiele mit{" "}
                    <code className="text-[#C9A962]">---</code>.
                  </p>
                  <Textarea
                    className="min-h-[150px] bg-white/5 border-white/10 text-white placeholder:text-white/30 font-mono text-sm"
                    placeholder={"Sehr geehrte Damen und Herren,\nvielen Dank für Ihre Nachricht...\n\n---\n\nHallo Frau Müller,\nanbei erhalten Sie...\n"}
                    value={emailExamples}
                    onChange={(e) => setEmailExamples(e.target.value)}
                  />
                  <p className="text-white/40 text-xs">Optional — kann jederzeit in den Einstellungen ergänzt werden.</p>
                </div>
              )}

              {/* Step 4: Preferences */}
              {step === 4 && (
                <div className="space-y-6">
                  <h2 className="text-2xl font-semibold text-white">Ihre Präferenzen</h2>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-white/70 text-sm">Wie soll Sophie Sie ansprechen?</Label>
                      <Input
                        className="bg-white/5 border-white/10 text-white"
                        value={greetingName}
                        onChange={(e) => setGreetingName(e.target.value)}
                        placeholder="z.B. Günther"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-white/70 text-sm">Kommunikationsstil</Label>
                      <div className="flex gap-3">
                        {(["formal", "informal"] as FormalityLevel[]).map((level) => (
                          <button
                            key={level}
                            type="button"
                            onClick={() => setFormality(level)}
                            className={cn(
                              "flex-1 py-2.5 rounded-lg border text-sm font-medium transition-all",
                              formality === level
                                ? "bg-[#C9A962] border-[#C9A962] text-black"
                                : "bg-white/5 border-white/10 text-white/60 hover:border-white/30",
                            )}
                          >
                            {level === "formal" ? "Formell (Sie)" : "Informell (Du)"}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-white/70 text-sm">Sprache</Label>
                        <select
                          className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-white text-sm"
                          value={language}
                          onChange={(e) => setLanguage(e.target.value)}
                        >
                          {LANGUAGES.map((l) => (
                            <option key={l.value} value={l.value} className="bg-gray-900">{l.label}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-white/70 text-sm">Zeitzone</Label>
                        <select
                          className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-white text-sm"
                          value={timezone}
                          onChange={(e) => setTimezone(e.target.value)}
                        >
                          {TIMEZONES.map((tz) => (
                            <option key={tz} value={tz} className="bg-gray-900">{tz}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 5: MS365 */}
              {step === 5 && (
                <div className="space-y-4">
                  <h2 className="text-2xl font-semibold text-white">Microsoft 365</h2>
                  <p className="text-white/60 text-sm leading-relaxed">
                    Sophie kann Ihr E-Mail-Postfach, OneDrive und Kalender einbinden. Die Verbindung
                    wird über Ihr Microsoft-Konto eingerichtet.
                  </p>
                  <div className="bg-white/5 border border-white/10 rounded-lg p-4 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-[#0078D4] rounded flex items-center justify-center text-white text-xs font-bold">M</div>
                      <div>
                        <p className="text-white text-sm font-medium">Microsoft 365</p>
                        <p className="text-white/40 text-xs">E-Mail, OneDrive, Kalender</p>
                      </div>
                      <span className="ml-auto text-green-400 text-xs font-medium">Verbunden via SSO</span>
                    </div>
                  </div>
                  <p className="text-white/40 text-xs">
                    Die Microsoft-Verbindung wurde bei der Anmeldung eingerichtet. Erweiterte Berechtigungen
                    können jederzeit in den Einstellungen angepasst werden.
                  </p>
                </div>
              )}

              {/* Step 6: Done */}
              {step === 6 && (
                <div className="space-y-4 text-center">
                  <div className="w-16 h-16 rounded-full bg-[#C9A962]/20 flex items-center justify-center mx-auto text-3xl">
                    &#10003;
                  </div>
                  <h2 className="text-2xl font-semibold text-white">Sophie ist bereit</h2>
                  <p className="text-white/60 text-sm leading-relaxed">
                    Ihre Einstellungen wurden gespeichert. Sophie kennt jetzt Ihren Stil und steht bereit,
                    Ihnen zu helfen.
                  </p>
                  <div className="bg-[#C9A962]/10 border border-[#C9A962]/20 rounded-lg p-4 text-left space-y-1">
                    <p className="text-[#C9A962] text-xs font-medium">Ihre Einstellungen</p>
                    <p className="text-white/60 text-xs">Ansprache: {greetingName} · {formality === "formal" ? "Sie" : "Du"} · {language === "de" ? "Deutsch" : "English"}</p>
                    <p className="text-white/60 text-xs">Zeitzone: {timezone}</p>
                    {primaryColor && <p className="text-white/60 text-xs">Primärfarbe: <span style={{ color: primaryColor }}>{primaryColor}</span></p>}
                    {emailExamples.trim() && <p className="text-white/60 text-xs">E-Mail-Beispiele: hinterlegt</p>}
                  </div>
                  {saveMutation.error && (
                    <p className="text-red-400 text-xs">{String(saveMutation.error)}</p>
                  )}
                </div>
              )}
            </div>

            {/* Navigation */}
            <div className="flex justify-between mt-8">
              <Button
                variant="ghost"
                className="text-white/40 hover:text-white/70"
                onClick={back}
                disabled={step === 1}
              >
                Zurück
              </Button>
              <Button
                className="bg-[#C9A962] hover:bg-[#C9A962]/80 text-black font-medium min-w-28"
                onClick={next}
                disabled={!canNext || saveMutation.isPending}
              >
                {saveMutation.isPending
                  ? "Speichern..."
                  : step === totalSteps
                  ? "Loslegen"
                  : "Weiter"}
              </Button>
            </div>
          </div>
        </div>
      </DialogPortal>
    </Dialog>
  );
}
