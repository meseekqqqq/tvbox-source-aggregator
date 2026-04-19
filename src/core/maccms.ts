// MacCMS 源验证与 TVBoxSite 转换

import type { MacCMSSourceEntry, TVBoxSite } from './types';

/**
 * 验证单个 MacCMS API 可用性
 * 发 ?ac=list 请求，检查响应包含 class 或 list 字段
 */
export async function validateMacCMS(
  api: string,
  timeoutMs: number,
): Promise<boolean> {
  const url = api.includes('?') ? `${api}&ac=list` : `${api}?ac=list`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const resp = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);

    if (!resp.ok) return false;

    const data = (await resp.json()) as Record<string, unknown>;
    // MacCMS 标准响应包含 class（分类）或 list（视频列表）
    return !!(data && (data.class || data.list));
  } catch {
    return false;
  }
}

/**
 * 将 MacCMS 源条目转换为 TVBoxSite 数组
 * - 有 workerBaseUrl：使用代理 URL（CF 版）
 * - 无 workerBaseUrl：使用原始 API URL（本地版）
 */
export function macCMSToTVBoxSites(
  entries: MacCMSSourceEntry[],
  workerBaseUrl?: string,
): TVBoxSite[] {
  return entries.map((entry) => ({
    key: entry.key,
    name: entry.name,
    type: 1,
    api: workerBaseUrl
      ? `${workerBaseUrl.replace(/\/$/, '')}/api/${entry.key}`
      : entry.api,
    searchable: 1,
    quickSearch: 1,
    filterable: 1,
  }));
}

/**
 * 本地版：并发验证所有 MacCMS 源，返回通过验证的条目
 */
export async function processMacCMSForLocal(
  entries: MacCMSSourceEntry[],
  timeoutMs: number,
): Promise<MacCMSSourceEntry[]> {
  if (entries.length === 0) return [];

  console.log(`[maccms] Validating ${entries.length} MacCMS sources...`);

  const results = await Promise.allSettled(
    entries.map(async (entry) => {
      const ok = await validateMacCMS(entry.api, timeoutMs);
      return { entry, ok };
    }),
  );

  const passed: MacCMSSourceEntry[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled' && result.value.ok) {
      passed.push(result.value.entry);
    } else {
      const entry =
        result.status === 'fulfilled' ? result.value.entry : null;
      const reason =
        result.status === 'rejected' ? result.reason : 'validation failed';
      console.log(
        `[maccms] Filtered out ${entry?.key || 'unknown'}: ${reason}`,
      );
    }
  }

  console.log(
    `[maccms] ${passed.length}/${entries.length} MacCMS sources passed validation`,
  );
  return passed;
}
