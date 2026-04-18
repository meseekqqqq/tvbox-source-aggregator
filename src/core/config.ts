// 配置常量

// 默认阈值
export const DEFAULT_SPEED_TIMEOUT_MS = 5000; // 配置 URL 超时
export const DEFAULT_SITE_TIMEOUT_MS = 3000;  // 站点 API 超时
export const DEFAULT_FETCH_TIMEOUT_MS = 5000; // fetch 配置 JSON 超时

// 测速 API
export const ZBAPE_API_URL = 'https://api.zbape.com/api/velocity/query';
export const ZBAPE_QPS_INTERVAL_MS = 1100; // 1QPS 限制，留 100ms 余量

// KV keys
export const KV_MERGED_CONFIG = 'merged_config';
export const KV_SOURCE_URLS = 'source_urls';
export const KV_LAST_UPDATE = 'last_update';
export const KV_MANUAL_SOURCES = 'manual_sources';
