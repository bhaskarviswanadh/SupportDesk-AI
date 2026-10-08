import { GoogleGenerativeAI } from "@google/generative-ai";
import { config } from "../config.js";
import type { AIEngine } from "./aiEngine.js";

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const FALLBACK_MODELS = [
  "gemini-3.8-flash",
  "gemini-2.5-flash",
  "gemini-flash-latest",
  "gemini-1.5-flash-8b",
  "gemini-1.5-flash",
];

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return (
    message.includes("[503") ||
    message.includes("503") ||
    message.includes("[429") ||
    message.includes("429") ||
    message.includes("high demand") ||
    message.includes("Service Unavailable") ||
    message.includes("Too Many Requests") ||
    message.includes("overloaded")
  );
}

function isModelMissingError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return (
    message.includes("[404") ||
    message.includes("404") ||
    message.includes("no longer available") ||
    message.includes("not found")
  );
}

export class GeminiChatService {
  private client: GoogleGenerativeAI | null = null;

  constructor(private ai: AIEngine) {
    if (config.gemini.apiKey) {
      this.client = new GoogleGenerativeAI(config.gemini.apiKey);
    }
  }

  get isConfigured(): boolean {
    return Boolean(config.gemini.apiKey && this.client);
  }

  get status() {
    return {
      geminiConfigured: this.isConfigured,
      geminiModel: config.gemini.model,
    };
  }

  private modelCandidates(): string[] {
    const primary = config.gemini.model;
    return [primary, ...FALLBACK_MODELS.filter((m) => m !== primary)];
  }

  async chat(messages: ChatMessage[]): Promise<{
    reply: string;
    grounded: boolean;
  }> {
    if (!this.client || !config.gemini.apiKey) {
      throw new Error(
        "Gemini is not configured. Set GEMINI_API_KEY in backend/.env"
      );
    }

    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUser) {
      throw new Error("At least one user message is required");
    }

    const faqContext = await this.ai.getRagResponse(lastUser.content);
    const grounded =
      Boolean(faqContext) &&
      !faqContext.toLowerCase().includes("couldn't find") &&
      !faqContext.toLowerCase().includes("isn't available");

    const systemInstruction = [
      "You are SupportDesk AI, a professional customer-support assistant.",
      "Answer clearly and helpfully using the FAQ context when it is relevant.",
      "If the FAQ context is weak or irrelevant, say you are unsure and suggest contacting a human agent.",
      "Do not invent company policies, prices, or account actions.",
      "Keep answers concise (a few short paragraphs or bullet steps).",
      "",
      "FAQ context from the knowledge base:",
      faqContext || "(no FAQ match)",
    ].join("\n");

    const history = messages.slice(0, -1).map((m) => ({
      role: m.role === "assistant" ? ("model" as const) : ("user" as const),
      parts: [{ text: m.content }],
    }));

    const trimmedHistory =
      history.length > 0 && history[0].role === "model"
        ? history.slice(1)
        : history;

    let lastError: unknown;

    for (const modelName of this.modelCandidates()) {
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const model = this.client.getGenerativeModel({
            model: modelName,
            systemInstruction,
          });
          const chat = model.startChat({ history: trimmedHistory });
          const result = await chat.sendMessage(lastUser.content);
          const reply = result.response.text().trim();

          if (!reply) {
            throw new Error("Gemini returned an empty response");
          }

          if (modelName !== config.gemini.model) {
            console.warn(`Gemini fell back to model: ${modelName}`);
          }

          return { reply, grounded };
        } catch (err) {
          lastError = err;
          const msg = err instanceof Error ? err.message : String(err);
          console.warn(
            `Gemini ${modelName} attempt ${attempt + 1} failed: ${msg}`
          );

          if (isModelMissingError(err)) break;

          if (isRetryableError(err) && attempt < 2) {
            await sleep(700 * (attempt + 1));
            continue;
          }

          if (isRetryableError(err)) break;

          // Non-retryable for this model — try next candidate
          break;
        }
      }
    }

    // Soft fallback: still answer from FAQ when Gemini is overloaded
    if (grounded) {
      return {
        reply: `Gemini is busy right now, so here's what I found in our knowledge base:\n\n${faqContext}`,
        grounded: true,
      };
    }

    const message =
      lastError instanceof Error ? lastError.message : String(lastError);
    throw new Error(
      `Gemini is temporarily unavailable. Please try again in a moment. (${message})`
    );
  }
}
