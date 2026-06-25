# 商家自定义域名 & 三级子域名自动生成 & AI功能分离 — 完整实施方案

> **项目**: ZYG-online-chat（CF 智能多语言在线客服系统）  
> **日期**: 2026-06-25  
> **版本**: v1.0

---

## 目录

1. [需求概述](#1-需求概述)
2. [现状分析](#2-现状分析)
3. [方案总览](#3-方案总览)
   - 3.1 核心思路
   - 3.2 域名识别优先级
   - 3.3 三级域名策略矩阵
   - 3.4 🔒 向后兼容策略
   - 3.5 各访问模式生命周期
4. [技术架构](#4-技术架构)
5. [数据库设计](#5-数据库设计)
6. [核心模块设计](#6-核心模块设计)
7. [API 接口设计](#7-api-接口设计)
8. [前端界面设计](#8-前端界面设计)
9. [域名策略矩阵](#9-域名策略矩阵)
10. [实施阶段计划](#10-实施阶段计划)
11. [风险与注意事项](#11-风险与注意事项)
    - 11.1 技术风险
    - 11.2 安全注意事项
    - 11.3 回滚方案
    - 11.4 嵌入代码兼容性保证
12. [附录](#12-附录)

---

## 1. 需求概述

### 1.1 核心需求

| 编号 | 需求 | 优先级 |
|------|------|:------:|
| R1 | 每个商家自动生成随机三级专属子域名 | P0 |
| R2 | 商家无需 CF 账号即可使用专属链接 | P0 |
| R3 | CF 账号商家一键绑定自定义域名 | P1 |
| R4 | 非 CF 平台域名手动 CNAME 绑定 | P1 |
| R5 | 商家可选使用自己 CF 账号的 AI 配额 | P2 |
| **R0** | **🔒 旧 `?business={slug}` 模式永久保留不废弃** | **P0** |

### 1.2 目标域名规划

| 域名 | 用途 |
|------|------|
| `zygmail.icu` | 平台根域名（已在 CF 中） |
| `zygonlinechat.zygmail.icu` | 平台主站入口 |
| `{slug}.zygonlinechat.zygmail.icu` | 商家专属三级子域名（自动生成） |
| `chat.customershop.com` | 商家自有域名（手动/自动绑定） |

### 1.3 链接进化对比

```
链接进化路线（新老并存，旧模式永久保留）：

🔧 当前模式（永久保留作为兜底）:
   https://zyg-online-chat.linzihai.workers.dev/chat?business=9y66upxd
   https://zygonlinechat.zygmail.icu/chat?business=9y66upxd

✅ 阶段一（三级子域名）:
   https://9y66upxd.zygonlinechat.zygmail.icu

✅ 阶段二（商家自有域名）:
   https://chat.myshop.com
```

> ⚠️ **重要**: `?business={slug}` URL参数模式**永久保留**，不做废弃或重定向强制升级。所有新旧链接均可正常访问，商家可根据需要自行选择使用哪种链接。旧链接中的 `workers.dev` 域名虽然不够专业，但在开发和调试场景中仍有价值。

---

## 2. 现状分析

### 2.1 当前技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| **运行平台** | Cloudflare Workers | 单 Worker 部署 |
| **数据库** | Cloudflare D1 (SQLite) | 18 张表，多租户架构 |
| **文件存储** | Cloudflare R2 | 文件上传 |
| **AI 能力** | Workers AI binding | `@cf/meta/m2m100-1.2b` 翻译模型 |
| **Web 框架** | Hono | 轻量级路由 |
| **前端** | React + Vite + Zustand | SPA 应用 |
| **认证** | JWT 双密钥 | 客服端 + 管理端 |

### 2.2 当前商家模型

```
staff_users 表:
  ├── id (主键)
  ├── business_id = 0  → 商家主账号（自己是商家）
  ├── business_id > 0  → 下级客服（归属到某个商家）
  ├── business_slug    → 8位随机字母数字（用于URL识别）
  ├── business_name    → 商家名称
  ├── role             → 'admin' | 'staff'
  └── username/password_hash → 登录凭据
```

### 2.3 当前访问方式

```
商家识别流程:
  1. 访客通过 URL 参数传递: ?business={slug}
     例: https://zyg-online-chat.linzihai.workers.dev/chat?business=9y66upxd
  2. chat-service 通过 getBusinessBySlug() 识别商家
  3. 所有查询带上 business_id 条件实现数据隔离
```

> 📌 **兼容策略**: 此 `?business=` 参数模式作为**基础识别机制**永久保留，不会被废弃。新的三级子域名和自定义域名方案是**增量增强**，不影响现有功能。

### 2.4 存在的问题

1. 链接包含 `workers.dev` 域名，不够专业
2. 必须带 `?business=` 参数，不美观
3. 商家无法使用自己的域名
4. 所有商家共享平台的 AI 配额

> ⚠️ **保留原则**: 虽然上述链接形式不够专业，但 `?business={slug}` 参数识别机制本身是稳定可靠的，将作为**永久兜底方案**保留，确保已有嵌入代码、分享链接不会失效。

---

## 3. 方案总览

### 3.1 核心思路

利用 **Cloudflare 泛域名 DNS + Workers Routes 通配符** 特性：

- **一条 DNS 记录** → 覆盖所有三级子域名
- **一条 Worker Route** → 所有请求自动路由到同一 Worker
- **Host 头识别** → Worker 内部自动区分商家

```
DNS 配置（一次性）:
  *.zygonlinechat.zygmail.icu  CNAME  zygonlinechat.zygmail.icu  (Proxied)

Workers Routes（一次性）:
  *zygonlinechat.zygmail.icu/*  →  zyg-online-chat Worker

效果:
  任何 {slug}.zygonlinechat.zygmail.icu 自动到达 Worker
  → Worker 读取 Host 头提取 slug → 识别商家
```

### 3.2 域名识别优先级

```
请求到达 Worker → domain-router 中间件:

  ┌─────────────────────────────────────────────────────────┐
  │ 1. Host 匹配 *.zygonlinechat.zygmail.icu               │
  │    → 提取子域名 = business_slug                         │
  │    → 查 staff_users 表识别商家                          │
  │    → 优先级: 最高（新方案主推模式）                       │
  ├─────────────────────────────────────────────────────────┤
  │ 2. Host 匹配 business_domains 表中的自定义域名           │
  │    → 查表获取 business_id                               │
  │    → 优先级: 中（商家自有域名）                           │
  ├─────────────────────────────────────────────────────────┤
  │ 3. URL 参数 ?business={slug}                            │
  │    → 🔒 永久保留的兜底方案，永不废弃                     │
  │    → 兼容旧模式、嵌入代码、分享链接                      │
  │    → 优先级: 低（但始终可用）                            │
  └─────────────────────────────────────────────────────────┘

识别逻辑:
  - 如果 Host 匹配三级子域名 → 优先使用（无需URL参数）
  - 如果 Host 匹配自定义域名 → 优先使用（无需URL参数）  
  - 否则 → 回退到 URL 参数 ?business={slug}（始终有效）
  - 仅当以上三者都无法识别商家时，才返回404或进入平台首页
```

### 3.3 三级域名策略矩阵

| 商家类型 | 域名格式 | 需要CF账号 | 需要DNS配置 | SSL | 实施难度 |
|---------|---------|:--------:|:--------:|:---:|:------:|
| 🌟 平台分发 | `{slug}.zygonlinechat.zygmail.icu` | ❌ | ❌ 全自动 | ✅ 自动 | ⭐ 低 |
| 🏠 自有CF域名 | `chat.myshop.com` | ✅ | 🔧 一键自动 | ✅ 自动 | ⭐⭐ 中 |
| 🌍 第三方域名 | `support.othershop.com` | ❌ | ✋ 手动CNAME | ⚠️ 自行配置 | ⭐⭐⭐ 高 |

### 3.4 向后兼容策略（核心原则）

```
                    🔒 永久保留承诺

  ┌─────────────────────────────────────────────────────────┐
  │                                                         │
  │   ?business={slug} URL参数模式 —— 永不废弃             │
  │                                                         │
  │   所有以下链接同时有效，商家可混用:                       │
  │                                                         │
  │   ✅ https://9y66upxd.zygonlinechat.zygmail.icu        │
  │          (三级子域名 - 专业模式)                         │
  │                                                         │
  │   ✅ https://zygonlinechat.zygmail.icu/chat?business=9y66upxd │
  │          (平台主域名+参数 - 兼容模式)                     │
  │                                                         │
  │   ✅ https://zyg-online-chat.linzihai.workers.dev/chat?business=9y66upxd │
  │          (workers.dev域名 - 调试/旧模式)                 │
  │                                                         │
  │   ✅ https://chat.myshop.com (自定义域名 - 品牌模式)     │
  │                                                         │
  └─────────────────────────────────────────────────────────┘

设计决策:
  ├── 不做 301/302 重定向 → 避免破坏已有嵌入代码和分享链接
  ├── 不做强制升级 → 商家自主选择切换时机
  ├── 不废弃 API 路由 → /api/chat/* 路径在所有域名下保持一致
  └── 不影响 SEO → 多域名访问同一内容无负面影响
```

### 3.5 各访问模式的生命周期

| 阶段 | workers.dev | 平台域名+参数 | 三级子域名 | 自定义域名 |
|------|:----------:|:----------:|:--------:|:--------:|
| 当前 | ✅ 主用 | 🔜 即将启用 | 🔜 即将支持 | 🔜 即将支持 |
| 阶段一后 | ✅ 保留 | ✅ 主用 | ✅ 主推 | 🔜 开发中 |
| 阶段二后 | ✅ 保留 | ✅ 保留 | ✅ 主推 | ✅ 支持 |
| 长期 | ✅ 开发调试用 | ✅ 保留 | ✅ 默认分配 | ✅ 品牌升级 |
| **是否废弃** | ❌ 永不 | ❌ 永不 | ❌ 永不 | ❌ 永不 |

---

## 4. 技术架构

### 4.1 整体架构图

```
┌──────────────────────────────────────────────────────────────────┐
│                        Cloudflare Workers                         │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                    Hono Web Framework                        │ │
│  │                                                              │ │
│  │  ┌──────────────────────────────────────────────────────┐   │ │
│  │  │          🆕 domain-router.ts 中间件                     │   │ │
│  │  │  Host Header → 三级子域名/自定义域名 → business_id     │   │ │
│  │  └──────────────────────┬───────────────────────────────┘   │ │
│  │                         │                                    │ │
│  │  ┌──────────┐ ┌────────▼─────┐ ┌──────────────────────┐    │ │
│  │  │ 访客端   │ │   客服端      │ │     管理后台          │    │ │
│  │  │/api/chat │ │ /api/staff   │ │  /api/admin           │    │ │
│  │  └──────────┘ └──────────────┘ └──────────────────────┘    │ │
│  │                                                              │ │
│  │  ┌──────────────────────────────────────────────────────┐   │ │
│  │  │              🆕 新增模块                              │   │ │
│  │  │  domain-service.ts  — 域名管理业务逻辑                 │   │ │
│  │  │  cf-api-client.ts   — Cloudflare API 客户端           │   │ │
│  │  │  ai-router.ts       — AI 路由决策层                   │   │ │
│  │  │  crypto.ts          — Token 加密工具                  │   │ │
│  │  └──────────────────────────────────────────────────────┘   │ │
│  │                                                              │ │
│  │  ┌──────────────────────────────────────────────────────┐   │ │
│  │  │                    数据层                             │   │ │
│  │  │  D1: business_domains 表 + business_ai_config 表      │   │ │
│  │  │  (新增2张表)                                          │   │ │
│  │  └──────────────────────────────────────────────────────┘   │ │
│  └─────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘

DNS 层:
  zygmail.icu Zone:
    ├── zygonlinechat          CNAME  →  (Worker)
    └── *.zygonlinechat        CNAME  →  zygonlinechat.zygmail.icu (Proxied)
```

### 4.2 新增/修改文件清单

```
src/server/
├── middleware/
│   └── domain-router.ts              🆕 域名→商家映射中间件
├── services/
│   ├── cf-api-client.ts              🆕 Cloudflare API 基础客户端
│   ├── domain-service.ts             🆕 域名管理业务逻辑
│   ├── ai-router.ts                  🆕 AI 路由决策层
│   └── crypto.ts                     🆕 Token/AES 加密工具
├── module-business/
│   └── routes/
│       └── business-domain-routes.ts 🆕 域名管理 API 路由
├── shared/
│   └── db.ts                         🔧 新增2张表建表+迁移
├── index.worker.ts                   🔧 集成中间件+路由
└── shared/
    └── types.ts                      🔧 新增域名相关类型

src/client/
├── pages/
│   └── staff/
│       └── DomainSettingsPage.tsx    🆕 域名管理页面
├── components/
│   └── staff/
│       ├── DomainList.tsx            🆕 域名列表组件
│       ├── DomainBindWizard.tsx      🆕 一键绑定向导
│       └── DomainManualGuide.tsx     🆕 手动绑定引导
└── stores/
    └── domainStore.ts                🆕 域名状态管理

wrangler.toml                          🔧 添加 routes 配置
```

---

## 5. 数据库设计

### 5.1 新增表：`business_domains`（商家域名绑定表）

```sql
CREATE TABLE IF NOT EXISTS business_domains (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  -- 关联商家
  business_id INTEGER NOT NULL,
  staff_user_id INTEGER NOT NULL,

  -- 域名类型
  -- 'auto_subdomain': 平台自动生成的三级域名 {slug}.zygonlinechat.zygmail.icu
  -- 'custom_cf':      商家自有域名（在 Cloudflare 上）
  -- 'custom_external': 商家自有域名（第三方平台，如阿里云/GoDaddy 等）
  domain_type TEXT NOT NULL DEFAULT 'auto_subdomain',

  -- 实际域名（如 '9y66upxd.zygonlinechat.zygmail.icu' 或 'chat.myshop.com'）
  domain TEXT NOT NULL UNIQUE,

  -- 三级子域名部分（仅 auto_subdomain 类型有意义）
  subdomain TEXT,

  -- 自定义域名来源平台
  -- 'cloudflare' | 'aliyun' | 'godaddy' | 'namesilo' | 'tencent' | 'other'
  domain_platform TEXT DEFAULT 'cloudflare',

  -- ===== Cloudflare 特有字段 =====
  -- CF Zone ID（仅 platform='cloudflare' 时有值）
  cf_zone_id TEXT,
  -- CF Zone 名称（如 'myshop.com'）
  cf_zone_name TEXT,
  -- CF Account ID（商家自己的CF账户ID）
  cf_account_id TEXT,
  -- 加密存储的 CF API Token（AES-256-GCM）
  cf_api_token_encrypted TEXT,
  -- CF DNS 记录 ID
  cf_dns_record_id TEXT,
  -- CF Worker Route ID
  cf_worker_route_id TEXT,

  -- ===== 通用状态字段 =====
  -- 验证状态: pending → dns_verifying → dns_verified → ssl_provisioning → active → failed
  verification_status TEXT DEFAULT 'pending',
  -- SSL状态: pending → provisioning → active → failed
  ssl_status TEXT DEFAULT 'pending',
  -- 是否为主域名（每个商家只有一个主域名）
  is_primary INTEGER DEFAULT 0,
  -- 绑定状态: active / inactive / error
  status TEXT DEFAULT 'active',

  -- 错误信息（验证失败时记录）
  error_message TEXT,

  -- 时间戳
  verified_at INTEGER,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch()),

  FOREIGN KEY (business_id) REFERENCES staff_users(id),
  FOREIGN KEY (staff_user_id) REFERENCES staff_users(id)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_business_domains_domain
  ON business_domains(domain);
CREATE INDEX IF NOT EXISTS idx_business_domains_business_id
  ON business_domains(business_id);
CREATE INDEX IF NOT EXISTS idx_business_domains_type_status
  ON business_domains(domain_type, status);
```

### 5.2 新增表：`business_ai_config`（商家 AI 配置表）

```sql
CREATE TABLE IF NOT EXISTS business_ai_config (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  -- 关联商家（一对一）
  business_id INTEGER NOT NULL UNIQUE,

  -- AI 模式
  -- 'platform':  使用平台 Workers AI binding（默认，所有商家共享）
  -- 'own_cf':    使用商家自己的 Cloudflare Workers AI（REST API 调用）
  ai_mode TEXT DEFAULT 'platform',

  -- 自有 CF AI 配置（仅 ai_mode='own_cf' 时有值）
  cf_account_id TEXT,              -- 商家 CF Account ID
  cf_ai_token_encrypted TEXT,      -- 加密的 CF API Token（需 AI 权限）

  -- AI Gateway 配置（可选，用于统一代理）
  ai_gateway_url TEXT,

  -- 用量统计
  monthly_translate_count INTEGER DEFAULT 0,
  monthly_translate_limit INTEGER DEFAULT 10000,
  total_translate_count INTEGER DEFAULT 0,
  reset_day INTEGER DEFAULT 1,           -- 每月几号重置计数

  -- 状态
  status TEXT DEFAULT 'active',

  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch()),

  FOREIGN KEY (business_id) REFERENCES staff_users(id)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_business_ai_config_business_id
  ON business_ai_config(business_id);
```

### 5.3 新增表：`domain_operation_logs`（域名操作日志表）

```sql
CREATE TABLE IF NOT EXISTS domain_operation_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id INTEGER NOT NULL,
  domain_id INTEGER,
  operation TEXT NOT NULL,     -- 'create' | 'bind' | 'unbind' | 'verify' | 'dns_update' | 'delete'
  details TEXT,                -- JSON 格式的详细信息
  status TEXT DEFAULT 'success',
  ip_address TEXT,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_domain_logs_business_id
  ON domain_operation_logs(business_id);
CREATE INDEX IF NOT EXISTS idx_domain_logs_created_at
  ON domain_operation_logs(created_at);
```

### 5.4 数据库迁移

在 `src/server/shared/db.ts` 的 `runMigrations()` 函数中追加：

```typescript
// 迁移: 创建 business_domains 表
{
  // 检查表是否存在
  const exists = await database.get(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='business_domains'"
  );
  if (!exists) {
    await database.exec(`
      CREATE TABLE IF NOT EXISTS business_domains ( ... )
    `);
    console.log('[Migration] Created business_domains table');
  }
}

// 迁移: 创建 business_ai_config 表
{ /* 同上 */ }

// 迁移: 创建 domain_operation_logs 表
{ /* 同上 */ }

// 迁移: 为已有商家自动生成 auto_subdomain
{
  const businesses = await database.all(
    "SELECT id, business_slug FROM staff_users WHERE business_id = 0 AND business_slug IS NOT NULL"
  );
  for (const biz of businesses) {
    const domain = `${biz.business_slug}.zygonlinechat.zygmail.icu`;
    const existing = await database.get(
      "SELECT id FROM business_domains WHERE business_id = ? AND domain_type = 'auto_subdomain'",
      [biz.id]
    );
    if (!existing) {
      await database.run(
        `INSERT INTO business_domains
         (business_id, staff_user_id, domain_type, domain, subdomain, verification_status, ssl_status, is_primary, status)
         VALUES (?, ?, 'auto_subdomain', ?, ?, 'active', 'active', 1, 'active')`,
        [biz.id, biz.id, domain, biz.business_slug]
      );
    }
  }
  console.log('[Migration] Auto-generated subdomains for existing businesses');
}
```

---

## 6. 核心模块设计

### 6.1 `domain-router.ts` — 域名路由中间件

```typescript
/**
 * 域名路由中间件
 * 功能：根据请求 Host 头自动识别商家，设置 business_id 上下文
 *
 * 识别优先级:
 *   1. 三级子域名: {slug}.zygonlinechat.zygmail.icu
 *   2. 自定义域名: 查 business_domains 表
 *   3. URL参数:    ?business={slug}（🔒 永久兜底，永不废弃）
 *
 * 兼容策略:
 *   - workers.dev 域名访问时自动走策略3（URL参数模式）
 *   - 不做自动重定向，新旧链接并存
 *   - business 上下文设置后，后续路由无需关心识别来源
 *
 * 位置: src/server/middleware/domain-router.ts
 */

import type { Context, Next } from 'hono';
import { getDb } from '@server/shared/db';

// 域名后缀常量（可通过环境变量覆盖）
const SUBDOMAIN_SUFFIX = '.zygonlinechat.zygmail.icu';
const PLATFORM_DOMAIN = 'zygonlinechat.zygmail.icu';

// 内存缓存：域名→商家映射（减少数据库查询）
// Workers 无状态，每个实例独立缓存，设置较短 TTL
interface DomainCacheEntry {
  businessId: number;
  businessSlug: string;
  businessName: string;
  viaDomain: string;
  expiredAt: number;
}
const domainCache = new Map<string, DomainCacheEntry>();
const CACHE_TTL = 5 * 60 * 1000; // 5分钟

/**
 * 中间件工厂函数
 */
export function createDomainRouter() {
  return async (c: Context, next: Next) => {
    const host = (c.req.header('host') || '').toLowerCase();
    const url = new URL(c.req.url);

    // ===== 策略1: 三级子域名识别 =====
    const subdomainMatch = matchSubdomain(host);
    if (subdomainMatch) {
      const cached = getFromCache(host);
      if (cached) {
        setBusinessContext(c, cached);
        return next();
      }

      const db = getDb();
      const biz = await db.get<{
        id: number; business_slug: string; business_name: string;
      }>(
        `SELECT id, business_slug, business_name
         FROM staff_users
         WHERE business_slug = ? AND business_id = 0`,
        [subdomainMatch.slug]
      );

      if (biz) {
        setBusinessContext(c, {
          businessId: biz.id,
          businessSlug: biz.business_slug,
          businessName: biz.business_name || '',
          viaDomain: 'subdomain',
          expiredAt: Date.now() + CACHE_TTL,
        });
        cacheDomain(host, {
          businessId: biz.id,
          businessSlug: biz.business_slug,
          businessName: biz.business_name || '',
          viaDomain: 'subdomain',
          expiredAt: Date.now() + CACHE_TTL,
        });
        return next();
      }

      // slug无效 → 404
      return c.json({ success: false, error: '商家不存在或已停用' }, 404);
    }

    // ===== 策略2: 自定义域名匹配 =====
    if (host !== PLATFORM_DOMAIN && !host.endsWith('.workers.dev')) {
      const cached = getFromCache(host);
      if (cached) {
        setBusinessContext(c, cached);
        return next();
      }

      const db = getDb();
      const domain = await db.get<{
        business_id: number; business_slug: string; business_name: string;
      }>(
        `SELECT bd.business_id, su.business_slug, su.business_name
         FROM business_domains bd
         JOIN staff_users su ON bd.business_id = su.id
         WHERE bd.domain = ? AND bd.status = 'active'
           AND bd.verification_status IN ('dns_verified', 'active')`,
        [host]
      );

      if (domain) {
        setBusinessContext(c, {
          businessId: domain.business_id,
          businessSlug: domain.business_slug,
          businessName: domain.business_name || '',
          viaDomain: 'custom',
          expiredAt: Date.now() + CACHE_TTL,
        });
        cacheDomain(host, {
          businessId: domain.business_id,
          businessSlug: domain.business_slug,
          businessName: domain.business_name || '',
          viaDomain: 'custom',
          expiredAt: Date.now() + CACHE_TTL,
        });
        return next();
      }

      // 自定义域名未绑定 → 返回平台首页或错误页
      // 不拦截，让后续路由处理
    }

    // ===== 策略3: URL参数兼容旧模式 =====
    const businessParam = url.searchParams.get('business');
    if (businessParam) {
      const db = getDb();
      const biz = await db.get<{
        id: number; business_slug: string; business_name: string;
      }>(
        `SELECT id, business_slug, business_name
         FROM staff_users
         WHERE business_slug = ? AND business_id = 0`,
        [businessParam]
      );

      if (biz) {
        setBusinessContext(c, {
          businessId: biz.id,
          businessSlug: biz.business_slug,
          businessName: biz.business_name || '',
          viaDomain: 'url_param',
          expiredAt: Date.now() + CACHE_TTL,
        });
      }
    }

    return next();
  };
}

// ===== 辅助函数 =====

interface SubdomainMatch { slug: string; }

function matchSubdomain(host: string): SubdomainMatch | null {
  // 匹配: {slug}.zygonlinechat.zygmail.icu
  const pattern = new RegExp(
    `^([a-z0-9]+)\\.${SUBDOMAIN_SUFFIX.replace(/\./g, '\\.')}$`,
    'i'
  );
  const match = host.match(pattern);
  if (match) {
    return { slug: match[1] };
  }
  return null;
}

function setBusinessContext(c: Context, entry: DomainCacheEntry): void {
  c.set('businessId', entry.businessId);
  c.set('businessSlug', entry.businessSlug);
  c.set('businessName', entry.businessName);
  c.set('viaDomain', entry.viaDomain);
}

function getFromCache(host: string): DomainCacheEntry | null {
  const entry = domainCache.get(host);
  if (entry && entry.expiredAt > Date.now()) {
    return entry;
  }
  if (entry) {
    domainCache.delete(host); // 清理过期条目
  }
  return null;
}

function cacheDomain(host: string, entry: DomainCacheEntry): void {
  domainCache.set(host, entry);
}
```

### 6.2 `cf-api-client.ts` — Cloudflare API 客户端

```typescript
/**
 * Cloudflare API 客户端
 * 封装与 Cloudflare API 的交互，用于域名自动绑定
 *
 * 位置: src/server/services/cf-api-client.ts
 */

const CF_API_BASE = 'https://api.cloudflare.com/client/v4';

export class CloudflareApiClient {
  private apiToken: string;

  constructor(apiToken: string) {
    this.apiToken = apiToken;
  }

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<{ success: boolean; result: T; errors: any[] }> {
    const response = await fetch(`${CF_API_BASE}${path}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`CF API Error ${response.status}: ${error}`);
    }

    return response.json();
  }

  /** 验证 API Token */
  async verifyToken(): Promise<{ id: string; status: string }> {
    const res = await this.request<{ id: string; status: string }>(
      '/user/tokens/verify'
    );
    return res.result;
  }

  /** 获取账号下的 Zone 列表 */
  async listZones(params?: { name?: string }): Promise<any[]> {
    const query = new URLSearchParams();
    if (params?.name) query.set('name', params.name);
    query.set('per_page', '50');

    const res = await this.request<any[]>(
      `/zones?${query.toString()}`
    );
    return res.result;
  }

  /** 获取 Zone 详情 */
  async getZone(zoneId: string): Promise<any> {
    const res = await this.request<any>(`/zones/${zoneId}`);
    return res.result;
  }

  /** 创建 DNS 记录 */
  async createDnsRecord(
    zoneId: string,
    record: {
      type: 'CNAME' | 'A' | 'AAAA';
      name: string;
      content: string;
      ttl?: number;
      proxied?: boolean;
    }
  ): Promise<any> {
    const res = await this.request<any>(
      `/zones/${zoneId}/dns_records`,
      {
        method: 'POST',
        body: JSON.stringify({
          type: record.type,
          name: record.name,
          content: record.content,
          ttl: record.ttl || 1,
          proxied: record.proxied !== false, // 默认开启代理（自动SSL）
        }),
      }
    );
    return res.result;
  }

  /** 删除 DNS 记录 */
  async deleteDnsRecord(zoneId: string, recordId: string): Promise<any> {
    const res = await this.request<any>(
      `/zones/${zoneId}/dns_records/${recordId}`,
      { method: 'DELETE' }
    );
    return res.result;
  }

  /** 获取 Account ID */
  async getAccountId(): Promise<string> {
    const res = await this.request<{ id: string }[]>('/accounts');
    return res.result[0]?.id || '';
  }
}
```

### 6.3 `domain-service.ts` — 域名管理服务

```typescript
/**
 * 域名管理业务逻辑
 *
 * 位置: src/server/services/domain-service.ts
 */

import { getDb } from '@server/shared/db';
import { CloudflareApiClient } from './cf-api-client';
import { encrypt, decrypt } from './crypto';

const PLATFORM_CNAME_TARGET = 'zygonlinechat.zygmail.icu';

export interface BindDomainInput {
  businessId: number;
  staffUserId: number;
  domain: string;           // 如: chat.myshop.com
  platform: string;         // 'cloudflare' | 'aliyun' | 'godaddy' | ...
  cfApiToken?: string;      // CF平台的API Token
}

export interface BindDomainResult {
  success: boolean;
  domainId?: number;
  domain?: string;
  dnsRecord?: { type: string; name: string; value: string };
  verificationStatus?: string;
  error?: string;
}

export class DomainService {

  /**
   * 为商家自动生成三级子域名
   * 在创建商家时调用
   */
  async createAutoSubdomain(
    businessId: number,
    slug: string
  ): Promise<BindDomainResult> {
    const db = getDb();
    const domain = `${slug}.zygonlinechat.zygmail.icu`;

    // 检查是否已存在
    const existing = await db.get<{ id: number }>(
      "SELECT id FROM business_domains WHERE domain = ?",
      [domain]
    );
    if (existing) {
      return { success: true, domainId: existing.id, domain };
    }

    // 写入数据库
    const result = await db.run(
      `INSERT INTO business_domains
       (business_id, staff_user_id, domain_type, domain, subdomain,
        verification_status, ssl_status, is_primary, status)
       VALUES (?, ?, 'auto_subdomain', ?, ?, 'active', 'active', 1, 'active')`,
      [businessId, businessId, domain, slug]
    );

    // 记录操作日志
    await this.logOperation(businessId, result.lastInsertRowid, 'auto_create', {
      domain,
      subdomain: slug,
    });

    return {
      success: true,
      domainId: result.lastInsertRowid,
      domain,
      verificationStatus: 'active',
    };
  }

  /**
   * CF 平台一键绑定自定义域名
   */
  async bindCFDomain(input: BindDomainInput): Promise<BindDomainResult> {
    const { businessId, staffUserId, domain, cfApiToken } = input;

    if (!cfApiToken) {
      return { success: false, error: '需要提供 Cloudflare API Token' };
    }

    const db = getDb();
    const cfClient = new CloudflareApiClient(cfApiToken);

    try {
      // Step 1: 验证 Token
      console.log('[DomainService] Step 1: Verifying API Token...');
      await cfClient.verifyToken();

      // Step 2: 获取 Zone 列表并匹配域名
      console.log('[DomainService] Step 2: Finding zone for domain:', domain);
      const rootDomain = this.extractRootDomain(domain);
      const zones = await cfClient.listZones({ name: rootDomain });
      const targetZone = zones[0];

      if (!targetZone) {
        return {
          success: false,
          error: `未找到域名 ${rootDomain} 对应的 Zone，请确认该域名已添加到 Cloudflare`,
        };
      }

      // Step 3: 获取 Account ID
      const accountId = await cfClient.getAccountId();

      // Step 4: 创建 DNS CNAME 记录
      console.log('[DomainService] Step 4: Creating DNS CNAME record...');
      const subdomain = this.extractSubdomain(domain, rootDomain);
      const dnsRecord = await cfClient.createDnsRecord(targetZone.id, {
        type: 'CNAME',
        name: subdomain,
        content: PLATFORM_CNAME_TARGET,
        proxied: true, // 开启CDN代理，自动SSL
      });

      // Step 5: 写入数据库
      console.log('[DomainService] Step 5: Saving to database...');
      const encryptedToken = await encrypt(cfApiToken);

      const result = await db.run(
        `INSERT INTO business_domains
         (business_id, staff_user_id, domain_type, domain,
          domain_platform, cf_zone_id, cf_zone_name,
          cf_account_id, cf_api_token_encrypted, cf_dns_record_id,
          verification_status, ssl_status, is_primary, status)
         VALUES (?, ?, 'custom_cf', ?, 'cloudflare', ?, ?, ?, ?, ?,
                 'dns_verified', 'provisioning', 0, 'active')`,
        [
          businessId, staffUserId, domain,
          targetZone.id, targetZone.name,
          accountId, encryptedToken, dnsRecord.id,
        ]
      );

      // Step 6: 记录日志
      await this.logOperation(businessId, result.lastInsertRowid, 'bind_cf', {
        domain,
        zoneId: targetZone.id,
        zoneName: targetZone.name,
        dnsRecordId: dnsRecord.id,
      });

      return {
        success: true,
        domainId: result.lastInsertRowid,
        domain,
        verificationStatus: 'dns_verified',
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('[DomainService] bindCFDomain error:', errorMsg);

      await this.logOperation(businessId, 0, 'bind_cf_failed', {
        domain,
        error: errorMsg,
      });

      return { success: false, error: errorMsg };
    }
  }

  /**
   * 非CF平台手动绑定（仅生成配置指引）
   */
  async bindManualDomain(input: BindDomainInput): Promise<BindDomainResult> {
    const { businessId, staffUserId, domain, platform } = input;
    const db = getDb();

    // 检查域名是否已绑定
    const existing = await db.get<{ id: number }>(
      "SELECT id FROM business_domains WHERE domain = ?",
      [domain]
    );
    if (existing) {
      return { success: false, error: '该域名已被绑定' };
    }

    // 写入数据库（pending 状态）
    const result = await db.run(
      `INSERT INTO business_domains
       (business_id, staff_user_id, domain_type, domain,
        domain_platform, verification_status, ssl_status, is_primary, status)
       VALUES (?, ?, 'custom_external', ?, ?, 'pending', 'pending', 0, 'active')`,
      [businessId, staffUserId, domain, platform]
    );

    await this.logOperation(businessId, result.lastInsertRowid, 'bind_manual', {
      domain,
      platform,
    });

    // 返回 DNS 配置指引
    return {
      success: true,
      domainId: result.lastInsertRowid,
      domain,
      dnsRecord: {
        type: 'CNAME',
        name: this.extractSubdomain(domain, this.extractRootDomain(domain)),
        value: PLATFORM_CNAME_TARGET,
      },
      verificationStatus: 'pending',
    };
  }

  /**
   * 验证手动绑定的域名 DNS 是否生效
   */
  async verifyManualDomain(domainId: number): Promise<{
    success: boolean;
    verified: boolean;
    message: string;
  }> {
    const db = getDb();
    const record = await db.get<{
      id: number; business_id: number; domain: string;
    }>(
      "SELECT id, business_id, domain FROM business_domains WHERE id = ?",
      [domainId]
    );

    if (!record) {
      return { success: false, verified: false, message: '域名记录不存在' };
    }

    try {
      // DNS 解析检查
      const resolved = await this.checkDnsResolution(record.domain);
      if (resolved) {
        // 验证通过，更新状态
        await db.run(
          `UPDATE business_domains
           SET verification_status = 'dns_verified', verified_at = ?,
               updated_at = ?
           WHERE id = ?`,
          [Math.floor(Date.now() / 1000), Math.floor(Date.now() / 1000), domainId]
        );

        await this.logOperation(record.business_id, domainId, 'verify_success', {
          domain: record.domain,
        });

        return { success: true, verified: true, message: 'DNS 验证通过' };
      }

      return {
        success: true,
        verified: false,
        message: 'DNS 记录尚未生效，请确认已正确配置 CNAME 记录',
      };
    } catch (error) {
      return {
        success: true,
        verified: false,
        message: 'DNS 验证失败，请稍后重试',
      };
    }
  }

  /**
   * 获取商家的域名列表
   */
  async getBusinessDomains(businessId: number): Promise<any[]> {
    const db = getDb();
    return db.all(
      `SELECT id, domain_type, domain, subdomain, domain_platform,
              verification_status, ssl_status, is_primary, status,
              created_at, updated_at
       FROM business_domains
       WHERE business_id = ?
       ORDER BY is_primary DESC, created_at ASC`,
      [businessId]
    );
  }

  /**
   * 删除域名绑定
   */
  async deleteDomain(businessId: number, domainId: number): Promise<boolean> {
    const db = getDb();

    // 检查是否属于该商家
    const record = await db.get(
      "SELECT id, domain_type, cf_zone_id, cf_dns_record_id FROM business_domains WHERE id = ? AND business_id = ?",
      [domainId, businessId]
    );
    if (!record) return false;

    // 如果是CF自动绑定的，需要清理DNS记录
    if (record.domain_type === 'custom_cf' && record.cf_zone_id && record.cf_dns_record_id) {
      // TODO: 需要商家的API Token来删除，安全性考虑暂不自动删除
      console.log('[DomainService] DNS cleanup skipped for security');
    }

    // 软删除
    await db.run(
      "UPDATE business_domains SET status = 'inactive', updated_at = ? WHERE id = ?",
      [Math.floor(Date.now() / 1000), domainId]
    );

    await this.logOperation(businessId, domainId, 'delete', {
      domainType: record.domain_type,
    });

    return true;
  }

  // ========== 私有辅助方法 ==========

  /** 提取根域名 */
  private extractRootDomain(domain: string): string {
    const parts = domain.split('.');
    if (parts.length <= 2) return domain;
    return parts.slice(-2).join('.');
  }

  /** 提取子域名部分 */
  private extractSubdomain(domain: string, rootDomain: string): string {
    if (domain === rootDomain) return '@';
    const sub = domain.replace(`.${rootDomain}`, '');
    return sub;
  }

  /** 检查 DNS 解析 */
  private async checkDnsResolution(domain: string): Promise<boolean> {
    try {
      const response = await fetch(`https://cloudflare-dns.com/dns-query?name=${domain}&type=CNAME`, {
        headers: { 'Accept': 'application/dns-json' },
      });
      const data = await response.json() as any;
      if (data.Answer) {
        return data.Answer.some(
          (a: any) => a.type === 5 && a.data.toLowerCase().includes(PLATFORM_CNAME_TARGET.toLowerCase())
        );
      }
      return false;
    } catch {
      return false;
    }
  }

  /** 记录操作日志 */
  private async logOperation(
    businessId: number,
    domainId: number,
    operation: string,
    details: any
  ): Promise<void> {
    try {
      const db = getDb();
      await db.run(
        `INSERT INTO domain_operation_logs (business_id, domain_id, operation, details, status)
         VALUES (?, ?, ?, ?, 'success')`,
        [businessId, domainId, operation, JSON.stringify(details)]
      );
    } catch (error) {
      console.error('[DomainService] Failed to log operation:', error);
    }
  }
}

// 单例
let domainServiceInstance: DomainService | null = null;

export function getDomainService(): DomainService {
  if (!domainServiceInstance) {
    domainServiceInstance = new DomainService();
  }
  return domainServiceInstance;
}
```

### 6.4 `ai-router.ts` — AI 路由决策层

```typescript
/**
 * AI 路由决策层
 * 根据商家配置选择合适的 AI 后端
 *
 * 位置: src/server/services/ai-router.ts
 */

import { getDb } from '@server/shared/db';
import { decrypt } from './crypto';

interface TranslateResult {
  translatedText: string;
  engine: string;
}

export class AIRouter {
  private platformAI: any; // Workers AI binding

  constructor(platformAI?: any) {
    this.platformAI = platformAI;
  }

  /**
   * 翻译文本（自动选择AI后端）
   */
  async translate(
    text: string,
    sourceLang: string,
    targetLang: string,
    businessId: number
  ): Promise<TranslateResult> {
    // 1. 查询商家AI配置
    const aiConfig = await this.getBusinessAIConfig(businessId);

    // 2. 如果商家使用自有AI
    if (aiConfig?.ai_mode === 'own_cf' && aiConfig.cf_account_id && aiConfig.cf_ai_token_encrypted) {
      try {
        const apiToken = await decrypt(aiConfig.cf_ai_token_encrypted);
        const result = await this.callOwnAccountAI(
          aiConfig.cf_account_id,
          apiToken,
          text,
          sourceLang,
          targetLang
        );

        // 更新用量统计
        await this.incrementUsage(businessId);
        return { translatedText: result, engine: 'own_cloudflare' };
      } catch (error) {
        console.warn('[AIRouter] Own account AI failed, falling back to platform AI:', error);
        // 降级到平台AI
      }
    }

    // 3. 使用平台AI（默认）
    return this.callPlatformAI(text, sourceLang, targetLang);
  }

  /**
   * 获取商家AI配置
   */
  private async getBusinessAIConfig(businessId: number): Promise<any | null> {
    const db = getDb();
    return db.get(
      `SELECT ai_mode, cf_account_id, cf_ai_token_encrypted,
              monthly_translate_count, monthly_translate_limit
       FROM business_ai_config
       WHERE business_id = ? AND status = 'active'`,
      [businessId]
    );
  }

  /**
   * 通过 REST API 调用商家自己的 Workers AI
   */
  private async callOwnAccountAI(
    accountId: string,
    apiToken: string,
    text: string,
    sourceLang: string,
    targetLang: string
  ): Promise<string> {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/meta/m2m100-1.2b`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          source_lang: sourceLang,
          target_lang: targetLang,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`CF AI API error: ${response.status}`);
    }

    const data = await response.json() as any;
    return data.result?.translated_text || text;
  }

  /**
   * 使用平台 Workers AI binding 翻译
   */
  private async callPlatformAI(
    text: string,
    sourceLang: string,
    targetLang: string
  ): Promise<TranslateResult> {
    if (!this.platformAI) {
      return { translatedText: text, engine: 'none' };
    }

    try {
      const result = await this.platformAI.run('@cf/meta/m2m100-1.2b', {
        text,
        source_lang: sourceLang,
        target_lang: targetLang,
      });
      return { translatedText: result.translated_text || text, engine: 'platform_cloudflare' };
    } catch {
      return { translatedText: text, engine: 'none' };
    }
  }

  /**
   * 更新用量统计
   */
  private async incrementUsage(businessId: number): Promise<void> {
    try {
      const db = getDb();
      await db.run(
        `UPDATE business_ai_config
         SET monthly_translate_count = monthly_translate_count + 1,
             total_translate_count = total_translate_count + 1,
             updated_at = ?
         WHERE business_id = ?`,
        [Math.floor(Date.now() / 1000), businessId]
      );
    } catch (error) {
      console.error('[AIRouter] Failed to update usage:', error);
    }
  }
}

let aiRouterInstance: AIRouter | null = null;

export function initAIRouter(platformAI?: any): AIRouter {
  aiRouterInstance = new AIRouter(platformAI);
  return aiRouterInstance;
}

export function getAIRouter(): AIRouter {
  if (!aiRouterInstance) {
    aiRouterInstance = new AIRouter();
  }
  return aiRouterInstance;
}
```

### 6.5 `crypto.ts` — 加密工具

```typescript
/**
 * Token 加密/解密工具
 * 用于安全存储商家的 CF API Token
 *
 * 位置: src/server/shared/crypto.ts
 * 注: 扩展现有的 crypto.ts
 */

// 加密密钥从环境变量获取（通过 wrangler secret put 设置）
let ENCRYPTION_KEY: string | null = null;

export function initEncryption(key?: string): void {
  ENCRYPTION_KEY = key || null;
}

/**
 * AES-GCM 加密
 */
export async function encrypt(plaintext: string): Promise<string> {
  if (!ENCRYPTION_KEY) {
    // 开发环境使用固定密钥
    console.warn('[Crypto] No encryption key set, using base64 only');
    return btoa(plaintext);
  }

  const encoder = new TextEncoder();
  const keyData = encoder.encode(ENCRYPTION_KEY).slice(0, 32);
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const key = await crypto.subtle.importKey(
    'raw', keyData, { name: 'AES-GCM' }, false, ['encrypt']
  );

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(plaintext)
  );

  // 格式: iv(base64).ciphertext(base64)
  const ivBase64 = btoa(String.fromCharCode(...iv));
  const cipherBase64 = btoa(
    String.fromCharCode(...new Uint8Array(encrypted))
  );

  return `${ivBase64}.${cipherBase64}`;
}

/**
 * AES-GCM 解密
 */
export async function decrypt(ciphertext: string): Promise<string> {
  if (!ENCRYPTION_KEY) {
    return atob(ciphertext);
  }

  const [ivBase64, cipherBase64] = ciphertext.split('.');
  if (!ivBase64 || !cipherBase64) {
    throw new Error('Invalid ciphertext format');
  }

  const encoder = new TextEncoder();
  const keyData = encoder.encode(ENCRYPTION_KEY).slice(0, 32);
  const iv = Uint8Array.from(atob(ivBase64), c => c.charCodeAt(0));
  const encrypted = Uint8Array.from(atob(cipherBase64), c => c.charCodeAt(0));

  const key = await crypto.subtle.importKey(
    'raw', keyData, { name: 'AES-GCM' }, false, ['decrypt']
  );

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    encrypted
  );

  return new TextDecoder().decode(decrypted);
}
```

---

## 7. API 接口设计

### 7.1 域名管理接口

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|:----:|
| `GET` | `/api/business/domains` | 获取商家的域名列表 | ✅ |
| `POST` | `/api/business/domains/bind-cf` | CF一键绑定自定义域名 | ✅ |
| `POST` | `/api/business/domains/bind-manual` | 手动绑定第三方域名 | ✅ |
| `POST` | `/api/business/domains/:id/verify` | 验证手动绑定域名DNS | ✅ |
| `DELETE` | `/api/business/domains/:id` | 删除域名绑定 | ✅ |
| `PUT` | `/api/business/domains/:id/primary` | 设为主域名 | ✅ |

### 7.2 接口详细定义

#### `POST /api/business/domains/bind-cf` — CF 一键绑定

```typescript
// 请求
{
  domain: "chat.myshop.com",
  cfApiToken: "abc123..."  // 商家的CF API Token
}

// 响应成功
{
  success: true,
  data: {
    id: 1,
    domain: "chat.myshop.com",
    domainType: "custom_cf",
    verificationStatus: "dns_verified",
    sslStatus: "provisioning",
    dnsRecord: {
      type: "CNAME",
      name: "chat",
      value: "zygonlinechat.zygmail.icu"
    }
  }
}

// 响应失败
{
  success: false,
  error: "API Token 无效或权限不足"
}
```

#### `POST /api/business/domains/bind-manual` — 手动绑定

```typescript
// 请求
{
  domain: "support.myaliyunshop.com",
  platform: "aliyun"
}

// 响应成功
{
  success: true,
  data: {
    id: 2,
    domain: "support.myaliyunshop.com",
    domainType: "custom_external",
    verificationStatus: "pending",
    dnsConfigGuide: {
      recordType: "CNAME",
      hostRecord: "support",
      recordValue: "zygonlinechat.zygmail.icu",
      ttl: 600,
      instruction: "请前往您的DNS管理后台，添加以上CNAME记录"
    }
  }
}
```

#### `POST /api/business/domains/:id/verify` — 验证 DNS

```typescript
// 请求
{}

// 响应
{
  success: true,
  data: {
    verified: true,
    message: "DNS 验证通过，域名已生效",
    status: "dns_verified"
  }
}
```

#### `GET /api/business/domains` — 域名列表

```typescript
// 响应
{
  success: true,
  data: [
    {
      id: 1,
      domainType: "auto_subdomain",
      domain: "9y66upxd.zygonlinechat.zygmail.icu",
      subdomain: "9y66upxd",
      verificationStatus: "active",
      sslStatus: "active",
      isPrimary: true,
      status: "active",
      createdAt: 1719300000
    },
    {
      id: 2,
      domainType: "custom_cf",
      domain: "chat.myshop.com",
      domainPlatform: "cloudflare",
      verificationStatus: "dns_verified",
      sslStatus: "active",
      isPrimary: false,
      status: "active",
      createdAt: 1719400000
    }
  ]
}
```

### 7.3 AI 配置接口

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|:----:|
| `GET` | `/api/business/ai-config` | 获取 AI 配置 | ✅ |
| `PUT` | `/api/business/ai-config` | 更新 AI 配置 | ✅ |

```typescript
// PUT /api/business/ai-config
{
  aiMode: "own_cf",           // 'platform' | 'own_cf'
  cfAccountId: "abc123...",   // 商家的CF Account ID
  cfAiToken: "def456...",     // 商家的CF API Token (带AI权限)
  monthlyLimit: 20000          // 月翻译配额限制
}

// 响应
{
  success: true,
  data: {
    businessId: 1,
    aiMode: "own_cf",
    monthlyTranslateCount: 0,
    monthlyTranslateLimit: 20000
  }
}
```

---

## 8. 前端界面设计

### 8.1 商家后台 - 域名管理页面

```
┌──────────────────────────────────────────────────────────────┐
│  🔗 域名管理                                                   │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ 🌟 平台专属域名（自动生成）                                │ │
│  │ ┌──────────────────────────────────────────────────────┐ │ │
│  │ │ 🟢 已激活                                              │ │ │
│  │ │ https://9y66upxd.zygonlinechat.zygmail.icu            │ │ │
│  │ │ [复制链接] [预览]                    [设为主域名] ✓    │ │ │
│  │ └──────────────────────────────────────────────────────┘ │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ 🏠 自定义域名                                             │ │
│  │ ┌──────────────────────────────────────────────────────┐ │ │
│  │ │ 🟢 已绑定  │ chat.myshop.com  │ CF自动绑定  │ [操作] │ │ │
│  │ └──────────────────────────────────────────────────────┘ │ │
│  │ ┌──────────────────────────────────────────────────────┐ │ │
│  │ │ 🟡 验证中  │ support.aliyun.com │ 手动绑定  │ [验证] │ │ │
│  │ └──────────────────────────────────────────────────────┘ │ │
│  │                                                            │ │
│  │ [+ 绑定新域名]                                              │ │
│  └──────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

### 8.2 一键绑定向导（CF 平台）

```
步骤 1/3: 输入域名
┌──────────────────────────────────┐
│  请输入您要绑定的域名:             │
│  ┌──────────────────────────────┐│
│  │ chat.myshop.com              ││
│  └──────────────────────────────┘│
│  例如: chat.yourdomain.com       │
│                      [下一步 →]  │
└──────────────────────────────────┘

步骤 2/3: 授权 Cloudflare
┌──────────────────────────────────┐
│  请输入您的 Cloudflare API Token:  │
│  ┌──────────────────────────────┐│
│  │ ●●●●●●●●●●●●●●●●●●●●●●●● ││
│  └──────────────────────────────┘│
│                                  │
│  📌 如何获取API Token:            │
│  1. 访问 dash.cloudflare.com     │
│  2. 点击右上角头像 → My Profile   │
│  3. 选择 API Tokens 标签          │
│  4. 创建Token，选择以下权限:      │
│     ☑ Zone - DNS - Edit         │
│     ☑ Account - Account Settings│
│                         Read      │
│                                │
│  [如何创建API Token?] [上一步]  │
│                      [开始绑定]  │
└──────────────────────────────────┘

步骤 3/3: 绑定完成
┌──────────────────────────────────┐
│  ✅ 域名绑定成功!                 │
│                                  │
│  https://chat.myshop.com          │
│                                  │
│  DNS状态: ✅ 已配置               │
│  SSL状态: ⏳ 签发中（约1分钟）     │
│                                  │
│  [复制链接] [设为默认] [完成]     │
└──────────────────────────────────┘
```

### 8.3 手动绑定引导页（非CF平台）

```
┌──────────────────────────────────────────────────────────────┐
│  📋 DNS 配置指引                                              │
│                                                                │
│  请将以下 CNAME 记录添加到您的 DNS 管理后台：                    │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  DNS 服务商:  [阿里云 ▼]                                  │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  记录类型   │  CNAME                                      │ │
│  │  主机记录   │  support                                    │ │
│  │  记录值     │  zygonlinechat.zygmail.icu                 │ │
│  │  TTL       │  600 (10分钟)                               │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  📌 各平台配置入口:                                            │
│  [阿里云DNS] [腾讯云DNS] [GoDaddy] [NameSilo] [Cloudflare]    │
│                                                                │
│  [📋 复制配置] [📖 详细教程]           [我已配置，开始验证 →]  │
└──────────────────────────────────────────────────────────────┘
```

### 8.4 嵌入代码自动更新

当商家使用三级子域名后，嵌入代码**建议**使用新域名（旧代码继续有效）：

```html
<!-- 🔒 旧嵌入代码（永久有效，无需修改）-->
<script src="https://zyg-online-chat.linzihai.workers.dev/chat/embed.js"
        data-business="9y66upxd"></script>

<!-- 🔒 平台域名+参数（永久有效，无需修改）-->
<script src="https://zygonlinechat.zygmail.icu/chat/embed.js"
        data-business="9y66upxd"></script>

<!-- 🔥 新嵌入代码（推荐，自动识别商家）-->
<script src="https://9y66upxd.zygonlinechat.zygmail.icu/chat/embed.js"></script>

<!-- 🔥 自定义域名（品牌化）-->
<script src="https://chat.myshop.com/chat/embed.js"></script>
```

> ⚠️ **兼容性承诺**: 所有旧嵌入代码**永久有效**，不做强制升级或自动重定向。商家可自行决定何时切换到新域名嵌入方式。`data-business` 属性在三级子域名模式下仍然可以作为兜底识别参数。

---

## 9. 域名策略矩阵

### 9.1 完整对比

| 特性 | 平台三级子域名 | CF自定义域名 | 第三方自定义域名 |
|------|:-----------:|:---------:|:------------:|
| **是否需要CF账号** | ❌ | ✅ | ❌ |
| **是否需要DNS配置** | ❌ 全自动 | 🔧 一键自动 | ✋ 手动CNAME |
| **SSL证书** | ✅ CF自动 | ✅ CF自动 | ⚠️ 自行配置 |
| **CDN加速** | ✅ CF网络 | ✅ CF网络 | ❌ |
| **DDoS防护** | ✅ CF提供 | ✅ CF提供 | ❌ |
| **域名成本** | 免费 | 免费（已有） | 域名费用 |
| **可读性** | ⭐⭐⭐ 较好 | ⭐⭐⭐⭐⭐ 最好 | ⭐⭐⭐⭐⭐ 最好 |
| **品牌展示** | ⭐⭐⭐ 一般 | ⭐⭐⭐⭐⭐ 最佳 | ⭐⭐⭐⭐⭐ 最佳 |
| **实施难度** | ⭐ 低 | ⭐⭐ 中 | ⭐⭐⭐ 高 |
| **维护成本** | 零 | 低 | 中 |

### 9.2 推荐策略

```
商家规模 - 域名策略:

小商家（免费用户）:
  → 使用平台三级子域名 {slug}.zygonlinechat.zygmail.icu
  → 零成本、零配置、全自动

中商家（有域名）:
  → 优先平台三级子域名（快速上线）
  → 可升级为自定义域名（品牌化）

大商家（高级用户）:
  → 使用自有域名 chat.brand.com
  → CF用户一键绑定 / 非CF用户手动配置
  → 可选使用自有CF AI配额
```

---

## 10. 实施阶段计划

### 阶段一：基础设施搭建（预估 1 周）

| 任务 | 产出 | 负责人 |
|------|------|:------:|
| 1.1 数据库新增 3 张表 | DDL + 迁移脚本 | 后端 |
| 1.2 编写 `domain-router.ts` 中间件 | 域名识别逻辑 | 后端 |
| 1.3 编写 `crypto.ts` 加密工具 | Token 加密/解密 | 后端 |
| 1.4 在 `index.worker.ts` 集成中间件 | 主入口改造（不影响旧逻辑） | 后端 |
| 1.5 配置 `wrangler.toml` routes | 路由配置（保留 workers.dev） | DevOps |
| 1.6 在 `zygmail.icu` DNS 添加泛域名 | CF DNS 配置 | DevOps |
| 1.7 环境变量 `ENCRYPTION_KEY` 配置 | wrangler secret | DevOps |

### 阶段二：自动三级子域名（预估 1 周）

| 任务 | 产出 | 负责人 |
|------|------|:------:|
| 2.1 改造 `POST /api/business/create` | 创建时自动生成域名 | 后端 |
| 2.2 现有商家数据迁移 | 为已有商家生成域名 | 后端 |
| 2.3 嵌入代码自动更新 | 前端代码使用新域名 | 前端 |
| 2.4 `GET /api/business/domains` | 域名列表接口 | 后端 |
| 2.5 本地 + 线上测试 | 三级域名访问验证 | QA |

### 阶段三：CF 一键绑定（预估 2 周）

| 任务 | 产出 | 负责人 |
|------|------|:------:|
| 3.1 `cf-api-client.ts` | CF API 封装 | 后端 |
| 3.2 `domain-service.ts` | 域名管理服务 | 后端 |
| 3.3 `POST /api/business/domains/bind-cf` | CF 绑定接口 | 后端 |
| 3.4 `DELETE /api/business/domains/:id` | 解绑接口 | 后端 |
| 3.5 操作日志记录 | 审计日志 | 后端 |
| 3.6 前端绑定向导组件 | UI 实现 | 前端 |

### 阶段四：第三方域名手动绑定（预估 1 周）

| 任务 | 产出 | 负责人 |
|------|------|:------:|
| 4.1 `POST /api/business/domains/bind-manual` | 手动绑定接口 | 后端 |
| 4.2 `POST /api/business/domains/:id/verify` | DNS 验证接口 | 后端 |
| 4.3 前端手动绑定引导页 | UI 实现 | 前端 |
| 4.4 DNS 各平台配置教程 | 帮助文档 | 文档 |

### 阶段五：AI 功能分离（预估 2 周，可延后）

| 任务 | 产出 | 负责人 |
|------|------|:------:|
| 5.1 `ai-router.ts` | AI 路由决策层 | 后端 |
| 5.2 Workers AI REST API 封装 | CF API 调用 | 后端 |
| 5.3 `PUT /api/business/ai-config` | AI 配置接口 | 后端 |
| 5.4 用量统计 | 配额管理 | 后端 |
| 5.5 前端 AI 配置页面 | UI 实现 | 前端 |
| 5.6 现有翻译引擎适配改造 | 兼容性改造 | 后端 |

### 阶段六：前端管理界面（预估 2 周）

| 任务 | 产出 | 负责人 |
|------|------|:------:|
| 6.1 域名管理页面主体 | 列表 + 状态展示 | 前端 |
| 6.2 CF 一键绑定向导 | 三步向导弹窗 | 前端 |
| 6.3 手动绑定引导 | CNAME 配置指引 | 前端 |
| 6.4 域名状态实时监控 | 状态轮询 | 前端 |
| 6.5 国际化翻译 | 中英文词条 | 前端 |
| 6.6 响应式适配 | 移动端优化 | 前端 |

### 时间线总览

```
Week 1:  ████████  阶段一: 基础设施
Week 2:  ████████  阶段二: 自动三级子域名
Week 3-4:████████  阶段三: CF一键绑定
Week 5:  ████████  阶段四: 第三方手动绑定
Week 6-7:████████  阶段五: AI功能分离（可选延后）
Week 8-9:████████  阶段六: 前端管理界面

总计预估: 6-9 周（不含AI为 5-7 周）
```

---

## 11. 风险与注意事项

### 11.1 技术风险

| 风险 | 影响 | 概率 | 应对措施 |
|------|------|:--:|---------|
| Workers Routes 数量限制 | 大量自定义域名时触及上限 | 低 | 免费版100条，可升级；三级子域名不受限 |
| DNS 泛域名配置错误 | 所有三级域名不可用 | 低 | 先在小范围测试，验证后再全量 |
| Workers 冷启动延迟 | 域名缓存失效后首次请求慢 | 中 | 内存缓存 + 合理的 TTL 设置 |
| AI REST API 性能 | 自有CF AI比binding慢约50ms | 中 | 对延迟敏感场景默认用平台AI |
| D1 并发限制 | 大量域名查询触及D1限制 | 低 | 域名查询结果缓存5分钟 |
| API Token 泄露 | 商家CF账号安全风险 | 中 | AES-256-GCM加密存储，操作审计 |

### 11.2 安全注意事项

1. **API Token 加密存储**
   - 使用 AES-256-GCM 加密
   - 加密密钥通过 `wrangler secret put ENCRYPTION_KEY` 设置
   - 禁止在日志中打印 Token 原文

2. **操作审计**
   - 所有域名绑定/解绑/修改操作记录到 `domain_operation_logs` 表
   - 记录操作人、时间、IP、详情

3. **域名所有权验证**
   - CF 绑定时依赖 API Token 验证
   - 手动绑定时需要 DNS 验证（CNAME 记录匹配）

4. **权限最小化**
   - CF API Token 最小权限：Zone.DNS:Edit + Account.Settings:Read
   - 不建议要求 Workers Scripts 权限

### 11.3 回滚方案

- 三级子域名功能可通过删除 `wrangler.toml` 中的 routes 配置快速回滚
- **`?business={slug}` 兼容模式永久保留，不影响任何旧链接或嵌入代码**
- 所有新表使用 `IF NOT EXISTS`，不影响现有数据库
- `domain-router` 中间件可随时通过删除一行注册代码来禁用，不影响其他功能
- 如果自定义域名功能出现问题，商家仍然可以通过 `?business=` 参数正常访问
- workers.dev 域名永久可用，作为最后的兜底访问入口

### 11.4 嵌入代码兼容性保证

```html
<!-- 以下所有嵌入方式同时有效，商家无需修改已有代码 -->

<!-- 方式1: 旧嵌入代码（永久有效）-->
<script src="https://zyg-online-chat.linzihai.workers.dev/chat/embed.js"
        data-business="9y66upxd"></script>

<!-- 方式2: 平台主域名+参数（永久有效）-->
<script src="https://zygonlinechat.zygmail.icu/chat/embed.js"
        data-business="9y66upxd"></script>

<!-- 方式3: 三级子域名（推荐新商家使用）-->
<script src="https://9y66upxd.zygonlinechat.zygmail.icu/chat/embed.js"></script>

<!-- 方式4: 自定义域名（品牌化）-->
<script src="https://chat.myshop.com/chat/embed.js"></script>
```

---

## 12. 附录

### 12.1 CF API Token 权限模板

商家需要创建的 API Token 最小权限：

```
Token Name: ZYG-Online-Chat Domain Bind

Permissions:
  Zone - DNS - Edit        (用于自动创建CNAME记录)
  Account - Account Settings - Read  (用于获取Account ID)

Zone Resources:
  Include - Specific zone - {商家的域名zone}
```

### 12.2 CF DNS 配置命令参考

```bash
# 平台侧（仅需配置一次）
# 在 zygmail.icu 的 DNS 中添加泛域名记录

# 方式1: 通过 CF Dashboard
#   类型: CNAME
#   名称: *.zygonlinechat
#   目标: zygonlinechat.zygmail.icu
#   代理: 开启（橙色云朵）

# 方式2: 通过 API（需要平台CF Token）
curl -X POST "https://api.cloudflare.com/client/v4/zones/{ZONE_ID}/dns_records" \
  -H "Authorization: Bearer {API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "CNAME",
    "name": "*.zygonlinechat",
    "content": "zygonlinechat.zygmail.icu",
    "ttl": 1,
    "proxied": true
  }'
```

### 12.3 wrangler.toml 完整配置示例

```toml
name = "zyg-online-chat"
main = "src/server/index.worker.ts"
compatibility_date = "2024-01-01"
compatibility_flags = ["nodejs_compat"]

[assets]
directory = "./dist"
binding = "ASSETS"

# ===== 路由配置 =====
# 平台主域名
[[routes]]
pattern = "zygonlinechat.zygmail.icu"
zone_name = "zygmail.icu"

# 三级子域名通配符（覆盖所有商家）
[[routes]]
pattern = "*.zygonlinechat.zygmail.icu"
zone_name = "zygmail.icu"

# 兼容旧的 workers.dev 域名（🔒 永久保留，开发调试和旧链接兜底）
[[routes]]
pattern = "zyg-online-chat.linzihai.workers.dev"
zone_name = "linzihai.workers.dev"

# ===== 环境变量 =====
[vars]
BARK_API = "https://api.day.app"
REQUIRE_AUTH = "true"

# ===== 数据库 =====
[[d1_databases]]
binding = "DB"
database_name = "zyg-online-chat-db"
database_id = "91fad6d8-e535-4bc0-95fc-2b69c32c7d22"

# ===== 文件存储 =====
[[r2_buckets]]
binding = "BUCKET"
bucket_name = "zyg-online-chat-uploads"

# ===== AI 绑定 =====
[ai]
binding = "AI"

# ===== 构建 =====
[build]
command = "npm run build:worker"

# ===== 生产环境 =====
[env.production]
name = "zyg-online-chat"

[env.production.vars]
BARK_API = "https://api.day.app"
REQUIRE_AUTH = "true"

[[env.production.d1_databases]]
binding = "DB"
database_name = "zyg-online-chat-db"
database_id = "91fad6d8-e535-4bc0-95fc-2b69c32c7d22"

[[env.production.r2_buckets]]
binding = "BUCKET"
bucket_name = "zyg-online-chat-uploads"

[env.production.ai]
binding = "AI"

[[env.production.routes]]
pattern = "zygonlinechat.zygmail.icu"
zone_name = "zygmail.icu"

[[env.production.routes]]
pattern = "*.zygonlinechat.zygmail.icu"
zone_name = "zygmail.icu"

# 🔒 workers.dev 域名永久保留作为兜底入口
[[env.production.routes]]
pattern = "zyg-online-chat.linzihai.workers.dev"
zone_name = "linzihai.workers.dev"
```

### 12.4 环境变量清单

| 变量名 | 类型 | 说明 | 设置方式 |
|--------|------|------|----------|
| `BARK_API` | vars | Bark 推送 API 地址 | wrangler.toml |
| `BARK_KEY` | secret | Bark 推送密钥 | wrangler secret |
| `JWT_SECRET` | secret | 客服端 JWT 密钥 | wrangler secret |
| `ADMIN_JWT_SECRET` | secret | 管理端 JWT 密钥 | wrangler secret |
| `ENCRYPTION_KEY` | 🆕 secret | CF Token 加密密钥 | wrangler secret |
| `REQUIRE_AUTH` | vars | 是否启用认证 | wrangler.toml |

---

> **文档版本**: v1.0  
> **最后更新**: 2026-06-25  
> **维护者**: ZYG Online Chat Team
