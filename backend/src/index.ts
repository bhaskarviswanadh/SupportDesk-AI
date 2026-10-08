import express from "express";
import cors from "cors";
import { config } from "./config.js";
import { createRoutes } from "./routes/index.js";
import { AIEngine } from "./services/aiEngine.js";
import { FreshdeskClient } from "./services/freshdeskClient.js";
import { TicketProcessor } from "./services/ticketProcessor.js";
import { GeminiChatService } from "./services/geminiChat.js";

async function main() {
  const ai = new AIEngine();
  await ai.initialize();

  const freshdesk = new FreshdeskClient();
  const processor = new TicketProcessor(ai, freshdesk);
  const gemini = new GeminiChatService(ai);

  const app = express();

  app.use(
    cors({
      origin: config.corsOrigin === "*" ? true : config.corsOrigin,
      credentials: true,
    })
  );

  app.use(
    express.json({
      verify: (req, _res, buf) => {
        (req as express.Request & { rawBody?: Buffer }).rawBody = buf;
      },
    })
  );

  app.use(createRoutes({ processor, ai, freshdesk, gemini }));

  app.listen(config.port, config.host, () => {
    console.log(
      `API listening on http://${config.host}:${config.port} (cors: ${config.corsOrigin})`
    );
  });
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
