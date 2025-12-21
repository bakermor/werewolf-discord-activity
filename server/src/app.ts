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

// Player interface
interface Player {
  userId: string;
  username: string;
  avatar: string;
}

// Role interface
interface Role {
  id: string;
  name: string;
}

// Lobby state type
export interface LobbyState {
  instanceId: string;
  createdAt: Date;
  players: Player[];
  availableRoles: Role[];
  selectedRoles: string[];
  isRoleConfigValid: boolean;
}

// Helper function to create default role configuration
function createDefaultRoles(): {
  availableRoles: Role[];
  selectedRoles: string[];
} {
  const availableRoles: Role[] = [
    { id: "werewolf-1", name: "Werewolf" },
    { id: "werewolf-2", name: "Werewolf" },
    { id: "seer-1", name: "Seer" },
    { id: "robber-1", name: "Robber" },
    { id: "troublemaker-1", name: "Troublemaker" },
    { id: "villager-1", name: "Villager" },
    { id: "villager-2", name: "Villager" },
    { id: "villager-3", name: "Villager" },
  ];

  const selectedRoles: string[] = [
    "werewolf-1",
    "werewolf-2",
    "seer-1",
    "robber-1",
    "troublemaker-1",
    "villager-1",
  ];

  return { availableRoles, selectedRoles };
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

// Helper function to validate role configuration
function validateRoleConfig(lobby: LobbyState): boolean {
  return lobby.selectedRoles.length === lobby.players.length + 3;
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
      // Create new lobby with empty players array and default role configuration
      const { availableRoles, selectedRoles } = createDefaultRoles();
      lobby = {
        instanceId,
        createdAt: new Date(),
        players: [],
        availableRoles,
        selectedRoles,
        isRoleConfigValid: false,
      };
      lobbies.set(instanceId, lobby);
    }

    // Add player to lobby (deduped by userId)
    const player: Player = { userId, username, avatar };
    addPlayerToLobby(lobby, player);

    lobby.isRoleConfigValid = validateRoleConfig(lobby);

    // Broadcast lobby state to clients
    io.to(instanceId).emit("lobby_state", {
      instanceId: lobby.instanceId,
      createdAt: lobby.createdAt.toISOString(),
      players: lobby.players,
      availableRoles: lobby.availableRoles,
      selectedRoles: [...lobby.selectedRoles],
      isRoleConfigValid: lobby.isRoleConfigValid,
    });
  });

  socket.on("toggle_role", ({ roleId }: { roleId: string }) => {
    console.log(
      `User ${socket.data.userId} toggling role ${roleId} in lobby ${socket.data.instanceId}`
    );

    const instanceId = socket.data.instanceId;
    if (!instanceId) {
      console.log("No instanceId in socket data, ignoring toggle_role");
      return;
    }

    const lobby = lobbies.get(instanceId);
    if (!lobby) {
      console.log(`Lobby ${instanceId} not found, ignoring toggle_role`);
      return;
    }

    const roleExists = lobby.availableRoles.some((role) => role.id === roleId);
    if (!roleExists) {
      console.log(
        `Invalid roleId ${roleId} for lobby ${instanceId}, ignoring toggle_role`
      );
      return;
    }

    const roleIndex = lobby.selectedRoles.indexOf(roleId);
    if (roleIndex !== -1) {
      lobby.selectedRoles.splice(roleIndex, 1);
    } else {
      lobby.selectedRoles.push(roleId);
      console.log(`Updated selectedRoles: ${lobby.selectedRoles}`);
    }

    lobby.isRoleConfigValid = validateRoleConfig(lobby);

    // Broadcast updated lobby state to all clients
    io.to(instanceId).emit("lobby_state", {
      instanceId: lobby.instanceId,
      createdAt: lobby.createdAt.toISOString(),
      players: lobby.players,
      availableRoles: lobby.availableRoles,
      selectedRoles: [...lobby.selectedRoles],
      isRoleConfigValid: lobby.isRoleConfigValid,
    });
  });

  socket.on("disconnect", () => {
    console.log(
      `User ${socket.data.userId} disconnected from lobby ${socket.data.instanceId}`
    );
    // TODO: Handle reconnect leeway
    const lobby = lobbies.get(socket.data.instanceId);
    if (lobby) {
      // Remove player from lobby
      lobby.players = lobby.players.filter(
        (player) => player.userId !== socket.data.userId
      );

      lobby.isRoleConfigValid = validateRoleConfig(lobby);

      io.to(socket.data.instanceId).emit("lobby_state", {
        instanceId: lobby.instanceId,
        createdAt: lobby.createdAt.toISOString(),
        players: lobby.players,
        availableRoles: lobby.availableRoles,
        selectedRoles: [...lobby.selectedRoles],
        isRoleConfigValid: lobby.isRoleConfigValid,
      });
    }
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

// Only start the server if we're not in a test environment
if (process.env.NODE_ENV === "production") {
  server.listen(port, () => {
    console.log(`Server is listening on port ${port} !`);
  });
}
