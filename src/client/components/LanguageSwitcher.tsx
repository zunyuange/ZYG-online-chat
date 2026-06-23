/**
 * LanguageSwitcher - 紧凑下拉式语言切换器
 * 点击按钮显示当前语言，弹出下拉菜单选择其他语言
 * 公共组件，HomePage 和 DocsPage 共享
 */
import { useState } from 'react';
import { useI18n } from '@client/context/I18nContext';
import { Globe } from 'lucide-react';

export function LanguageSwitcher() {
  const { locale, setLocale, supportedLocales } = useI18n();
  const [open, setOpen] = useState(false);

  const currentLocale = supportedLocales.find((l) => l.code === locale);

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '6px 14px',
          border: '1px solid rgba(255,255,255,0.3)',
          borderRadius: '6px',
          backgroundColor: open ? 'rgba(255,255,255,0.15)' : 'transparent',
          color: '#fff',
          cursor: 'pointer',
          fontSize: '13px',
          transition: 'all 0.2s',
        }}
      >
        <Globe size={14} />
        {currentLocale?.nativeName || locale}
        <span style={{ fontSize: '10px', marginLeft: '2px' }}>▾</span>
      </button>
      {open && (
        <>
          {/* 点击外部关闭遮罩 */}
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 99,
            }}
            onClick={() => setOpen(false)}
          />
          {/* 下拉菜单 */}
          <div
            style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              marginTop: '4px',
              backgroundColor: '#fff',
              borderRadius: '8px',
              boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
              minWidth: '200px',
              maxHeight: '320px',
              overflowY: 'auto',
              zIndex: 100,
            }}
          >
            {supportedLocales.map((l) => (
              <button
                key={l.code}
                onClick={() => {
                  setLocale(l.code);
                  setOpen(false);
                }}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '10px 16px',
                  border: 'none',
                  backgroundColor: locale === l.code ? '#e6f7ff' : 'transparent',
                  color: locale === l.code ? '#1890ff' : '#333',
                  cursor: 'pointer',
                  fontSize: '13px',
                  textAlign: 'left',
                  fontWeight: locale === l.code ? 600 : 400,
                  transition: 'background-color 0.15s',
                }}
                onMouseEnter={(e) => {
                  if (locale !== l.code) {
                    (e.target as HTMLButtonElement).style.backgroundColor = '#f5f5f5';
                  }
                }}
                onMouseLeave={(e) => {
                  if (locale !== l.code) {
                    (e.target as HTMLButtonElement).style.backgroundColor = 'transparent';
                  }
                }}
              >
                <span>{l.nativeName}</span>
                <span style={{ marginLeft: '8px', fontSize: '11px', color: '#999' }}>{l.name}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
