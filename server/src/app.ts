import dotenv from "dotenv";
import express, {
  type Application,
  type Request,
  type Response,
} from "express";
import { createServer } from "http";
import path from "node:path";
import { Server } from "socket.io";
import { fetchAndRetry } from "./utils";

dotenv.config({ path: "../.env" });

export const app: Application = express();
const port: number = Number(process.env.PORT) || 3001;

const server = createServer(app);
const io = new Server(server, {
  path: "/api/socket.io",
  cors: {
    origin: true, // Allow all origins for now
    credentials: true,
  },
  transports: ["polling", "websocket"],
  allowUpgrades: true,
});

app.use(express.json());

// Player interface
interface Player {
  userId: string;
  username: string;
  avatar: string;
}

// Lobby state type
interface LobbyState {
  instanceId: string;
  createdAt: Date;
  players: Player[];
}

// In-memory store for lobbies: Map<instanceId, LobbyState>
const lobbies = new Map<string, LobbyState>();

// Helper function to add a player to a lobby, preventing duplicates by userId
function addPlayerToLobby(lobby: LobbyState, player: Player): void {
  const playerExists = lobby.players.some((p) => p.userId === player.userId);
  if (!playerExists) {
    lobby.players.push(player);
  }
}

io.on("connection", (socket) => {
  console.log("New socket connection:", socket.id);

  socket.on("join_lobby", ({ instanceId, userId, username, avatar }) => {
    console.log(`User ${userId} joining lobby ${instanceId}`);

    socket.join(instanceId);

    // Store user data on the socket
    socket.data.userId = userId;
    socket.data.instanceId = instanceId;
    socket.data.username = username;
    socket.data.avatar = avatar;

    // Check if lobby already exists
    let lobby = lobbies.get(instanceId);
    if (!lobby) {
      // Create new lobby with empty players array
      lobby = {
        instanceId,
        createdAt: new Date(),
        players: [],
      };
      lobbies.set(instanceId, lobby);
    }

    // Add player to lobby (deduped by userId)
    const player: Player = { userId, username, avatar };
    addPlayerToLobby(lobby, player);

    // Broadcast lobby state to clients
    io.to(instanceId).emit("lobby_state", {
      instanceId: lobby.instanceId,
      createdAt: lobby.createdAt.toISOString(),
      players: lobby.players,
    });
  });
});

if (process.env.NODE_ENV === "production") {
  const clientBuildPath = path.join(__dirname, "../../client/dist");
  app.use(express.static(clientBuildPath));
}

// Fetch token from developer portal and return to the embedded app
app.post("/api/token", async (req: Request, res: Response) => {
  try {
    if (!req.body.code) {
      return res.status(400).send({ error: "Authorization code is required" });
    }

    const response = await fetchAndRetry(
      "https://discord.com/api/oauth2/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: process.env.VITE_DISCORD_CLIENT_ID,
          client_secret: process.env.DISCORD_CLIENT_SECRET,
          grant_type: "authorization_code",
          code: req.body.code,
        }),
      }
    );

    const data = (await response.json()) as { access_token?: string };

    // Validate the response contains an access_token
    if (!data.access_token) {
      return res
        .status(400)
        .send({ error: "Invalid response from Discord API" });
    }

    res.send({ access_token: data.access_token });
  } catch (error) {
    console.error("Token exchange failed:", error);
    res.status(500).send({ error: "Failed to exchange token" });
  }
});

server.listen(port, () => {
  console.log(`Server is listening on port ${port} !`);
});
