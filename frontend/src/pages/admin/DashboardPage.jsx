import { useEffect, useState } from 'react';
import { Row, Col, Card, Statistic, Typography, Table, Tag, Spin, Space } from 'antd';
import {
  TeamOutlined, FileTextOutlined, CheckCircleOutlined,
  ClockCircleOutlined, CloseCircleOutlined, DatabaseOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { userTypesApi, requestsApi, databaseApi } from '../../services/api';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const StatCard = ({ title, value, icon, color, loading, suffix }) => (
  <Card
    style={{ background: '#12122a', border: '1px solid #2a2a4a', borderRadius: 12 }}
    styles={{ body: { padding: '20px 24px' } }}
  >
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <Statistic
        title={<Text style={{ color: '#8888bb', fontSize: 13 }}>{title}</Text>}
        value={value}
        styles={{ content: { color, fontWeight: 700, fontSize: 28 } }}
        loading={loading}
        suffix={suffix}
      />
      <div style={{
        width: 48, height: 48, borderRadius: 12,
        background: `${color}18`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 22, color,
      }}>
        {icon}
      </div>
    </div>
  </Card>
);

const statusConfig = {
  pending:  { color: 'gold',    label: 'قيد المراجعة', icon: <ClockCircleOutlined /> },
  approved: { color: 'green',   label: 'مقبول',        icon: <CheckCircleOutlined /> },
  rejected: { color: 'red',     label: 'مرفوض',        icon: <CloseCircleOutlined /> },
};

export default function DashboardPage() {
  const [stats, setStats] = useState({ userTypes: 0, total: 0, pending: 0, approved: 0, rejected: 0, activeUT: 0 });
  const [recentRequests, setRecentRequests] = useState([]);
  const [dbHealth, setDbHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [utRes, reqRes, dbRes] = await Promise.allSettled([
          userTypesApi.getAll({ per_page: 100 }),
          requestsApi.getAll({ per_page: 5, sort: 'created_at', order: 'desc' }),
          databaseApi.health(),
        ]);

        if (utRes.status === 'fulfilled') {
          const d = utRes.value.data.data;
          setStats(s => ({
            ...s,
            userTypes: d.metadata?.total_count ?? 0,
            activeUT: d.metadata?.active_count ?? 0,
          }));
        }
        if (reqRes.status === 'fulfilled') {
          const d = reqRes.value.data.data;
          setStats(s => ({
            ...s,
            total: d.stats?.total ?? d.metadata?.total_count ?? 0,
            pending: d.stats?.pending ?? 0,
            approved: d.stats?.approved ?? 0,
            rejected: d.stats?.rejected ?? 0,
          }));
          setRecentRequests(d.requests || []);
        }
        if (dbRes.status === 'fulfilled') {
          setDbHealth(dbRes.value.data.data);
        }
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  const columns = [
    {
      title: 'رقم الطلب',
      dataIndex: 'id',
      width: 90,
      render: (id) => <Text style={{ color: '#6C63FF' }}>#{id}</Text>,
    },
    {
      title: 'نوع المستخدم',
      key: 'type_name',
      render: (_, r) => <Tag color="purple">{r.type_name || r.user_type_name || '-'}</Tag>,
    },
    {
      title: 'الحالة',
      dataIndex: 'status',
      render: (status) => {
        const cfg = statusConfig[status] || { color: 'default', label: status };
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    {
      title: 'تاريخ التقديم',
      dataIndex: 'created_at',
      render: (v) => v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '-',
    },
    {
      title: '',
      key: 'action',
      render: (_, r) => (
        <Text
          style={{ color: '#6C63FF', cursor: 'pointer', fontSize: 13 }}
          onClick={() => navigate(`/admin/requests/${r.id}`)}
        >
          عرض
        </Text>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Title level={3} style={{ color: '#e0e0ff', margin: 0 }}>لوحة التحكم</Title>
        <Text style={{ color: '#8888bb' }}>مرحباً بك في نظام إدارة الطلبات</Text>
      </div>

      {/* Stats */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={8} lg={4}>
          <StatCard title="أنواع المستخدمين" value={stats.userTypes} icon={<TeamOutlined />} color="#6C63FF" loading={loading} />
        </Col>
        <Col xs={12} sm={8} lg={4}>
          <StatCard title="إجمالي الطلبات" value={stats.total} icon={<FileTextOutlined />} color="#00b4d8" loading={loading} />
        </Col>
        <Col xs={12} sm={8} lg={4}>
          <StatCard title="قيد المراجعة" value={stats.pending} icon={<ClockCircleOutlined />} color="#faad14" loading={loading} />
        </Col>
        <Col xs={12} sm={8} lg={4}>
          <StatCard title="مقبولة" value={stats.approved} icon={<CheckCircleOutlined />} color="#00e676" loading={loading} />
        </Col>
        <Col xs={12} sm={8} lg={4}>
          <StatCard title="مرفوضة" value={stats.rejected} icon={<CloseCircleOutlined />} color="#ff5252" loading={loading} />
        </Col>
        <Col xs={12} sm={8} lg={4}>
          <StatCard
            title="حالة قاعدة البيانات"
            value={dbHealth?.status === 'healthy' ? 'سليمة' : dbHealth ? 'تحذير' : '-'}
            icon={<DatabaseOutlined />}
            color={dbHealth?.status === 'healthy' ? '#00e676' : '#faad14'}
            loading={loading}
          />
        </Col>
      </Row>

      {/* Recent Requests */}
      <Card
        title={<Text style={{ color: '#e0e0ff' }}>آخر الطلبات</Text>}
        extra={
          <Text
            style={{ color: '#6C63FF', cursor: 'pointer', fontSize: 13 }}
            onClick={() => navigate('/admin/requests')}
          >
            عرض الكل
          </Text>
        }
        style={{ background: '#12122a', border: '1px solid #2a2a4a', borderRadius: 12 }}
        styles={{ header: { borderBottom: '1px solid #2a2a4a' } }}
      >
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
        ) : (
          <Table
            columns={columns}
            dataSource={recentRequests}
            rowKey="id"
            pagination={false}
            size="small"
            locale={{ emptyText: 'لا توجد طلبات بعد' }}
          />
        )}
      </Card>
    </div>
  );
}
