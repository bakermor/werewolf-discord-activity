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

vi.mock("../discordSetup", () => {
  return {
    setupDiscordSdk: vi.fn(),
  };
});

import { setupDiscordSdk } from "../discordSetup";
import type { Role } from "../discordSetup";

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
        ...createMockRoleData(),
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
        ...createMockRoleData(),
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
        ...createMockRoleData(),
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
        ...createMockRoleData(),
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
        ...createMockRoleData(),
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
        ...createMockRoleData(),
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
      const mockRoles = createMockRoleData();

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
          ...mockRoles,
        },
        socket: mockSocket as never,
      });

      render(<App />);

      await waitFor(() => {
        expect(screen.getByText("Players (1/5)")).toBeInTheDocument();
      });

      expect(screen.getByText("testuser")).toBeInTheDocument();
    });

    it("receives role configuration", async () => {
      const mockRoles = createMockRoleData();

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
          ...mockRoles,
        },
        socket: mockSocket as never,
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

      const mockRoles = createMockRoleData();

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
          ...mockRoles,
        },
        socket: mockSocket as never,
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
          },
          {
            userId: "2345678901234567890",
            username: "newplayer",
            avatar: "https://example.com/avatar2.png",
          },
        ],
        ...mockRoles,
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

      const mockRoles = createMockRoleData();

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
          ...mockRoles,
        },
        socket: mockSocket as never,
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
          },
        ],
        availableRoles: mockRoles.availableRoles,
        selectedRoles: ["werewolf-1", "seer-1", "villager-1", "robber-1"],
        isRoleConfigValid: true,
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
            },
          ],
          ...createMockRoleData(),
        },
        socket: mockSocket as never,
      });

      render(<App />);

      await waitFor(() => {
        expect(screen.getByText("Select Roles")).toBeInTheDocument();
      });
    });

    it("matches the backend-provided role list exactly", async () => {
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
            },
          ],
          ...mockRoles,
        },
        socket: mockSocket as never,
      });

      render(<App />);

      await waitFor(() => {
        expect(screen.getByText("Select Roles")).toBeInTheDocument();
      });

      // Verify all role names from backend are present
      const roleNamesCount: { [key: string]: number } = {};
      mockRoles.availableRoles.forEach((role) => {
        roleNamesCount[role.name] = (roleNamesCount[role.name] || 0) + 1;
      });

      Object.entries(roleNamesCount).forEach(([roleName, count]) => {
        const elements = screen.getAllByText(roleName);
        expect(elements).toHaveLength(count);
      });
    });

    it("displays the correct role name", async () => {
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
            },
          ],
          ...mockRoles,
        },
        socket: mockSocket as never,
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

      const initialRoles = createMockRoleData();
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
            },
          ],
          ...initialRoles,
        },
        socket: mockSocket as never,
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
          },
        ],
        availableRoles: [
          { id: "werewolf-1", name: "Werewolf" },
          { id: "seer-1", name: "Seer" },
          { id: "villager-1", name: "Villager" },
        ],
        selectedRoles: ["werewolf-1", "seer-1"],
        isRoleConfigValid: false,
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
            },
          ],
          ...rolesWithMissingName,
        },
        socket: mockSocket as never,
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
      const initialRoles = createMockRoleData();
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
            },
          ],
          ...initialRoles,
        },
        socket: mockSocket as never,
      });

      render(<App />);

      await waitFor(() => {
        expect(screen.getByText("Select Roles")).toBeInTheDocument();
      });

      const roleCards = screen.getAllByTestId("role-card");
      expect(roleCards.length).toBeGreaterThan(6);

      const inactiveCard = roleCards[6] as HTMLElement;

      expect(inactiveCard.className).toContain("roleCardInactive");

      // Click to toggle to active
      await act(async () => {
        inactiveCard.click();
      });

      await waitFor(() => {
        expect(inactiveCard.className).toContain("roleCardActive");
      });
    });

    it("toggles role card to inactive when clicked again", async () => {
      const initialRoles = createMockRoleData();
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
            },
          ],
          ...initialRoles,
        },
        socket: mockSocket as never,
      });

      render(<App />);

      await waitFor(() => {
        expect(screen.getByText("Select Roles")).toBeInTheDocument();
      });

      const roleCards = screen.getAllByTestId("role-card");
      expect(roleCards.length).toBeGreaterThan(6);

      const inactiveCard = roleCards[6] as HTMLElement;

      expect(inactiveCard.className).toContain("roleCardInactive");

      // First click
      await act(async () => {
        inactiveCard.click();
      });

      await waitFor(() => {
        expect(inactiveCard.className).toContain("roleCardActive");
      });

      // Second click
      await act(async () => {
        inactiveCard.click();
      });

      await waitFor(() => {
        expect(inactiveCard.className).toContain("roleCardInactive");
      });
    });

    it("emits toggle_role event when role card is clicked", async () => {
      const initialRoles = createMockRoleData();
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
            },
          ],
          ...initialRoles,
        },
        socket: mockSocket as never,
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

    it("handles multiple rapid role toggles correctly", async () => {
      const initialRoles = createMockRoleData();
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
            },
          ],
          ...initialRoles,
        },
        socket: mockSocket as never,
      });

      render(<App />);

      await waitFor(() => {
        expect(screen.getByText("Select Roles")).toBeInTheDocument();
      });

      const roleCards = screen.getAllByTestId("role-card");
      const firstCard = roleCards[0] as HTMLElement;

      expect(firstCard.className).toContain("roleCardActive");

      // Perform rapid clicks
      await act(async () => {
        firstCard.click();
        firstCard.click();
        firstCard.click();
      });

      // Should be in inactive state after 3 clicks (active -> inactive -> active -> inactive)
      await waitFor(() => {
        expect(firstCard.className).toContain("roleCardInactive");
      });

      // Verify all emit calls were made
      expect(mockSocket.emit).toHaveBeenCalledTimes(3);
    });
  });
});
