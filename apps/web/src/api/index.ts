import axios, { CanceledError } from 'axios'
import type { AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios'
import type { Token } from '@en/common/user'
import { isTokenPair, useUserStore } from '@/store/user'
import { useAuthStore } from '@/store/auth'

export interface ApiResponse<T> {
  success: boolean
  code: number
  message: string
  data: T
  timestamp: string
  path: string
}

interface RequestConfig extends AxiosRequestConfig {
  skipAuth?: boolean
}

interface AuthRequestConfig extends InternalAxiosRequestConfig {
  skipAuth?: boolean
  _sessionVersion?: number
  _retried?: boolean
}

const clientOptions = {
  baseURL: '/api/v1',
  timeout: 10000,
}
export const api = axios.create(clientOptions)
// 刷新请求不走鉴权拦截器，避免刷新接口的 401 再触发刷新。
const refreshClient = axios.create(clientOptions)
const expiredMessage = '登录已过期，请重新登录'
let refreshFlight: { sessionVersion: number; promise: Promise<Token> } | null = null

function currentSession(sessionVersion: number) {
  const state = useUserStore.getState()
  if (state.sessionVersion !== sessionVersion || !state.user) throw new CanceledError('登录状态已变更')
  return state.user
}

function expireSession(sessionVersion: number) {
  if (useUserStore.getState().sessionVersion !== sessionVersion) return
  useUserStore.getState().logout()
  useAuthStore.getState().show('login', { reason: expiredMessage })
}

async function renewTokens(sessionVersion: number): Promise<Token> {
  const { token } = currentSession(sessionVersion)
  let result
  try {
    result = await refreshClient.post<ApiResponse<Token>>('/user/refresh-token', { refreshToken: token.refreshToken })
  } catch (error) {
    currentSession(sessionVersion)
    if (axios.isAxiosError(error) && [401, 403].includes(error.response?.status ?? 0)) {
      expireSession(sessionVersion)
      throw new Error(expiredMessage, { cause: error })
    }
    // 网络中断 / 服务端异常可重试，不把暂时断网当作退出登录。
    throw error
  }
  currentSession(sessionVersion)
  const { data } = result
  if (!data?.success || data.code !== 200 || !isTokenPair(data.data)) {
    expireSession(sessionVersion)
    throw new Error(expiredMessage)
  }
  useUserStore.getState().updateToken(data.data)
  return data.data
}

function refreshTokens(sessionVersion: number): Promise<Token> {
  // 所有并发 401 共享一个 Promise，成功或失败都会一起结束等待。
  if (refreshFlight?.sessionVersion === sessionVersion) return refreshFlight.promise
  const promise = renewTokens(sessionVersion).finally(() => {
    if (refreshFlight?.promise === promise) refreshFlight = null
  })
  refreshFlight = { sessionVersion, promise }
  return promise
}

function waitForRefresh(promise: Promise<Token>, { signal }: AuthRequestConfig): Promise<Token> {
  if (signal?.aborted) return Promise.reject(new CanceledError())
  if (!signal?.addEventListener) return promise
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(new CanceledError())
    signal.addEventListener!('abort', onAbort, { once: true })
    promise.then(resolve, reject).finally(() => signal.removeEventListener?.('abort', onAbort))
  })
}

api.interceptors.request.use((request) => {
  const config = request as AuthRequestConfig
  if (config.skipAuth) {
    config.headers.delete('Authorization')
    return config
  }
  const { user, sessionVersion } = useUserStore.getState()
  if (config._sessionVersion !== undefined && config._sessionVersion !== sessionVersion) throw new CanceledError('登录状态已变更')
  config._sessionVersion = sessionVersion
  if (user) config.headers.set('Authorization', `Bearer ${user.token.accessToken}`)
  else config.headers.delete('Authorization')
  return config
})

api.interceptors.response.use(
  (response) => {
    const config = response.config as AuthRequestConfig
    if (!config.skipAuth && config._sessionVersion !== useUserStore.getState().sessionVersion) throw new CanceledError('登录状态已变更')
    return response
  },
  async (error: unknown) => {
    if (!axios.isAxiosError(error) || error.response?.status !== 401 || !error.config) throw error
    const config = error.config as AuthRequestConfig
    if (config.skipAuth) throw error
    const sessionVersion = config._sessionVersion!
    const user = currentSession(sessionVersion)
    if (config.signal?.aborted) throw new CanceledError()
    if (config._retried) {
      expireSession(sessionVersion)
      throw new Error(expiredMessage)
    }
    // 旧请求的 401 可能迟到，此时直接使用其他请求已刷新的 Token。
    if (config.headers.get('Authorization') === `Bearer ${user.token.accessToken}`) {
      await waitForRefresh(refreshTokens(sessionVersion), config)
    }
    currentSession(sessionVersion)
    if (config.signal?.aborted) throw new CanceledError()
    config._retried = true
    return api.request(config)
  },
)

export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const message: unknown = error.response?.data?.message
    if (typeof message === 'string') return message
    if (Array.isArray(message)) return message.join('；')
    if (error.code === 'ECONNABORTED') return '请求超时，请稍后重试'
    return '暂时无法连接服务，请确认后端已启动后重试'
  }
  return error instanceof Error ? error.message : '操作失败，请稍后重试'
}

export async function request<T>(config: RequestConfig): Promise<T> {
  try {
    const { data } = await api.request<ApiResponse<T>>(config)
    if (!data.success || data.code >= 400) {
      throw new Error(data.message || '操作失败，请稍后重试')
    }
    return data.data
  } catch (error) {
    if (axios.isCancel(error)) throw error
    throw new Error(getErrorMessage(error), { cause: error })
  }
}
