/**
 * Concise system prompts — kept short for low TTFT / prompt-cache friendliness.
 */
export const TEXT_ONLY_SYSTEM_PROMPT =
  'Text-only assistant. Never claim you created or attached an image. For image asks: say you are text-only, suggest Flux/Image models, or write a Midjourney/Flux prompt. Be direct and honest. If they want photo edits without an upload, ask them to attach the image first.';

export const IMAGE_MODEL_HELP_SYSTEM_PROMPT =
  'Image model is selected but this message is not an explicit generate command. Reply in text only — no images. Explain: generation needs an imperative prompt (e.g. "generate an image of…"); edits need an uploaded photo + instructions. Be helpful and honest.';

/** Read IPBITS / OpenRouter SSE and invoke callbacks. Returns final text. */
export async function readIpbitsChatSse(response, { onDelta, onMeta, onDone, onError } = {}) {
  const reader = response.body?.getReader();
  if (!reader) return { text: '', meta: null };

  const decoder = new TextDecoder();
  let buffer = '';
  let full = '';
  let doneMeta = null;

  const handlePayload = (payload) => {
    if (!payload || payload === '[DONE]') return;
    try {
      const json = JSON.parse(payload);

      // Our envelope
      if (json.type === 'meta') {
        onMeta?.(json);
        return;
      }
      if (json.type === 'delta' || json.type === 'token') {
        if (typeof json.text === 'string' && json.text.length >= full.length) {
          full = json.text;
          onDelta?.(full, typeof json.content === 'string' ? json.content : '');
          return;
        }
        const piece = typeof json.content === 'string' ? json.content : '';
        if (piece) {
          full += piece;
          onDelta?.(full, piece);
        }
        return;
      }
      if (json.type === 'done') {
        if (typeof json.reply === 'string' && json.reply) full = json.reply;
        doneMeta = json;
        onDone?.(json);
        return;
      }
      if (json.type === 'error') {
        onError?.(json.error || 'stream_error');
        return;
      }

      // Raw OpenRouter chunk passthrough
      const token = json.choices?.[0]?.delta?.content;
      if (typeof token === 'string' && token) {
        full += token;
        onDelta?.(full, token);
      }
      if (json.usage) {
        doneMeta = { ...(doneMeta || {}), usage: json.usage };
      }
    } catch {
      /* ignore malformed chunks */
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const raw of lines) {
      const line = raw.trim();
      if (!line || line.startsWith(':')) continue;
      if (!line.startsWith('data:')) continue;
      handlePayload(line.slice(5).trim());
    }
  }

  if (buffer.trim().startsWith('data:')) {
    handlePayload(buffer.trim().slice(5).trim());
  }

  return { text: full, meta: doneMeta };
}

/** @deprecated use readIpbitsChatSse */
export async function readOpenRouterSse(response, onDelta) {
  const { text } = await readIpbitsChatSse(response, { onDelta });
  return text;
}
