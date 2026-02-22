import { useEffect, useState, useCallback } from 'react';
import {
  Table, Input, Select, Tag, Space, Typography, Card,
  Row, Col, Button, message,
} from 'antd';
import { SearchOutlined, EyeOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { requestsApi } from '../../services/api';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;

const STATUS_CONFIG = {
  pending:  { color: 'gold',  label: 'قيد المراجعة' },
  approved: { color: 'green', label: 'مقبول' },
  rejected: { color: 'red',   label: 'مرفوض' },
};

export default function RequestsPage() {
  const [data, setData] = useState([]);
  const [meta, setMeta] = useState({});
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(false);
  const [params, setParams] = useState({ page: 1, per_page: 25, search: '', status: 'all' });
  const navigate = useNavigate();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await requestsApi.getAll(params);
      const d = res.data.data;
      setData(d.requests || []);
      setMeta(d.metadata || {});
      setStats(d.stats || {});
    } catch {
      message.error('فشل تحميل الطلبات');
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const columns = [
    {
      title: '#',
      dataIndex: 'id',
      width: 70,
      render: (v) => <Text style={{ color: '#6C63FF' }}>#{v}</Text>,
    },
    {
      title: 'نوع المستخدم',
      key: 'type_name',
      render: (_, r) => <Tag color="purple">{r.type_name || r.user_type_name || '-'}</Tag>,
    },
    {
      title: 'الاسم',
      key: 'name',
      render: (_, r) => {
        const data = r.data || r.form_data || r.formData || {};
        const name = data.name || data.full_name || data.الاسم || Object.values(data)[0] || '-';
        return <Text style={{ color: '#e0e0ff' }}>{name}</Text>;
      },
    },
    {
      title: 'الحالة',
      dataIndex: 'status',
      render: (v) => {
        const cfg = STATUS_CONFIG[v] || { color: 'default', label: v };
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    {
      title: 'تاريخ التقديم',
      dataIndex: 'created_at',
      render: (v) => v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '-',
    },
    {
      title: 'الإجراءات',
      key: 'action',
      width: 80,
      render: (_, r) => (
        <Button
          type="text" size="small" icon={<EyeOutlined />}
          style={{ color: '#6C63FF' }}
          onClick={() => navigate(`/admin/requests/${r.id}`)}
        />
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <Title level={3} style={{ color: '#e0e0ff', margin: 0 }}>الطلبات</Title>
        <Text style={{ color: '#8888bb' }}>
          إجمالي: {meta.total_count ?? 0}
          {stats.pending !== undefined && ` | قيد المراجعة: ${stats.pending}`}
          {stats.approved !== undefined && ` | مقبول: ${stats.approved}`}
          {stats.rejected !== undefined && ` | مرفوض: ${stats.rejected}`}
        </Text>
      </div>

      <Card
        style={{ background: '#12122a', border: '1px solid #2a2a4a', borderRadius: 12, marginBottom: 16 }}
        styles={{ body: { padding: '16px 20px' } }}
      >
        <Row gutter={12}>
          <Col flex="1">
            <Input
              placeholder="بحث..."
              prefix={<SearchOutlined style={{ color: '#8888bb' }} />}
              value={params.search}
              onChange={(e) => setParams(p => ({ ...p, search: e.target.value, page: 1 }))}
              style={{ background: '#1a1a36', border: '1px solid #2a2a4a' }}
              allowClear
            />
          </Col>
          <Col>
            <Select
              value={params.status}
              onChange={(v) => setParams(p => ({ ...p, status: v, page: 1 }))}
              style={{ width: 160 }}
            >
              <Option value="all">جميع الحالات</Option>
              <Option value="pending">قيد المراجعة</Option>
              <Option value="approved">مقبول</Option>
              <Option value="rejected">مرفوض</Option>
            </Select>
          </Col>
        </Row>
      </Card>

      <Card
        style={{ background: '#12122a', border: '1px solid #2a2a4a', borderRadius: 12 }}
        styles={{ body: { padding: 0 } }}
      >
        <Table
          columns={columns}
          dataSource={data}
          rowKey="id"
          loading={loading}
          onRow={(r) => ({ onClick: () => navigate(`/admin/requests/${r.id}`), style: { cursor: 'pointer' } })}
          pagination={{
            current: params.page,
            pageSize: params.per_page,
            total: meta.total_count,
            showSizeChanger: true,
            pageSizeOptions: ['10', '25', '50'],
            onChange: (page, per_page) => setParams(p => ({ ...p, page, per_page })),
            style: { padding: '12px 20px' },
          }}
          locale={{ emptyText: 'لا توجد طلبات' }}
          size="middle"
        />
      </Card>
    </div>
  );
}
