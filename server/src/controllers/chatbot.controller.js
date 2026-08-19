const OpenAI = require('openai');
const { getToolsForRole, executeTool } = require('../services/chatbot.service');

let client = null;

function getClient() {
  if (!client && process.env.GROQ_API_KEY) {
    client = new OpenAI({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: 'https://api.groq.com/openai/v1',
    });
  }
  return client;
}

const MAX_TOOL_ROUNDS = 5;
const TOOL_RETRY_LIMIT = 2;
const RATE_LIMIT_RETRY_LIMIT = 2;

// Tool selection across ~19 tools, and getting figures out of tool results without
// garbling them, needs more capacity than the 8b model had: it misread combined totals
// as per-student, mangled amounts, and answered questions its role had no tool for.
// Groq decommissioned llama-3.3-70b-versatile on 2026-08-16; this is the replacement
// they point at, and it likewise supports tool calling.
const CHAT_MODEL = 'openai/gpt-oss-120b';

// Models occasionally emit malformed tool-call syntax (a broken closing tag, a param
// belonging to another tool, "null" as a string). Groq rejects those with a 400 before
// anything runs, so the whole request used to fail. It is stochastic, so retry a couple
// of times, then fall back to answering without tools rather than erroring out.
function isMalformedToolCall(error) {
  const code = error?.error?.code || error?.code;
  return error?.status === 400 && (code === 'tool_use_failed' || code === 'invalid_tool_call');
}

// The larger model has tighter per-minute token limits on Groq, and each request carries
// the full tool schema set, so bursts do get throttled. Wait and retry rather than
// failing the user's question.
function isRateLimited(error) {
  const code = error?.error?.code || error?.code;
  return error?.status === 429 || code === 'rate_limit_exceeded';
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Parse Groq's reset hints, e.g. "205ms", "1.5s", "37m26.4s".
function parseResetDuration(value) {
  if (!value) return null;
  const match = /^(?:(\d+(?:\.\d+)?)m(?![s]))?(?:(\d+(?:\.\d+)?)s)?(?:(\d+(?:\.\d+)?)ms)?$/.exec(
    String(value).trim()
  );
  if (!match || !match.slice(1).some(Boolean)) return null;
  const [, minutes, seconds, millis] = match;
  return (Number(minutes || 0) * 60 + Number(seconds || 0)) * 1000 + Number(millis || 0);
}

// The token window is per-minute, so a throttled request needs to wait for the window to
// roll over — an 8s cap was not enough. Prefer the server's own hints, and allow up to
// a full window before giving up.
function retryDelayMs(error, attempt) {
  const headers = error?.headers;
  const retryAfter = Number(headers?.get?.('retry-after'));
  if (Number.isFinite(retryAfter) && retryAfter > 0) {
    return Math.min(retryAfter * 1000, 65000);
  }

  const resetTokens = parseResetDuration(headers?.get?.('x-ratelimit-reset-tokens'));
  if (resetTokens) return Math.min(resetTokens + 500, 65000);

  return Math.min(2000 * 2 ** attempt, 30000);
}

async function createCompletion(ai, requestOpts) {
  let malformedAttempts = 0;
  let throttledAttempts = 0;

  for (;;) {
    try {
      return await ai.chat.completions.create(requestOpts);
    } catch (error) {
      if (isMalformedToolCall(error) && malformedAttempts < TOOL_RETRY_LIMIT) {
        malformedAttempts++;
        console.warn(
          `Chatbot: malformed tool call, retrying (${malformedAttempts}/${TOOL_RETRY_LIMIT})`
        );
        continue;
      }

      if (isRateLimited(error) && throttledAttempts < RATE_LIMIT_RETRY_LIMIT) {
        const wait = retryDelayMs(error, throttledAttempts);
        throttledAttempts++;
        console.warn(
          `Chatbot: rate limited, waiting ${wait}ms then retrying (${throttledAttempts}/${RATE_LIMIT_RETRY_LIMIT})`
        );
        await sleep(wait);
        continue;
      }

      throw error;
    }
  }
}

function buildSystemPrompt(user) {
  const now = new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' });
  return `You are a helpful assistant for PAC DMS (Dormitory Management System).
You help users with questions about residents, campus activity, announcements, leave requests,
payments and billing, gatepasses, room occupancy, assigned tasks, incident reports, and visitors.

Current user: ${user.firstName} ${user.lastName} (ID: ${user.id}), role: ${user.role}
Current date/time: ${now}

Rules:
- Be concise and helpful
- Only share information the user is authorized to see based on their role
- If you don't have enough information, ask for clarification
- Use the provided tools to query the database — do not make up information
- Never state a figure, count, name or date you did not get back from a tool
- If no tool is available for what was asked, say you do not have access to that information for this role — do not guess and do not answer from assumption
- Format responses in a friendly, conversational tone
- When presenting lists or data, use clear formatting
- If a tool returns an error about access, explain that the user doesn't have permission for that information
- When a resident asks about "my" data (my bills, my leave requests, etc.), they mean their own data — search using their own name or ID
- Show peso amounts with a ₱ prefix and thousands separators
- For "who owes money" style questions use list_unpaid_bills; for one specific bill's payment history use get_bill_details
- If get_bill_details returns needs_disambiguation, list the candidate bills and ask which one they mean — do not guess`;
}

exports.sendMessage = async (req, res) => {
  try {
    if (!process.env.GROQ_API_KEY) {
      return res.status(500).json({ error: 'Chatbot is not configured. Missing API key.' });
    }

    const { message, history } = req.body;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'Message is required.' });
    }

    const user = req.user;
    const tools = getToolsForRole(user.role);

    // Build messages array
    const messages = [{ role: 'system', content: buildSystemPrompt(user) }];

    // Add conversation history (limit to last 20 messages to manage tokens)
    if (Array.isArray(history)) {
      const recentHistory = history.slice(-20);
      for (const msg of recentHistory) {
        if (msg.role === 'user' || msg.role === 'assistant') {
          messages.push({ role: msg.role, content: msg.content });
        }
      }
    }

    // Add current message
    messages.push({ role: 'user', content: message });

    const ai = getClient();
    if (!ai) {
      return res.status(500).json({ error: 'Chatbot is not configured. Missing API key.' });
    }

    // Call Groq via OpenAI-compatible API
    const requestOpts = {
      model: CHAT_MODEL,
      messages,
      max_tokens: 1024,
      ...(tools.length > 0 && {
        tools,
        tool_choice: 'auto',
        parallel_tool_calls: false,
      }),
    };

    let response = await createCompletion(ai, requestOpts);

    let assistantMessage = response.choices[0].message;
    let rounds = 0;

    // Tool call loop
    while (assistantMessage.tool_calls && rounds < MAX_TOOL_ROUNDS) {
      rounds++;
      messages.push(assistantMessage);

      // Execute all tool calls in parallel
      const toolResults = await Promise.all(
        assistantMessage.tool_calls.map(async (toolCall) => {
          const args = JSON.parse(toolCall.function.arguments);
          const result = await executeTool(toolCall.function.name, args, user);
          return {
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(result),
          };
        })
      );

      messages.push(...toolResults);

      response = await createCompletion(ai, requestOpts);

      assistantMessage = response.choices[0].message;
    }

    const content = assistantMessage.content || 'Sorry, I was unable to generate a response.';
    res.json({ success: true, message: content });
  } catch (error) {
    console.error('Chatbot error:', error);

    if (error?.status === 401 || error?.code === 'invalid_api_key') {
      return res.status(500).json({ error: 'Chatbot API key is invalid.' });
    }

    if (isRateLimited(error)) {
      return res.status(503).json({
        error: 'The assistant is busy right now (rate limited). Please try again in a moment.',
      });
    }

    // Retries were exhausted on a malformed tool call: answer without tools so the
    // user gets a usable reply instead of a failure.
    if (isMalformedToolCall(error)) {
      try {
        const ai = getClient();
        const retry = await ai.chat.completions.create({
          model: CHAT_MODEL,
          messages: [
            {
              role: 'system',
              content: `${buildSystemPrompt(req.user)}

IMPORTANT: You have no database access for this reply and no tools are available.
Do not emit function or tool call syntax. If the question needs a database lookup,
say plainly that you could not retrieve the data right now and suggest they try again.`,
            },
            { role: 'user', content: req.body?.message || '' },
          ],
          max_tokens: 1024,
        });

        const fallbackText = (retry.choices[0].message.content || '').trim();
        // Without tools bound the model still sometimes emits function-call syntax;
        // never surface that to the user.
        const leakedToolSyntax = /function\s*=|<\/?function|"tool_calls"/i.test(fallbackText);

        return res.json({
          success: true,
          message:
            !fallbackText || leakedToolSyntax
              ? 'Sorry, I could not look that up just now. Please try asking again.'
              : fallbackText,
        });
      } catch (fallbackError) {
        console.error('Chatbot fallback failed:', fallbackError.message);
      }
    }

    res.status(500).json({ error: 'Failed to process chatbot message.' });
  }
};
