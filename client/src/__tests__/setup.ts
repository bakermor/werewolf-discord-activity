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

// Handle unhandled rejections from top-level setupDiscordSdk call in main.ts
// This is necessary because main.ts calls setupDiscordSdk() at module load time
process.on("unhandledRejection", (reason: unknown) => {
  if (
    reason instanceof Error &&
    reason.message.includes("Discord Client ID not found")
  ) {
    // Expected during test setup - ignore
    return;
  }
  // Re-throw unexpected rejections
  throw reason;
});
