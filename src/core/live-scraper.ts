// 直播源抓取：从 juwanhezi.com/live 页面解析直播源列表

import type { LiveSourceEntry } from './types';
import type { Storage } from '../storage/interface';
import { KV_LIVE_SCRAPED } from './config';

const SCRAPE_URL = 'https://www.juwanhezi.com/live';

/**
 * 从 juwanhezi.com/live 页面抓取直播源列表
 * HTML 结构：<label>name</label> ... <input value="url">
 */
export function parseJuwanheziHtml(html: string): LiveSourceEntry[] {
  const results: LiveSourceEntry[] = [];

  // 匹配 <label...>name</label> 和对应的 <input...value="url">
  // 页面模式：col-form-label 标签包含名称，紧跟的 input 包含 URL
  const labelRegex = /col-form-label[^>]*>([^<]+)<\/label>/g;
  const inputRegex = /id="copy\d+"\s+class="form-control"\s+value="([^"]+)"/g;

  const names: string[] = [];
  const urls: string[] = [];

  let match;
  while ((match = labelRegex.exec(html)) !== null) {
    names.push(match[1].trim());
  }
  while ((match = inputRegex.exec(html)) !== null) {
    // HTML entity decode &amp; → &
    const url = match[1].replace(/&amp;/g, '&');
    urls.push(url);
  }

  const count = Math.min(names.length, urls.length);
  for (let i = 0; i < count; i++) {
    if (urls[i].startsWith('http://') || urls[i].startsWith('https://')) {
      results.push({ name: names[i], url: urls[i] });
    }
  }

  return results;
}

/**
 * 抓取直播源，失败时用 KV 缓存兜底
 */
export async function scrapeLiveSources(
  storage: Storage,
  timeoutMs: number,
): Promise<LiveSourceEntry[]> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const resp = await fetch(SCRAPE_URL, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TVBoxAggregator/1.0)' },
    });
    clearTimeout(timer);

    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}`);
    }

    const html = await resp.text();
    const entries = parseJuwanheziHtml(html);

    if (entries.length === 0) {
      throw new Error('Parsed 0 entries from HTML');
    }

    // 抓取成功，写入 KV 缓存
    await storage.put(KV_LIVE_SCRAPED, JSON.stringify(entries));
    console.log(`[live-scraper] Scraped ${entries.length} live sources from juwanhezi.com`);
    return entries;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(`[live-scraper] Scrape failed: ${msg}, falling back to cached data`);

    // 兜底：读 KV 缓存
    const cached = await storage.get(KV_LIVE_SCRAPED);
    if (cached) {
      const entries: LiveSourceEntry[] = JSON.parse(cached);
      console.log(`[live-scraper] Using ${entries.length} cached live sources`);
      return entries;
    }

    console.warn('[live-scraper] No cached data available');
    return [];
  }
}
