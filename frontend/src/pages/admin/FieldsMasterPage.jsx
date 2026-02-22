import { useEffect, useState } from 'react';
import {
  Table, Input, Card, Typography, Tag, message, Button, Modal,
  Form, Select, Space, Popconfirm, Tooltip,
} from 'antd';
import {
  SearchOutlined, PlusOutlined, EditOutlined, DeleteOutlined,
  ExclamationCircleOutlined, MinusCircleOutlined, PlusCircleOutlined,
} from '@ant-design/icons';
import { fieldsMasterApi } from '../../services/api';

const { Title, Text } = Typography;
const { Option } = Select;

const TYPE_COLORS = {
  text: 'blue', number: 'orange', email: 'cyan', tel: 'green',
  date: 'purple', dropdown: 'magenta', textarea: 'geekblue',
};

const TYPE_LABELS = {
  text: 'نص', number: 'رقم', email: 'بريد إلكتروني', tel: 'هاتف',
  date: 'تاريخ', dropdown: 'قائمة منسدلة', textarea: 'نص طويل',
};

const FIELD_TYPES = ['text', 'email', 'tel', 'number', 'dropdown', 'textarea'];

const normalize = (f) => ({
  id: f.id,
  fieldName: f.field_name || f.fieldName,
  fieldLabel: f.field_label || f.fieldLabel,
  fieldType: f.field_type || f.fieldType,
  fieldOptions: f.field_options || f.fieldOptions,
  createdAt: f.created_at || f.createdAt,
  updatedAt: f.updated_at || f.updatedAt,
});

export default function FieldsMasterPage() {
  const [data, setData] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();
  const selectedType = Form.useWatch('field_type', form);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fieldsMasterApi.getAll();
      const fields = (res.data.data?.fields || []).map(normalize);
      setData(fields);
      setFiltered(fields);
    } catch {
      message.error('فشل تحميل الحقول الرئيسية');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    if (!search) { setFiltered(data); return; }
    const q = search.toLowerCase();
    setFiltered(data.filter(f =>
      (f.fieldName || '').toLowerCase().includes(q) ||
      (f.fieldLabel || '').toLowerCase().includes(q)
    ));
  }, [search, data]);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEdit = (record) => {
    setEditing(record);
    form.setFieldsValue({
      field_name: record.fieldName,
      field_label: record.fieldLabel,
      field_type: record.fieldType,
      field_options: record.fieldOptions || [],
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);

      if (values.field_type !== 'dropdown') {
        values.field_options = null;
      }

      if (editing) {
        await fieldsMasterApi.update(editing.id, values);
        message.success('تم تعديل الحقل بنجاح');
      } else {
        await fieldsMasterApi.create(values);
        message.success('تم إنشاء الحقل بنجاح');
      }

      setModalOpen(false);
      form.resetFields();
      fetchData();
    } catch (err) {
      if (err.response?.data?.message) {
        message.error(err.response.data.message);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (record) => {
    try {
      await fieldsMasterApi.delete(record.id, false);
      message.success('تم حذف الحقل بنجاح');
      fetchData();
    } catch (err) {
      const errData = err.response?.data;
      if (errData?.error === 'Field in use') {
        Modal.confirm({
          title: 'الحقل مستخدم',
          icon: <ExclamationCircleOutlined />,
          content: (
            <div>
              <p>{errData.message}</p>
              {errData.data?.used_by?.map(ut => (
                <Tag key={ut.user_type_id} color="orange" style={{ marginBottom: 4 }}>
                  {ut.type_name}
                </Tag>
              ))}
            </div>
          ),
          okText: 'حذف بالقوة',
          okType: 'danger',
          cancelText: 'إلغاء',
          async onOk() {
            await fieldsMasterApi.delete(record.id, true);
            message.success('تم حذف الحقل بنجاح');
            fetchData();
          },
        });
      } else {
        message.error(errData?.message || 'فشل حذف الحقل');
      }
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
      title: 'المعرف (fieldName)',
      dataIndex: 'fieldName',
      render: (v) => <Tag color="purple" style={{ fontFamily: 'monospace' }}>{v}</Tag>,
    },
    {
      title: 'التسمية (fieldLabel)',
      dataIndex: 'fieldLabel',
      render: (v) => <Text style={{ color: '#e0e0ff' }}>{v || '-'}</Text>,
    },
    {
      title: 'نوع الحقل',
      dataIndex: 'fieldType',
      render: (v) => (
        <Tag color={TYPE_COLORS[v] || 'default'}>
          {TYPE_LABELS[v] || v}
        </Tag>
      ),
    },
    {
      title: 'خيارات',
      dataIndex: 'fieldOptions',
      render: (v) => {
        if (!v) return <Text style={{ color: '#8888bb' }}>-</Text>;
        const opts = Array.isArray(v) ? v : (typeof v === 'object' ? Object.values(v) : [v]);
        return (
          <div>
            {opts.slice(0, 4).map((o, i) => (
              <Tag key={i} style={{ marginBottom: 2 }}>{String(o)}</Tag>
            ))}
            {opts.length > 4 && <Tag>+{opts.length - 4}</Tag>}
          </div>
        );
      },
    },
    {
      title: 'تاريخ الإنشاء',
      dataIndex: 'createdAt',
      width: 130,
      render: (v) => v ? new Date(v).toLocaleDateString('ar') : '-',
    },
    {
      title: 'إجراءات',
      width: 120,
      render: (_, record) => (
        <Space>
          <Tooltip title="تعديل">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => openEdit(record)}
              style={{ color: '#6C63FF' }}
            />
          </Tooltip>
          <Popconfirm
            title="هل تريد حذف هذا الحقل؟"
            okText="حذف"
            cancelText="إلغاء"
            onConfirm={() => handleDelete(record)}
          >
            <Tooltip title="حذف">
              <Button
                type="text"
                icon={<DeleteOutlined />}
                style={{ color: '#ff5252' }}
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <Title level={3} style={{ color: '#e0e0ff', margin: 0 }}>الحقول الرئيسية</Title>
          <Text style={{ color: '#8888bb' }}>مجموع الحقول المتاحة: {data.length}</Text>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={openCreate}
          style={{
            background: 'linear-gradient(135deg, #6C63FF, #8b7fff)',
            border: 'none',
            fontWeight: 600,
          }}
        >
          إضافة حقل جديد
        </Button>
      </div>

      <Card
        style={{ background: '#12122a', border: '1px solid #2a2a4a', borderRadius: 12, marginBottom: 16 }}
        styles={{ body: { padding: '16px 20px' } }}
      >
        <Input
          placeholder="بحث بالاسم أو التسمية..."
          prefix={<SearchOutlined style={{ color: '#8888bb' }} />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ background: '#1a1a36', border: '1px solid #2a2a4a', maxWidth: 360 }}
          allowClear
        />
      </Card>

      <Card
        style={{ background: '#12122a', border: '1px solid #2a2a4a', borderRadius: 12 }}
        styles={{ body: { padding: 0 } }}
      >
        <Table
          columns={columns}
          dataSource={filtered}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 20, style: { padding: '12px 20px' } }}
          locale={{ emptyText: 'لا توجد حقول' }}
          size="middle"
        />
      </Card>

      {/* Create / Edit Modal */}
      <Modal
        open={modalOpen}
        title={editing ? 'تعديل الحقل' : 'إضافة حقل جديد'}
        okText={editing ? 'حفظ التعديلات' : 'إنشاء'}
        cancelText="إلغاء"
        onCancel={() => { setModalOpen(false); form.resetFields(); }}
        onOk={handleSave}
        confirmLoading={saving}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="field_name"
            label="اسم الحقل (field_name)"
            rules={[
              { required: true, message: 'اسم الحقل مطلوب' },
              { pattern: /^[a-zA-Z0-9_]+$/, message: 'حروف إنجليزية وأرقام و _ فقط' },
              { min: 2, message: 'حرفين على الأقل' },
            ]}
          >
            <Input placeholder="مثال: full_name" style={{ direction: 'ltr' }} />
          </Form.Item>

          <Form.Item
            name="field_label"
            label="التسمية (field_label)"
            rules={[{ required: true, message: 'التسمية مطلوبة' }]}
          >
            <Input placeholder="مثال: الاسم الكامل" />
          </Form.Item>

          <Form.Item
            name="field_type"
            label="نوع الحقل"
            rules={[{ required: true, message: 'نوع الحقل مطلوب' }]}
          >
            <Select placeholder="اختر نوع الحقل">
              {FIELD_TYPES.map(t => (
                <Option key={t} value={t}>
                  <Tag color={TYPE_COLORS[t]}>{TYPE_LABELS[t]}</Tag> ({t})
                </Option>
              ))}
            </Select>
          </Form.Item>

          {selectedType === 'dropdown' && (
            <Form.List name="field_options" initialValue={['']}>
              {(fields, { add, remove }) => (
                <div>
                  <Text style={{ color: '#8888bb', display: 'block', marginBottom: 8 }}>
                    خيارات القائمة المنسدلة
                  </Text>
                  {fields.map(({ key, name, ...rest }) => (
                    <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align="center">
                      <Form.Item
                        {...rest}
                        name={name}
                        rules={[{ required: true, message: 'أدخل قيمة الخيار' }]}
                        style={{ marginBottom: 0, flex: 1 }}
                      >
                        <Input placeholder={`الخيار ${name + 1}`} />
                      </Form.Item>
                      {fields.length > 1 && (
                        <MinusCircleOutlined
                          onClick={() => remove(name)}
                          style={{ color: '#ff5252', fontSize: 18 }}
                        />
                      )}
                    </Space>
                  ))}
                  <Button
                    type="dashed"
                    onClick={() => add()}
                    block
                    icon={<PlusCircleOutlined />}
                  >
                    إضافة خيار
                  </Button>
                </div>
              )}
            </Form.List>
          )}
        </Form>
      </Modal>
    </div>
  );
}
