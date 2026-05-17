import "dotenv/config";

if (!process.env.GEMINI_API_KEY && !process.env.GOOGLE_CLOUD_PROJECT) {
  console.error("ERROR: Set GEMINI_API_KEY or GOOGLE_CLOUD_PROJECT in server/.env");
  process.exit(1);
}

import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import { scenarioRouter } from "./scenario";
import { sidekickRouter } from "./sidekick";
import { feedbackRouter } from "./feedback";
import { feedbackTurnRouter } from "./feedback-turn";
import { handleConversationWs } from "./gemini-relay";

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));
app.use("/scenario", scenarioRouter);
app.use("/sidekick", sidekickRouter);
app.use("/feedback/turn", feedbackTurnRouter);
app.use("/feedback", feedbackRouter);

const server = createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });

wss.on("connection", (ws) => {
  console.log("Client connected");
  handleConversationWs(ws);
  ws.on("close", () => console.log("Client disconnected"));
});

const PORT = parseInt(process.env.PORT ?? "3001", 10);
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
