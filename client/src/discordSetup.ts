import type { CommandResponse } from "@discord/embedded-app-sdk";
import { io } from "socket.io-client";
import { discordSdk } from "./discordSdk";

type Auth = CommandResponse<"authenticate">;

export interface Player {
  userId: string;
  username: string;
  avatar: string;
  isReady: boolean;
}

export interface Role {
  id: string;
  name: string;
}

export interface LobbyState {
  instanceId: string;
  createdAt: string;
  players: Player[];
  availableRoles: Role[];
  selectedRoles: string[];
  isRoleConfigValid: boolean;
}

let auth: Auth;

export async function setupDiscordSdk() {
  try {
    await discordSdk.ready();

    const clientId = import.meta.env.VITE_DISCORD_CLIENT_ID;
    if (!clientId) {
      throw new Error("Discord Client ID not found in environment variables");
    }

    const { code } = await discordSdk.commands.authorize({
      client_id: clientId,
      response_type: "code",
      state: "",
      prompt: "none",
      scope: ["identify"],
    });
    if (!code) {
      throw new Error("No authorization code received from Discord");
    }

    // Retrieve an access_token from your activity's server
    const response = await fetch("/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        code,
      }),
    });
    if (!response.ok) {
      throw new Error(`Token endpoint returned ${response.status}`);
    }

    const { access_token } = await response.json();
    if (!access_token) {
      throw new Error("No access token returned from token endpoint");
    }

    // Authenticate with Discord client (using the access_token)
    auth = await discordSdk.commands.authenticate({
      access_token,
    });
    if (auth == null) {
      throw new Error("Authenticate command failed");
    }

    // Extract user metadata from auth response
    if (!auth.user) {
      throw new Error("User information not available from authentication");
    }

    // Initialize lobby with instanceId and user metadata
    const instanceId = discordSdk.instanceId;
    if (!instanceId) {
      throw new Error("Discord SDK instanceId not available");
    }

    const { user } = auth;

    const playerData = {
      userId: user.id,
      username: user.global_name ?? `${user.username}#${user.discriminator}`,
      avatar: user.avatar
        ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=256`
        : `https://cdn.discordapp.com/embed/avatars/${
            (BigInt(user.id) >> 22n) % 6n
          }.png`,
    };

    const socketUrl = window.location.origin;
    console.log("Connecting to Socket.io:", socketUrl);

    const socket = io(socketUrl, {
      path: "/api/socket.io",
      transports: ["polling", "websocket"],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 10000,
      autoConnect: true,
    });

    // Wait for socket to connect
    const lobby = await new Promise<LobbyState>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Socket connection timeout"));
      }, 15000);

      socket.on("connect", () => {
        console.log("Socket.io connected:", socket.id);
        console.log("Transport:", socket.io.engine.transport.name);
        clearTimeout(timeout);

        // Join the lobby room
        socket.emit("join_lobby", {
          instanceId,
          ...playerData,
        });
      });

      socket.on("lobby_state", (state: LobbyState) => {
        console.log("Received lobby state:", state);
        clearTimeout(timeout);
        resolve(state);
      });

      socket.on("connect_error", (error) => {
        console.error("Socket connection error:", error);
      });

      socket.on("error", (error) => {
        console.error("Socket error:", error);
      });
    });

    return { auth, lobby, socket };
  } catch (error) {
    console.error("Discord SDK setup failed:", error);
    throw error;
  }
}
