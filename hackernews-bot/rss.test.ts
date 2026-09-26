import { afterEach, expect, mock, test } from "bun:test";
import { fetchHackerNewsRss } from "./rss";

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

function mockFetch(implementation: () => Promise<Response>) {
  const fetchMock = mock(implementation);
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

test("returns the RSS without retrying on success", async () => {
  const fetchMock = mockFetch(async () => new Response("<rss/>"));
  expect(await fetchHackerNewsRss()).toBe("<rss/>");
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test("retries network and HTTP failures before succeeding", async () => {
  let attempt = 0;
  const fetchMock = mockFetch(async () => {
    attempt++;
    if (attempt === 1) throw new Error("Network failure");
    if (attempt === 2) return new Response("Unavailable", { status: 503 });
    return new Response("<rss/>");
  });
  expect(await fetchHackerNewsRss()).toBe("<rss/>");
  expect(fetchMock).toHaveBeenCalledTimes(3);
});

test("retries response body read failures", async () => {
  let attempt = 0;
  const fetchMock = mockFetch(async () => {
    if (++attempt === 1) {
      return new Response(new ReadableStream({
        start(controller) { controller.error(new Error("Body read failure")); },
      }));
    }
    return new Response("<rss/>");
  });
  expect(await fetchHackerNewsRss()).toBe("<rss/>");
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

test("throws the final HTTP error after three failed attempts", async () => {
  const fetchMock = mockFetch(async () => new Response("Unavailable", { status: 503 }));
  await expect(fetchHackerNewsRss()).rejects.toThrow("HTTP 503");
  expect(fetchMock).toHaveBeenCalledTimes(3);
});
