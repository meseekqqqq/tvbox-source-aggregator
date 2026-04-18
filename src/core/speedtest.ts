// zbape.com 测速 API 封装

import { ZBAPE_API_URL, ZBAPE_QPS_INTERVAL_MS } from './config';
import type { SpeedTestResult } from './types';

/**
 * 对单个 URL 进行测速
 */
export async function testSpeed(url: string, apiKey: string): Promise<SpeedTestResult | null> {
  const params = new URLSearchParams({ key: apiKey, url });
  const apiUrl = `${ZBAPE_API_URL}?${params.toString()}`;

  try {
    const response = await fetch(apiUrl, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset:utf-8;',
      },
    });

    if (!response.ok) {
      console.warn(`[speedtest] API returned ${response.status} for ${url}`);
      return null;
    }

    const result = (await response.json()) as SpeedTestResult;
    return result;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(`[speedtest] Error testing ${url}: ${msg}`);
    return null;
  }
}

/**
 * 从测速结果中提取平均延迟（毫秒）
 * 返回 null 表示测速失败
 */
export function parseAverageMs(result: SpeedTestResult | null): number | null {
  if (!result || result.code !== 200 || !result.data?.average) {
    return null;
  }

  // "480.02ms" → 480.02
  const match = result.data.average.match(/([\d.]+)/);
  if (!match) return null;

  return parseFloat(match[1]);
}

/**
 * 批量测速，遵守 1QPS 限制
 * 串行执行，每次间隔 ZBAPE_QPS_INTERVAL_MS
 */
export async function batchSpeedTest(
  urls: string[],
  apiKey: string,
): Promise<Map<string, number | null>> {
  const results = new Map<string, number | null>();

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    console.log(`[speedtest] Testing ${i + 1}/${urls.length}: ${url}`);

    const result = await testSpeed(url, apiKey);
    const avgMs = parseAverageMs(result);
    results.set(url, avgMs);

    // 遵守 QPS 限制（最后一个不需要等）
    if (i < urls.length - 1) {
      await sleep(ZBAPE_QPS_INTERVAL_MS);
    }
  }

  return results;
}

/**
 * 根据测速结果过滤配置 URL
 * - avgMs === null（测速失败/不可达）→ 丢弃
 * - avgMs > thresholdMs → 丢弃
 */
export function filterBySpeed(
  speedResults: Map<string, number | null>,
  thresholdMs: number,
): Set<string> {
  const passed = new Set<string>();

  for (const [url, avgMs] of speedResults) {
    if (avgMs !== null && avgMs <= thresholdMs) {
      passed.add(url);
    } else {
      const reason = avgMs === null ? 'unreachable' : `${avgMs}ms > ${thresholdMs}ms`;
      console.log(`[speedtest] Filtered out ${url}: ${reason}`);
    }
  }

  console.log(`[speedtest] ${passed.size}/${speedResults.size} URLs passed speed test`);
  return passed;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
