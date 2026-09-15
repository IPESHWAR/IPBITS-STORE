/**
 * Automated AI Hub model smoke test.
 * Usage: node scripts/test-ai-models.js
 * Env: BASE_URL (default http://localhost:3000)
 *      AI_TEST_SECRET (default ipbits-local-test)
 *      AI_TEST_PHONE (optional paid user phone)
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const TEST_SECRET = process.env.AI_TEST_SECRET || 'ipbits-local-test';
const TEST_PHONE = process.env.AI_TEST_PHONE || '07504060378';
const PROMPT = 'سڵاڤ، تاقی کرنە';

async function loadModels() {
  const res = await fetch(`${BASE_URL}/api/ai/models`);
  if (!res.ok) {
    throw new Error(`Failed to load models list (${res.status})`);
  }
  const data = await res.json();
  const models = Array.isArray(data.models) ? data.models : [];
  if (!models.length) throw new Error('No configured models returned');
  return models;
}

async function testModel(model) {
  const free = model.tier === 'free';
  const started = Date.now();
  const body = {
    messages: [{ role: 'user', content: PROMPT }],
    model: model.id,
    modelName: model.name,
    testPrompt: true,
    sessionId: free ? `guest-session-test${Date.now().toString(36)}` : undefined,
    phone: free ? '' : TEST_PHONE,
    userId: free ? '' : TEST_PHONE,
    testAdmin: !free,
  };

  const headers = { 'Content-Type': 'application/json' };
  if (!free) headers['x-ai-test-secret'] = TEST_SECRET;

  try {
    const res = await fetch(`${BASE_URL}/api/chat`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    const ms = Date.now() - started;
    const ok = res.status === 200 && !!(data.reply || data.choices?.[0]?.message?.content);
    return {
      name: model.name || model.id,
      tier: free ? 'Free' : 'Paid',
      status: ok ? '200 OK' : `Failed ${res.status}`,
      ms,
      error: ok ? '' : data.error || data.code || `HTTP ${res.status}`,
    };
  } catch (error) {
    return {
      name: model.name || model.id,
      tier: free ? 'Free' : 'Paid',
      status: 'Failed',
      ms: Date.now() - started,
      error: error.message || 'network_error',
    };
  }
}

function pad(value, width) {
  const text = String(value ?? '');
  if (text.length >= width) return text.slice(0, width);
  return text + ' '.repeat(width - text.length);
}

function printTable(rows) {
  const cols = [
    ['Model Name', 34],
    ['Tier', 6],
    ['Status', 12],
    ['Time (ms)', 10],
    ['Error', 42],
  ];
  const header = cols.map(([title, w]) => pad(title, w)).join(' | ');
  const line = cols.map(([, w]) => '-'.repeat(w)).join('-+-');
  console.log(header);
  console.log(line);
  for (const row of rows) {
    console.log(
      [
        pad(row.name, 34),
        pad(row.tier, 6),
        pad(row.status, 12),
        pad(row.ms, 10),
        pad(row.error, 42),
      ].join(' | ')
    );
  }
}

async function main() {
  console.log(`AI model test → ${BASE_URL}`);
  console.log(`Prompt: ${PROMPT}\n`);
  const models = await loadModels();
  const results = [];
  for (const model of models) {
    process.stdout.write(`Testing ${model.name || model.id} ... `);
    const row = await testModel(model);
    console.log(row.status);
    results.push(row);
  }

  console.log('\nSummary');
  printTable(results);
  const failed = results.filter((row) => !row.status.startsWith('200')).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
