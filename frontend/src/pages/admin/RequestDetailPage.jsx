import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card, Typography, Tag, Button, Space, Spin, Descriptions, Select,
  Input, message, Divider, Row, Col, Alert,
} from 'antd';
import {
  ArrowRightOutlined, CheckCircleOutlined, CloseCircleOutlined, ClockCircleOutlined,
} from '@ant-design/icons';
import { requestsApi } from '../../services/api';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { TextArea } = Input;

const STATUS_CONFIG = {
  pending:  { color: 'gold',  label: 'قيد المراجعة', icon: <ClockCircleOutlined /> },
  approved: { color: 'green', label: 'مقبول',         icon: <CheckCircleOutlined /> },
  rejected: { color: 'red',   label: 'مرفوض',         icon: <CloseCircleOutlined /> },
};

export default function RequestDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [newStatus, setNewStatus] = useState('approved');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await requestsApi.getOne(id);
        const d = res.data.data;
        setRequest(d.request || d);
        const st = d.request?.status || d.status || 'pending';
        setNewStatus(st === 'pending' ? 'approved' : st);
      } catch {
        message.error('فشل تحميل تفاصيل الطلب');
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [id]);

  const handleUpdateStatus = async () => {
    setActionLoading(true);
    try {
      await requestsApi.updateStatus(id, { status: newStatus, admin_notes: notes });
      message.success('تم تحديث حالة الطلب');
      const res = await requestsApi.getOne(id);
      const d = res.data.data;
      setRequest(d.request || d);
    } catch (err) {
      message.error(err.response?.data?.message || 'فشل التحديث');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>;
  if (!request) return <Alert message="الطلب غير موجود" type="error" />;

  const formData = request.data || request.form_data || request.formData || {};
  const currentStatus = request.status;
  const statusCfg = STATUS_CONFIG[currentStatus] || { color: 'default', label: currentStatus };

  return (
    <div>
      <Space style={{ marginBottom: 20 }}>
        <Button
          type="text" icon={<ArrowRightOutlined />}
          onClick={() => navigate('/admin/requests')}
          style={{ color: '#8888bb' }}
        />
        <Title level={3} style={{ color: '#e0e0ff', margin: 0 }}>
          تفاصيل الطلب #{id}
        </Title>
        <Tag color={statusCfg.color} icon={statusCfg.icon} style={{ fontSize: 13 }}>
          {statusCfg.label}
        </Tag>
      </Space>

      <Row gutter={16}>
        {/* Form data */}
        <Col xs={24} lg={14}>
          <Card
            title={<Text style={{ color: '#e0e0ff' }}>بيانات الطلب</Text>}
            style={{ background: '#12122a', border: '1px solid #2a2a4a', borderRadius: 12, marginBottom: 16 }}
            styles={{ header: { borderBottom: '1px solid #2a2a4a' } }}
          >
            <Descriptions column={1} styles={{ label: { color: '#8888bb', width: 160 }, content: { color: '#e0e0ff' } }}>
              <Descriptions.Item label="رقم الطلب">#{request.id}</Descriptions.Item>
              <Descriptions.Item label="نوع المستخدم">
                <Tag color="purple">{request.type_name || request.user_type_name || request.userTypeName || '-'}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="تاريخ التقديم">
                {request.created_at ? dayjs(request.created_at).format('YYYY-MM-DD HH:mm:ss') : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="آخر تحديث">
                {request.updated_at ? dayjs(request.updated_at).format('YYYY-MM-DD HH:mm:ss') : '-'}
              </Descriptions.Item>
            </Descriptions>

            <Divider style={{ borderColor: '#2a2a4a', margin: '16px 0' }} />

            <Text strong style={{ color: '#8888bb', display: 'block', marginBottom: 12 }}>الحقول المقدَّمة:</Text>
            {Object.keys(formData).length > 0 ? (
              <Descriptions column={1} styles={{ label: { color: '#8888bb', width: 160 }, content: { color: '#e0e0ff' } }} bordered>
                {Object.entries(formData).map(([key, value]) => (
                  <Descriptions.Item key={key} label={key}>
                    {String(value)}
                  </Descriptions.Item>
                ))}
              </Descriptions>
            ) : (
              <Text style={{ color: '#8888bb' }}>لا توجد بيانات</Text>
            )}

            {(request.admin_notes || request.notes) && (
              <>
                <Divider style={{ borderColor: '#2a2a4a' }} />
                <Text strong style={{ color: '#8888bb', display: 'block', marginBottom: 8 }}>ملاحظات الإدارة:</Text>
                <Text style={{ color: '#e0e0ff' }}>{request.admin_notes || request.notes}</Text>
              </>
            )}
          </Card>
        </Col>

        {/* Action panel */}
        <Col xs={24} lg={10}>
          <Card
            title={<Text style={{ color: '#e0e0ff' }}>تحديث الحالة</Text>}
            style={{ background: '#12122a', border: '1px solid #2a2a4a', borderRadius: 12 }}
            styles={{ header: { borderBottom: '1px solid #2a2a4a' } }}
          >
            <Space orientation="vertical" style={{ width: '100%', flexDirection: 'column', display: 'flex' }} size={14}>
              <div>
                <Text style={{ color: '#8888bb', display: 'block', marginBottom: 6 }}>الحالة الجديدة</Text>
                <Select
                  value={newStatus}
                  onChange={setNewStatus}
                  style={{ width: '100%' }}
                >
                  <Select.Option value="approved">قبول ✓</Select.Option>
                  <Select.Option value="rejected">رفض ✗</Select.Option>
                </Select>
              </div>

              {(newStatus === 'rejected' || newStatus === 'approved') && (
                <div>
                  <Text style={{ color: '#8888bb', display: 'block', marginBottom: 6 }}>ملاحظات {newStatus === 'rejected' ? '(سبب الرفض)' : '(اختياري)'}</Text>
                  <TextArea
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="أضف ملاحظاتك هنا..."
                    style={{ background: '#1a1a36', border: '1px solid #2a2a4a' }}
                  />
                </div>
              )}

              <Button
                type="primary"
                block
                loading={actionLoading}
                disabled={actionLoading}
                onClick={handleUpdateStatus}
                style={{
                  background: newStatus === 'approved'
                    ? 'linear-gradient(135deg,#00c853,#00e676)'
                    : newStatus === 'rejected'
                    ? 'linear-gradient(135deg,#ff1744,#ff5252)'
                    : 'linear-gradient(135deg,#6C63FF,#8b7fff)',
                  border: 'none',
                  height: 42,
                  fontWeight: 600,
                }}
              >
                {newStatus === 'approved' ? '✓ قبول الطلب' : newStatus === 'rejected' ? '✗ رفض الطلب' : 'تحديث الحالة'}
              </Button>
            </Space>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
