import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Save, LoaderCircle, Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useBreadcrumbs } from "@/context/BreadcrumbContext";
import { useCompany } from "@/context/CompanyContext";
import { sophiePreferencesApi } from "@/api/sophie-preferences";
import type { FormalityLevel, SophiePreferencesMap } from "@paperclipai/shared";
import { cn } from "@/lib/utils";

const TIMEZONES = [
  "Europe/Berlin",
  "Europe/Vienna",
  "Europe/Zurich",
  "UTC",
  "America/New_York",
  "America/Los_Angeles",
  "America/Chicago",
  "Asia/Tokyo",
  "Asia/Singapore",
  "Australia/Sydney",
];

const LANGUAGES = [
  { value: "de", label: "Deutsch" },
  { value: "en", label: "English" },
];

export function SophiePreferencesPage() {
  const { setBreadcrumbs } = useBreadcrumbs();
  const { selectedCompanyId } = useCompany();
  const queryClient = useQueryClient();

  const [greetingName, setGreetingName] = useState("");
  const [formality, setFormality] = useState<FormalityLevel>("formal");
  const [language, setLanguage] = useState("de");
  const [timezone, setTimezone] = useState("Europe/Berlin");
  const [emailExamples, setEmailExamples] = useState<string[]>([]);
  const [newExample, setNewExample] = useState("");
  const [saved, setSaved] = useState(false);

  // Design fields
  const [brandWebsiteUrl, setBrandWebsiteUrl] = useState("");
  const [brandPrimaryColor, setBrandPrimaryColor] = useState("#C9A962");
  const [brandSecondaryColor, setBrandSecondaryColor] = useState("#0A0A0F");
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);

  useEffect(() => {
    setBreadcrumbs([
      { label: "Einstellungen", href: "/company/settings" },
      { label: "Sophie-Präferenzen" },
    ]);
  }, [setBreadcrumbs]);

  const prefsQuery = useQuery({
    queryKey: ["sophie-preferences", selectedCompanyId],
    queryFn: () => sophiePreferencesApi.getMap(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  useEffect(() => {
    const prefs = prefsQuery.data;
    if (!prefs) return;
    if (prefs.greeting_name) setGreetingName(prefs.greeting_name);
    if (prefs.formality_level) setFormality(prefs.formality_level);
    if (prefs.language) setLanguage(prefs.language);
    if (prefs.timezone) setTimezone(prefs.timezone);
    if (prefs.email_style_examples) setEmailExamples(prefs.email_style_examples);
    if (prefs.brand_website_url) setBrandWebsiteUrl(prefs.brand_website_url);
    if (prefs.brand_primary_color) setBrandPrimaryColor(prefs.brand_primary_color);
    if (prefs.brand_secondary_color) setBrandSecondaryColor(prefs.brand_secondary_color);
  }, [prefsQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const prefs: Partial<SophiePreferencesMap> = {
        greeting_name: greetingName,
        formality_level: formality,
        language,
        timezone,
        email_style_examples: emailExamples,
        brand_website_url: brandWebsiteUrl || undefined,
        brand_primary_color: brandPrimaryColor || undefined,
        brand_secondary_color: brandSecondaryColor || undefined,
      };
      await sophiePreferencesApi.upsertMany(selectedCompanyId!, prefs);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sophie-preferences", selectedCompanyId] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
  });

  async function runExtraction() {
    if (!brandWebsiteUrl.trim() || !selectedCompanyId) return;
    setExtracting(true);
    setExtractError(null);
    try {
      const resp = await fetch(`/api/companies/${selectedCompanyId}/design-extract`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: brandWebsiteUrl }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error ?? `HTTP ${resp.status}`);
      }
      const data = await resp.json() as { primaryColor?: string; secondaryColor?: string };
      if (data.primaryColor) setBrandPrimaryColor(data.primaryColor);
      if (data.secondaryColor) setBrandSecondaryColor(data.secondaryColor);
    } catch (err) {
      setExtractError(err instanceof Error ? err.message : String(err));
    } finally {
      setExtracting(false);
    }
  }

  function addExample() {
    if (!newExample.trim()) return;
    setEmailExamples([...emailExamples, newExample.trim()]);
    setNewExample("");
  }

  function removeExample(idx: number) {
    setEmailExamples(emailExamples.filter((_, i) => i !== idx));
  }

  if (prefsQuery.isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <LoaderCircle className="animate-spin text-white/40" size={24} />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-white">Sophie-Präferenzen</h1>
        <p className="text-white/50 text-sm mt-1">
          Wie Sophie Sie anspricht und für Sie schreibt.
        </p>
      </div>

      {/* Corporate Design */}
      <section className="space-y-4">
        <h2 className="text-sm font-medium text-white/70 uppercase tracking-wider">Corporate Design</h2>
        <p className="text-white/40 text-xs">Sophie nutzt diese Farben für Ausgaben und Dokumente in Ihrem Corporate Design.</p>
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input
              className="bg-white/5 border-white/10 text-white flex-1"
              placeholder="https://ihre-website.de"
              value={brandWebsiteUrl}
              onChange={(e) => setBrandWebsiteUrl(e.target.value)}
            />
            <Button
              variant="outline"
              className="border-[#C9A962]/40 text-[#C9A962] hover:bg-[#C9A962]/10 shrink-0"
              onClick={runExtraction}
              disabled={extracting || !brandWebsiteUrl.trim()}
            >
              {extracting ? <LoaderCircle size={14} className="animate-spin mr-1" /> : null}
              {extracting ? "Analysiere..." : "Farben extrahieren"}
            </Button>
          </div>
          {extractError && <p className="text-red-400 text-xs">{extractError}</p>}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-white/60 text-xs">Primärfarbe</Label>
              <div className="flex gap-2 items-center">
                <input
                  type="color"
                  value={brandPrimaryColor}
                  onChange={(e) => setBrandPrimaryColor(e.target.value)}
                  className="w-8 h-8 rounded border border-white/20 bg-transparent cursor-pointer"
                />
                <Input
                  className="bg-white/5 border-white/10 text-white font-mono text-xs h-8"
                  value={brandPrimaryColor}
                  onChange={(e) => setBrandPrimaryColor(e.target.value)}
                  maxLength={7}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-white/60 text-xs">Sekundärfarbe</Label>
              <div className="flex gap-2 items-center">
                <input
                  type="color"
                  value={brandSecondaryColor}
                  onChange={(e) => setBrandSecondaryColor(e.target.value)}
                  className="w-8 h-8 rounded border border-white/20 bg-transparent cursor-pointer"
                />
                <Input
                  className="bg-white/5 border-white/10 text-white font-mono text-xs h-8"
                  value={brandSecondaryColor}
                  onChange={(e) => setBrandSecondaryColor(e.target.value)}
                  maxLength={7}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Ansprache */}
      <section className="space-y-4">
        <h2 className="text-sm font-medium text-white/70 uppercase tracking-wider">Ansprache</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-white/60 text-sm">Anzeigename</Label>
            <Input
              className="bg-white/5 border-white/10 text-white"
              value={greetingName}
              onChange={(e) => setGreetingName(e.target.value)}
              placeholder="z.B. Günther"
            />
            <p className="text-white/30 text-xs">So spricht Sophie Sie an.</p>
          </div>
          <div className="space-y-2">
            <Label className="text-white/60 text-sm">Stil</Label>
            <div className="flex gap-2">
              {(["formal", "informal"] as FormalityLevel[]).map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setFormality(level)}
                  className={cn(
                    "flex-1 py-2 rounded-lg border text-sm font-medium transition-all",
                    formality === level
                      ? "bg-[#C9A962] border-[#C9A962] text-black"
                      : "bg-white/5 border-white/10 text-white/50 hover:border-white/30",
                  )}
                >
                  {level === "formal" ? "Sie" : "Du"}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Sprache & Zeitzone */}
      <section className="space-y-4">
        <h2 className="text-sm font-medium text-white/70 uppercase tracking-wider">Sprache & Region</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-white/60 text-sm">Sprache</Label>
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
            <Label className="text-white/60 text-sm">Zeitzone</Label>
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
      </section>

      {/* E-Mail-Beispiele */}
      <section className="space-y-4">
        <h2 className="text-sm font-medium text-white/70 uppercase tracking-wider">E-Mail-Stil-Beispiele</h2>
        <p className="text-white/40 text-xs">
          Fügen Sie Beispiel-E-Mails ein, an denen Sophie Ihren Schreibstil erkennt.
        </p>
        <div className="space-y-3">
          {emailExamples.map((example, idx) => (
            <div key={idx} className="group relative bg-white/5 border border-white/10 rounded-lg p-3">
              <p className="text-white/70 text-xs font-mono whitespace-pre-wrap line-clamp-3">{example}</p>
              <button
                type="button"
                onClick={() => removeExample(idx)}
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-white/30 hover:text-red-400"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          <div className="space-y-2">
            <Textarea
              className="min-h-[100px] bg-white/5 border-white/10 text-white placeholder:text-white/20 font-mono text-xs"
              placeholder={"Sehr geehrte Damen und Herren,\nvielen Dank für Ihre Nachricht..."}
              value={newExample}
              onChange={(e) => setNewExample(e.target.value)}
            />
            <Button
              variant="outline"
              size="sm"
              className="border-white/20 text-white/60 hover:text-white"
              onClick={addExample}
              disabled={!newExample.trim()}
            >
              <Plus size={14} className="mr-1" />
              Beispiel hinzufügen
            </Button>
          </div>
        </div>
      </section>

      {/* Save */}
      <div className="flex items-center gap-3 pt-2">
        <Button
          className="bg-[#C9A962] hover:bg-[#C9A962]/80 text-black font-medium"
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
        >
          {saveMutation.isPending ? (
            <LoaderCircle size={16} className="animate-spin mr-2" />
          ) : (
            <Save size={16} className="mr-2" />
          )}
          Speichern
        </Button>
        {saved && <span className="text-green-400 text-sm">Gespeichert</span>}
        {saveMutation.error && (
          <span className="text-red-400 text-sm">{String(saveMutation.error)}</span>
        )}
      </div>
    </div>
  );
}
