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

  it("creates a new lobby and stores it correctly", async () => {
    const instanceId = "test-instance-123";

    const response = await request(app).post("/api/lobby").send({ instanceId });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("instanceId", instanceId);
    expect(response.body).toHaveProperty("createdAt");
    expect(typeof response.body.createdAt).toBe("string");
    // Verify createdAt is a valid ISO date string
    expect(new Date(response.body.createdAt).toISOString()).toBe(
      response.body.createdAt
    );
  });

  it("retrieves an existing lobby and returns the same instance", async () => {
    const instanceId = "test-instance-456";

    // First request - create lobby
    const firstResponse = await request(app)
      .post("/api/lobby")
      .send({ instanceId });

    expect(firstResponse.status).toBe(200);
    const firstCreatedAt = firstResponse.body.createdAt;

    // Second request - retrieve existing lobby
    const secondResponse = await request(app)
      .post("/api/lobby")
      .send({ instanceId });

    expect(secondResponse.status).toBe(200);
    expect(secondResponse.body.instanceId).toBe(instanceId);
    expect(secondResponse.body.createdAt).toBe(firstCreatedAt);
  });

  it("returns 400 when request lacks instanceId", async () => {
    const response = await request(app).post("/api/lobby").send({});

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: "Missing or invalid instanceId",
    });
  });

  it("returns 400 when instanceId is an empty string", async () => {
    const response = await request(app)
      .post("/api/lobby")
      .send({ instanceId: "" });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: "Missing or invalid instanceId",
    });
  });

  it("returns 400 when instanceId is not a string", async () => {
    const response = await request(app)
      .post("/api/lobby")
      .send({ instanceId: 12345 });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: "Missing or invalid instanceId",
    });
  });

  it("contains required fields in response", async () => {
    const instanceId = "test-instance-validation";

    const response = await request(app).post("/api/lobby").send({ instanceId });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("instanceId");
    expect(response.body).toHaveProperty("createdAt");
    expect(Object.keys(response.body)).toEqual(
      expect.arrayContaining(["instanceId", "createdAt"])
    );
  });
});
