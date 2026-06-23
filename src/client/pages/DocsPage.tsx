/**
 * 对接文档页面 - 独立公开页面，所有人可访问
 * 展示如何将CF智能多语言在线客服系统接入到自己的网站中
 */
import { useState, useEffect } from 'react';
import { I18nProvider } from '@client/context/I18nContext';
import { useI18n } from '@client/context/I18nContext';
import { LanguageSwitcher } from '@client/components/LanguageSwitcher';
import { Copy, Check, Code2, Link2, Monitor, Globe } from 'lucide-react';

function DocsContent() {
  const { t, supportedLocales } = useI18n();
  const [copied, setCopied] = useState<string | null>(null);
  const [copiedLang, setCopiedLang] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'script' | 'iframe' | 'url'>('script');
  const [showLangCodes, setShowLangCodes] = useState(false);

  const currentDomain = typeof window !== 'undefined' ? window.location.origin : 'https://zyg-online-chat.linzihai.workers.dev';

  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(type);
      setTimeout(() => setCopied(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const scriptCode = `<script>
(function() {
  var script = document.createElement('script');
  script.src = '${currentDomain}/embed/chat.js';
  script.async = true;
  // ⚠️ ${t('docs_code_replace_business')}
  script.dataset.business = 'default';
  // ${t('docs_code_optional_params')}
  // script.dataset.userName = '用户名';
  // script.dataset.email = 'user@example.com';
  // script.dataset.phone = '13800138000';
  document.head.appendChild(script);
})();
<\/script>`;

  const iframeCode = `<iframe
  src="${currentDomain}/chat?business=default"
  width="400"
  height="560"
  frameborder="0"
  style="border-radius: 8px; box-shadow: 0 2px 12px rgba(0,0,0,0.1);"
  title="${t('online_service')}">
</iframe>`;

  const directUrl = `${currentDomain}/chat?business=default`;

  // Override global overflow:hidden to allow scrolling on docs page
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const root = document.getElementById('root');

    const prevHtml = html.style.overflow;
    const prevBody = body.style.overflow;
    const prevRoot = root?.style.overflow;

    html.style.overflow = 'auto';
    body.style.overflow = 'auto';
    if (root) root.style.overflow = 'auto';

    return () => {
      html.style.overflow = prevHtml;
      body.style.overflow = prevBody;
      if (root) root.style.overflow = prevRoot || '';
    };
  }, []);

  // Script embed parameter table data
  const scriptParams = [
    { param: 'data-business', type: 'string', required: t('docs_required_yes'), desc: t('docs_script_param_business_desc') },
    { param: 'data-userName', type: 'string', required: t('docs_required_no'), desc: t('docs_script_param_userName_desc') },
    { param: 'data-email', type: 'string', required: t('docs_required_no'), desc: t('docs_script_param_email_desc') },
    { param: 'data-phone', type: 'string', required: t('docs_required_no'), desc: t('docs_script_param_phone_desc') },
    { param: 'data-pid', type: 'string', required: t('docs_required_no'), desc: t('docs_script_param_pid_desc') },
    { param: 'data-params', type: 'JSON', required: t('docs_required_no'), desc: t('docs_script_param_params_desc') },
    { param: 'data-lang', type: 'string', required: t('docs_required_no'), desc: t('docs_script_param_lang_desc') },
  ];

  // URL parameter table data
  const urlParamsIframe = [
    { param: 'business', type: 'string', required: t('docs_required_yes'), desc: t('docs_iframe_param_business_desc') },
    { param: 'userName', type: 'string', required: t('docs_required_no'), desc: t('docs_iframe_param_userName_desc') },
    { param: 'email', type: 'string', required: t('docs_required_no'), desc: t('docs_iframe_param_email_desc') },
    { param: 'phone', type: 'string', required: t('docs_required_no'), desc: t('docs_iframe_param_phone_desc') },
    { param: 'pid', type: 'string', required: t('docs_required_no'), desc: t('docs_iframe_param_pid_desc') },
    { param: 'params', type: 'JSON', required: t('docs_required_no'), desc: t('docs_iframe_param_params_desc') },
    { param: 'lang', type: 'string', required: t('docs_required_no'), desc: t('docs_iframe_param_lang_desc') },
  ];

  const urlParamsTable = [
    { param: 'business', example: 'default', required: t('docs_required_yes'), desc: t('docs_url_param_business_desc') },
    { param: 'userName', example: '张三', required: t('docs_required_no'), desc: t('docs_url_param_userName_desc') },
    { param: 'email', example: 'zhangsan@example.com', required: t('docs_required_no'), desc: t('docs_url_param_email_desc') },
    { param: 'phone', example: '13800138000', required: t('docs_required_no'), desc: t('docs_url_param_phone_desc') },
    { param: 'pid', example: 'user123', required: t('docs_required_no'), desc: t('docs_url_param_pid_desc') },
    { param: 'params', example: '{"source":"website","level":"vip"}', required: t('docs_required_no'), desc: t('docs_url_param_params_desc') },
    { param: 'lang', example: 'zh-CN', required: t('docs_required_no'), desc: t('docs_url_param_lang_desc') },
  ];

  // API reference table data
  const apiRefs = [
    { path: '/api/chat/session', method: 'POST', desc: t('docs_api_session_desc') },
    { path: '/api/chat/session/:id/messages', method: 'GET', desc: t('docs_api_messages_get_desc') },
    { path: '/api/chat/session/:id/messages', method: 'POST', desc: t('docs_api_messages_post_desc') },
    { path: '/api/chat/stats', method: 'GET', desc: t('docs_api_stats_desc') },
    { path: '/api/site-settings', method: 'GET', desc: t('docs_api_site_settings_desc') },
  ];

  const getJsCodeText = () => `// ${t('docs_code_base_config')}
const BASE_URL = '${currentDomain}/chat';
const BUSINESS = 'default'; // ${t('docs_code_replace_business')}

// ${t('docs_code_user_info')}
const user = {
  userName: '张三',
  email: 'zhangsan@example.com',
  phone: '13800138000',
  pid: 'user123',
};

// ${t('docs_code_custom_params')}
const customParams = {
  source: 'website',
  level: 'vip',
  page: window.location.pathname,
};

// ${t('docs_code_build_url')}
const params = new URLSearchParams();
params.set('business', BUSINESS);
if (user.userName) params.set('userName', user.userName);
if (user.email) params.set('email', user.email);
if (user.phone) params.set('phone', user.phone);
if (user.pid) params.set('pid', user.pid);
params.set('params', JSON.stringify(customParams));
params.set('lang', 'zh-CN');

const chatUrl = \`\${BASE_URL}?\${params.toString()}\`;

// ${t('docs_code_usage_jump_link')}
// <a href={chatUrl}>${t('docs_code_contact_service')}</a>

// ${t('docs_code_usage_button_click')}
document.getElementById('chatBtn').addEventListener('click', () => {
  window.open(chatUrl, '_blank', 'width=400,height=560');
});`;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f7fa' }}>
      {/* Header */}
      <div style={{ backgroundColor: '#001529', color: '#fff', padding: '24px 32px' }}>
        <div style={{ maxWidth: '960px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ margin: '0 0 8px 0', fontSize: '24px', fontWeight: 600 }}>
              📋 {t('docs_title')}
            </h1>
            <p style={{ margin: 0, fontSize: '14px', color: 'rgba(255,255,255,0.7)' }}>
              {t('docs_subtitle')}
            </p>
          </div>
          <LanguageSwitcher />
        </div>
      </div>

      <div style={{ maxWidth: '960px', margin: '0 auto', padding: '32px 24px' }}>
        {/* Quick Start */}
        <div style={{ backgroundColor: '#e6f7ff', border: '1px solid #91d5ff', borderRadius: '8px', padding: '20px', marginBottom: '32px' }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', color: '#0050b3' }}>🚀 {t('docs_quick_start')}</h3>
          <ol style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: '#333', lineHeight: '2' }}>
            <li>{t('docs_quick_start_1')}</li>
            <li>{t('docs_quick_start_2')}</li>
            <li>{t('docs_quick_start_3')}</li>
          </ol>
        </div>

        {/* Integration Methods */}
        <h2 style={{ fontSize: '20px', fontWeight: 600, margin: '0 0 16px 0', color: '#333' }}>{t('docs_integration_methods')}</h2>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '2px solid #e8e8e8', marginBottom: '24px' }}>
          {[
            { key: 'script', label: t('docs_tab_script'), icon: <Code2 size={16} /> },
            { key: 'iframe', label: t('docs_tab_iframe'), icon: <Monitor size={16} /> },
            { key: 'url', label: t('docs_tab_url'), icon: <Link2 size={16} /> },
          ].map((tab) => (
            <div
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              style={{
                padding: '12px 24px',
                borderBottom: activeTab === tab.key ? '2px solid #1890ff' : '2px solid transparent',
                color: activeTab === tab.key ? '#1890ff' : '#666',
                fontWeight: activeTab === tab.key ? 600 : 400,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '14px',
                transition: 'all 0.2s',
              }}
            >
              {tab.icon}
              {tab.label}
            </div>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'script' && (
          <div>
            <div style={{ backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', padding: '24px', marginBottom: '24px' }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: 500 }}>{t('docs_method_script_title')}</h3>
              <p style={{ fontSize: '14px', color: '#666', marginBottom: '16px', lineHeight: '1.8' }}>
                {t('docs_method_script_desc')}
              </p>

              <div style={{ position: 'relative' }}>
                <pre style={{
                  backgroundColor: '#1e1e1e',
                  color: '#d4d4d4',
                  padding: '20px',
                  borderRadius: '6px',
                  overflowX: 'auto',
                  fontSize: '13px',
                  lineHeight: '1.8',
                  margin: 0,
                  fontFamily: "'Fira Code', 'Consolas', monospace",
                }}>
                  {scriptCode}
                </pre>
                <button
                  onClick={() => copyToClipboard(scriptCode, 'script')}
                  style={{
                    position: 'absolute',
                    top: '12px',
                    right: '12px',
                    padding: '6px 12px',
                    border: 'none',
                    borderRadius: '4px',
                    backgroundColor: copied === 'script' ? '#52c41a' : 'rgba(255,255,255,0.15)',
                    color: '#fff',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '12px',
                  }}
                >
                  {copied === 'script' ? <Check size={14} /> : <Copy size={14} />}
                  {copied === 'script' ? t('copied') : t('copy')}
                </button>
              </div>
            </div>

            <div style={{ backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', padding: '24px' }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 500 }}>{t('docs_param_table_title')}</h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#fafafa', borderBottom: '2px solid #e8e8e8' }}>
                      <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 500, color: '#666' }}>{t('docs_param_table_header_param')}</th>
                      <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 500, color: '#666' }}>{t('docs_param_table_header_type')}</th>
                      <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 500, color: '#666' }}>{t('docs_param_table_header_required')}</th>
                      <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 500, color: '#666' }}>{t('docs_param_table_header_desc')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scriptParams.map((row, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f0f0f0' }}>
                        <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontSize: '13px', color: '#c41d7f' }}>{row.param}</td>
                        <td style={{ padding: '10px 16px', color: '#666' }}>{row.type}</td>
                        <td style={{ padding: '10px 16px', color: row.required === t('docs_required_yes') ? '#ff4d4f' : '#52c41a' }}>{row.required}</td>
                        <td style={{ padding: '10px 16px', color: '#333' }}>{row.desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'iframe' && (
          <div>
            <div style={{ backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', padding: '24px', marginBottom: '24px' }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: 500 }}>{t('docs_method_iframe_title')}</h3>
              <p style={{ fontSize: '14px', color: '#666', marginBottom: '16px', lineHeight: '1.8' }}>
                {t('docs_method_iframe_desc')}
              </p>

              <div style={{ position: 'relative' }}>
                <pre style={{
                  backgroundColor: '#1e1e1e',
                  color: '#d4d4d4',
                  padding: '20px',
                  borderRadius: '6px',
                  overflowX: 'auto',
                  fontSize: '13px',
                  lineHeight: '1.8',
                  margin: 0,
                  fontFamily: "'Fira Code', 'Consolas', monospace",
                }}>
                  {iframeCode}
                </pre>
                <button
                  onClick={() => copyToClipboard(iframeCode, 'iframe')}
                  style={{
                    position: 'absolute',
                    top: '12px',
                    right: '12px',
                    padding: '6px 12px',
                    border: 'none',
                    borderRadius: '4px',
                    backgroundColor: copied === 'iframe' ? '#52c41a' : 'rgba(255,255,255,0.15)',
                    color: '#fff',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '12px',
                  }}
                >
                  {copied === 'iframe' ? <Check size={14} /> : <Copy size={14} />}
                  {copied === 'iframe' ? t('copied') : t('copy')}
                </button>
              </div>
            </div>

            <div style={{ backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', padding: '24px' }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 500 }}>{t('docs_url_params_title')}</h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#fafafa', borderBottom: '2px solid #e8e8e8' }}>
                      <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 500, color: '#666' }}>{t('docs_param_table_header_param')}</th>
                      <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 500, color: '#666' }}>{t('docs_param_table_header_type')}</th>
                      <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 500, color: '#666' }}>{t('docs_param_table_header_required')}</th>
                      <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 500, color: '#666' }}>{t('docs_param_table_header_desc')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {urlParamsIframe.map((row, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f0f0f0' }}>
                        <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontSize: '13px', color: '#c41d7f' }}>{row.param}</td>
                        <td style={{ padding: '10px 16px', color: '#666' }}>{row.type}</td>
                        <td style={{ padding: '10px 16px', color: row.required === t('docs_required_yes') ? '#ff4d4f' : '#52c41a' }}>{row.required}</td>
                        <td style={{ padding: '10px 16px', color: '#333' }}>{row.desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'url' && (
          <div>
            <div style={{ backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', padding: '24px', marginBottom: '24px' }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: 500 }}>{t('docs_method_url')}</h3>
              <p style={{ fontSize: '14px', color: '#666', marginBottom: '16px', lineHeight: '1.8' }}>
                {t('docs_method_url_desc')}
              </p>

              {/* 基础链接 */}
              <p style={{ fontSize: '14px', fontWeight: 600, color: '#333', marginBottom: '8px' }}>{t('docs_basic_link')}</p>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '24px' }}>
                <code style={{
                  flex: 1,
                  padding: '12px 16px',
                  backgroundColor: '#f5f5f5',
                  border: '1px solid #d9d9d9',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontFamily: 'monospace',
                  wordBreak: 'break-all',
                }}>
                  {directUrl}
                </code>
                <button
                  onClick={() => copyToClipboard(directUrl, 'url')}
                  style={{
                    padding: '10px 20px',
                    border: 'none',
                    borderRadius: '6px',
                    backgroundColor: copied === 'url' ? '#52c41a' : '#1890ff',
                    color: '#fff',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '14px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {copied === 'url' ? <Check size={16} /> : <Copy size={16} />}
                  {copied === 'url' ? t('copied') : t('copy')}
                </button>
              </div>

              {/* URL 结构分解 */}
              <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: 500 }}>{t('docs_url_structure')}</h3>
              <p style={{ fontSize: '14px', color: '#666', marginBottom: '16px', lineHeight: '1.8' }}>
                {t('docs_url_structure_desc')}
              </p>
              <div style={{
                backgroundColor: '#1e1e1e',
                padding: '20px',
                borderRadius: '6px',
                fontSize: '13px',
                fontFamily: "'Fira Code', 'Consolas', monospace",
                lineHeight: '2',
                overflowX: 'auto',
                marginBottom: '20px',
              }}>
                <span style={{ color: '#569cd6' }}>{currentDomain}/chat</span>
                <span style={{ color: '#d4d4d4' }}>?</span>
                <span style={{ color: '#ce9178' }}>business=default</span>
                <span style={{ color: '#d4d4d4' }}>&</span>
                <span style={{ color: '#9cdcfe' }}>userName=张三</span>
                <span style={{ color: '#d4d4d4' }}>&</span>
                <span style={{ color: '#9cdcfe' }}>email=zhangsan@example.com</span>
                <span style={{ color: '#d4d4d4' }}>&</span>
                <span style={{ color: '#9cdcfe' }}>phone=13800138000</span>
                <span style={{ color: '#d4d4d4' }}>&</span>
                <span style={{ color: '#9cdcfe' }}>pid=user123</span>
                <span style={{ color: '#d4d4d4' }}>&</span>
                <span style={{ color: '#b5cea8' }}>params={"{...}"}</span>
                <span style={{ color: '#d4d4d4' }}>&</span>
                <span style={{ color: '#4ec9b0' }}>lang=zh-CN</span>
              </div>
              <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', marginBottom: '24px', fontSize: '12px', color: '#888' }}>
                <span>🔵 <code style={{ color: '#569cd6' }}>{t('docs_url_structure_legend_domain')}</code></span>
                <span>🟠 <code style={{ color: '#ce9178' }}>{t('docs_url_structure_legend_business')}</code></span>
                <span>🟦 <code style={{ color: '#9cdcfe' }}>{t('docs_url_structure_legend_identity')}</code></span>
                <span>🟢 <code style={{ color: '#b5cea8' }}>{t('docs_url_structure_legend_custom')}</code></span>
                <span>🟩 <code style={{ color: '#4ec9b0' }}>{t('docs_url_structure_legend_lang')}</code></span>
              </div>
            </div>

            {/* 可选参数参考表 */}
            <div style={{ backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', padding: '24px', marginBottom: '24px' }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 500 }}>{t('docs_param_table_title')}</h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#fafafa', borderBottom: '2px solid #e8e8e8' }}>
                      <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 500, color: '#666' }}>{t('docs_param_table_header_param_name')}</th>
                      <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 500, color: '#666' }}>{t('docs_param_table_header_example')}</th>
                      <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 500, color: '#666' }}>{t('docs_param_table_header_required')}</th>
                      <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 500, color: '#666' }}>{t('docs_param_table_header_desc')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {urlParamsTable.map((row, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f0f0f0' }}>
                        <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontSize: '13px', color: '#c41d7f' }}>{row.param}</td>
                        <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontSize: '13px', color: '#666' }}>{row.example}</td>
                        <td style={{ padding: '10px 16px', color: row.required === t('docs_required_yes') ? '#ff4d4f' : '#52c41a', fontWeight: 500 }}>{row.required}</td>
                        <td style={{ padding: '10px 16px', color: '#333' }}>{row.desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* URL 拼接教程 */}
            <div style={{ backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', padding: '24px', marginBottom: '24px' }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: 500 }}>{t('docs_url_tutorial')}</h3>
              <p style={{ fontSize: '14px', color: '#666', marginBottom: '16px', lineHeight: '1.8' }}>
                {t('docs_url_tutorial_desc')}
              </p>

              {/* 步骤1：基础链接 */}
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#1890ff', marginBottom: '6px' }}>
                  {t('docs_step1_title')}
                </div>
                <p style={{ fontSize: '13px', color: '#666', margin: '0 0 8px 0' }}>
                  {t('docs_step1_desc')}
                </p>
                <pre style={{
                  backgroundColor: '#f6f8fa',
                  border: '1px solid #e1e4e8',
                  borderRadius: '6px',
                  padding: '12px 16px',
                  fontSize: '13px',
                  fontFamily: "'Fira Code', 'Consolas', monospace",
                  margin: 0,
                  color: '#333',
                  overflowX: 'auto',
                }}>
                  {`${currentDomain}/chat?business=default`}
                </pre>
              </div>

              {/* 步骤2：追加身份参数 */}
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#1890ff', marginBottom: '6px' }}>
                  {t('docs_step2_title')}
                </div>
                <p style={{ fontSize: '13px', color: '#666', margin: '0 0 8px 0' }}>
                  {t('docs_step2_desc')}
                </p>
                <pre style={{
                  backgroundColor: '#f6f8fa',
                  border: '1px solid #e1e4e8',
                  borderRadius: '6px',
                  padding: '12px 16px',
                  fontSize: '13px',
                  fontFamily: "'Fira Code', 'Consolas', monospace",
                  margin: 0,
                  color: '#333',
                  overflowX: 'auto',
                }}>
                  {`${currentDomain}/chat?business=default&userName=张三&pid=user123`}
                </pre>
              </div>

              {/* 步骤3：追加自定义参数 */}
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#1890ff', marginBottom: '6px' }}>
                  {t('docs_step3_title')}
                </div>
                <p style={{ fontSize: '13px', color: '#666', margin: '0 0 8px 0', lineHeight: '1.8' }}>
                  {t('docs_step3_desc')}
                </p>
                <pre style={{
                  backgroundColor: '#f6f8fa',
                  border: '1px solid #e1e4e8',
                  borderRadius: '6px',
                  padding: '12px 16px',
                  fontSize: '13px',
                  fontFamily: "'Fira Code', 'Consolas', monospace",
                  margin: 0,
                  color: '#333',
                  overflowX: 'auto',
                }}>
                  {`${currentDomain}/chat?business=default&userName=张三&pid=user123&params=${encodeURIComponent('{"source":"website","level":"vip"}')}`}
                </pre>
              </div>

              {/* 步骤4：追加语言 */}
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#1890ff', marginBottom: '6px' }}>
                  {t('docs_step4_title')}
                </div>
                <p style={{ fontSize: '13px', color: '#666', margin: '0 0 8px 0' }}>
                  {t('docs_step4_desc')}
                </p>
                <pre style={{
                  backgroundColor: '#f6f8fa',
                  border: '1px solid #e1e4e8',
                  borderRadius: '6px',
                  padding: '12px 16px',
                  fontSize: '13px',
                  fontFamily: "'Fira Code', 'Consolas', monospace",
                  margin: '0 0 12px 0',
                  color: '#333',
                  overflowX: 'auto',
                }}>
                  {`${currentDomain}/chat?business=default&userName=张三&pid=user123&params=${encodeURIComponent('{"source":"website","level":"vip"}')}&lang=zh-CN`}
                </pre>
                
                {/* 查看所有支持的语言代码 */}
                <button
                  onClick={() => setShowLangCodes(!showLangCodes)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 14px',
                    border: '1px solid #d9d9d9',
                    borderRadius: '6px',
                    backgroundColor: '#fff',
                    color: '#1890ff',
                    cursor: 'pointer',
                    fontSize: '13px',
                    transition: 'all 0.2s',
                  }}
                >
                  <Globe size={14} />
                  {showLangCodes ? t('docs_hide_lang_codes') : t('docs_view_all_lang_codes')}
                </button>

                {showLangCodes && (
                  <div style={{
                    marginTop: '12px',
                    backgroundColor: '#fafafa',
                    border: '1px solid #e8e8e8',
                    borderRadius: '8px',
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      padding: '10px 16px',
                      backgroundColor: '#f0f5ff',
                      borderBottom: '1px solid #d6e4ff',
                      fontSize: '13px',
                      fontWeight: 500,
                      color: '#1d39c4',
                    }}>
                      {t('docs_supported_lang_codes')} ({supportedLocales.length})
                    </div>
                    <table style={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      fontSize: '13px',
                    }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid #e8e8e8' }}>
                          <th style={{ padding: '8px 16px', textAlign: 'left', fontWeight: 500, color: '#999', fontSize: '12px' }}>{t('docs_lang_code')}</th>
                          <th style={{ padding: '8px 16px', textAlign: 'left', fontWeight: 500, color: '#999', fontSize: '12px' }}>{t('docs_lang_native_name')}</th>
                          <th style={{ padding: '8px 16px', textAlign: 'left', fontWeight: 500, color: '#999', fontSize: '12px' }}>{t('docs_lang_english_name')}</th>
                          <th style={{ padding: '8px 16px', textAlign: 'center', fontWeight: 500, color: '#999', fontSize: '12px' }}>{t('copy')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {supportedLocales.map((l, i) => {
                          const langUrl = `${currentDomain}/chat?business=default&lang=${l.code}`;
                          const isLangCopied = copiedLang === l.code;
                          return (
                            <tr key={l.code} style={{
                              borderBottom: '1px solid #f0f0f0',
                              backgroundColor: i % 2 === 0 ? '#fff' : '#fafbfc',
                            }}>
                              <td style={{ padding: '8px 16px' }}>
                                <code
                                  onClick={() => {
                                    navigator.clipboard.writeText(langUrl).then(() => {
                                      setCopiedLang(l.code);
                                      setTimeout(() => setCopiedLang(null), 2000);
                                    }).catch(() => {});
                                  }}
                                  title={`${t('copy')}: ${langUrl}`}
                                  style={{
                                    padding: '2px 8px',
                                    backgroundColor: isLangCopied ? '#f6ffed' : '#f0f5ff',
                                    border: isLangCopied ? '1px solid #b7eb8f' : '1px solid transparent',
                                    borderRadius: '4px',
                                    color: isLangCopied ? '#52c41a' : '#c41d7f',
                                    fontSize: '12px',
                                    fontFamily: "'Fira Code', 'Consolas', monospace",
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                  }}
                                >
                                  {l.code}
                                </code>
                              </td>
                              <td style={{ padding: '8px 16px', color: '#333' }}>{l.nativeName}</td>
                              <td style={{ padding: '8px 16px', color: '#666' }}>{l.name}</td>
                              <td style={{ padding: '8px 16px', textAlign: 'center' }}>
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(langUrl).then(() => {
                                      setCopiedLang(l.code);
                                      setTimeout(() => setCopiedLang(null), 2000);
                                    }).catch(() => {});
                                  }}
                                  title={langUrl}
                                  style={{
                                    padding: '4px 10px',
                                    border: 'none',
                                    borderRadius: '4px',
                                    backgroundColor: isLangCopied ? '#52c41a' : '#1890ff',
                                    color: '#fff',
                                    cursor: 'pointer',
                                    fontSize: '11px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    transition: 'all 0.2s',
                                  }}
                                >
                                  {isLangCopied ? <Check size={12} /> : <Copy size={12} />}
                                  {isLangCopied ? t('copied') : t('copy')}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* 完整最终链接 */}
              <div style={{ marginBottom: '0' }}>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#52c41a', marginBottom: '6px' }}>
                  {t('docs_final_url')}
                </div>
                <div style={{ position: 'relative' }}>
                  <pre style={{
                    backgroundColor: '#1e1e1e',
                    color: '#d4d4d4',
                    padding: '20px',
                    borderRadius: '6px',
                    overflowX: 'auto',
                    fontSize: '13px',
                    lineHeight: '1.8',
                    margin: 0,
                    fontFamily: "'Fira Code', 'Consolas', monospace",
                  }}>
{`${directUrl}&userName=张三&email=zhangsan@example.com&phone=13800138000&pid=user123&params={"source":"website","level":"vip"}&lang=zh-CN`}
                  </pre>
                  <button
                    onClick={() => copyToClipboard(`${directUrl}&userName=张三&email=zhangsan@example.com&phone=13800138000&pid=user123&params={"source":"website","level":"vip"}&lang=zh-CN`, 'fullUrl')}
                    style={{
                      position: 'absolute',
                      top: '12px',
                      right: '12px',
                      padding: '6px 12px',
                      border: 'none',
                      borderRadius: '4px',
                      backgroundColor: copied === 'fullUrl' ? '#52c41a' : 'rgba(255,255,255,0.15)',
                      color: '#fff',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '12px',
                    }}
                  >
                    {copied === 'fullUrl' ? <Check size={14} /> : <Copy size={14} />}
                    {copied === 'fullUrl' ? t('copied') : t('copy')}
                  </button>
                </div>
              </div>
            </div>

            {/* JavaScript 代码示例 */}
            <div style={{ backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', padding: '24px', marginBottom: '24px' }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: 500 }}>{t('docs_code_example')}</h3>
              <p style={{ fontSize: '14px', color: '#666', marginBottom: '16px', lineHeight: '1.8' }}>
                {t('docs_code_example_desc')}
              </p>
              <div style={{ position: 'relative' }}>
                <pre style={{
                  backgroundColor: '#1e1e1e',
                  color: '#d4d4d4',
                  padding: '20px',
                  borderRadius: '6px',
                  overflowX: 'auto',
                  fontSize: '13px',
                  lineHeight: '1.8',
                  margin: 0,
                  fontFamily: "'Fira Code', 'Consolas', monospace",
                }}>
                  {getJsCodeText()}
                </pre>
                <button
                  onClick={() => copyToClipboard(getJsCodeText(), 'jsCode')}
                  style={{
                    position: 'absolute',
                    top: '12px',
                    right: '12px',
                    padding: '6px 12px',
                    border: 'none',
                    borderRadius: '4px',
                    backgroundColor: copied === 'jsCode' ? '#52c41a' : 'rgba(255,255,255,0.15)',
                    color: '#fff',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '12px',
                  }}
                >
                  {copied === 'jsCode' ? <Check size={14} /> : <Copy size={14} />}
                  {copied === 'jsCode' ? t('copied') : t('copy')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* API Reference */}
        <h2 style={{ fontSize: '20px', fontWeight: 600, margin: '32px 0 16px 0', color: '#333' }}>{t('docs_api_reference')}</h2>

        <div style={{ backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', padding: '24px' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
              <thead>
                <tr style={{ backgroundColor: '#fafafa', borderBottom: '2px solid #e8e8e8' }}>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 500, color: '#666' }}>{t('docs_api_header_endpoint')}</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 500, color: '#666' }}>{t('docs_api_header_method')}</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 500, color: '#666' }}>{t('docs_api_header_desc')}</th>
                </tr>
              </thead>
              <tbody>
                {apiRefs.map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontSize: '13px', color: '#333' }}>{row.path}</td>
                    <td style={{ padding: '10px 16px' }}>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: '3px',
                        backgroundColor: row.method === 'GET' ? '#e6f7ff' : row.method === 'POST' ? '#f6ffed' : '#fff7e6',
                        color: row.method === 'GET' ? '#1890ff' : row.method === 'POST' ? '#52c41a' : '#fa8c16',
                        fontSize: '12px',
                        fontWeight: 500,
                      }}>
                        {row.method}
                      </span>
                    </td>
                    <td style={{ padding: '10px 16px', color: '#666' }}>{row.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div style={{ marginTop: '48px', paddingTop: '24px', borderTop: '1px solid #e8e8e8', textAlign: 'center', color: '#999', fontSize: '13px' }}>
          <p>{t('docs_footer')}</p>
        </div>
      </div>
    </div>
  );
}

export function DocsPage() {
  return (
    <I18nProvider>
      <DocsContent />
    </I18nProvider>
  );
}
