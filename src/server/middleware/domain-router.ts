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
 */

import type { Context, Next } from 'hono';
import type { Database } from '@server/shared/db';

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

// 数据库 getter（延迟注入）
let dbGetter: (() => Database) | null = null;

export function setDbGetter(getter: () => Database): void {
  dbGetter = getter;
}

function getDb(): Database {
  if (!dbGetter) {
    throw new Error('[DomainRouter] Database getter not initialized');
  }
  return dbGetter();
}

/**
 * 中间件工厂函数
 * 返回 Hono 中间件
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

      try {
        const db = getDb();
        const biz = await db.get<{
          id: number; business_slug: string; business_name: string; status: string;
        }>(
          `SELECT id, business_slug, business_name, status
           FROM staff_users
           WHERE business_slug = ? AND business_id = 0`,
          [subdomainMatch.slug]
        );

        if (biz) {
          if (biz.status !== 'active') {
            // 商家存在但已停用 → 不设置上下文，继续走兜底策略
            console.warn(`[DomainRouter] Business '${subdomainMatch.slug}' exists but status is '${biz.status}', skipping subdomain recognition`);
          } else {
            const entry: DomainCacheEntry = {
              businessId: biz.id,
              businessSlug: biz.business_slug,
              businessName: biz.business_name || '',
              viaDomain: 'subdomain',
              expiredAt: Date.now() + CACHE_TTL,
            };
            setBusinessContext(c, entry);
            cacheDomain(host, entry);
            return next();
          }
        } else {
          // 子域名匹配但商家记录不存在（可能是 D1 未同步或已删除）
          console.warn(`[DomainRouter] Subdomain '${subdomainMatch.slug}' matched but no business found in DB. Continuing to fallback strategies...`);
        }

        // ⚠️ 不返回 404！继续走后续策略（URL参数/自定义域名）或让路由处理器自行判断
        // 这样即使商家不在 D1 中，API 请求也能继续处理而非被硬阻断
      } catch (err) {
        console.error('[DomainRouter] Subdomain lookup error:', err);
        // DB查询失败时降级到后续策略
      }
    }

    // ===== 策略2: 自定义域名匹配 =====
    if (host !== PLATFORM_DOMAIN && !host.endsWith('.workers.dev')) {
      const cached = getFromCache(host);
      if (cached) {
        setBusinessContext(c, cached);
        return next();
      }

      try {
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

        if (domain && domain.business_id) {
          const entry: DomainCacheEntry = {
            businessId: domain.business_id,
            businessSlug: domain.business_slug,
            businessName: domain.business_name || '',
            viaDomain: 'custom',
            expiredAt: Date.now() + CACHE_TTL,
          };
          setBusinessContext(c, entry);
          cacheDomain(host, entry);
          return next();
        }
      } catch (err) {
        console.error('[DomainRouter] Custom domain lookup error:', err);
      }
    }

    // ===== 策略3: URL参数兼容旧模式（🔒 永久保留） =====
    const businessParam = url.searchParams.get('business');
    if (businessParam) {
      try {
        const db = getDb();
        const biz = await db.get<{
          id: number; business_slug: string; business_name: string;
        }>(
          `SELECT id, business_slug, business_name
           FROM staff_users
           WHERE business_slug = ? AND business_id = 0 AND status = 'active'`,
          [businessParam]
        );

        if (biz) {
          const entry: DomainCacheEntry = {
            businessId: biz.id,
            businessSlug: biz.business_slug,
            businessName: biz.business_name || '',
            viaDomain: 'url_param',
            expiredAt: Date.now() + CACHE_TTL,
          };
          setBusinessContext(c, entry);
        }
      } catch (err) {
        console.error('[DomainRouter] URL param lookup error:', err);
      }
    }

    return next();
  };
}

// ===== 辅助函数 =====

interface SubdomainMatch { slug: string; }

function matchSubdomain(host: string): SubdomainMatch | null {
  // 剥离端口号
  const hostname = host.split(':')[0];
  // 匹配: {slug}.zygonlinechat.zygmail.icu
  if (!hostname.endsWith(SUBDOMAIN_SUFFIX)) return null;

  const slug = hostname.slice(0, -SUBDOMAIN_SUFFIX.length);
  // slug 必须是纯小写字母数字，长度2-64
  if (!/^[a-z0-9]{2,64}$/.test(slug)) return null;
  // 排除平台主域名本身
  if (slug === 'www') return null;

  return { slug };
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
  // 简单缓存大小限制（防止内存泄漏）
  if (domainCache.size > 500) {
    const oldestKey = domainCache.keys().next().value;
    if (oldestKey) domainCache.delete(oldestKey);
  }
  domainCache.set(host, entry);
}
