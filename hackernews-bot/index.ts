import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { fetchHackerNewsRss } from "./rss";

interface Env {
  GEMINI_API_KEY: string;
  DISCORD_WEBHOOK_URL: string;
}

export default {
  // Scheduled Cron Handler
  async scheduled(
    event: ScheduledEvent,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    ctx.waitUntil(runAutomation(env));
  },

  // HTTP Handler for manual testing
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    await runAutomation(env);
    return new Response("Automation executed and sent to Discord!", {
      status: 200,
    });
  },
};

async function runAutomation(env: Env): Promise<void> {
  const rssText = await fetchHackerNewsRss();

  const model = new ChatGoogleGenerativeAI({
    model: "gemini-3.6-flash",
    apiKey: env.GEMINI_API_KEY,
    temperature: 0.2,
  });

  const prompt = `You are an executive news summarizer. Analyze the provided Hacker News RSS feed and generate a digest covering the feed items.

Format each news item strictly in this structure:
# <Title>
> <<Original Link>>
<<Hacker News Link>>
<Concise content summary with highlighted key points>
<Summary of Hacker News comments>
Note that the links are always in "<>". For example: write <https://example.com> instead of https://example.com.

Raw Hacker News RSS XML:
${rssText.substring(0, 15000)}`;

  const response = await model.invoke(prompt);
  const digestText =
    typeof response.content === "string"
      ? response.content
      : JSON.stringify(response.content);

  await sendToDiscordInChunks(env.DISCORD_WEBHOOK_URL, digestText);
}

async function sendToDiscordInChunks(
  webhookUrl: string,
  content: string,
): Promise<void> {
  const maxLength = 1900;
  const lines = content.split("\n");
  let currentChunk = "";

  for (const line of lines) {
    if ((currentChunk + line + "\n").length > maxLength) {
      await postWebhook(webhookUrl, currentChunk);
      currentChunk = "";
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    currentChunk += line + "\n";
  }

  if (currentChunk.trim()) {
    await postWebhook(webhookUrl, currentChunk);
  }
}

async function postWebhook(webhookUrl: string, text: string): Promise<void> {
  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: text }),
  });
}
