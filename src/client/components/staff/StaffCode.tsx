import { useState, useEffect } from 'react';
import { Copy, Check, Link, Code2 } from 'lucide-react';

interface BusinessInfo {
  id: number;
  business_name: string;
  business_slug: string;
  lang: string;
  created_at: number;
  updated_at: number;
}

export function StaffCode() {
  const [business, setBusiness] = useState<BusinessInfo | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBusiness();
  }, []);

  const fetchBusiness = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/business/info', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('staff_token')}`,
        },
      });
      const result = await response.json();
      if (result.success) {
        setBusiness(result.data);
      } else {
        console.error('Failed to fetch business:', result.error);
      }
    } catch (error) {
      console.error('Failed to fetch business:', error);
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

  const embedCode = `<script>
(function() {
  var script = document.createElement('script');
  script.src = '${currentDomain}/embed/chat.js';
  script.async = true;
  script.dataset.business = '${business?.business_slug || 'default'}';
  document.head.appendChild(script);
})();
</script>`;

  const directLink = `${currentDomain}/chat?business=${business?.business_slug || 'default'}`;

  const iframeCode = `<iframe 
  src="${currentDomain}/chat?business=${business?.business_slug || 'default'}" 
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
        <p style={{ color: '#6b7280' }}>加载中...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', height: '100%', overflowY: 'auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 500, margin: 0 }}>客服代码</h2>
        <p style={{ color: '#999', fontSize: '14px', marginTop: '8px' }}>
          以下是您的客服访问链接和嵌入代码
        </p>
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
            {business?.business_name?.charAt(0) || '商'}
          </div>
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: 500, margin: 0 }}>{business?.business_name || '默认商家'}</h3>
            <p style={{ color: '#999', fontSize: '14px', margin: '4px 0 0' }}>
              商家标识: {business?.business_slug || 'default'}
            </p>
          </div>
        </div>
      </div>

      {/* Direct Link */}
      <div style={{ backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: '24px' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Link size={18} style={{ color: '#1890ff' }} />
          <h3 style={{ fontSize: '16px', fontWeight: 500, margin: 0 }}>直接访问链接</h3>
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
              {copied === 'direct' ? '已复制' : '复制'}
            </button>
          </div>
          <p style={{ color: '#999', fontSize: '14px', marginTop: '12px' }}>
            访客可以通过此链接直接访问客服聊天页面
          </p>
        </div>
      </div>

      {/* Embed Script */}
      <div style={{ backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: '24px' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Code2 size={18} style={{ color: '#1890ff' }} />
          <h3 style={{ fontSize: '16px', fontWeight: 500, margin: 0 }}>内嵌脚本代码</h3>
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
            {copied === 'script' ? '已复制' : '复制代码'}
          </button>
          <p style={{ color: '#999', fontSize: '14px', marginTop: '12px' }}>
            将此脚本添加到您的网站页面中，访客点击即可打开客服聊天窗口
          </p>
        </div>
      </div>

      {/* Iframe Code */}
      <div style={{ backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Code2 size={18} style={{ color: '#1890ff' }} />
          <h3 style={{ fontSize: '16px', fontWeight: 500, margin: 0 }}>iframe 嵌入代码</h3>
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
            {copied === 'iframe' ? '已复制' : '复制代码'}
          </button>
          <p style={{ color: '#999', fontSize: '14px', marginTop: '12px' }}>
            使用 iframe 将客服聊天窗口嵌入到您的网站中，可自定义宽高
          </p>
        </div>
      </div>
    </div>
  );
}