// 聚合流程编排

import type { Storage } from './storage/interface';
import type { AppConfig, SourceEntry, SourcedConfig, MacCMSSourceEntry } from './core/types';
import { fetchConfigs } from './core/fetcher';
import { mergeConfigs } from './core/merger';
import { batchSpeedTest, filterBySpeed } from './core/speedtest';
import { macCMSToTVBoxSites, processMacCMSForLocal } from './core/maccms';
import { KV_MERGED_CONFIG, KV_SOURCE_URLS, KV_LAST_UPDATE, KV_MANUAL_SOURCES, KV_MACCMS_SOURCES } from './core/config';

export async function runAggregation(storage: Storage, config: AppConfig): Promise<void> {
  const startTime = Date.now();
  console.log('[aggregation] Starting...');

  try {
    await _runAggregation(storage, config, startTime);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : '';
    console.error(`[aggregation] FATAL ERROR: ${msg}`);
    console.error(`[aggregation] Stack: ${stack}`);
    // 写入错误信息方便调试
    await storage.put(KV_LAST_UPDATE, `ERROR @ ${new Date().toISOString()}: ${msg}`);
  }
}

async function _runAggregation(storage: Storage, config: AppConfig, startTime: number): Promise<void> {

  // Step 1: 读取手动配置的源
  console.log('[aggregation] Step 1: Loading sources...');
  const raw = await storage.get(KV_MANUAL_SOURCES);
  const sources: SourceEntry[] = raw ? JSON.parse(raw) : [];

  // 检查是否有 MacCMS 源（即使没有 config 源也可以继续）
  const macCMSRaw = await storage.get(KV_MACCMS_SOURCES);
  const hasMacCMS = macCMSRaw ? JSON.parse(macCMSRaw).length > 0 : false;

  if (sources.length === 0 && !hasMacCMS) {
    console.warn('[aggregation] No sources configured, nothing to do');
    return;
  }

  console.log(`[aggregation] ${sources.length} config sources configured`);
  await storage.put(KV_SOURCE_URLS, JSON.stringify(sources));

  // Step 1.5: 处理 MacCMS 源
  console.log('[aggregation] Step 1.5: Processing MacCMS sources...');
  const macCMSConfigs = await processMacCMSSources(storage, config);

  // Step 2: 批量 fetch 配置 JSON
  console.log('[aggregation] Step 2: Fetching configs...');
  const sourcedConfigs = await fetchConfigs(sources, config.fetchTimeoutMs);

  if (sourcedConfigs.length === 0 && macCMSConfigs.length === 0) {
    console.warn('[aggregation] No valid configs fetched and no MacCMS sources, keeping previous cache');
    return;
  }

  // Step 3: 测速（如果有 API key）
  let filteredConfigs: SourcedConfig[] = sourcedConfigs;

  if (config.zbapeApiKey) {
    console.log('[aggregation] Step 3: Speed testing config URLs...');
    const configUrls = sourcedConfigs.map((c) => c.sourceUrl);
    const speedResults = await batchSpeedTest(configUrls, config.zbapeApiKey);
    const passedUrls = filterBySpeed(speedResults, config.speedTimeoutMs);

    filteredConfigs = sourcedConfigs.filter((c) => passedUrls.has(c.sourceUrl));

    if (filteredConfigs.length === 0) {
      console.warn('[aggregation] All configs failed speed test, using all fetched configs');
      filteredConfigs = sourcedConfigs;
    }
  } else {
    console.log('[aggregation] Step 3: Skipping speed test (no API key)');
  }

  // Step 4: 合并（包含 MacCMS 源）
  console.log('[aggregation] Step 4: Merging configs...');
  const allConfigs = [...filteredConfigs, ...macCMSConfigs];
  const merged = mergeConfigs(allConfigs);

  // Step 5: 存入存储
  const mergedJson = JSON.stringify(merged);
  await storage.put(KV_MERGED_CONFIG, mergedJson);
  await storage.put(KV_LAST_UPDATE, new Date().toISOString());

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(
    `[aggregation] Done in ${elapsed}s. ` +
      `${merged.sites?.length} sites, ${merged.parses?.length} parses, ${merged.lives?.length} lives`,
  );
}

/**
 * 处理 MacCMS 源：
 * - CF 版（有 workerBaseUrl）：直接转换，API 指向代理路由
 * - 本地版（无 workerBaseUrl）：并发验证 + 过滤不可达站点
 */
async function processMacCMSSources(
  storage: Storage,
  config: AppConfig,
): Promise<SourcedConfig[]> {
  const raw = await storage.get(KV_MACCMS_SOURCES);
  const entries: MacCMSSourceEntry[] = raw ? JSON.parse(raw) : [];

  if (entries.length === 0) {
    console.log('[aggregation] No MacCMS sources configured');
    return [];
  }

  console.log(`[aggregation] ${entries.length} MacCMS sources found`);

  let validEntries: MacCMSSourceEntry[];

  if (config.workerBaseUrl) {
    // CF 版：跳过验证，代理本身就是可用性保证
    console.log('[aggregation] CF mode: skipping MacCMS validation, using proxy URLs');
    validEntries = entries;
  } else {
    // 本地版：并发验证，过滤不可达站点
    console.log('[aggregation] Local mode: validating MacCMS sources...');
    validEntries = await processMacCMSForLocal(entries, config.siteTimeoutMs);
  }

  if (validEntries.length === 0) {
    console.warn('[aggregation] No valid MacCMS sources after processing');
    return [];
  }

  const sites = macCMSToTVBoxSites(validEntries, config.workerBaseUrl);
  console.log(`[aggregation] Converted ${sites.length} MacCMS sources to TVBoxSites`);

  return [{
    sourceUrl: 'maccms://builtin',
    sourceName: 'MacCMS Sources',
    config: { sites },
  }];
}
