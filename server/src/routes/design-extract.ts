import { Router } from "express";
import { z } from "zod";
import { assertBoard, assertCompanyAccess } from "./authz.js";

const extractRequestSchema = z.object({
  url: z.string().url(),
});

function extractHexColors(text: string): string[] {
  const hexRe = /#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g;
  const found = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = hexRe.exec(text)) !== null) {
    const raw = m[1]!;
    const hex = raw.length === 3 ? raw.split("").map((c) => c + c).join("") : raw;
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    const lum = (r * 299 + g * 587 + b * 114) / 1000;
    if (lum > 20 && lum < 235) {
      found.add(`#${hex.toLowerCase()}`);
    }
  }
  return [...found];
}

function rankColors(colors: string[]): string[] {
  return colors
    .map((hex) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const saturation = max === 0 ? 0 : (max - min) / max;
      return { hex, saturation };
    })
    .sort((a, b) => b.saturation - a.saturation)
    .map((c) => c.hex);
}

function extractCssVarColors(text: string): Record<string, string> {
  const varRe = /--([a-zA-Z0-9-]+)\s*:\s*(#[0-9a-fA-F]{3,6})/g;
  const result: Record<string, string> = {};
  let m: RegExpExecArray | null;
  while ((m = varRe.exec(text)) !== null) {
    result[m[1]!] = m[2]!;
  }
  return result;
}

function extractLogoUrl(html: string, baseUrl: string): string | null {
  const patterns = [
    /property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
    /class=["'][^"']*logo[^"']*["'][^>]+src=["']([^"']+)["']/i,
    /src=["']([^"']*logo[^"']*)["']/i,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) {
      const src = m[1];
      if (src.startsWith("http")) return src;
      try { return new URL(src, baseUrl).toString(); } catch { /* skip */ }
    }
  }
  return null;
}

function extractSiteName(html: string): string | null {
  const ogSiteM = html.match(/property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i)
    ?? html.match(/content=["']([^"']+)["'][^>]+property=["']og:site_name["']/i);
  if (ogSiteM?.[1]) return ogSiteM[1].trim();
  const titleM = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleM?.[1]) return titleM[1].trim().split(/[|\-–]/)[0]?.trim() ?? null;
  return null;
}

export function designExtractRoutes() {
  const router = Router();

  router.post("/companies/:companyId/design-extract", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    assertBoard(req);

    const parsed = extractRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "url must be a valid URL" });
      return;
    }

    const { url } = parsed.data;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      let html: string;
      try {
        const response = await fetch(url, {
          signal: controller.signal,
          headers: { "User-Agent": "Mozilla/5.0 (compatible; RocksteinAIOS/1.0)" },
        });
        html = await response.text();
      } finally {
        clearTimeout(timeout);
      }

      const allColors = extractHexColors(html);
      const cssVars = extractCssVarColors(html);

      const knownPrimaryKeys = ["primary", "primary-color", "color-primary", "accent", "brand", "brand-primary"];
      const knownSecondaryKeys = ["secondary", "secondary-color", "color-secondary", "brand-secondary"];

      let primaryFromVar: string | null = null;
      let secondaryFromVar: string | null = null;
      for (const k of knownPrimaryKeys) { if (cssVars[k]) { primaryFromVar = cssVars[k]!; break; } }
      for (const k of knownSecondaryKeys) { if (cssVars[k]) { secondaryFromVar = cssVars[k]!; break; } }

      const ranked = rankColors(allColors);
      const topColors = ranked.slice(0, 6);

      res.json({
        url,
        siteName: extractSiteName(html),
        primaryColor: primaryFromVar ?? topColors[0] ?? null,
        secondaryColor: secondaryFromVar ?? topColors[1] ?? null,
        logoUrl: extractLogoUrl(html, url),
        topColors,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(502).json({ error: `Konnte URL nicht abrufen: ${msg}` });
    }
  });

  return router;
}
