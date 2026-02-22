import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Form, Input, Button, Card, Typography, Checkbox, InputNumber,
  Table, Space, message, Spin, Divider, Tag, Alert,
} from 'antd';
import { ArrowRightOutlined, SaveOutlined } from '@ant-design/icons';
import { userTypesApi } from '../../services/api';

const { Title, Text } = Typography;

export default function UserTypeFormPage() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const [form] = Form.useForm();

  const [fields, setFields] = useState([]);
  const [selectedFields, setSelectedFields] = useState([]);
  const [loading, setLoading] = useState(false);
  const [initLoading, setInitLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        const fRes = await userTypesApi.getFieldsMaster();
        const allFields = fRes.data.data?.fields || [];
        setFields(allFields);

        if (isEdit) {
          const utRes = await userTypesApi.getOne(id);
          const ut = utRes.data.data;
          form.setFieldsValue({ type_name: ut.user_type?.type_name });
          const existing = (ut.fields || []).map(f => ({
            field_id: f.field_id,
            is_required: f.is_required,
            field_order: f.field_order,
          }));
          setSelectedFields(existing);
        }
      } catch {
        message.error('فشل تحميل البيانات');
      } finally {
        setInitLoading(false);
      }
    };
    init();
  }, [id, isEdit, form]);

  const isFieldSelected = (fieldId) => selectedFields.some(f => f.field_id === fieldId);

  const toggleField = (fieldId) => {
    setSelectedFields(prev => {
      if (prev.some(f => f.field_id === fieldId)) {
        return prev.filter(f => f.field_id !== fieldId);
      }
      // Always use max existing order + 1 to prevent duplicates when fields are removed then added
      const nextOrder = prev.length > 0 ? Math.max(...prev.map(f => f.field_order || 0)) + 1 : 1;
      return [...prev, { field_id: fieldId, is_required: false, field_order: nextOrder }];
    });
  };

  const updateField = (fieldId, key, value) => {
    setSelectedFields(prev =>
      prev.map(f => f.field_id === fieldId ? { ...f, [key]: value } : f)
    );
  };

  const onFinish = async (values) => {
    if (selectedFields.length === 0) {
      message.error('يجب اختيار حقل واحد على الأقل');
      return;
    }
    setLoading(true);
    try {
      const payload = { type_name: values.type_name, selectedFields };
      if (isEdit) {
        await userTypesApi.update(id, payload);
        message.success('تم تحديث النوع بنجاح');
      } else {
        await userTypesApi.create(payload);
        message.success('تم إنشاء النوع بنجاح');
      }
      navigate('/admin/user-types');
    } catch (err) {
      message.error(err.response?.data?.message || 'فشلت العملية');
    } finally {
      setLoading(false);
    }
  };

  const fieldTypeLabel = { text: 'نص', number: 'رقم', email: 'بريد', tel: 'هاتف', phone: 'هاتف', date: 'تاريخ', select: 'قائمة', dropdown: 'قائمة منسدلة', textarea: 'نص طويل' };

  const allFieldsColumns = [
    {
      title: 'اختيار',
      key: 'select',
      width: 70,
      render: (_, r) => (
        <Checkbox checked={isFieldSelected(r.id)} onChange={() => toggleField(r.id)} />
      ),
    },
    { title: 'الحقل', dataIndex: 'fieldLabel', render: (v, r) => <Text style={{ color: '#e0e0ff' }}>{v || r.fieldName}</Text> },
    { title: 'المعرّف', dataIndex: 'fieldName', render: (v) => <Tag color="purple">{v}</Tag> },
    { title: 'النوع', dataIndex: 'fieldType', render: (v) => <Tag>{fieldTypeLabel[v] || v}</Tag> },
  ];

  const selectedColumns = [
    { title: 'الحقل', dataIndex: 'field_id', render: (id) => { const f = fields.find(x => x.id === id); return <Text style={{ color: '#e0e0ff' }}>{f?.fieldLabel || f?.fieldName || id}</Text>; } },
    {
      title: 'الترتيب',
      key: 'order',
      width: 100,
      render: (_, r) => (
        <InputNumber
          min={1} value={r.field_order} size="small"
          precision={0}
          onChange={(v) => updateField(r.field_id, 'field_order', v ?? r.field_order)}
          style={{ width: 70 }}
        />
      ),
    },
    {
      title: 'إلزامي',
      key: 'required',
      width: 80,
      render: (_, r) => (
        <Checkbox checked={r.is_required} onChange={(e) => updateField(r.field_id, 'is_required', e.target.checked)} />
      ),
    },
    {
      title: '',
      key: 'remove',
      width: 60,
      render: (_, r) => (
        <Button type="text" danger size="small" onClick={() => toggleField(r.field_id)}>إزالة</Button>
      ),
    },
  ];

  if (initLoading) return <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>;

  return (
    <div>
      <Space style={{ marginBottom: 20 }}>
        <Button
          type="text" icon={<ArrowRightOutlined />}
          onClick={() => navigate('/admin/user-types')}
          style={{ color: '#8888bb' }}
        />
        <Title level={3} style={{ color: '#e0e0ff', margin: 0 }}>
          {isEdit ? 'تعديل نوع المستخدم' : 'إنشاء نوع مستخدم جديد'}
        </Title>
      </Space>

      <Form form={form} layout="vertical" onFinish={onFinish}>
        <Card
          title={<Text style={{ color: '#e0e0ff' }}>معلومات أساسية</Text>}
          style={{ background: '#12122a', border: '1px solid #2a2a4a', borderRadius: 12, marginBottom: 16 }}
          styles={{ header: { borderBottom: '1px solid #2a2a4a' } }}
        >
          <Form.Item
            label={<Text style={{ color: '#8888bb' }}>اسم النوع</Text>}
            name="type_name"
            rules={[
              { required: true, message: 'الاسم مطلوب' },
              { min: 2, message: 'يجب أن يكون الاسم حرفين على الأقل' },
              { pattern: /^[a-zA-Z0-9_]+$/, message: 'يُسمح فقط بالأحرف والأرقام والشرطة السفلية' },
            ]}
          >
            <Input placeholder="مثال: student" style={{ background: '#1a1a36', border: '1px solid #2a2a4a', maxWidth: 320 }} />
          </Form.Item>
        </Card>

        {/* Fields selection */}
        <Card
          title={<Text style={{ color: '#e0e0ff' }}>اختيار الحقول من الحقول الرئيسية</Text>}
          style={{ background: '#12122a', border: '1px solid #2a2a4a', borderRadius: 12, marginBottom: 16 }}
          styles={{ header: { borderBottom: '1px solid #2a2a4a' } }}
        >
          <Table
            columns={allFieldsColumns}
            dataSource={fields}
            rowKey="id"
            pagination={false}
            size="small"
            scroll={{ y: 280 }}
            locale={{ emptyText: 'لا توجد حقول' }}
          />
        </Card>

        {/* Selected fields config */}
        {selectedFields.length > 0 && (
          <Card
            title={<Text style={{ color: '#e0e0ff' }}>إعداد الحقول المختارة <Tag color="purple">{selectedFields.length}</Tag></Text>}
            style={{ background: '#12122a', border: '1px solid #2a2a4a', borderRadius: 12, marginBottom: 16 }}
            styles={{ header: { borderBottom: '1px solid #2a2a4a' } }}
          >
            <Table
              columns={selectedColumns}
              dataSource={selectedFields}
              rowKey="field_id"
              pagination={false}
              size="small"
              locale={{ emptyText: 'لم يتم اختيار حقول' }}
            />
          </Card>
        )}

        {selectedFields.length === 0 && (
          <Alert
            message="يجب اختيار حقل واحد على الأقل"
            type="warning"
            showIcon
            style={{ marginBottom: 16, background: 'rgba(250,173,20,0.1)', border: '1px solid rgba(250,173,20,0.3)' }}
          />
        )}

        <Space>
          <Button
            type="primary"
            htmlType="submit"
            loading={loading}
            icon={<SaveOutlined />}
            style={{ background: 'linear-gradient(135deg,#6C63FF,#8b7fff)', border: 'none' }}
          >
            {isEdit ? 'حفظ التعديلات' : 'إنشاء'}
          </Button>
          <Button onClick={() => navigate('/admin/user-types')} style={{ borderColor: '#2a2a4a', color: '#8888bb' }}>
            إلغاء
          </Button>
        </Space>
      </Form>
    </div>
  );
}
