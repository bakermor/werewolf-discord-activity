// Suppress console.error for expected error messages during tests
const originalError = console.error;
console.error = (...args: unknown[]) => {
  const message = args[0];
  if (
    typeof message === "string" &&
    message.includes("Token exchange failed")
  ) {
    // Suppress expected error logs from token endpoint
    return;
  }
  originalError.apply(console, args);
};

