/** Read an OpenRouter SSE chat stream and call `onDelta` with the growing text. */
export async function readOpenRouterSse(response, onDelta) {
  const reader = response.body?.getReader();
  if (!reader) return '';

  const decoder = new TextDecoder();
  let buffer = '';
  let full = '';

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
      const payload = line.slice(5).trim();
      if (!payload || payload === '[DONE]') continue;
      try {
        const json = JSON.parse(payload);
        const token = json.choices?.[0]?.delta?.content;
        if (typeof token === 'string' && token) {
          full += token;
          onDelta?.(full);
        }
      } catch {
        /* ignore malformed chunks */
      }
    }
  }

  return full;
}
