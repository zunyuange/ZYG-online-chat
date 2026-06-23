/**
 * PWA Install Prompt Component
 */

import { useState, useEffect } from 'react';
import { useI18n } from '@client/context/I18nContext';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function PWAInstallPrompt() {
  const { t } = useI18n();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  // ★ 从 URL 读取 business 参数，用于动态设置 PWA start_url
  const getBusinessParam = (): string | null => {
    const params = new URLSearchParams(window.location.search);
    return params.get('business');
  };

  useEffect(() => {
    // Check if running as standalone PWA
    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || (window.navigator as any).standalone === true;
    setIsStandalone(standalone);

    // ★ 动态更新 manifest link 的 start_url，确保 PWA 安装时携带商家标识
    const business = getBusinessParam();
    if (business) {
      const manifestLink = document.querySelector('link[rel="manifest"]') as HTMLLinkElement;
      if (manifestLink) {
        // 动态生成包含 business 参数的 manifest URL
        // 浏览器会在安装时使用当前页面的 URL 作为 start_url（覆盖 manifest 中的静态值）
        // 但为了兼容性，我们也通过动态 blob URL 替换 manifest
        try {
          fetch('/manifest.json')
            .then(res => res.json())
            .then(manifest => {
              manifest.start_url = `/chat?business=${encodeURIComponent(business)}`;
              const blob = new Blob([JSON.stringify(manifest)], { type: 'application/json' });
              const blobUrl = URL.createObjectURL(blob);
              manifestLink.href = blobUrl;
              console.log('[PWAInstallPrompt] Updated manifest start_url:', manifest.start_url);
            })
            .catch(() => {
              console.log('[PWAInstallPrompt] Could not fetch manifest.json, using default');
            });
        } catch (e) {
          console.error('[PWAInstallPrompt] Error updating manifest:', e);
        }
      }
    }

    // Check if iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(iOS);

    // Check if already dismissed
    const dismissed = localStorage.getItem('pwa-prompt-dismissed');
    if (dismissed === 'true') return;

    // Listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Show prompt after a delay for non-iOS
    if (!iOS && !standalone && !deferredPrompt) {
      const timer = setTimeout(() => {
        setShowPrompt(true);
      }, 3000);
      return () => clearTimeout(timer);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setShowPrompt(false);
      }
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('pwa-prompt-dismissed', 'true');
  };

  if (isStandalone || !showPrompt) return null;

  const containerStyle: React.CSSProperties = {
    position: 'fixed',
    bottom: '20px',
    left: '50%',
    transform: 'translateX(-50%)',
    backgroundColor: '#fff',
    borderRadius: '12px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
    padding: '16px 20px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    zIndex: 1000,
    maxWidth: '90vw',
  };

  const textStyle: React.CSSProperties = {
    fontSize: '14px',
    color: '#333',
  };

  const buttonStyle: React.CSSProperties = {
    padding: '8px 16px',
    borderRadius: '20px',
    border: 'none',
    fontSize: '14px',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  };

  const primaryButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    backgroundColor: '#1890ff',
    color: '#fff',
  };

  const secondaryButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    backgroundColor: 'transparent',
    color: '#666',
  };

  return (
    <div style={containerStyle}>
      <div style={textStyle}>
        {isIOS ? (
          <>
            {t('pwa_install_prompt')}
          </>
        ) : (
          <>{t('pwa_install_prompt')}</>
        )}
      </div>
      {!isIOS && deferredPrompt && (
        <button style={primaryButtonStyle} onClick={handleInstall}>
          {t('pwa_install')}
        </button>
      )}
      <button style={secondaryButtonStyle} onClick={handleDismiss}>
        {t('pwa_not_now')}
      </button>
    </div>
  );
}