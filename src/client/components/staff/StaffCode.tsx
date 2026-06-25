import { useState, useEffect } from 'react';
import { Copy, Check, Link, Code2, BookOpen, Globe } from 'lucide-react';
import { useI18n } from '@client/context/I18nContext';
import { supportedLocales } from '@shared/i18n';

interface BusinessInfo {
  id: number;
  business_name: string;
  business_slug: string;
  lang: string;
  created_at: number;
  updated_at: number;
}

interface DomainInfo {
  id: number;
  domainType: string;
  domain: string;
  subdomain: string | null;
  isPrimary: number;
  verificationStatus: string;
}

export function StaffCode() {
  const { t } = useI18n();
  const [business, setBusiness] = useState<BusinessInfo | null>(null);
  const [domains, setDomains] = useState<DomainInfo[]>([]);
  const [copied, setCopied] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'legacy' | 'subdomain'>('legacy');

  useEffect(() => {
    fetchBusiness();
  }, []);

  const fetchBusiness = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('staff_token');
      const [bizRes, domainRes] = await Promise.all([
        fetch('/api/business/info', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/business/domains', { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const bizResult = await bizRes.json();
      if (bizResult.success) {
        setBusiness(bizResult.data);
      } else {
        console.error('Failed to fetch business:', bizResult.error);
      }
      const domainResult = await domainRes.json();
      if (domainResult.success && domainResult.data?.length > 0) {
        setDomains(domainResult.data);
        // 如果有激活的三级子域名，默认使用
        const activeSub = domainResult.data.find(
          (d: DomainInfo) => d.domainType === 'auto_subdomain' && d.verificationStatus === 'active'
        );
        if (activeSub) {
          setActiveTab('subdomain');
        }
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(type);
      setTimeout(() => setCopied(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const currentDomain = typeof window !== 'undefined' ? window.location.origin : 'https://zyg-online-chat.linzihai.workers.dev';

  // 🆕 三级子域名（如果可用）
  const activeSubdomain = domains.find(
    d => d.domainType === 'auto_subdomain' && d.verificationStatus === 'active'
  );
  const subdomainUrl = activeSubdomain ? `https://${activeSubdomain.domain}` : null;
  const primaryCustomDomain = domains.find(d => d.isPrimary && d.verificationStatus === 'active');

  // 基础链接工厂
  const getChatUrl = (): string => {
    if (activeTab === 'subdomain' && subdomainUrl) return subdomainUrl;
    if (activeTab === 'subdomain' && primaryCustomDomain) return `https://${primaryCustomDomain.domain}`;
    return `${currentDomain}/chat?business=${business?.business_slug || 'default'}`;
  };

  const chatUrl = getChatUrl();
  const legacyChatUrl = `${currentDomain}/chat?business=${business?.business_slug || 'default'}`;

  const embedCode = `<script>
(function() {
  var script = document.createElement('script');
  script.src = '${activeTab === 'subdomain' && subdomainUrl ? subdomainUrl : currentDomain}/embed/chat.js';
  script.async = true;
  script.dataset.business = '${business?.business_slug || 'default'}';
  document.head.appendChild(script);
})();
</script>`;

  const directLink = chatUrl;

  const iframeCode = `<iframe 
  src="${chatUrl}" 
  width="400" 
  height="500" 
  frameborder="0" 
  style="border-radius: 8px; box-shadow: 0 2px 12px rgba(0,0,0,0.1);">
</iframe>`;

  if (loading) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <div className="animate-spin" style={{
          width: '40px',
          height: '40px',
          border: '3px solid #e5e7eb',
          borderTopColor: '#3b82f6',
          borderRadius: '50%',
          margin: '0 auto 16px',
        }}></div>
        <p style={{ color: '#6b7280' }}>{t('loading_text')}</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', height: '100%', overflowY: 'auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 500, margin: 0 }}>{t('staff_code_title')}</h2>
          <p style={{ color: '#999', fontSize: '14px', marginTop: '8px' }}>
            {t('staff_code_desc')}
          </p>
        </div>
        <a
          href="/docs"
          target="_blank"
          style={{
            padding: '10px 20px',
            backgroundColor: '#1890ff',
            border: 'none',
            borderRadius: '6px',
            color: '#fff',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '14px',
            fontWeight: 500,
            textDecoration: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          <BookOpen size={16} />
          {t('staff_code_docs_link')}
        </a>
      </div>

      {/* Business Info Card */}
      <div style={{ backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', padding: '20px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            backgroundColor: '#1890ff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: '24px',
            fontWeight: 500,
          }}>
            {business?.business_name?.charAt(0) || t('staff_code_default_business').charAt(0)}
          </div>
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: 500, margin: 0 }}>{business?.business_name || t('staff_code_default_business')}</h3>
            <p style={{ color: '#999', fontSize: '14px', margin: '4px 0 0' }}>
              {t('staff_code_business_slug_prefix')}{business?.business_slug || 'default'}
            </p>
          </div>
        </div>
      </div>

      {/* 🆕 Domain Tabs - 域名方式切换 */}
      {activeSubdomain && (
        <div style={{ marginBottom: '16px', display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setActiveTab('subdomain')}
            style={{
              padding: '8px 16px',
              border: activeTab === 'subdomain' ? '2px solid #1890ff' : '1px solid #d9d9d9',
              borderRadius: '6px',
              backgroundColor: activeTab === 'subdomain' ? '#e6f7ff' : '#fff',
              color: activeTab === 'subdomain' ? '#1890ff' : '#666',
              fontWeight: activeTab === 'subdomain' ? 500 : 400,
              cursor: 'pointer',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Globe size={14} />
            {activeTab === 'subdomain' ? '🌟 ' : ''}{t('domain_platform_cloudflare') || 'Platform'} ({activeSubdomain.domain})
          </button>
          <button
            onClick={() => setActiveTab('legacy')}
            style={{
              padding: '8px 16px',
              border: activeTab === 'legacy' ? '2px solid #1890ff' : '1px solid #d9d9d9',
              borderRadius: '6px',
              backgroundColor: activeTab === 'legacy' ? '#e6f7ff' : '#fff',
              color: activeTab === 'legacy' ? '#1890ff' : '#666',
              fontWeight: activeTab === 'legacy' ? 500 : 400,
              cursor: 'pointer',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Link size={14} />
            {activeTab === 'legacy' ? '🔧 ' : ''}{t('domain_legacy_url') || 'URL Parameter'}
          </button>
        </div>
      )}

      {/* Direct Link */}
      <div style={{ backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: '24px' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Link size={18} style={{ color: '#1890ff' }} />
          <h3 style={{ fontSize: '16px', fontWeight: 500, margin: 0 }}>{t('staff_code_direct_link')}</h3>
        </div>
        <div style={{ padding: '20px' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <input
              type="text"
              value={directLink}
              readOnly
              style={{
                flex: 1,
                padding: '10px 12px',
                border: '1px solid #d9d9d9',
                borderRadius: '4px',
                fontSize: '14px',
                backgroundColor: '#fafafa',
                fontFamily: 'monospace',
              }}
            />
            <button
              onClick={() => copyToClipboard(directLink, 'direct')}
              style={{
                padding: '10px 16px',
                border: 'none',
                borderRadius: '4px',
                backgroundColor: copied === 'direct' ? '#52c41a' : '#1890ff',
                color: '#fff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              {copied === 'direct' ? <Check size={18} /> : <Copy size={18} />}
              {copied === 'direct' ? t('staff_code_copied') : t('staff_code_copy')}
            </button>
          </div>
          <p style={{ color: '#999', fontSize: '14px', marginTop: '12px' }}>
            {t('staff_code_direct_link_desc')}
          </p>
          {/* 🆕 当使用子域名时，显示旧版链接作为备选 */}
          {activeTab === 'subdomain' && (
            <div style={{
              marginTop: '12px',
              padding: '10px 12px',
              backgroundColor: '#fafafa',
              borderRadius: '4px',
              border: '1px solid #f0f0f0',
              fontSize: '13px',
              color: '#999',
            }}>
              <span style={{ marginRight: '8px' }}>🔒 {t('domain_legacy_url') || 'Legacy URL'}:</span>
              <code style={{
                backgroundColor: '#fff',
                padding: '2px 6px',
                borderRadius: '3px',
                border: '1px solid #d9d9d9',
                fontSize: '12px',
                fontFamily: 'monospace',
              }}>
                {legacyChatUrl}
              </code>
              <button
                onClick={() => copyToClipboard(legacyChatUrl, 'legacy')}
                style={{
                  marginLeft: '8px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#999',
                  padding: '2px',
                }}
              >
                {copied === 'legacy' ? <Check size={14} color="#52c41a" /> : <Copy size={14} />}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Language Code Reference */}
      <div style={{ backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: '24px' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Globe size={18} style={{ color: '#1890ff' }} />
          <h3 style={{ fontSize: '16px', fontWeight: 500, margin: 0 }}>{t('staff_code_language_ref_title')}</h3>
        </div>
        <div style={{ padding: '20px' }}>
          <p style={{ color: '#666', fontSize: '14px', marginBottom: '16px' }}>
            {t('staff_code_language_ref_desc')}
          </p>
          {/* Example URL */}
          <div style={{
            backgroundColor: '#f0f7ff',
            border: '1px solid #bdd7ee',
            borderRadius: '6px',
            padding: '10px 14px',
            marginBottom: '16px',
            fontSize: '13px',
            fontFamily: 'monospace',
            color: '#1a6ab5',
            wordBreak: 'break-all',
          }}>
            {directLink}<span style={{ color: '#e67e22', fontWeight: 600 }}>&amp;lang=ko</span>
          </div>
          {/* Language Table */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: '8px',
          }}>
            {supportedLocales.map((locale) => (
              <div
                key={locale.code}
                onClick={() => copyToClipboard(locale.code, `lang-${locale.code}`)}
                title={`${t('staff_code_click_to_copy')}: &lang=${locale.code}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  backgroundColor: '#fafafa',
                  border: '1px solid #f0f0f0',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  transition: 'background-color 0.2s',
                  userSelect: 'none',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#e6f7ff';
                  e.currentTarget.style.borderColor = '#91d5ff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#fafafa';
                  e.currentTarget.style.borderColor = '#f0f0f0';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{
                    display: 'inline-block',
                    padding: '2px 8px',
                    backgroundColor: '#e6f7ff',
                    border: '1px solid #91d5ff',
                    borderRadius: '4px',
                    fontWeight: 600,
                    color: '#1890ff',
                    fontFamily: 'monospace',
                    fontSize: '12px',
                  }}>
                    {locale.code}
                  </span>
                  <span style={{ color: '#333' }}>{locale.nativeName}</span>
                </div>
                <span style={{ color: '#999', fontSize: '11px' }}>
                  {copied === `lang-${locale.code}` ? '✓' : '&lang=' + locale.code}
                </span>
              </div>
            ))}
          </div>
          <p style={{ color: '#999', fontSize: '12px', marginTop: '12px' }}>
            {t('staff_code_language_ref_tip')}
          </p>
        </div>
      </div>

      {/* Embed Script */}
      <div style={{ backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: '24px' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Code2 size={18} style={{ color: '#1890ff' }} />
          <h3 style={{ fontSize: '16px', fontWeight: 500, margin: 0 }}>{t('staff_code_embed_script')}</h3>
        </div>
        <div style={{ padding: '20px' }}>
          <pre style={{
            backgroundColor: '#f5f5f5',
            padding: '16px',
            borderRadius: '4px',
            overflowX: 'auto',
            fontSize: '13px',
            fontFamily: 'monospace',
            margin: 0,
            color: '#333',
          }}>
            {embedCode}
          </pre>
          <button
            onClick={() => copyToClipboard(embedCode, 'script')}
            style={{
              marginTop: '16px',
              padding: '8px 16px',
              border: 'none',
              borderRadius: '4px',
              backgroundColor: copied === 'script' ? '#52c41a' : '#1890ff',
              color: '#fff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            {copied === 'script' ? <Check size={18} /> : <Copy size={18} />}
            {copied === 'script' ? t('staff_code_copied') : t('staff_code_copy_code')}
          </button>
          <p style={{ color: '#999', fontSize: '14px', marginTop: '12px' }}>
            {t('staff_code_embed_script_desc')}
          </p>
        </div>
      </div>

      {/* Iframe Code */}
      <div style={{ backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Code2 size={18} style={{ color: '#1890ff' }} />
          <h3 style={{ fontSize: '16px', fontWeight: 500, margin: 0 }}>{t('staff_code_iframe_code')}</h3>
        </div>
        <div style={{ padding: '20px' }}>
          <pre style={{
            backgroundColor: '#f5f5f5',
            padding: '16px',
            borderRadius: '4px',
            overflowX: 'auto',
            fontSize: '13px',
            fontFamily: 'monospace',
            margin: 0,
            color: '#333',
          }}>
            {iframeCode}
          </pre>
          <button
            onClick={() => copyToClipboard(iframeCode, 'iframe')}
            style={{
              marginTop: '16px',
              padding: '8px 16px',
              border: 'none',
              borderRadius: '4px',
              backgroundColor: copied === 'iframe' ? '#52c41a' : '#1890ff',
              color: '#fff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            {copied === 'iframe' ? <Check size={18} /> : <Copy size={18} />}
            {copied === 'iframe' ? t('staff_code_copied') : t('staff_code_copy_code')}
          </button>
          <p style={{ color: '#999', fontSize: '14px', marginTop: '12px' }}>
            {t('staff_code_iframe_desc')}
          </p>
        </div>
      </div>
    </div>
  );
}