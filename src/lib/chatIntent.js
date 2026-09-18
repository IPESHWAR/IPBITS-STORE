/**
 * Chat intent helpers — decide when to generate images vs reply with text.
 * Used by `/api/chat` only; does not touch UI or billing tables.
 */

const QUESTION_PREFIX_RE =
  /^(can\s+you|could\s+you|would\s+you|will\s+you|do\s+you|does\s+it|is\s+it|are\s+you|how\s+(do|can|to|would)|what\s+(is|are|do|can)|why\s+|when\s+|where\s+|help\s+me|please\s+help|tell\s+me|explain|هل\s+|هل تستطيع|كيف|ماذا|هل يمكنك|ئایا\s+|دەتوانی|دەتوانیت|چۆن\s+|چى\s+|چی\s+|یارمەتی)/i;

const EDIT_INTENT_RE =
  /\b(edit|retouch|photoshop|adjust|enhance|upscale|remove\s+background|bg\s*remove|inpaint|outpaint|fix\s+(my\s+)?(photo|image|pic)|modify\s+(my\s+)?(photo|image)|change\s+(my\s+)?(photo|image)|تحریر|تعديل|عدّل|عدل|حسّن|حسين|إزالة\s+الخلفية|گۆڕین|دەستکاری|چاککردن|سڕینەوەی\s+پاشبنەما)\b/i;

const PHOTO_TOPIC_RE =
  /\b(photo|image|picture|pic|illustration|artwork|draw|drawing|generate|وێنە|صورة|صور|رسم|توضیح)\b/i;

/** Explicit imperative generation commands (not questions). */
const EXPLICIT_GENERATE_RE =
  /(?:^(?:please\s+)?(?:generate|create|draw|make|paint|render|design|imagine)\s+(?:(?:me|an?|the|my)\s+)?(?:image|picture|photo|illustration|artwork|drawing|logo|poster|scene)\b)|(?:^(?:please\s+)?(?:generate|create|draw|make)\s+(?:an?\s+)?(?:image|picture|photo|illustration)\s+of\b)|(?:\b(?:generate|create|draw|make)\s+(?:an?\s+)?(?:image|picture|photo|illustration)\s+of\b)|(?:^وێنەیەک\s*(?:چێکە|دروست\s*بکە|بکێشە))|(?:(?:چێکە|دروست\s*بکە|بکێشە)\s*(?:وێنەیەک|وێنە))|(?:^ارسم\s+)|(?:^أنشئ\s+(?:صورة|رسما))|(?:^اصنع\s+صورة)|(?:^ولد\s+صورة)|(?:^إنشاء\s+صورة)/i;

export function normalizePromptText(raw) {
  return String(raw || '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function lastUserHasUploadedImage(messages) {
  if (!Array.isArray(messages) || !messages.length) return false;
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m?.role !== 'user') continue;
    const content = m.content;
    if (typeof content === 'string') {
      if (/data:image\//i.test(content)) return true;
      continue;
    }
    if (Array.isArray(content)) {
      return content.some((p) => {
        if (!p) return false;
        if (p.type === 'image_url' && (p.image_url?.url || p.image_url)) return true;
        if (p.type === 'image' || p.type === 'input_image') return true;
        if (typeof p.image_url === 'string' && p.image_url) return true;
        return false;
      });
    }
    break;
  }
  return false;
}

export function isCapabilityOrHelpQuestion(prompt) {
  const text = normalizePromptText(prompt);
  if (!text) return false;
  if (QUESTION_PREFIX_RE.test(text)) return true;
  if (/^can\s+(edit|make|create|generate|draw|help)\b/i.test(text)) return true;
  if (/\?\s*$/.test(text) && PHOTO_TOPIC_RE.test(text)) return true;
  // Soft capability phrasing without ?
  if (
    /\b(can you|could you|is it possible|do you support|are you able)\b/i.test(text) ||
    /\b(هل تستطيع|هل يمكنك|دەتوانی|دەتوانیت)\b/i.test(text)
  ) {
    return true;
  }
  return false;
}

export function isImageEditIntent(prompt) {
  const text = normalizePromptText(prompt);
  if (!text) return false;
  return EDIT_INTENT_RE.test(text) && PHOTO_TOPIC_RE.test(text);
}

/**
 * True only for clear imperative generation commands.
 * Questions / "can you" / "how to" never qualify.
 */
export function isExplicitImageGenerationCommand(prompt) {
  const text = normalizePromptText(prompt);
  if (!text) return false;
  if (isCapabilityOrHelpQuestion(text)) return false;
  if (isImageEditIntent(text) && !EXPLICIT_GENERATE_RE.test(text)) return false;
  return EXPLICIT_GENERATE_RE.test(text);
}

/**
 * Should we call image generation / pollinations?
 * Requires: selected image model AND explicit generate command.
 */
export function shouldTriggerImageGeneration({ modelIsImage, prompt, messages }) {
  if (!modelIsImage) return false;
  if (!isExplicitImageGenerationCommand(prompt)) return false;
  // Edit-with-generate phrasing still needs an attachment if it's clearly an edit
  if (isImageEditIntent(prompt) && !lastUserHasUploadedImage(messages) && !EXPLICIT_GENERATE_RE.test(prompt)) {
    return false;
  }
  return true;
}

export const EDIT_NEEDS_UPLOAD_REPLY = {
  ku: 'هیڤیە سەرەتا وێنەکێ خۆ هاوپێچ / بار بکە، پاشان بێژە چ گۆڕانکاریان دەتەوێت بکرێت.',
  ar: 'يرجى إرفاق/رفع صورتك أولاً، ثم أخبرني بالتعديلات التي تريدها.',
  en: 'Please attach/upload your image first and tell me what adjustments you want to make.',
};

export function editNeedsUploadReply(lang) {
  const raw = String(lang || 'en').toLowerCase();
  const key = raw.startsWith('ar')
    ? 'ar'
    : raw.startsWith('ku') || raw.startsWith('ckb') || raw === 'badini'
      ? 'ku'
      : 'en';
  return EDIT_NEEDS_UPLOAD_REPLY[key] || EDIT_NEEDS_UPLOAD_REPLY.en;
}

/** Extra system rules for honest, context-aware replies (all text paths). */
export const HONEST_CHAT_SYSTEM_ADDON = `Be direct, accurate, and honest. Do not fabricate images, files, or unexpected outputs.
If the user asks whether you can edit a photo, generate art, or similar:
- Answer conversationally: explain what you can do, which Image model tab / Flux-style model to pick for generation, and that editing requires an uploaded image plus clear instructions.
- Never invent or attach a fake/random image.
If the user wants to edit a photo but has not uploaded one, tell them: "Please attach/upload your image first and tell me what adjustments you want to make."
Do not run image generation for questions like "can you edit my photo?", "how to make an image?", or general photo help.`;

export function detectChatIntent({ prompt, modelIsImage, messages }) {
  const text = normalizePromptText(prompt);
  const hasImage = lastUserHasUploadedImage(messages);
  const capabilityQ = isCapabilityOrHelpQuestion(text);
  const editIntent = isImageEditIntent(text);
  const explicitGenerate = isExplicitImageGenerationCommand(text);

  // Clear edit command without an attachment (not a "can you...?" question)
  if (editIntent && !hasImage && !explicitGenerate && !capabilityQ) {
    return { kind: 'edit_needs_upload', hasImage, capabilityQ, editIntent, explicitGenerate };
  }

  if (modelIsImage && explicitGenerate) {
    return { kind: 'generate_image', hasImage, capabilityQ, editIntent, explicitGenerate };
  }

  if (modelIsImage || capabilityQ || editIntent) {
    return { kind: 'text_help', hasImage, capabilityQ, editIntent, explicitGenerate };
  }

  return { kind: 'text_chat', hasImage, capabilityQ, editIntent, explicitGenerate };
}
