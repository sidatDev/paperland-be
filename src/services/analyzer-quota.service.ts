import axios from 'axios';

export type QuotaProviderId = 'OPENROUTER' | 'SERPER' | 'SERPAPI' | 'TAVILY';

export interface ProviderQuotaInfo {
  provider: QuotaProviderId;
  label: string;
  category: 'ai' | 'search';
  configured: boolean;
  source: 'live_api' | 'app_tracked';
  used: number;
  limit: number;
  remaining: number;
  unit: 'requests' | 'credits' | 'searches';
  resetType: 'daily' | 'monthly' | 'none';
  resetsAt: string | null;
  resetNote: string;
  dashboardUrl?: string;
}

const AUDIT_ENTITY_TYPE = 'ANALYZER_API_USAGE';
const AUDIT_ACTION = 'CONSUME_CREDITS';
const CACHE_TTL_MS = 25_000;

let quotaPrismaRef: any = null;
let cachedQuotas: { fetchedAt: number; data: ProviderQuotaInfo[] } | null = null;

export function setQuotaPrisma(prisma: any) {
  if (prisma) quotaPrismaRef = prisma;
}

export function invalidateQuotaCache() {
  cachedQuotas = null;
}

/**
 * Persists API credit consumption to existing AuditLog table (no schema migration required).
 */
export async function trackProviderCredits(
  provider: QuotaProviderId,
  credits: number,
  endpoint: string,
  query?: string,
  prismaOverride?: any
): Promise<void> {
  invalidateQuotaCache();
  const prisma = prismaOverride || quotaPrismaRef;
  if (!prisma?.auditLog || credits <= 0) return;

  try {
    await prisma.auditLog.create({
      data: {
        entityType: AUDIT_ENTITY_TYPE,
        entityId: provider,
        action: AUDIT_ACTION,
        details: {
          credits,
          endpoint,
          query: query ? String(query).slice(0, 120) : undefined,
        },
      },
    });
  } catch {
    // Non-fatal: never break product analysis if telemetry insert fails
  }
}

function getNextUtcMidnightIso(): string {
  const now = new Date();
  const next = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0)
  );
  return next.toISOString();
}

function getNextUtcMonthStartIso(): string {
  const now = new Date();
  const next = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0)
  );
  return next.toISOString();
}

async function fetchOpenRouterQuota(): Promise<ProviderQuotaInfo | null> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) return null;

  const model = process.env.OPENROUTER_MODEL?.trim() || 'openrouter/free';
  try {
    const res = await axios.get('https://openrouter.ai/api/v1/key', {
      headers: { Authorization: `Bearer ${apiKey}` },
      timeout: 7000,
    });

    const data = res.data?.data || {};
    const freeDaily = data.free_model_daily_requests;
    const limit = Number(freeDaily?.limit ?? 1000);
    const used = Number(freeDaily?.used ?? 0);
    const remaining =
      freeDaily?.remaining !== undefined
        ? Number(freeDaily.remaining)
        : Math.max(0, limit - used);

    return {
      provider: 'OPENROUTER',
      label: `OpenRouter AI (${model})`,
      category: 'ai',
      configured: true,
      source: 'live_api',
      used,
      limit,
      remaining: Math.max(0, remaining),
      unit: 'requests',
      resetType: 'daily',
      resetsAt: getNextUtcMidnightIso(),
      resetNote: 'Resets daily at 00:00 UTC',
      dashboardUrl: 'https://openrouter.ai/settings/keys',
    };
  } catch {
    return {
      provider: 'OPENROUTER',
      label: `OpenRouter AI (${model})`,
      category: 'ai',
      configured: true,
      source: 'live_api',
      used: 0,
      limit: 1000,
      remaining: 1000,
      unit: 'requests',
      resetType: 'daily',
      resetsAt: getNextUtcMidnightIso(),
      resetNote: 'Resets daily at 00:00 UTC (live check unavailable)',
      dashboardUrl: 'https://openrouter.ai/settings/keys',
    };
  }
}

async function fetchSerpApiQuota(): Promise<ProviderQuotaInfo | null> {
  const apiKey = process.env.SERPAPI_API_KEY?.trim();
  if (!apiKey) return null;

  try {
    const res = await axios.get('https://serpapi.com/account.json', {
      params: { api_key: apiKey },
      timeout: 7000,
    });

    const data = res.data || {};
    const limit = Number(data.searches_per_month ?? 250);
    const used = Number(data.this_month_usage ?? 0);
    const remaining = Number(
      data.plan_searches_left ?? data.total_searches_left ?? Math.max(0, limit - used)
    );

    return {
      provider: 'SERPAPI',
      label: 'SerpApi (Google)',
      category: 'search',
      configured: true,
      source: 'live_api',
      used,
      limit,
      remaining: Math.max(0, remaining),
      unit: 'searches',
      resetType: 'monthly',
      resetsAt: getNextUtcMonthStartIso(),
      resetNote: 'Resets monthly (250 free/mo)',
      dashboardUrl: 'https://serpapi.com/dashboard',
    };
  } catch {
    return null;
  }
}

async function fetchTavilyQuota(): Promise<ProviderQuotaInfo | null> {
  const apiKey = process.env.TAVILY_API_KEY?.trim();
  if (!apiKey) return null;

  try {
    const res = await axios.get('https://api.tavily.com/usage', {
      headers: { Authorization: `Bearer ${apiKey}` },
      timeout: 7000,
    });

    const data = res.data || {};
    const keyInfo = data.key || {};
    const acctInfo = data.account || {};
    const limit = Number(keyInfo.limit ?? acctInfo.plan_limit ?? 1000);
    const used = Number(keyInfo.usage ?? acctInfo.plan_usage ?? 0);

    return {
      provider: 'TAVILY',
      label: 'Tavily Web Search',
      category: 'search',
      configured: true,
      source: 'live_api',
      used,
      limit,
      remaining: Math.max(0, limit - used),
      unit: 'credits',
      resetType: 'monthly',
      resetsAt: getNextUtcMonthStartIso(),
      resetNote: 'Resets 1st of every month (UTC)',
      dashboardUrl: 'https://app.tavily.com/home',
    };
  } catch {
    return null;
  }
}

async function fetchSerperQuota(prisma: any): Promise<ProviderQuotaInfo | null> {
  const apiKey = process.env.SERPER_API_KEY?.trim();
  if (!apiKey) return null;

  const limit = Math.max(1, parseInt(process.env.SERPER_CREDIT_LIMIT || '2500', 10) || 2500);
  const offset = Math.max(0, parseInt(process.env.SERPER_USED_OFFSET || '0', 10) || 0);

  let trackedUsed = 0;
  try {
    const logs = await prisma.auditLog.findMany({
      where: {
        entityType: AUDIT_ENTITY_TYPE,
        entityId: 'SERPER',
        action: AUDIT_ACTION,
      },
      select: { details: true },
    });
    for (const row of logs) {
      trackedUsed += Number((row.details as any)?.credits || 1);
    }
  } catch {
    // Non-fatal
  }

  const used = offset + trackedUsed;
  return {
    provider: 'SERPER',
    label: 'Serper (Google Web & Images)',
    category: 'search',
    configured: true,
    source: 'app_tracked',
    used,
    limit,
    remaining: Math.max(0, limit - used),
    unit: 'credits',
    resetType: 'none',
    resetsAt: null,
    resetNote: 'One-time free credits (does not reset monthly)',
    dashboardUrl: 'https://serper.dev/dashboard',
  };
}

/**
 * Returns live & tracked quota status for all configured Product Analyzer API providers.
 */
export async function getAnalyzerQuotas(
  prisma: any,
  forceRefresh = false
): Promise<ProviderQuotaInfo[]> {
  setQuotaPrisma(prisma);

  if (!forceRefresh && cachedQuotas && Date.now() - cachedQuotas.fetchedAt < CACHE_TTL_MS) {
    return cachedQuotas.data;
  }

  const results = await Promise.all([
    fetchOpenRouterQuota(),
    fetchSerpApiQuota(),
    fetchTavilyQuota(),
    fetchSerperQuota(prisma),
  ]);

  const active = results.filter((x): x is ProviderQuotaInfo => x !== null);
  cachedQuotas = { fetchedAt: Date.now(), data: active };
  return active;
}
