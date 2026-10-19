import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { App as AntApp, Alert, Avatar, Badge, Button, ConfigProvider, Drawer, Dropdown, Empty, Form, Input, Skeleton, Space, Spin, Tooltip } from 'antd';
import { AppstoreOutlined, ArrowRightOutlined, BarChartOutlined, BellOutlined, CalendarOutlined, CheckCircleOutlined, ClockCircleOutlined, DashboardOutlined, ExportOutlined, LogoutOutlined, MenuOutlined, PlusOutlined, ReloadOutlined, SettingOutlined, TeamOutlined, UserOutlined } from '@ant-design/icons';
import { type Activity, type Application, type Person, type Settings, post, request } from './api';
import { ActivityPage, AttendancePage, AuditPage, Dashboard, NotificationPage, PeoplePage, ReportsPage, ReviewPage, SettingsPage } from './pages';
import { ActivityForm } from './components';

export type Data = { activities: Activity[]; applications: Application[]; people: Person[]; settings: Settings | null };
const DataContext = createContext<Data & { reload: () => Promise<void>; createActivity: () => void }>({ activities: [], applications: [], people: [], settings: null, reload: async () => {}, createActivity: () => {} });
export const useData = () => useContext(DataContext);

export function Sprout({ className = '' }: { className?: string }) {
  return <svg viewBox="0 0 32 32" fill="none" className={`sprout ${className}`} aria-hidden="true"><path d="M16 27V15M16 19C6 20 4 12 4 6c9 0 14 4 12 13ZM16 15C15 6 21 3 29 3c0 8-4 13-13 12Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}

function Login({ enter }: { enter: (token: string) => void }) {
  const { message } = AntApp.useApp(); const [busy, setBusy] = useState(false); const [demo, setDemo] = useState(false);
  useEffect(() => { request<{ demo: boolean }>('config').then(data => setDemo(data.demo)).catch(() => {}); }, []);
  const submit = async (path: string, data?: unknown) => { setBusy(true); try { const result = await post<{ token: string }>(path, data); enter(result.token); } catch (e) { message.error((e as Error).message); } finally { setBusy(false); } };
  return <div className="login-page"><section className="login-story"><div className="brand"><span className="brand-mark"><Sprout /></span><div><strong>青禾志愿</strong><small>QINGHE VOLUNTEER</small></div></div><div className="login-copy"><span className="eyebrow">让善意生长 · 让付出可见</span><h1>每一份善意，<br/>都值得被看见。</h1><p>从一次报名，到一段有温度的陪伴。<br/>把繁琐的事情交给青禾，把时间留给真正重要的人。</p><div className="login-plant"><Sprout /></div></div><div className="login-caption">一小步参与，一大份温暖。<span>EST. 2026</span></div></section><section className="login-form"><div><span className="eyebrow">志愿服务管理工作台</span><h2>欢迎回来</h2><p className="muted">有条不紊地，开启今天的志愿工作。</p><Form layout="vertical" onFinish={values => submit('auth/login', values)} initialValues={{ username: 'admin' }}><Form.Item name="username" label="管理账号" rules={[{ required: true, message: '请输入管理账号' }]}><Input prefix={<UserOutlined />} autoComplete="username" size="large" placeholder="请输入账号"/></Form.Item><Form.Item name="password" label="密码" rules={[{ required: true, message: '请输入密码' }]}><Input.Password autoComplete="current-password" size="large" placeholder="请输入密码" /></Form.Item><Button type="primary" htmlType="submit" size="large" block loading={busy}>进入工作台 <ArrowRightOutlined /></Button></Form>{demo && <><div className="login-divider">或先了解青禾</div><Button block size="large" loading={busy} onClick={() => submit('auth/demo')}>进入演示工作台 <ArrowRightOutlined /></Button><p className="small-note">演示数据均为虚构，短信仅模拟发送。</p></>}</div><small className="login-foot">青禾志愿 · 每一小时，都有意义</small></section></div>;
}

const links = [
  { path: '/', label: '工作概览', icon: <DashboardOutlined /> },
  { path: '/activities', label: '活动管理', icon: <AppstoreOutlined /> },
  { path: '/reviews', label: '报名审核', icon: <TeamOutlined /> },
  { path: '/attendance', label: '出勤与时长', icon: <ClockCircleOutlined /> },
  { path: '/reports', label: '统计与导出', icon: <BarChartOutlined /> },
  { path: '/notifications', label: '通知记录', icon: <BellOutlined /> },
  { path: '/people', label: '志愿者档案', icon: <UserOutlined /> },
];

export default function App() {
  const [token, setToken] = useState(sessionStorage.getItem('volunteer-token'));
  const [data, setData] = useState<Data>({ activities: [], applications: [], people: [], settings: null });
  const [busy, setBusy] = useState(true); const [error, setError] = useState(''); const [create, setCreate] = useState(false); const [drawer, setDrawer] = useState(false);
  const location = useLocation();
  const enter = (value: string) => { sessionStorage.setItem('volunteer-token', value); setToken(value); setBusy(true); };
  const logout = useCallback(() => { sessionStorage.removeItem('volunteer-token'); setToken(null); setData({ activities: [], applications: [], people: [], settings: null }); }, []);
  useEffect(() => { window.addEventListener('session-expired', logout); return () => window.removeEventListener('session-expired', logout); }, [logout]);
  const reload = useCallback(async () => {
    try { const [activities, applications, people, settings] = await Promise.all([request<Activity[]>('admin/activities'), request<Application[]>('admin/applications'), request<Person[]>('admin/people'), request<Settings>('admin/system')]); setData({ activities, applications, people, settings }); setError(''); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }, []);
  useEffect(() => { if (token) void reload(); }, [token, reload]);
  useEffect(() => { if (!token) return; const timer = window.setInterval(() => void reload(), 15000); return () => window.clearInterval(timer); }, [token, reload]);
  if (!token) return <Login enter={enter} />;
  const pending = data.applications.filter(a => a.status === 'PENDING').length;
  const current = links.find(link => link.path === location.pathname)?.label || '系统设置';
  const sidebar = <><Link to="/" className="brand" onClick={() => setDrawer(false)}><span className="brand-mark"><Sprout /></span><div><strong>青禾志愿</strong><small>QINGHE VOLUNTEER</small></div></Link><div className="workspace-label">志愿服务中心 <span>工作空间</span></div><nav aria-label="主要导航">{links.map(link => <NavLink key={link.path} to={link.path} end={link.path === '/'} onClick={() => setDrawer(false)}>{link.icon}<span>{link.label}</span>{link.path === '/reviews' && pending > 0 && <b>{pending}</b>}</NavLink>)}</nav><div className="sidebar-bottom"><div className="sidebar-note"><Sprout /><p>让每一份付出<br/>都有迹可循。</p><small>从招募到归档，少一点繁琐。</small></div><NavLink to="/settings" onClick={() => setDrawer(false)}><SettingOutlined /> 系统设置</NavLink><div className="sidebar-version">青禾志愿 <span>v0.1</span></div></div></>;
  return <DataContext.Provider value={{ ...data, reload, createActivity: () => setCreate(true) }}><div className="app-shell"><aside className="sidebar">{sidebar}</aside><Drawer placement="left" width={240} open={drawer} onClose={() => setDrawer(false)} styles={{ body: { padding: 0, background: '#fff' } }}>{sidebar}</Drawer><div className="main-shell"><header className="topbar"><div className="breadcrumb"><Button className="mobile-menu" type="text" icon={<MenuOutlined />} aria-label="展开导航" onClick={() => setDrawer(true)}/><span>管理工作台</span><i>/</i><strong>{current}</strong></div><Space size={22}>{data.settings?.demo && <span className="demo-pill"><span/>演示环境 · 模拟短信</span>}<Tooltip title="通知记录"><Link className="header-bell" aria-label="查看通知记录" to="/notifications"><BellOutlined /></Link></Tooltip><Dropdown menu={{ items: [{ key: 'logout', label: '退出登录', icon: <LogoutOutlined />, onClick: logout }] }}><button className="profile-button"><Avatar size={32} style={{ background: '#e7eddf', color: '#4d684b' }}>禾</Avatar><span>管理老师<small>志愿服务中心</small></span></button></Dropdown></Space></header><main className="page-content" key={location.pathname}>{error && <Alert type="error" showIcon message={error} action={<Button size="small" icon={<ReloadOutlined />} onClick={() => void reload()}>重试</Button>} style={{ marginBottom: 20 }}/ >}{busy ? <Skeleton active paragraph={{ rows: 12 }}/> : <Routes><Route path="/" element={<Dashboard />}/><Route path="/activities" element={<ActivityPage />}/><Route path="/reviews" element={<ReviewPage />}/><Route path="/attendance" element={<AttendancePage />}/><Route path="/reports" element={<ReportsPage />}/><Route path="/notifications" element={<NotificationPage />}/><Route path="/people" element={<PeoplePage />}/><Route path="/settings" element={<SettingsPage />}/><Route path="/audit" element={<AuditPage />}/><Route path="*" element={<Navigate to="/" replace />}/></Routes>}</main><footer className="page-footer"><Sprout /> 青禾志愿 · 每一小时，都有意义 <span>用善意连接彼此</span></footer></div></div><ActivityForm open={create} onOpenChange={setCreate} onCreated={reload}/></DataContext.Provider>;
}
