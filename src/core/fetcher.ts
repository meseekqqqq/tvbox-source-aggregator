// 批量 fetch TVBox JSON 配置

import { DEFAULT_FETCH_TIMEOUT_MS } from './config';
import type { TVBoxConfig, SourcedConfig, SourceEntry } from './types';

/**
 * 批量获取配置 JSON，并发执行，带超时
 * 自动检测多仓格式（storeHouse / urls），展开为子 URL 后二次 fetch
 * 返回成功获取的配置列表（失败的静默跳过）
 */
export async function fetchConfigs(
  sources: SourceEntry[],
  timeoutMs: number = DEFAULT_FETCH_TIMEOUT_MS,
): Promise<SourcedConfig[]> {
  // 第一轮：fetch 所有源
  const firstPassResults = await Promise.allSettled(
    sources.map((source) => fetchSingleConfig(source, timeoutMs)),
  );

  const configs: SourcedConfig[] = [];
  const multiRepoChildren: SourceEntry[] = [];

  for (let i = 0; i < firstPassResults.length; i++) {
    const result = firstPassResults[i];
    if (result.status === 'fulfilled' && result.value) {
      if (isMultiRepoConfig(result.value.config)) {
        const children = extractMultiRepoEntries(result.value.config, result.value.sourceName);
        console.log(`[fetcher] Detected multi-repo: ${sources[i].url} → ${children.length} sub-sources`);
        multiRepoChildren.push(...children);
      } else {
        configs.push(result.value);
      }
    } else if (result.status === 'rejected') {
      console.warn(`[fetcher] Failed to fetch ${sources[i].url}: ${result.reason}`);
    }
  }

  // 第二轮：展开多仓子 URL（限一层，不递归）
  if (multiRepoChildren.length > 0) {
    console.log(`[fetcher] Expanding ${multiRepoChildren.length} multi-repo sub-sources...`);
    const secondPassResults = await Promise.allSettled(
      multiRepoChildren.map((source) => fetchSingleConfig(source, timeoutMs)),
    );

    for (let i = 0; i < secondPassResults.length; i++) {
      const result = secondPassResults[i];
      if (result.status === 'fulfilled' && result.value) {
        if (isMultiRepoConfig(result.value.config)) {
          console.log(`[fetcher] Skipping nested multi-repo: ${multiRepoChildren[i].url}`);
        } else {
          configs.push(result.value);
        }
      } else if (result.status === 'rejected') {
        console.warn(`[fetcher] Failed to fetch sub-source ${multiRepoChildren[i].url}: ${result.reason}`);
      }
    }

    console.log(`[fetcher] Multi-repo expansion: ${configs.length} total configs after expansion`);
  }

  console.log(`[fetcher] Fetched ${configs.length}/${sources.length} configs successfully`);
  return configs;
}

/**
 * 获取单个配置 JSON
 */
async function fetchSingleConfig(
  source: SourceEntry,
  timeoutMs: number,
): Promise<SourcedConfig | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const startTime = Date.now();
    const response = await fetch(source.url, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'User-Agent': 'okhttp/3.12.0',
      },
    });

    if (!response.ok) {
      console.warn(`[fetcher] ${source.url} returned ${response.status}`);
      return null;
    }

    const text = await response.text();
    const config = parseConfigJson(text);
    if (!config) {
      console.warn(`[fetcher] ${source.url} returned invalid JSON`);
      return null;
    }

    const speedMs = Date.now() - startTime;

    return {
      sourceUrl: source.url,
      sourceName: source.name,
      config,
      speedMs,
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('abort')) {
      console.warn(`[fetcher] ${source.url} timed out (${timeoutMs}ms)`);
    }
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 解析配置 JSON，容错处理
 * 有些配置可能有 BOM 头、注释或其他非标准格式
 */
function parseConfigJson(text: string): TVBoxConfig | null {
  // 去掉 BOM
  let cleaned = text.replace(/^\uFEFF/, '');

  // 去掉首尾空白
  cleaned = cleaned.trim();

  // 有些配置可能被包在 callback 函数里
  const jsonpMatch = cleaned.match(/^\w+\(([\s\S]+)\)$/);
  if (jsonpMatch) {
    cleaned = jsonpMatch[1];
  }

  // 尝试直接解析
  let parsed = tryParseJson(cleaned);

  // 如果失败，尝试去掉行尾注释后再解析（只去掉不在字符串内的 // 注释）
  if (!parsed) {
    const stripped = stripJsonComments(cleaned);
    parsed = tryParseJson(stripped);
  }

  if (!parsed) return null;

  // 宽松校验：只要是对象就接受（有些配置只有 spider + sites，有些只有 lives）
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;

  return parsed as TVBoxConfig;
}

function tryParseJson(text: string): Record<string, unknown> | null {
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * 检测是否为多仓格式（索引 JSON 而非单仓 TVBoxConfig）
 * 支持两种格式：
 * - storeHouse: {"storeHouse": [{"sourceName": "...", "sourceUrl": "..."}]}
 * - urls: {"urls": [{"name": "...", "url": "..."}]}（需排除有 sites 的单仓）
 */
function isMultiRepoConfig(config: TVBoxConfig): boolean {
  const raw = config as Record<string, unknown>;
  if (Array.isArray(raw.storeHouse)) return true;
  if (Array.isArray(raw.urls) && !config.sites) return true;
  return false;
}

/**
 * 从多仓 JSON 中提取子源 URL 列表
 */
function extractMultiRepoEntries(config: TVBoxConfig, parentName: string): SourceEntry[] {
  const raw = config as Record<string, unknown>;
  const entries: SourceEntry[] = [];

  if (Array.isArray(raw.storeHouse)) {
    for (const item of raw.storeHouse as Record<string, unknown>[]) {
      const url = item?.sourceUrl;
      if (typeof url === 'string' && url.trim()) {
        entries.push({
          name: typeof item.sourceName === 'string' ? item.sourceName : parentName,
          url: url.trim(),
        });
      }
    }
  } else if (Array.isArray(raw.urls)) {
    for (const item of raw.urls as Record<string, unknown>[]) {
      const url = item?.url;
      if (typeof url === 'string' && url.trim()) {
        entries.push({
          name: typeof item.name === 'string' ? item.name : parentName,
          url: url.trim(),
        });
      }
    }
  }

  return entries;
}

/**
 * 安全地去掉 JSON 中的单行注释
 * 只处理不在字符串引号内的 // 注释
 */
function stripJsonComments(text: string): string {
  let result = '';
  let inString = false;
  let escape = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (escape) {
      result += ch;
      escape = false;
      continue;
    }

    if (ch === '\\' && inString) {
      result += ch;
      escape = true;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      result += ch;
      continue;
    }

    if (!inString && ch === '/' && text[i + 1] === '/') {
      // 跳到行尾
      const newline = text.indexOf('\n', i);
      if (newline === -1) break;
      i = newline - 1; // for 循环会 +1
      continue;
    }

    result += ch;
  }

  return result;
}
