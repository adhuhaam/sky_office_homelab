import connectPgSimple from "connect-pg-simple";
import session from "express-session";
import { getPool } from "@leo/db";

const PgSession = connectPgSimple(session);

/** Skip per-request session expiry writes — prevents Postgres row lock storms on parallel API calls. */
const SESSION_TOUCH_AFTER_SEC = 3600;

export const store = new PgSession({
  pool: getPool(),
  tableName: "session",
  createTableIfMissing: true,
  disableTouch: true,
  touchAfter: SESSION_TOUCH_AFTER_SEC,
});

export function createSessionMiddleware() {
  const secret = process.env["SESSION_SECRET"];
  if (!secret) {
    throw new Error("SESSION_SECRET is required");
  }

  const cookieSecure = process.env["COOKIE_SECURE"] === "true";

  return session({
    store,
    name: "leo.sid",
    secret,
    resave: false,
    saveUninitialized: false,
    rolling: false,
    cookie: {
      httpOnly: true,
      secure: cookieSecure ? "auto" : false,
      sameSite: cookieSecure ? "lax" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  });
}
