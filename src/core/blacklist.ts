// 黑名单管理：加载/保存/指纹计算/过滤/自动清理

import type { Storage } from '../storage/interface';
import type { TVBoxSite, TVBoxParse, TVBoxLive, TVBoxConfig } from './types';
import { KV_BLACKLIST } from './config';

export interface Blacklist {
  sites: string[];   // site fingerprint: sha256(api|ext|jar)[:16]
  parses: string[];  // parse url
  lives: string[];   // live url
}

const EMPTY_BLACKLIST: Blacklist = { sites: [], parses: [], lives: [] };

/**
 * 计算站点稳定指纹
 * 用 api+ext+jar 生成，不依赖 key（key 的 _2/_3 后缀不稳定）
 */
export async function siteFingerprint(site: TVBoxSite): Promise<string> {
  const ext = typeof site.ext === 'string' ? site.ext : JSON.stringify(site.ext || '');
  const raw = `${site.api}|${ext}|${site.jar || ''}`;
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
  const arr = new Uint8Array(buf);
  return Array.from(arr.slice(0, 8)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * 从 KV 加载黑名单（防御性：失败时返回空黑名单，不中断聚合）
 */
export async function loadBlacklist(storage: Storage): Promise<Blacklist> {
  try {
    const raw = await storage.get(KV_BLACKLIST);
    if (!raw) return EMPTY_BLACKLIST;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.sites) || !Array.isArray(parsed.parses) || !Array.isArray(parsed.lives)) {
      console.warn('[blacklist] Invalid structure, skipping');
      return EMPTY_BLACKLIST;
    }
    return parsed;
  } catch (e) {
    console.error('[blacklist] Failed to load, skipping filter:', e);
    return EMPTY_BLACKLIST;
  }
}

/**
 * 保存黑名单到 KV
 */
export async function saveBlacklist(storage: Storage, blacklist: Blacklist): Promise<void> {
  await storage.put(KV_BLACKLIST, JSON.stringify(blacklist));
}

/**
 * 应用黑名单过滤 merged config
 * 返回过滤后的 config + 过滤统计
 */
export async function applyBlacklist(
  config: TVBoxConfig,
  blacklist: Blacklist,
): Promise<{ config: TVBoxConfig; removedSites: number; removedParses: number; removedLives: number }> {
  const siteSet = new Set(blacklist.sites);
  const parseSet = new Set(blacklist.parses);
  const liveSet = new Set(blacklist.lives);

  let removedSites = 0;
  let removedParses = 0;
  let removedLives = 0;

  // 过滤 sites
  let sites = config.sites || [];
  if (siteSet.size > 0) {
    const filtered: TVBoxSite[] = [];
    for (const site of sites) {
      const fp = await siteFingerprint(site);
      if (siteSet.has(fp)) {
        removedSites++;
      } else {
        filtered.push(site);
      }
    }
    sites = filtered;
  }

  // 过滤 parses
  let parses = config.parses || [];
  if (parseSet.size > 0) {
    parses = parses.filter((p) => {
      if (parseSet.has(p.url)) {
        removedParses++;
        return false;
      }
      return true;
    });
  }

  // 过滤 lives
  let lives = config.lives || [];
  if (liveSet.size > 0) {
    lives = lives.filter((l) => {
      const url = l.url || l.api || '';
      if (url && liveSet.has(url)) {
        removedLives++;
        return false;
      }
      return true;
    });
  }

  return {
    config: { ...config, sites, parses, lives },
    removedSites,
    removedParses,
    removedLives,
  };
}

/**
 * 清理黑名单中已不存在的条目（防膨胀）
 * 对比当前 merged config 中的实际 fingerprint/url，移除过时的黑名单条目
 */
export async function pruneBlacklist(
  blacklist: Blacklist,
  currentConfig: TVBoxConfig,
): Promise<Blacklist> {
  // 收集当前所有 site fingerprint
  const currentSiteFps = new Set<string>();
  for (const site of currentConfig.sites || []) {
    currentSiteFps.add(await siteFingerprint(site));
  }

  // 收集当前所有 parse url
  const currentParseUrls = new Set((currentConfig.parses || []).map(p => p.url));

  // 收集当前所有 live url
  const currentLiveUrls = new Set(
    (currentConfig.lives || []).map(l => l.url || l.api || '').filter(Boolean),
  );

  const prunedSites = blacklist.sites.filter(fp => currentSiteFps.has(fp));
  const prunedParses = blacklist.parses.filter(url => currentParseUrls.has(url));
  const prunedLives = blacklist.lives.filter(url => currentLiveUrls.has(url));

  const removed =
    (blacklist.sites.length - prunedSites.length) +
    (blacklist.parses.length - prunedParses.length) +
    (blacklist.lives.length - prunedLives.length);

  if (removed > 0) {
    console.log(`[blacklist] Pruned ${removed} stale entries`);
  }

  return { sites: prunedSites, parses: prunedParses, lives: prunedLives };
}
