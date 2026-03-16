import Router from "koa-router";
import { z } from "zod";
import { AuthenticationError, InvalidRequestError } from "@server/errors";
import Logger from "@server/logging/Logger";
import auth from "@server/middlewares/authentication";
import { rateLimiter } from "@server/middlewares/rateLimiter";
import validate from "@server/middlewares/validate";
import type { APIContext } from "@server/types";
import env from "../env";

const router = new Router();

const AICompleteSchema = z.object({
  body: z.object({
    /** The selected text to act on */
    text: z.string().min(1).max(10000),
    /** The action to perform */
    action: z.enum([
      "improve",
      "summarize",
      "continue",
      "translate",
      "fix_spelling",
      "make_shorter",
      "make_longer",
    ]),
    /** Optional context (surrounding document text) */
    context: z.string().max(5000).optional(),
    /** Target language for translate action */
    language: z.string().optional(),
  }),
});

type AICompleteReq = z.infer<typeof AICompleteSchema>;

const ACTION_PROMPTS: Record<string, (text: string, opts?: Record<string, string>) => string> = {
  improve: (text) =>
    `Improve the following text to make it clearer, more concise, and more professional. Return only the improved text with no explanation or preamble:\n\n${text}`,
  summarize: (text) =>
    `Summarize the following text in a concise paragraph. Return only the summary with no explanation or preamble:\n\n${text}`,
  continue: (text) =>
    `Continue writing from where the following text ends. Match the style and tone. Return only the continuation, not the original text:\n\n${text}`,
  translate: (text, opts) =>
    `Translate the following text to ${opts?.language ?? "English"}. Return only the translated text with no explanation or preamble:\n\n${text}`,
  fix_spelling: (text) =>
    `Fix any spelling and grammar errors in the following text. Return only the corrected text with no explanation or preamble:\n\n${text}`,
  make_shorter: (text) =>
    `Make the following text shorter while preserving its meaning. Return only the shortened text with no explanation or preamble:\n\n${text}`,
  make_longer: (text) =>
    `Expand the following text with more detail and depth. Return only the expanded text with no explanation or preamble:\n\n${text}`,
};

async function callAnthropic(prompt: string): Promise<string> {
  const model = env.AI_MODEL ?? "claude-3-5-haiku-latest";
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${error}`);
  }

  const data = (await response.json()) as {
    content: Array<{ type: string; text: string }>;
  };
  return data.content[0]?.text ?? "";
}

async function callOpenAI(prompt: string): Promise<string> {
  const model = env.AI_MODEL ?? "gpt-4o-mini";
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error ${response.status}: ${error}`);
  }

  const data = (await response.json()) as {
    choices: Array<{ message: { content: string } }>;
  };
  return data.choices[0]?.message?.content ?? "";
}

router.post(
  "ai.complete",
  rateLimiter({ requests: 20, window: 60 }),
  auth(),
  validate(AICompleteSchema),
  async (ctx: APIContext<AICompleteReq>) => {
    if (!env.AI_PROVIDER) {
      throw new InvalidRequestError("AI_PROVIDER is not configured");
    }

    const { text, action, language } = ctx.input.body;
    const promptFn = ACTION_PROMPTS[action];

    if (!promptFn) {
      throw new InvalidRequestError(`Unknown action: ${action}`);
    }

    const prompt = promptFn(text, language ? { language } : undefined);

    Logger.debug("plugins", "AI complete request", {
      action,
      provider: env.AI_PROVIDER,
      textLength: text.length,
    });

    let result: string;

    try {
      if (env.AI_PROVIDER === "anthropic") {
        if (!env.ANTHROPIC_API_KEY) {
          throw new InvalidRequestError("ANTHROPIC_API_KEY is not configured");
        }
        result = await callAnthropic(prompt);
      } else if (env.AI_PROVIDER === "openai") {
        if (!env.OPENAI_API_KEY) {
          throw new InvalidRequestError("OPENAI_API_KEY is not configured");
        }
        result = await callOpenAI(prompt);
      } else {
        throw new InvalidRequestError(
          `Unsupported AI_PROVIDER: ${env.AI_PROVIDER}`
        );
      }
    } catch (err) {
      Logger.error("AI completion failed", err, {
        action,
        provider: env.AI_PROVIDER,
      });
      throw err;
    }

    ctx.body = {
      data: { text: result },
    };
  }
);

export default router;
