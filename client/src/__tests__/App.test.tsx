import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App";

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

vi.mock("../discordSetup", () => {
  return {
    setupDiscordSdk: vi.fn(),
  };
});

import { setupDiscordSdk } from "../discordSetup";

describe("App", () => {
  let mockSocket: {
    on: ReturnType<typeof vi.fn>;
    emit: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
    id: string;
  };

  beforeEach(() => {
    vi.resetAllMocks();

    // Create a mock socket with on method
    mockSocket = {
      on: vi.fn(),
      emit: vi.fn(),
      disconnect: vi.fn(),
      id: "mock-socket-id",
    };
  });

  it("displays loading state initially", () => {
    vi.mocked(setupDiscordSdk).mockReturnValue(new Promise(() => {})); // Never resolves

    render(<App />);

    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("displays the main content after successful setup", async () => {
    vi.mocked(setupDiscordSdk).mockResolvedValue({
      auth: {
        access_token: "test-token",
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
      },
      lobby: {
        instanceId: "test-instance-id",
        createdAt: new Date().toISOString(),
        players: [
          {
            userId: "1234567890123456789",
            username: "testuser",
            avatar: "https://example.com/avatar.png",
          },
        ],
      },
      socket: mockSocket as never,
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Players (1/5)")).toBeInTheDocument();
    });

    expect(screen.getByText("testuser")).toBeInTheDocument();
    const avatar = screen.getByAltText("testuser's avatar") as HTMLImageElement;
    expect(avatar.src).toContain("https://example.com/avatar.png");
  });

  it("displays error message when setup fails", async () => {
    vi.mocked(setupDiscordSdk).mockRejectedValue(
      new Error("Test error message")
    );

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Error: Test error message")).toBeInTheDocument();
    });
  });

  it("calls setupDiscordSdk on mount", () => {
    vi.mocked(setupDiscordSdk).mockReturnValue(new Promise(() => {}));

    render(<App />);

    expect(setupDiscordSdk).toHaveBeenCalledOnce();
  });

  it("renders multiple players with correct player count", async () => {
    vi.mocked(setupDiscordSdk).mockResolvedValue({
      auth: {
        access_token: "test-token",
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
      },
      lobby: {
        instanceId: "test-instance-id",
        createdAt: new Date().toISOString(),
        players: [
          {
            userId: "1234567890123456789",
            username: "testuser",
            avatar: "https://example.com/avatar.png",
          },
          {
            userId: "2345678901234567890",
            username: "anotheruser",
            avatar: "https://example.com/avatar2.png",
          },
          {
            userId: "3456789012345678901",
            username: "thirduser",
            avatar: "https://example.com/avatar3.png",
          },
        ],
      },
      socket: mockSocket as never,
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Players (3/5)")).toBeInTheDocument();
    });

    expect(screen.getByText("testuser")).toBeInTheDocument();
    expect(screen.getByText("anotheruser")).toBeInTheDocument();
    expect(screen.getByText("thirduser")).toBeInTheDocument();
  });

  it("displays empty state when lobby has no players", async () => {
    vi.mocked(setupDiscordSdk).mockResolvedValue({
      auth: {
        access_token: "test-token",
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
      },
      lobby: {
        instanceId: "test-instance-id",
        createdAt: new Date().toISOString(),
        players: [],
      },
      socket: mockSocket as never,
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Players (0/5)")).toBeInTheDocument();
    });

    expect(
      screen.getByText("Waiting for players to join...")
    ).toBeInTheDocument();
  });

  it("renders fallback avatar for player with missing avatar", async () => {
    vi.mocked(setupDiscordSdk).mockResolvedValue({
      auth: {
        access_token: "test-token",
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
      },
      lobby: {
        instanceId: "test-instance-id",
        createdAt: new Date().toISOString(),
        players: [
          {
            userId: "1234567890123456789",
            username: "noavataruser",
            avatar: "",
          },
        ],
      },
      socket: mockSocket as never,
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId("avatar-placeholder")).toBeInTheDocument();
    });

    expect(screen.getByText("noavataruser")).toBeInTheDocument();
    const placeholder = screen.getByTestId("avatar-placeholder");
    expect(placeholder.textContent).toBe("N");
  });

  it("sets up socket listener for lobby_state events", async () => {
    vi.mocked(setupDiscordSdk).mockResolvedValue({
      auth: {
        access_token: "test-token",
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
      },
      lobby: {
        instanceId: "test-instance-id",
        createdAt: new Date().toISOString(),
        players: [
          {
            userId: "1234567890123456789",
            username: "testuser",
            avatar: "https://example.com/avatar.png",
          },
        ],
      },
      socket: mockSocket as never,
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Players (1/5)")).toBeInTheDocument();
    });

    // Verify socket.on was called to set up the lobby_state listener
    expect(mockSocket.on).toHaveBeenCalledWith(
      "lobby_state",
      expect.any(Function)
    );
  });

  it("updates lobby state when socket emits lobby_state event", async () => {
    let lobbyStateCallback: ((lobby: unknown) => void) | undefined;

    mockSocket.on.mockImplementation(
      (event: string, callback: (lobby: unknown) => void) => {
        if (event === "lobby_state") {
          lobbyStateCallback = callback;
        }
      }
    );

    vi.mocked(setupDiscordSdk).mockResolvedValue({
      auth: {
        access_token: "test-token",
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
      },
      lobby: {
        instanceId: "test-instance-id",
        createdAt: new Date().toISOString(),
        players: [
          {
            userId: "1234567890123456789",
            username: "testuser",
            avatar: "https://example.com/avatar.png",
          },
        ],
      },
      socket: mockSocket as never,
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Players (1/5)")).toBeInTheDocument();
    });

    // Simulate a new player joining via socket event
    const updatedLobby = {
      instanceId: "test-instance-id",
      createdAt: new Date().toISOString(),
      players: [
        {
          userId: "1234567890123456789",
          username: "testuser",
          avatar: "https://example.com/avatar.png",
        },
        {
          userId: "2345678901234567890",
          username: "newplayer",
          avatar: "https://example.com/avatar2.png",
        },
      ],
    };

    // Trigger the lobby_state callback
    lobbyStateCallback!(updatedLobby);

    // Wait for the UI to update
    await waitFor(() => {
      expect(screen.getByText("Players (2/5)")).toBeInTheDocument();
    });

    expect(screen.getByText("testuser")).toBeInTheDocument();
    expect(screen.getByText("newplayer")).toBeInTheDocument();
  });
});
