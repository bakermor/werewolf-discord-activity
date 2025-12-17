import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
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

vi.mock("../discordSetup", () => ({
  setupDiscordSdk: vi.fn(),
}));

import { setupDiscordSdk } from "../discordSetup";

describe("App", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("displays loading state initially", () => {
    vi.mocked(setupDiscordSdk).mockReturnValue(new Promise(() => {})); // Never resolves

    render(<App />);

    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("displays the main content after successful setup", async () => {
    vi.mocked(setupDiscordSdk).mockResolvedValue({
      access_token: "test-token",
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
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Hello, World!")).toBeInTheDocument();
    });

    expect(screen.getByAltText("Discord")).toBeInTheDocument();
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
});
