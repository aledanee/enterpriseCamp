import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Layout, Menu, Button, Avatar, Typography, Dropdown, Space, Badge,
} from 'antd';
import {
  DashboardOutlined, TeamOutlined, FileTextOutlined, DatabaseOutlined,
  AppstoreOutlined, LogoutOutlined, UserOutlined, MenuFoldOutlined,
  MenuUnfoldOutlined, BellOutlined,
} from '@ant-design/icons';
import { useAuth } from '../context/AuthContext';

const { Sider, Header, Content } = Layout;
const { Text } = Typography;

const menuItems = [
  { key: '/admin/dashboard', icon: <DashboardOutlined />, label: 'لوحة التحكم' },
  { key: '/admin/user-types', icon: <TeamOutlined />, label: 'أنواع المستخدمين' },
  { key: '/admin/requests', icon: <FileTextOutlined />, label: 'الطلبات' },
  { key: '/admin/fields-master', icon: <AppstoreOutlined />, label: 'الحقول الرئيسية' },
  { key: '/admin/database', icon: <DatabaseOutlined />, label: 'قاعدة البيانات' },
];

export default function AdminLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const { admin, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate('/admin/login');
  };

  const profileMenu = {
    items: [
      { key: 'email', label: <Text type="secondary">{admin?.email}</Text>, disabled: true },
      { type: 'divider' },
      { key: 'logout', icon: <LogoutOutlined />, label: 'تسجيل الخروج', danger: true, onClick: handleLogout },
    ],
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        trigger={null}
        width={230}
        style={{
          background: '#0d0d20',
          borderLeft: '1px solid #2a2a4a',
          position: 'sticky',
          top: 0,
          height: '100vh',
          overflow: 'auto',
        }}
      >
        {/* Logo */}
        <div style={{
          padding: collapsed ? '20px 8px' : '20px 24px',
          borderBottom: '1px solid #2a2a4a',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          transition: 'all 0.2s',
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'linear-gradient(135deg, #6C63FF, #00e676)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, fontSize: 16, color: '#fff', flexShrink: 0,
          }}>L</div>
          {!collapsed && (
            <Text strong style={{ color: '#e0e0ff', fontSize: 18 }}>LesOne</Text>
          )}
        </div>

        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ background: 'transparent', border: 'none', marginTop: 8 }}
        />
      </Sider>

      <Layout>
        <Header style={{
          background: '#0d0d20',
          borderBottom: '1px solid #2a2a4a',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}>
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
            style={{ color: '#8888bb', fontSize: 16 }}
          />

          <Space size={16}>
            <Badge count={0} showZero={false}>
              <Button type="text" icon={<BellOutlined />} style={{ color: '#8888bb' }} />
            </Badge>
            <Dropdown menu={profileMenu} placement="bottomLeft" trigger={['click']}>
              <Space style={{ cursor: 'pointer' }}>
                <Avatar
                  size={34}
                  style={{ background: 'linear-gradient(135deg, #6C63FF, #00e676)', fontSize: 14 }}
                  icon={<UserOutlined />}
                />
                {admin?.email && (
                  <Text style={{ color: '#8888bb', fontSize: 13 }}>
                    {admin.email.split('@')[0]}
                  </Text>
                )}
              </Space>
            </Dropdown>
          </Space>
        </Header>

        <Content style={{ padding: '24px', background: '#0a0a1a', minHeight: 'calc(100vh - 64px)' }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
