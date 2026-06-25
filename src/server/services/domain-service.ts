/**
 * 域名管理业务逻辑
 *
 * 核心功能:
 *   - 自动生成商家三级子域名
 *   - CF一键绑定自定义域名
 *   - 第三方平台手动域名绑定 + DNS验证
 *   - 域名列表查询
 *   - 域名删除（软删除）
 */

import { getDb } from '@server/shared/db';
import { CloudflareApiClient } from './cf-api-client';
import { encryptToken, decryptToken } from '@server/shared/token-crypto';

// 平台 CNAME 目标地址
const PLATFORM_CNAME_TARGET = 'zygonlinechat.zygmail.icu';

// ==========================================
// 类型定义
// ==========================================

export interface BindDomainInput {
  businessId: number;
  staffUserId: number;
  domain: string;           // 如: chat.myshop.com
  platform: string;         // 'cloudflare' | 'aliyun' | 'godaddy' | 'tencent' | 'namesilo' | 'other'
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

export interface DomainRecord {
  id: number;
  domainType: string;
  domain: string;
  subdomain: string | null;
  domainPlatform: string;
  verificationStatus: string;
  sslStatus: string;
  isPrimary: number;
  status: string;
  createdAt: number;
  updatedAt: number;
}

// ==========================================
// DomainService 类
// ==========================================

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
      return { success: true, domainId: existing.id, domain, verificationStatus: 'active' };
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
    await this.logOperation(businessId, Number(result.lastInsertRowid), 'auto_create', {
      domain,
      subdomain: slug,
    });

    return {
      success: true,
      domainId: Number(result.lastInsertRowid),
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

    // 检查域名是否已被绑定
    const existingDomain = await db.get<{ id: number }>(
      "SELECT id FROM business_domains WHERE domain = ?",
      [domain]
    );
    if (existingDomain) {
      return { success: false, error: '该域名已被绑定' };
    }

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

      // Step 3: 获取 Account ID（可选，仅用于数据库记录）
      // 注意：需要 Account:Read 权限才能获取，如果没有此权限也不影响 DNS 操作
      let accountId: string | null = null;
      try {
        accountId = await cfClient.getAccountId();
        console.log('[DomainService] Account ID obtained:', accountId);
      } catch (err) {
        // Account ID 获取失败不影响 DNS 绑定，仅记录警告
        const msg = err instanceof Error ? err.message : String(err);
        console.warn('[DomainService] Could not get Account ID (non-blocking):', msg);
      }

      // Step 4: 创建 DNS CNAME 记录
      console.log('[DomainService] Step 4: Creating DNS CNAME record...');
      const subdomain = this.extractSubdomain(domain, rootDomain);
      const dnsRecord = await cfClient.createDnsRecord(targetZone.id, {
        type: 'CNAME',
        name: subdomain,
        content: PLATFORM_CNAME_TARGET,
        proxied: true, // 开启CDN代理，自动SSL
      });

      // Step 5: 加密 Token 并写入数据库
      console.log('[DomainService] Step 5: Saving to database...');
      const encryptedToken = await encryptToken(cfApiToken);

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
      await this.logOperation(businessId, Number(result.lastInsertRowid), 'bind_cf', {
        domain,
        zoneId: targetZone.id,
        zoneName: targetZone.name,
        dnsRecordId: dnsRecord.id,
      });

      return {
        success: true,
        domainId: Number(result.lastInsertRowid),
        domain,
        verificationStatus: 'dns_verified',
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('[DomainService] bindCFDomain error:', errorMsg);

      // Translate CF API errors into user-friendly messages
      let userError = errorMsg;
      const cfError = error as any;
      if (cfError.cfStatusCode) {
        const code = cfError.cfErrorCode;
        const status = cfError.cfStatusCode;
        if (status === 403 || code === 9103 || code === 9106) {
          userError = 'cf_token_invalid';
        } else if (status === 401 || code === 10000) {
          userError = 'cf_token_expired';
        } else if (code === 9109) {
          userError = 'cf_token_no_permission';
        }
      }

      await this.logOperation(businessId, 0, 'bind_cf_failed', {
        domain,
        error: errorMsg,
      });

      return { success: false, error: userError };
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

    const rootDomain = this.extractRootDomain(domain);
    const subdomain = this.extractSubdomain(domain, rootDomain);

    // 写入数据库（pending 状态，等待DNS验证）
    const result = await db.run(
      `INSERT INTO business_domains
       (business_id, staff_user_id, domain_type, domain,
        domain_platform, verification_status, ssl_status, is_primary, status)
       VALUES (?, ?, 'custom_external', ?, ?, 'pending', 'pending', 0, 'active')`,
      [businessId, staffUserId, domain, platform]
    );

    await this.logOperation(businessId, Number(result.lastInsertRowid), 'bind_manual', {
      domain,
      platform,
    });

    // 返回 DNS 配置指引
    return {
      success: true,
      domainId: Number(result.lastInsertRowid),
      domain,
      dnsRecord: {
        type: 'CNAME',
        name: subdomain,
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
    status?: string;
  }> {
    const db = getDb();
    const record = await db.get<{
      id: number; business_id: number; domain: string; verification_status: string;
    }>(
      "SELECT id, business_id, domain, verification_status FROM business_domains WHERE id = ?",
      [domainId]
    );

    if (!record) {
      return { success: false, verified: false, message: '域名记录不存在' };
    }

    if (record.verification_status === 'active' || record.verification_status === 'dns_verified') {
      return { success: true, verified: true, message: 'DNS 已通过验证', status: record.verification_status };
    }

    try {
      // DNS 解析检查
      const resolved = await this.checkDnsResolution(record.domain);
      if (resolved) {
        // 验证通过，更新状态
        const now = Math.floor(Date.now() / 1000);
        await db.run(
          `UPDATE business_domains
           SET verification_status = 'dns_verified', verified_at = ?,
               updated_at = ?
           WHERE id = ?`,
          [now, now, domainId]
        );

        await this.logOperation(record.business_id, domainId, 'verify_success', {
          domain: record.domain,
        });

        return { success: true, verified: true, message: 'DNS 验证通过', status: 'dns_verified' };
      }

      // 更新状态为验证中
      await db.run(
        `UPDATE business_domains SET verification_status = 'dns_verifying', updated_at = ? WHERE id = ?`,
        [Math.floor(Date.now() / 1000), domainId]
      );

      return {
        success: true,
        verified: false,
        message: 'DNS 记录尚未生效，请确认已正确配置 CNAME 记录（最长可能需要48小时）',
        status: 'dns_verifying',
      };
    } catch (error) {
      return {
        success: true,
        verified: false,
        message: `DNS 验证失败: ${error instanceof Error ? error.message : '未知错误'}`,
        status: 'pending',
      };
    }
  }

  /**
   * 获取商家的域名列表
   */
  async getBusinessDomains(businessId: number): Promise<DomainRecord[]> {
    const db = getDb();
    return db.all<DomainRecord>(
      `SELECT id, domain_type as domainType, domain, subdomain, domain_platform as domainPlatform,
              verification_status as verificationStatus, ssl_status as sslStatus,
              is_primary as isPrimary, status,
              created_at as createdAt, updated_at as updatedAt
       FROM business_domains
       WHERE business_id = ?
       ORDER BY is_primary DESC, created_at ASC`,
      [businessId]
    );
  }

  /**
   * 设为主域名
   */
  async setPrimaryDomain(businessId: number, domainId: number): Promise<boolean> {
    const db = getDb();
    const record = await db.get<{ id: number }>(
      "SELECT id FROM business_domains WHERE id = ? AND business_id = ?",
      [domainId, businessId]
    );
    if (!record) return false;

    // 先取消其他的主域名
    await db.run(
      "UPDATE business_domains SET is_primary = 0, updated_at = ? WHERE business_id = ?",
      [Math.floor(Date.now() / 1000), businessId]
    );
    // 设置新的主域名
    await db.run(
      "UPDATE business_domains SET is_primary = 1, updated_at = ? WHERE id = ?",
      [Math.floor(Date.now() / 1000), domainId]
    );

    await this.logOperation(businessId, domainId, 'set_primary', {});
    return true;
  }

  /**
   * 删除域名绑定（软删除）
   */
  async deleteDomain(businessId: number, domainId: number): Promise<{ success: boolean; error?: string }> {
    const db = getDb();

    const record = await db.get<{
      id: number; domain_type: string; is_primary: number;
      cf_zone_id: string | null; cf_api_token_encrypted: string | null;
      cf_dns_record_id: string | null;
    }>(
      `SELECT id, domain_type, is_primary, cf_zone_id, cf_api_token_encrypted, cf_dns_record_id
       FROM business_domains WHERE id = ? AND business_id = ?`,
      [domainId, businessId]
    );

    if (!record) {
      return { success: false, error: '域名记录不存在' };
    }

    // 不能删除自动生成的子域名
    if (record.domain_type === 'auto_subdomain') {
      return { success: false, error: '不能删除自动生成的三级子域名' };
    }

    // 如果是主域名，不允许删除
    if (record.is_primary === 1) {
      return { success: false, error: '请先将其他域名设为主域名后再删除' };
    }

    // 如果是CF自动绑定的，尝试清理DNS记录
    if (record.domain_type === 'custom_cf' && record.cf_zone_id && record.cf_dns_record_id && record.cf_api_token_encrypted) {
      try {
        const token = await decryptToken(record.cf_api_token_encrypted);
        const cfClient = new CloudflareApiClient(token);
        await cfClient.deleteDnsRecord(record.cf_zone_id, record.cf_dns_record_id);
        console.log('[DomainService] DNS record cleaned up:', record.cf_dns_record_id);
      } catch (error) {
        console.warn('[DomainService] DNS cleanup failed (non-critical):', error);
      }
    }

    // 软删除
    await db.run(
      "UPDATE business_domains SET status = 'inactive', updated_at = ? WHERE id = ?",
      [Math.floor(Date.now() / 1000), domainId]
    );

    await this.logOperation(businessId, domainId, 'delete', {
      domainType: record.domain_type,
    });

    return { success: true };
  }

  // ========== 私有辅助方法 ==========

  /** 提取根域名（如 chat.myshop.com → myshop.com） */
  private extractRootDomain(domain: string): string {
    const parts = domain.split('.');
    if (parts.length <= 2) return domain;
    // 处理 .com.cn 等二级TLD
    const knownSecondLevels = ['com.cn', 'net.cn', 'org.cn', 'gov.cn', 'co.uk', 'co.jp'];
    const lastTwo = parts.slice(-2).join('.');
    if (knownSecondLevels.includes(lastTwo) && parts.length > 2) {
      return parts.slice(-3).join('.');
    }
    return parts.slice(-2).join('.');
  }

  /** 提取子域名部分（如 chat.myshop.com + myshop.com → chat） */
  private extractSubdomain(domain: string, rootDomain: string): string {
    if (domain === rootDomain) return '@';
    const sub = domain.replace(`.${rootDomain}`, '');
    return sub;
  }

  /** 通过 Cloudflare DNS-over-HTTPS 检查 CNAME 解析 */
  private async checkDnsResolution(domain: string): Promise<boolean> {
    try {
      const response = await fetch(
        `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=CNAME`,
        { headers: { 'Accept': 'application/dns-json' } }
      );
      const data = await response.json() as any;
      if (data.Answer) {
        return data.Answer.some(
          (a: any) =>
            a.type === 5 &&
            a.data.toLowerCase().replace(/\.$/, '') === PLATFORM_CNAME_TARGET.toLowerCase()
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
    details: Record<string, unknown>
  ): Promise<void> {
    try {
      const db = getDb();
      // 检查表是否存在
      const tableExists = await db.get<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='domain_operation_logs'"
      );
      if (!tableExists) return;

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

// ==========================================
// 单例
// ==========================================

let domainServiceInstance: DomainService | null = null;

export function getDomainService(): DomainService {
  if (!domainServiceInstance) {
    domainServiceInstance = new DomainService();
  }
  return domainServiceInstance;
}
