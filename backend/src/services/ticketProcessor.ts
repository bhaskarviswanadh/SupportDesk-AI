import { prisma } from "../lib/prisma.js";
import { AIEngine } from "./aiEngine.js";
import { FreshdeskClient } from "./freshdeskClient.js";

type TicketPayload = {
  id?: number;
  subject?: string;
  description?: string;
  requester_id?: string | number;
  priority?: number;
};

type AiResult = {
  tier: string;
  confidence: number;
  category: string;
  autoResolvable: boolean;
  escalationNeeded: boolean;
  response: string;
  escalationReason: string | null;
};

export class TicketProcessor {
  constructor(
    private ai: AIEngine,
    private freshdesk: FreshdeskClient
  ) {}

  async processNewTicket(ticketData: TicketPayload) {
    try {
      const tid = ticketData.id;
      if (tid == null) {
        return { success: false, error: "Missing ticket id" };
      }

      console.log(`Processing ticket ${tid}`);
      const subject = ticketData.subject ?? "";
      const desc = ticketData.description ?? "";
      const email = ticketData.requester_id;
      const priority = ticketData.priority ?? 1;

      const { tier, confidence, category } = this.ai.categorizeTicket(
        subject,
        desc
      );
      const autoResolve = tier === "tier_1" && confidence > 0.6;
      const needsEscalation = tier === "complex" || confidence < 0.5;
      const response = await this.ai.getRagResponse(`${subject} ${desc}`);

      const aiResult: AiResult = {
        tier,
        confidence,
        category,
        autoResolvable: autoResolve,
        escalationNeeded: needsEscalation,
        response,
        escalationReason: needsEscalation ? "Complex issue" : null,
      };

      const ticket = await this.saveTicket(
        tid,
        subject,
        desc,
        email,
        priority,
        aiResult
      );

      if (autoResolve) {
        await this.autoResolve(tid, aiResult);
      } else if (needsEscalation) {
        await this.escalate(tid, aiResult);
      } else {
        await this.handleTier2(tid, aiResult);
      }

      await this.logAction(
        ticket.id,
        "processed",
        `Classified as ${tier} with ${Math.round(confidence * 100)}% confidence`
      );

      return {
        success: true,
        ticket_id: tid,
        tier,
        confidence,
        category,
        auto_resolved: autoResolve,
        escalated: needsEscalation,
        response,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Processing failed: ${message}`);
      return { success: false, error: message };
    }
  }

  private async saveTicket(
    tid: number,
    subject: string,
    desc: string,
    email: string | number | undefined,
    priority: number,
    aiResult: AiResult
  ) {
    return prisma.ticket.upsert({
      where: { freshdeskId: tid },
      create: {
        freshdeskId: tid,
        subject,
        description: desc,
        customerEmail: email != null ? String(email) : null,
        priority,
        category: aiResult.category,
        tier: aiResult.tier,
        confidenceScore: aiResult.confidence,
        autoResolved: aiResult.autoResolvable,
        escalationReason: aiResult.escalationReason,
        botResponse: aiResult.response,
      },
      update: {
        subject,
        description: desc,
        customerEmail: email != null ? String(email) : null,
        priority,
        category: aiResult.category,
        tier: aiResult.tier,
        confidenceScore: aiResult.confidence,
        autoResolved: aiResult.autoResolvable,
        escalationReason: aiResult.escalationReason,
        botResponse: aiResult.response,
      },
    });
  }

  private async autoResolve(tid: number, aiResult: AiResult) {
    try {
      console.log(`Auto-resolving ticket ${tid}`);
      await this.freshdesk.addNoteToTicket(tid, aiResult.response, false);
      await this.freshdesk.autoResolveTicket(tid, aiResult.response);
      await prisma.ticket.update({
        where: { freshdeskId: tid },
        data: { status: "resolved", autoResolved: true },
      });
    } catch (err) {
      console.error(`Auto-resolve failed for ${tid}:`, err);
    }
  }

  private async escalate(tid: number, aiResult: AiResult) {
    try {
      console.log(`Escalating ticket ${tid}`);
      const reason = aiResult.escalationReason ?? "Needs human attention";
      const note = `ESCALATED\n\nReason: ${reason}\n\nTier: ${aiResult.tier}\nConfidence: ${Math.round(aiResult.confidence * 100)}%\n\n${aiResult.response}`;
      await this.freshdesk.addNoteToTicket(tid, note, true);
      await this.freshdesk.escalateTicket(tid, reason);
      await prisma.ticket.update({
        where: { freshdeskId: tid },
        data: { status: "escalated", assignedTo: "human_agent" },
      });
    } catch (err) {
      console.error(`Escalation failed for ${tid}:`, err);
    }
  }

  private async handleTier2(tid: number, aiResult: AiResult) {
    try {
      console.log(`Handling tier 2 ticket ${tid}`);
      await this.freshdesk.addNoteToTicket(tid, aiResult.response, false);
      await this.freshdesk.updateTicketStatus(tid, 3);
      await prisma.ticket.update({
        where: { freshdeskId: tid },
        data: { status: "pending" },
      });
    } catch (err) {
      console.error(`Tier 2 handling failed for ${tid}:`, err);
    }
  }

  private async logAction(ticketId: number, action: string, details: string) {
    try {
      await prisma.ticketHistory.create({
        data: { ticketId, action, details },
      });
    } catch (err) {
      console.error("Logging failed:", err);
    }
  }

  async getTicketStats() {
    try {
      const [total, autoResolved, escalated, pending] = await Promise.all([
        prisma.ticket.count(),
        prisma.ticket.count({ where: { autoResolved: true } }),
        prisma.ticket.count({ where: { status: "escalated" } }),
        prisma.ticket.count({ where: { status: "pending" } }),
      ]);

      return {
        total_tickets: total,
        auto_resolved: autoResolved,
        escalated,
        pending,
        auto_resolution_rate: total > 0 ? (autoResolved / total) * 100 : 0,
      };
    } catch (err) {
      console.error("Stats error:", err);
      return {};
    }
  }

  async reprocessTicket(ticketId: number) {
    try {
      const ticketData = await this.freshdesk.getTicket(ticketId);
      if (!ticketData) {
        return { success: false, error: "Ticket not found" };
      }
      return this.processNewTicket(ticketData as TicketPayload);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Reprocess failed for ${ticketId}: ${message}`);
      return { success: false, error: message };
    }
  }

  async getTicketAnalytics() {
    try {
      const [tier1, tier2, complexTickets, scores, recent] = await Promise.all([
        prisma.ticket.count({ where: { tier: "tier_1" } }),
        prisma.ticket.count({ where: { tier: "tier_2" } }),
        prisma.ticket.count({ where: { tier: "complex" } }),
        prisma.ticket.findMany({
          where: { confidenceScore: { not: null } },
          select: { confidenceScore: true },
        }),
        prisma.ticket.findMany({
          orderBy: { createdAt: "desc" },
          take: 10,
        }),
      ]);

      const avgConf =
        scores.length > 0
          ? scores.reduce((sum, s) => sum + (s.confidenceScore ?? 0), 0) /
            scores.length
          : 0;

      return {
        tier_distribution: {
          tier_1: tier1,
          tier_2: tier2,
          complex: complexTickets,
        },
        average_confidence: avgConf,
        recent_tickets: recent.map((t) => ({
          id: t.freshdeskId,
          subject: t.subject,
          tier: t.tier,
          status: t.status,
          created_at: t.createdAt.toISOString(),
        })),
      };
    } catch (err) {
      console.error("Analytics error:", err);
      return {};
    }
  }
}
