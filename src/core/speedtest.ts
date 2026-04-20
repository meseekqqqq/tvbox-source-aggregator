// 本地 HTTP 测速（替代 zbape 第三方 API）

import type { TVBoxSite } from './types';

export interface SpeedResult {
  key: string;
  speedMs: number | null; // null = 不可达或超时
}

/**
 * 对单个 URL 做 HTTP GET 测速，返回 TTFB（毫秒）
 */
export async function httpSpeedTest(url: string, timeoutMs: number): Promise<number | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const start = Date.now();
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'okhttp/3.12.0' },
    });
    const speedMs = Date.now() - start;

    if (!resp.ok) return null;

    // 消费 body 避免连接泄漏
    await resp.text();
    return speedMs;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 批量测速可测的站点（并发），返回 key → speedMs 映射
 *
 * 可测条件：
 * - type=1 (MacCMS)：用 api + ?ac=list
 * - type=0 (XML)：直接探测 api
 * - type=3 且 api 是 URL（非 csp_/py_/js_ 开头）：探测 api
 * - type=3 且 api 是类名：跳过
 */
export async function batchSiteSpeedTest(
  sites: TVBoxSite[],
  timeoutMs: number,
): Promise<Map<string, number | null>> {
  const tasks: Array<{ key: string; url: string }> = [];

  for (const site of sites) {
    const url = getTestableUrl(site);
    if (url) {
      tasks.push({ key: site.key, url });
    }
  }

  if (tasks.length === 0) return new Map();

  console.log(`[speedtest] Testing ${tasks.length} sites concurrently...`);

  const results = await Promise.allSettled(
    tasks.map(async ({ key, url }) => {
      const speedMs = await httpSpeedTest(url, timeoutMs);
      return { key, speedMs };
    }),
  );

  const speedMap = new Map<string, number | null>();
  for (const result of results) {
    if (result.status === 'fulfilled') {
      speedMap.set(result.value.key, result.value.speedMs);
    }
  }

  const passed = [...speedMap.values()].filter((v) => v !== null).length;
  console.log(`[speedtest] ${passed}/${speedMap.size} sites reachable`);

  return speedMap;
}

/**
 * 根据测速结果给站点 name 追加延迟标记
 * 格式：站名 [0.4s]
 */
export function appendSpeedToName(sites: TVBoxSite[], speedMap: Map<string, number | null>): TVBoxSite[] {
  return sites.map((site) => {
    const speedMs = speedMap.get(site.key);
    if (speedMs == null) return site;
    const seconds = (speedMs / 1000).toFixed(1);
    return { ...site, name: `${site.name || site.key} [${seconds}s]` };
  });
}

/**
 * 提取站点的可测 URL，不可测返回 null
 */
function getTestableUrl(site: TVBoxSite): string | null {
  const api = site.api || '';

  if (site.type === 1) {
    // MacCMS: 用 ?ac=list 探测
    return api.includes('?') ? `${api}&ac=list` : `${api}?ac=list`;
  }

  if (site.type === 0) {
    // XML: 直接探测
    if (api.startsWith('http')) return api;
    return null;
  }

  if (site.type === 3) {
    // JAR: 只有 api 是 URL 时才能测
    if (api.startsWith('http://') || api.startsWith('https://')) return api;
    return null;
  }

  return null;
}
