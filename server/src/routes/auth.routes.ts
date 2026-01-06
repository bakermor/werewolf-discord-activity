import { Request, Response, Router } from "express";
import { fetchAndRetry } from "../utils";

const router = Router();

/**
 * POST /api/token
 * Exchange Discord authorization code for access token
 */
router.post("/token", async (req: Request, res: Response) => {
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

export default router;
