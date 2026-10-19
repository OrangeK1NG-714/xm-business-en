import { Fragment, useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/auth'
import { useUserStore } from '@/store/user'

export default function RequireAuth({ children }: { children: ReactNode }) {
  const loggedIn = useUserStore((state) => Boolean(state.user))
  const sessionVersion = useUserStore((state) => state.sessionVersion)
  const location = useLocation()
  const navigate = useNavigate()
  const wasAuthenticated = useRef(loggedIn)

  useEffect(() => {
    if (loggedIn) {
      wasAuthenticated.current = true
      return
    }
    const returnTo = location.pathname + location.search + location.hash
    const { show, reason, open } = useAuthStore.getState()
    // 主动退出只回首页；凭证失效时请求层已打开弹框，继续保留返回地址。
    if (wasAuthenticated.current && !open) return
    show('login', { reason: reason || '登录后即可浏览词库', onSuccess: () => navigate(returnTo, { replace: true }) })
  }, [loggedIn, location.pathname, location.search, location.hash, navigate])

  if (!loggedIn) return <Navigate to="/" replace />
  // 切换账号重新挂载页面，清除旧数据；刷新 Token 不会重新挂载。
  return <Fragment key={sessionVersion}>{children}</Fragment>
}
