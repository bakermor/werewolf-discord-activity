import type { CommandResponse } from "@discord/embedded-app-sdk";
import { discordSdk } from "./discordSdk";

type Auth = CommandResponse<"authenticate">;
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
    const lobbyResponse = await fetch("/api/lobby", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        instanceId,
        userId: user.id,
        username: user.username,
        avatar: user.avatar || "",
      }),
    });

    if (!lobbyResponse.ok) {
      throw new Error(`Lobby endpoint returned ${lobbyResponse.status}`);
    }

    const lobby = await lobbyResponse.json();
    console.log("Lobby initialized:", lobby);

    return auth;
  } catch (error) {
    console.error("Discord SDK setup failed:", error);
    throw error;
  }
}
