/**
 * Cloudflare API 客户端
 * 封装与 Cloudflare API 的交互，用于域名自动绑定
 */

const CF_API_BASE = 'https://api.cloudflare.com/client/v4';

export interface CFZone {
  id: string;
  name: string;
  status: string;
  paused: boolean;
  type: string;
}

export interface CFDnsRecord {
  id: string;
  type: string;
  name: string;
  content: string;
  proxied: boolean;
  ttl: number;
}

/** Workers 自定义域记录 */
export interface CFWorkersDomain {
  id: string;
  zone_id: string;
  zone_name: string;
  hostname: string;
  service: string;
  environment: string;
}

export class CloudflareApiClient {
  private apiToken: string;

  constructor(apiToken: string) {
    this.apiToken = apiToken;
  }

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<{ success: boolean; result: T; errors: any[]; messages: any[] }> {
    const response = await fetch(`${CF_API_BASE}${path}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });

    const data = await response.json() as any;

    if (!response.ok || !data.success) {
      const errors = data.errors?.map((e: any) => e.message).join(', ') || 'Unknown error';
      const errorCode = data.errors?.[0]?.code || response.status;
      const errorMsg = `CF API Error [${response.status}]: ${errors}`;
      
      // Include error code for better frontend handling
      const enhancedError = new Error(errorMsg) as any;
      enhancedError.cfErrorCode = errorCode;
      enhancedError.cfStatusCode = response.status;
      throw enhancedError;
    }

    return data;
  }

  /**
   * 验证 API Token 是否有效
   */
  async verifyToken(): Promise<{ id: string; status: string; not_before: string; expires_on: string }> {
    const res = await this.request<{ id: string; status: string; not_before: string; expires_on: string }>(
      '/user/tokens/verify'
    );
    return res.result;
  }

  /**
   * 获取账号下的 Zone 列表
   */
  async listZones(params?: { name?: string }): Promise<CFZone[]> {
    const query = new URLSearchParams();
    if (params?.name) query.set('name', params.name);
    query.set('per_page', '50');
    query.set('status', 'active');

    const res = await this.request<CFZone[]>(`/zones?${query.toString()}`);
    return res.result;
  }

  /**
   * 获取 Zone 详情
   */
  async getZone(zoneId: string): Promise<CFZone> {
    const res = await this.request<CFZone>(`/zones/${zoneId}`);
    return res.result;
  }

  /**
   * 创建 DNS 记录
   */
  async createDnsRecord(
    zoneId: string,
    record: {
      type: 'CNAME' | 'A' | 'AAAA';
      name: string;
      content: string;
      ttl?: number;
      proxied?: boolean;
      comment?: string;
    }
  ): Promise<CFDnsRecord> {
    const res = await this.request<CFDnsRecord>(
      `/zones/${zoneId}/dns_records`,
      {
        method: 'POST',
        body: JSON.stringify({
          type: record.type,
          name: record.name,
          content: record.content,
          ttl: record.ttl || 1,
          proxied: record.proxied !== false, // 默认开启代理（自动SSL）
          comment: record.comment || 'Created by ZYG-Online-Chat',
        }),
      }
    );
    return res.result;
  }

  /**
   * 删除 DNS 记录
   */
  async deleteDnsRecord(zoneId: string, recordId: string): Promise<{ id: string }> {
    const res = await this.request<{ id: string }>(
      `/zones/${zoneId}/dns_records/${recordId}`,
      { method: 'DELETE' }
    );
    return res.result;
  }

  /**
   * 列出 Zone 下的 DNS 记录
   */
  async listDnsRecords(zoneId: string, params?: { type?: string; name?: string }): Promise<CFDnsRecord[]> {
    const query = new URLSearchParams();
    if (params?.type) query.set('type', params.type);
    if (params?.name) query.set('name', params.name);
    query.set('per_page', '100');

    const res = await this.request<CFDnsRecord[]>(`/zones/${zoneId}/dns_records?${query.toString()}`);
    return res.result;
  }

  /**
   * 获取 Account ID（从 Token 中推导）
   */
  async getAccounts(): Promise<{ id: string; name: string }[]> {
    const res = await this.request<{ id: string; name: string }[]>('/accounts?per_page=1');
    return res.result;
  }

  /**
   * 获取第一个 Account ID
   */
  async getAccountId(): Promise<string> {
    const accounts = await this.getAccounts();
    if (accounts.length === 0) {
      throw new Error('No Cloudflare accounts found for this API token');
    }
    return accounts[0].id;
  }

  // ==========================================
  // Workers Custom Domains API
  // ==========================================

  /**
   * 列出 Worker 的所有自定义域
   */
  async listWorkersDomains(accountId: string): Promise<CFWorkersDomain[]> {
    const res = await this.request<CFWorkersDomain[]>(
      `/accounts/${accountId}/workers/domains`
    );
    return res.result;
  }

  /**
   * 为 Worker 添加自定义域
   * PUT /accounts/{account_id}/workers/domains
   * 
   * @param accountId - Cloudflare Account ID
   * @param hostname - 自定义域名（如 7t0dhxkk.zygonlinechat.zygmail.icu）
   * @param zoneId - 域名所在的 Zone ID
   * @param service - Worker 名称（默认 zyg-online-chat）
   * @param environment - Worker 环境（默认 production）
   */
  async addWorkersDomain(
    accountId: string,
    hostname: string,
    zoneId: string,
    service: string = 'zyg-online-chat',
    environment: string = 'production'
  ): Promise<CFWorkersDomain> {
    const res = await this.request<CFWorkersDomain>(
      `/accounts/${accountId}/workers/domains`,
      {
        method: 'PUT',
        body: JSON.stringify({
          hostname,
          service,
          zone_id: zoneId,
          environment,
        }),
      }
    );
    return res.result;
  }

  /**
   * 删除 Worker 的自定义域
   * DELETE /accounts/{account_id}/workers/domains/{domain_id}
   */
  async deleteWorkersDomain(accountId: string, domainId: string): Promise<void> {
    await this.request<null>(
      `/accounts/${accountId}/workers/domains/${domainId}`,
      { method: 'DELETE' }
    );
  }

  /**
   * 调用 Workers AI（用于测试商家自有AI Token权限）
   */
  async testAI(accountId: string): Promise<boolean> {
    try {
      const res = await this.request<any>(
        `/accounts/${accountId}/ai/run/@cf/meta/m2m100-1.2b`,
        {
          method: 'POST',
          body: JSON.stringify({
            text: 'Hello',
            source_lang: 'en',
            target_lang: 'zh',
          }),
        }
      );
      return res.success;
    } catch {
      return false;
    }
  }
}
