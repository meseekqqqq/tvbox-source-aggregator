// 从 juwanhezi.com 抓取 HTML 并提取 TVBox 配置 URL

import { JUWANHEZI_URL } from './config';

export interface ScrapedSource {
  name: string;
  url: string;
}

/**
 * 从 juwanhezi.com 获取单仓配置 URL 列表
 */
export async function scrapeSourceUrls(fetchUrl: string = JUWANHEZI_URL): Promise<ScrapedSource[]> {
  const response = await fetch(fetchUrl, {
    headers: {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch juwanhezi.com: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  return parseSourceUrls(html);
}

/**
 * 从 HTML 中提取配置 URL
 *
 * juwanhezi.com 实际结构：
 *   <label class="col-sm-2 col-form-label">名称</label>
 *   ...
 *   <input type="text" id="copyN" class="form-control" value="配置URL">
 *   <span data-clipboard-action="copy" data-clipboard-target="#copyN">复制</span>
 */
export function parseSourceUrls(html: string): ScrapedSource[] {
  const sources: ScrapedSource[] = [];
  const seenUrls = new Set<string>();

  // 策略 1（主要）: 匹配 label + input 组合
  // 每个条目是一个 <div class="py-2 row border-bottom"> 块
  const blockRegex =
    /<label[^>]*class="[^"]*col-form-label[^"]*"[^>]*>([\s\S]*?)<\/label>[\s\S]*?<input[^>]*id="copy\d+"[^>]*value="([^"]*)"[^>]*>/gi;

  let match: RegExpExecArray | null;
  while ((match = blockRegex.exec(html)) !== null) {
    const name = match[1].replace(/<[^>]*>/g, '').trim();
    const url = match[2].trim();

    if (url && !seenUrls.has(url)) {
      seenUrls.add(url);
      sources.push({ name: name || urlToName(url), url });
    }
  }

  // 策略 2（备用）: 只匹配 input#copyN 的 value
  if (sources.length === 0) {
    const inputRegex = /<input[^>]*id="copy\d+"[^>]*value="([^"]*)"[^>]*>/gi;
    while ((match = inputRegex.exec(html)) !== null) {
      const url = match[1].trim();
      if (url && !seenUrls.has(url)) {
        seenUrls.add(url);
        sources.push({ name: urlToName(url), url });
      }
    }
  }

  // 策略 3（兜底）: data-clipboard-text 属性
  if (sources.length === 0) {
    const clipRegex = /data-clipboard-text=["']([^"']+)["']/gi;
    while ((match = clipRegex.exec(html)) !== null) {
      const url = match[1].trim();
      if (isValidConfigUrl(url) && !seenUrls.has(url)) {
        seenUrls.add(url);
        sources.push({ name: urlToName(url), url });
      }
    }
  }

  return sources;
}

function isValidConfigUrl(url: string): boolean {
  if (!url.startsWith('http://') && !url.startsWith('https://')) return false;
  if (url.length < 10 || url.length > 500) return false;
  return true;
}

function urlToName(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return url.substring(0, 30);
  }
}
