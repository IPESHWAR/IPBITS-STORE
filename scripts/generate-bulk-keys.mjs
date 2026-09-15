import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const openrouterAdminKey = process.env.OPENROUTER_MANAGEMENT_API_KEY;

if (!supabaseUrl || !openrouterAdminKey) {
  console.error('❌ خەلەتی: پشکنین بکە کا URL و کلیلێن .env.local هەنە یان نە!');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// خشتەیێ پاکێجان و لیمیتێن OpenRouter
const TIERS = [
  { id: 'test', name: 'تیست (١ ڕۆژ)', limit: 0.75, iqd: 2500, prefix: 'TST' },
  { id: 'weekly', name: 'هەفتانە (٧ ڕۆژ)', limit: 1.75, iqd: 5000, prefix: 'WK' },
  { id: 'monthly', name: 'مەهانە (٣٠ ڕۆژ)', limit: 4.00, iqd: 12000, prefix: 'MO' },
  { id: '3months', name: '٣ مەهی (٩٠ ڕۆژ)', limit: 8.50, iqd: 25000, prefix: '3M' },
  { id: 'yearly', name: 'ساڵانە (١ ساڵ)', limit: 18.00, iqd: 50000, prefix: 'YR' },
];

// وەرگرتنا ناڤێ پاکێجێ و هەژمارێ ژ دەرڤەی تێرمینالێ
const inputTier = process.argv[2] ? process.argv[2].toLowerCase() : 'all';
const inputCount = parseInt(process.argv[3], 10) || 50;

async function createOpenRouterKey(name, limit) {
  const res = await fetch('https://openrouter.ai/api/v1/keys', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openrouterAdminKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name, limit }),
  });
  const data = await res.json();
  return data?.key || data?.data?.key;
}

async function startGeneration() {
  // دیارکرنا پاکێجێن پێدڤی بۆ دروستکرنێ
  let selectedTiers = [];
  if (inputTier === 'all') {
    selectedTiers = TIERS;
    console.log(`🚀 دەستپێکرنا دروستکرنا هەموو پاکێجان (${inputCount} دانە بۆ هەر جۆرەکی)...`);
  } else {
    const aliases = { daily: 'test', day: 'test', '1d': 'test', '1_day': 'test', tst: 'test' };
    const tierKey = aliases[inputTier] || inputTier;
    const found = TIERS.find(t => t.id === tierKey || t.prefix.toLowerCase() === tierKey);
    if (!found) {
      console.error(`❌ پاکێجا [${inputTier}] نەهاتە دیتن! پاکێجێن بەردەست ئەڤەنە: daily/test, weekly, monthly, 3months, yearly`);
      process.exit(1);
    }
    selectedTiers = [found];
    console.log(`🚀 دەستپێکرنا دروستکرنا ${inputCount} کۆدان بتنێ بۆ پاکێجا: ${found.name}...`);
  }

  let outputText = `=== IPBITS STORE CODES (${new Date().toLocaleString()}) ===\n\n`;

  for (const tier of selectedTiers) {
    console.log(`\n📦 کارکرن ل سەر پاکێجا: ${tier.name}...`);
    outputText += `--- پاکێجا: ${tier.name} (بها: ${tier.iqd.toLocaleString()} IQD) ---\n`;

    for (let i = 1; i <= inputCount; i++) {
      try {
        const randomNum = Math.floor(1000 + Math.random() * 9000);
        const code = `IPBITS-${tier.prefix}-${randomNum}`;

        // دروستکرنا کلیلێ ل OpenRouter
        const orKey = await createOpenRouterKey(`${code}-${Date.now()}`, tier.limit);

        if (!orKey) {
          console.error(`❌ نەشیا کلیلێ بۆ ${code} ل OpenRouter دروست بکەت.`);
          continue;
        }

        // تۆمارکرن د تابلۆیا vouchers دا
        const { error } = await supabase.from('vouchers').insert([
          {
            code: code,
            amount_iqd: tier.iqd,
            is_used: false,
          },
        ]);

        if (error) {
          console.error(`❌ خەلەتی د Supabase دا بۆ ${code}:`, error.message);
        } else {
          console.log(`✅ [${i}/${inputCount}] ${code} هاتە چێکرن.`);
          outputText += `${code}\n`;
        }
      } catch (err) {
        console.error(`❌ خەلەتیا چاوەڕواننەکری:`, err.message);
      }
    }
  }

  // سەیڤکرنا کۆدان د فایلێ دا (کۆدێن نوێ ل سەر دهێنە زێدەکرن بێی یێن کەڤن ژێبچن)
  fs.appendFileSync('generated-codes.txt', outputText + '\n');
  console.log('\n🎉 ب سەرکەفتیانە ب دووماهی هات! هەموو کۆد د فایلا "generated-codes.txt" دا هاتنە سەیڤکرن.');
}

startGeneration();