import { getDb } from '@server/shared/db';

export async function detectBusinessFromDomain(c: any, next: any) {
  const host = c.req.header('host');
  
  if (!host) {
    await next();
    return;
  }
  
  const normalizedHost = host.toLowerCase().trim();
  
  if (normalizedHost.endsWith('.workers.dev')) {
    await next();
    return;
  }
  
  const db = getDb();
  const business = await db.get(
    'SELECT id, business_slug, business_name, custom_domain FROM staff_users WHERE custom_domain = ?',
    [normalizedHost]
  );
  
  if (business) {
    c.set('businessId', business.id);
    c.set('businessSlug', business.business_slug);
    c.set('businessName', business.business_name);
    c.set('customDomain', business.custom_domain);
    c.set('fromCustomDomain', true);
    console.log(`[DomainDetection] Matched business: ${business.business_slug} via domain: ${normalizedHost}`);
  }
  
  await next();
}