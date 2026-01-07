import dotenv from "dotenv";
import express, { type Application } from "express";
import { createServer } from "http";
import path from "node:path";
import { Server } from "socket.io";
import { registerSocketHandlers } from "./handlers/socketHandlers";
import authRoutes from "./routes/auth.routes";
import { LobbyService } from "./services/LobbyService";
import { GameService } from "./services/GameService";

dotenv.config({ path: "../.env" });

export const app: Application = express();
const port: number = Number(process.env.PORT) || 3001;

export const server = createServer(app);
export const io = new Server(server, {
  path: "/api/socket.io",
  cors: {
    origin: true, // Allow all origins for now
    credentials: true,
  },
  transports: ["polling", "websocket"],
  allowUpgrades: true,
});

app.use(express.json());

const lobbyService = new LobbyService();
const gameService = new GameService();

registerSocketHandlers(io, lobbyService, gameService);

app.use("/api", authRoutes);

if (process.env.NODE_ENV === "production") {
  const clientBuildPath = path.join(__dirname, "../../client/dist");
  app.use(express.static(clientBuildPath));

  server.listen(port, () => {
    console.log(`Server is listening on port ${port} !`);
  });
}
