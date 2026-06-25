/**
 * DomainManager - Reusable Domain Management Component
 * Used by both AdminPage and StaffPage for managing business custom domains.
 *
 * Props:
 *   - businessId: The business ID to manage domains for
 *   - authToken: The authentication token (admin_token or staff_token)
 *   - t: i18n translation function
 *   - isPlatformAdmin: If true, shows "Platform Admin" badge and admin-specific features
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Globe, Server, Link, Copy, ExternalLink, Plus,
  Check, Trash2, AlertCircle, Loader2, ChevronRight, ChevronLeft,
  Shield, XCircle,
} from 'lucide-react';

// ===== Types =====

export interface DomainData {
  id: number;
  businessId: number;
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
  errorMessage?: string;
}

interface DomainBindFormData {
  domain: string;
  platform: string;
  cfApiToken: string;
  step: number;
}

export interface DomainManagerProps {
  businessId: number;
  authToken: string;
  t: (key: string, params?: Record<string, string | number>) => string;
  isPlatformAdmin?: boolean;
}

// ===== Styles =====

const cardStyle: React.CSSProperties = {
  backgroundColor: '#fff',
  borderRadius: '8px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  padding: '24px',
  marginBottom: '24px',
};

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
};

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '12px 16px',
  backgroundColor: '#fafafa',
  borderBottom: '1px solid #f0f0f0',
  fontWeight: 600,
  fontSize: '13px',
};

const tdStyle: React.CSSProperties = {
  padding: '12px 16px',
  borderBottom: '1px solid #f0f0f0',
  fontSize: '14px',
};

const modalOverlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(0,0,0,0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
};

const modalStyle: React.CSSProperties = {
  backgroundColor: '#fff',
  borderRadius: '8px',
  padding: '24px',
  width: '100%',
  maxWidth: '560px',
  maxHeight: '90vh',
  overflow: 'auto',
  position: 'relative',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  border: '1px solid #d9d9d9',
  borderRadius: '4px',
  fontSize: '14px',
  boxSizing: 'border-box',
  marginBottom: '12px',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: '8px',
  fontSize: '14px',
  color: '#333',
  fontWeight: 500,
};

const buttonStyle = (variant: 'primary' | 'danger' | 'default'): React.CSSProperties => ({
  padding: '6px 12px',
  border: 'none',
  borderRadius: '4px',
  cursor: 'pointer',
  fontSize: '14px',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '4px',
  transition: 'all 0.2s',
  ...(variant === 'primary' && { backgroundColor: '#1890ff', color: '#fff' }),
  ...(variant === 'danger' && { backgroundColor: '#ff4d4f', color: '#fff' }),
  ...(variant === 'default' && { backgroundColor: '#f0f0f0', color: '#666' }),
});

const roleBadgeStyle: React.CSSProperties = {
  padding: '2px 8px',
  borderRadius: '4px',
  fontSize: '12px',
  backgroundColor: '#e6f7ff',
  color: '#1890ff',
  border: '1px solid #91d5ff',
  display: 'inline-block',
};

const statusBadgeStyle = (status: string): React.CSSProperties => {
  const colorMap: Record<string, { bg: string; color: string; border: string }> = {
    active: { bg: '#f6ffed', color: '#52c41a', border: '#b7eb8f' },
    dns_verified: { bg: '#f6ffed', color: '#52c41a', border: '#b7eb8f' },
    pending: { bg: '#fffbe6', color: '#faad14', border: '#ffe58f' },
    dns_verifying: { bg: '#e6f7ff', color: '#1890ff', border: '#91d5ff' },
    ssl_provisioning: { bg: '#e6f7ff', color: '#1890ff', border: '#91d5ff' },
    failed: { bg: '#fff1f0', color: '#ff4d4f', border: '#ffa39e' },
  };
  const c = colorMap[status] || { bg: '#f5f5f5', color: '#999', border: '#d9d9d9' };
  return {
    padding: '2px 10px',
    borderRadius: '4px',
    fontSize: '12px',
    backgroundColor: c.bg,
    color: c.color,
    border: `1px solid ${c.border}`,
    display: 'inline-block',
  };
};

// ===== DomainManager Component =====

export function DomainManager({ businessId, authToken, t, isPlatformAdmin }: DomainManagerProps) {
  const [domains, setDomains] = useState<DomainData[]>([]);
  const [domainsLoading, setDomainsLoading] = useState(true);
  const [formLoading, setFormLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showDomainModal, setShowDomainModal] = useState(false);
  const [domainBindForm, setDomainBindForm] = useState<DomainBindFormData>({
    domain: '',
    platform: 'cloudflare',
    cfApiToken: '',
    step: 1,
  });
  const [domainModalError, setDomainModalError] = useState<string | null>(null);
  const [domainBindResult, setDomainBindResult] = useState<{
    domain?: string;
    dnsRecord?: { type: string; name: string; value: string };
    verificationStatus?: string;
  } | null>(null);
  const [domainDetachConfirm, setDomainDetachConfirm] = useState<{ id: number; domain: string } | null>(null);

  // ===== Domain Management Functions =====

  const loadDomains = useCallback(async () => {
    setDomainsLoading(true);
    try {
      const res = await fetch('/api/business/domains', {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (data.success) {
        setDomains(data.data || []);
      } else {
        setError(data.error || t('load_failed'));
      }
    } catch {
      setError(t('load_failed'));
    } finally {
      setDomainsLoading(false);
    }
  }, [authToken, t]);

  useEffect(() => {
    loadDomains();
  }, [loadDomains]);

  // Status label helpers
  const domainTypeLabel = (type: string): string => {
    const map: Record<string, string> = {
      auto_subdomain: t('domain_auto_subdomain'),
      custom_cf: t('domain_cf_auto'),
      custom_external: t('domain_manual'),
    };
    return map[type] || type;
  };

  const statusLabel = (status: string): string => {
    const map: Record<string, string> = {
      active: t('domain_active'),
      pending: t('domain_pending'),
      dns_verifying: t('domain_verifying'),
      dns_verified: t('domain_active'),
      ssl_provisioning: t('domain_ssl_provisioning'),
      failed: t('domain_failed'),
    };
    return map[status] || status;
  };

  const platformLabel = (platform: string): string => {
    const map: Record<string, string> = {
      cloudflare: t('domain_platform_cloudflare'),
      aliyun: t('domain_platform_aliyun'),
      tencent: t('domain_platform_tencent'),
      godaddy: t('domain_platform_godaddy'),
      namesilo: t('domain_platform_namesilo'),
      other: t('domain_platform_other'),
    };
    return map[platform] || platform;
  };

  const handleCopyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const el = document.createElement('textarea');
      el.value = url;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
  };

  // Bind Domain Modal
  const handleOpenDomainBind = () => {
    setDomainBindForm({ domain: '', platform: 'cloudflare', cfApiToken: '', step: 1 });
    setDomainModalError(null);
    setDomainBindResult(null);
    setShowDomainModal(true);
  };

  const handleDomainModalNext = () => {
    if (domainBindForm.step === 1) {
      if (!domainBindForm.domain.trim()) {
        setDomainModalError(t('domain_input_hint'));
        return;
      }
      if (domainBindForm.platform === 'cloudflare') {
        setDomainBindForm({ ...domainBindForm, step: 2 });
      } else {
        setDomainBindForm({ ...domainBindForm, step: 2 });
      }
      setDomainModalError(null);
    } else if (domainBindForm.step === 2 && domainBindForm.platform === 'cloudflare') {
      if (!domainBindForm.cfApiToken.trim()) {
        setDomainModalError(t('cf_api_token_hint'));
        return;
      }
      handleBindDomain();
    } else if (domainBindForm.step === 2) {
      // Non-CF manual bind
      handleBindDomain();
    }
  };

  const handleDomainModalPrev = () => {
    if (domainBindForm.step > 1) {
      setDomainBindForm({ ...domainBindForm, step: domainBindForm.step - 1 });
      setDomainModalError(null);
    }
  };

  const handleBindDomain = async () => {
    setDomainModalError(null);
    setFormLoading(true);
    try {
      const endpoint =
        domainBindForm.platform === 'cloudflare'
          ? '/api/business/domains/bind-cf'
          : '/api/business/domains/bind-manual';

      const body: Record<string, string> = {
        domain: domainBindForm.domain.trim(),
        platform: domainBindForm.platform,
      };
      if (domainBindForm.platform === 'cloudflare' && domainBindForm.cfApiToken) {
        body.cfApiToken = domainBindForm.cfApiToken;
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (data.success) {
        setDomainBindResult({
          domain: data.data?.domain || domainBindForm.domain,
          dnsRecord: data.data?.dnsRecord,
          verificationStatus: data.data?.verificationStatus,
        });
        setDomainBindForm({ ...domainBindForm, step: 3 });
      } else {
        setDomainModalError(data.error || t('domain_bind_failed'));
      }
    } catch {
      setDomainModalError(t('domain_bind_failed'));
    } finally {
      setFormLoading(false);
    }
  };

  const handleCloseDomainModal = () => {
    setShowDomainModal(false);
    setDomainBindForm({ domain: '', platform: 'cloudflare', cfApiToken: '', step: 1 });
    setDomainModalError(null);
    setDomainBindResult(null);
    loadDomains();
  };

  const handleVerifyDomain = async (domainId: number) => {
    setFormLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/business/domains/${domainId}/verify`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await res.json();
      if (data.success) {
        loadDomains();
      } else {
        setError(data.error || t('domain_operation_failed'));
      }
    } catch {
      setError(t('domain_operation_failed'));
    } finally {
      setFormLoading(false);
    }
  };

  const handleSetPrimaryDomain = async (domainId: number) => {
    setFormLoading(true);
    try {
      const res = await fetch(`/api/business/domains/${domainId}/primary`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await res.json();
      if (data.success) {
        loadDomains();
      } else {
        setError(data.error || t('domain_operation_failed'));
      }
    } catch {
      setError(t('domain_operation_failed'));
    } finally {
      setFormLoading(false);
    }
  };

  const handleDetachDomain = async (domainItem: { id: number; domain: string }) => {
    setFormLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/business/domains/${domainItem.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (data.success) {
        setDomainDetachConfirm(null);
        loadDomains();
      } else {
        setError(data.error || t('domain_operation_failed'));
      }
    } catch {
      setError(t('domain_operation_failed'));
    } finally {
      setFormLoading(false);
    }
  };

  // ===== Filter domains =====
  const autoDomains = domains.filter(d => d.domainType === 'auto_subdomain');
  const customDomains = domains.filter(d => d.domainType !== 'auto_subdomain');

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h1 style={{ fontSize: '20px', fontWeight: 500 }}>{t('domain_management')}</h1>
          {isPlatformAdmin && (
            <span style={{
              ...roleBadgeStyle,
              backgroundColor: '#fff7e6',
              color: '#fa8c16',
              border: '1px solid #ffd591',
            }}>
              <Shield size={12} style={{ marginRight: '4px' }} />
              {t('admin_panel')}
            </span>
          )}
        </div>
        <button
          onClick={handleOpenDomainBind}
          style={{ ...buttonStyle('primary'), padding: '8px 20px' }}
        >
          <Plus size={16} /> {t('bind_domain')}
        </button>
      </div>

      {/* Error Banner */}
      {error && (
        <div style={{
          backgroundColor: '#fff2f0',
          border: '1px solid #ffccc7',
          borderRadius: '4px',
          padding: '12px 16px',
          marginBottom: '16px',
          color: '#ff4d4f',
        }}>
          {error}
          <button
            onClick={() => setError(null)}
            style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer', color: '#ff4d4f', fontSize: '16px' }}
          >
            ×
          </button>
        </div>
      )}

      {domainsLoading ? (
        <div style={{ textAlign: 'center', padding: '48px', color: '#999' }}>
          <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto 12px' }} />
          <p>{t('loading')}</p>
        </div>
      ) : (
        <>
          {/* Platform Auto Subdomain */}
          <div style={cardStyle}>
            <h2 style={{ fontSize: '16px', fontWeight: 500, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Server size={18} /> {t('platform_domain')}
            </h2>
            {autoDomains.length === 0 ? (
              <p style={{ color: '#999', fontSize: '14px' }}>{t('loading')}</p>
            ) : (
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>{t('domain_url')}</th>
                    <th style={thStyle}>{t('domain_type')}</th>
                    <th style={thStyle}>{t('domain_status')}</th>
                    <th style={thStyle}></th>
                    <th style={{ ...thStyle, textAlign: 'center' }}>{t('domain_actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {autoDomains.map((d) => (
                    <tr key={d.id} style={{ backgroundColor: d.isPrimary ? '#f6ffed' : 'transparent' }}>
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <a
                            href={`https://${d.domain}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: '#1890ff', textDecoration: 'none' }}
                          >
                            {d.domain}
                          </a>
                          <ExternalLink size={14} style={{ color: '#999' }} />
                          <button
                            onClick={() => handleCopyLink(`https://${d.domain}`)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: '#999' }}
                            title={t('copy_link')}
                          >
                            <Copy size={14} />
                          </button>
                        </div>
                      </td>
                      <td style={tdStyle}>
                        <span style={{ fontSize: '13px', color: '#666' }}>{domainTypeLabel(d.domainType)}</span>
                      </td>
                      <td style={tdStyle}>
                        <span style={statusBadgeStyle(d.verificationStatus)}>{statusLabel(d.verificationStatus)}</span>
                      </td>
                      <td style={tdStyle}>
                        {d.isPrimary ? (
                          <span style={{ ...roleBadgeStyle, backgroundColor: '#f6ffed', color: '#52c41a', border: '1px solid #b7eb8f' }}>
                            {t('is_primary')}
                          </span>
                        ) : (
                          <button
                            onClick={() => handleSetPrimaryDomain(d.id)}
                            style={{ ...buttonStyle('default'), fontSize: '12px', padding: '2px 8px' }}
                            disabled={formLoading}
                          >
                            {t('set_as_primary')}
                          </button>
                        )}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        <button
                          onClick={() => handleCopyLink(`https://${d.domain}`)}
                          style={{ ...buttonStyle('default'), fontSize: '12px' }}
                        >
                          <Copy size={12} /> {t('copy_link')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Custom Domains */}
          <div style={cardStyle}>
            <h2 style={{ fontSize: '16px', fontWeight: 500, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Globe size={18} /> {t('custom_domain')}
            </h2>
            {customDomains.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px', color: '#999' }}>
                <Link size={40} style={{ marginBottom: '12px', opacity: 0.3 }} />
                <p>{t('domain_no_custom')}</p>
                <p style={{ fontSize: '13px', marginTop: '8px' }}>{t('domain_how_to_verify')}</p>
              </div>
            ) : (
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>{t('domain_url')}</th>
                    <th style={thStyle}>{t('domain_type')}</th>
                    <th style={thStyle}>{t('domain_platform_label')}</th>
                    <th style={thStyle}>{t('domain_status')}</th>
                    <th style={{ ...thStyle, textAlign: 'center' }}>{t('domain_actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {customDomains.map((d) => (
                    <tr key={d.id} style={{ backgroundColor: d.isPrimary ? '#f6ffed' : 'transparent' }}>
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: 500 }}>{d.domain}</span>
                          <button
                            onClick={() => handleCopyLink(`https://${d.domain}`)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: '#999' }}
                            title={t('copy_link')}
                          >
                            <Copy size={14} />
                          </button>
                        </div>
                      </td>
                      <td style={tdStyle}>
                        <span style={{ fontSize: '13px', color: '#666' }}>{domainTypeLabel(d.domainType)}</span>
                      </td>
                      <td style={tdStyle}>
                        <span style={{ fontSize: '13px', color: '#666' }}>{platformLabel(d.domainPlatform)}</span>
                      </td>
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span style={statusBadgeStyle(d.verificationStatus)}>{statusLabel(d.verificationStatus)}</span>
                        </div>
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
                          {d.verificationStatus === 'pending' && (
                            <button
                              onClick={() => handleVerifyDomain(d.id)}
                              style={{ ...buttonStyle('primary'), fontSize: '12px' }}
                              disabled={formLoading}
                            >
                              <Check size={12} /> {t('verify_domain')}
                            </button>
                          )}
                          {!d.isPrimary && d.verificationStatus !== 'pending' && d.verificationStatus !== 'failed' && (
                            <button
                              onClick={() => handleSetPrimaryDomain(d.id)}
                              style={{ ...buttonStyle('default'), fontSize: '12px' }}
                              disabled={formLoading}
                            >
                              {t('set_as_primary')}
                            </button>
                          )}
                          {d.isPrimary && (
                            <span style={{ ...roleBadgeStyle, backgroundColor: '#f6ffed', color: '#52c41a', border: '1px solid #b7eb8f' }}>
                              {t('is_primary')}
                            </span>
                          )}
                          {d.domainType !== 'auto_subdomain' && (
                            <button
                              onClick={() => setDomainDetachConfirm({ id: d.id, domain: d.domain })}
                              style={{ ...buttonStyle('danger'), fontSize: '12px' }}
                              disabled={formLoading}
                            >
                              <Trash2 size={12} /> {t('detach_domain')}
                            </button>
                          )}
                        </div>
                        {d.errorMessage && (
                          <div style={{ marginTop: '4px', fontSize: '12px', color: '#ff4d4f' }}>
                            <AlertCircle size={12} style={{ verticalAlign: 'middle' }} /> {d.errorMessage}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Legacy URL Info */}
          <div style={{ ...cardStyle, backgroundColor: '#fafafa' }}>
            <h2 style={{ fontSize: '14px', fontWeight: 500, marginBottom: '12px', color: '#666', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertCircle size={16} /> {t('domain_legacy_url')}
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', color: '#999' }}>
              {autoDomains.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <code style={{ backgroundColor: '#fff', padding: '4px 8px', borderRadius: '4px', border: '1px solid #d9d9d9' }}>
                    https://zygonlinechat.zygmail.icu/chat?business={autoDomains[0]?.subdomain || '...'}
                  </code>
                  <button
                    onClick={() => handleCopyLink(`https://zygonlinechat.zygmail.icu/chat?business=${autoDomains[0]?.subdomain || ''}`)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: '#999' }}
                  >
                    <Copy size={14} />
                  </button>
                </div>
              )}
              <span>{t('domain_workers_dev_url')}: <code style={{ backgroundColor: '#fff', padding: '4px 8px', borderRadius: '4px', border: '1px solid #d9d9d9' }}>zyg-online-chat.linzihai.workers.dev</code></span>
            </div>
          </div>
        </>
      )}

      {/* 🔷 Domain Bind Modal (Step Wizard) */}
      {showDomainModal && (
        <div style={modalOverlayStyle} onClick={handleCloseDomainModal}>
          <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 500 }}>
                {domainBindForm.platform === 'cloudflare' ? t('bind_cf_domain') : t('bind_manual_domain')}
              </h2>
              <button onClick={handleCloseDomainModal} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#999' }}>
                <XCircle size={20} />
              </button>
            </div>

            {/* Step indicator */}
            {domainBindForm.step < 3 && (
              <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
                {[1, 2].map((s) => (
                  <div key={s} style={{
                    flex: 1, height: '4px', borderRadius: '2px',
                    backgroundColor: domainBindForm.step >= s ? '#1890ff' : '#e5e7eb',
                    transition: 'background-color 0.3s',
                  }} />
                ))}
              </div>
            )}

            {domainModalError && (
              <div style={{
                backgroundColor: '#fff2f0', border: '1px solid #ffccc7',
                borderRadius: '4px', padding: '12px', marginBottom: '16px',
                color: '#ff4d4f', fontSize: '14px',
              }}>
                {domainModalError}
              </div>
            )}

            {/* Step 1: Enter domain + platform */}
            {domainBindForm.step === 1 && (
              <div>
                <label style={{ ...labelStyle, marginBottom: '8px' }}>{t('domain_platform_label')}</label>
                <select
                  value={domainBindForm.platform}
                  onChange={(e) => setDomainBindForm({ ...domainBindForm, platform: e.target.value })}
                  style={{ ...inputStyle, marginBottom: '16px' }}
                >
                  <option value="cloudflare">{t('domain_platform_cloudflare')}</option>
                  <option value="aliyun">{t('domain_platform_aliyun')}</option>
                  <option value="tencent">{t('domain_platform_tencent')}</option>
                  <option value="godaddy">{t('domain_platform_godaddy')}</option>
                  <option value="namesilo">{t('domain_platform_namesilo')}</option>
                  <option value="other">{t('domain_platform_other')}</option>
                </select>

                <label style={labelStyle}>{t('domain_url')}</label>
                <input
                  type="text"
                  value={domainBindForm.domain}
                  onChange={(e) => setDomainBindForm({ ...domainBindForm, domain: e.target.value })}
                  style={inputStyle}
                  placeholder={t('domain_input_placeholder')}
                />
                <p style={{ fontSize: '12px', color: '#999', marginTop: '8px' }}>{t('domain_input_hint')}</p>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
                  <button type="button" onClick={handleCloseDomainModal} style={buttonStyle('default')}>
                    {t('cancel')}
                  </button>
                  <button type="button" onClick={handleDomainModalNext} style={buttonStyle('primary')}>
                    {t('domain_step_next')}
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Auth (CF) or DNS Guide (Manual) */}
            {domainBindForm.step === 2 && (
              <div>
                {domainBindForm.platform === 'cloudflare' ? (
                  <>
                    <label style={labelStyle}>{t('cf_api_token')}</label>
                    <input
                      type="password"
                      value={domainBindForm.cfApiToken}
                      onChange={(e) => setDomainBindForm({ ...domainBindForm, cfApiToken: e.target.value })}
                      style={inputStyle}
                      placeholder="●●●●●●●●●●●●●●●●●●●●"
                    />
                    <p style={{ fontSize: '12px', color: '#999', marginTop: '8px' }}>{t('cf_api_token_hint')}</p>
                    <div style={{
                      backgroundColor: '#e6f7ff', border: '1px solid #91d5ff',
                      borderRadius: '4px', padding: '12px', marginTop: '12px',
                      fontSize: '13px', color: '#1890ff',
                    }}>
                      <strong>{t('cf_api_token_get')}</strong>
                      <ol style={{ margin: '8px 0 0 16px', padding: 0 }}>
                        <li>Visit dash.cloudflare.com → Profile → API Tokens</li>
                        <li>Create Token → 使用「编辑区域 DNS」模板</li>
                        <li>Zone Resources 选择「Include → Specific zone → 你的域名」</li>
                        <li>Copy the token and paste it above</li>
                      </ol>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{
                      backgroundColor: '#fffbe6', border: '1px solid #ffe58f',
                      borderRadius: '4px', padding: '16px', marginBottom: '16px',
                    }}>
                      <h3 style={{ fontSize: '14px', fontWeight: 500, marginBottom: '8px' }}>
                        <AlertCircle size={16} style={{ verticalAlign: 'middle', marginRight: '8px' }} />
                        {t('domain_dns_config_guide')}
                      </h3>
                      <p style={{ fontSize: '13px', color: '#666', marginBottom: '12px' }}>
                        {t('domain_dns_config_desc')}
                      </p>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                        <tbody>
                          <tr>
                            <td style={{ padding: '6px 12px', border: '1px solid #f0f0f0', fontWeight: 500, backgroundColor: '#fff' }}>
                              {t('domain_dns_type')}
                            </td>
                            <td style={{ padding: '6px 12px', border: '1px solid #f0f0f0', backgroundColor: '#fff', fontFamily: 'monospace' }}>
                              CNAME
                            </td>
                          </tr>
                          <tr>
                            <td style={{ padding: '6px 12px', border: '1px solid #f0f0f0', fontWeight: 500, backgroundColor: '#fff' }}>
                              {t('domain_dns_name')}
                            </td>
                            <td style={{ padding: '6px 12px', border: '1px solid #f0f0f0', backgroundColor: '#fff', fontFamily: 'monospace' }}>
                              {domainBindForm.domain.split('.')[0] || '@'}
                            </td>
                          </tr>
                          <tr>
                            <td style={{ padding: '6px 12px', border: '1px solid #f0f0f0', fontWeight: 500, backgroundColor: '#fff' }}>
                              {t('domain_dns_value')}
                            </td>
                            <td style={{ padding: '6px 12px', border: '1px solid #f0f0f0', backgroundColor: '#fff', fontFamily: 'monospace' }}>
                              zygonlinechat.zygmail.icu
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginTop: '24px' }}>
                  <button type="button" onClick={handleDomainModalPrev} style={buttonStyle('default')}>
                    <ChevronLeft size={16} /> {t('domain_step_prev')}
                  </button>
                  <button
                    type="button"
                    onClick={handleDomainModalNext}
                    style={buttonStyle('primary')}
                    disabled={formLoading}
                  >
                    {formLoading ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      t('domain_step_bind')
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Binding Complete */}
            {domainBindForm.step === 3 && domainBindResult && (
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <div style={{
                  width: '64px', height: '64px', borderRadius: '50%',
                  backgroundColor: '#f6ffed', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', margin: '0 auto 16px',
                }}>
                  <Check size={32} color="#52c41a" />
                </div>
                <h3 style={{ fontSize: '18px', fontWeight: 500, marginBottom: '8px' }}>
                  {t('domain_bind_result_title')}
                </h3>
                <p style={{ fontSize: '14px', color: '#666', marginBottom: '16px' }}>
                  {domainBindResult.domain || domainBindForm.domain}
                </p>

                <div style={{
                  backgroundColor: '#f9f9f9', borderRadius: '8px',
                  padding: '16px', marginBottom: '20px', textAlign: 'left',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '13px', color: '#666' }}>{t('domain_bind_result_dns')}</span>
                    <span style={statusBadgeStyle('active')}>{t('domain_active')}</span>
                  </div>
                  {domainBindResult.dnsRecord && (
                    <div style={{ fontSize: '12px', color: '#999', padding: '8px', backgroundColor: '#fff', borderRadius: '4px', fontFamily: 'monospace' }}>
                      {domainBindResult.dnsRecord.type} {domainBindResult.dnsRecord.name} → {domainBindResult.dnsRecord.value}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
                  <button
                    type="button"
                    onClick={() => handleCopyLink(`https://${domainBindResult.domain || domainBindForm.domain}`)}
                    style={buttonStyle('default')}
                  >
                    <Copy size={14} /> {t('copy_link')}
                  </button>
                  <button
                    type="button"
                    onClick={handleCloseDomainModal}
                    style={buttonStyle('primary')}
                  >
                    {t('domain_step_finish')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 🔷 Domain Detach Confirmation Modal */}
      {domainDetachConfirm !== null && (
        <div style={modalOverlayStyle} onClick={() => setDomainDetachConfirm(null)}>
          <div style={{ ...modalStyle, maxWidth: '400px' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <AlertCircle size={48} color="#faad14" style={{ marginBottom: '16px' }} />
              <h3 style={{ fontSize: '16px', fontWeight: 500, marginBottom: '8px' }}>{t('detach_domain')}</h3>
              <p style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>
                <strong>{domainDetachConfirm.domain}</strong>
              </p>
              <p style={{ fontSize: '14px', color: '#666', marginBottom: '24px' }}>{t('detach_domain_confirm')}</p>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
                <button onClick={() => setDomainDetachConfirm(null)} style={buttonStyle('default')}>
                  {t('cancel')}
                </button>
                <button
                  onClick={() => handleDetachDomain(domainDetachConfirm)}
                  style={buttonStyle('danger')}
                  disabled={formLoading}
                >
                  {formLoading ? <Loader2 size={14} className="animate-spin" /> : t('detach_domain')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
