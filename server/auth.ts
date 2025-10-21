import type { Express, RequestHandler } from "express";
import session from "express-session";
import createMemoryStore from "memorystore";

const MemoryStore = createMemoryStore(session);

export function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  
  app.use(
    session({
      secret: process.env.SESSION_SECRET || 'dev-secret-key',
      store: new MemoryStore({
        checkPeriod: 86400000, // prune expired entries every 24h
      }),
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 1 week
      },
    })
  );
}

export const requireAuth: RequestHandler = (req, res, next) => {
  const session = req.session as any;
  
  if (!session.authenticated) {
    return res.status(401).json({ 
      success: false,
      error: "Unauthorized - Please log in" 
    });
  }
  
  next();
};
