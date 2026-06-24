import { useState, useEffect } from 'react';
import { X, Gift, Sparkles, Clock, Users, PartyPopper } from 'lucide-react';
import { useI18n } from '@client/context/I18nContext';
import type { Activity, ActivityPrize, ActivityWinner } from '@shared/types';

interface LotteryModalProps {
  activity: Activity;
  visitorId: string;
  visitorName?: string;
  sessionId?: string;
  onClose: () => void;
}

export function LotteryModal({ activity, visitorId, visitorName, sessionId, onClose }: LotteryModalProps) {
  const { t } = useI18n();
  const [prizes, setPrizes] = useState<ActivityPrize[]>([]);
  const [canParticipate, setCanParticipate] = useState<boolean>(true);
  const [message, setMessage] = useState('');
  const [isDrawing, setIsDrawing] = useState(false);
  const [winnerResult, setWinnerResult] = useState<ActivityWinner | null>(null);
  const [showResult, setShowResult] = useState(false);

  useEffect(() => {
    fetchPrizes();
    checkParticipate();
  }, []);

  const fetchPrizes = async () => {
    try {
      const response = await fetch(`/api/activity/activities/${activity.id}/prizes`);
      const result = await response.json();
      if (result.success) {
        setPrizes(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch prizes:', error);
    }
  };

  const checkParticipate = async () => {
    try {
      const response = await fetch(`/api/activity/activities/${activity.id}/can-participate?visitorId=${visitorId}`);
      const result = await response.json();
      if (result.success) {
        setCanParticipate(result.data.canParticipate);
        if (!result.data.canParticipate) {
          setMessage(result.data.message || t('cannot_participate'));
        }
      }
    } catch (error) {
      console.error('Failed to check participation:', error);
    }
  };

  const handleDraw = async () => {
    if (isDrawing || !canParticipate) return;

    setIsDrawing(true);
    setShowResult(false);
    setWinnerResult(null);

    try {
      const response = await fetch(`/api/activity/activities/${activity.id}/draw`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          visitorId,
          visitorName,
          sessionId,
        }),
      });
      const result = await response.json();
      if (result.success) {
        setWinnerResult(result.data);
        setTimeout(() => {
          setShowResult(true);
          setIsDrawing(false);
        }, 3000);
      } else {
        setMessage(result.error);
        setIsDrawing(false);
      }
    } catch (error) {
      setMessage(t('operation_failed'));
      setIsDrawing(false);
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleString(navigator.language || 'zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0,0,0,0.6)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px',
    }}>
      <div style={{
        backgroundColor: '#fff',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '420px',
        maxHeight: '80vh',
        overflowY: 'auto',
        position: 'relative',
      }}>
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            padding: '8px',
            border: 'none',
            backgroundColor: 'transparent',
            cursor: 'pointer',
            color: '#999',
            zIndex: 10,
          }}
        >
          <X size={24} />
        </button>

        <div style={{
          background: 'linear-gradient(135deg, #ff6b6b 0%, #feca57 100%)',
          padding: '32px 24px',
          textAlign: 'center',
          borderRadius: '16px 16px 0 0',
        }}>
          <div style={{
            width: '80px',
            height: '80px',
            margin: '0 auto 16px',
            backgroundColor: 'rgba(255,255,255,0.3)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <PartyPopper size={48} color="#fff" />
          </div>
          <h2 style={{ fontSize: '24px', fontWeight: 600, color: '#fff', margin: '0 0 8px' }}>
            {activity.title}
          </h2>
          {activity.description && (
            <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.9)', margin: 0 }}>
              {activity.description}
            </p>
          )}
        </div>

        <div style={{ padding: '24px' }}>
          <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
            <div style={{ flex: 1, textAlign: 'center', padding: '12px', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
              <Clock size={20} style={{ margin: '0 auto 8px', color: '#1890ff' }} />
              <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>{t('activity_time')}</div>
              <div style={{ fontSize: '11px', color: '#999' }}>
                {formatDate(activity.startTime)}
              </div>
            </div>
            <div style={{ flex: 1, textAlign: 'center', padding: '12px', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
              <Users size={20} style={{ margin: '0 auto 8px', color: '#52c41a' }} />
              <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>{t('activity_participants')}</div>
              <div style={{ fontSize: '11px', color: '#999' }}>
                {activity.participantsCount}
                {activity.maxParticipants > 0 && <span>/{activity.maxParticipants}</span>}
              </div>
            </div>
          </div>

          {message && (
            <div style={{
              padding: '12px',
              borderRadius: '8px',
              marginBottom: '16px',
              backgroundColor: '#fff2f0',
              color: '#ff4d4f',
              fontSize: '14px',
              textAlign: 'center',
            }}>
              {message}
            </div>
          )}

          <div style={{ marginBottom: '24px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 500, margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Gift size={18} color="#ff6b6b" />
              {t('activity_prizes')}
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
              {prizes.map((prize) => (
                <div key={prize.id} style={{
                  padding: '12px',
                  border: '1px solid #e8e8e8',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                }}>
                  <div style={{
                    width: '48px',
                    height: '48px',
                    backgroundColor: '#fff7e6',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <Gift size={24} color={prize.isEmpty ? '#999' : '#ff6b6b'} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '14px', fontWeight: 500, marginBottom: '4px' }}>
                      {prize.isEmpty ? t('prize_empty') : prize.name}
                    </div>
                    <div style={{ fontSize: '12px', color: '#999' }}>
                      {t('prize_remaining')}: {prize.remainingQuantity}/{prize.quantity}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {!showResult ? (
            <button
              onClick={handleDraw}
              disabled={!canParticipate || isDrawing}
              style={{
                width: '100%',
                padding: '16px',
                backgroundColor: !canParticipate ? '#d9d9d9' : isDrawing ? '#ffc107' : '#ff6b6b',
                color: '#fff',
                border: 'none',
                borderRadius: '12px',
                fontSize: '18px',
                fontWeight: 600,
                cursor: !canParticipate || isDrawing ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              {isDrawing ? (
                <>
                  <div className="animate-spin" style={{
                    width: '24px',
                    height: '24px',
                    border: '3px solid rgba(255,255,255,0.3)',
                    borderTopColor: '#fff',
                    borderRadius: '50%',
                  }}></div>
                  {t('drawing')}...
                </>
              ) : (
                <>
                  <Sparkles size={24} />
                  {t('activity_draw')}
                </>
              )}
            </button>
          ) : (
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: '120px',
                height: '120px',
                margin: '0 auto 20px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                animation: 'bounce 0.5s ease-in-out',
              }}>
                {winnerResult?.prize?.isEmpty ? (
                  <div style={{
                    width: '100%',
                    height: '100%',
                    backgroundColor: '#f5f5f5',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <Gift size={48} color="#999" />
                  </div>
                ) : (
                  <div style={{
                    width: '100%',
                    height: '100%',
                    background: 'linear-gradient(135deg, #ffd700 0%, #ff8c00 100%)',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 20px rgba(255, 165, 0, 0.4)',
                  }}>
                    <PartyPopper size={56} color="#fff" />
                  </div>
                )}
              </div>
              <h3 style={{ fontSize: '20px', fontWeight: 600, margin: '0 0 8px' }}>
                {winnerResult?.prize?.isEmpty ? t('activity_no_win') : t('activity_win')}
              </h3>
              <p style={{ fontSize: '16px', color: '#666', margin: '0 0 24px' }}>
                {winnerResult?.prize?.isEmpty
                  ? t('activity_no_win_desc')
                  : `${t('activity_win_desc')}: ${winnerResult?.prize?.name}`}
              </p>
              <button
                onClick={onClose}
                style={{
                  width: '100%',
                  padding: '16px',
                  backgroundColor: '#1890ff',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '16px',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                {t('close')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}