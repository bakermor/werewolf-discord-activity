import type { CommandResponse } from "@discord/embedded-app-sdk";
import "../style.css";
import { discordSdk } from "./discordSdk";
import rocketLogo from "/logo.png";

type Auth = CommandResponse<"authenticate">;
let auth: Auth;

// Once setupDiscordSdk is complete, we can assert that "auth" is initialized
setupDiscordSdk().then(() => {
  console.log("Discord SDK is ready");
});

export async function setupDiscordSdk() {
  await discordSdk.ready();

  // Authorize with Discord Client
  const clientId = import.meta.env.VITE_DISCORD_CLIENT_ID;

  const response = await discordSdk.commands.authorize({
    client_id: clientId,
    response_type: "code",
    state: "",
    prompt: "none",
    scope: ["identify"],
  });

  if (!response || !response.code) {
    throw new Error("Invalid authorize response: missing code");
  }
  const { code } = response;

  // Retrieve an access_token from your activity's server
  const token = await fetch("/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      code,
    }),
  });

  const data = (await token.json()) as { access_token?: string };
  if (!data.access_token) {
    throw new Error("Invalid response: missing access_token");
  }

  const { access_token } = data;

  // Authenticate with Discord client (using the access_token)
  auth = await discordSdk.commands.authenticate({
    access_token,
  });

  if (auth == null) {
    throw new Error("Authenticate command failed");
  }
}

const app = document.querySelector("#app");

if (app) {
  app.innerHTML = `
    <div>
      <img src="${rocketLogo}" class="logo" alt="Discord" />
      <h1>Hello, World!</h1>
    </div>
  `;
}
