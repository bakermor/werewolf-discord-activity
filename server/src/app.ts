import path from "node:path";
import dotenv from "dotenv";
import express, {
  type Application,
  type Request,
  type Response,
} from "express";
import { fetchAndRetry } from "./utils";

dotenv.config({ path: "../.env" });

export const app: Application = express();
const port: number = Number(process.env.PORT) || 3001;

app.use(express.json());

// Lobby state type
interface LobbyState {
  instanceId: string;
  createdAt: Date;
}

// In-memory store for lobbies: Map<instanceId, LobbyState>
const lobbies = new Map<string, LobbyState>();

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

// Lobby initialization endpoint
app.post("/api/lobby", async (req: Request, res: Response) => {
  try {
    const { instanceId } = req.body;

    // Validate instanceId
    if (!instanceId || typeof instanceId !== "string" || instanceId.trim() === "") {
      return res.status(400).send({ error: "Missing or invalid instanceId" });
    }

    // Check if lobby already exists
    const existingLobby = lobbies.get(instanceId);
    if (existingLobby) {
      return res.send({
        instanceId: existingLobby.instanceId,
        createdAt: existingLobby.createdAt.toISOString(),
      });
    }

    // Create new lobby
    const newLobby: LobbyState = {
      instanceId,
      createdAt: new Date(),
    };

    lobbies.set(instanceId, newLobby);

    return res.send({
      instanceId: newLobby.instanceId,
      createdAt: newLobby.createdAt.toISOString(),
    });
  } catch (error) {
    console.error("Lobby initialization failed:", error);
    res.status(500).send({ error: "Failed to initialize lobby" });
  }
});

app.listen(port, () => {
  console.log(`App is listening on port ${port} !`);
});
