import type { Request, Response, NextFunction } from "express";
import { store } from "../lib/session.js";

function populateFromBearerToken(
  req: Request,
  callback: (ok: boolean) => void,
): void {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    callback(false);
    return;
  }
  const sessionId = auth.slice(7).trim();
  if (!sessionId) {
    callback(false);
    return;
  }
  store.get(sessionId, (err, sessionData) => {
    if (err || !sessionData?.authenticated) {
      callback(false);
      return;
    }
    req.session.authenticated = true;
    req.session.userId = sessionData.userId;
    req.session.role = sessionData.role;
    req.session.userEmail = sessionData.userEmail;
    req.session.userName = sessionData.userName;
    req.session.linkedEntityId = sessionData.linkedEntityId;
    callback(true);
  });
}

export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (req.session?.authenticated) {
    next();
    return;
  }
  populateFromBearerToken(req, (ok) => {
    if (ok) {
      next();
    } else {
      res.status(401).json({ error: "Authentication required" });
    }
  });
}

export function requireRole(
  ...roles: string[]
): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction): void => {
    const check = (authenticated: boolean) => {
      if (!authenticated) {
        res.status(401).json({ error: "Authentication required" });
        return;
      }
      const userRole = req.session.role ?? "";
      if (!roles.includes(userRole)) {
        res.status(403).json({ error: "Insufficient permissions" });
        return;
      }
      next();
    };

    if (req.session?.authenticated) {
      check(true);
    } else {
      populateFromBearerToken(req, check);
    }
  };
}

export { populateFromBearerToken };
