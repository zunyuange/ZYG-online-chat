/**
 * 对接文档页面 - 独立公开页面，所有人可访问
 * 展示如何将在线客服系统接入到自己的网站中
 */
import { useState, useEffect } from 'react';
import { I18nProvider } from '@client/context/I18nContext';
import { useI18n } from '@client/context/I18nContext';
import { Copy, Check, Code2, Link2, Monitor, Smartphone } from 'lucide-react';

function DocsContent() {
  const { t } = useI18n();
  const [copied, setCopied] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'script' | 'iframe' | 'url'>('script');

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
  // ⚠️ 替换为你的商家标识
  script.dataset.business = 'default';
  // 可选：传入自定义参数
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
  title="在线客服">
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

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f7fa' }}>
      {/* Header */}
      <div style={{ backgroundColor: '#001529', color: '#fff', padding: '24px 32px' }}>
        <div style={{ maxWidth: '960px', margin: '0 auto' }}>
          <h1 style={{ margin: '0 0 8px 0', fontSize: '24px', fontWeight: 600 }}>
            📋 对接文档
          </h1>
          <p style={{ margin: 0, fontSize: '14px', color: 'rgba(255,255,255,0.7)' }}>
            将在线客服系统接入到您的网站，支持多种接入方式
          </p>
        </div>
      </div>

      <div style={{ maxWidth: '960px', margin: '0 auto', padding: '32px 24px' }}>
        {/* Quick Start */}
        <div style={{ backgroundColor: '#e6f7ff', border: '1px solid #91d5ff', borderRadius: '8px', padding: '20px', marginBottom: '32px' }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', color: '#0050b3' }}>🚀 快速开始</h3>
          <ol style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: '#333', lineHeight: '2' }}>
            <li>登录客服工作台，进入 <strong>代码</strong> 页面获取您的专属接入代码</li>
            <li>将代码粘贴到您网站的 HTML 页面中</li>
            <li>部署后，访客即可在您的网站上使用在线客服功能</li>
          </ol>
        </div>

        {/* Integration Methods */}
        <h2 style={{ fontSize: '20px', fontWeight: 600, margin: '0 0 16px 0', color: '#333' }}>接入方式</h2>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '2px solid #e8e8e8', marginBottom: '24px' }}>
          {[
            { key: 'script', label: '脚本嵌入', icon: <Code2 size={16} /> },
            { key: 'iframe', label: 'iframe 嵌入', icon: <Monitor size={16} /> },
            { key: 'url', label: '直接链接', icon: <Link2 size={16} /> },
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
              <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: 500 }}>方法一：JavaScript 脚本嵌入</h3>
              <p style={{ fontSize: '14px', color: '#666', marginBottom: '16px', lineHeight: '1.8' }}>
                将以下代码添加到您网站的 <code style={{ backgroundColor: '#f0f0f0', padding: '2px 6px', borderRadius: '3px' }}>&lt;head&gt;</code> 或 <code style={{ backgroundColor: '#f0f0f0', padding: '2px 6px', borderRadius: '3px' }}>&lt;body&gt;</code> 标签中，
                页面加载后会自动在右下角显示客服按钮。
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
                  {copied === 'script' ? '已复制' : '复制'}
                </button>
              </div>
            </div>

            <div style={{ backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', padding: '24px' }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 500 }}>📌 可选参数说明</h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#fafafa', borderBottom: '2px solid #e8e8e8' }}>
                      <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 500, color: '#666' }}>参数</th>
                      <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 500, color: '#666' }}>类型</th>
                      <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 500, color: '#666' }}>必填</th>
                      <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 500, color: '#666' }}>说明</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { param: 'data-business', type: 'string', required: '是', desc: '商家标识（slug），用于区分不同商家' },
                      { param: 'data-userName', type: 'string', required: '否', desc: '访客姓名，不传则使用默认名称' },
                      { param: 'data-email', type: 'string', required: '否', desc: '访客邮箱' },
                      { param: 'data-phone', type: 'string', required: '否', desc: '访客手机号' },
                      { param: 'data-pid', type: 'string', required: '否', desc: '跨系统用户唯一标识' },
                      { param: 'data-params', type: 'JSON', required: '否', desc: '自定义参数（JSON字符串）' },
                      { param: 'data-lang', type: 'string', required: '否', desc: '语言偏好（zh-CN / en-US）' },
                    ].map((row, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f0f0f0' }}>
                        <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontSize: '13px', color: '#c41d7f' }}>{row.param}</td>
                        <td style={{ padding: '10px 16px', color: '#666' }}>{row.type}</td>
                        <td style={{ padding: '10px 16px', color: row.required === '是' ? '#ff4d4f' : '#52c41a' }}>{row.required}</td>
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
              <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: 500 }}>方法二：iframe 嵌入</h3>
              <p style={{ fontSize: '14px', color: '#666', marginBottom: '16px', lineHeight: '1.8' }}>
                使用 iframe 将客服窗口直接嵌入到页面中，可自定义宽高和位置。适合需要在页面固定位置展示客服窗口的场景。
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
                  {copied === 'iframe' ? '已复制' : '复制'}
                </button>
              </div>
            </div>

            <div style={{ backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', padding: '24px' }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 500 }}>📌 URL 参数说明</h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#fafafa', borderBottom: '2px solid #e8e8e8' }}>
                      <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 500, color: '#666' }}>参数</th>
                      <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 500, color: '#666' }}>类型</th>
                      <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 500, color: '#666' }}>必填</th>
                      <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 500, color: '#666' }}>说明</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { param: 'business', type: 'string', required: '是', desc: '商家标识（slug）' },
                      { param: 'userName', type: 'string', required: '否', desc: '访客姓名' },
                      { param: 'email', type: 'string', required: '否', desc: '访客邮箱' },
                      { param: 'phone', type: 'string', required: '否', desc: '访客手机号' },
                      { param: 'pid', type: 'string', required: '否', desc: '跨系统用户唯一标识' },
                      { param: 'params', type: 'JSON', required: '否', desc: '自定义参数（JSON字符串）' },
                      { param: 'lang', type: 'string', required: '否', desc: '语言偏好（zh-CN / en-US）' },
                    ].map((row, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f0f0f0' }}>
                        <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontSize: '13px', color: '#c41d7f' }}>{row.param}</td>
                        <td style={{ padding: '10px 16px', color: '#666' }}>{row.type}</td>
                        <td style={{ padding: '10px 16px', color: row.required === '是' ? '#ff4d4f' : '#52c41a' }}>{row.required}</td>
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
              <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: 500 }}>方法三：直接链接</h3>
              <p style={{ fontSize: '14px', color: '#666', marginBottom: '16px', lineHeight: '1.8' }}>
                直接使用 URL 链接打开客服页面，适合在按钮、菜单等位置添加客服入口。
              </p>

              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '16px' }}>
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
                  {copied === 'url' ? '已复制' : '复制'}
                </button>
              </div>
            </div>

            <div style={{ backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', padding: '24px', marginBottom: '24px' }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: 500 }}>📌 完整示例</h3>
              <p style={{ fontSize: '14px', color: '#666', marginBottom: '16px' }}>
                带所有可选参数的完整链接示例：
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
                  {copied === 'fullUrl' ? '已复制' : '复制'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* API Reference */}
        <h2 style={{ fontSize: '20px', fontWeight: 600, margin: '32px 0 16px 0', color: '#333' }}>后端 API 参考</h2>

        <div style={{ backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', padding: '24px' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
              <thead>
                <tr style={{ backgroundColor: '#fafafa', borderBottom: '2px solid #e8e8e8' }}>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 500, color: '#666' }}>接口</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 500, color: '#666' }}>方法</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 500, color: '#666' }}>说明</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { path: '/api/chat/session', method: 'POST', desc: '创建/获取会话，传入访客信息' },
                  { path: '/api/chat/session/:id/messages', method: 'GET', desc: '获取会话消息列表' },
                  { path: '/api/chat/session/:id/messages', method: 'POST', desc: '发送消息' },
                  { path: '/api/chat/stats', method: 'GET', desc: '获取统计信息（需认证）' },
                  { path: '/api/site-settings', method: 'GET', desc: '获取站点配置（公开）' },
                ].map((row, i) => (
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
          <p>在线客服系统 - 对接文档</p>
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
