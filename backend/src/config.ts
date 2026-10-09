import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env") });

export const config = {
  port: Number(process.env.PORT ?? 8000),
  host: process.env.HOST ?? "0.0.0.0",
  databaseUrl: process.env.DATABASE_URL ?? "",
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
  jwtSecret: process.env.JWT_SECRET ?? "dev-change-me-supportdesk-ai",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
  freshdesk: {
    domain: process.env.FRESHDESK_DOMAIN ?? "",
    apiKey: process.env.FRESHDESK_API_KEY ?? "",
    webhookSecret: process.env.FRESHDESK_WEBHOOK_SECRET ?? "",
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY ?? "",
    model: process.env.GEMINI_MODEL ?? "gemini-3.8-flash",
    embeddingModel:
      process.env.GEMINI_EMBEDDING_MODEL ?? "text-embedding-004",
  },
  docsPath: path.join(__dirname, "..", "docs"),
};
