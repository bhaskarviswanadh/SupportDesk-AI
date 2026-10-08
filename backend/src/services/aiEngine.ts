import fs from "fs";
import path from "path";
import { config } from "../config.js";

export type ClassificationResult = {
  tier: "tier_1" | "tier_2" | "complex";
  confidence: number;
  category: string;
};

type Embedder = {
  (text: string, options?: Record<string, unknown>): Promise<{
    data: Float32Array | number[];
  }>;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

function meanPool(embedding: number[] | number[][]): number[] {
  if (!Array.isArray(embedding) || embedding.length === 0) return [];
  if (typeof embedding[0] === "number") {
    return embedding as number[];
  }
  const rows = embedding as number[][];
  const dims = rows[0]?.length ?? 0;
  const pooled = new Array(dims).fill(0);
  for (const row of rows) {
    for (let i = 0; i < dims; i++) pooled[i] += row[i];
  }
  for (let i = 0; i < dims; i++) pooled[i] /= rows.length;
  return pooled;
}

export class AIEngine {
  private docs: Record<string, string> = {};
  private docTexts: string[] = [];
  private embeddedDocs: string[] = [];
  private docEmbeddings: number[][] = [];
  private ready = false;
  private embeddingProvider: "hf" | "local" | "none" = "none";
  private localEmbedder: Embedder | null = null;

  async initialize(): Promise<void> {
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
      hfConfigured: Boolean(config.hf.apiToken),
      embeddingModel: config.hf.embeddingModel,
      embeddingProvider: this.embeddingProvider,
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

    // Prefer HF Inference if token works; otherwise free local MiniLM
    if (config.hf.apiToken) {
      try {
        console.log("Creating document embeddings via Hugging Face...");
        await this.embedAllWith((text) => this.embedTextHf(text));
        this.embeddingProvider = "hf";
        console.log(`Loaded ${this.docEmbeddings.length} HF embeddings`);
        return;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.warn(`HF embeddings unavailable (${message}). Falling back to local model…`);
        this.docEmbeddings = [];
        this.embeddedDocs = [];
      }
    } else {
      console.warn("HF_API_TOKEN not set — trying local embeddings");
    }

    try {
      console.log("Creating document embeddings locally (Xenova MiniLM)...");
      await this.ensureLocalEmbedder();
      await this.embedAllWith((text) => this.embedTextLocal(text));
      this.embeddingProvider = "local";
      console.log(`Loaded ${this.docEmbeddings.length} local embeddings`);
    } catch (err) {
      console.error("Local embedding failed:", err);
      this.docEmbeddings = [];
      this.embeddedDocs = [];
      this.embeddingProvider = "none";
      console.warn("Using keyword RAG fallback");
    }
  }

  private async embedAllWith(
    embedFn: (text: string) => Promise<number[]>
  ): Promise<void> {
    for (const text of this.docTexts) {
      const embedding = await embedFn(text.slice(0, 2000));
      if (embedding.length) {
        this.embeddedDocs.push(text);
        this.docEmbeddings.push(embedding);
      }
    }
    if (this.docEmbeddings.length === 0) {
      throw new Error("No embeddings were produced");
    }
  }

  private async ensureLocalEmbedder(): Promise<void> {
    if (this.localEmbedder) return;
    const { pipeline, env } = await import("@xenova/transformers");
    // Cache models under backend/.cache
    env.cacheDir = path.join(path.dirname(config.docsPath), ".cache");
    this.localEmbedder = (await pipeline(
      "feature-extraction",
      "Xenova/all-MiniLM-L6-v2"
    )) as unknown as Embedder;
  }

  private async embedTextLocal(text: string): Promise<number[]> {
    if (!this.localEmbedder) return [];
    const output = await this.localEmbedder(text, {
      pooling: "mean",
      normalize: true,
    });
    return Array.from(output.data);
  }

  private async embedTextHf(text: string): Promise<number[]> {
    if (!config.hf.apiToken) return [];

    const url = `https://router.huggingface.co/hf-inference/models/${config.hf.embeddingModel}/pipeline/feature-extraction`;

    for (let attempt = 0; attempt < 5; attempt++) {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.hf.apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ inputs: text }),
      });

      if (response.status === 503 || response.status === 504) {
        await sleep(1500 * (attempt + 1));
        continue;
      }

      if (!response.ok) {
        const body = await response.text();
        if (response.status === 402) {
          throw new Error(
            "HF Inference has no remaining credits (402). Using free local embeddings instead."
          );
        }
        if (response.status === 403) {
          throw new Error(
            "HF token lacks Inference Providers permission."
          );
        }
        throw new Error(`HF embedding failed (${response.status}): ${body}`);
      }

      const result = (await response.json()) as
        | number[]
        | number[][]
        | number[][][];
      if (
        Array.isArray(result) &&
        Array.isArray(result[0]) &&
        Array.isArray((result[0] as number[])[0])
      ) {
        return meanPool(result[0] as number[][]);
      }
      return meanPool(result as number[] | number[][]);
    }

    throw new Error("HF embedding timed out while model was loading");
  }

  private async embedText(text: string): Promise<number[]> {
    if (this.embeddingProvider === "hf") return this.embedTextHf(text);
    if (this.embeddingProvider === "local") return this.embedTextLocal(text);
    return [];
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
