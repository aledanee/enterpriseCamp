import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Form, Input, Button, Typography, Alert, Card } from 'antd';
import { LockOutlined, MailOutlined } from '@ant-design/icons';
import { useAuth } from '../../context/AuthContext';

const { Title, Text } = Typography;

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const onFinish = async ({ email, password }) => {
    setLoading(true);
    setError('');
    try {
      await login(email, password);
      navigate('/admin/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'بيانات الدخول غير صحيحة');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(ellipse at 30% 50%, rgba(108,99,255,0.12) 0%, transparent 60%), #0a0a1a',
      padding: 24,
    }}>
      {/* Decorative orbs */}
      <div style={{
        position: 'fixed', top: '10%', right: '10%',
        width: 300, height: 300, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(108,99,255,0.12) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'fixed', bottom: '10%', left: '10%',
        width: 200, height: 200, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(0,230,118,0.08) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <Card
        style={{
          width: '100%',
          maxWidth: 420,
          background: '#12122a',
          border: '1px solid #2a2a4a',
          borderRadius: 16,
          boxShadow: '0 24px 80px rgba(0,0,0,0.6), 0 0 40px rgba(108,99,255,0.1)',
        }}
        styles={{ body: { padding: '40px 36px' } }}
      >
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14,
            background: 'linear-gradient(135deg, #6C63FF, #00e676)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 26, fontWeight: 700, color: '#fff', marginBottom: 16,
            boxShadow: '0 8px 24px rgba(108,99,255,0.4)',
          }}>L</div>
          <Title level={3} style={{ color: '#e0e0ff', margin: 0 }}>تسجيل الدخول</Title>
          <Text style={{ color: '#8888bb', fontSize: 14 }}>لوحة تحكم LesOne</Text>
        </div>

        {error && (
          <Alert
            message={error}
            type="error"
            showIcon
            style={{ marginBottom: 20, background: 'rgba(255,82,82,0.1)', border: '1px solid rgba(255,82,82,0.3)' }}
          />
        )}

        <Form layout="vertical" onFinish={onFinish} size="large">
          <Form.Item
            name="email"
            rules={[
              { required: true, message: 'البريد الإلكتروني مطلوب' },
              { type: 'email', message: 'البريد الإلكتروني غير صحيح' },
            ]}
          >
            <Input
              prefix={<MailOutlined style={{ color: '#8888bb' }} />}
              placeholder="البريد الإلكتروني"
              style={{ background: '#1a1a36', border: '1px solid #2a2a4a' }}
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: 'كلمة المرور مطلوبة' }]}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: '#8888bb' }} />}
              placeholder="كلمة المرور"
              style={{ background: '#1a1a36', border: '1px solid #2a2a4a' }}
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              block
              style={{
                height: 44,
                background: 'linear-gradient(135deg, #6C63FF, #8b7fff)',
                border: 'none',
                fontWeight: 600,
                fontSize: 15,
                boxShadow: '0 4px 20px rgba(108,99,255,0.4)',
              }}
            >
              دخول
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
