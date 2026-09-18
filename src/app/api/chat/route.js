import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// گرێدان ب داتابەیسا Supabase ب کلیلا Service Role یان Anon
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

/** Base system instructions for all text chat models (Gemini / Claude / OpenRouter). */
const TEXT_ONLY_SYSTEM_PROMPT = `You are a text-only language model and CANNOT directly generate, draw, render, or attach image files.
If the user asks you in any language to create, draw, or generate an image (e.g., 'وێنەیەک چێکە', 'وێنەیەک دروست بکە', 'draw an image'):
- Never pretend or claim that you have generated or attached an image.
- Politely inform the user in their language that this model is text-only and cannot render image files.
- Offer to write an optimized descriptive prompt for image tools (like Midjourney or Flux) if they want, but be fully transparent that you cannot produce actual images.`;

/** Prepend / merge the text-only rule into the outbound message list. */
function withTextOnlySystemPrompt(messages) {
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
      content: existing
        ? `${existing.trim()}\n\n${TEXT_ONLY_SYSTEM_PROMPT}`
        : TEXT_ONLY_SYSTEM_PROMPT,
    };
    return list;
  }
  return [{ role: 'system', content: TEXT_ONLY_SYSTEM_PROMPT }, ...list];
}

export async function POST(req) {
  try {
    const { messages, model, userEmail } = await req.json();

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
        // ئەگەر خاڵێن وی تەمام بووبن (٠ یان کێمتر)
        if (profile.points !== undefined && profile.points <= 0) {
          return NextResponse.json(
            { error: "خاڵێن (Points) تە ب داوی هاتینە، هیڤییە باڵانسێ خۆ نووی بکەڤە." },
            { status: 403 }
          );
        }
      }
    }

    if (!activeApiKey) {
      return NextResponse.json(
        { error: "چو کلیلا چالاک بۆ ڤی بەکارهێنەری نەهاتە دیتن." },
        { status: 400 }
      );
    }

    // ٢. پشکنینا دروستکرنا وێنەیان
    const lastMessage = messages[messages.length - 1]?.content;
    let promptText = '';

    if (typeof lastMessage === 'string') {
      promptText = lastMessage;
    } else if (Array.isArray(lastMessage)) {
      const textPart = lastMessage.find(p => p.type === 'text');
      promptText = textPart?.text || '';
    }

    const lowerText = promptText.toLowerCase();
    const isImageModel = model?.includes('flux') || model?.includes('recraft');
    const hasImageKeyword = 
      lowerText.includes('وێنە') || 
      lowerText.includes('چێکە') || 
      lowerText.includes('صورة') || 
      lowerText.includes('image') || 
      lowerText.includes('photo');

    if (isImageModel || (hasImageKeyword && !lowerText.includes('شیکار'))) {
      const cleanPrompt = encodeURIComponent(
        promptText.replace(/وێنە|چێکە|photo|image|draw|generate|picture|بۆ من|صورة/gi, '').trim() || 'beautiful scenery'
      );
      const generatedImageUrl = `https://image.pollinations.ai/prompt/${cleanPrompt}?width=1024&height=1024&nologo=true&model=flux`;

      // کێمکرنا خاڵێن وێنەی د داتابەیسێ دا (٢ خاڵ)
      if (userProfile?.id && userProfile.points !== undefined) {
        await supabase
          .from('profiles')
          .update({ points: Math.max(0, userProfile.points - 2) })
          .eq('id', userProfile.id);

        // تۆمارکرن د مێژوویا خاڵان دا (points_ledger)
        await supabase.from('points_ledger').insert({
          profile_id: userProfile.id,
          points_change: -2,
          action_type: 'image_generation',
          model_used: 'flux-pollinations',
          cost_usd: 0.002,
        });
      }

      return NextResponse.json({
        reply: `![AI Image](${generatedImageUrl})`,
        usage: { total_tokens: 0, cost: 0.002 },
        cost_usd: 0.002,
        points_spent: 2,
        remaining_points: userProfile?.points ? userProfile.points - 2 : null,
      });
    }

    // ٣. هنارتنا پرسیارێ بۆ OpenRouter
    const outboundMessages = withTextOnlySystemPrompt(messages);
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${activeApiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://ipbits.store",
        "X-Title": "IPBITS AI Hub",
      },
      body: JSON.stringify({
        model: model || "openai/gpt-4o-mini",
        messages: outboundMessages,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      const errMsg = data.error?.message || "ئاریشەیەک هەیە د کلیلێ یان باڵانسی دا";
      return NextResponse.json({ error: errMsg }, { status: response.status });
    }

    const reply = data.choices?.[0]?.message?.content || "بەرسڤ نەهات.";
    const usage = data.usage || null;

    // حیسابکرنا بهایی (دۆلار) وەرگیراو ژ OpenRouter
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

    // هەر $1 = 1,000 پۆینت ($0.001 = 1 point)
    const pointsSpent = Math.max(
      costUsd > 0 ? 1 : 0,
      Math.ceil(costUsd * 1000)
    );

    // ٤. کێمکرنا پۆینتان د داتابەیسێ دا
    let remainingPoints = null;
    if (userProfile?.id && userProfile.points !== undefined) {
      remainingPoints = Math.max(0, userProfile.points - pointsSpent);
      await supabase
        .from('profiles')
        .update({ points: remainingPoints })
        .eq('id', userProfile.id);

      // تۆمارکرن د مێژوویا خاڵان دا (points_ledger)
      if (pointsSpent > 0) {
        await supabase.from('points_ledger').insert({
          profile_id: userProfile.id,
          points_change: -pointsSpent,
          action_type: 'chat',
          model_used: model || 'openai/gpt-4o-mini',
          cost_usd: costUsd,
        });
      }
    }

    return NextResponse.json({
      reply,
      usage,
      cost_usd: costUsd,
      points_spent: pointsSpent,
      remaining_points: remainingPoints,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
