import { discordSdk } from "../discordSdk";
import type { Auth } from "../types/lobby.types";

export class DiscordService {
  private clientId: string;

  constructor() {
    this.clientId = import.meta.env.VITE_DISCORD_CLIENT_ID;
    if (!this.clientId) {
      throw new Error("Discord Client ID not found in environment variables");
    }
  }

  async initialize() {
    await discordSdk.ready();
  }

  async authorize(): Promise<string> {
    const { code } = await discordSdk.commands.authorize({
      client_id: this.clientId,
      response_type: "code",
      state: "",
      prompt: "none",
      scope: ["identify"],
    });

    if (!code) {
      throw new Error("No authorization code received from Discord");
    }

    return code;
  }

  async getToken(code: string): Promise<string> {
    const response = await fetch("/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ code }),
    });

    if (!response.ok) {
      throw new Error(`Token endpoint returned ${response.status}`);
    }

    const { access_token } = await response.json();
    if (!access_token) {
      throw new Error("No access token returned from token endpoint");
    }

    return access_token;
  }

  async authenticate(access_token: string): Promise<Auth> {
    const auth = await discordSdk.commands.authenticate({
      access_token,
    });

    if (!auth) {
      throw new Error("Authenticate command failed");
    }

    if (!auth.user) {
      throw new Error("User information not available from authentication");
    }

    return auth;
  }

  getInstanceId(): string {
    const instanceId = discordSdk.instanceId;
    if (!instanceId) {
      throw new Error("Discord SDK instanceId not available");
    }
    return instanceId;
  }
}
