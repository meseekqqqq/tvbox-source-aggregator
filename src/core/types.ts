// TVBox JSON 配置完整类型定义

export interface TVBoxSite {
  key: string;
  name?: string;
  type: number; // 0=XML, 1=JSON, 3=JAR, 4=Remote
  api: string;
  searchable?: number; // 0|1
  quickSearch?: number; // 0|1
  filterable?: number; // 0|1
  playUrl?: string;
  playerType?: number; // -1|0|1|2|10
  jar?: string; // per-site JAR override
  ext?: string | Record<string, unknown>;
  categories?: string[];
  click?: string;
  style?: string;
}

export interface TVBoxParse {
  name: string;
  url: string;
  type?: number; // 0=sniffer, 1=JSON, 2=JSON extended, 3=aggregated, 4=super
  ext?: string | Record<string, unknown>;
}

export interface TVBoxLiveChannel {
  name: string;
  urls: string[];
}

export interface TVBoxLiveGroup {
  group: string;
  channels: TVBoxLiveChannel[];
}

export interface TVBoxLive {
  name?: string;
  type?: number; // 0=M3U/TXT, 3=JAR/Python
  url?: string;
  api?: string;
  jar?: string;
  epg?: string;
  ua?: string;
  header?: Record<string, string>;
  playerType?: number;
  ext?: string | Record<string, unknown>;
}

export interface TVBoxRule {
  host?: string;
  hosts?: string[];
  rule?: string[];
  filter?: string[];
  regex?: string[];
  script?: string[];
}

export interface TVBoxDoh {
  name: string;
  url: string;
}

export interface TVBoxConfig {
  spider?: string;
  jarCache?: boolean | string;
  wallpaper?: string;
  sites?: TVBoxSite[];
  parses?: TVBoxParse[];
  lives?: TVBoxLive[];
  hosts?: string[];
  rules?: TVBoxRule[];
  doh?: TVBoxDoh[];
  ads?: string[];
  flags?: string[];
}

// MacCMS 源条目
export interface MacCMSSourceEntry {
  key: string;    // TVBox site key，如 "hongniuzy"
  name: string;   // 显示名，如 "红牛资源站"
  api: string;    // 原始 API，如 "https://www.hongniuzy2.com/api.php/provide/vod/from/hnm3u8/at/json/"
}

// 直播源条目
export interface LiveSourceEntry {
  name: string;
  url: string;
}

// 源条目
export interface SourceEntry {
  name: string;
  url: string;
  configKey?: string; // AES ECB 解密密钥（来自 URL 的 ;pk; 后缀）
}

// 内部处理用：带来源标记的配置
export interface SourcedConfig {
  sourceUrl: string;
  sourceName: string;
  config: TVBoxConfig;
  speedMs?: number; // 配置 URL 响应时间
}

// 名称定制配置
export interface NameTransformConfig {
  prefix?: string;
  suffix?: string;
  promoReplacement?: string;
  extraCleanPatterns?: string[];
}

// JSON 导入结果
export interface ImportResult {
  type: 'multi' | 'single';
  added: number;
  duplicates: number;
  sources: string[];
}

// 平台无关的应用配置
export interface AppConfig {
  adminToken?: string;
  refreshToken?: string;
  speedTimeoutMs: number;
  siteTimeoutMs: number;
  fetchTimeoutMs: number;
  cronSchedule?: string;
  workerBaseUrl?: string;  // CF 版设置，如 "https://tvbox.example.com"；本地不设置
}
