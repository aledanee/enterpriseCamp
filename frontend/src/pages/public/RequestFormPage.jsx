import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Form, Select, Input, Button, Typography, Card, Spin,
  message, DatePicker, InputNumber, Alert,
} from 'antd';
import { requestsApi } from '../../services/api';

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const DynamicField = ({ field, name }) => {
  const rules = field.is_required ? [{ required: true, message: `${field.field_label || name} مطلوب` }] : [];
  const label = <Text style={{ color: '#8888bb' }}>{field.field_label || name}{field.is_required && <Text style={{ color: '#ff5252' }}> *</Text>}</Text>;

  const inputStyle = { background: '#1a1a36', border: '1px solid #2a2a4a' };

  let control;
  switch (field.field_type) {
    case 'number':
      control = <InputNumber placeholder={field.field_label} style={{ ...inputStyle, width: '100%' }} />;
      break;
    case 'email':
      control = <Input type="email" placeholder={field.field_label} style={inputStyle} />;
      rules.push({ type: 'email', message: 'البريد الإلكتروني غير صحيح' });
      break;
    case 'tel':
    case 'phone':
      control = <Input type="tel" placeholder={field.field_label} style={inputStyle} />;
      break;
    case 'date':
      control = <DatePicker style={{ ...inputStyle, width: '100%' }} placeholder={field.field_label} />;
      break;
    case 'textarea':
      control = <TextArea rows={3} placeholder={field.field_label} style={inputStyle} />;
      break;
    case 'select':
    case 'dropdown': {
      const opts = Array.isArray(field.field_options)
        ? field.field_options
        : (field.field_options ? Object.values(field.field_options) : []);
      control = (
        <Select placeholder={`اختر ${field.field_label}`} style={{ width: '100%' }}>
          {opts.map((o) => <Option key={o} value={o}>{o}</Option>)}
        </Select>
      );
      break;
    }
    default:
      control = <Input placeholder={field.field_label} style={inputStyle} />;
  }

  return (
    <Form.Item name={name} label={label} rules={rules} style={{ marginBottom: 16 }}>
      {control}
    </Form.Item>
  );
};

export default function RequestFormPage() {
  const [userTypes, setUserTypes] = useState([]);
  const [selectedType, setSelectedType] = useState(null);
  const [fields, setFields] = useState([]);
  const [loadingTypes, setLoadingTypes] = useState(true);
  const [loadingFields, setLoadingFields] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();
  const navigate = useNavigate();

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await requestsApi.getActiveUserTypes();
        setUserTypes(res.data.data?.user_types || res.data.data || []);
      } catch {
        message.error('فشل تحميل أنواع المستخدمين');
      } finally {
        setLoadingTypes(false);
      }
    };
    fetch();
  }, []);

  const handleTypeChange = async (typeId) => {
    setSelectedType(typeId);
    form.resetFields();
    form.setFieldValue('user_type_id', typeId);
    if (!typeId) { setFields([]); return; }
    setLoadingFields(true);
    try {
      const res = await requestsApi.getUserTypeFields(typeId);
      setFields(res.data.data?.fields || []);
    } catch {
      message.error('فشل تحميل حقول النموذج');
    } finally {
      setLoadingFields(false);
    }
  };

  const onFinish = async (values) => {
    const { user_type_id, ...formData } = values;
    // Convert DatePicker objects to ISO strings
    Object.keys(formData).forEach(k => {
      if (formData[k] && typeof formData[k].toISOString === 'function') {
        formData[k] = formData[k].toISOString();
      }
    });
    setSubmitting(true);
    try {
      await requestsApi.createRequest({ user_type_id, data: formData });
      navigate('/request-success');
    } catch (err) {
      message.error(err.response?.data?.message || 'فشل تقديم الطلب');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'center',
      background: 'radial-gradient(ellipse at 20% 50%, rgba(108,99,255,0.1) 0%, transparent 60%), #0a0a1a',
      padding: '40px 16px',
    }}>
      {/* Decorative orbs */}
      <div style={{ position: 'fixed', top: '15%', left: '8%', width: 350, height: 350, borderRadius: '50%', background: 'radial-gradient(circle, rgba(108,99,255,0.1) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'fixed', bottom: '10%', right: '8%', width: 250, height: 250, borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,230,118,0.07) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <div style={{ width: '100%', maxWidth: 560, position: 'relative', zIndex: 1 }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 60, height: 60, borderRadius: 16,
            background: 'linear-gradient(135deg, #6C63FF, #00e676)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28, fontWeight: 700, color: '#fff', marginBottom: 16,
            boxShadow: '0 8px 32px rgba(108,99,255,0.4)',
          }}>L</div>
          <Title level={2} style={{ color: '#e0e0ff', margin: 0 }}>تقديم طلب</Title>
          <Text style={{ color: '#8888bb' }}>نظام إدارة الطلبات الديناميكية — LesOne</Text>
        </div>

        <Card
          style={{
            background: '#12122a',
            border: '1px solid #2a2a4a',
            borderRadius: 16,
            boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
          }}
          styles={{ body: { padding: '32px 28px' } }}
        >
          <Form
            form={form}
            layout="vertical"
            onFinish={onFinish}
            size="large"
          >
            <Form.Item
              name="user_type_id"
              label={<Text style={{ color: '#8888bb' }}>نوع المستخدم</Text>}
              rules={[{ required: true, message: 'يرجى اختيار نوع المستخدم' }]}
              style={{ marginBottom: 20 }}
            >
              {loadingTypes ? (
                <div style={{ textAlign: 'center', padding: 20 }}><Spin /></div>
              ) : (
                <Select
                  placeholder="اختر نوع المستخدم..."
                  onChange={handleTypeChange}
                  style={{ width: '100%' }}
                >
                  {userTypes.map(t => (
                    <Option key={t.id} value={t.id}>{t.type_name || t.typeName}</Option>
                  ))}
                </Select>
              )}
            </Form.Item>

            {loadingFields && (
              <div style={{ textAlign: 'center', padding: 24 }}><Spin tip="جاري تحميل الحقول..." /></div>
            )}

            {!loadingFields && fields.length > 0 && (
              <>
                <div style={{ borderTop: '1px solid #2a2a4a', paddingTop: 20, marginBottom: 16 }}>
                  <Text style={{ color: '#8888bb', fontSize: 13 }}>يرجى ملء الحقول التالية:</Text>
                </div>
                {fields.map((field) => (
                  <DynamicField
                    key={field.field_id || field.id}
                    field={field}
                    name={field.field_name || String(field.field_id)}
                  />
                ))}
              </>
            )}

            {selectedType && !loadingFields && fields.length === 0 && (
              <Alert
                message="لا توجد حقول لهذا النوع"
                type="info"
                showIcon
                style={{ marginBottom: 16, background: 'rgba(0,180,216,0.1)', border: '1px solid rgba(0,180,216,0.3)' }}
              />
            )}

            {selectedType && (
              <Form.Item style={{ marginBottom: 0, marginTop: 8 }}>
                <Button
                  type="primary"
                  htmlType="submit"
                  block
                  loading={submitting}
                  disabled={loadingFields}
                  style={{
                    height: 48,
                    background: 'linear-gradient(135deg, #6C63FF, #8b7fff)',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: 16,
                    boxShadow: '0 4px 20px rgba(108,99,255,0.4)',
                  }}
                >
                  تقديم الطلب
                </Button>
              </Form.Item>
            )}
          </Form>
        </Card>

        {/* Admin link */}
        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <a href="/admin/login" style={{ color: '#8888bb', fontSize: 13 }}>
            تسجيل دخول الإدارة
          </a>
        </div>
      </div>
    </div>
  );
}
