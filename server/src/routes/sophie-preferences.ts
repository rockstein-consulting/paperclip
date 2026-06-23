import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { sophiePreferenceKeySchema, upsertSophiePreferenceSchema } from "@paperclipai/shared";
import { validate } from "../middleware/validate.js";
import { sophiePreferencesService } from "../services/sophie-preferences.js";
import { assertBoard, assertCompanyAccess } from "./authz.js";

function requireBoardUserId(req: import("express").Request, res: import("express").Response): string | null {
  assertBoard(req);
  if (!req.actor.userId) {
    res.status(403).json({ error: "Board user context required" });
    return null;
  }
  return req.actor.userId;
}

export function sophiePreferenceRoutes(db: Db) {
  const router = Router();
  const svc = sophiePreferencesService(db);

  router.get("/companies/:companyId/sophie-preferences/me", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const userId = requireBoardUserId(req, res);
    if (!userId) return;
    const prefs = await svc.getAll(userId, companyId);
    res.json(prefs);
  });

  router.get("/companies/:companyId/sophie-preferences/me/map", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const userId = requireBoardUserId(req, res);
    if (!userId) return;
    const map = await svc.getMap(userId, companyId);
    res.json(map);
  });

  router.put(
    "/companies/:companyId/sophie-preferences/me/:key",
    validate(upsertSophiePreferenceSchema),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      const userId = requireBoardUserId(req, res);
      if (!userId) return;
      const keyParsed = sophiePreferenceKeySchema.safeParse(req.params.key);
      if (!keyParsed.success) {
        res.status(400).json({ error: "Invalid preference key" });
        return;
      }
      const row = await svc.upsert(userId, companyId, keyParsed.data, req.body.value);
      res.json(row);
    },
  );

  router.put("/companies/:companyId/sophie-preferences/me", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const userId = requireBoardUserId(req, res);
    if (!userId) return;
    const body = req.body;
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      res.status(400).json({ error: "Body must be an object of key-value pairs" });
      return;
    }
    const rows = await svc.upsertMany(userId, companyId, body);
    res.json(rows);
  });

  router.delete("/companies/:companyId/sophie-preferences/me/:key", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const userId = requireBoardUserId(req, res);
    if (!userId) return;
    const keyParsed = sophiePreferenceKeySchema.safeParse(req.params.key);
    if (!keyParsed.success) {
      res.status(400).json({ error: "Invalid preference key" });
      return;
    }
    await svc.delete(userId, companyId, keyParsed.data);
    res.status(204).send();
  });

  return router;
}
