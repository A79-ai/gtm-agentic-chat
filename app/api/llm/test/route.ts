import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createGateway, generateText, type LanguageModel } from "ai";

// Validate a user's bring-your-own LLM key with a tiny live call, WITHOUT going
// through the durable chat workflow. The key arrives per-request as x-llm-* and
// is never persisted — same contract as the chat route. Built plainly here (not
// via resolveModel, which returns workflow-registered step factories meant to run
// inside DurableAgent) so this stays a simple one-shot server call.

const CORS = {
  "Access-Control-Allow-Origin": process.env.ALLOWED_ORIGIN || "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, x-llm-provider, x-llm-key, x-llm-model",
};

const DEFAULT_MODEL: Record<string, string> = {
  anthropic: "claude-sonnet-4-6",
  openai: "gpt-4o",
  google: "gemini-2.5-pro",
  gateway: "anthropic/claude-sonnet-4.6",
};

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

function buildModel(provider: string, apiKey: string, model: string): LanguageModel | null {
  switch (provider) {
    case "anthropic":
      return createAnthropic({ apiKey })(model);
    case "openai":
      return createOpenAI({ apiKey })(model);
    case "google":
      return createGoogleGenerativeAI({ apiKey })(model);
    case "gateway":
      return createGateway({ apiKey })(model);
    default:
      return null;
  }
}

export async function POST(req: Request) {
  const provider = req.headers.get("x-llm-provider") || "";
  const apiKey = req.headers.get("x-llm-key") || "";
  const model = req.headers.get("x-llm-model") || DEFAULT_MODEL[provider] || "";

  if (!(provider && apiKey)) {
    return Response.json(
      { ok: false, error: "Pick a provider and enter a key." },
      { status: 400, headers: CORS }
    );
  }
  const llm = buildModel(provider, apiKey, model);
  if (!llm) {
    return Response.json(
      { ok: false, error: `Unknown provider "${provider}".` },
      { status: 400, headers: CORS }
    );
  }

  try {
    await generateText({
      model: llm,
      prompt: "Reply with the single word: ok",
      maxOutputTokens: 8,
    });
    return Response.json({ ok: true, model }, { headers: CORS });
  } catch (err) {
    const raw = err instanceof Error ? err.message : "The provider rejected the request.";
    return Response.json({ ok: false, error: raw.slice(0, 200) }, { status: 200, headers: CORS });
  }
}
