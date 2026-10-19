import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { NavLink, Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { App, Avatar, Button, Dropdown, Tooltip } from 'antd'
import { BookOutlined, DownOutlined, HomeOutlined, LogoutOutlined, SearchOutlined, UserOutlined } from '@ant-design/icons'
import { useUserStore } from '@/store/user'
import { useAuthStore } from '@/store/auth'
import { useLogin } from '@/hooks/useLogin'

const Search = lazy(() => import('@/components/Search'))
const Login = lazy(() => import('@/components/Login'))

export default function BasicLayout() {
  const [searchSession, setSearchSession] = useState<number | null>(null)
  const { user, logout, sessionVersion } = useUserStore()
  const { show, open: authOpen } = useAuthStore()
  const { message } = App.useApp()
  const location = useLocation()
  const navigate = useNavigate()
  const requireLogin = useLogin()
  const searchOpen = Boolean(user) && searchSession === sessionVersion && !authOpen
  const openSearch = useCallback(() => requireLogin(() => setSearchSession(useUserStore.getState().sessionVersion)), [requireLogin])

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && ['k', 'f'].includes(event.key.toLowerCase())) {
        if (authOpen) return
        event.preventDefault()
        openSearch()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [authOpen, openSearch])

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
    document.title = location.pathname.startsWith('/word-book') ? '词库 · English Lab' : 'English Lab · 每天一点，世界更大'
  }, [location.pathname])

  const handleLogout = () => {
    logout()
    setSearchSession(null)
    useAuthStore.getState().hide()
    navigate('/', { replace: true })
    message.success('已退出登录')
  }

  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">跳到主要内容</a>
      <header className="site-header">
        <div className="header-inner">
          <Link to="/" className="brand" aria-label="English Lab 首页"><span className="brand-mark">e.</span><span>English<span className="brand-light"> Lab</span></span></Link>
          <nav className="main-nav" aria-label="主导航">
            <NavLink to="/" end><HomeOutlined /><span>主页</span></NavLink>
            <NavLink to="/word-book"><BookOutlined /><span>词库</span></NavLink>
          </nav>
          <div className="header-actions">
            <Tooltip title="快捷搜索 · Ctrl / ⌘ + K">
              <button className="search-trigger" aria-label="搜索单词" onClick={openSearch}><SearchOutlined /><span>搜索单词</span><kbd>⌘ K</kbd></button>
            </Tooltip>
            {user ? (
              <Dropdown trigger={['click']} menu={{ items: [{ key: 'summary', disabled: true, label: `累计 ${user.wordNumber} 个单词 · ${user.dayNumber} 天` }, { type: 'divider' }, { key: 'logout', label: '退出登录', icon: <LogoutOutlined />, onClick: handleLogout }] }}>
                <button className="profile-trigger" aria-label={`账户：${user.name}`}><Avatar size={32} style={{ background: '#e0eee8', color: '#0d817a' }}>{user.name.slice(0, 1)}</Avatar><span>{user.name}</span><DownOutlined /></button>
              </Dropdown>
            ) : (
              <Button type="primary" icon={<UserOutlined />} onClick={() => show('login')}>登录<span className="register-label"> / 注册</span></Button>
            )}
          </div>
        </div>
      </header>
      <main id="main-content" tabIndex={-1}>
        <Outlet />
      </main>
      <footer className="site-footer"><Link to="/" className="footer-brand">English Lab<span>每天一点，世界更大。</span></Link><span>© {new Date().getFullYear()} English Lab</span><Link to="/word-book">探索词库 ↗</Link></footer>
      <Suspense fallback={null}>
        {user && <Search key={sessionVersion} open={searchOpen} onClose={() => setSearchSession(null)} />}
        <Login />
      </Suspense>
    </div>
  )
}
