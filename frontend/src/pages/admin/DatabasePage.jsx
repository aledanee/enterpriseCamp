import { useEffect, useState } from 'react';
import {
  Row, Col, Card, Typography, Button, Table, Tag, Space,
  Statistic, Spin, Popconfirm, message, Progress, Alert,
} from 'antd';
import {
  DatabaseOutlined, CloudUploadOutlined, CloudDownloadOutlined,
  DeleteOutlined, ReloadOutlined, CheckCircleOutlined, WarningOutlined,
} from '@ant-design/icons';
import { databaseApi } from '../../services/api';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

export default function DatabasePage() {
  const [health, setHealth] = useState(null);
  const [stats, setStats] = useState(null);
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [backupLoading, setBackupLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState('');

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [hRes, sRes, bRes] = await Promise.allSettled([
        databaseApi.health(),
        databaseApi.stats(),
        databaseApi.getBackups(),
      ]);
      if (hRes.status === 'fulfilled') setHealth(hRes.value.data.data);
      if (sRes.status === 'fulfilled') setStats(sRes.value.data.data);
      if (bRes.status === 'fulfilled') setBackups(bRes.value.data.data?.backups || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const handleBackup = async () => {
    setBackupLoading(true);
    try {
      await databaseApi.createBackup();
      message.success('تم إنشاء نسخة احتياطية بنجاح');
      fetchAll();
    } catch (err) {
      message.error(err.response?.data?.message || 'فشل إنشاء النسخة الاحتياطية');
    } finally {
      setBackupLoading(false);
    }
  };

  const handleRestore = async (filename) => {
    setRestoreLoading(filename);
    try {
      await databaseApi.restore(filename);
      message.success('تمت استعادة قاعدة البيانات بنجاح');
    } catch (err) {
      message.error(err.response?.data?.message || 'فشل الاستعادة');
    } finally {
      setRestoreLoading('');
    }
  };

  const handleDeleteBackup = async (filename) => {
    try {
      await databaseApi.deleteBackup(filename);
      message.success('تم حذف النسخة الاحتياطية');
      fetchAll();
    } catch (err) {
      message.error(err.response?.data?.message || 'فشل الحذف');
    }
  };

  const isHealthy = health?.status === 'healthy';

  const backupColumns = [
    {
      title: 'اسم الملف',
      dataIndex: 'filename',
      render: (v) => <Text style={{ color: '#e0e0ff', fontFamily: 'monospace', fontSize: 12 }}>{v}</Text>,
    },
    {
      title: 'الحجم',
      dataIndex: 'size',
      width: 100,
      render: (v) => <Text style={{ color: '#8888bb' }}>{v || '-'}</Text>,
    },
    {
      title: 'التاريخ',
      dataIndex: 'created_at',
      width: 160,
      render: (v) => v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '-',
    },
    {
      title: 'الإجراءات',
      key: 'actions',
      width: 160,
      render: (_, r) => (
        <Space>
          <Popconfirm
            title="هل تريد استعادة هذه النسخة؟"
            description="سيتم استبدال قاعدة البيانات الحالية"
            onConfirm={() => handleRestore(r.filename)}
            okText="استعادة"
            cancelText="إلغاء"
            okButtonProps={{ danger: true }}
          >
            <Button
              size="small" icon={<CloudDownloadOutlined />}
              loading={restoreLoading === r.filename}
              style={{ color: '#6C63FF', borderColor: '#2a2a4a' }}
            >
              استعادة
            </Button>
          </Popconfirm>
          <Popconfirm
            title="تأكيد حذف النسخة الاحتياطية"
            onConfirm={() => handleDeleteBackup(r.filename)}
            okText="حذف"
            cancelText="إلغاء"
            okButtonProps={{ danger: true }}
          >
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  if (loading) return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={3} style={{ color: '#e0e0ff', margin: 0 }}>قاعدة البيانات</Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchAll} style={{ borderColor: '#2a2a4a', color: '#8888bb' }}>
            تحديث
          </Button>
          <Button
            type="primary" icon={<CloudUploadOutlined />}
            loading={backupLoading}
            onClick={handleBackup}
            style={{ background: 'linear-gradient(135deg,#6C63FF,#8b7fff)', border: 'none' }}
          >
            نسخ احتياطي الآن
          </Button>
        </Space>
      </div>

      {/* Health Banner */}
      {health && (
        <Alert
          type={isHealthy ? 'success' : 'warning'}
          icon={isHealthy ? <CheckCircleOutlined /> : <WarningOutlined />}
          message={isHealthy ? 'قاعدة البيانات تعمل بشكل طبيعي' : 'تحذير: قاعدة البيانات تحتاج انتباهاً'}
          description={health.message || ''}
          showIcon
          style={{
            marginBottom: 20,
            background: isHealthy ? 'rgba(0,230,118,0.07)' : 'rgba(250,173,20,0.07)',
            border: `1px solid ${isHealthy ? 'rgba(0,230,118,0.3)' : 'rgba(250,173,20,0.3)'}`,
          }}
        />
      )}

      {/* Stats */}
      {stats && (
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          {[
            { label: 'إجمالي السجلات', value: stats.total_records ?? stats.totalRecords, color: '#6C63FF' },
            { label: 'أنواع المستخدمين', value: stats.user_types ?? stats.userTypes, color: '#00b4d8' },
            { label: 'الطلبات', value: stats.requests, color: '#faad14' },
            { label: 'الحقول الرئيسية', value: stats.fields_master ?? stats.fieldsMaster, color: '#00e676' },
          ].map((s) => (
            <Col key={s.label} xs={12} sm={6}>
              <Card
                style={{ background: '#12122a', border: '1px solid #2a2a4a', borderRadius: 12 }}
                styles={{ body: { padding: '18px 20px' } }}
              >
                <Statistic
                  title={<Text style={{ color: '#8888bb', fontSize: 12 }}>{s.label}</Text>}
                  value={s.value ?? '-'}
                  styles={{ content: { color: s.color, fontWeight: 700, fontSize: 24 } }}
                />
              </Card>
            </Col>
          ))}
        </Row>
      )}

      {/* Backups */}
      <Card
        title={<Text style={{ color: '#e0e0ff' }}>النسخ الاحتياطية <Tag color="purple">{backups.length}</Tag></Text>}
        style={{ background: '#12122a', border: '1px solid #2a2a4a', borderRadius: 12 }}
        styles={{ header: { borderBottom: '1px solid #2a2a4a' }, body: { padding: 0 } }}
      >
        <Table
          columns={backupColumns}
          dataSource={backups}
          rowKey="filename"
          pagination={{ pageSize: 10, style: { padding: '12px 20px' } }}
          locale={{ emptyText: 'لا توجد نسخ احتياطية' }}
          size="small"
        />
      </Card>
    </div>
  );
}
