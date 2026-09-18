import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isImageGenerationModel } from '@/lib/aiModels';
import {
  detectChatIntent,
  editNeedsUploadReply,
  HONEST_CHAT_SYSTEM_ADDON,
  shouldTriggerImageGeneration,
} from '@/lib/chatIntent';

// گرێدان ب داتابەیسا Supabase ب کلیلا Service Role یان Anon
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

/** Base system instructions for text chat models only (never for image generation). */
const TEXT_ONLY_SYSTEM_PROMPT = `You are a helpful AI assistant. When the active model is text-only, you CANNOT directly generate, draw, render, or attach image files.
If the user asks you in any language to create, draw, or generate an image (e.g., 'وێنەیەک چێکە', 'وێنەیەک دروست بکە', 'draw an image'):
- Never pretend or claim that you have generated or attached an image.
- Politely inform the user in their language that this model is text-only and cannot render image files.
- Suggest switching to an Image model (Flux / Stable Diffusion) in the model picker for generation, or offer to write an optimized Midjourney/Flux prompt — be fully transparent that you cannot produce actual images yourself.

${HONEST_CHAT_SYSTEM_ADDON}`;

/** When an image model is selected but the user asked a question / needs guidance. */
const IMAGE_MODEL_HELP_SYSTEM_PROMPT = `You are assisting inside IPBITS AI Hub. An image-generation model is selected, but the user's latest message is NOT an explicit command to generate a new image.
Respond with clear conversational text only — do NOT generate, invent, or attach any image.
- If they ask whether you can edit/create images: explain that generation needs an imperative prompt (e.g. "generate an image of a cat on the moon" / "وێنەیەک چێکە بۆ...") while this image model is selected; editing needs an uploaded photo plus edit instructions.
- If they want edits without an attachment: ask them to upload the image first and describe the adjustments.
- Answer how-to / informational questions helpfully and honestly. Never output markdown image embeds or random scenery.

${HONEST_CHAT_SYSTEM_ADDON}`;

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
    list[idx] = {
      ...prev,
      content: existing ? `${existing.trim()}\n\n${systemText}` : systemText,
    };
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

/** Normalize OpenRouter assistant content → markdown string (with image embeds). */
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
        const url = part.image_url?.url || part.image_url || part.url;
        pushImage(url);
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

async function callOpenRouter({ apiKey, model, messages, modalities }) {
  const body = {
    model,
    messages,
  };
  if (modalities?.length) body.modalities = modalities;

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://ipbits.store',
      'X-Title': 'IPBITS AI Hub',
    },
    body: JSON.stringify(body),
  });

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

async function runTextCompletion({
  apiKey,
  model,
  messages,
  systemPrompt,
  userProfile,
}) {
  // Prefer a chat-capable model when the picker has an image-only slug selected
  // but the user asked a question — fall back to a free text model if needed.
  let chatModel = model;
  if (isImageGenerationModel(model)) {
    chatModel =
      process.env.OPENROUTER_HELP_MODEL ||
      'meta-llama/llama-3.2-3b-instruct:free';
  }

  const outboundMessages = withSystemPrompt(messages, systemPrompt);
  const { response, data } = await callOpenRouter({
    apiKey,
    model: chatModel,
    messages: outboundMessages,
  });

  if (!response.ok) {
    const errMsg = data.error?.message || 'ئاریشەیەک هەیە د کلیلێ یان باڵانسی دا';
    return { error: errMsg, status: response.status };
  }

  const reply =
    normalizeAssistantContent(data.choices?.[0]?.message) ||
    data.choices?.[0]?.message?.content ||
    'بەرسڤ نەهات.';
  const usage = data.usage || null;
  const { costUsd, pointsSpent } = computeCostAndPoints(usage, chatModel);
  const remainingPoints = await deductPoints(userProfile, pointsSpent, {
    action_type: 'chat',
    model_used: chatModel,
    cost_usd: costUsd,
  });

  return {
    reply,
    usage,
    cost_usd: costUsd,
    points_spent: pointsSpent,
    remaining_points: remainingPoints,
    is_image: false,
    model: chatModel,
  };
}

export async function POST(req) {
  try {
    const { messages, model, userEmail } = await req.json();
    const selectedModel = String(model || 'openai/gpt-4o-mini').trim();
    const imageModel = isImageGenerationModel(selectedModel);
    const promptText = extractPromptText(messages);
    const intent = detectChatIntent({
      prompt: promptText,
      modelIsImage: imageModel,
      messages,
    });

    // ١. ئینانا زانیاریێن کڕیاری و پشکنینا باڵانسی ژ profiles
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
        if (profile.api_key) {
          activeApiKey = profile.api_key;
        }
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

    // Edit request without an uploaded image → ask to attach (no generation, no points burn on fake art)
    if (intent.kind === 'edit_needs_upload') {
      return NextResponse.json({
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

    // ٢. Image generation ONLY when image model + explicit imperative command
    const triggerGenerate = shouldTriggerImageGeneration({
      modelIsImage: imageModel,
      prompt: promptText,
      messages,
    });

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

      return NextResponse.json({
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

    // ٣. Conversational text — image model selected but question/help, OR normal text model
    const systemPrompt =
      imageModel || intent.kind === 'text_help'
        ? IMAGE_MODEL_HELP_SYSTEM_PROMPT
        : TEXT_ONLY_SYSTEM_PROMPT;

    const result = await runTextCompletion({
      apiKey: activeApiKey,
      model: selectedModel,
      messages,
      systemPrompt,
      userProfile,
    });

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: result.status || 500 });
    }

    return NextResponse.json({
      ...result,
      intent: intent.kind,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
