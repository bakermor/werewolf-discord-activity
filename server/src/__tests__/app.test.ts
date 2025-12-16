import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import request from "supertest";
import { app } from "../app";

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

describe("POST /api/lobby", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const validPlayerData = {
    userId: "user-123",
    username: "testuser",
    avatar: "https://example.com/avatar.png",
  };

  // Validation tests
  it("returns 400 when request lacks instanceId", async () => {
    const response = await request(app)
      .post("/api/lobby")
      .send({ ...validPlayerData });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: "Missing or invalid instanceId",
    });
  });

  it("returns 400 when instanceId is an empty string", async () => {
    const response = await request(app)
      .post("/api/lobby")
      .send({ instanceId: "", ...validPlayerData });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: "Missing or invalid instanceId",
    });
  });

  it("returns 400 when instanceId is not a string", async () => {
    const response = await request(app)
      .post("/api/lobby")
      .send({ instanceId: 12345, ...validPlayerData });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: "Missing or invalid instanceId",
    });
  });

  it("returns 400 when userId is missing", async () => {
    const response = await request(app).post("/api/lobby").send({
      instanceId: "test-instance",
      username: "testuser",
      avatar: "https://example.com/avatar.png",
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: "Missing or invalid userId",
    });
  });

  it("returns 400 when userId is an empty string", async () => {
    const response = await request(app).post("/api/lobby").send({
      instanceId: "test-instance",
      userId: "",
      username: "testuser",
      avatar: "https://example.com/avatar.png",
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: "Missing or invalid userId",
    });
  });

  it("returns 400 when username is missing", async () => {
    const response = await request(app).post("/api/lobby").send({
      instanceId: "test-instance",
      userId: "user-123",
      avatar: "https://example.com/avatar.png",
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: "Missing or invalid username",
    });
  });

  it("returns 400 when username is an empty string", async () => {
    const response = await request(app).post("/api/lobby").send({
      instanceId: "test-instance",
      userId: "user-123",
      username: "",
      avatar: "https://example.com/avatar.png",
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: "Missing or invalid username",
    });
  });

  it("returns 400 when avatar is missing", async () => {
    const response = await request(app).post("/api/lobby").send({
      instanceId: "test-instance",
      userId: "user-123",
      username: "testuser",
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: "Missing or invalid avatar",
    });
  });

  it("returns 400 when avatar is not a string", async () => {
    const response = await request(app).post("/api/lobby").send({
      instanceId: "test-instance",
      userId: "user-123",
      username: "testuser",
      avatar: 12345,
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: "Missing or invalid avatar",
    });
  });

  // Player addition tests
  it("adds a player to a new lobby", async () => {
    const instanceId = "test-instance-new";

    const response = await request(app)
      .post("/api/lobby")
      .send({ instanceId, ...validPlayerData });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("instanceId", instanceId);
    expect(response.body).toHaveProperty("createdAt");
    expect(response.body).toHaveProperty("players");
    expect(Array.isArray(response.body.players)).toBe(true);
    expect(response.body.players).toHaveLength(1);
    expect(response.body.players[0]).toEqual(validPlayerData);
  });

  // Player deduplication test
  it("prevents duplicate players on refresh (same userId)", async () => {
    const instanceId = "test-instance-dedup";

    // First request - add player
    const firstResponse = await request(app)
      .post("/api/lobby")
      .send({ instanceId, ...validPlayerData });

    expect(firstResponse.status).toBe(200);
    expect(firstResponse.body.players).toHaveLength(1);

    // Second request - same player
    const secondResponse = await request(app)
      .post("/api/lobby")
      .send({ instanceId, ...validPlayerData });

    expect(secondResponse.status).toBe(200);
    expect(secondResponse.body.players).toHaveLength(1);
    expect(secondResponse.body.players[0]).toEqual(validPlayerData);
  });

  // Multiple players test
  it("allows multiple different players to join the same lobby", async () => {
    const instanceId = "test-instance-multi";

    const player1 = {
      userId: "user-1",
      username: "player1",
      avatar: "https://example.com/avatar1.png",
    };

    const player2 = {
      userId: "user-2",
      username: "player2",
      avatar: "https://example.com/avatar2.png",
    };

    // First player joins
    const firstResponse = await request(app)
      .post("/api/lobby")
      .send({ instanceId, ...player1 });

    expect(firstResponse.status).toBe(200);
    expect(firstResponse.body.players).toHaveLength(1);
    expect(firstResponse.body.players[0]).toEqual(player1);

    // Second player joins
    const secondResponse = await request(app)
      .post("/api/lobby")
      .send({ instanceId, ...player2 });

    expect(secondResponse.status).toBe(200);
    expect(secondResponse.body.players).toHaveLength(2);
    expect(secondResponse.body.players).toContainEqual(player1);
    expect(secondResponse.body.players).toContainEqual(player2);
  });

  // Multiple players with no duplicate test
  it("adds multiple players without duplicates when re-adding existing player", async () => {
    const instanceId = "test-instance-no-dup";

    const player1 = {
      userId: "user-1",
      username: "player1",
      avatar: "https://example.com/avatar1.png",
    };

    const player2 = {
      userId: "user-2",
      username: "player2",
      avatar: "https://example.com/avatar2.png",
    };

    // Player 1 joins
    await request(app)
      .post("/api/lobby")
      .send({ instanceId, ...player1 });

    // Player 2 joins
    await request(app)
      .post("/api/lobby")
      .send({ instanceId, ...player2 });

    // Player 1 re-joins (should not duplicate)
    const reJoinResponse = await request(app)
      .post("/api/lobby")
      .send({ instanceId, ...player1 });

    expect(reJoinResponse.status).toBe(200);
    expect(reJoinResponse.body.players).toHaveLength(2);
    expect(reJoinResponse.body.players).toContainEqual(player1);
    expect(reJoinResponse.body.players).toContainEqual(player2);
  });

  // Lobby isolation test
  it("maintains separate player lists for different lobbies", async () => {
    const player1 = {
      userId: "user-1",
      username: "player1",
      avatar: "https://example.com/avatar1.png",
    };

    const player2 = {
      userId: "user-2",
      username: "player2",
      avatar: "https://example.com/avatar2.png",
    };

    // Player 1 joins lobby A
    const lobbyAResponse = await request(app)
      .post("/api/lobby")
      .send({ instanceId: "lobby-a", ...player1 });

    // Player 2 joins lobby B
    const lobbyBResponse = await request(app)
      .post("/api/lobby")
      .send({ instanceId: "lobby-b", ...player2 });

    expect(lobbyAResponse.body.players).toHaveLength(1);
    expect(lobbyAResponse.body.players[0]).toEqual(player1);

    expect(lobbyBResponse.body.players).toHaveLength(1);
    expect(lobbyBResponse.body.players[0]).toEqual(player2);
  });

  it("contains required fields in response", async () => {
    const instanceId = "test-instance-validation";

    const response = await request(app)
      .post("/api/lobby")
      .send({ instanceId, ...validPlayerData });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("instanceId");
    expect(response.body).toHaveProperty("createdAt");
    expect(response.body).toHaveProperty("players");
    expect(Object.keys(response.body)).toEqual(
      expect.arrayContaining(["instanceId", "createdAt", "players"])
    );
  });
});
