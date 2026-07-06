import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pino from "pino";
import pinoHttp from "pino-http";
import authRouter from "./routes/auth.js";
import adminUsersRouter from "./routes/admin-users.js";
import adminPermissionsRouter from "./routes/admin-permissions.js";
import companiesRouter from "./routes/companies.js";
import clientsRouter from "./routes/clients.js";
import expenseCategoriesRouter from "./routes/expense-categories.js";
import expensesRouter from "./routes/expenses.js";
import billingRouter, { billingPublicRouter } from "./routes/billing.js";
import loaRouter, { loaPublicRouter } from "./routes/loa.js";
import loaOptionsRouter from "./routes/loa-options.js";
import passwordsRouter from "./routes/passwords.js";
import tasksRouter from "./routes/tasks.js";
import publicProfileRouter from "./routes/public-profile.js";
import salaryRecordsRouter from "./routes/salary-records.js";
import passportsRouter from "./routes/passports.js";
import xpatRouter from "./routes/xpat.js";
import systemRouter from "./routes/system.js";
import publicReadsRouter from "./routes/public-reads.js";
import { createSessionMiddleware } from "./lib/session.js";
import { requireAuth, requireRole } from "./middleware/require-auth.js";
import { permissionsMiddleware } from "./lib/permissions.js";

const logger = pino({ level: process.env["LOG_LEVEL"] ?? "info" });

const authed = [requireAuth, permissionsMiddleware] as const;

function parseCorsOrigins(value: string | undefined) {
  if (!value) return true;
  const origins = value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (origins.length === 0) return true;
  if (origins.length === 1) return origins[0];
  return origins;
}

export function createApp() {
  const app = express();
  app.set("trust proxy", 1);

  const corsOrigin = parseCorsOrigins(process.env["CORS_ORIGIN"]);
  app.use(
    cors({
      origin: corsOrigin,
      credentials: true,
    }),
  );

  app.use(express.json({ limit: "8mb" }));
  app.use(cookieParser());
  app.use(createSessionMiddleware());

  app.use(
    pinoHttp({
      logger,
      autoLogging: {
        ignore: (req) => req.url === "/api/health",
      },
    }),
  );

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/healthz", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/api", authRouter);
  app.use("/api", systemRouter);

  app.use("/api", billingPublicRouter);
  app.use("/api", loaPublicRouter);
  app.use("/api", publicProfileRouter);
  app.use("/api", publicReadsRouter);

  app.use("/api", requireAuth, permissionsMiddleware, passportsRouter);

  app.use("/api", ...authed, requireRole("admin", "superuser"), adminUsersRouter);
  app.use("/api", ...authed, requireRole("superuser"), adminPermissionsRouter);

  app.use("/api", ...authed, companiesRouter);
  app.use("/api", ...authed, clientsRouter);
  app.use("/api", ...authed, expenseCategoriesRouter);
  app.use("/api", ...authed, expensesRouter);
  app.use("/api", ...authed, billingRouter);
  app.use("/api", ...authed, loaRouter);
  app.use("/api", ...authed, loaOptionsRouter);
  app.use("/api", ...authed, requireRole("admin", "superuser"), passwordsRouter);
  app.use("/api", ...authed, tasksRouter);
  app.use("/api", ...authed, salaryRecordsRouter);
  app.use("/api", ...authed, xpatRouter);

  app.use((_req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  app.use(
    (
      err: Error,
      req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      req.log.error({ err }, "Unhandled error");
      res.status(500).json({ error: "Internal server error" });
    },
  );

  return app;
}
