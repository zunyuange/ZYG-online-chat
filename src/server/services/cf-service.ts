export interface CFConfig {
  apiToken: string;
  accountId: string;
  zoneId: string;
}

export interface CFRecord {
  id: string;
  name: string;
  type: string;
  content: string;
  proxied: boolean;
}

export interface CFZone {
  id: string;
  name: string;
  status: string;
  plan: {
    name: string;
  };
}

export class CFService {
  private baseUrl = 'https://api.cloudflare.com/client/v4';
  
  constructor(private config: CFConfig) {}
  
  async createCNAMERecord(subdomain: string, target: string): Promise<CFRecord | null> {
    try {
      const response = await fetch(
        `${this.baseUrl}/zones/${this.config.zoneId}/dns_records`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.config.apiToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'CNAME',
            name: subdomain,
            content: target,
            proxied: true,
            ttl: 1,
          }),
        }
      );
      
      const data = await response.json();
      if (data.success) {
        return data.result;
      }
      console.error('[CFService] Create CNAME failed:', data.errors);
      return null;
    } catch (error) {
      console.error('[CFService] Create CNAME error:', error);
      return null;
    }
  }
  
  async listRecords(name?: string): Promise<CFRecord[]> {
    try {
      const url = new URL(`${this.baseUrl}/zones/${this.config.zoneId}/dns_records`);
      if (name) url.searchParams.set('name', name);
      
      const response = await fetch(url.toString(), {
        headers: { 'Authorization': `Bearer ${this.config.apiToken}` },
      });
      
      const data = await response.json();
      return data.success ? data.result : [];
    } catch (error) {
      console.error('[CFService] List records error:', error);
      return [];
    }
  }
  
  async deleteRecord(recordId: string): Promise<boolean> {
    try {
      const response = await fetch(
        `${this.baseUrl}/zones/${this.config.zoneId}/dns_records/${recordId}`,
        {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${this.config.apiToken}` },
        }
      );
      
      const data = await response.json();
      return data.success;
    } catch (error) {
      console.error('[CFService] Delete record error:', error);
      return false;
    }
  }
  
  async listZones(): Promise<CFZone[]> {
    try {
      const response = await fetch(
        `${this.baseUrl}/zones`,
        {
          headers: { 'Authorization': `Bearer ${this.config.apiToken}` },
        }
      );
      
      const data = await response.json();
      return data.success ? data.result : [];
    } catch (error) {
      console.error('[CFService] List zones error:', error);
      return [];
    }
  }
  
  async getZoneById(zoneId: string): Promise<CFZone | null> {
    try {
      const response = await fetch(
        `${this.baseUrl}/zones/${zoneId}`,
        {
          headers: { 'Authorization': `Bearer ${this.config.apiToken}` },
        }
      );
      
      const data = await response.json();
      return data.success ? data.result : null;
    } catch (error) {
      console.error('[CFService] Get zone error:', error);
      return null;
    }
  }
  
  async createWorkerRoute(pattern: string, scriptName: string): Promise<boolean> {
    try {
      const response = await fetch(
        `${this.baseUrl}/accounts/${this.config.accountId}/workers/routes`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.config.apiToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            pattern,
            script: scriptName,
          }),
        }
      );
      
      const data = await response.json();
      return data.success;
    } catch (error) {
      console.error('[CFService] Create worker route error:', error);
      return false;
    }
  }
  
  async enableSSL(zoneId: string): Promise<boolean> {
    try {
      const response = await fetch(
        `${this.baseUrl}/zones/${zoneId}/ssl/settings`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${this.config.apiToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ssl: 'flexible',
          }),
        }
      );
      
      const data = await response.json();
      return data.success;
    } catch (error) {
      console.error('[CFService] Enable SSL error:', error);
      return false;
    }
  }
}