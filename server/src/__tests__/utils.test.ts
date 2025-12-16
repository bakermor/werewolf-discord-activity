import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchAndRetry } from "../utils";

describe("fetchAndRetry", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("returns response on success without retry", async () => {
    const mockResponse = new Response(JSON.stringify({ ok: true }), {
      status: 200,
    });
    const fetchMock = vi.fn().mockResolvedValue(mockResponse);
    vi.stubGlobal("fetch", fetchMock);

    const resultPromise = fetchAndRetry("https://example.com/api");
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result).toBe(mockResponse);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.com/api",
      undefined
    );
  });

  it("retries on 429 with valid retry_after header", async () => {
    const rateLimitResponse = new Response(null, {
      status: 429,
      headers: { retry_after: "2" },
    });
    const successResponse = new Response(JSON.stringify({ ok: true }), {
      status: 200,
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(rateLimitResponse)
      .mockResolvedValueOnce(successResponse);
    vi.stubGlobal("fetch", fetchMock);

    const resultPromise = fetchAndRetry("https://example.com/api");
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result).toBe(successResponse);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("returns 429 response immediately when retry_after is invalid", async () => {
    const rateLimitResponse = new Response(null, {
      status: 429,
      headers: { retry_after: "invalid" },
    });
    const fetchMock = vi.fn().mockResolvedValue(rateLimitResponse);
    vi.stubGlobal("fetch", fetchMock);

    const resultPromise = fetchAndRetry("https://example.com/api");
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result).toBe(rateLimitResponse);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("throws error after exhausting retries on network failure", async () => {
    const networkError = new Error("Network failure");
    const fetchMock = vi.fn().mockRejectedValue(networkError);
    vi.stubGlobal("fetch", fetchMock);

    const resultPromise = fetchAndRetry(
      "https://example.com/api",
      undefined,
      1
    );

    let caughtError: Error | undefined;
    resultPromise.catch((err) => {
      caughtError = err;
    });

    await vi.runAllTimersAsync();

    await expect(resultPromise).rejects.toThrow("Network failure");
    expect(caughtError).toBe(networkError);
    expect(fetchMock).toHaveBeenCalledTimes(2); // Initial + 1 retry
  });
});
