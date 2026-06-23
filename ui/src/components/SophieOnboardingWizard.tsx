import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { DialogPortal } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { sophiePreferencesApi } from "@/api/sophie-preferences";
import type { FormalityLevel, SophiePreferencesMap } from "@paperclipai/shared";

const TIMEZONES = ["Europe/Berlin","Europe/Vienna","Europe/Zurich","UTC","America/New_York","America/Los_Angeles"];
const LANGUAGES = [{ value: "de", label: "Deutsch" },{ value: "en", label: "English" }];

interface SophieOnboardingWizardProps {
  companyId: string;
  userName: string;
  onComplete: () => void;
}

export function SophieOnboardingWizard({ companyId, userName, onComplete }: SophieOnboardingWizardProps) {
  const [step, setStep] = useState(1);
  const totalSteps = 5;
  const [greetingName, setGreetingName] = useState(userName);
  const [emailExamples, setEmailExamples] = useState("");
  const [formality, setFormality] = useState<FormalityLevel>("formal");
  const [language, setLanguage] = useState("de");
  const [timezone, setTimezone] = useState("Europe/Berlin");
  const queryClient = useQueryClient();

  const saveMutation = useMutation({
    mutationFn: async () => {
      const prefs: Partial<SophiePreferencesMap> = {
        greeting_name: greetingName,
        formality_level: formality,
        language,
        timezone,
        onboarding_completed: true,
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

  return (
    <DialogPortal>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
        <div className="bg-[#0A0A0F] border border-[#C9A962]/30 rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-8">
          <div className="flex gap-1.5 mb-8">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div key={i} className={cn("h-1 flex-1 rounded-full transition-colors", i < step ? "bg-[#C9A962]" : "bg-white/10")} />
            ))}
          </div>
          <div className="min-h-[260px]">
            {step === 1 && (
              <div className="space-y-4">
                <h2 className="text-2xl font-semibold text-white">Willkommen bei Sophie</h2>
                <p className="text-white/60 text-sm leading-relaxed">Sophie ist Ihre persönliche KI-Assistentin. Sie liest und schreibt E-Mails, verwaltet Aufgaben und kennt Ihre Projekte.</p>
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
            {step === 2 && (
              <div className="space-y-4">
                <h2 className="text-2xl font-semibold text-white">E-Mail-Stil</h2>
                <p className="text-white/60 text-sm">Fügen Sie Beispiel-E-Mails ein. Trennen Sie mehrere Beispiele mit <code className="text-[#C9A962]">---</code>.</p>
                <Textarea className="min-h-[150px] bg-white/5 border-white/10 text-white placeholder:text-white/30 font-mono text-sm" placeholder={"Sehr geehrte Damen und Herren,\nvielen Dank...\n\n---\n\nHallo Frau Müller,\nanbei erhalten Sie..."} value={emailExamples} onChange={(e) => setEmailExamples(e.target.value)} />
                <p className="text-white/40 text-xs">Optional — kann jederzeit in den Einstellungen ergänzt werden.</p>
              </div>
            )}
            {step === 3 && (
              <div className="space-y-6">
                <h2 className="text-2xl font-semibold text-white">Ihre Präferenzen</h2>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-white/70 text-sm">Wie soll Sophie Sie ansprechen?</Label>
                    <Input className="bg-white/5 border-white/10 text-white" value={greetingName} onChange={(e) => setGreetingName(e.target.value)} placeholder="z.B. Günther" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-white/70 text-sm">Kommunikationsstil</Label>
                    <div className="flex gap-3">
                      {(["formal","informal"] as FormalityLevel[]).map((level) => (
                        <button key={level} type="button" onClick={() => setFormality(level)} className={cn("flex-1 py-2.5 rounded-lg border text-sm font-medium transition-all", formality === level ? "bg-[#C9A962] border-[#C9A962] text-black" : "bg-white/5 border-white/10 text-white/60 hover:border-white/30")}>
                          {level === "formal" ? "Formell (Sie)" : "Informell (Du)"}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-white/70 text-sm">Sprache</Label>
                      <select className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-white text-sm" value={language} onChange={(e) => setLanguage(e.target.value)}>
                        {LANGUAGES.map((l) => (<option key={l.value} value={l.value} className="bg-gray-900">{l.label}</option>))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-white/70 text-sm">Zeitzone</Label>
                      <select className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-white text-sm" value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                        {TIMEZONES.map((tz) => (<option key={tz} value={tz} className="bg-gray-900">{tz}</option>))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {step === 4 && (
              <div className="space-y-4">
                <h2 className="text-2xl font-semibold text-white">Microsoft 365</h2>
                <p className="text-white/60 text-sm leading-relaxed">Sophie kann Ihr E-Mail-Postfach, OneDrive und Kalender einbinden.</p>
                <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-[#0078D4] rounded flex items-center justify-center text-white text-xs font-bold">M</div>
                    <div><p className="text-white text-sm font-medium">Microsoft 365</p><p className="text-white/40 text-xs">E-Mail, OneDrive, Kalender</p></div>
                    <span className="ml-auto text-green-400 text-xs font-medium">Verbunden via SSO</span>
                  </div>
                </div>
              </div>
            )}
            {step === 5 && (
              <div className="space-y-4 text-center">
                <div className="w-16 h-16 rounded-full bg-[#C9A962]/20 flex items-center justify-center mx-auto text-3xl">✓</div>
                <h2 className="text-2xl font-semibold text-white">Sophie ist bereit</h2>
                <p className="text-white/60 text-sm">Ihre Einstellungen wurden gespeichert.</p>
                <div className="bg-[#C9A962]/10 border border-[#C9A962]/20 rounded-lg p-4 text-left">
                  <p className="text-white/60 text-xs">Ansprache: {greetingName} · {formality === "formal" ? "Sie" : "Du"} · {language === "de" ? "Deutsch" : "English"} · {timezone}</p>
                </div>
                {saveMutation.error && <p className="text-red-400 text-xs">{String(saveMutation.error)}</p>}
              </div>
            )}
          </div>
          <div className="flex justify-between mt-8">
            <Button variant="ghost" className="text-white/40 hover:text-white/70" onClick={() => setStep(Math.max(1, step - 1))} disabled={step === 1}>Zurück</Button>
            <Button className="bg-[#C9A962] hover:bg-[#C9A962]/80 text-black font-medium min-w-28" onClick={next} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Speichern..." : step === totalSteps ? "Loslegen" : "Weiter"}
            </Button>
          </div>
        </div>
      </div>
    </DialogPortal>
  );
}
