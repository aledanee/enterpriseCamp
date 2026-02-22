import { useEffect, useState, useCallback } from 'react';
import {
  Table, Button, Input, Select, Tag, Space, Typography, Popconfirm,
  Switch, message, Card, Row, Col, Tooltip, Modal,
} from 'antd';
import {
  PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined,
  InfoCircleOutlined, ExclamationCircleOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { userTypesApi } from '../../services/api';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;

export default function UserTypesPage() {
  const [data, setData] = useState([]);
  const [meta, setMeta] = useState({});
  const [loading, setLoading] = useState(false);
  const [params, setParams] = useState({ page: 1, per_page: 25, search: '', status: 'all', sort: 'name', order: 'asc' });
  const navigate = useNavigate();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await userTypesApi.getAll(params);
      const d = res.data.data;
      setData(d.user_types || []);
      setMeta(d.metadata || {});
    } catch {
      message.error('فشل تحميل أنواع المستخدمين');
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleStatusToggle = async (id, checked) => {
    try {
      await userTypesApi.updateStatus(id, { is_active: checked });
      message.success(`تم ${checked ? 'تفعيل' : 'إلغاء تفعيل'} النوع`);
      fetchData();
    } catch (err) {
      message.error(err.response?.data?.message || 'فشل تحديث الحالة');
    }
  };

  const handleDelete = async (id) => {
    try {
      const infoRes = await userTypesApi.getDeleteInfo(id);
      const info = infoRes.data.data;
      Modal.confirm({
        title: 'تأكيد الحذف',
        icon: <ExclamationCircleOutlined style={{ color: '#ff5252' }} />,
        content: (
          <div style={{ direction: 'rtl' }}>
            <p style={{ marginBottom: 8 }}>هل أنت متأكد من حذف هذا النوع؟</p>
            {info?.associated_requests > 0 && (
              <Tag color="red">يحتوي على {info.associated_requests} طلب مرتبط</Tag>
            )}
          </div>
        ),
        okText: 'حذف',
        okButtonProps: { danger: true },
        cancelText: 'إلغاء',
        onOk: async () => {
          await userTypesApi.delete(id, true);
          message.success('تم الحذف بنجاح');
          fetchData();
        },
      });
    } catch (err) {
      message.error(err.response?.data?.message || 'فشل الحذف');
    }
  };

  const columns = [
    {
      title: '#',
      dataIndex: 'id',
      width: 60,
      render: (v) => <Text style={{ color: '#8888bb' }}>{v}</Text>,
    },
    {
      title: 'الاسم',
      dataIndex: 'type_name',
      render: (v) => <Text strong style={{ color: '#e0e0ff' }}>{v}</Text>,
    },
    {
      title: 'عدد الحقول',
      dataIndex: 'fields_count',
      width: 110,
      render: (v) => <Tag color="purple">{v ?? 0} حقل</Tag>,
    },
    {
      title: 'الطلبات',
      dataIndex: 'usage_stats',
      width: 110,
      render: (v) => <Tag color="blue">{v?.total_requests ?? 0} طلب</Tag>,
    },
    {
      title: 'الحالة',
      dataIndex: 'is_active',
      width: 100,
      render: (val, record) => (
        <Switch
          checked={val}
          size="small"
          onChange={(c) => handleStatusToggle(record.id, c)}
          checkedChildren="فعّال"
          unCheckedChildren="معطّل"
        />
      ),
    },
    {
      title: 'تاريخ الإنشاء',
      dataIndex: 'created_at',
      width: 130,
      render: (v) => v ? dayjs(v).format('YYYY-MM-DD') : '-',
    },
    {
      title: 'الإجراءات',
      key: 'actions',
      width: 130,
      render: (_, record) => (
        <Space>
          <Tooltip title="تعديل">
            <Button
              type="text" size="small" icon={<EditOutlined />}
              style={{ color: '#6C63FF' }}
              onClick={() => navigate(`/admin/user-types/${record.id}/edit`)}
            />
          </Tooltip>
          <Tooltip title="حذف">
            <Button
              type="text" size="small" icon={<DeleteOutlined />}
              style={{ color: '#ff5252' }}
              onClick={() => handleDelete(record.id)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <Title level={3} style={{ color: '#e0e0ff', margin: 0 }}>أنواع المستخدمين</Title>
          <Text style={{ color: '#8888bb' }}>
            إجمالي: {meta.total_count ?? 0} | فعّال: {meta.active_count ?? 0} | معطّل: {meta.inactive_count ?? 0}
          </Text>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => navigate('/admin/user-types/new')}
          style={{ background: 'linear-gradient(135deg,#6C63FF,#8b7fff)', border: 'none' }}
        >
          نوع جديد
        </Button>
      </div>

      {/* Filters */}
      <Card
        style={{ background: '#12122a', border: '1px solid #2a2a4a', borderRadius: 12, marginBottom: 16 }}
        styles={{ body: { padding: '16px 20px' } }}
      >
        <Row gutter={12} align="middle">
          <Col flex="1">
            <Input
              placeholder="بحث بالاسم..."
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
              style={{ width: 140 }}
            >
              <Option value="all">الكل</Option>
              <Option value="active">فعّال</Option>
              <Option value="inactive">معطّل</Option>
            </Select>
          </Col>
          <Col>
            <Select
              value={params.sort}
              onChange={(v) => setParams(p => ({ ...p, sort: v, page: 1 }))}
              style={{ width: 140 }}
            >
              <Option value="name">الاسم</Option>
              <Option value="created_at">تاريخ الإنشاء</Option>
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
          pagination={{
            current: params.page,
            pageSize: params.per_page,
            total: meta.total_count,
            showSizeChanger: true,
            pageSizeOptions: ['10', '25', '50'],
            onChange: (page, per_page) => setParams(p => ({ ...p, page, per_page })),
            style: { padding: '12px 20px' },
          }}
          locale={{ emptyText: 'لا توجد أنواع مستخدمين' }}
          size="middle"
        />
      </Card>
    </div>
  );
}
