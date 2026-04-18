// 解析和规范化 TVBox JSON 配置

import type { TVBoxConfig, TVBoxSite, SourcedConfig } from './types';

/**
 * 从 SourcedConfig 中提取规范化的数据
 * 确保所有字段有合理的默认值
 */
export function normalizeConfig(sourced: SourcedConfig): SourcedConfig {
  const config = sourced.config;

  return {
    ...sourced,
    config: {
      spider: normalizeSpider(config.spider, sourced.sourceUrl),
      sites: normalizeSites(config.sites || [], config.spider, sourced.sourceUrl),
      parses: config.parses || [],
      lives: config.lives || [],
      hosts: config.hosts || [],
      rules: config.rules || [],
      doh: config.doh || [],
      ads: config.ads || [],
      flags: config.flags || [],
    },
  };
}

/**
 * 规范化 spider URL：相对路径转绝对路径
 */
function normalizeSpider(spider: string | undefined, sourceUrl: string): string | undefined {
  if (!spider) return undefined;
  return resolveUrl(spider, sourceUrl);
}

/**
 * 规范化站点列表
 * - 确保必填字段存在
 * - 相对 URL 转绝对
 * - type:3 站点关联 spider JAR
 */
function normalizeSites(
  sites: TVBoxSite[],
  globalSpider: string | undefined,
  sourceUrl: string,
): TVBoxSite[] {
  return sites
    .filter((site) => site.key && site.api !== undefined)
    .map((site) => {
      const normalized: TVBoxSite = {
        ...site,
        name: site.name || site.key,
        searchable: site.searchable ?? 1,
        quickSearch: site.quickSearch ?? 1,
        filterable: site.filterable ?? 1,
      };

      // type 0/1: 规范化 api URL
      if (site.type === 0 || site.type === 1) {
        normalized.api = resolveUrl(site.api, sourceUrl);
      }

      // jar 字段：相对路径转绝对
      if (site.jar) {
        normalized.jar = resolveUrl(site.jar, sourceUrl);
      }

      // ext 字段如果是 URL，也做转换
      if (typeof site.ext === 'string' && site.ext.startsWith('./')) {
        normalized.ext = resolveUrl(site.ext, sourceUrl);
      }

      return normalized;
    });
}

/**
 * 解析相对 URL 为绝对 URL
 * 支持 ./path 和 //host/path 格式
 */
function resolveUrl(url: string, baseUrl: string): string {
  if (!url) return url;

  // 已经是绝对 URL
  if (url.startsWith('http://') || url.startsWith('https://')) return url;

  // 协议相对 URL
  if (url.startsWith('//')) {
    try {
      const base = new URL(baseUrl);
      return `${base.protocol}${url}`;
    } catch {
      return `https:${url}`;
    }
  }

  // 相对路径
  if (url.startsWith('./') || url.startsWith('../')) {
    try {
      return new URL(url, baseUrl).href;
    } catch {
      return url;
    }
  }

  // 以 csp_ 开头的是 JAR class 引用，不是 URL
  if (url.startsWith('csp_') || url.startsWith('py_') || url.startsWith('js_')) {
    return url;
  }

  // 其他情况尝试解析
  try {
    return new URL(url, baseUrl).href;
  } catch {
    return url;
  }
}

/**
 * 提取配置中的 spider JAR URL（去掉 md5 后缀等）
 */
export function extractSpiderJarUrl(spider: string | undefined): string | null {
  if (!spider) return null;

  // 格式: "url;md5;checksum" → 取 url
  const parts = spider.split(';md5;');
  let url = parts[0].trim();

  // 格式: "img+url" → 取 url
  if (url.startsWith('img+')) {
    url = url.substring(4);
  }

  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return null;
  }

  return url;
}
