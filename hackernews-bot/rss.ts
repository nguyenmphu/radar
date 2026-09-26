export async function fetchHackerNewsRss(): Promise<string> {
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch("https://hnrss.org/newest");
      if (!response.ok) {
        await response.body?.cancel();
        throw new Error(`Hacker News RSS request failed: HTTP ${response.status}`);
      }
      return await response.text();
    } catch (error) {
      if (attempt === maxAttempts) {
        throw error;
      }
      const delayMs = 1000 * 2 ** (attempt - 1);
      console.warn(
        `Hacker News RSS attempt ${attempt}/${maxAttempts} failed; retrying in ${delayMs}ms`,
        error,
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw new Error("Hacker News RSS retrieval failed");
}
