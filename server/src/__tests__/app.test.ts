import { Socket as ClientSocket, io as ioClient } from "socket.io-client";
import request from "supertest";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { app, server } from "../app";

vi.mock("../utils", () => ({
  fetchAndRetry: vi.fn(),
}));

import { fetchAndRetry } from "../utils";

const mockedFetchAndRetry = vi.mocked(fetchAndRetry);

interface LobbyState {
  instanceId: string;
  createdAt: string;
  players: Array<{
    userId: string;
    username: string;
    avatar: string;
  }>;
}

describe("POST /api/token", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns access token on success", async () => {
    const mockAccessToken = "mock_access_token_12345";

    mockedFetchAndRetry.mockResolvedValue({
      json: async () => ({ access_token: mockAccessToken }),
    } as Response);

    const response = await request(app)
      .post("/api/token")
      .send({ code: "valid_auth_code" });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ access_token: mockAccessToken });
  });

  it("returns 400 when code is missing", async () => {
    const response = await request(app).post("/api/token").send({});

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "Authorization code is required" });
  });

  it("returns 400 when Discord API response lacks access_token", async () => {
    mockedFetchAndRetry.mockResolvedValue({
      json: async () => ({ error: "invalid_grant" }),
    } as Response);

    const response = await request(app)
      .post("/api/token")
      .send({ code: "invalid_auth_code" });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: "Invalid response from Discord API",
    });
  });

  it("returns 500 when fetch fails", async () => {
    mockedFetchAndRetry.mockRejectedValue(new Error("Network error"));

    const response = await request(app)
      .post("/api/token")
      .send({ code: "valid_auth_code" });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: "Failed to exchange token" });
  });
});

describe("Socket.IO Lobby Management", () => {
  let clientSocket: ClientSocket;
  let serverPort: number;
  let serverUrl: string;

  // Helper function to wait for socket event
  const waitForSocketEvent = <T = unknown>(
    socket: ClientSocket,
    eventName: string,
    timeout = 5000
  ): Promise<T> => {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`Event ${eventName} timeout`)),
        timeout
      );
      socket.once(eventName, (data: T) => {
        clearTimeout(timer);
        resolve(data);
      });
      socket.once("connect_error", (error: Error) => {
        clearTimeout(timer);
        reject(error);
      });
    });
  };

  beforeAll(async () => {
    // Start the server on a random port for testing
    return new Promise<void>((resolve) => {
      const listener = server.listen(0, () => {
        const address = listener.address();
        if (address && typeof address === "object") {
          serverPort = address.port;
          serverUrl = `http://localhost:${serverPort}`;
          resolve();
        }
      });
    });
  });

  afterAll(async () => {
    return new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    if (clientSocket && clientSocket.connected) {
      clientSocket.disconnect();
    }
    // Give sockets time to clean up
    await new Promise((resolve) => setTimeout(resolve, 100));
  });

  const validPlayerData = {
    instanceId: "test-instance-id",
    userId: "user-123",
    username: "testuser",
    avatar: "https://example.com/avatar.png",
  };

  it("accepts socket connection", async () => {
    clientSocket = ioClient(serverUrl, {
      path: "/api/socket.io",
      transports: ["polling", "websocket"],
    });

    await waitForSocketEvent(clientSocket, "connect");
    expect(clientSocket.connected).toBe(true);
  });

  it("creates a lobby when first player joins", async () => {
    clientSocket = ioClient(serverUrl, {
      path: "/api/socket.io",
      transports: ["polling", "websocket"],
    });

    await waitForSocketEvent(clientSocket, "connect");
    clientSocket.emit("join_lobby", validPlayerData);

    const state = await waitForSocketEvent<LobbyState>(
      clientSocket,
      "lobby_state"
    );
    expect(state).toHaveProperty("instanceId", validPlayerData.instanceId);
    expect(state).toHaveProperty("createdAt");
    expect(state).toHaveProperty("players");
    expect(state.players).toHaveLength(1);
    expect(state.players[0]).toEqual({
      userId: validPlayerData.userId,
      username: validPlayerData.username,
      avatar: validPlayerData.avatar,
    });
  });

  it("adds multiple players to the same lobby", async () => {
    const player1Data = {
      instanceId: "multi-player-lobby",
      userId: "user-1",
      username: "player1",
      avatar: "https://example.com/avatar1.png",
    };

    const player2Data = {
      instanceId: "multi-player-lobby",
      userId: "user-2",
      username: "player2",
      avatar: "https://example.com/avatar2.png",
    };

    const player1Socket = ioClient(serverUrl, {
      path: "/api/socket.io",
      transports: ["polling", "websocket"],
    });

    // Wait for player1 to connect and emit join_lobby
    await waitForSocketEvent(player1Socket, "connect");
    player1Socket.emit("join_lobby", player1Data);

    // Wait for initial state (player1 only)
    const state1 = await waitForSocketEvent<LobbyState>(
      player1Socket,
      "lobby_state"
    );
    expect(state1.players).toHaveLength(1);
    expect(state1.players[0].userId).toBe(player1Data.userId);

    // Connect player 2
    const player2Socket = ioClient(serverUrl, {
      path: "/api/socket.io",
      transports: ["polling", "websocket"],
    });

    await waitForSocketEvent(player2Socket, "connect");
    player2Socket.emit("join_lobby", player2Data);

    // Wait for updated state (both players)
    const state2 = await waitForSocketEvent<LobbyState>(
      player1Socket,
      "lobby_state"
    );
    expect(state2.players).toHaveLength(2);
    expect(state2.players).toContainEqual({
      userId: player1Data.userId,
      username: player1Data.username,
      avatar: player1Data.avatar,
    });
    expect(state2.players).toContainEqual({
      userId: player2Data.userId,
      username: player2Data.username,
      avatar: player2Data.avatar,
    });

    // Clean up
    player1Socket.disconnect();
    player2Socket.disconnect();
  });

  it("prevents duplicate players (same userId) in a lobby", async () => {
    const playerData = {
      instanceId: "dedup-lobby",
      userId: "duplicate-user",
      username: "testuser",
      avatar: "https://example.com/avatar.png",
    };

    clientSocket = ioClient(serverUrl, {
      path: "/api/socket.io",
      transports: ["polling", "websocket"],
    });

    await waitForSocketEvent(clientSocket, "connect");
    clientSocket.emit("join_lobby", playerData);

    // First state - should have 1 player
    const state1 = await waitForSocketEvent<LobbyState>(
      clientSocket,
      "lobby_state"
    );
    expect(state1.players).toHaveLength(1);

    // Try to join again with same userId
    clientSocket.emit("join_lobby", playerData);

    // Second state - should still have only 1 player (deduplicated)
    const state2 = await waitForSocketEvent<LobbyState>(
      clientSocket,
      "lobby_state"
    );
    expect(state2.players).toHaveLength(1);
    expect(state2.players[0].userId).toBe(playerData.userId);
  });

  it("maintains separate lobbies for different instanceIds", async () => {
    const lobby1Data = {
      instanceId: "lobby-1",
      userId: "user-1",
      username: "player1",
      avatar: "https://example.com/avatar1.png",
    };

    const lobby2Data = {
      instanceId: "lobby-2",
      userId: "user-2",
      username: "player2",
      avatar: "https://example.com/avatar2.png",
    };

    const socket1 = ioClient(serverUrl, {
      path: "/api/socket.io",
      transports: ["polling", "websocket"],
    });

    const socket2 = ioClient(serverUrl, {
      path: "/api/socket.io",
      transports: ["polling", "websocket"],
    });

    // Connect both sockets and join their respective lobbies
    await Promise.all([
      waitForSocketEvent(socket1, "connect"),
      waitForSocketEvent(socket2, "connect"),
    ]);

    socket1.emit("join_lobby", lobby1Data);
    socket2.emit("join_lobby", lobby2Data);

    // Wait for both lobby states
    const [state1, state2] = await Promise.all([
      waitForSocketEvent<LobbyState>(socket1, "lobby_state"),
      waitForSocketEvent<LobbyState>(socket2, "lobby_state"),
    ]);

    expect(state1.instanceId).toBe("lobby-1");
    expect(state1.players).toHaveLength(1);
    expect(state1.players[0].userId).toBe("user-1");

    expect(state2.instanceId).toBe("lobby-2");
    expect(state2.players).toHaveLength(1);
    expect(state2.players[0].userId).toBe("user-2");

    socket1.disconnect();
    socket2.disconnect();
  });

  it("broadcasts lobby state to all clients in the same room", async () => {
    const instanceId = "broadcast-lobby";
    const player1Data = {
      instanceId,
      userId: "user-1",
      username: "player1",
      avatar: "https://example.com/avatar1.png",
    };

    const player2Data = {
      instanceId,
      userId: "user-2",
      username: "player2",
      avatar: "https://example.com/avatar2.png",
    };

    const socket1 = ioClient(serverUrl, {
      path: "/api/socket.io",
      transports: ["polling", "websocket"],
    });

    await waitForSocketEvent(socket1, "connect");
    socket1.emit("join_lobby", player1Data);

    // Wait for initial state (player1 only)
    const state1 = await waitForSocketEvent<LobbyState>(socket1, "lobby_state");
    expect(state1.players).toHaveLength(1);

    // Connect player 2
    const socket2 = ioClient(serverUrl, {
      path: "/api/socket.io",
      transports: ["polling", "websocket"],
    });

    await waitForSocketEvent(socket2, "connect");
    socket2.emit("join_lobby", player2Data);

    // Wait for socket2 to receive state (should have both players)
    const state2Socket2 = await waitForSocketEvent<LobbyState>(
      socket2,
      "lobby_state"
    );
    expect(state2Socket2.players).toHaveLength(2);

    // Wait for socket1 to receive broadcast update
    const state2Socket1 = await waitForSocketEvent<LobbyState>(
      socket1,
      "lobby_state"
    );
    expect(state2Socket1.players).toHaveLength(2);

    socket1.disconnect();
    socket2.disconnect();
  });

  it("includes timestamp in lobby state", async () => {
    clientSocket = ioClient(serverUrl, {
      path: "/api/socket.io",
      transports: ["polling", "websocket"],
    });

    await waitForSocketEvent(clientSocket, "connect");
    clientSocket.emit("join_lobby", validPlayerData);

    const state = await waitForSocketEvent<LobbyState>(
      clientSocket,
      "lobby_state"
    );
    expect(state).toHaveProperty("createdAt");
    expect(typeof state.createdAt).toBe("string");

    // Verify it's a valid ISO date string
    const date = new Date(state.createdAt);
    expect(date.toString()).not.toBe("Invalid Date");
  });

  it("stores user data on socket", async () => {
    clientSocket = ioClient(serverUrl, {
      path: "/api/socket.io",
      transports: ["polling", "websocket"],
    });

    await waitForSocketEvent(clientSocket, "connect");
    clientSocket.emit("join_lobby", validPlayerData);

    const state = await waitForSocketEvent<LobbyState>(
      clientSocket,
      "lobby_state"
    );
    // Verify the lobby was created with correct data
    expect(state.players[0]).toEqual({
      userId: validPlayerData.userId,
      username: validPlayerData.username,
      avatar: validPlayerData.avatar,
    });
  });
});
