import { Router, type Request, type Response } from "express";
import crypto from "crypto";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { config } from "../config.js";
import { requireAuth } from "../middleware/auth.js";
import { createAuthRoutes } from "./auth.js";
import type { AIEngine } from "../services/aiEngine.js";
import type { FreshdeskClient } from "../services/freshdeskClient.js";
import type { TicketProcessor } from "../services/ticketProcessor.js";
import type { GeminiChatService } from "../services/geminiChat.js";

type Deps = {
  processor: TicketProcessor;
  ai: AIEngine;
  freshdesk: FreshdeskClient;
  gemini: GeminiChatService;
};

const testTicketSchema = z.object({
  subject: z.string().min(1),
  description: z.string().min(1),
  priority: z.number().int().min(1).max(4).optional().default(1),
});

const reprocessSchema = z.object({
  ticket_id: z.number().int().positive(),
});

const ragSchema = z.object({
  query: z.string().min(1),
});

const classifySchema = z.object({
  subject: z.string().min(1),
  description: z.string().min(1),
});

const chatSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(8000),
      })
    )
    .min(1)
    .max(20),
});

export function createRoutes(deps: Deps): Router {
  const router = Router();
  const { processor, ai, freshdesk, gemini } = deps;

  router.use("/auth", createAuthRoutes());

  router.get("/", (_req, res) => {
    res.json({
      message: "Customer Ticket Resolution Bot",
      version: "2.0.0",
      status: "running",
      timestamp: new Date().toISOString(),
    });
  });

  router.get("/health", async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      const freshdeskOk = await freshdesk.testConnection();
      res.json({
        status: "healthy",
        database: "connected",
        freshdesk: freshdeskOk
          ? "connected"
          : freshdesk.isConfigured
            ? "disconnected"
            : "not_configured",
        ai: {
          ...ai.status,
          ...gemini.status,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ status: "unhealthy", detail: message });
    }
  });

  router.post("/webhook/freshdesk", async (req: Request, res: Response) => {
    try {
      const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
      const bodyBuffer = rawBody ?? Buffer.from(JSON.stringify(req.body));

      if (config.freshdesk.webhookSecret) {
        const secretHeader = req.headers["x-webhook-secret"];
        const sig =
          (req.headers["x-freshdesk-signature"] as string | undefined) ||
          (req.headers["x-webhook-signature"] as string | undefined) ||
          (req.headers["x-signature"] as string | undefined);

        let verified = false;

        if (typeof secretHeader === "string") {
          if (secretHeader === config.freshdesk.webhookSecret) {
            verified = true;
          } else {
            res.status(401).json({ detail: "Invalid webhook secret" });
            return;
          }
        } else if (sig) {
          const expected = crypto
            .createHmac("sha256", config.freshdesk.webhookSecret)
            .update(bodyBuffer)
            .digest("hex");
          if (sig === expected) {
            verified = true;
          } else {
            res.status(401).json({ detail: "Invalid signature" });
            return;
          }
        }

        if (!verified) {
          res.status(401).json({
            detail: "Webhook authentication required (secret or signature)",
          });
          return;
        }
      }

      const data = req.body as Record<string, unknown>;
      let ticketInfo: Record<string, unknown> | null = null;

      const webhook = data.freshdesk_webhook as
        | { ticket_id?: number }
        | undefined;
      if (webhook?.ticket_id) {
        const fetched = await freshdesk.getTicket(webhook.ticket_id);
        if (!fetched) {
          res.json({ status: "error", reason: "Failed to fetch ticket" });
          return;
        }
        ticketInfo = fetched;
      } else if (data.ticket && typeof data.ticket === "object") {
        ticketInfo = data.ticket as Record<string, unknown>;
      } else if (data.id && data.subject) {
        ticketInfo = data;
      } else {
        res.json({ status: "ignored", reason: "Not a ticket event" });
        return;
      }

      const ticketId = ticketInfo.id;
      setImmediate(() => {
        void processor.processNewTicket(ticketInfo as never);
      });

      res.json({ status: "processing", ticket_id: ticketId });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("Webhook error:", message);
      res.status(500).json({ detail: message });
    }
  });

  // Everything below requires a logged-in user
  router.use(requireAuth);

  router.get("/config/public", (_req, res) => {
    const key = config.freshdesk.apiKey;
    res.json({
      freshdeskDomain: config.freshdesk.domain || null,
      freshdeskApiKeySet: Boolean(key),
      freshdeskApiKeyMasked: key
        ? `${key.slice(0, 4)}${"*".repeat(Math.max(0, key.length - 8))}${key.slice(-4)}`
        : null,
      hfConfigured: Boolean(config.hf.apiToken),
      embeddingModel: config.hf.embeddingModel,
      geminiConfigured: gemini.isConfigured,
      geminiModel: config.gemini.model,
      corsOrigin: config.corsOrigin,
      port: config.port,
    });
  });

  router.post("/chat", async (req, res) => {
    try {
      const parsed = chatSchema.parse(req.body);
      const result = await gemini.chat(parsed.messages);
      res.json(result);
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ detail: err.flatten() });
        return;
      }
      const message = err instanceof Error ? err.message : String(err);
      const status = message.includes("not configured") ? 503 : 500;
      res.status(status).json({ detail: message });
    }
  });

  router.post("/test-ticket", async (req, res) => {
    try {
      const parsed = testTicketSchema.parse(req.body);
      const uniqueId = Date.now() * 1000 + Math.floor(Math.random() * 1000);
      const mockData = {
        id: uniqueId,
        subject: parsed.subject,
        description: parsed.description,
        requester_id: 12345,
        priority: parsed.priority,
        status: 2,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const result = await processor.processNewTicket(mockData);
      res.json({
        success: true,
        test_ticket: mockData,
        processing_result: result,
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ detail: err.flatten() });
        return;
      }
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ detail: message });
    }
  });

  router.post("/classify", (req, res) => {
    try {
      const parsed = classifySchema.parse(req.body);
      const result = ai.categorizeTicket(parsed.subject, parsed.description);
      res.json(result);
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ detail: err.flatten() });
        return;
      }
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ detail: message });
    }
  });

  router.post("/rag", async (req, res) => {
    try {
      const parsed = ragSchema.parse(req.body);
      const response = await ai.getRagResponse(parsed.query);
      res.json({ query: parsed.query, response });
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ detail: err.flatten() });
        return;
      }
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ detail: message });
    }
  });

  router.post("/reprocess-ticket", async (req, res) => {
    try {
      const parsed = reprocessSchema.parse(req.body);
      const result = await processor.reprocessTicket(parsed.ticket_id);
      if (!result.success) {
        res.status(400).json({ detail: result.error ?? "Reprocessing failed" });
        return;
      }
      res.json(result);
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ detail: err.flatten() });
        return;
      }
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ detail: message });
    }
  });

  router.get("/stats", async (_req, res) => {
    try {
      res.json(await processor.getTicketStats());
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ detail: message });
    }
  });

  router.get("/analytics", async (_req, res) => {
    try {
      res.json(await processor.getTicketAnalytics());
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ detail: message });
    }
  });

  router.get("/tickets", async (req, res) => {
    try {
      const limit = Math.min(Number(req.query.limit ?? 50), 200);
      const offset = Number(req.query.offset ?? 0);
      const [tickets, total] = await Promise.all([
        prisma.ticket.findMany({
          skip: offset,
          take: limit,
          orderBy: { createdAt: "desc" },
        }),
        prisma.ticket.count(),
      ]);

      res.json({
        tickets: tickets.map((t) => ({
          id: t.id,
          freshdesk_id: t.freshdeskId,
          subject: t.subject,
          category: t.category,
          tier: t.tier,
          confidence_score: t.confidenceScore,
          auto_resolved: t.autoResolved,
          status: t.status,
          created_at: t.createdAt.toISOString(),
          updated_at: t.updatedAt.toISOString(),
        })),
        total,
        limit,
        offset,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ detail: message });
    }
  });

  router.get("/tickets/:ticketId", async (req, res) => {
    try {
      const ticketId = Number(req.params.ticketId);
      const t = await prisma.ticket.findUnique({ where: { id: ticketId } });
      if (!t) {
        res.status(404).json({ detail: "Ticket not found" });
        return;
      }

      res.json({
        id: t.id,
        freshdesk_id: t.freshdeskId,
        subject: t.subject,
        description: t.description,
        category: t.category,
        tier: t.tier,
        confidence_score: t.confidenceScore,
        auto_resolved: t.autoResolved,
        escalation_reason: t.escalationReason,
        bot_response: t.botResponse,
        status: t.status,
        created_at: t.createdAt.toISOString(),
        updated_at: t.updatedAt.toISOString(),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ detail: message });
    }
  });

  return router;
}
