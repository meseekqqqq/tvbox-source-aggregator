# TVBox Source Aggregator

自动从聚合源网站抓取 TVBox 配置，清洗去重、测速筛选后合并成一个完整的 TVBox JSON 配置，部署在 Cloudflare Worker 上供客户端直接使用。

## 线上地址

| 端点 | 方法 | 说明 |
|------|------|------|
| `https://tvbox.rio.edu.kg/` | GET | TVBox 配置 JSON（客户端填这个地址） |
| `https://tvbox.rio.edu.kg/status` | GET | 仪表盘监控页面 |
| `https://tvbox.rio.edu.kg/status-data` | GET | 状态数据 JSON |
| `https://tvbox.rio.edu.kg/refresh` | POST | 手动触发聚合刷新 |

## 工作原理

```
[Cron 每天 UTC 5:00 / 北京时间 13:00]
      ↓
[1] 抓取 juwanhezi.com?type=one → 解析 HTML → 提取 ~20 个配置 URL
      ↓
[2] 并发 fetch 每个配置 URL → 解析 TVBox JSON（带超时和容错）
      ↓
[3] 测速（zbape.com API，1QPS）→ 过滤高延迟/不可达的配置
      ↓
[4] 站点级去重 + 合并 → Spider JAR 智能分配（全局 + per-site）
      ↓
[5] 输出完整 TVBox JSON → 存入 KV → 客户端请求时直接返回
```

### 核心处理逻辑

**Spider JAR 合并**：不同配置的 type:3 站点依赖不同 JAR。统计引用频次，最常见的 JAR 作为全局 `spider`，其余站点通过 per-site `jar` 字段携带自己的 JAR URL。

**去重规则**：

| 字段 | 去重键 | 冲突处理 |
|------|--------|---------|
| sites | `key` + `api` | key 冲突加来源后缀 |
| parses | `name` + `url` | 保留第一个 |
| lives | `url` | 保留第一个 |
| doh | `url` | 保留第一个 |
| rules | `host`/`hosts` | 合并 regex 数组 |
| hosts | domain | 后者覆盖 |
| ads/flags | 值去重 | 合并 |

**容错设计**：抓取失败 / 所有配置 fetch 失败 → 保留 KV 中上次有效缓存继续服务。

## 项目结构

```
scripts/cf-worker/
├── src/
│   ├── index.ts          # Worker 入口：路由、Cron handler、聚合流程编排
│   ├── scraper.ts        # juwanhezi.com HTML 抓取 + 配置 URL 提取
│   ├── fetcher.ts        # 批量 fetch TVBox JSON 配置（并发、超时、JSON 容错解析）
│   ├── parser.ts         # 配置规范化（相对 URL 转绝对、Spider JAR 提取）
│   ├── merger.ts         # 站点级合并引擎（Spider JAR 智能分配）
│   ├── dedup.ts          # 去重逻辑（sites/parses/lives/doh/rules/hosts/ads/flags）
│   ├── speedtest.ts      # zbape.com 测速 API 封装（1QPS 限流、批量串行）
│   ├── dashboard.ts      # 仪表盘 HTML 页面（内联 CSS/JS）
│   ├── types.ts          # TVBox 配置完整 TypeScript 类型定义
│   └── config.ts         # 常量配置（URL、阈值、KV key）
├── wrangler.toml         # CF Worker 配置（路由、KV、Cron、环境变量）
├── package.json
└── tsconfig.json
```

总计约 1,630 行 TypeScript 代码。

## 本地开发

```bash
cd scripts/cf-worker
npm install
npm run dev          # 启动本地 dev server (localhost:8787)
```

本地测试聚合流程：
```bash
curl -X POST http://localhost:8787/refresh
curl http://localhost:8787/status-data
curl http://localhost:8787/ | python3 -m json.tool | head -20
```

## 部署

```bash
npm run deploy       # 部署到 Cloudflare Workers
```

### 环境变量 / Secrets

| 变量 | 类型 | 说明 |
|------|------|------|
| `ZBAPE_API_KEY` | Secret | zbape.com 测速 API 密钥 |
| `REFRESH_TOKEN` | Secret（可选） | 手动刷新鉴权 Bearer token |
| `SPEED_TIMEOUT_MS` | Var | 配置 URL 延迟阈值，默认 5000ms |
| `SITE_TIMEOUT_MS` | Var | 站点 API 延迟阈值，默认 3000ms |
| `FETCH_TIMEOUT_MS` | Var | fetch 配置 JSON 超时，默认 5000ms |

设置 secret：
```bash
echo "your-api-key" | npx wrangler secret put ZBAPE_API_KEY
```

### Cloudflare 资源

| 资源 | ID |
|------|-----|
| KV Namespace | `0a954fa3ef4847a1911d39eab5b3dd0b` |
| KV Preview | `01be699a3f2e4e85a7b907ad1ce87c95` |
| Zone (rio.edu.kg) | `9453759b5d753b4a6ccbeefc506be0a9` |
| 自定义域名 | `tvbox.rio.edu.kg` (AAAA → 100::, Proxied) |

## 数据源

当前抓取 [聚玩盒子](https://www.juwanhezi.com/jsonlist?type=one) 的单仓配置列表（约 20 个源）。

HTML 解析逻辑：提取 `<label>名称</label> + <input id="copyN" value="配置URL">` 组合。

## 后续可扩展

- [ ] 支持多仓（`type=many`）源抓取
- [ ] 支持更多聚合源网站
- [ ] 站点 API 二级测速（type:0/1 站点）
- [ ] JAR 文件代理缓存（R2 存储）
- [ ] 加密配置解密支持
