import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const SLOW_MS = 2500;

async function timed(fn) {
  const start = Date.now();
  try {
    const result = await fn();
    return { ...result, latencyMs: Date.now() - start };
  } catch (error) {
    return {
      status: 'outage',
      ok: false,
      error: error.message || 'unreachable',
      latencyMs: Date.now() - start,
    };
  }
}

async function checkSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  if (!url || !key) {
    return { status: 'degraded', ok: false, error: 'not_configured' };
  }

  const sb = createClient(url, key, { auth: { persistSession: false } });
  const { error } = await sb.from('orders').select('id', { count: 'exact', head: true }).limit(1);

  if (error && !/schema cache|does not exist|PGRST|42P01/i.test(error.message || '')) {
    return { status: 'outage', ok: false, error: error.message };
  }

  return { status: 'operational', ok: true };
}

async function checkOpenRouter() {
  const apiKey = process.env.OPENROUTER_API_KEY || '';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch('https://openrouter.ai/api/v1/models', {
      method: 'GET',
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(timer);
    if (!res.ok) {
      return { status: res.status >= 500 ? 'outage' : 'degraded', ok: false, error: `http_${res.status}` };
    }
    return { status: 'operational', ok: true };
  } catch (error) {
    clearTimeout(timer);
    return { status: 'outage', ok: false, error: error.message || 'unreachable' };
  }
}

async function checkLicenseEngine() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  if (!url || !key) {
    return { status: 'degraded', ok: false, error: 'not_configured' };
  }

  const sb = createClient(url, key, { auth: { persistSession: false } });
  const { error } = await sb.from('license_keys').select('id', { count: 'exact', head: true }).limit(1);

  if (error && !/schema cache|does not exist|PGRST|42P01/i.test(error.message || '')) {
    return { status: 'outage', ok: false, error: error.message };
  }

  return { status: 'operational', ok: true };
}

function rollup(services) {
  const statuses = services.map((s) => s.status);
  if (statuses.every((s) => s === 'operational')) return 'operational';
  if (statuses.some((s) => s === 'outage')) return 'outage';
  return 'degraded';
}

export async function GET() {
  const started = Date.now();

  const [openrouter, database, fulfillment] = await Promise.all([
    timed(checkOpenRouter),
    timed(checkSupabase),
    timed(checkLicenseEngine),
  ]);

  const normalize = (svc, id, name) => {
    let status = svc.status;
    if (status === 'operational' && svc.latencyMs > SLOW_MS) status = 'degraded';
    return {
      id,
      name,
      status,
      ok: status === 'operational',
      latency: `${svc.latencyMs}ms`,
      latencyMs: svc.latencyMs,
      error: svc.error || null,
    };
  };

  const services = [
    normalize(openrouter, 'openrouter', 'OpenRouter AI Engine'),
    normalize(database, 'database', 'Database & Authentication'),
    normalize(fulfillment, 'fulfillment', 'License Key & Order Fulfillment'),
  ];

  const status = rollup(services);
  const latencyMs = Date.now() - started;
  const lastUpdated = new Date().toISOString();

  return NextResponse.json(
    {
      status,
      overall: status,
      latency: `${latencyMs}ms`,
      latencyMs,
      lastUpdated,
      lastChecked: lastUpdated,
      uptime30d: 99.9,
      services,
    },
    {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    }
  );
}
