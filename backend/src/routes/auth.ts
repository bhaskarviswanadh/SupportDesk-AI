import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, signToken, type AuthedRequest } from "../middleware/auth.js";

const registerSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(6).max(128),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function publicUser(user: { id: number; name: string; email: string; createdAt: Date }) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt.toISOString(),
  };
}

export function createAuthRoutes(): Router {
  const router = Router();

  router.post("/register", async (req, res) => {
    try {
      const parsed = registerSchema.parse(req.body);
      const email = parsed.email.toLowerCase().trim();

      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        res.status(409).json({ detail: "An account with this email already exists" });
        return;
      }

      const passwordHash = await bcrypt.hash(parsed.password, 10);
      const user = await prisma.user.create({
        data: {
          name: parsed.name.trim(),
          email,
          passwordHash,
        },
      });

      const token = signToken({
        id: user.id,
        email: user.email,
        name: user.name,
      });

      res.status(201).json({
        token,
        user: publicUser(user),
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ detail: "Invalid registration data", errors: err.flatten() });
        return;
      }
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ detail: message });
    }
  });

  router.post("/login", async (req, res) => {
    try {
      const parsed = loginSchema.parse(req.body);
      const email = parsed.email.toLowerCase().trim();

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        res.status(401).json({ detail: "Invalid email or password" });
        return;
      }

      const ok = await bcrypt.compare(parsed.password, user.passwordHash);
      if (!ok) {
        res.status(401).json({ detail: "Invalid email or password" });
        return;
      }

      const token = signToken({
        id: user.id,
        email: user.email,
        name: user.name,
      });

      res.json({
        token,
        user: publicUser(user),
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ detail: "Invalid login data", errors: err.flatten() });
        return;
      }
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ detail: message });
    }
  });

  router.get("/me", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user!.id },
      });
      if (!user) {
        res.status(404).json({ detail: "User not found" });
        return;
      }
      res.json({ user: publicUser(user) });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ detail: message });
    }
  });

  return router;
}
