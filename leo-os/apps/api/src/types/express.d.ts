import "express-session";

declare module "express-session" {
  interface SessionData {
    authenticated?: boolean;
    userId?: number;
    role?: string;
    userEmail?: string;
    userName?: string;
    linkedEntityId?: string;
  }
}

declare global {
  namespace Express {
    interface Request {
      log: import("pino").Logger;
    }
  }
}

export {};
