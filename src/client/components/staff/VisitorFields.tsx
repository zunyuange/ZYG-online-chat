import { useState, useEffect } from 'react';
import { Plus, Trash2, Edit3, X, Check, Save, FileText } from 'lucide-react';

interface FieldDef {
  id: string | number;
  fieldKey: string;
  label: string;
  type: string;
  isFixed: boolean;
  remark?: string;
  sortOrder?: number;
  isActive?: boolean;
  createdAt?: number;
}

export function VisitorFields() {
  const [fixedFields, setFixedFields] = useState<FieldDef[]>([]);
  const [customFields, setCustomFields] = useState<FieldDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Add/Edit state
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingField, setEditingField] = useState<FieldDef | null>(null);
  const [formFieldKey, setFormFieldKey] = useState('');
  const [formLabel, setFormLabel] = useState('');
  const [formType, setFormType] = useState('text');
  const [formRemark, setFormRemark] = useState('');
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    fetchFields();
  }, []);

  const fetchFields = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/staff/visitor-fields', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('staff_token')}`,
        },
      });
      const result = await response.json();
      if (result.success) {
        setFixedFields(result.data.fixedFields || []);
        setCustomFields(result.data.customFields || []);
      } else {
        setError(result.error || '获取字段列表失败');
      }
    } catch (err) {
      setError('获取字段列表失败');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormFieldKey('');
    setFormLabel('');
    setFormType('text');
    setFormRemark('');
    setFormError('');
    setEditingField(null);
    setShowAddForm(false);
  };

  const startEdit = (field: FieldDef) => {
    setEditingField(field);
    setFormFieldKey(field.fieldKey);
    setFormLabel(field.label);
    setFormType(field.type);
    setFormRemark(field.remark || '');
    setFormError('');
    setShowAddForm(true);
  };

  const handleSave = async () => {
    if (!formFieldKey.trim() || !formLabel.trim()) {
      setFormError('字段标识和显示名称不能为空');
      return;
    }
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(formFieldKey)) {
      setFormError('字段标识只能包含英文字母、数字和下划线，且不能以数字开头');
      return;
    }

    setFormSaving(true);
    setFormError('');

    try {
      const url = editingField
        ? `/api/staff/visitor-fields/${editingField.id}`
        : '/api/staff/visitor-fields';
      const method = editingField ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('staff_token')}`,
        },
        body: JSON.stringify({
          fieldKey: formFieldKey,
          label: formLabel,
          type: formType,
          remark: formRemark,
          ...(editingField ? { isActive: true } : {}),
        }),
      });

      const result = await response.json();
      if (result.success) {
        resetForm();
        fetchFields();
      } else {
        setFormError(result.error || '保存失败');
      }
    } catch (err) {
      setFormError('保存失败，请重试');
    } finally {
      setFormSaving(false);
    }
  };

  const handleDelete = async (fieldId: number | string) => {
    if (!confirm('确定要删除这个自定义字段吗？')) return;

    try {
      const response = await fetch(`/api/staff/visitor-fields/${fieldId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('staff_token')}`,
        },
      });
      const result = await response.json();
      if (result.success) {
        fetchFields();
      } else {
        alert(result.error || '删除失败');
      }
    } catch (err) {
      alert('删除失败，请重试');
    }
  };

  const getTypeLabel = (type: string) => {
    const map: Record<string, string> = { text: '文本', url: '链接', json: 'JSON' };
    return map[type] || type;
  };

  if (loading) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <div className="animate-spin" style={{
          width: '40px', height: '40px', border: '3px solid #e5e7eb',
          borderTopColor: '#3b82f6', borderRadius: '50%', margin: '0 auto 16px',
        }}></div>
        <p style={{ color: '#6b7280' }}>加载中...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', height: '100%', overflowY: 'auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 500, margin: 0 }}>访客自定义字段</h2>
          <p style={{ color: '#999', fontSize: '14px', marginTop: '8px' }}>
            管理系统固定字段和自定义访客字段，自定义字段会显示在访客信息面板中
          </p>
        </div>
        <button
          onClick={() => { resetForm(); setShowAddForm(true); }}
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
          }}
        >
          <Plus size={16} />
          添加自定义字段
        </button>
      </div>

      {/* Error Banner */}
      {error && (
        <div style={{ padding: '12px 16px', backgroundColor: '#fff2f0', border: '1px solid #ffccc7', borderRadius: '6px', marginBottom: '16px', color: '#ff4d4f', fontSize: '14px' }}>
          {error}
        </div>
      )}

      {/* Add/Edit Form Modal */}
      {showAddForm && (
        <div
          style={{
            position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          }}
          onClick={resetForm}
        >
          <div
            style={{
              backgroundColor: '#fff', borderRadius: '8px', padding: '24px',
              width: '90%', maxWidth: '480px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 20px 0', fontSize: '16px', fontWeight: 500 }}>
              {editingField ? '编辑自定义字段' : '添加自定义字段'}
            </h3>

            {formError && (
              <div style={{ padding: '8px 12px', backgroundColor: '#fff2f0', borderRadius: '4px', color: '#ff4d4f', fontSize: '13px', marginBottom: '16px' }}>
                {formError}
              </div>
            )}

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: '#666', fontWeight: 500 }}>
                字段标识 <span style={{ color: '#ff4d4f' }}>*</span>
              </label>
              <input
                type="text"
                value={formFieldKey}
                onChange={(e) => setFormFieldKey(e.target.value)}
                placeholder="例如: customField1"
                disabled={!!editingField}
                style={{
                  width: '100%', padding: '8px 12px', border: '1px solid #d9d9d9',
                  borderRadius: '4px', fontSize: '14px', boxSizing: 'border-box',
                  backgroundColor: editingField ? '#f5f5f5' : '#fff',
                }}
              />
              <p style={{ fontSize: '11px', color: '#999', marginTop: '4px' }}>
                用于URL传参，如 ?customField1=xxx，仅支持英文/数字/下划线
              </p>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: '#666', fontWeight: 500 }}>
                显示名称 <span style={{ color: '#ff4d4f' }}>*</span>
              </label>
              <input
                type="text"
                value={formLabel}
                onChange={(e) => setFormLabel(e.target.value)}
                placeholder="例如: 用户等级"
                style={{
                  width: '100%', padding: '8px 12px', border: '1px solid #d9d9d9',
                  borderRadius: '4px', fontSize: '14px', boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: '#666', fontWeight: 500 }}>
                字段类型
              </label>
              <select
                value={formType}
                onChange={(e) => setFormType(e.target.value)}
                style={{
                  width: '100%', padding: '8px 12px', border: '1px solid #d9d9d9',
                  borderRadius: '4px', fontSize: '14px', boxSizing: 'border-box',
                }}
              >
                <option value="text">文本</option>
                <option value="url">链接</option>
                <option value="json">JSON</option>
              </select>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: '#666', fontWeight: 500 }}>
                备注说明
              </label>
              <textarea
                value={formRemark}
                onChange={(e) => setFormRemark(e.target.value)}
                placeholder="描述这个字段的用途..."
                rows={3}
                style={{
                  width: '100%', padding: '8px 12px', border: '1px solid #d9d9d9',
                  borderRadius: '4px', fontSize: '14px', boxSizing: 'border-box',
                  resize: 'vertical',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={resetForm}
                style={{
                  padding: '8px 16px', border: '1px solid #d9d9d9', borderRadius: '4px',
                  backgroundColor: '#fff', cursor: 'pointer', fontSize: '14px', color: '#666',
                }}
              >
                取消
              </button>
              <button
                onClick={handleSave}
                disabled={formSaving}
                style={{
                  padding: '8px 16px', border: 'none', borderRadius: '4px',
                  backgroundColor: formSaving ? '#d9d9d9' : '#1890ff',
                  cursor: formSaving ? 'not-allowed' : 'pointer', fontSize: '14px', color: '#fff',
                  display: 'flex', alignItems: 'center', gap: '6px',
                }}
              >
                <Save size={14} />
                {formSaving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fixed Fields Section */}
      <div style={{ backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: '24px' }}>
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid #f0f0f0',
          display: 'flex', alignItems: 'center', gap: '8px',
        }}>
          <FileText size={18} style={{ color: '#1890ff' }} />
          <h3 style={{ fontSize: '16px', fontWeight: 500, margin: 0 }}>系统固定字段</h3>
          <span style={{ fontSize: '12px', color: '#999', backgroundColor: '#f0f0f0', padding: '2px 8px', borderRadius: '10px' }}>
            {fixedFields.length} 个
          </span>
        </div>
        <div style={{ padding: '0' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#fafafa', borderBottom: '1px solid #f0f0f0' }}>
                <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: '13px', color: '#666', fontWeight: 500, width: '160px' }}>字段标识</th>
                <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: '13px', color: '#666', fontWeight: 500, width: '120px' }}>显示名称</th>
                <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: '13px', color: '#666', fontWeight: 500, width: '80px' }}>类型</th>
                <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: '13px', color: '#666', fontWeight: 500 }}>备注说明</th>
              </tr>
            </thead>
            <tbody>
              {fixedFields.map((field, index) => (
                <tr key={field.id} style={{ borderBottom: index < fixedFields.length - 1 ? '1px solid #f5f5f5' : 'none' }}>
                  <td style={{ padding: '10px 20px', fontSize: '13px', color: '#333', fontFamily: 'monospace' }}>{field.fieldKey}</td>
                  <td style={{ padding: '10px 20px', fontSize: '13px', color: '#333' }}>{field.label}</td>
                  <td style={{ padding: '10px 20px', fontSize: '13px', color: '#999' }}>{getTypeLabel(field.type)}</td>
                  <td style={{ padding: '10px 20px', fontSize: '13px', color: '#666' }}>{field.remark || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Custom Fields Section */}
      <div style={{ backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid #f0f0f0',
          display: 'flex', alignItems: 'center', gap: '8px',
        }}>
          <Edit3 size={18} style={{ color: '#52c41a' }} />
          <h3 style={{ fontSize: '16px', fontWeight: 500, margin: 0 }}>自定义字段</h3>
          <span style={{ fontSize: '12px', color: '#999', backgroundColor: '#f0f0f0', padding: '2px 8px', borderRadius: '10px' }}>
            {customFields.length} 个
          </span>
        </div>

        {customFields.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: '#999', fontSize: '14px' }}>
            <p>暂无自定义字段</p>
            <p style={{ fontSize: '12px', marginTop: '4px' }}>点击右上角"添加自定义字段"按钮来创建</p>
          </div>
        ) : (
          <div style={{ padding: '0' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#fafafa', borderBottom: '1px solid #f0f0f0' }}>
                  <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: '13px', color: '#666', fontWeight: 500, width: '160px' }}>字段标识</th>
                  <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: '13px', color: '#666', fontWeight: 500, width: '120px' }}>显示名称</th>
                  <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: '13px', color: '#666', fontWeight: 500, width: '80px' }}>类型</th>
                  <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: '13px', color: '#666', fontWeight: 500 }}>备注说明</th>
                  <th style={{ padding: '12px 20px', textAlign: 'center', fontSize: '13px', color: '#666', fontWeight: 500, width: '120px' }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {customFields.map((field, index) => (
                  <tr key={field.id} style={{ borderBottom: index < customFields.length - 1 ? '1px solid #f5f5f5' : 'none' }}>
                    <td style={{ padding: '10px 20px', fontSize: '13px', color: '#333', fontFamily: 'monospace' }}>{field.fieldKey}</td>
                    <td style={{ padding: '10px 20px', fontSize: '13px', color: '#333' }}>{field.label}</td>
                    <td style={{ padding: '10px 20px', fontSize: '13px', color: '#999' }}>{getTypeLabel(field.type)}</td>
                    <td style={{ padding: '10px 20px', fontSize: '13px', color: '#666' }}>{field.remark || '-'}</td>
                    <td style={{ padding: '10px 20px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                        <button
                          onClick={() => startEdit(field)}
                          style={{
                            padding: '4px 8px', border: '1px solid #d9d9d9', borderRadius: '4px',
                            backgroundColor: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center',
                            gap: '4px', fontSize: '12px', color: '#1890ff',
                          }}
                        >
                          <Edit3 size={12} />
                          编辑
                        </button>
                        <button
                          onClick={() => handleDelete(field.id)}
                          style={{
                            padding: '4px 8px', border: '1px solid #ffccc7', borderRadius: '4px',
                            backgroundColor: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center',
                            gap: '4px', fontSize: '12px', color: '#ff4d4f',
                          }}
                        >
                          <Trash2 size={12} />
                          删除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
