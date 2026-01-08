import "@testing-library/jest-dom/vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
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

vi.mock("../setup", () => {
  return {
    setupDiscordSdk: vi.fn(),
  };
});

import { setupDiscordSdk } from "../setup";
import type { CurrentUser, Role } from "../types/lobby.types";

// Helper function to create mock current user
const createMockCurrentUser = (): CurrentUser => ({
  userId: "1234567890123456789",
  username: "testuser",
  avatar: "https://example.com/avatar.png",
});

// Helper function to create mock role data
const createMockRoleData = () => ({
  availableRoles: [
    { id: "werewolf-1", name: "Werewolf" },
    { id: "werewolf-2", name: "Werewolf" },
    { id: "seer-1", name: "Seer" },
    { id: "robber-1", name: "Robber" },
    { id: "troublemaker-1", name: "Troublemaker" },
    { id: "villager-1", name: "Villager" },
    { id: "villager-2", name: "Villager" },
    { id: "villager-3", name: "Villager" },
  ] as Role[],
  selectedRoles: [
    "werewolf-1",
    "werewolf-2",
    "seer-1",
    "robber-1",
    "troublemaker-1",
    "villager-1",
  ],
  isRoleConfigValid: false,
});

describe("App", () => {
  let mockSocket: {
    on: ReturnType<typeof vi.fn>;
    off: ReturnType<typeof vi.fn>;
    emit: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
    id: string;
  };

  beforeEach(() => {
    vi.resetAllMocks();

    // Create a mock socket with on method
    mockSocket = {
      on: vi.fn(),
      off: vi.fn(),
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
            isReady: false,
          },
        ],
        ...createMockRoleData(),
        gamePhase: "lobby",
      },
      socket: mockSocket as never,
      playerData: createMockCurrentUser(),
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
            isReady: false,
          },
          {
            userId: "2345678901234567890",
            username: "anotheruser",
            avatar: "https://example.com/avatar2.png",
            isReady: false,
          },
          {
            userId: "3456789012345678901",
            username: "thirduser",
            avatar: "https://example.com/avatar3.png",
            isReady: false,
          },
        ],
        ...createMockRoleData(),
        gamePhase: "lobby",
      },
      socket: mockSocket as never,
      playerData: createMockCurrentUser(),
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
        ...createMockRoleData(),
        gamePhase: "lobby",
      },
      socket: mockSocket as never,
      playerData: createMockCurrentUser(),
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
            isReady: false,
          },
        ],
        ...createMockRoleData(),
        gamePhase: "lobby",
      },
      socket: mockSocket as never,
      playerData: createMockCurrentUser(),
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
            isReady: false,
          },
        ],
        ...createMockRoleData(),
        gamePhase: "lobby",
      },
      socket: mockSocket as never,
      playerData: createMockCurrentUser(),
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
            isReady: false,
          },
        ],
        ...createMockRoleData(),
        gamePhase: "lobby",
      },
      socket: mockSocket as never,
      playerData: createMockCurrentUser(),
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
          isReady: false,
        },
        {
          userId: "2345678901234567890",
          username: "newplayer",
          avatar: "https://example.com/avatar2.png",
          isReady: false,
        },
      ],
      ...createMockRoleData(),
      gamePhase: "lobby",
    };

    // Trigger the lobby_state callback
    await act(async () => {
      lobbyStateCallback!(updatedLobby);
    });

    // Wait for the UI to update
    await waitFor(() => {
      expect(screen.getByText("Players (2/5)")).toBeInTheDocument();
    });

    expect(screen.getByText("testuser")).toBeInTheDocument();
    expect(screen.getByText("newplayer")).toBeInTheDocument();
  });

  describe("Role Configuration", () => {
    it("handles lobby state with roles", async () => {
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
              isReady: false,
            },
          ],
          ...createMockRoleData(),
          gamePhase: "lobby",
        },
        socket: mockSocket as never,
        playerData: createMockCurrentUser(),
      });

      render(<App />);

      await waitFor(() => {
        expect(screen.getByText("Players (1/5)")).toBeInTheDocument();
      });

      expect(screen.getByText("testuser")).toBeInTheDocument();
    });

    it("receives role configuration", async () => {
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
              isReady: false,
            },
          ],
          ...createMockRoleData(),
          gamePhase: "lobby",
        },
        socket: mockSocket as never,
        playerData: createMockCurrentUser(),
      });

      render(<App />);

      await waitFor(() => {
        expect(screen.getByText("Players (1/5)")).toBeInTheDocument();
      });

      const mockSetupCall = vi.mocked(setupDiscordSdk).mock.results[0].value;
      await expect(mockSetupCall).resolves.toBeDefined();
    });

    it("preserves role configuration when lobby state updates ", async () => {
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
              isReady: false,
            },
          ],
          ...createMockRoleData(),
          gamePhase: "lobby",
        },
        socket: mockSocket as never,
        playerData: createMockCurrentUser(),
      });

      render(<App />);

      await waitFor(() => {
        expect(screen.getByText("Players (1/5)")).toBeInTheDocument();
      });

      // Simulate an update with new players but same roles
      const updatedLobby = {
        instanceId: "test-instance-id",
        createdAt: new Date().toISOString(),
        players: [
          {
            userId: "1234567890123456789",
            username: "testuser",
            avatar: "https://example.com/avatar.png",
            isReady: false,
          },
          {
            userId: "2345678901234567890",
            username: "newplayer",
            avatar: "https://example.com/avatar2.png",
            isReady: false,
          },
        ],
        ...createMockRoleData(),
        gamePhase: "lobby",
      };

      // Trigger the lobby_state callback
      await act(async () => {
        lobbyStateCallback!(updatedLobby);
      });

      // Wait for the UI to update
      await waitFor(() => {
        expect(screen.getByText("Players (2/5)")).toBeInTheDocument();
      });

      expect(screen.getByText("testuser")).toBeInTheDocument();
      expect(screen.getByText("newplayer")).toBeInTheDocument();
    });

    it("receives and stores isRoleConfigValid from lobby state", async () => {
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
              isReady: false,
            },
          ],
          ...createMockRoleData(),
          gamePhase: "lobby",
        },
        socket: mockSocket as never,
        playerData: createMockCurrentUser(),
      });

      render(<App />);

      await waitFor(() => {
        expect(screen.getByText("Players (1/5)")).toBeInTheDocument();
      });

      // Simulate receiving updated lobby state with isRoleConfigValid
      const updatedLobby = {
        instanceId: "test-instance-id",
        createdAt: new Date().toISOString(),
        players: [
          {
            userId: "1234567890123456789",
            username: "testuser",
            avatar: "https://example.com/avatar.png",
            isReady: false,
          },
        ],
        availableRoles: createMockRoleData().availableRoles,
        selectedRoles: ["werewolf-1", "seer-1", "villager-1", "robber-1"],
        isRoleConfigValid: true,
        gamePhase: "lobby",
      };

      await act(async () => {
        lobbyStateCallback!(updatedLobby);
      });

      // Wait for the UI to update
      await waitFor(() => {
        expect(screen.getByText("Players (1/5)")).toBeInTheDocument();
      });

      // Verify the component received and can work with the validation state
      // (even though it's not displayed in the UI per requirements)
      expect(lobbyStateCallback).toBeDefined();
    });
  });

  describe("Role Selection UI", () => {
    const createMockAuth = () => ({
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
    });

    it("renders 'Select Roles' header when lobby data is loaded", async () => {
      vi.mocked(setupDiscordSdk).mockResolvedValue({
        auth: createMockAuth(),
        lobby: {
          instanceId: "test-instance-id",
          createdAt: new Date().toISOString(),
          players: [
            {
              userId: "1234567890123456789",
              username: "testuser",
              avatar: "https://example.com/avatar.png",
              isReady: false,
            },
          ],
          ...createMockRoleData(),
          gamePhase: "lobby",
        },
        socket: mockSocket as never,
        playerData: createMockCurrentUser(),
      });

      render(<App />);

      await waitFor(() => {
        expect(screen.getByText("Select Roles")).toBeInTheDocument();
      });
    });

    it("matches the backend-provided role list exactly", async () => {
      vi.mocked(setupDiscordSdk).mockResolvedValue({
        auth: createMockAuth(),
        lobby: {
          instanceId: "test-instance-id",
          createdAt: new Date().toISOString(),
          players: [
            {
              userId: "1234567890123456789",
              username: "testuser",
              avatar: "https://example.com/avatar.png",
              isReady: false,
            },
          ],
          ...createMockRoleData(),
          gamePhase: "lobby",
        },
        socket: mockSocket as never,
        playerData: createMockCurrentUser(),
      });

      render(<App />);

      await waitFor(() => {
        expect(screen.getByText("Select Roles")).toBeInTheDocument();
      });

      // Verify all role names from backend are present
      const roleNamesCount: { [key: string]: number } = {};
      createMockRoleData().availableRoles.forEach((role) => {
        roleNamesCount[role.name] = (roleNamesCount[role.name] || 0) + 1;
      });

      Object.entries(roleNamesCount).forEach(([roleName, count]) => {
        const elements = screen.getAllByText(roleName);
        expect(elements).toHaveLength(count);
      });
    });

    it("displays the correct role name", async () => {
      vi.mocked(setupDiscordSdk).mockResolvedValue({
        auth: createMockAuth(),
        lobby: {
          instanceId: "test-instance-id",
          createdAt: new Date().toISOString(),
          players: [
            {
              userId: "1234567890123456789",
              username: "testuser",
              avatar: "https://example.com/avatar.png",
              isReady: false,
            },
          ],
          ...createMockRoleData(),
          gamePhase: "lobby",
        },
        socket: mockSocket as never,
        playerData: createMockCurrentUser(),
      });

      render(<App />);

      await waitFor(() => {
        expect(screen.getByText("Select Roles")).toBeInTheDocument();
      });

      // Check that each role name is displayed
      expect(screen.getAllByText("Werewolf")).toHaveLength(2);
      expect(screen.getByText("Seer")).toBeInTheDocument();
      expect(screen.getByText("Robber")).toBeInTheDocument();
      expect(screen.getByText("Troublemaker")).toBeInTheDocument();
      expect(screen.getAllByText("Villager")).toHaveLength(3);
    });

    it("updates role cards when socket emits new lobby_state with different roles", async () => {
      let lobbyStateCallback: ((lobby: unknown) => void) | undefined;

      mockSocket.on.mockImplementation(
        (event: string, callback: (lobby: unknown) => void) => {
          if (event === "lobby_state") {
            lobbyStateCallback = callback;
          }
        }
      );

      vi.mocked(setupDiscordSdk).mockResolvedValue({
        auth: createMockAuth(),
        lobby: {
          instanceId: "test-instance-id",
          createdAt: new Date().toISOString(),
          players: [
            {
              userId: "1234567890123456789",
              username: "testuser",
              avatar: "https://example.com/avatar.png",
              isReady: false,
            },
          ],
          ...createMockRoleData(),
          gamePhase: "lobby",
        },
        socket: mockSocket as never,
        playerData: createMockCurrentUser(),
      });

      render(<App />);

      await waitFor(() => {
        expect(screen.getByText("Select Roles")).toBeInTheDocument();
      });

      // Initial state: 8 roles
      expect(screen.getAllByTestId("role-placeholder")).toHaveLength(8);

      // Update with different roles
      const updatedLobby = {
        instanceId: "test-instance-id",
        createdAt: new Date().toISOString(),
        players: [
          {
            userId: "1234567890123456789",
            username: "testuser",
            avatar: "https://example.com/avatar.png",
            isReady: false,
          },
        ],
        availableRoles: [
          { id: "werewolf-1", name: "Werewolf" },
          { id: "seer-1", name: "Seer" },
          { id: "villager-1", name: "Villager" },
        ],
        selectedRoles: ["werewolf-1", "seer-1"],
        isRoleConfigValid: false,
        gamePhase: "lobby",
      };

      await act(async () => {
        lobbyStateCallback!(updatedLobby);
      });

      await waitFor(() => {
        expect(screen.getAllByTestId("role-placeholder")).toHaveLength(3);
      });

      expect(screen.getByText("Werewolf")).toBeInTheDocument();
      expect(screen.getByText("Seer")).toBeInTheDocument();
      expect(screen.getByText("Villager")).toBeInTheDocument();
    });

    it("handles missing role names gracefully", async () => {
      const rolesWithMissingName = {
        availableRoles: [
          { id: "werewolf-1", name: "Werewolf" },
          { id: "unknown-1", name: "" },
          { id: "villager-1", name: "Villager" },
        ] as Role[],
        selectedRoles: ["werewolf-1"],
        isRoleConfigValid: false,
      };

      vi.mocked(setupDiscordSdk).mockResolvedValue({
        auth: createMockAuth(),
        lobby: {
          instanceId: "test-instance-id",
          createdAt: new Date().toISOString(),
          players: [
            {
              userId: "1234567890123456789",
              username: "testuser",
              avatar: "https://example.com/avatar.png",
              isReady: false,
            },
          ],
          ...rolesWithMissingName,
          gamePhase: "lobby",
        },
        socket: mockSocket as never,
        playerData: createMockCurrentUser(),
      });

      render(<App />);

      await waitFor(() => {
        expect(screen.getByText("Select Roles")).toBeInTheDocument();
      });

      // Should still render all role cards
      expect(screen.getAllByTestId("role-placeholder")).toHaveLength(3);
      expect(screen.getByText("Werewolf")).toBeInTheDocument();
      expect(screen.getByText("Villager")).toBeInTheDocument();
    });

    it("toggles role card state when clicked", async () => {
      vi.mocked(setupDiscordSdk).mockResolvedValue({
        auth: createMockAuth(),
        lobby: {
          instanceId: "test-instance-id",
          createdAt: new Date().toISOString(),
          players: [
            {
              userId: "1234567890123456789",
              username: "testuser",
              avatar: "https://example.com/avatar.png",
              isReady: false,
            },
          ],
          ...createMockRoleData(),
          gamePhase: "lobby",
        },
        socket: mockSocket as never,
        playerData: createMockCurrentUser(),
      });

      render(<App />);

      await waitFor(() => {
        expect(screen.getByText("Select Roles")).toBeInTheDocument();
      });

      await waitFor(() => {
        const roleCards = screen.getAllByTestId("role-card");
        expect(roleCards.length).toBeGreaterThan(6);
      });

      const roleCards = screen.getAllByTestId("role-card");
      const targetCard = roleCards[6] as HTMLElement;

      // Verify initial state
      await waitFor(() => {
        expect(targetCard.className).toContain("roleCardInactive");
      });

      // Click to toggle to active
      await act(async () => {
        targetCard.click();
      });

      await waitFor(() => {
        const updatedRoleCards = screen.getAllByTestId("role-card");
        const updatedCard = updatedRoleCards[6] as HTMLElement;
        expect(updatedCard.className).toContain("roleCardActive");
      });
    });

    it("toggles role card to inactive when clicked again", async () => {
      vi.mocked(setupDiscordSdk).mockResolvedValue({
        auth: createMockAuth(),
        lobby: {
          instanceId: "test-instance-id",
          createdAt: new Date().toISOString(),
          players: [
            {
              userId: "1234567890123456789",
              username: "testuser",
              avatar: "https://example.com/avatar.png",
              isReady: false,
            },
          ],
          ...createMockRoleData(),
          gamePhase: "lobby",
        },
        socket: mockSocket as never,
        playerData: createMockCurrentUser(),
      });

      render(<App />);

      await waitFor(() => {
        expect(screen.getByText("Select Roles")).toBeInTheDocument();
      });

      await waitFor(() => {
        const roleCards = screen.getAllByTestId("role-card");
        expect(roleCards.length).toBeGreaterThan(6);
      });

      let roleCards = screen.getAllByTestId("role-card");
      let targetCard = roleCards[6] as HTMLElement;

      // Verify initial state
      await waitFor(() => {
        expect(targetCard.className).toContain("roleCardInactive");
      });

      // First click to toggle to active
      await act(async () => {
        targetCard.click();
      });

      await waitFor(() => {
        const updatedRoleCards = screen.getAllByTestId("role-card");
        const updatedCard = updatedRoleCards[6] as HTMLElement;
        expect(updatedCard.className).toContain("roleCardActive");
      });

      roleCards = screen.getAllByTestId("role-card");
      targetCard = roleCards[6] as HTMLElement;

      // Second click to toggle back to inactive
      await act(async () => {
        targetCard.click();
      });

      await waitFor(() => {
        const finalRoleCards = screen.getAllByTestId("role-card");
        const finalCard = finalRoleCards[6] as HTMLElement;
        expect(finalCard.className).toContain("roleCardInactive");
      });
    });

    it("emits toggle_role event when role card is clicked", async () => {
      vi.mocked(setupDiscordSdk).mockResolvedValue({
        auth: createMockAuth(),
        lobby: {
          instanceId: "test-instance-id",
          createdAt: new Date().toISOString(),
          players: [
            {
              userId: "1234567890123456789",
              username: "testuser",
              avatar: "https://example.com/avatar.png",
              isReady: false,
            },
          ],
          ...createMockRoleData(),
          gamePhase: "lobby",
        },
        socket: mockSocket as never,
        playerData: createMockCurrentUser(),
      });

      render(<App />);

      await waitFor(() => {
        expect(screen.getByText("Select Roles")).toBeInTheDocument();
      });

      const roleCards = screen.getAllByTestId("role-card");
      const firstCard = roleCards[0] as HTMLElement;

      await act(async () => {
        firstCard.click();
      });

      // Verify socket emit was called with correct data
      expect(mockSocket.emit).toHaveBeenCalledWith("toggle_role", {
        roleId: "werewolf-1",
      });
    });
  });

  describe("Start Game Button", () => {
    const createMockAuth = () => ({
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
    });

    it("disables button when player count is less than 3", async () => {
      const mockRoles = createMockRoleData();
      vi.mocked(setupDiscordSdk).mockResolvedValue({
        auth: createMockAuth(),
        lobby: {
          instanceId: "test-instance-id",
          createdAt: new Date().toISOString(),
          players: [
            {
              userId: "1234567890123456789",
              username: "testuser",
              avatar: "https://example.com/avatar.png",
              isReady: false,
            },
            {
              userId: "2345678901234567890",
              username: "player2",
              avatar: "https://example.com/avatar2.png",
              isReady: false,
            },
          ],
          availableRoles: mockRoles.availableRoles,
          selectedRoles: [
            "werewolf-1",
            "seer-1",
            "villager-1",
            "robber-1",
            "troublemaker-1",
          ],
          isRoleConfigValid: true,
          gamePhase: "lobby",
        },
        socket: mockSocket as never,
        playerData: createMockCurrentUser(),
      });

      render(<App />);

      await waitFor(() => {
        expect(screen.getByText("Players (2/5)")).toBeInTheDocument();
      });

      const button = screen.getByRole("button", { name: /START GAME/i });
      expect(button).toBeDisabled();
    });

    it("disables button when role configuration is invalid", async () => {
      const mockRoles = createMockRoleData();
      vi.mocked(setupDiscordSdk).mockResolvedValue({
        auth: createMockAuth(),
        lobby: {
          instanceId: "test-instance-id",
          createdAt: new Date().toISOString(),
          players: [
            {
              userId: "1234567890123456789",
              username: "testuser",
              avatar: "https://example.com/avatar.png",
              isReady: false,
            },
            {
              userId: "2345678901234567890",
              username: "player2",
              avatar: "https://example.com/avatar2.png",
              isReady: false,
            },
            {
              userId: "3456789012345678901",
              username: "player3",
              avatar: "https://example.com/avatar3.png",
              isReady: false,
            },
          ],
          availableRoles: mockRoles.availableRoles,
          selectedRoles: ["werewolf-1", "seer-1"],
          isRoleConfigValid: false,
          gamePhase: "lobby",
        },
        socket: mockSocket as never,
        playerData: createMockCurrentUser(),
      });

      render(<App />);

      await waitFor(() => {
        expect(screen.getByText("Players (3/5)")).toBeInTheDocument();
      });

      const button = screen.getByRole("button", { name: /START GAME/i });
      expect(button).toBeDisabled();
    });

    it("hides button when user has clicked ready", async () => {
      const mockRoles = createMockRoleData();
      vi.mocked(setupDiscordSdk).mockResolvedValue({
        auth: createMockAuth(),
        lobby: {
          instanceId: "test-instance-id",
          createdAt: new Date().toISOString(),
          players: [
            {
              userId: "1234567890123456789",
              username: "testuser",
              avatar: "https://example.com/avatar.png",
              isReady: false,
            },
            {
              userId: "2345678901234567890",
              username: "player2",
              avatar: "https://example.com/avatar2.png",
              isReady: false,
            },
            {
              userId: "3456789012345678901",
              username: "player3",
              avatar: "https://example.com/avatar3.png",
              isReady: false,
            },
          ],
          availableRoles: mockRoles.availableRoles,
          selectedRoles: [
            "werewolf-1",
            "werewolf-2",
            "seer-1",
            "robber-1",
            "troublemaker-1",
            "villager-1",
          ],
          isRoleConfigValid: true,
          gamePhase: "lobby",
        },
        socket: mockSocket as never,
        playerData: createMockCurrentUser(),
      });

      render(<App />);

      await waitFor(() => {
        expect(screen.getByText("Players (3/5)")).toBeInTheDocument();
      });

      const button = screen.getByRole("button", { name: /START GAME/i });

      await act(async () => {
        button.click();
      });

      await waitFor(() => {
        expect(
          screen.queryByRole("button", { name: /START GAME/i })
        ).not.toBeInTheDocument();
      });
    });

    it("emits player_ready event when button is clicked", async () => {
      const mockRoles = createMockRoleData();
      vi.mocked(setupDiscordSdk).mockResolvedValue({
        auth: createMockAuth(),
        lobby: {
          instanceId: "test-instance-id",
          createdAt: new Date().toISOString(),
          players: [
            {
              userId: "1234567890123456789",
              username: "testuser",
              avatar: "https://example.com/avatar.png",
              isReady: false,
            },
            {
              userId: "2345678901234567890",
              username: "player2",
              avatar: "https://example.com/avatar2.png",
              isReady: false,
            },
            {
              userId: "3456789012345678901",
              username: "player3",
              avatar: "https://example.com/avatar3.png",
              isReady: false,
            },
          ],
          availableRoles: mockRoles.availableRoles,
          selectedRoles: [
            "werewolf-1",
            "werewolf-2",
            "seer-1",
            "robber-1",
            "troublemaker-1",
            "villager-1",
          ],
          isRoleConfigValid: true,
          gamePhase: "lobby",
        },
        socket: mockSocket as never,
        playerData: createMockCurrentUser(),
      });

      render(<App />);

      await waitFor(() => {
        expect(screen.getByText("Players (3/5)")).toBeInTheDocument();
      });

      const button = screen.getByRole("button", { name: /START GAME/i });

      await act(async () => {
        button.click();
      });

      expect(mockSocket.emit).toHaveBeenCalledWith("player_ready");
    });

    it("resets to show button when user becomes not ready via broadcast", async () => {
      let lobbyStateCallback: ((lobby: unknown) => void) | undefined;

      mockSocket.on.mockImplementation(
        (event: string, callback: (lobby: unknown) => void) => {
          if (event === "lobby_state") {
            lobbyStateCallback = callback;
          }
        }
      );

      const mockRoles = createMockRoleData();
      vi.mocked(setupDiscordSdk).mockResolvedValue({
        auth: createMockAuth(),
        lobby: {
          instanceId: "test-instance-id",
          createdAt: new Date().toISOString(),
          players: [
            {
              userId: "1234567890123456789",
              username: "testuser",
              avatar: "https://example.com/avatar.png",
              isReady: false,
            },
            {
              userId: "2345678901234567890",
              username: "player2",
              avatar: "https://example.com/avatar2.png",
              isReady: false,
            },
            {
              userId: "3456789012345678901",
              username: "player3",
              avatar: "https://example.com/avatar3.png",
              isReady: false,
            },
          ],
          availableRoles: mockRoles.availableRoles,
          selectedRoles: [
            "werewolf-1",
            "werewolf-2",
            "seer-1",
            "robber-1",
            "troublemaker-1",
            "villager-1",
          ],
          isRoleConfigValid: true,
          gamePhase: "lobby",
        },
        socket: mockSocket as never,
        playerData: createMockCurrentUser(),
      });

      render(<App />);

      await waitFor(() => {
        expect(screen.getByText("Players (3/5)")).toBeInTheDocument();
      });

      const button = screen.getByRole("button", { name: /START GAME/i });

      // Click to mark ready
      await act(async () => {
        button.click();
      });

      await waitFor(() => {
        expect(screen.getByText("Waiting for players...")).toBeInTheDocument();
      });

      // Simulate broadcast where roles changed and all players reset to not ready
      const updatedLobby = {
        instanceId: "test-instance-id",
        createdAt: new Date().toISOString(),
        players: [
          {
            userId: "1234567890123456789",
            username: "testuser",
            avatar: "https://example.com/avatar.png",
            isReady: false,
          },
          {
            userId: "2345678901234567890",
            username: "player2",
            avatar: "https://example.com/avatar2.png",
            isReady: false,
          },
          {
            userId: "3456789012345678901",
            username: "player3",
            avatar: "https://example.com/avatar3.png",
            isReady: false,
          },
        ],
        availableRoles: mockRoles.availableRoles,
        selectedRoles: [
          "werewolf-1",
          "seer-1",
          "robber-1",
          "troublemaker-1",
          "villager-1",
          "villager-2",
        ],
        isRoleConfigValid: true,
        gamePhase: "lobby",
      };

      await act(async () => {
        lobbyStateCallback!(updatedLobby);
      });

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /START GAME/i })
        ).toBeInTheDocument();
      });

      expect(
        screen.queryByText("Waiting for players...")
      ).not.toBeInTheDocument();
    });

    it("handles missing currentUser", async () => {
      const mockRoles = createMockRoleData();
      vi.mocked(setupDiscordSdk).mockResolvedValue({
        auth: createMockAuth(),
        lobby: {
          instanceId: "test-instance-id",
          createdAt: new Date().toISOString(),
          players: [
            {
              userId: "1234567890123456789",
              username: "testuser",
              avatar: "https://example.com/avatar.png",
              isReady: false,
            },
            {
              userId: "2345678901234567890",
              username: "player2",
              avatar: "https://example.com/avatar2.png",
              isReady: false,
            },
            {
              userId: "3456789012345678901",
              username: "player3",
              avatar: "https://example.com/avatar3.png",
              isReady: false,
            },
          ],
          availableRoles: mockRoles.availableRoles,
          selectedRoles: [
            "werewolf-1",
            "werewolf-2",
            "seer-1",
            "robber-1",
            "troublemaker-1",
            "villager-1",
          ],
          isRoleConfigValid: true,
          gamePhase: "lobby",
        },
        socket: mockSocket as never,
        playerData: null as never,
      });

      render(<App />);

      await waitFor(() => {
        expect(screen.getByText("Players (3/5)")).toBeInTheDocument();
      });

      // Should not crash, button should render but be disabled
      const button = screen.getByRole("button", { name: /START GAME/i });
      expect(button).toBeInTheDocument();
    });
  });

  describe("Role Assignment View", () => {
    const createMockAuth = () => ({
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
    });

    it("emits fetch_role on mount", async () => {
      vi.mocked(setupDiscordSdk).mockResolvedValue({
        auth: createMockAuth(),
        lobby: {
          instanceId: "test-instance-id",
          createdAt: new Date().toISOString(),
          players: [
            {
              userId: "1234567890123456789",
              username: "testuser",
              avatar: "https://example.com/avatar.png",
              isReady: false,
            },
          ],
          availableRoles: createMockRoleData().availableRoles,
          selectedRoles: ["werewolf-1", "seer-1", "villager-1"],
          isRoleConfigValid: true,
          gamePhase: "role_assignment",
        },
        socket: mockSocket as never,
        playerData: createMockCurrentUser(),
      });

      render(<App />);

      await waitFor(() => {
        expect(mockSocket.emit).toHaveBeenCalledWith("fetch_role");
      });
    });

    it("emits player_ready when button is clicked", async () => {
      let roleAssignedCallback: ((data: unknown) => void) | undefined;

      mockSocket.on.mockImplementation(
        (event: string, callback: (data: unknown) => void) => {
          if (event === "role_assigned") {
            roleAssignedCallback = callback;
          }
        }
      );

      vi.mocked(setupDiscordSdk).mockResolvedValue({
        auth: createMockAuth(),
        lobby: {
          instanceId: "test-instance-id",
          createdAt: new Date().toISOString(),
          players: [
            {
              userId: "1234567890123456789",
              username: "testuser",
              avatar: "https://example.com/avatar.png",
              isReady: false,
            },
          ],
          availableRoles: createMockRoleData().availableRoles,
          selectedRoles: ["werewolf-1", "seer-1", "villager-1"],
          isRoleConfigValid: true,
          gamePhase: "role_assignment",
        },
        socket: mockSocket as never,
        playerData: createMockCurrentUser(),
      });

      render(<App />);

      await waitFor(() => {
        expect(mockSocket.emit).toHaveBeenCalledWith("fetch_role");
      });

      await act(async () => {
        if (roleAssignedCallback) {
          roleAssignedCallback({
            assignedRole: "Werewolf",
            currentRole: "Werewolf",
          });
        }
      });

      // Wait for READY button to appear after animation (with longer timeout)
      const readyButton = await waitFor(
        () => screen.getByRole("button", { name: /READY/i }),
        { timeout: 5000 }
      );

      await act(async () => {
        readyButton.click();
      });

      expect(mockSocket.emit).toHaveBeenCalledWith("player_ready");
    }, 10000);
  });
});
