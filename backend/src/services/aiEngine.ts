import fs from "fs";
import path from "path";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { config } from "../config.js";

export type ClassificationResult = {
  tier: "tier_1" | "tier_2" | "complex";
  confidence: number;
  category: string;
};

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export class AIEngine {
  private docs: Record<string, string> = {};
  private docTexts: string[] = [];
  private embeddedDocs: string[] = [];
  private docEmbeddings: number[][] = [];
  private ready = false;
  private embeddingProvider: "gemini" | "none" = "none";
  private client: GoogleGenerativeAI | null = null;

  async initialize(): Promise<void> {
    if (config.gemini.apiKey) {
      this.client = new GoogleGenerativeAI(config.gemini.apiKey);
    }
    this.loadDocs();
    await this.embedDocs();
    this.ready = true;
    console.log(
      `AI engine ready (${this.docTexts.length} docs, embeddings=${this.docEmbeddings.length > 0}, provider=${this.embeddingProvider})`
    );
  }

  get isReady(): boolean {
    return this.ready;
  }

  get status() {
    return {
      ready: this.ready,
      docsLoaded: this.docTexts.length,
      embeddingsReady: this.docEmbeddings.length > 0,
      embeddingModel: config.gemini.embeddingModel,
      embeddingProvider: this.embeddingProvider,
      geminiConfigured: Boolean(config.gemini.apiKey),
    };
  }

  private loadDocs(): void {
    this.docs = {};
    this.docTexts = [];

    if (!fs.existsSync(config.docsPath)) {
      console.warn(`No docs folder found at ${config.docsPath}`);
      return;
    }

    for (const filename of fs.readdirSync(config.docsPath)) {
      if (!filename.endsWith(".txt")) continue;
      const content = fs.readFileSync(
        path.join(config.docsPath, filename),
        "utf-8"
      );
      this.docs[filename] = content;
      this.docTexts.push(content);
    }
  }

  private async embedDocs(): Promise<void> {
    this.docEmbeddings = [];
    this.embeddedDocs = [];
    if (this.docTexts.length === 0) return;

    if (!this.client || !config.gemini.apiKey) {
      console.warn("GEMINI_API_KEY not set — using keyword RAG fallback");
      this.embeddingProvider = "none";
      return;
    }

    try {
      console.log("Creating document embeddings via Gemini...");
      for (const text of this.docTexts) {
        const embedding = await this.embedText(text.slice(0, 8000));
        if (embedding.length) {
          this.embeddedDocs.push(text);
          this.docEmbeddings.push(embedding);
        }
      }
      if (this.docEmbeddings.length === 0) {
        throw new Error("No embeddings were produced");
      }
      this.embeddingProvider = "gemini";
      console.log(`Loaded ${this.docEmbeddings.length} Gemini embeddings`);
    } catch (err) {
      console.error("Gemini embedding failed:", err);
      this.docEmbeddings = [];
      this.embeddedDocs = [];
      this.embeddingProvider = "none";
      console.warn("Using keyword RAG fallback");
    }
  }

  private async embedText(text: string): Promise<number[]> {
    if (!this.client) return [];
    const model = this.client.getGenerativeModel({
      model: config.gemini.embeddingModel,
    });
    const result = await model.embedContent(text);
    return result.embedding.values ?? [];
  }

  categorizeTicket(subject: string, description: string): ClassificationResult {
    const fullText = `${subject} ${description}`.toLowerCase();

    const simpleWords = ["password", "reset", "login", "help", "how to"];
    const moderateWords = [
      "billing",
      "payment",
      "subscription",
      "account",
      "upgrade",
    ];
    const complexWords = [
      "error",
      "bug",
      "crash",
      "system",
      "critical",
      "urgent",
    ];

    const simpleCount = simpleWords.filter((w) => fullText.includes(w)).length;
    const moderateCount = moderateWords.filter((w) =>
      fullText.includes(w)
    ).length;
    const complexCount = complexWords.filter((w) => fullText.includes(w)).length;

    let tier: ClassificationResult["tier"];
    let confidence: number;

    if (complexCount > 0) {
      tier = "complex";
      confidence = Math.min(0.9, 0.5 + complexCount * 0.1);
    } else if (moderateCount > 0) {
      tier = "tier_2";
      confidence = Math.min(0.8, 0.6 + moderateCount * 0.1);
    } else if (simpleCount > 0) {
      tier = "tier_1";
      confidence = Math.min(0.7, 0.5 + simpleCount * 0.1);
    } else {
      tier = "complex";
      confidence = 0.5;
    }

    const category = this.findCategory(fullText);
    console.log(
      `Classified as ${tier} (${Math.round(confidence * 100)}% confident)`
    );
    return { tier, confidence, category };
  }

  private findCategory(text: string): string {
    const categories: Record<string, string[]> = {
      password_reset: ["password", "reset", "forgot", "login"],
      billing: ["billing", "payment", "invoice", "charge"],
      technical: ["error", "bug", "crash", "broken"],
      account: ["account", "profile", "settings"],
      general: ["help", "support", "question"],
    };

    for (const [name, keywords] of Object.entries(categories)) {
      if (keywords.some((kw) => text.includes(kw))) return name;
    }
    return "general";
  }

  async getRagResponse(query: string): Promise<string> {
    if (this.docTexts.length === 0) {
      return "Knowledge base isn't available right now. Please contact support.";
    }

    if (
      this.docEmbeddings.length === 0 ||
      this.embeddedDocs.length !== this.docEmbeddings.length
    ) {
      return this.simpleSearch(query);
    }

    try {
      const queryVec = await this.embedText(query);
      if (!queryVec.length) return this.simpleSearch(query);

      let bestIdx = 0;
      let bestScore = -1;
      for (let i = 0; i < this.docEmbeddings.length; i++) {
        const score = cosineSimilarity(queryVec, this.docEmbeddings[i]);
        if (score > bestScore) {
          bestScore = score;
          bestIdx = i;
        }
      }

      if (bestScore > 0.3) {
        return this.formatResponse(query, this.embeddedDocs[bestIdx]);
      }
      return "Couldn't find anything relevant. Try contacting support.";
    } catch (err) {
      console.error("RAG search failed:", err);
      return this.simpleSearch(query);
    }
  }

  private simpleSearch(query: string): string {
    const queryWords = query.toLowerCase().split(/\s+/).filter(Boolean);
    let bestDoc: string | null = null;
    let bestScore = 0;

    for (const doc of this.docTexts) {
      const docLower = doc.toLowerCase();
      const score = queryWords.filter((w) => docLower.includes(w)).length;
      if (score > bestScore) {
        bestScore = score;
        bestDoc = doc;
      }
    }

    if (bestDoc && bestScore > 0) {
      return `Found this in our docs:\n\n${bestDoc.slice(0, 500)}...`;
    }
    return "Couldn't find anything. Please contact support.";
  }

  private formatResponse(query: string, doc: string): string {
    const lines = doc.split("\n");
    const queryWords = query.toLowerCase().split(/\s+/).filter(Boolean);
    const relevant = lines
      .filter((line) =>
        queryWords.some((word) => line.toLowerCase().includes(word))
      )
      .map((line) => line.trim())
      .filter(Boolean);

    if (relevant.length) {
      return `Here's what I found:\n\n${relevant.slice(0, 5).join("\n")}`;
    }
    return `From our knowledge base:\n\n${doc.slice(0, 500)}...`;
  }
}
