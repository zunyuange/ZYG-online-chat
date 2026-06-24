import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Play, Square, Trophy, Users, Calendar, Clock } from 'lucide-react';
import { useI18n } from '@client/context/I18nContext';
import type { Activity, ActivityPrize, ActivityWinner, CreateActivityInput, CreatePrizeInput } from '@shared/types';

interface ActivityManagementProps {
  onBack?: () => void;
}

export function ActivityManagement({ onBack }: ActivityManagementProps) {
  const { t } = useI18n();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [prizes, setPrizes] = useState<ActivityPrize[]>([]);
  const [winners, setWinners] = useState<ActivityWinner[]>([]);
  const [activeTab, setActiveTab] = useState<'list' | 'create' | 'prizes' | 'winners'>('list');
  const [formData, setFormData] = useState<CreateActivityInput>({
    title: '',
    description: '',
    type: 'lottery',
    startTime: Date.now() + 3600000,
    endTime: Date.now() + 86400000 * 7,
    maxParticipants: 0,
    dailyLimit: 3,
  });
  const [prizeForm, setPrizeForm] = useState<CreatePrizeInput>({
    activityId: 0,
    name: '',
    imageUrl: '',
    quantity: 1,
    probability: 10,
    sortOrder: 0,
    isEmpty: false,
    isCard: false,
  });
  const [cardCodesText, setCardCodesText] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchActivities();
  }, []);

  useEffect(() => {
    if (selectedActivity) {
      fetchPrizes(selectedActivity.id);
      fetchWinners(selectedActivity.id);
    }
  }, [selectedActivity]);

  const fetchActivities = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/activity/activities', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('staff_token')}`,
        },
      });
      const result = await response.json();
      if (result.success) {
        setActivities(result.data);
      } else {
        console.error('Failed to fetch activities:', result.error);
      }
    } catch (error) {
      console.error('Failed to fetch activities:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPrizes = async (activityId: number) => {
    try {
      const response = await fetch(`/api/activity/activities/${activityId}/prizes`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('staff_token')}`,
        },
      });
      const result = await response.json();
      if (result.success) {
        setPrizes(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch prizes:', error);
    }
  };

  const fetchWinners = async (activityId: number) => {
    try {
      const response = await fetch(`/api/activity/activities/${activityId}/winners`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('staff_token')}`,
        },
      });
      const result = await response.json();
      if (result.success) {
        setWinners(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch winners:', error);
    }
  };

  const handleCreateActivity = async () => {
    if (!formData.title) {
      setMessage(t('activity_title_required'));
      return;
    }
    if (formData.startTime >= formData.endTime) {
      setMessage(t('activity_time_invalid'));
      return;
    }

    try {
      const response = await fetch('/api/activity/activities', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('staff_token')}`,
        },
        body: JSON.stringify(formData),
      });
      const result = await response.json();
      if (result.success) {
        setMessage(t('activity_create_success'));
        setFormData({
          title: '',
          description: '',
          type: 'lottery',
          startTime: Date.now() + 3600000,
          endTime: Date.now() + 86400000 * 7,
          maxParticipants: 0,
          dailyLimit: 3,
        });
        fetchActivities();
        setTimeout(() => setMessage(''), 2000);
      } else {
        setMessage(result.error || t('operation_failed'));
      }
    } catch (error) {
      setMessage(t('operation_failed'));
    }
  };

  const handleUpdateActivity = async (id: number) => {
    try {
      const response = await fetch(`/api/activity/activities/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('staff_token')}`,
        },
        body: JSON.stringify(formData),
      });
      const result = await response.json();
      if (result.success) {
        setMessage(t('activity_update_success'));
        fetchActivities();
        setTimeout(() => setMessage(''), 2000);
      } else {
        setMessage(result.error || t('operation_failed'));
      }
    } catch (error) {
      setMessage(t('operation_failed'));
    }
  };

  const handleDeleteActivity = async (id: number) => {
    if (!confirm(t('activity_delete_confirm'))) return;

    try {
      const response = await fetch(`/api/activity/activities/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('staff_token')}`,
        },
      });
      const result = await response.json();
      if (result.success) {
        fetchActivities();
        if (selectedActivity?.id === id) {
          setSelectedActivity(null);
        }
      } else {
        alert(result.error || t('delete_failed'));
      }
    } catch (error) {
      alert(t('delete_failed'));
    }
  };

  const handleStartActivity = async (id: number) => {
    try {
      const response = await fetch(`/api/activity/activities/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('staff_token')}`,
        },
        body: JSON.stringify({ status: 'active' }),
      });
      const result = await response.json();
      if (result.success) {
        fetchActivities();
      } else {
        alert(result.error || t('operation_failed'));
      }
    } catch (error) {
      alert(t('operation_failed'));
    }
  };

  const handleEndActivity = async (id: number) => {
    if (!confirm(t('activity_end_confirm'))) return;

    try {
      const response = await fetch(`/api/activity/activities/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('staff_token')}`,
        },
        body: JSON.stringify({ status: 'ended' }),
      });
      const result = await response.json();
      if (result.success) {
        fetchActivities();
      } else {
        alert(result.error || t('operation_failed'));
      }
    } catch (error) {
      alert(t('operation_failed'));
    }
  };

  const handleAddPrize = async () => {
    if (!prizeForm.name) {
      setMessage(t('prize_name_required'));
      return;
    }
    if (!selectedActivity) return;

    try {
      const response = await fetch('/api/activity/prizes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('staff_token')}`,
        },
        body: JSON.stringify({ ...prizeForm, activityId: selectedActivity.id }),
      });
      const result = await response.json();
      if (result.success) {
        setMessage(t('prize_add_success'));
        setPrizeForm({
          activityId: selectedActivity.id,
          name: '',
          imageUrl: '',
          quantity: 1,
          probability: 10,
          sortOrder: prizes.length,
          isEmpty: false,
          isCard: false,
        });
        fetchPrizes(selectedActivity.id);
        setTimeout(() => setMessage(''), 2000);
      } else {
        setMessage(result.error || t('operation_failed'));
      }
    } catch (error) {
      setMessage(t('operation_failed'));
    }
  };

  const handleImportCardCodes = async () => {
    if (!cardCodesText.trim()) {
      setMessage(t('prize_card_codes_required'));
      return;
    }

    // 找到最后添加的奖品（卡密奖品）
    const cardPrize = prizes.find(p => p.isCard && p.remainingQuantity > 0);
    if (!cardPrize) {
      setMessage(t('prize_card_prize_required'));
      return;
    }

    const codes = cardCodesText.split('\n').map(code => code.trim()).filter(code => code.length > 0);
    if (codes.length === 0) {
      setMessage(t('prize_card_codes_required'));
      return;
    }

    try {
      const response = await fetch('/api/activity/card-codes/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('staff_token')}`,
        },
        body: JSON.stringify({
          prizeId: cardPrize.id,
          codes: codes,
        }),
      });
      const result = await response.json();
      if (result.success) {
        setMessage(t('prize_import_success', { count: codes.length }));
        setCardCodesText('');
        if (selectedActivity) {
          fetchPrizes(selectedActivity.id);
        }
        setTimeout(() => setMessage(''), 2000);
      } else {
        setMessage(result.error || t('operation_failed'));
      }
    } catch (error) {
      setMessage(t('operation_failed'));
    }
  };

  const handleDeletePrize = async (id: number) => {
    if (!confirm(t('prize_delete_confirm'))) return;

    try {
      const response = await fetch(`/api/activity/prizes/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('staff_token')}`,
        },
      });
      const result = await response.json();
      if (result.success && selectedActivity) {
        fetchPrizes(selectedActivity.id);
      } else {
        alert(result.error || t('delete_failed'));
      }
    } catch (error) {
      alert(t('delete_failed'));
    }
  };

  const formatDate = (date: Date | number) => {
    const d = typeof date === 'number' ? new Date(date) : date;
    return d.toLocaleString(navigator.language || 'zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'draft':
        return t('activity_status_draft');
      case 'active':
        return t('activity_status_active');
      case 'ended':
        return t('activity_status_ended');
      default:
        return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return { bg: '#fff7e6', color: '#d46b08' };
      case 'active':
        return { bg: '#f6ffed', color: '#52c41a' };
      case 'ended':
        return { bg: '#f5f5f5', color: '#999' };
      default:
        return { bg: '#f5f5f5', color: '#666' };
    }
  };

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
      {onBack && (
        <button
          onClick={onBack}
          style={{
            marginBottom: '16px',
            padding: '8px 16px',
            border: 'none',
            backgroundColor: 'transparent',
            cursor: 'pointer',
            color: '#1890ff',
            fontSize: '14px',
          }}
        >
          ← {t('back')}
        </button>
      )}

      {message && (
        <div style={{
          padding: '12px',
          borderRadius: '4px',
          marginBottom: '16px',
          backgroundColor: message.includes(t('success')) ? '#f6ffed' : '#fff2f0',
          color: message.includes(t('success')) ? '#52c41a' : '#ff4d4f',
          fontSize: '14px',
        }}>
          {message}
        </div>
      )}

      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
        <button
          onClick={() => {
            setActiveTab('list');
            setSelectedActivity(null);
          }}
          style={{
            padding: '8px 16px',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px',
            backgroundColor: activeTab === 'list' ? '#1890ff' : '#f5f5f5',
            color: activeTab === 'list' ? '#fff' : '#666',
          }}
        >
          {t('activity_list')}
        </button>
        <button
          onClick={() => setActiveTab('create')}
          style={{
            padding: '8px 16px',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px',
            backgroundColor: activeTab === 'create' ? '#1890ff' : '#f5f5f5',
            color: activeTab === 'create' ? '#fff' : '#666',
          }}
        >
          {t('activity_create')}
        </button>
      </div>

      {activeTab === 'list' && (
        <div style={{ backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <div style={{ padding: '16px', borderBottom: '1px solid #e8e8e8', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 500, margin: 0 }}>{t('activity_list')}</h3>
            <button
              onClick={() => setActiveTab('create')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 12px',
                backgroundColor: '#1890ff',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px',
              }}
            >
              <Plus size={16} />
              {t('activity_add')}
            </button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#fafafa' }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '14px', fontWeight: 500, color: '#666', borderBottom: '1px solid #e8e8e8' }}>{t('activity_title')}</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '14px', fontWeight: 500, color: '#666', borderBottom: '1px solid #e8e8e8' }}>{t('activity_time')}</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '14px', fontWeight: 500, color: '#666', borderBottom: '1px solid #e8e8e8' }}>{t('activity_participants')}</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '14px', fontWeight: 500, color: '#666', borderBottom: '1px solid #e8e8e8' }}>{t('status')}</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '14px', fontWeight: 500, color: '#666', borderBottom: '1px solid #e8e8e8' }}>{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {activities.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: '#999' }}>
                      {t('activity_no_activities')}
                    </td>
                  </tr>
                ) : (
                  activities.map((activity) => (
                    <tr key={activity.id} style={{ borderBottom: '1px solid #e8e8e8' }}>
                      <td style={{ padding: '12px 16px', fontSize: '14px' }}>
                        <button
                          onClick={() => {
                            setSelectedActivity(activity);
                            setActiveTab('prizes');
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#1890ff',
                            cursor: 'pointer',
                            textDecoration: 'underline',
                            fontSize: '14px',
                          }}
                        >
                          {activity.title}
                        </button>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '14px', color: '#666' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Calendar size={14} />
                          <span>{formatDate(activity.startTime)}</span>
                          <span>~</span>
                          <span>{formatDate(activity.endTime)}</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Users size={14} />
                          <span>{activity.participantsCount}</span>
                          {activity.maxParticipants > 0 && (
                            <span style={{ color: '#999' }}>/ {activity.maxParticipants}</span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '12px',
                          backgroundColor: getStatusColor(activity.status).bg,
                          color: getStatusColor(activity.status).color,
                        }}>
                          {getStatusText(activity.status)}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          {activity.status === 'draft' && (
                            <button
                              onClick={() => handleStartActivity(activity.id)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '4px 8px',
                                border: 'none',
                                backgroundColor: '#f6ffed',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                color: '#52c41a',
                                fontSize: '12px',
                              }}
                              title={t('activity_start')}
                            >
                              <Play size={14} />
                              {t('activity_start')}
                            </button>
                          )}
                          {activity.status === 'active' && (
                            <button
                              onClick={() => handleEndActivity(activity.id)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '4px 8px',
                                border: 'none',
                                backgroundColor: '#fff2f0',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                color: '#ff4d4f',
                                fontSize: '12px',
                              }}
                              title={t('activity_end')}
                            >
                              <Square size={14} />
                              {t('activity_end')}
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setSelectedActivity(activity);
                              setFormData({
                                title: activity.title,
                                description: activity.description || '',
                                type: activity.type,
                                startTime: activity.startTime.getTime(),
                                endTime: activity.endTime.getTime(),
                                maxParticipants: activity.maxParticipants,
                                dailyLimit: activity.dailyLimit,
                              });
                              setActiveTab('create');
                            }}
                            style={{
                              padding: '4px 8px',
                              border: 'none',
                              backgroundColor: '#f5f5f5',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              color: '#666',
                            }}
                            title={t('edit')}
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => handleDeleteActivity(activity.id)}
                            style={{
                              padding: '4px 8px',
                              border: 'none',
                              backgroundColor: '#fff2f0',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              color: '#ff4d4f',
                            }}
                            title={t('delete')}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'create' && (
        <div style={{ backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', padding: '24px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 500, marginBottom: '24px' }}>
            {selectedActivity ? t('activity_edit') : t('activity_create')}
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500 }}>{t('activity_title')}</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #d9d9d9',
                  borderRadius: '4px',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                }}
                placeholder={t('activity_title_placeholder')}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500 }}>{t('activity_daily_limit')}</label>
              <input
                type="number"
                min="0"
                value={formData.dailyLimit}
                onChange={(e) => setFormData({ ...formData, dailyLimit: parseInt(e.target.value) || 0 })}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #d9d9d9',
                  borderRadius: '4px',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                }}
                placeholder={t('activity_daily_limit_placeholder')}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500 }}>{t('activity_max_participants')}</label>
              <input
                type="number"
                min="0"
                value={formData.maxParticipants}
                onChange={(e) => setFormData({ ...formData, maxParticipants: parseInt(e.target.value) || 0 })}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #d9d9d9',
                  borderRadius: '4px',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                }}
                placeholder={t('activity_max_participants_placeholder')}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500 }}>{t('activity_start_time')}</label>
              <input
                type="datetime-local"
                value={new Date(formData.startTime).toISOString().slice(0, 16)}
                onChange={(e) => setFormData({ ...formData, startTime: new Date(e.target.value).getTime() })}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #d9d9d9',
                  borderRadius: '4px',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500 }}>{t('activity_end_time')}</label>
              <input
                type="datetime-local"
                value={new Date(formData.endTime).toISOString().slice(0, 16)}
                onChange={(e) => setFormData({ ...formData, endTime: new Date(e.target.value).getTime() })}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #d9d9d9',
                  borderRadius: '4px',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          <div style={{ marginTop: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500 }}>{t('activity_description')}</label>
            <textarea
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #d9d9d9',
                borderRadius: '4px',
                fontSize: '14px',
                boxSizing: 'border-box',
                resize: 'vertical',
              }}
              placeholder={t('activity_description_placeholder')}
            />
          </div>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
            <button
              onClick={() => {
                setActiveTab('list');
                setSelectedActivity(null);
                setMessage('');
              }}
              style={{
                padding: '8px 16px',
                border: '1px solid #d9d9d9',
                borderRadius: '4px',
                backgroundColor: '#fff',
                cursor: 'pointer',
                fontSize: '14px',
              }}
            >
              {t('cancel')}
            </button>
            <button
              onClick={() => {
                if (selectedActivity) {
                  handleUpdateActivity(selectedActivity.id);
                } else {
                  handleCreateActivity();
                }
              }}
              style={{
                padding: '8px 16px',
                border: 'none',
                borderRadius: '4px',
                backgroundColor: '#1890ff',
                color: '#fff',
                cursor: 'pointer',
                fontSize: '14px',
              }}
            >
              {selectedActivity ? t('save') : t('activity_create')}
            </button>
          </div>
        </div>
      )}

      {activeTab === 'prizes' && selectedActivity && (
        <div style={{ backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <div style={{ padding: '16px', borderBottom: '1px solid #e8e8e8', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 500, margin: 0 }}>{selectedActivity.title}</h3>
              <p style={{ fontSize: '14px', color: '#666', margin: '4px 0 0' }}>{t('activity_prizes')}</p>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setActiveTab('winners')}
                style={{
                  padding: '8px 16px',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  backgroundColor: '#f5f5f5',
                  color: '#666',
                }}
              >
                <Users size={14} style={{ display: 'inline', marginRight: '8px' }} />
                {t('activity_winners')} ({winners.length})
              </button>
              <button
                onClick={() => setActiveTab('list')}
                style={{
                  padding: '8px 16px',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  backgroundColor: '#f5f5f5',
                  color: '#666',
                }}
              >
                {t('back')}
              </button>
            </div>
          </div>

          <div style={{ padding: '16px', borderBottom: '1px solid #e8e8e8' }}>
            <h4 style={{ fontSize: '14px', fontWeight: 500, marginBottom: '16px' }}>{t('prize_add')}</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px' }}>
              <input
                type="text"
                value={prizeForm.name}
                onChange={(e) => setPrizeForm({ ...prizeForm, name: e.target.value })}
                style={{
                  padding: '10px 12px',
                  border: '1px solid #d9d9d9',
                  borderRadius: '4px',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                }}
                placeholder={t('prize_name')}
              />
              <input
                type="number"
                min="1"
                value={prizeForm.quantity}
                onChange={(e) => setPrizeForm({ ...prizeForm, quantity: parseInt(e.target.value) || 1 })}
                style={{
                  padding: '10px 12px',
                  border: '1px solid #d9d9d9',
                  borderRadius: '4px',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                }}
                placeholder={t('prize_quantity')}
              />
              <input
                type="number"
                min="0"
                value={prizeForm.probability}
                onChange={(e) => setPrizeForm({ ...prizeForm, probability: parseFloat(e.target.value) || 0 })}
                style={{
                  padding: '10px 12px',
                  border: '1px solid #d9d9d9',
                  borderRadius: '4px',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                }}
                placeholder={t('prize_probability')}
              />
              <button
                onClick={handleAddPrize}
                disabled={!prizeForm.name}
                style={{
                  padding: '10px 12px',
                  border: 'none',
                  borderRadius: '4px',
                  backgroundColor: prizeForm.name ? '#1890ff' : '#ccc',
                  color: '#fff',
                  cursor: prizeForm.name ? 'pointer' : 'not-allowed',
                  fontSize: '14px',
                }}
              >
                <Plus size={16} style={{ display: 'inline', marginRight: '8px' }} />
                {t('add')}
              </button>
            </div>
            <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '16px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={prizeForm.isCard}
                  onChange={(e) => setPrizeForm({ ...prizeForm, isCard: e.target.checked })}
                  style={{ width: '16px', height: '16px' }}
                />
                {t('prize_is_card')}
              </label>
              {prizeForm.isCard && (
                <span style={{ fontSize: '12px', color: '#666' }}>
                  ({t('prize_card_codes_remaining')}: {prizes.find(p => p.id === prizeForm.activityId && p.name === prizeForm.name)?.remainingQuantity || 0})
                </span>
              )}
            </div>
            {prizeForm.isCard && (
              <div style={{ marginTop: '12px' }}>
                <textarea
                  value={cardCodesText}
                  onChange={(e) => setCardCodesText(e.target.value)}
                  placeholder={t('prize_card_codes_placeholder')}
                  style={{
                    width: '100%',
                    minHeight: '80px',
                    padding: '10px 12px',
                    border: '1px solid #d9d9d9',
                    borderRadius: '4px',
                    fontSize: '14px',
                    fontFamily: 'monospace',
                    resize: 'vertical',
                    boxSizing: 'border-box',
                  }}
                />
                <div style={{ marginTop: '8px', fontSize: '12px', color: '#999' }}>
                  {t('prize_card_codes_tip')}
                </div>
                <button
                  onClick={handleImportCardCodes}
                  disabled={!cardCodesText.trim()}
                  style={{
                    marginTop: '8px',
                    padding: '8px 16px',
                    border: 'none',
                    borderRadius: '4px',
                    backgroundColor: cardCodesText.trim() ? '#52c41a' : '#ccc',
                    color: '#fff',
                    cursor: cardCodesText.trim() ? 'pointer' : 'not-allowed',
                    fontSize: '14px',
                  }}
                >
                  {t('prize_import_card_codes')}
                </button>
              </div>
            )}
            <div style={{ marginTop: '8px', fontSize: '12px', color: '#999' }}>
              {t('prize_empty_tip')}
            </div>
          </div>

          <div style={{ padding: '16px' }}>
            {prizes.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#999' }}>
                <Trophy size={48} style={{ margin: '0 auto 16px', opacity: 0.5 }} />
                <p>{t('prize_no_prizes')}</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                {prizes.map((prize) => (
                  <div key={prize.id} style={{
                    padding: '16px',
                    border: '1px solid #e8e8e8',
                    borderRadius: '8px',
                    position: 'relative',
                  }}>
                    <button
                      onClick={() => handleDeletePrize(prize.id)}
                      style={{
                        position: 'absolute',
                        top: '8px',
                        right: '8px',
                        padding: '4px',
                        border: 'none',
                        backgroundColor: 'transparent',
                        cursor: 'pointer',
                        color: '#999',
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      {prize.imageUrl ? (
                        <img
                          src={prize.imageUrl}
                          alt={prize.name}
                          style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '4px' }}
                        />
                      ) : (
                        <div style={{
                          width: '60px',
                          height: '60px',
                          backgroundColor: '#f5f5f5',
                          borderRadius: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}>
                          <Trophy size={24} color="#999" />
                        </div>
                      )}
                      <div>
                        <h4 style={{ fontSize: '14px', fontWeight: 500, margin: 0 }}>{prize.name}</h4>
                        <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                          <span>{t('prize_quantity')}: {prize.remainingQuantity}/{prize.quantity}</span>
                          <span style={{ margin: '0 8px' }}>|</span>
                          <span>{t('prize_probability')}: {prize.probability}%</span>
                        </div>
                        {prize.isEmpty && (
                          <span style={{
                            display: 'inline-block',
                            marginTop: '4px',
                            padding: '2px 6px',
                            backgroundColor: '#fff7e6',
                            color: '#d46b08',
                            fontSize: '12px',
                            borderRadius: '4px',
                          }}>
                            {t('prize_empty')}
                          </span>
                        )}
                        {prize.isCard && (
                          <span style={{
                            display: 'inline-block',
                            marginTop: '4px',
                            marginLeft: '8px',
                            padding: '2px 6px',
                            backgroundColor: '#e6f7ff',
                            color: '#1890ff',
                            fontSize: '12px',
                            borderRadius: '4px',
                          }}>
                            {t('prize_is_card')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'winners' && selectedActivity && (
        <div style={{ backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <div style={{ padding: '16px', borderBottom: '1px solid #e8e8e8', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 500, margin: 0 }}>{selectedActivity.title}</h3>
              <p style={{ fontSize: '14px', color: '#666', margin: '4px 0 0' }}>{t('activity_winners')}</p>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setActiveTab('prizes')}
                style={{
                  padding: '8px 16px',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  backgroundColor: '#f5f5f5',
                  color: '#666',
                }}
              >
                <Trophy size={14} style={{ display: 'inline', marginRight: '8px' }} />
                {t('activity_prizes')} ({prizes.length})
              </button>
              <button
                onClick={() => setActiveTab('list')}
                style={{
                  padding: '8px 16px',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  backgroundColor: '#f5f5f5',
                  color: '#666',
                }}
              >
                {t('back')}
              </button>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#fafafa' }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '14px', fontWeight: 500, color: '#666', borderBottom: '1px solid #e8e8e8' }}>{t('winner_name')}</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '14px', fontWeight: 500, color: '#666', borderBottom: '1px solid #e8e8e8' }}>{t('prize_name')}</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '14px', fontWeight: 500, color: '#666', borderBottom: '1px solid #e8e8e8' }}>{t('winner_contact')}</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '14px', fontWeight: 500, color: '#666', borderBottom: '1px solid #e8e8e8' }}>{t('winner_time')}</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '14px', fontWeight: 500, color: '#666', borderBottom: '1px solid #e8e8e8' }}>{t('winner_status')}</th>
                </tr>
              </thead>
              <tbody>
                {winners.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: '#999' }}>
                      {t('winner_no_winners')}
                    </td>
                  </tr>
                ) : (
                  winners.map((winner) => (
                    <tr key={winner.id} style={{ borderBottom: '1px solid #e8e8e8' }}>
                      <td style={{ padding: '12px 16px', fontSize: '14px' }}>{winner.visitorName || winner.visitorId}</td>
                      <td style={{ padding: '12px 16px', fontSize: '14px' }}>
                        {winner.prize?.isEmpty ? t('prize_empty') : winner.prize?.name || '-'}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '14px' }}>
                        <div>
                          {winner.phone && <div>{winner.phone}</div>}
                          {winner.email && <div>{winner.email}</div>}
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '14px', color: '#666' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Clock size={14} />
                          {formatDate(winner.createdAt)}
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '12px',
                          backgroundColor: winner.isClaimed ? '#f6ffed' : '#fff7e6',
                          color: winner.isClaimed ? '#52c41a' : '#d46b08',
                        }}>
                          {winner.isClaimed ? t('winner_claimed') : t('winner_unclaimed')}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}