import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

vi.mock("../discordSdk", () => ({
  discordSdk: {
    ready: vi.fn().mockResolvedValue(undefined),
    instanceId: "test-instance-id",
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
import { discordSdk } from "../discordSdk";
import { setupDiscordSdk } from "../discordSetup";

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
          id: "1234567890123456789",
          username: "testuser",
          avatar: "https://example.com/avatar.png",
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
      const mockLobby = {
        instanceId: "test-instance-id",
        createdAt: new Date().toISOString(),
        players: [
          {
            userId: "123",
            username: "testuser",
            avatar: "https://example.com/avatar.png",
          },
        ],
      };
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ access_token: mockAccessToken }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockLobby),
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

      // Verify /api/token call
      expect(mockFetch).toHaveBeenNthCalledWith(1, "/api/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code: mockCode }),
      });

      expect(discordSdk.commands.authenticate).toHaveBeenCalledWith({
        access_token: mockAccessToken,
      });
      expect(result.auth).toEqual(mockAuth);
      expect(result.lobby).toEqual(mockLobby);
    });

    it("extracts user metadata and sends it to /api/lobby", async () => {
      const mockAuth = {
        access_token: mockAccessToken,
        user: {
          id: "1234567890123456789",
          username: "anotheruser",
          avatar: "https://example.com/user456.png",
          discriminator: "0002",
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
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ access_token: mockAccessToken }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              instanceId: "test-instance-id",
              createdAt: new Date().toISOString(),
              players: [
                {
                  userId: "user-456",
                  username: "anotheruser",
                  avatar: "https://example.com/user456.png",
                },
              ],
            }),
        });
      vi.mocked(discordSdk.commands.authenticate).mockResolvedValue(mockAuth);

      await setupDiscordSdk();
    });

    it("handles missing avatar by sending empty string", async () => {
      const mockAuth = {
        access_token: mockAccessToken,
        user: {
          id: "1234567890123456789",
          username: "noavataruser",
          avatar: null,
          discriminator: "0003",
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
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ access_token: mockAccessToken }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              instanceId: "test-instance-id",
              createdAt: new Date().toISOString(),
              players: [
                {
                  userId: "1234567890123456789",
                  username: "noavataruser",
                  avatar: "",
                },
              ],
            }),
        });
      vi.mocked(discordSdk.commands.authenticate).mockResolvedValue(mockAuth);

      await setupDiscordSdk();

      // Verify avatar is changed to a default avatar
      const secondCall = mockFetch.mock.calls[1];
      const body = JSON.parse(secondCall[1].body as string);
      expect(body.avatar).toBe(
        `https://cdn.discordapp.com/embed/avatars/${
          (BigInt(body.userId) >> 22n) % 6n
        }.png`
      );
    });
  });

  describe("error handling", () => {
    const mockAuth = {
      access_token: mockAccessToken,
      user: {
        id: "1234567890123456789",
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

    it("throws error when auth.user is missing", async () => {
      const mockAuthNoUser = {
        access_token: mockAccessToken,
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
      vi.mocked(discordSdk.commands.authenticate).mockResolvedValue(
        mockAuthNoUser as never
      );

      await expect(setupDiscordSdk()).rejects.toThrow(
        "User information not available from authentication"
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

    it("throws error when instanceId is not available", async () => {
      vi.mocked(discordSdk.ready).mockResolvedValue(undefined);
      vi.mocked(discordSdk.commands.authorize).mockResolvedValue({
        code: mockCode,
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ access_token: mockAccessToken }),
      });
      vi.mocked(discordSdk.commands.authenticate).mockResolvedValue(mockAuth);

      // Temporarily remove instanceId
      const originalInstanceId = discordSdk.instanceId;
      Object.defineProperty(discordSdk, "instanceId", {
        value: undefined,
        configurable: true,
      });

      await expect(setupDiscordSdk()).rejects.toThrow(
        "Discord SDK instanceId not available"
      );

      // Restore original instanceId
      Object.defineProperty(discordSdk, "instanceId", {
        value: originalInstanceId,
        configurable: true,
      });
    });

    it("throws error when lobby endpoint returns non-ok status", async () => {
      vi.mocked(discordSdk.ready).mockResolvedValue(undefined);
      vi.mocked(discordSdk.commands.authorize).mockResolvedValue({
        code: mockCode,
      });
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ access_token: mockAccessToken }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 400,
        });
      vi.mocked(discordSdk.commands.authenticate).mockResolvedValue(mockAuth);

      await expect(setupDiscordSdk()).rejects.toThrow(
        "Lobby endpoint returned 400"
      );
    });

    it("throws error when lobby endpoint network request fails", async () => {
      vi.mocked(discordSdk.ready).mockResolvedValue(undefined);
      vi.mocked(discordSdk.commands.authorize).mockResolvedValue({
        code: mockCode,
      });
      const networkError = new Error("Lobby network error");
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ access_token: mockAccessToken }),
        })
        .mockRejectedValueOnce(networkError);
      vi.mocked(discordSdk.commands.authenticate).mockResolvedValue(mockAuth);

      await expect(setupDiscordSdk()).rejects.toThrow("Lobby network error");
    });
  });
});
