// TVBox 源聚合 CF Worker 入口

import { scrapeSourceUrls } from './scraper';
import { fetchConfigs } from './fetcher';
import { mergeConfigs } from './merger';
import { batchSpeedTest, filterBySpeed } from './speedtest';
import {
  KV_MERGED_CONFIG,
  KV_SOURCE_URLS,
  KV_LAST_UPDATE,
  KV_MANUAL_SOURCES,
  KV_BLOCKED_SOURCES,
  DEFAULT_SPEED_TIMEOUT_MS,
  DEFAULT_FETCH_TIMEOUT_MS,
} from './config';
import { dashboardHtml } from './dashboard';
import { adminHtml } from './admin';
import type { Env, SourcedConfig, AdminSource } from './types';
import type { ScrapedSource } from './scraper';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Admin 路由
    if (url.pathname.startsWith('/admin')) {
      return handleAdmin(request, url.pathname, env, ctx);
    }

    switch (url.pathname) {
      case '/':
        return handleGetConfig(env);
      case '/status':
        return handleDashboard();
      case '/status-data':
        return handleGetStatus(env);
      case '/refresh':
        return handleRefresh(request, env, ctx);
      default:
        return new Response('Not Found', { status: 404 });
    }
  },

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(runAggregation(env));
  },
};

// ─── Admin 路由 ────────────────────────────────────────────

async function handleAdmin(
  request: Request,
  pathname: string,
  env: Env,
  ctx: ExecutionContext,
): Promise<Response> {
  // GET /admin — 返回管理页面（不需要鉴权，页面内自行登录）
  if (pathname === '/admin' && request.method === 'GET') {
    return new Response(adminHtml, {
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' },
    });
  }

  // 其余 admin API 都需要鉴权
  if (!verifyAdmin(request, env)) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  // GET /admin/sources — 获取所有源列表
  if (pathname === '/admin/sources' && request.method === 'GET') {
    return handleGetSources(env);
  }

  // POST /admin/sources — 添加手动源
  if (pathname === '/admin/sources' && request.method === 'POST') {
    return handleAddSource(request, env);
  }

  // DELETE /admin/sources — 删除源
  if (pathname === '/admin/sources' && request.method === 'DELETE') {
    return handleRemoveSource(request, env);
  }

  return new Response('Not Found', { status: 404 });
}

function verifyAdmin(request: Request, env: Env): boolean {
  const token = env.ADMIN_TOKEN;
  if (!token) return false; // 未设置 ADMIN_TOKEN 时拒绝所有请求
  const auth = request.headers.get('Authorization');
  return auth === `Bearer ${token}`;
}

/**
 * 获取所有源：自动抓取的 + 手动添加的（减去黑名单）
 */
async function handleGetSources(env: Env): Promise<Response> {
  const [scrapedRaw, manualRaw, blockedRaw] = await Promise.all([
    env.KV.get(KV_SOURCE_URLS),
    env.KV.get(KV_MANUAL_SOURCES),
    env.KV.get(KV_BLOCKED_SOURCES),
  ]);

  const scraped: ScrapedSource[] = scrapedRaw ? JSON.parse(scrapedRaw) : [];
  const manual: ScrapedSource[] = manualRaw ? JSON.parse(manualRaw) : [];
  const blocked: string[] = blockedRaw ? JSON.parse(blockedRaw) : [];
  const blockedSet = new Set(blocked);

  const sources: AdminSource[] = [];

  // 自动抓取的（排除已屏蔽的）
  for (const s of scraped) {
    if (!blockedSet.has(s.url)) {
      sources.push({ name: s.name, url: s.url, type: 'scraped' });
    }
  }

  // 手动添加的
  for (const s of manual) {
    sources.push({ name: s.name, url: s.url, type: 'manual' });
  }

  return jsonResponse(sources);
}

/**
 * 添加手动源
 */
async function handleAddSource(request: Request, env: Env): Promise<Response> {
  let body: { name?: string; url?: string };
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  const url = body.url?.trim();
  if (!url) {
    return jsonResponse({ error: 'URL is required' }, 400);
  }

  // 校验 URL 格式
  try {
    new URL(url);
  } catch {
    return jsonResponse({ error: 'Invalid URL format' }, 400);
  }

  const name = body.name?.trim() || '';
  const manualRaw = await env.KV.get(KV_MANUAL_SOURCES);
  const manual: ScrapedSource[] = manualRaw ? JSON.parse(manualRaw) : [];

  // 检查重复
  if (manual.some((s) => s.url === url)) {
    return jsonResponse({ error: 'Source already exists' }, 409);
  }

  manual.push({ name, url });
  await env.KV.put(KV_MANUAL_SOURCES, JSON.stringify(manual));

  // 如果该 URL 在黑名单里，移除（用户重新添加说明不再屏蔽）
  const blockedRaw = await env.KV.get(KV_BLOCKED_SOURCES);
  const blocked: string[] = blockedRaw ? JSON.parse(blockedRaw) : [];
  const idx = blocked.indexOf(url);
  if (idx !== -1) {
    blocked.splice(idx, 1);
    await env.KV.put(KV_BLOCKED_SOURCES, JSON.stringify(blocked));
  }

  return jsonResponse({ success: true });
}

/**
 * 删除源
 * - 手动源：从 manual_sources 中移除
 * - 自动抓取源：加入 blocked_sources 黑名单
 */
async function handleRemoveSource(request: Request, env: Env): Promise<Response> {
  let body: { url?: string; type?: string };
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  const url = body.url?.trim();
  if (!url) {
    return jsonResponse({ error: 'URL is required' }, 400);
  }

  if (body.type === 'manual') {
    // 从手动列表移除
    const manualRaw = await env.KV.get(KV_MANUAL_SOURCES);
    const manual: ScrapedSource[] = manualRaw ? JSON.parse(manualRaw) : [];
    const filtered = manual.filter((s) => s.url !== url);
    await env.KV.put(KV_MANUAL_SOURCES, JSON.stringify(filtered));
  } else {
    // 自动抓取的 → 加入黑名单
    const blockedRaw = await env.KV.get(KV_BLOCKED_SOURCES);
    const blocked: string[] = blockedRaw ? JSON.parse(blockedRaw) : [];
    if (!blocked.includes(url)) {
      blocked.push(url);
      await env.KV.put(KV_BLOCKED_SOURCES, JSON.stringify(blocked));
    }
  }

  return jsonResponse({ success: true });
}

// ─── 原有路由 ──────────────────────────────────────────────

async function handleGetConfig(env: Env): Promise<Response> {
  const config = await env.KV.get(KV_MERGED_CONFIG);

  if (!config) {
    return new Response(
      JSON.stringify({ error: 'No config available yet. Trigger a refresh first.' }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      },
    );
  }

  return new Response(config, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=1800',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

async function handleDashboard(): Promise<Response> {
  return new Response(dashboardHtml, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache',
    },
  });
}

async function handleGetStatus(env: Env): Promise<Response> {
  const lastUpdate = await env.KV.get(KV_LAST_UPDATE);
  const sourceUrls = await env.KV.get(KV_SOURCE_URLS);
  const manualSources = await env.KV.get(KV_MANUAL_SOURCES);
  const config = await env.KV.get(KV_MERGED_CONFIG);

  let siteCount = 0;
  let parseCount = 0;
  let liveCount = 0;
  if (config) {
    try {
      const parsed = JSON.parse(config);
      siteCount = parsed.sites?.length || 0;
      parseCount = parsed.parses?.length || 0;
      liveCount = parsed.lives?.length || 0;
    } catch {
      // ignore
    }
  }

  const scrapedCount = sourceUrls ? JSON.parse(sourceUrls).length : 0;
  const manualCount = manualSources ? JSON.parse(manualSources).length : 0;

  const status = {
    lastUpdate: lastUpdate || 'never',
    sourceCount: scrapedCount + manualCount,
    scrapedCount,
    manualCount,
    sites: siteCount,
    parses: parseCount,
    lives: liveCount,
  };

  return new Response(JSON.stringify(status, null, 2), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

async function handleRefresh(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  // 鉴权：REFRESH_TOKEN 或 ADMIN_TOKEN 都可以
  if (env.REFRESH_TOKEN || env.ADMIN_TOKEN) {
    const auth = request.headers.get('Authorization');
    const validTokens = [env.REFRESH_TOKEN, env.ADMIN_TOKEN].filter(Boolean);
    if (!validTokens.some((t) => auth === `Bearer ${t}`)) {
      return new Response('Unauthorized', { status: 401 });
    }
  }

  ctx.waitUntil(runAggregation(env));

  return new Response(JSON.stringify({ success: true, message: 'Refresh started' }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// ─── 核心聚合流程 ──────────────────────────────────────────

async function runAggregation(env: Env): Promise<void> {
  const startTime = Date.now();
  console.log('[aggregation] Starting...');

  const speedTimeoutMs = parseInt(env.SPEED_TIMEOUT_MS) || DEFAULT_SPEED_TIMEOUT_MS;
  const fetchTimeoutMs = parseInt(env.FETCH_TIMEOUT_MS) || DEFAULT_FETCH_TIMEOUT_MS;

  // Step 1: 从 juwanhezi.com 抓取配置 URL 列表
  console.log('[aggregation] Step 1: Scraping source URLs...');
  let scrapedSources: ScrapedSource[] = [];
  try {
    scrapedSources = await scrapeSourceUrls();
    console.log(`[aggregation] Scraped ${scrapedSources.length} source URLs`);
    await env.KV.put(KV_SOURCE_URLS, JSON.stringify(scrapedSources));
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[aggregation] Scraping failed: ${msg}`);
    // 抓取失败时使用上次缓存的抓取结果
    const cached = await env.KV.get(KV_SOURCE_URLS);
    if (cached) {
      scrapedSources = JSON.parse(cached);
      console.log(`[aggregation] Using cached scraped sources: ${scrapedSources.length}`);
    }
  }

  // Step 1.5: 合并手动源，排除黑名单
  const [manualRaw, blockedRaw] = await Promise.all([
    env.KV.get(KV_MANUAL_SOURCES),
    env.KV.get(KV_BLOCKED_SOURCES),
  ]);
  const manualSources: ScrapedSource[] = manualRaw ? JSON.parse(manualRaw) : [];
  const blockedUrls: string[] = blockedRaw ? JSON.parse(blockedRaw) : [];
  const blockedSet = new Set(blockedUrls);

  // 最终源列表 = (自动抓取 - 黑名单) + 手动添加，URL 去重
  const seenUrls = new Set<string>();
  const allSources: ScrapedSource[] = [];

  for (const s of scrapedSources) {
    if (!blockedSet.has(s.url) && !seenUrls.has(s.url)) {
      seenUrls.add(s.url);
      allSources.push(s);
    }
  }
  for (const s of manualSources) {
    if (!seenUrls.has(s.url)) {
      seenUrls.add(s.url);
      allSources.push(s);
    }
  }

  if (allSources.length === 0) {
    console.warn('[aggregation] No source URLs available, keeping previous cache');
    return;
  }

  console.log(
    `[aggregation] Total sources: ${allSources.length} (scraped: ${scrapedSources.length - blockedUrls.length}, manual: ${manualSources.length})`,
  );

  // Step 2: 批量 fetch 配置 JSON
  console.log('[aggregation] Step 2: Fetching configs...');
  const sourcedConfigs = await fetchConfigs(allSources, fetchTimeoutMs);

  if (sourcedConfigs.length === 0) {
    console.warn('[aggregation] No valid configs fetched, keeping previous cache');
    return;
  }

  // Step 3: 测速（如果有 API key）
  let filteredConfigs: SourcedConfig[] = sourcedConfigs;

  if (env.ZBAPE_API_KEY) {
    console.log('[aggregation] Step 3: Speed testing config URLs...');
    const configUrls = sourcedConfigs.map((c) => c.sourceUrl);
    const speedResults = await batchSpeedTest(configUrls, env.ZBAPE_API_KEY);
    const passedUrls = filterBySpeed(speedResults, speedTimeoutMs);

    filteredConfigs = sourcedConfigs.filter((c) => passedUrls.has(c.sourceUrl));

    if (filteredConfigs.length === 0) {
      console.warn('[aggregation] All configs failed speed test, using all fetched configs');
      filteredConfigs = sourcedConfigs;
    }
  } else {
    console.log('[aggregation] Step 3: Skipping speed test (no API key)');
  }

  // Step 4: 合并
  console.log('[aggregation] Step 4: Merging configs...');
  const merged = mergeConfigs(filteredConfigs);

  // Step 5: 存入 KV
  const mergedJson = JSON.stringify(merged);
  await env.KV.put(KV_MERGED_CONFIG, mergedJson);
  await env.KV.put(KV_LAST_UPDATE, new Date().toISOString());

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(
    `[aggregation] Done in ${elapsed}s. ` +
      `${merged.sites?.length} sites, ${merged.parses?.length} parses, ${merged.lives?.length} lives`,
  );
}

// ─── 工具函数 ──────────────────────────────────────────────

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
