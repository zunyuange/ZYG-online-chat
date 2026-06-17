import { useState, useEffect } from 'react';
import { Globe, Save, Check, Eye, EyeOff, Building } from 'lucide-react';

interface TranslationSettings {
  enable_auto_trans: boolean;
  bd_trans_appid: string;
  bd_trans_secret: string;
  default_lang: string;
}

interface BusinessInfo {
  business_name: string;
  business_slug: string;
}

export function StaffSettings() {
  const [settings, setSettings] = useState<TranslationSettings>({
    enable_auto_trans: false,
    bd_trans_appid: '',
    bd_trans_secret: '',
    default_lang: 'zh-CN',
  });
  const [businessInfo, setBusinessInfo] = useState<BusinessInfo>({
    business_name: '',
    business_slug: '',
  });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [showSecret, setShowSecret] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const [settingsRes, infoRes] = await Promise.all([
        fetch('/api/business/settings', {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('staff_token')}`,
          },
        }),
        fetch('/api/business/info', {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('staff_token')}`,
          },
        }),
      ]);

      const settingsResult = await settingsRes.json();
      if (settingsResult.success) {
        setSettings(settingsResult.data);
      }

      const infoResult = await infoRes.json();
      if (infoResult.success) {
        setBusinessInfo({
          business_name: infoResult.data.business_name || '',
          business_slug: infoResult.data.business_slug || '',
        });
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAll = async () => {
    try {
      const [settingsRes, infoRes] = await Promise.all([
        fetch('/api/business/settings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('staff_token')}`,
          },
          body: JSON.stringify(settings),
        }),
        fetch('/api/business/info', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('staff_token')}`,
          },
          body: JSON.stringify(businessInfo),
        }),
      ]);

      const settingsResult = await settingsRes.json();
      const infoResult = await infoRes.json();

      if (settingsResult.success && infoResult.success) {
        setMessage('保存成功');
      } else if (settingsResult.success) {
        setMessage('翻译设置保存成功，商家信息保存失败');
      } else if (infoResult.success) {
        setMessage('商家信息保存成功，翻译设置保存失败');
      } else {
        setMessage('保存失败');
      }
      setTimeout(() => setMessage(''), 2000);
    } catch (error) {
      setMessage('保存失败');
      console.error('Failed to save:', error);
    }
  };

  const supportedLanguages = [
    { value: 'zh-CN', label: '简体中文' },
    { value: 'en', label: 'English' },
    { value: 'ja', label: '日本語' },
    { value: 'ko', label: '한국어' },
    { value: 'fr', label: 'Français' },
    { value: 'de', label: 'Deutsch' },
    { value: 'es', label: 'Español' },
    { value: 'ru', label: 'Русский' },
    { value: 'pt', label: 'Português' },
    { value: 'ar', label: 'العربية' },
    { value: 'hi', label: 'हिन्दी' },
    { value: 'th', label: 'ไทย' },
    { value: 'vi', label: 'Tiếng Việt' },
    { value: 'id', label: 'Bahasa Indonesia' },
    { value: 'ms', label: 'Bahasa Malaysia' },
    { value: 'it', label: 'Italiano' },
    { value: 'nl', label: 'Nederlands' },
    { value: 'pl', label: 'Polski' },
    { value: 'tr', label: 'Türkçe' },
    { value: 'sv', label: 'Svenska' },
  ];

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
        <h2 style={{ fontSize: '20px', fontWeight: 500, margin: 0 }}>系统设置</h2>
        <p style={{ color: '#999', fontSize: '14px', marginTop: '8px' }}>
          配置商家信息和翻译API密钥
        </p>
      </div>

      {/* Message */}
      {message && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '4px',
          marginBottom: '24px',
          backgroundColor: message.includes('成功') ? '#f6ffed' : '#fff2f0',
          color: message.includes('成功') ? '#52c41a' : '#ff4d4f',
          fontSize: '14px',
        }}>
          {message}
        </div>
      )}

      {/* Business Info Card */}
      <div style={{ backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Building size={18} style={{ color: '#52c41a' }} />
          <h3 style={{ fontSize: '16px', fontWeight: 500, margin: 0 }}>商家信息</h3>
        </div>

        <div style={{ padding: '24px' }}>
          {/* Business Name */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500 }}>
              商家名称
            </label>
            <input
              type="text"
              value={businessInfo.business_name}
              onChange={(e) => setBusinessInfo({ ...businessInfo, business_name: e.target.value })}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #d9d9d9',
                borderRadius: '4px',
                fontSize: '14px',
                boxSizing: 'border-box',
              }}
              placeholder="请输入商家名称"
            />
          </div>

          {/* Business Slug */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500 }}>
              商家标识
            </label>
            <input
              type="text"
              value={businessInfo.business_slug}
              onChange={(e) => setBusinessInfo({ ...businessInfo, business_slug: e.target.value })}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #d9d9d9',
                borderRadius: '4px',
                fontSize: '14px',
                boxSizing: 'border-box',
                backgroundColor: '#f5f5f5',
              }}
              placeholder="请输入商家标识（英文/数字）"
            />
            <p style={{ fontSize: '12px', color: '#999', marginTop: '6px' }}>
              商家标识用于URL访问，如 https://xxx.workers.dev/chat?business=your-slug
            </p>
          </div>
        </div>
      </div>

      {/* Translation Settings Card */}
      <div style={{ backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginTop: '24px' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Globe size={18} style={{ color: '#1890ff' }} />
          <h3 style={{ fontSize: '16px', fontWeight: 500, margin: 0 }}>翻译设置</h3>
        </div>

        <div style={{ padding: '24px' }}>
          {/* Auto Translate Toggle */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <div>
              <label style={{ fontSize: '14px', fontWeight: 500, display: 'block', marginBottom: '4px' }}>
                自动翻译
              </label>
              <p style={{ fontSize: '13px', color: '#999' }}>
                开启后，访客消息将自动翻译为客服语言
              </p>
            </div>
            <button
              onClick={() => setSettings({ ...settings, enable_auto_trans: !settings.enable_auto_trans })}
              style={{
                width: '48px',
                height: '28px',
                borderRadius: '14px',
                backgroundColor: settings.enable_auto_trans ? '#1890ff' : '#d9d9d9',
                border: 'none',
                cursor: 'pointer',
                position: 'relative',
                transition: 'background-color 0.3s',
              }}
            >
              <div style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                backgroundColor: '#fff',
                position: 'absolute',
                top: '2px',
                left: settings.enable_auto_trans ? '22px' : '2px',
                transition: 'left 0.3s',
              }}></div>
            </button>
          </div>

          {/* Baidu Translate App ID */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500 }}>
              百度翻译 App ID
            </label>
            <input
              type="text"
              value={settings.bd_trans_appid}
              onChange={(e) => setSettings({ ...settings, bd_trans_appid: e.target.value })}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #d9d9d9',
                borderRadius: '4px',
                fontSize: '14px',
                boxSizing: 'border-box',
              }}
              placeholder="请输入百度翻译 App ID"
            />
          </div>

          {/* Baidu Translate Secret Key */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500 }}>
              百度翻译密钥
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showSecret ? 'text' : 'password'}
                value={settings.bd_trans_secret}
                onChange={(e) => setSettings({ ...settings, bd_trans_secret: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  paddingRight: '40px',
                  border: '1px solid #d9d9d9',
                  borderRadius: '4px',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                }}
                placeholder="请输入百度翻译密钥"
              />
              <button
                onClick={() => setShowSecret(!showSecret)}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  border: 'none',
                  backgroundColor: 'transparent',
                  cursor: 'pointer',
                  color: '#999',
                }}
              >
                {showSecret ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Default Language */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500 }}>
              默认语言
            </label>
            <select
              value={settings.default_lang}
              onChange={(e) => setSettings({ ...settings, default_lang: e.target.value })}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #d9d9d9',
                borderRadius: '4px',
                fontSize: '14px',
                boxSizing: 'border-box',
              }}
            >
              {supportedLanguages.map((lang) => (
                <option key={lang.value} value={lang.value}>
                  {lang.label} ({lang.value})
                </option>
              ))}
            </select>
          </div>

          {/* Save Button */}
          <button
            onClick={handleSaveAll}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 24px',
              border: 'none',
              borderRadius: '4px',
              backgroundColor: '#1890ff',
              color: '#fff',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            <Save size={18} />
            保存设置
          </button>
        </div>
      </div>

      {/* Tips Card */}
      <div style={{ backgroundColor: '#fffbe6', borderRadius: '8px', padding: '20px', marginTop: '24px', borderLeft: '4px solid #faad14' }}>
        <h4 style={{ fontSize: '14px', fontWeight: 500, margin: '0 0 8px' }}>获取百度翻译 API 密钥</h4>
        <ol style={{ fontSize: '13px', color: '#666', margin: 0, paddingLeft: '20px' }}>
          <li style={{ marginBottom: '8px' }}>访问 <a href="https://fanyi-api.baidu.com/" target="_blank" rel="noopener noreferrer" style={{ color: '#1890ff' }}>百度翻译开放平台</a></li>
          <li style={{ marginBottom: '8px' }}>注册账号并创建应用</li>
          <li style={{ marginBottom: '8px' }}>获取 App ID 和密钥</li>
          <li>在此页面填写并保存</li>
        </ol>
      </div>
    </div>
  );
}