import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isImageGenerationModel } from '@/lib/aiModels';
import {
  detectChatIntent,
  editNeedsUploadReply,
  shouldTriggerImageGeneration,
} from '@/lib/chatIntent';
import {
  IMAGE_MODEL_HELP_SYSTEM_PROMPT,
  TEXT_ONLY_SYSTEM_PROMPT,
} from '@/lib/chatStream';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

const OR_HEADERS_BASE = {
  'Content-Type': 'application/json',
  'HTTP-Referer': 'https://ipbits.store',
  'X-Title': 'IPBITS AI Hub',
};

function withSystemPrompt(messages, systemText) {
  const list = Array.isArray(messages) ? messages.map((m) => ({ ...m })) : [];
  const idx = list.findIndex((m) => m?.role === 'system');
  if (idx >= 0) {
    const prev = list[idx];
    const existing =
      typeof prev.content === 'string'
        ? prev.content
        : Array.isArray(prev.content)
          ? prev.content
              .filter((p) => p?.type === 'text' && p.text)
              .map((p) => p.text)
              .join('\n')
          : '';
    // Replace bloated prior system with concise prompt (faster TTFT)
    list[idx] = { ...prev, content: systemText || existing };
    return list;
  }
  return [{ role: 'system', content: systemText }, ...list];
}

function extractPromptText(messages) {
  const lastMessage = messages?.[messages.length - 1]?.content;
  if (typeof lastMessage === 'string') return lastMessage;
  if (Array.isArray(lastMessage)) {
    const textPart = lastMessage.find((p) => p.type === 'text');
    return textPart?.text || '';
  }
  return '';
}

function normalizeAssistantContent(message) {
  if (!message) return '';
  const parts = [];
  const pushImage = (url, alt = 'AI Image') => {
    if (!url) return;
    parts.push(`![${alt}](${url})`);
  };

  if (typeof message.content === 'string') {
    parts.push(message.content);
  } else if (Array.isArray(message.content)) {
    for (const part of message.content) {
      if (!part) continue;
      if (typeof part === 'string') {
        parts.push(part);
        continue;
      }
      if (part.type === 'text' && part.text) parts.push(part.text);
      if (part.type === 'image_url') {
        pushImage(part.image_url?.url || part.image_url || part.url);
      }
      if (part.type === 'output_image' || part.type === 'image') {
        pushImage(part.image_url?.url || part.url || part.image);
      }
    }
  }

  if (Array.isArray(message.images)) {
    for (const img of message.images) {
      pushImage(img?.image_url?.url || img?.url || img);
    }
  }

  return parts.filter(Boolean).join('\n\n').trim();
}

async function deductPoints(userProfile, pointsSpent, meta = {}) {
  if (!userProfile?.id || userProfile.points === undefined || pointsSpent <= 0) {
    return userProfile?.points ?? null;
  }
  const remaining = Math.max(0, userProfile.points - pointsSpent);
  await supabase.from('profiles').update({ points: remaining }).eq('id', userProfile.id);
  await supabase.from('points_ledger').insert({
    profile_id: userProfile.id,
    points_change: -pointsSpent,
    action_type: meta.action_type || 'chat',
    model_used: meta.model_used || null,
    cost_usd: meta.cost_usd ?? null,
  });
  return remaining;
}

function computeCostAndPoints(usage, model) {
  let costUsd = Number(usage?.cost ?? usage?.total_cost);
  if (!Number.isFinite(costUsd) || costUsd < 0) {
    const tokens = Number(
      usage?.total_tokens ??
        Number(usage?.prompt_tokens || 0) + Number(usage?.completion_tokens || 0)
    );
    const isFree = String(model || '').includes(':free');
    if (Number.isFinite(tokens) && tokens > 0) {
      costUsd = isFree ? (tokens / 1_000_000) * 0.05 : (tokens / 1_000_000) * 0.5;
    } else {
      costUsd = isFree ? 0 : 0.001;
    }
  }
  const pointsSpent = Math.max(costUsd > 0 ? 1 : 0, Math.ceil(costUsd * 1000));
  return { costUsd, pointsSpent };
}

async function callOpenRouter({ apiKey, model, messages, modalities, stream = false }) {
  const body = {
    model,
    messages,
    stream,
    // Prefer lower-latency providers when OpenRouter supports routing sort
    provider: { sort: 'latency' },
  };
  if (stream) {
    body.stream_options = { include_usage: true };
  }
  if (modalities?.length) body.modalities = modalities;

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      ...OR_HEADERS_BASE,
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (stream) return { response, data: null };

  const data = await response.json().catch(() => ({}));
  return { response, data };
}

async function pollinationsFallback(promptText, model) {
  const cleanPrompt = encodeURIComponent(
    String(promptText || '')
      .replace(/وێنە|چێکە|photo|image|draw|generate|picture|بۆ من|صورة|إنشاء|ارسم/gi, '')
      .trim() || 'beautiful scenery'
  );
  const url = `https://image.pollinations.ai/prompt/${cleanPrompt}?width=1024&height=1024&nologo=true&model=flux`;
  return {
    reply: `![AI Image](${url})`,
    usage: { total_tokens: 0, cost: 0.002 },
    cost_usd: 0.002,
    points_spent: 2,
    model_used: model || 'flux-pollinations',
  };
}

function sseResponse(stream) {
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

/** Instant one-shot SSE (for fixed replies / image markdown). */
function sseOneShot(payload) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const send = (obj) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      send({ type: 'meta', model: payload.model, intent: payload.intent, is_image: !!payload.is_image });
      if (payload.reply) {
        send({ type: 'delta', content: payload.reply, text: payload.reply });
      }
      send({
        type: 'done',
        reply: payload.reply || '',
        usage: payload.usage || null,
        cost_usd: payload.cost_usd ?? 0,
        points_spent: payload.points_spent ?? 0,
        remaining_points: payload.remaining_points ?? null,
        is_image: !!payload.is_image,
        model: payload.model,
        intent: payload.intent,
      });
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    },
  });
  return sseResponse(stream);
}

/**
 * Proxy OpenRouter token stream → client SSE, then deduct points on completion.
 */
function streamTextToClient({
  upstream,
  chatModel,
  intent,
  userProfile,
}) {
  const encoder = new TextEncoder();
  let full = '';
  let usage = null;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
        } catch {
          /* closed */
        }
      };

      send({ type: 'meta', model: chatModel, intent, is_image: false });

      if (!upstream?.ok || !upstream.body) {
        let errMsg = 'ئاریشەیەک هەیە د کلیلێ یان باڵانسی دا';
        try {
          const errData = await upstream.json();
          errMsg = errData?.error?.message || errMsg;
        } catch {
          /* ignore */
        }
        send({ type: 'error', error: errMsg });
        send({
          type: 'done',
          reply: '',
          points_spent: 0,
          cost_usd: 0,
          remaining_points: userProfile?.points ?? null,
          model: chatModel,
          intent,
          error: errMsg,
        });
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
        return;
      }

      const reader = upstream.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      try {
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
              if (json.usage) usage = json.usage;
              const token = json.choices?.[0]?.delta?.content;
              if (typeof token === 'string' && token) {
                full += token;
                send({ type: 'delta', content: token, text: full });
              }
            } catch {
              /* skip bad chunk */
            }
          }
        }
      } catch (err) {
        send({ type: 'error', error: err?.message || 'stream_failed' });
      }

      const { costUsd, pointsSpent } = computeCostAndPoints(usage, chatModel);
      let remainingPoints = userProfile?.points ?? null;
      try {
        remainingPoints = await deductPoints(userProfile, pointsSpent, {
          action_type: 'chat',
          model_used: chatModel,
          cost_usd: costUsd,
        });
      } catch {
        /* non-fatal */
      }

      send({
        type: 'done',
        reply: full,
        usage,
        cost_usd: costUsd,
        points_spent: pointsSpent,
        remaining_points: remainingPoints,
        is_image: false,
        model: chatModel,
        intent,
      });
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    },
  });

  return sseResponse(stream);
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { messages, model, userEmail } = body || {};
    const selectedModel = String(model || 'openai/gpt-4o-mini').trim();
    const imageModel = isImageGenerationModel(selectedModel);
    const promptText = extractPromptText(messages);
    const intent = detectChatIntent({
      prompt: promptText,
      modelIsImage: imageModel,
      messages,
    });

    let activeApiKey = process.env.OPENROUTER_API_KEY;
    let userProfile = null;

    if (userEmail) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, email, api_key, points')
        .eq('email', userEmail)
        .single();

      if (profile) {
        userProfile = profile;
        if (profile.api_key) activeApiKey = profile.api_key;
        if (profile.points !== undefined && profile.points <= 0) {
          return NextResponse.json(
            { error: 'خاڵێن (Points) تە ب داوی هاتینە، هیڤییە باڵانسێ خۆ نووی بکەڤە.' },
            { status: 403 }
          );
        }
      }
    }

    if (!activeApiKey) {
      return NextResponse.json(
        { error: 'چو کلیلا چالاک بۆ ڤی بەکارهێنەری نەهاتە دیتن.' },
        { status: 400 }
      );
    }

    // Instant fixed reply (no model wait)
    if (intent.kind === 'edit_needs_upload') {
      return sseOneShot({
        reply: editNeedsUploadReply(),
        usage: null,
        cost_usd: 0,
        points_spent: 0,
        remaining_points: userProfile?.points ?? null,
        is_image: false,
        model: selectedModel,
        intent: intent.kind,
      });
    }

    const triggerGenerate = shouldTriggerImageGeneration({
      modelIsImage: imageModel,
      prompt: promptText,
      messages,
    });

    // Image generation stays non-streamed (binary/url payload) but returns fast SSE one-shot
    if (triggerGenerate) {
      const imageMessages = Array.isArray(messages)
        ? messages.filter((m) => m?.role !== 'system')
        : [];

      let reply = '';
      let usage = null;
      let costUsd = 0.002;
      let pointsSpent = 2;
      let usedModel = selectedModel;

      try {
        const { response, data } = await callOpenRouter({
          apiKey: activeApiKey,
          model: selectedModel,
          messages: imageMessages.length
            ? imageMessages
            : [{ role: 'user', content: promptText || 'Generate an image' }],
          modalities: ['image', 'text'],
          stream: false,
        });

        if (response.ok) {
          reply = normalizeAssistantContent(data.choices?.[0]?.message);
          usage = data.usage || null;
          const computed = computeCostAndPoints(usage, selectedModel);
          costUsd = computed.costUsd || 0.002;
          pointsSpent = Math.max(2, computed.pointsSpent);
        }
      } catch {
        reply = '';
      }

      if (!reply || !/!\[[^\]]*\]\(|data:image\/|https?:\/\//.test(reply)) {
        const fallback = await pollinationsFallback(promptText, selectedModel);
        reply = fallback.reply;
        usage = fallback.usage;
        costUsd = fallback.cost_usd;
        pointsSpent = fallback.points_spent;
        usedModel = fallback.model_used;
      }

      const remainingPoints = await deductPoints(userProfile, pointsSpent, {
        action_type: 'image_generation',
        model_used: usedModel,
        cost_usd: costUsd,
      });

      return sseOneShot({
        reply,
        usage,
        cost_usd: costUsd,
        points_spent: pointsSpent,
        remaining_points: remainingPoints,
        is_image: true,
        model: usedModel,
        intent: 'generate_image',
      });
    }

    // Streaming text path
    let chatModel = selectedModel;
    if (isImageGenerationModel(selectedModel)) {
      chatModel =
        process.env.OPENROUTER_HELP_MODEL || 'meta-llama/llama-3.2-3b-instruct:free';
    }

    const systemPrompt =
      imageModel || intent.kind === 'text_help'
        ? IMAGE_MODEL_HELP_SYSTEM_PROMPT
        : TEXT_ONLY_SYSTEM_PROMPT;

    const outboundMessages = withSystemPrompt(messages, systemPrompt);
    const { response: upstream } = await callOpenRouter({
      apiKey: activeApiKey,
      model: chatModel,
      messages: outboundMessages,
      stream: true,
    });

    return streamTextToClient({
      upstream,
      chatModel,
      intent: intent.kind,
      userProfile,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
