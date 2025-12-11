import { DiscordSDK } from "@discord/embedded-app-sdk";

export const discordSdk = new DiscordSDK(
  import.meta.env.VITE_DISCORD_CLIENT_ID
);
