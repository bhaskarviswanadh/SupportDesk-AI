import axios, { type AxiosInstance } from "axios";
import { config } from "../config.js";

export class FreshdeskClient {
  private client: AxiosInstance | null = null;
  private configured: boolean;

  constructor() {
    const { domain, apiKey } = config.freshdesk;
    this.configured = Boolean(domain && apiKey);

    if (!this.configured) {
      console.warn("Freshdesk not configured properly");
      return;
    }

    this.client = axios.create({
      baseURL: `https://${domain}.freshdesk.com/api/v2`,
      auth: { username: apiKey, password: "X" },
      headers: { "Content-Type": "application/json" },
      timeout: 30000,
    });
  }

  get isConfigured(): boolean {
    return this.configured;
  }

  private async request<T>(
    method: "GET" | "POST" | "PUT",
    endpoint: string,
    data?: unknown
  ): Promise<T | null> {
    if (!this.client) return null;

    try {
      const response = await this.client.request<T>({
        method,
        url: endpoint,
        data,
      });
      return response.data;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Freshdesk API error (${endpoint}): ${message}`);
      return null;
    }
  }

  getTicket(ticketId: number) {
    return this.request<Record<string, unknown>>("GET", `tickets/${ticketId}`);
  }

  updateTicket(ticketId: number, data: Record<string, unknown>) {
    return this.request<Record<string, unknown>>(
      "PUT",
      `tickets/${ticketId}`,
      data
    );
  }

  addNoteToTicket(ticketId: number, note: string, isPrivate = false) {
    return this.request("POST", `tickets/${ticketId}/notes`, {
      body: note,
      private: isPrivate,
    });
  }

  updateTicketStatus(ticketId: number, status: number) {
    return this.updateTicket(ticketId, { status });
  }

  resolveTicket(ticketId: number, resolutionNote = "") {
    return this.updateTicket(ticketId, {
      status: 5,
      resolution: resolutionNote,
    });
  }

  escalateTicket(ticketId: number, escalationReason: string) {
    const note = `ESCALATED\n\nReason: ${escalationReason}\n\nNeeds human intervention.`;
    void this.addNoteToTicket(ticketId, note, true);
    return this.updateTicket(ticketId, { priority: 3 });
  }

  autoResolveTicket(ticketId: number, botResponse: string) {
    const note = `AUTO-RESOLVED\n\n${botResponse}\n\nResolved by AI assistant.`;
    void this.addNoteToTicket(ticketId, note, false);
    return this.resolveTicket(ticketId, "Resolved by AI");
  }

  async testConnection(): Promise<boolean> {
    if (!this.configured) return false;
    const result = await this.request("GET", "tickets?per_page=1");
    return result !== null;
  }
}
