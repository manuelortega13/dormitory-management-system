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

function buildSystemPrompt(user) {
  const now = new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' });
  return `You are a helpful assistant for a university dormitory management system.
You help users with questions about residents, campus activity, announcements, leave requests, payments, rooms, and visitors.

Current user: ${user.firstName} ${user.lastName} (ID: ${user.id}), role: ${user.role}
Current date/time: ${now}

Rules:
- Be concise and helpful
- Only share information the user is authorized to see based on their role
- If you don't have enough information, ask for clarification
- Use the provided tools to query the database — do not make up information
- Format responses in a friendly, conversational tone
- When presenting lists or data, use clear formatting
- If a tool returns an error about access, explain that the user doesn't have permission for that information
- When a resident asks about "my" data (my bills, my leave requests, etc.), they mean their own data — search using their own name or ID`;
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
      model: 'llama-3.1-8b-instant',
      messages,
      max_tokens: 1024,
      ...(tools.length > 0 && {
        tools,
        tool_choice: 'auto',
        parallel_tool_calls: false,
      }),
    };

    let response = await ai.chat.completions.create(requestOpts);

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

      response = await ai.chat.completions.create(requestOpts);

      assistantMessage = response.choices[0].message;
    }

    const content = assistantMessage.content || 'Sorry, I was unable to generate a response.';
    res.json({ success: true, message: content });
  } catch (error) {
    console.error('Chatbot error:', error);

    if (error?.status === 401 || error?.code === 'invalid_api_key') {
      return res.status(500).json({ error: 'Chatbot API key is invalid.' });
    }

    res.status(500).json({ error: 'Failed to process chatbot message.' });
  }
};
