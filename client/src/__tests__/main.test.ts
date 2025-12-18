import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Mock socket instance
const mockSocket = {
  on: vi.fn(),
  emit: vi.fn(),
  io: {
    engine: {
      transport: {
        name: "polling",
      },
    },
  },
  id: "mock-socket-id",
};

// Mock socket.io-client
vi.mock("socket.io-client", () => ({
  io: vi.fn(() => mockSocket),
}));

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
import { io } from "socket.io-client";
import { discordSdk } from "../discordSdk";
import { setupDiscordSdk } from "../discordSetup";

describe("setupDiscordSdk", () => {
  const mockClientId = "test-client-id";
  const mockCode = "test-auth-code";
  const mockAccessToken = "test-access-token";

  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("VITE_DISCORD_CLIENT_ID", mockClientId);
    mockSocket.on.mockReturnValue(mockSocket);
    mockSocket.emit.mockReturnValue(mockSocket);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("successful setup flow", () => {
    it("completes the full setup loop with socket connection", async () => {
      const mockAuth = {
        access_token: mockAccessToken,
        user: {
          id: "1234567890123456789",
          username: "testuser",
          avatar: "avatar123",
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
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ access_token: mockAccessToken }),
      });
      vi.mocked(discordSdk.commands.authenticate).mockResolvedValue(mockAuth);

      const mockLobby = {
        instanceId: "test-instance-id",
        createdAt: new Date().toISOString(),
        players: [
          {
            userId: "1234567890123456789",
            username: "testuser",
            avatar:
              "https://cdn.discordapp.com/avatars/1234567890123456789/avatar123.png?size=256",
          },
        ],
      };

      // Mock socket event handlers
      mockSocket.on.mockImplementation(
        (event: string, callback: (arg?: unknown) => void) => {
          if (event === "connect") {
            setTimeout(() => callback(), 0);
          } else if (event === "lobby_state") {
            setTimeout(() => callback(mockLobby), 10);
          }
          return mockSocket;
        }
      );

      const result = await setupDiscordSdk();

      // Verify Discord SDK flow
      expect(discordSdk.ready).toHaveBeenCalledOnce();
      expect(discordSdk.commands.authorize).toHaveBeenCalledWith({
        client_id: mockClientId,
        response_type: "code",
        state: "",
        prompt: "none",
        scope: ["identify"],
      });

      // Verify /api/token call
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

      // Verify socket.io was initialized
      expect(io).toHaveBeenCalledWith(window.location.origin, {
        path: "/api/socket.io",
        transports: ["polling", "websocket"],
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 10000,
        autoConnect: true,
      });

      // Verify socket event listeners were set up
      expect(mockSocket.on).toHaveBeenCalledWith(
        "connect",
        expect.any(Function)
      );
      expect(mockSocket.on).toHaveBeenCalledWith(
        "lobby_state",
        expect.any(Function)
      );
      expect(mockSocket.on).toHaveBeenCalledWith(
        "connect_error",
        expect.any(Function)
      );
      expect(mockSocket.on).toHaveBeenCalledWith("error", expect.any(Function));

      // Verify join_lobby was emitted
      expect(mockSocket.emit).toHaveBeenCalledWith("join_lobby", {
        instanceId: "test-instance-id",
        userId: "1234567890123456789",
        username: "testuser#0001",
        avatar:
          "https://cdn.discordapp.com/avatars/1234567890123456789/avatar123.png?size=256",
      });

      // Verify result
      expect(result.auth).toEqual(mockAuth);
      expect(result.lobby).toEqual(mockLobby);
      expect(result.socket).toBe(mockSocket);
    });

    it("sends join_lobby event with global_name when available", async () => {
      const mockAuth = {
        access_token: mockAccessToken,
        user: {
          id: "1234567890123456789",
          username: "oldusername",
          global_name: "GlobalDisplayName",
          avatar: "avatar456",
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
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ access_token: mockAccessToken }),
      });
      vi.mocked(discordSdk.commands.authenticate).mockResolvedValue(mockAuth);

      const mockLobby = {
        instanceId: "test-instance-id",
        createdAt: new Date().toISOString(),
        players: [
          {
            userId: "1234567890123456789",
            username: "GlobalDisplayName",
            avatar:
              "https://cdn.discordapp.com/avatars/1234567890123456789/avatar456.png?size=256",
          },
        ],
      };

      mockSocket.on.mockImplementation(
        (event: string, callback: (arg?: unknown) => void) => {
          if (event === "connect") {
            setTimeout(() => callback(), 0);
          } else if (event === "lobby_state") {
            setTimeout(() => callback(mockLobby), 10);
          }
          return mockSocket;
        }
      );

      await setupDiscordSdk();

      // Verify join_lobby was emitted with global_name
      expect(mockSocket.emit).toHaveBeenCalledWith("join_lobby", {
        instanceId: "test-instance-id",
        userId: "1234567890123456789",
        username: "GlobalDisplayName",
        avatar:
          "https://cdn.discordapp.com/avatars/1234567890123456789/avatar456.png?size=256",
      });
    });

    it("handles missing avatar by generating default avatar URL", async () => {
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
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ access_token: mockAccessToken }),
      });
      vi.mocked(discordSdk.commands.authenticate).mockResolvedValue(mockAuth);

      const expectedAvatar = `https://cdn.discordapp.com/embed/avatars/${
        (BigInt("1234567890123456789") >> 22n) % 6n
      }.png`;

      const mockLobby = {
        instanceId: "test-instance-id",
        createdAt: new Date().toISOString(),
        players: [
          {
            userId: "1234567890123456789",
            username: "noavataruser#0003",
            avatar: expectedAvatar,
          },
        ],
      };

      mockSocket.on.mockImplementation(
        (event: string, callback: (arg?: unknown) => void) => {
          if (event === "connect") {
            setTimeout(() => callback(), 0);
          } else if (event === "lobby_state") {
            setTimeout(() => callback(mockLobby), 10);
          }
          return mockSocket;
        }
      );

      await setupDiscordSdk();

      // Verify join_lobby was emitted with default avatar
      expect(mockSocket.emit).toHaveBeenCalledWith("join_lobby", {
        instanceId: "test-instance-id",
        userId: "1234567890123456789",
        username: "noavataruser#0003",
        avatar: expectedAvatar,
      });
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

    it("throws error when socket connection times out", async () => {
      vi.mocked(discordSdk.ready).mockResolvedValue(undefined);
      vi.mocked(discordSdk.commands.authorize).mockResolvedValue({
        code: mockCode,
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ access_token: mockAccessToken }),
      });
      vi.mocked(discordSdk.commands.authenticate).mockResolvedValue(mockAuth);

      // Mock socket that never connects or emits lobby_state
      mockSocket.on.mockImplementation(() => {
        // Don't trigger any callbacks - simulate timeout
        return mockSocket;
      });

      await expect(setupDiscordSdk()).rejects.toThrow(
        "Socket connection timeout"
      );
    }, 20000);

    it("handles socket connect_error event", async () => {
      vi.mocked(discordSdk.ready).mockResolvedValue(undefined);
      vi.mocked(discordSdk.commands.authorize).mockResolvedValue({
        code: mockCode,
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ access_token: mockAccessToken }),
      });
      vi.mocked(discordSdk.commands.authenticate).mockResolvedValue(mockAuth);

      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      mockSocket.on.mockImplementation(
        (event: string, callback: (arg?: unknown) => void) => {
          if (event === "connect_error") {
            setTimeout(() => callback(new Error("Connection failed")), 0);
          }
          // Still timeout since we don't connect
          return mockSocket;
        }
      );

      await expect(setupDiscordSdk()).rejects.toThrow(
        "Socket connection timeout"
      );

      // Verify error was logged
      await vi.waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          "Socket connection error:",
          expect.any(Error)
        );
      });

      consoleSpy.mockRestore();
    }, 20000);
  });
});
