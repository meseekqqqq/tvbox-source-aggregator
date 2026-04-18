// 聚合流程编排

import type { Storage } from './storage/interface';
import type { AppConfig, SourceEntry, SourcedConfig } from './core/types';
import { fetchConfigs } from './core/fetcher';
import { mergeConfigs } from './core/merger';
import { batchSpeedTest, filterBySpeed } from './core/speedtest';
import { KV_MERGED_CONFIG, KV_SOURCE_URLS, KV_LAST_UPDATE, KV_MANUAL_SOURCES } from './core/config';

export async function runAggregation(storage: Storage, config: AppConfig): Promise<void> {
  const startTime = Date.now();
  console.log('[aggregation] Starting...');

  // Step 1: 读取手动配置的源
  console.log('[aggregation] Step 1: Loading sources...');
  const raw = await storage.get(KV_MANUAL_SOURCES);
  const sources: SourceEntry[] = raw ? JSON.parse(raw) : [];

  if (sources.length === 0) {
    console.warn('[aggregation] No sources configured, nothing to do');
    return;
  }

  console.log(`[aggregation] ${sources.length} sources configured`);
  await storage.put(KV_SOURCE_URLS, JSON.stringify(sources));

  // Step 2: 批量 fetch 配置 JSON
  console.log('[aggregation] Step 2: Fetching configs...');
  const sourcedConfigs = await fetchConfigs(sources, config.fetchTimeoutMs);

  if (sourcedConfigs.length === 0) {
    console.warn('[aggregation] No valid configs fetched, keeping previous cache');
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

  // Step 4: 合并
  console.log('[aggregation] Step 4: Merging configs...');
  const merged = mergeConfigs(filteredConfigs);

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
