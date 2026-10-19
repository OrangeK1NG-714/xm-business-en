import { useCallback } from 'react'
import { useAuthStore } from '@/store/auth'
import { useUserStore } from '@/store/user'

// 受保护操作统一走这里；登录 / 注册成功后继续原来的操作。
export function useLogin() {
  const show = useAuthStore((state) => state.show)
  return useCallback((action: () => void) => {
    if (useUserStore.getState().user) action()
    else show('login', { reason: '登录后即可探索词库、搜索单词', onSuccess: action })
  }, [show])
}
