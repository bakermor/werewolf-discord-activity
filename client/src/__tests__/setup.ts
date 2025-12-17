import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Automatic cleanup after each test
afterEach(() => {
  cleanup();
});

// Suppress console.error for expected error messages during tests
const originalError = console.error;
console.error = (...args: unknown[]) => {
  const message = args[0];
  if (
    typeof message === "string" &&
    message.includes("Discord SDK setup failed")
  ) {
    // Suppress expected error logs from setupDiscordSdk
    return;
  }
  originalError.apply(console, args);
};
