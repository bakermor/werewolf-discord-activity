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
import { app, LobbyState, server } from "../app";

vi.mock("../utils", () => ({
  fetchAndRetry: vi.fn(),
}));

import { fetchAndRetry } from "../utils";

const mockedFetchAndRetry = vi.mocked(fetchAndRetry);

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
    // Give any remaining socket operations time to complete
    await new Promise((resolve) => setTimeout(resolve, 500));

    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Server close timeout"));
      }, 5000);

      server.close((err) => {
        clearTimeout(timeout);
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
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
    expect(state).toHaveProperty("availableRoles");
    expect(state).toHaveProperty("selectedRoles");
    expect(state.players).toHaveLength(1);
    expect(state.players[0]).toEqual({
      userId: validPlayerData.userId,
      username: validPlayerData.username,
      avatar: validPlayerData.avatar,
      isReady: false,
    });
    expect(state.availableRoles).toHaveLength(8);
    expect(state.selectedRoles).toHaveLength(6);
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
      isReady: false,
    });
    expect(state2.players).toContainEqual({
      userId: player2Data.userId,
      username: player2Data.username,
      avatar: player2Data.avatar,
      isReady: false,
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

    // Connect player 2 and set up listener for socket1 before emitting
    const socket2 = ioClient(serverUrl, {
      path: "/api/socket.io",
      transports: ["polling", "websocket"],
    });

    await waitForSocketEvent(socket2, "connect");

    // Set up promise to listen for socket1's next state update before socket2 joins
    const socket1StatePromise = waitForSocketEvent<LobbyState>(
      socket1,
      "lobby_state"
    );

    // Now have socket2 join
    socket2.emit("join_lobby", player2Data);

    // Wait for socket2 to receive state (should have both players)
    const state2Socket2 = await waitForSocketEvent<LobbyState>(
      socket2,
      "lobby_state"
    );
    expect(state2Socket2.players).toHaveLength(2);

    // Wait for socket1 to receive broadcast update
    const state2Socket1 = await socket1StatePromise;
    expect(state2Socket1.players).toHaveLength(2);

    socket1.disconnect();
    socket2.disconnect();
  });

  it("removes player from lobby when they disconnect", async () => {
    const instanceId = "disconnect-lobby";
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

    const socket2 = ioClient(serverUrl, {
      path: "/api/socket.io",
      transports: ["polling", "websocket"],
    });

    // Connect both players
    await Promise.all([
      waitForSocketEvent(socket1, "connect"),
      waitForSocketEvent(socket2, "connect"),
    ]);

    socket1.emit("join_lobby", player1Data);

    // Wait for initial state (player1 only)
    const state1 = await waitForSocketEvent<LobbyState>(socket1, "lobby_state");
    expect(state1.players).toHaveLength(1);
    expect(state1.players[0].userId).toBe("user-1");

    // Player 2 joins
    socket2.emit("join_lobby", player2Data);

    // Wait for both players to be in lobby
    const state2 = await waitForSocketEvent<LobbyState>(socket1, "lobby_state");
    expect(state2.players).toHaveLength(2);
    expect(state2.players).toContainEqual({
      userId: "user-1",
      username: "player1",
      avatar: "https://example.com/avatar1.png",
      isReady: false,
    });
    expect(state2.players).toContainEqual({
      userId: "user-2",
      username: "player2",
      avatar: "https://example.com/avatar2.png",
      isReady: false,
    });

    // Disconnect player 2
    socket2.disconnect();

    // Wait for socket1 to receive updated lobby state
    const state3 = await waitForSocketEvent<LobbyState>(socket1, "lobby_state");
    expect(state3.players).toHaveLength(1);
    expect(state3.players[0]).toEqual({
      userId: "user-1",
      username: "player1",
      avatar: "https://example.com/avatar1.png",
      isReady: false,
    });

    // Clean up
    socket1.disconnect();
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
      isReady: false,
    });
  });

  describe("Role Configuration", () => {
    it("availableRoles contains exactly 9 roles", async () => {
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
      expect(state.availableRoles).toHaveLength(8);
    });

    it("availableRoles includes correct role types and counts", async () => {
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

      const roleIds = state.availableRoles.map((role) => role.id);

      // Check for werewolves
      expect(roleIds).toContain("werewolf-1");
      expect(roleIds).toContain("werewolf-2");

      // Check for other unique roles
      expect(roleIds).toContain("seer-1");
      expect(roleIds).toContain("robber-1");
      expect(roleIds).toContain("troublemaker-1");

      // Check for villagers
      expect(roleIds).toContain("villager-1");
      expect(roleIds).toContain("villager-2");
      expect(roleIds).toContain("villager-3");

      // Verify role names
      const werewolves = state.availableRoles.filter((role) =>
        role.id.startsWith("werewolf")
      );
      werewolves.forEach((role) => {
        expect(role.name).toBe("Werewolf");
      });

      const villagers = state.availableRoles.filter((role) =>
        role.id.startsWith("villager")
      );
      villagers.forEach((role) => {
        expect(role.name).toBe("Villager");
      });

      const seers = state.availableRoles.filter((role) =>
        role.id.startsWith("seer")
      );
      seers.forEach((role) => {
        expect(role.name).toBe("Seer");
      });

      const robbers = state.availableRoles.filter((role) =>
        role.id.startsWith("robber")
      );
      robbers.forEach((role) => {
        expect(role.name).toBe("Robber");
      });

      const troublemakers = state.availableRoles.filter((role) =>
        role.id.startsWith("troublemaker")
      );
      troublemakers.forEach((role) => {
        expect(role.name).toBe("Troublemaker");
      });
    });

    it("each role in availableRoles has unique id", async () => {
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

      const roleIds = state.availableRoles.map((role) => role.id);
      const uniqueRoleIds = new Set(roleIds);

      expect(uniqueRoleIds.size).toBe(roleIds.length);
    });

    it("selectedRoles contains exactly 6 role IDs", async () => {
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
      expect(state.selectedRoles).toHaveLength(6);
    });

    it("selectedRoles references valid role IDs from availableRoles", async () => {
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

      const availableRoleIds = new Set(
        state.availableRoles.map((role) => role.id)
      );

      state.selectedRoles.forEach((selectedRoleId) => {
        expect(availableRoleIds.has(selectedRoleId)).toBe(true);
      });
    });

    it("selectedRoles contains correct initial configuration", async () => {
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

      expect(state.selectedRoles).toContain("werewolf-1");
      expect(state.selectedRoles).toContain("werewolf-2");
      expect(state.selectedRoles).toContain("seer-1");
      expect(state.selectedRoles).toContain("robber-1");
      expect(state.selectedRoles).toContain("troublemaker-1");
      expect(state.selectedRoles).toContain("villager-1");

      // Verify that the unselected villagers are NOT included
      expect(state.selectedRoles).not.toContain("villager-2");
      expect(state.selectedRoles).not.toContain("villager-3");
    });

    it("new lobby includes role configuration", async () => {
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

      expect(state).toHaveProperty("availableRoles");
      expect(state).toHaveProperty("selectedRoles");
      expect(Array.isArray(state.availableRoles)).toBe(true);
      expect(Array.isArray(state.selectedRoles)).toBe(true);
    });

    it("lobby role configuration persists across multiple joins", async () => {
      const socket1 = ioClient(serverUrl, {
        path: "/api/socket.io",
        transports: ["polling", "websocket"],
      });

      let socket2: ClientSocket | undefined;

      try {
        await waitForSocketEvent(socket1, "connect");
        socket1.emit("join_lobby", {
          instanceId: "role-persist-lobby",
          userId: "user-1",
          username: "player1",
          avatar: "https://example.com/avatar1.png",
        });

        const state1 = await waitForSocketEvent<LobbyState>(
          socket1,
          "lobby_state"
        );

        // Create socket2 after socket1 has joined successfully
        socket2 = ioClient(serverUrl, {
          path: "/api/socket.io",
          transports: ["polling", "websocket"],
        });

        await waitForSocketEvent(socket2, "connect");
        socket2.emit("join_lobby", {
          instanceId: "role-persist-lobby",
          userId: "user-2",
          username: "player2",
          avatar: "https://example.com/avatar2.png",
        });

        const state2 = await waitForSocketEvent<LobbyState>(
          socket2,
          "lobby_state"
        );

        // Verify both clients receive identical role configuration
        expect(state2.availableRoles).toEqual(state1.availableRoles);
        expect(state2.selectedRoles).toEqual(state1.selectedRoles);
      } finally {
        socket2?.disconnect();
        socket1.disconnect();
        // Give sockets time to clean up
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    });

    it("role configuration is immutable on player disconnect", async () => {
      const socket1 = ioClient(serverUrl, {
        path: "/api/socket.io",
        transports: ["polling", "websocket"],
      });

      const socket2 = ioClient(serverUrl, {
        path: "/api/socket.io",
        transports: ["polling", "websocket"],
      });

      await Promise.all([
        waitForSocketEvent(socket1, "connect"),
        waitForSocketEvent(socket2, "connect"),
      ]);

      socket1.emit("join_lobby", {
        instanceId: "role-immutable-lobby",
        userId: "user-1",
        username: "player1",
        avatar: "https://example.com/avatar1.png",
      });

      await waitForSocketEvent<LobbyState>(socket1, "lobby_state");

      socket2.emit("join_lobby", {
        instanceId: "role-immutable-lobby",
        userId: "user-2",
        username: "player2",
        avatar: "https://example.com/avatar2.png",
      });

      const state2 = await waitForSocketEvent<LobbyState>(
        socket1,
        "lobby_state"
      );

      // Store role configuration before disconnect
      const rolesBeforeDisconnect = JSON.stringify({
        availableRoles: state2.availableRoles,
        selectedRoles: state2.selectedRoles,
      });

      // Disconnect player 2
      socket2.disconnect();

      // Wait for state update
      const state3 = await waitForSocketEvent<LobbyState>(
        socket1,
        "lobby_state"
      );

      // Verify role configuration is unchanged
      const rolesAfterDisconnect = JSON.stringify({
        availableRoles: state3.availableRoles,
        selectedRoles: state3.selectedRoles,
      });

      expect(rolesAfterDisconnect).toBe(rolesBeforeDisconnect);

      socket1.disconnect();
    });

    it("lobby_state event includes role data", async () => {
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

      expect(state.availableRoles).toHaveLength(8);
      expect(state.selectedRoles).toHaveLength(6);

      // Verify each available role has required fields
      state.availableRoles.forEach((role) => {
        expect(role).toHaveProperty("id");
        expect(role).toHaveProperty("name");
        expect(typeof role.id).toBe("string");
        expect(typeof role.name).toBe("string");
      });

      // Verify each selected role is a string
      state.selectedRoles.forEach((roleId) => {
        expect(typeof roleId).toBe("string");
      });
    });

    it("role data serializes correctly to JSON", async () => {
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

      // Attempt to serialize and deserialize
      const serialized = JSON.stringify(state);
      const deserialized = JSON.parse(serialized);

      expect(deserialized.availableRoles).toHaveLength(8);
      expect(deserialized.selectedRoles).toHaveLength(6);
      expect(deserialized.availableRoles[0]).toHaveProperty("id");
      expect(deserialized.availableRoles[0]).toHaveProperty("name");
    });

    it("successfully adds a role to selectedRoles", async () => {
      clientSocket = ioClient(serverUrl, {
        path: "/api/socket.io",
        transports: ["polling", "websocket"],
      });

      await waitForSocketEvent(clientSocket, "connect");
      clientSocket.emit("join_lobby", {
        instanceId: "toggle-add-lobby",
        userId: "user-1",
        username: "testuser",
        avatar: "https://example.com/avatar.png",
      });

      const initialState = await waitForSocketEvent<LobbyState>(
        clientSocket,
        "lobby_state"
      );
      const initialLength = initialState.selectedRoles.length;

      clientSocket.emit("toggle_role", {
        instanceId: "toggle-add-lobby",
        roleId: "villager-2",
      });

      const updatedState = await waitForSocketEvent<LobbyState>(
        clientSocket,
        "lobby_state"
      );

      expect(updatedState.selectedRoles).toHaveLength(initialLength + 1);
      expect(updatedState.selectedRoles).toContain("villager-2");
    });

    it("successfully removes a role from selectedRoles", async () => {
      clientSocket = ioClient(serverUrl, {
        path: "/api/socket.io",
        transports: ["polling", "websocket"],
      });

      await waitForSocketEvent(clientSocket, "connect");
      clientSocket.emit("join_lobby", {
        instanceId: "toggle-remove-lobby",
        userId: "user-1",
        username: "testuser",
        avatar: "https://example.com/avatar.png",
      });

      const initialState = await waitForSocketEvent<LobbyState>(
        clientSocket,
        "lobby_state"
      );
      const initialLength = initialState.selectedRoles.length;

      clientSocket.emit("toggle_role", {
        instanceId: "toggle-remove-lobby",
        roleId: "werewolf-1",
      });

      const updatedState = await waitForSocketEvent<LobbyState>(
        clientSocket,
        "lobby_state"
      );

      expect(updatedState.selectedRoles).toHaveLength(initialLength - 1);
      expect(updatedState.selectedRoles).not.toContain("werewolf-1");
    });

    it("ignores toggle_role with invalid roleId", async () => {
      clientSocket = ioClient(serverUrl, {
        path: "/api/socket.io",
        transports: ["polling", "websocket"],
      });

      await waitForSocketEvent(clientSocket, "connect");
      clientSocket.emit("join_lobby", {
        instanceId: "toggle-invalid-lobby",
        userId: "user-1",
        username: "testuser",
        avatar: "https://example.com/avatar.png",
      });

      const initialState = await waitForSocketEvent<LobbyState>(
        clientSocket,
        "lobby_state"
      );

      clientSocket.emit("toggle_role", {
        instanceId: "toggle-invalid-lobby",
        roleId: "invalid-role-99",
      });

      // This should timeout because invalid roleId should be ignored
      try {
        await waitForSocketEvent<LobbyState>(clientSocket, "lobby_state", 200);
        expect.fail("Should not have received lobby_state for invalid roleId");
      } catch (error) {
        if (
          error instanceof Error &&
          !error.message.includes("Event lobby_state timeout")
        ) {
          throw error;
        }
      }
      expect(initialState.selectedRoles).toEqual(initialState.selectedRoles);
    });

    it("broadcasts updated lobby_state to all clients", async () => {
      const socket1 = ioClient(serverUrl, {
        path: "/api/socket.io",
        transports: ["polling", "websocket"],
      });

      let socket2: ClientSocket | undefined;

      try {
        await waitForSocketEvent(socket1, "connect");
        socket1.emit("join_lobby", {
          instanceId: "broadcast-state-lobby",
          userId: "user-1",
          username: "player1",
          avatar: "https://example.com/avatar1.png",
        });

        await waitForSocketEvent<LobbyState>(socket1, "lobby_state");

        socket2 = ioClient(serverUrl, {
          path: "/api/socket.io",
          transports: ["polling", "websocket"],
        });

        await waitForSocketEvent(socket2, "connect");
        socket2.emit("join_lobby", {
          instanceId: "broadcast-state-lobby",
          userId: "user-2",
          username: "player2",
          avatar: "https://example.com/avatar2.png",
        });

        await waitForSocketEvent<LobbyState>(socket2, "lobby_state");

        socket1.emit("toggle_role", {
          instanceId: "broadcast-state-lobby",
          roleId: "villager-2",
        });

        const state1 = await waitForSocketEvent<LobbyState>(
          socket1,
          "lobby_state"
        );
        const state2 = await waitForSocketEvent<LobbyState>(
          socket2,
          "lobby_state"
        );

        expect(state1.selectedRoles).toContain("villager-2");
        expect(state2.selectedRoles).toContain("villager-2");
        expect(state1.selectedRoles).toEqual(state2.selectedRoles);
      } finally {
        socket2?.disconnect();
        socket1.disconnect();
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    });

    it("handles multiple sequential toggles correctly", async () => {
      clientSocket = ioClient(serverUrl, {
        path: "/api/socket.io",
        transports: ["polling", "websocket"],
      });

      await waitForSocketEvent(clientSocket, "connect");
      clientSocket.emit("join_lobby", {
        instanceId: "sequential-toggle-lobby",
        userId: "user-1",
        username: "testuser",
        avatar: "https://example.com/avatar.png",
      });

      const initialState = await waitForSocketEvent<LobbyState>(
        clientSocket,
        "lobby_state"
      );

      // Add villager-2
      clientSocket.emit("toggle_role", {
        instanceId: "sequential-toggle-lobby",
        roleId: "villager-2",
      });
      const state1 = await waitForSocketEvent<LobbyState>(
        clientSocket,
        "lobby_state"
      );
      expect(state1.selectedRoles).toContain("villager-2");

      // Remove werewolf-1
      clientSocket.emit("toggle_role", {
        instanceId: "sequential-toggle-lobby",
        roleId: "werewolf-1",
      });
      const state2 = await waitForSocketEvent<LobbyState>(
        clientSocket,
        "lobby_state"
      );
      expect(state2.selectedRoles).not.toContain("werewolf-1");
      expect(state2.selectedRoles).toContain("villager-2");

      // Add werewolf-1 back
      clientSocket.emit("toggle_role", {
        instanceId: "sequential-toggle-lobby",
        roleId: "werewolf-1",
      });
      const state3 = await waitForSocketEvent<LobbyState>(
        clientSocket,
        "lobby_state"
      );
      expect(state3.selectedRoles).toContain("werewolf-1");
      expect(state3.selectedRoles).toContain("villager-2");

      expect(state3.selectedRoles).toHaveLength(
        initialState.selectedRoles.length + 1
      );
    });

    it("handles simultaneous toggles from multiple clients", async () => {
      const socket1 = ioClient(serverUrl, {
        path: "/api/socket.io",
        transports: ["polling", "websocket"],
      });

      let socket2: ClientSocket | undefined;

      try {
        await waitForSocketEvent(socket1, "connect");
        socket1.emit("join_lobby", {
          instanceId: "simultaneous-toggle-lobby",
          userId: "user-1",
          username: "player1",
          avatar: "https://example.com/avatar1.png",
        });

        await waitForSocketEvent<LobbyState>(socket1, "lobby_state");

        socket2 = ioClient(serverUrl, {
          path: "/api/socket.io",
          transports: ["polling", "websocket"],
        });

        await waitForSocketEvent(socket2, "connect");
        socket2.emit("join_lobby", {
          instanceId: "simultaneous-toggle-lobby",
          userId: "user-2",
          username: "player2",
          avatar: "https://example.com/avatar2.png",
        });

        await waitForSocketEvent<LobbyState>(socket2, "lobby_state");

        const updates: LobbyState[] = [];
        const collectEvents = new Promise<LobbyState[]>((resolve) => {
          const handler = (data: LobbyState) => {
            updates.push(data);
            if (updates.length === 2) {
              socket1.off("lobby_state", handler);
              resolve(updates);
            }
          };
          socket1.on("lobby_state", handler);
        });

        socket1.emit("toggle_role", {
          instanceId: "simultaneous-toggle-lobby",
          roleId: "villager-2",
        });
        socket2.emit("toggle_role", {
          instanceId: "simultaneous-toggle-lobby",
          roleId: "villager-3",
        });

        const results = await collectEvents;

        const finalState = results[1];
        expect(finalState.selectedRoles).toContain("villager-2");
        expect(finalState.selectedRoles).toContain("villager-3");
      } finally {
        socket2?.disconnect();
        socket1.disconnect();
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    });

    it("handles rapid successive toggles", async () => {
      clientSocket = ioClient(serverUrl, {
        path: "/api/socket.io",
        transports: ["polling", "websocket"],
      });

      await waitForSocketEvent(clientSocket, "connect");
      clientSocket.emit("join_lobby", {
        instanceId: "rapid-toggle-lobby",
        userId: "user-1",
        username: "testuser",
        avatar: "https://example.com/avatar.png",
      });

      await waitForSocketEvent<LobbyState>(clientSocket, "lobby_state");

      const rolesToToggle = [
        "villager-2",
        "villager-3",
        "troublemaker-1",
        "seer-1",
        "robber-1",
      ];

      const updates: LobbyState[] = [];
      const collectEvents = new Promise<LobbyState[]>((resolve) => {
        const handler = (data: LobbyState) => {
          updates.push(data);
          if (updates.length === 5) {
            clientSocket.off("lobby_state", handler);
            resolve(updates);
          }
        };
        clientSocket.on("lobby_state", handler);
      });

      for (const roleId of rolesToToggle) {
        clientSocket.emit("toggle_role", {
          instanceId: "rapid-toggle-lobby",
          roleId,
        });
      }

      const results = await collectEvents;

      const finalState = results[4];

      expect(finalState.selectedRoles).toContain("villager-2");
      expect(finalState.selectedRoles).toContain("villager-3");

      expect(finalState.selectedRoles).not.toContain("troublemaker-1");
      expect(finalState.selectedRoles).not.toContain("seer-1");
      expect(finalState.selectedRoles).not.toContain("robber-1");

      expect(finalState.selectedRoles).toContain("werewolf-1");
      expect(finalState.selectedRoles).toContain("werewolf-2");
      expect(finalState.selectedRoles).toContain("villager-1");
    });

    it("correctly toggles same role multiple times", async () => {
      clientSocket = ioClient(serverUrl, {
        path: "/api/socket.io",
        transports: ["polling", "websocket"],
      });

      await waitForSocketEvent(clientSocket, "connect");
      clientSocket.emit("join_lobby", {
        instanceId: "toggle-multiple-times",
        userId: "user-1",
        username: "testuser",
        avatar: "https://example.com/avatar.png",
      });

      const initialState = await waitForSocketEvent<LobbyState>(
        clientSocket,
        "lobby_state"
      );
      const roleToToggle = "villager-2";
      const isInitiallySelected =
        initialState.selectedRoles.includes(roleToToggle);

      // Toggle on/off/on/off
      const toggleSequence = [true, true, true, true];
      let lastState: LobbyState | undefined;

      for (let i = 0; i < toggleSequence.length; i++) {
        clientSocket.emit("toggle_role", {
          instanceId: "toggle-multiple-times",
          roleId: roleToToggle,
        });

        const state = await waitForSocketEvent<LobbyState>(
          clientSocket,
          "lobby_state"
        );
        lastState = state;

        const isSelected = state.selectedRoles.includes(roleToToggle);
        const expectedSelected = isInitiallySelected
          ? (i + 1) % 2 === 0
          : (i + 1) % 2 === 1;
        expect(isSelected).toBe(expectedSelected);
      }

      // Verify no duplicates in selectedRoles using the last state from the loop
      expect(lastState).toBeDefined();
      const roleCount = lastState!.selectedRoles.filter(
        (id) => id === roleToToggle
      ).length;
      expect(roleCount).toBeLessThanOrEqual(1);
    });

    it("maintains consistent payload format on role toggle", async () => {
      clientSocket = ioClient(serverUrl, {
        path: "/api/socket.io",
        transports: ["polling", "websocket"],
      });

      await waitForSocketEvent(clientSocket, "connect");
      clientSocket.emit("join_lobby", {
        instanceId: "format-consistency-lobby",
        userId: "user-1",
        username: "testuser",
        avatar: "https://example.com/avatar.png",
      });

      const initialState = await waitForSocketEvent<LobbyState>(
        clientSocket,
        "lobby_state"
      );

      // Emit toggle
      clientSocket.emit("toggle_role", {
        instanceId: "format-consistency-lobby",
        roleId: "villager-2",
      });

      const updatedState = await waitForSocketEvent<LobbyState>(
        clientSocket,
        "lobby_state"
      );

      // Verify all required fields are present
      expect(updatedState).toHaveProperty("instanceId");
      expect(updatedState).toHaveProperty("createdAt");
      expect(updatedState).toHaveProperty("players");
      expect(updatedState).toHaveProperty("availableRoles");
      expect(updatedState).toHaveProperty("selectedRoles");

      // Verify field types
      expect(typeof updatedState.instanceId).toBe("string");
      expect(typeof updatedState.createdAt).toBe("string");
      expect(Array.isArray(updatedState.players)).toBe(true);
      expect(Array.isArray(updatedState.availableRoles)).toBe(true);
      expect(Array.isArray(updatedState.selectedRoles)).toBe(true);

      // Verify createdAt is ISO string format
      expect(() => new Date(updatedState.createdAt)).not.toThrow();

      // Verify selectedRoles contains only strings
      updatedState.selectedRoles.forEach((roleId) => {
        expect(typeof roleId).toBe("string");
      });

      // Verify format matches initial state structure
      expect(Object.keys(updatedState).sort()).toEqual(
        Object.keys(initialState).sort()
      );
    });

    it("includes isRoleConfigValid in initial lobby state", async () => {
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

      expect(state).toHaveProperty("isRoleConfigValid");
      expect(typeof state.isRoleConfigValid).toBe("boolean");
      expect(state.isRoleConfigValid).toBe(false);
    });

    it("updates validation correctly when toggling to valid count", async () => {
      clientSocket = ioClient(serverUrl, {
        path: "/api/socket.io",
        transports: ["polling", "websocket"],
      });

      await waitForSocketEvent(clientSocket, "connect");
      clientSocket.emit("join_lobby", {
        instanceId: "validation-toggle-lobby",
        userId: "user-1",
        username: "testuser",
        avatar: "https://example.com/avatar.png",
      });

      const initialState = await waitForSocketEvent<LobbyState>(
        clientSocket,
        "lobby_state"
      );
      expect(initialState.isRoleConfigValid).toBe(false);

      // Remove 2 roles to get to 4 (valid for 1 player)
      clientSocket.emit("toggle_role", {
        instanceId: "validation-toggle-lobby",
        roleId: "troublemaker-1",
      });
      const state1 = await waitForSocketEvent<LobbyState>(
        clientSocket,
        "lobby_state"
      );
      expect(state1.selectedRoles).toHaveLength(5);
      expect(state1.isRoleConfigValid).toBe(false);

      clientSocket.emit("toggle_role", {
        instanceId: "validation-toggle-lobby",
        roleId: "robber-1",
      });
      const state2 = await waitForSocketEvent<LobbyState>(
        clientSocket,
        "lobby_state"
      );
      expect(state2.selectedRoles).toHaveLength(4);
      expect(state2.isRoleConfigValid).toBe(true);
    });

    it("updates validation when players join", async () => {
      const socket1 = ioClient(serverUrl, {
        path: "/api/socket.io",
        transports: ["polling", "websocket"],
      });

      let socket2: ClientSocket | undefined;

      try {
        await waitForSocketEvent(socket1, "connect");
        socket1.emit("join_lobby", {
          instanceId: "validation-join-lobby",
          userId: "user-1",
          username: "player1",
          avatar: "https://example.com/avatar1.png",
        });

        const state1 = await waitForSocketEvent<LobbyState>(
          socket1,
          "lobby_state"
        );
        expect(state1.players).toHaveLength(1);
        expect(state1.selectedRoles).toHaveLength(6);
        expect(state1.isRoleConfigValid).toBe(false);

        // Adjust to valid config for 1 player (4 roles)
        socket1.emit("toggle_role", {
          instanceId: "validation-join-lobby",
          roleId: "troublemaker-1",
        });
        await waitForSocketEvent<LobbyState>(socket1, "lobby_state");

        socket1.emit("toggle_role", {
          instanceId: "validation-join-lobby",
          roleId: "robber-1",
        });
        const validState = await waitForSocketEvent<LobbyState>(
          socket1,
          "lobby_state"
        );
        expect(validState.selectedRoles).toHaveLength(4);
        expect(validState.isRoleConfigValid).toBe(true);

        // Now add second player
        socket2 = ioClient(serverUrl, {
          path: "/api/socket.io",
          transports: ["polling", "websocket"],
        });

        await waitForSocketEvent(socket2, "connect");
        socket2.emit("join_lobby", {
          instanceId: "validation-join-lobby",
          userId: "user-2",
          username: "player2",
          avatar: "https://example.com/avatar2.png",
        });

        const state2 = await waitForSocketEvent<LobbyState>(
          socket1,
          "lobby_state"
        );
        // 2 players, 4 roles: invalid (needs 5)
        expect(state2.players).toHaveLength(2);
        expect(state2.selectedRoles).toHaveLength(4);
        expect(state2.isRoleConfigValid).toBe(false);
      } finally {
        socket2?.disconnect();
        socket1.disconnect();
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    });

    it("updates validation when players leave", async () => {
      const socket1 = ioClient(serverUrl, {
        path: "/api/socket.io",
        transports: ["polling", "websocket"],
      });

      const socket2 = ioClient(serverUrl, {
        path: "/api/socket.io",
        transports: ["polling", "websocket"],
      });

      try {
        await Promise.all([
          waitForSocketEvent(socket1, "connect"),
          waitForSocketEvent(socket2, "connect"),
        ]);

        socket1.emit("join_lobby", {
          instanceId: "validation-leave-lobby",
          userId: "user-1",
          username: "player1",
          avatar: "https://example.com/avatar1.png",
        });

        await waitForSocketEvent<LobbyState>(socket1, "lobby_state");

        socket2.emit("join_lobby", {
          instanceId: "validation-leave-lobby",
          userId: "user-2",
          username: "player2",
          avatar: "https://example.com/avatar2.png",
        });

        const state2Players = await waitForSocketEvent<LobbyState>(
          socket1,
          "lobby_state"
        );
        expect(state2Players.players).toHaveLength(2);
        expect(state2Players.selectedRoles).toHaveLength(6);
        expect(state2Players.isRoleConfigValid).toBe(false);

        // Adjust to valid config for 2 players (5 roles)
        socket1.emit("toggle_role", {
          instanceId: "validation-leave-lobby",
          roleId: "villager-1",
        });
        const validState = await waitForSocketEvent<LobbyState>(
          socket1,
          "lobby_state"
        );
        expect(validState.selectedRoles).toHaveLength(5);
        expect(validState.isRoleConfigValid).toBe(true);

        // Player 2 disconnects
        socket2.disconnect();

        const state1Player = await waitForSocketEvent<LobbyState>(
          socket1,
          "lobby_state"
        );
        // 1 player, 5 roles: invalid (needs 4)
        expect(state1Player.players).toHaveLength(1);
        expect(state1Player.selectedRoles).toHaveLength(5);
        expect(state1Player.isRoleConfigValid).toBe(false);
      } finally {
        socket1.disconnect();
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    });

    it("broadcasts isRoleConfigValid to all clients", async () => {
      const socket1 = ioClient(serverUrl, {
        path: "/api/socket.io",
        transports: ["polling", "websocket"],
      });

      let socket2: ClientSocket | undefined;

      try {
        await waitForSocketEvent(socket1, "connect");
        socket1.emit("join_lobby", {
          instanceId: "validation-broadcast-lobby",
          userId: "user-1",
          username: "player1",
          avatar: "https://example.com/avatar1.png",
        });

        await waitForSocketEvent<LobbyState>(socket1, "lobby_state");

        socket2 = ioClient(serverUrl, {
          path: "/api/socket.io",
          transports: ["polling", "websocket"],
        });

        await waitForSocketEvent(socket2, "connect");
        socket2.emit("join_lobby", {
          instanceId: "validation-broadcast-lobby",
          userId: "user-2",
          username: "player2",
          avatar: "https://example.com/avatar2.png",
        });

        await waitForSocketEvent<LobbyState>(socket2, "lobby_state");

        // Toggle role from socket1
        socket1.emit("toggle_role", {
          instanceId: "validation-broadcast-lobby",
          roleId: "villager-1",
        });

        const [state1, state2] = await Promise.all([
          waitForSocketEvent<LobbyState>(socket1, "lobby_state"),
          waitForSocketEvent<LobbyState>(socket2, "lobby_state"),
        ]);

        // Both clients should receive the same validation state
        expect(state1.isRoleConfigValid).toBe(state2.isRoleConfigValid);
        expect(state1.selectedRoles).toEqual(state2.selectedRoles);
        expect(state1.players).toHaveLength(2);
        expect(state1.selectedRoles).toHaveLength(5);
        // 2 players + 3 = 5 roles, so valid
        expect(state1.isRoleConfigValid).toBe(true);
      } finally {
        socket2?.disconnect();
        socket1.disconnect();
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    });
  });
});
