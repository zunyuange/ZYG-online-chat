/**
 * 🆕 Workers 自定义域注册脚本
 * 
 * 用途：将已有商家的三级子域名批量注册为 Cloudflare Workers 自定义域
 * 使其出现在 Workers Dashboard → Settings → Domains & Routes 列表中
 * 
 * 前置条件：
 *   1. 配置 wrangler.toml 中的 CF_API_TOKEN / CF_ACCOUNT_ID / CF_ZONE_ID
 *   2. 如果存在通配符路由 *.zygonlinechat.zygmail.icu，需先从 wrangler.toml 中移除并重新部署
 * 
 * 用法：
 *   npx tsx scripts/register-workers-domains.ts
 */

import 'dotenv/config';

// Cloudflare API 配置（从环境变量或 wrangler.toml vars 读取）
const CF_API_BASE = 'https://api.cloudflare.com/client/v4';

// ⚠️ 请根据实际情况修改以下配置
const CONFIG = {
  apiToken: process.env.CF_API_TOKEN || '',
  accountId: process.env.CF_ACCOUNT_ID || '',
  zoneId: process.env.CF_ZONE_ID || '',
  workerName: 'zyg-online-chat',
  workerEnv: 'production',
};

async function cfRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<{ success: boolean; result: T; errors: any[] }> {
  const response = await fetch(`${CF_API_BASE}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${CONFIG.apiToken}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const data = await response.json() as any;
  if (!response.ok || !data.success) {
    const errors = data.errors?.map((e: any) => e.message).join(', ') || 'Unknown error';
    throw new Error(`CF API Error [${response.status}]: ${errors}`);
  }
  return data;
}

async function listWorkersDomains(accountId: string): Promise<{ id: string; hostname: string }[]> {
  const res = await cfRequest<{ id: string; hostname: string; zone_name: string }[]>(
    `/accounts/${accountId}/workers/domains`
  );
  return res.result;
}

async function addWorkersDomain(
  accountId: string,
  hostname: string,
  zoneId: string,
  service: string,
  environment: string
): Promise<{ id: string; hostname: string }> {
  const res = await cfRequest<{ id: string; hostname: string }>(
    `/accounts/${accountId}/workers/domains`,
    {
      method: 'PUT',
      body: JSON.stringify({ hostname, service, zone_id: zoneId, environment }),
    }
  );
  return res.result;
}

async function main() {
  // 验证配置
  if (!CONFIG.apiToken || !CONFIG.accountId || !CONFIG.zoneId) {
    console.error('❌ 缺少配置！请设置以下环境变量：');
    console.error('   CF_API_TOKEN   - Cloudflare API Token (Workers:Edit + Zone:Read 权限)');
    console.error('   CF_ACCOUNT_ID  - Cloudflare Account ID');
    console.error('   CF_ZONE_ID     - zygmail.icu 的 Zone ID');
    console.error('\n💡 配置方式：');
    console.error('   1. 通过环境变量：set CF_API_TOKEN=xxx && npx tsx scripts/register-workers-domains.ts');
    console.error('   2. 或直接修改本脚本中的 CONFIG 对象');
    process.exit(1);
  }

  console.log('🚀 Workers 自定义域注册脚本');
  console.log(`   Account ID: ${CONFIG.accountId}`);
  console.log(`   Zone ID:    ${CONFIG.zoneId}`);
  console.log(`   Worker:     ${CONFIG.workerName}`);
  console.log('');

  try {
    // 1. 获取当前已注册的自定义域
    console.log('📋 获取当前已注册的自定义域...');
    const existingDomains = await listWorkersDomains(CONFIG.accountId);
    const existingHostnames = new Set(existingDomains.map(d => d.hostname.toLowerCase()));
    console.log(`   已注册 ${existingDomains.length} 个自定义域：`);
    existingDomains.forEach(d => console.log(`   - ${d.hostname}`));
    console.log('');

    // 2. 需要注册的子域名列表
    //    主域名 + 所有商家三级子域名
    const domainsToRegister = [
      // 平台主域名
      'zygonlinechat.zygmail.icu',
      // 🆕 商家三级子域名（请根据实际情况补充）
      'default.zygonlinechat.zygmail.icu',
      'onmm9adl.zygonlinechat.zygmail.icu',  // 后台测试
      '7t0dhxkk.zygonlinechat.zygmail.icu',  // 后台测试111
    ];

    console.log(`📝 需要注册 ${domainsToRegister.length} 个域名的自定义域...`);
    console.log('');

    let successCount = 0;
    let skipCount = 0;
    let failCount = 0;

    for (const hostname of domainsToRegister) {
      if (existingHostnames.has(hostname.toLowerCase())) {
        console.log(`⏭️  跳过 ${hostname} (已注册)`);
        skipCount++;
        continue;
      }

      try {
        const result = await addWorkersDomain(
          CONFIG.accountId,
          hostname,
          CONFIG.zoneId,
          CONFIG.workerName,
          CONFIG.workerEnv
        );
        console.log(`✅ 注册成功 ${hostname} (id: ${result.id})`);
        successCount++;
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        
        if (errMsg.includes('route') || errMsg.includes('overlap') || errMsg.includes('conflict')) {
          console.warn(`⚠️  ${hostname} 注册失败：与现有通配符路由冲突`);
          console.warn(`   💡 解决：从 wrangler.toml 中移除 *.zygonlinechat.zygmail.icu 路由，然后重新部署并重试`);
        } else {
          console.error(`❌ ${hostname} 注册失败: ${errMsg}`);
        }
        failCount++;
      }
    }

    console.log('');
    console.log('📊 注册结果：');
    console.log(`   成功: ${successCount}`);
    console.log(`   跳过: ${skipCount}`);
    console.log(`   失败: ${failCount}`);
    console.log('');

    if (failCount > 0) {
      console.log('⚠️  部分域名注册失败，请检查以下事项：');
      console.log('   1. wrangler.toml 中是否仍有 *.zygonlinechat.zygmail.icu 通配符路由');
      console.log('      → 如有，请移除并重新部署 (npx wrangler deploy)');
      console.log('   2. API Token 权限是否包含 Workers:Edit');
      console.log('   3. Zone ID 是否正确');
    }

  } catch (error) {
    console.error('❌ 脚本执行失败:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
