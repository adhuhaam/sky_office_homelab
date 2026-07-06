import { Router, type IRouter } from "express";
import type { Request, Response as ExpressResponse } from "express";
import {
  fetchXpatCard,
  fetchXpatPhoto,
  fetchXpatWorkPermit,
} from "../lib/xpat.js";

const router: IRouter = Router();

const ID_RE = /^[a-zA-Z0-9_-]+$/;

function requireQueryPair(
  req: Request,
  res: ExpressResponse,
): { workPermitNumber: string; passportNumber: string } | null {
  const workPermitNumber = String(req.query.workPermitNumber ?? "").trim();
  const passportNumber = String(req.query.passportNumber ?? "").trim();
  if (!workPermitNumber || !passportNumber) {
    res.status(400).json({ error: "workPermitNumber and passportNumber are required" });
    return null;
  }
  return { workPermitNumber, passportNumber };
}

router.get("/xpat/work-permit", async (req, res): Promise<void> => {
  const params = requireQueryPair(req, res);
  if (!params) return;

  let data;
  try {
    data = await fetchXpatWorkPermit(params.workPermitNumber, params.passportNumber);
  } catch (err) {
    req.log.error({ err }, "Xpat API unreachable");
    res.status(502).json({ error: "Xpat API unreachable" });
    return;
  }

  if (!data) {
    res.status(502).json({ error: "Xpat API error" });
    return;
  }

  res.setHeader("Cache-Control", "public, max-age=900");
  res.json(data);
});

router.get("/xpat/photo", async (req, res): Promise<void> => {
  const photoId = String(req.query.photoId ?? "").trim();
  const serviceId = String(req.query.serviceId ?? "").trim();

  if (!photoId || !serviceId || !ID_RE.test(photoId) || !ID_RE.test(serviceId)) {
    res.status(400).json({ error: "photoId and serviceId are required" });
    return;
  }

  let result;
  try {
    result = await fetchXpatPhoto(photoId, serviceId);
  } catch (err) {
    req.log.error({ err }, "Xpat photo fetch failed");
    res.status(502).end();
    return;
  }

  if (!result) {
    res.status(502).end();
    return;
  }

  res.setHeader("Content-Type", result.contentType);
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.send(result.buffer);
});

router.get("/xpat/card", async (req, res): Promise<void> => {
  const params = requireQueryPair(req, res);
  if (!params) return;

  let result;
  try {
    result = await fetchXpatCard(params.workPermitNumber, params.passportNumber);
  } catch (err) {
    req.log.error({ err }, "Xpat card fetch failed");
    res.status(502).end();
    return;
  }

  if (!result) {
    res.status(502).end();
    return;
  }

  res.setHeader("Content-Type", result.contentType);
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.send(result.buffer);
});

export default router;
