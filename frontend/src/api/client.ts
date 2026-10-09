const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";
const TOKEN_KEY = "supportdesk_token";

function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
  });

  if (res.status === 401 && !path.startsWith("/auth/")) {
    localStorage.removeItem(TOKEN_KEY);
    if (!window.location.pathname.startsWith("/login") &&
        !window.location.pathname.startsWith("/register")) {
      window.location.assign("/login");
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const detail =
      typeof body.detail === "string"
        ? body.detail
        : JSON.stringify(body.detail ?? body);
    throw new Error(detail || `Request failed (${res.status})`);
  }

  return res.json() as Promise<T>;
}

export type AuthUser = {
  id: number;
  name: string;
  email: string;
  createdAt: string;
};

export type HealthResponse = {
  status: string;
  database: string;
  freshdesk: string;
  ai: {
    ready: boolean;
    docsLoaded: number;
    embeddingsReady: boolean;
    embeddingModel: string;
    embeddingProvider?: string;
    geminiConfigured?: boolean;
    geminiModel?: string;
  };
  timestamp: string;
};

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type StatsResponse = {
  total_tickets: number;
  auto_resolved: number;
  escalated: number;
  pending: number;
  auto_resolution_rate: number;
};

export type AnalyticsResponse = {
  tier_distribution: {
    tier_1: number;
    tier_2: number;
    complex: number;
  };
  average_confidence: number;
  recent_tickets: Array<{
    id: number;
    subject: string;
    tier: string | null;
    status: string;
    created_at: string;
  }>;
};

export type TicketSummary = {
  id: number;
  freshdesk_id: number;
  subject: string;
  category: string | null;
  tier: string | null;
  confidence_score: number | null;
  auto_resolved: boolean;
  status: string;
  created_at: string;
  updated_at: string;
};

export type TicketDetail = TicketSummary & {
  description: string;
  escalation_reason: string | null;
  bot_response: string | null;
};

export type PublicConfig = {
  freshdeskDomain: string | null;
  freshdeskApiKeySet: boolean;
  freshdeskApiKeyMasked: string | null;
  geminiConfigured: boolean;
  geminiModel: string;
  embeddingModel: string;
  corsOrigin: string;
  port: number;
};

export const api = {
  register: (name: string, email: string, password: string) =>
    request<{ token: string; user: AuthUser }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    }),
  login: (email: string, password: string) =>
    request<{ token: string; user: AuthUser }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  me: () => request<{ user: AuthUser }>("/auth/me"),
  health: () => request<HealthResponse>("/health"),
  stats: () => request<StatsResponse>("/stats"),
  analytics: () => request<AnalyticsResponse>("/analytics"),
  config: () => request<PublicConfig>("/config/public"),
  tickets: (limit = 50, offset = 0) =>
    request<{ tickets: TicketSummary[]; total: number }>(
      `/tickets?limit=${limit}&offset=${offset}`
    ),
  ticket: (id: number) => request<TicketDetail>(`/tickets/${id}`),
  classify: (subject: string, description: string) =>
    request<{ tier: string; confidence: number; category: string }>(
      "/classify",
      {
        method: "POST",
        body: JSON.stringify({ subject, description }),
      }
    ),
  testTicket: (subject: string, description: string, priority = 1) =>
    request<{
      success: boolean;
      test_ticket: unknown;
      processing_result: {
        success: boolean;
        tier?: string;
        confidence?: number;
        category?: string;
        auto_resolved?: boolean;
        escalated?: boolean;
        response?: string;
        error?: string;
      };
    }>("/test-ticket", {
      method: "POST",
      body: JSON.stringify({ subject, description, priority }),
    }),
  rag: (query: string) =>
    request<{ query: string; response: string }>("/rag", {
      method: "POST",
      body: JSON.stringify({ query }),
    }),
  chat: (messages: ChatMessage[]) =>
    request<{ reply: string; grounded: boolean }>("/chat", {
      method: "POST",
      body: JSON.stringify({ messages }),
    }),
  reprocess: (ticketId: number) =>
    request<Record<string, unknown>>("/reprocess-ticket", {
      method: "POST",
      body: JSON.stringify({ ticket_id: ticketId }),
    }),
};
