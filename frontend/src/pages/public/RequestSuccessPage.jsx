import { useNavigate } from 'react-router-dom';
import { Button, Typography, Card } from 'antd';
import { CheckCircleFilled } from '@ant-design/icons';

const { Title, Text } = Typography;

export default function RequestSuccessPage() {
  const navigate = useNavigate();

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(ellipse at 50% 40%, rgba(0,230,118,0.1) 0%, transparent 60%), #0a0a1a',
      padding: 24,
    }}>
      <div style={{ position: 'fixed', top: '20%', right: '10%', width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,230,118,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'fixed', bottom: '20%', left: '10%', width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle, rgba(108,99,255,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <Card
        style={{
          maxWidth: 480,
          width: '100%',
          background: '#12122a',
          border: '1px solid #2a2a4a',
          borderRadius: 20,
          textAlign: 'center',
          boxShadow: '0 24px 80px rgba(0,0,0,0.5), 0 0 40px rgba(0,230,118,0.08)',
          position: 'relative',
          zIndex: 1,
        }}
        styles={{ body: { padding: '48px 36px' } }}
      >
        {/* Animated check icon */}
        <div style={{
          width: 80, height: 80,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, rgba(0,230,118,0.2), rgba(0,200,83,0.1))',
          border: '2px solid rgba(0,230,118,0.4)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 24,
          boxShadow: '0 0 40px rgba(0,230,118,0.3)',
        }}>
          <CheckCircleFilled style={{ fontSize: 44, color: '#00e676' }} />
        </div>

        <Title level={2} style={{ color: '#e0e0ff', margin: '0 0 12px' }}>
          تم تقديم طلبك بنجاح!
        </Title>

        <Text style={{ color: '#8888bb', fontSize: 15, display: 'block', marginBottom: 32 }}>
          تم استلام طلبك وسيتم مراجعته من قِبَل الفريق المختص.
          ستصلك إشعارات عند تغيير حالة طلبك.
        </Text>

        <div style={{
          background: 'rgba(108,99,255,0.08)',
          border: '1px solid rgba(108,99,255,0.2)',
          borderRadius: 10,
          padding: '16px 20px',
          marginBottom: 32,
          textAlign: 'right',
        }}>
          <Text style={{ color: '#8888bb', fontSize: 13 }}>
            🕐 وقت الاستجابة المتوقع: <Text style={{ color: '#6C63FF' }}>1-3 أيام عمل</Text>
          </Text>
        </div>

        <Button
          type="primary"
          block
          size="large"
          onClick={() => navigate('/')}
          style={{
            height: 48,
            background: 'linear-gradient(135deg, #6C63FF, #8b7fff)',
            border: 'none',
            fontWeight: 700,
            fontSize: 16,
            boxShadow: '0 4px 20px rgba(108,99,255,0.4)',
          }}
        >
          تقديم طلب جديد
        </Button>
      </Card>
    </div>
  );
}
