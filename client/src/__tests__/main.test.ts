import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

vi.mock("../discordSdk", () => ({
  discordSdk: {
    ready: vi.fn().mockResolvedValue(undefined),
    commands: {
      authorize: vi.fn().mockResolvedValue({ code: "initial-code" }),
      authenticate: vi
        .fn()
        .mockResolvedValue({ access_token: "initial-token" }),
    },
  },
}));

mockFetch.mockResolvedValue({
  ok: true,
  json: () => Promise.resolve({ access_token: "initial-token" }),
});

// Stub the env variable before importing main.ts
vi.stubEnv("VITE_DISCORD_CLIENT_ID", "initial-client-id");

// Import after all mocks are set up
import { setupDiscordSdk } from "../main";
import { discordSdk } from "../discordSdk";

describe("setupDiscordSdk", () => {
  const mockClientId = "test-client-id";
  const mockCode = "test-auth-code";
  const mockAccessToken = "test-access-token";

  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("VITE_DISCORD_CLIENT_ID", mockClientId);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("successful setup flow", () => {
    it("completes the full setup loop and returns auth", async () => {
      const mockAuth = {
        access_token: mockAccessToken,
        user: {
          id: "123",
          username: "testuser",
          discriminator: "0001",
          public_flags: 0,
        },
        scopes: ["identify" as const],
        expires: "2025-12-15T20:00:00.000Z",
        application: {
          id: "app-123",
          name: "Test App",
          description: "A test Discord app",
        },
      };
      vi.mocked(discordSdk.ready).mockResolvedValue(undefined);
      vi.mocked(discordSdk.commands.authorize).mockResolvedValue({
        code: mockCode,
      });
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ access_token: mockAccessToken }),
      });
      vi.mocked(discordSdk.commands.authenticate).mockResolvedValue(mockAuth);

      const result = await setupDiscordSdk();

      // Verify the full flow was executed
      expect(discordSdk.ready).toHaveBeenCalledOnce();
      expect(discordSdk.commands.authorize).toHaveBeenCalledWith({
        client_id: mockClientId,
        response_type: "code",
        state: "",
        prompt: "none",
        scope: ["identify"],
      });
      expect(mockFetch).toHaveBeenCalledWith("/api/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code: mockCode }),
      });
      expect(discordSdk.commands.authenticate).toHaveBeenCalledWith({
        access_token: mockAccessToken,
      });
      expect(result).toEqual(mockAuth);
    });
  });

  describe("error handling", () => {
    it("throws error when Discord Client ID is missing", async () => {
      vi.unstubAllEnvs();
      vi.stubEnv("VITE_DISCORD_CLIENT_ID", "");
      vi.mocked(discordSdk.ready).mockResolvedValue(undefined);

      await expect(setupDiscordSdk()).rejects.toThrow(
        "Discord Client ID not found in environment variables"
      );
    });

    it("throws error when no authorization code is received", async () => {
      vi.mocked(discordSdk.ready).mockResolvedValue(undefined);
      vi.mocked(discordSdk.commands.authorize).mockResolvedValue({
        code: undefined as unknown as string,
      });

      await expect(setupDiscordSdk()).rejects.toThrow(
        "No authorization code received from Discord"
      );
    });

    it("throws error when token endpoint returns non-ok status", async () => {
      vi.mocked(discordSdk.ready).mockResolvedValue(undefined);
      vi.mocked(discordSdk.commands.authorize).mockResolvedValue({
        code: mockCode,
      });
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
      });

      await expect(setupDiscordSdk()).rejects.toThrow(
        "Token endpoint returned 500"
      );
    });

    it("throws error when no access token is returned", async () => {
      vi.mocked(discordSdk.ready).mockResolvedValue(undefined);
      vi.mocked(discordSdk.commands.authorize).mockResolvedValue({
        code: mockCode,
      });
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await expect(setupDiscordSdk()).rejects.toThrow(
        "No access token returned from token endpoint"
      );
    });

    it("throws error when authenticate command fails", async () => {
      vi.mocked(discordSdk.ready).mockResolvedValue(undefined);
      vi.mocked(discordSdk.commands.authorize).mockResolvedValue({
        code: mockCode,
      });
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ access_token: mockAccessToken }),
      });
      vi.mocked(discordSdk.commands.authenticate).mockResolvedValue(
        null as never
      );

      await expect(setupDiscordSdk()).rejects.toThrow(
        "Authenticate command failed"
      );
    });

    it("re-throws error when discordSdk.ready() fails", async () => {
      const readyError = new Error("SDK initialization failed");
      vi.mocked(discordSdk.ready).mockRejectedValue(readyError);

      await expect(setupDiscordSdk()).rejects.toThrow(
        "SDK initialization failed"
      );
    });

    it("re-throws error when authorize command fails", async () => {
      vi.mocked(discordSdk.ready).mockResolvedValue(undefined);
      const authorizeError = new Error("Authorization denied");
      vi.mocked(discordSdk.commands.authorize).mockRejectedValue(
        authorizeError
      );

      await expect(setupDiscordSdk()).rejects.toThrow("Authorization denied");
    });

    it("re-throws error when fetch fails (network error)", async () => {
      vi.mocked(discordSdk.ready).mockResolvedValue(undefined);
      vi.mocked(discordSdk.commands.authorize).mockResolvedValue({
        code: mockCode,
      });
      const networkError = new Error("Network request failed");
      mockFetch.mockRejectedValue(networkError);

      await expect(setupDiscordSdk()).rejects.toThrow("Network request failed");
    });
  });
});
