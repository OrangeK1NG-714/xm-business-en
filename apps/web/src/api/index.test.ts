import axios, { AxiosError, AxiosHeaders } from 'axios'
import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import type { Token, WebResultUser } from '@en/common/user'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const oldToken: Token = { accessToken: 'old-access', refreshToken: 'old-refresh' }
const newToken: Token = { accessToken: 'new-access', refreshToken: 'new-refresh' }
const user = (id = 'learner', token = oldToken): WebResultUser => ({
  id, name: '学习者', phone: '13800138000', wordNumber: 0, dayNumber: 0,
  createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-01-01'), token,
})

function memoryStorage(): Storage {
  const values = new Map<string, string>()
  return {
    get length() { return values.size },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => Array.from(values.keys())[index] ?? null,
    removeItem: (key) => { values.delete(key) },
    setItem: (key, value) => { values.set(key, value) },
  }
}

function response(config: InternalAxiosRequestConfig, data: unknown, code = 200): AxiosResponse {
  return {
    config, status: 200, statusText: 'OK', headers: new AxiosHeaders(),
    data: { success: true, code, message: code === 200 ? 'success' : 'refreshToken已过期或无效', data, timestamp: new Date().toISOString(), path: config.url },
  }
}

function unauthorized(config: InternalAxiosRequestConfig): never {
  throw new AxiosError('token已过期或无效', 'ERR_BAD_REQUEST', config, undefined, {
    ...response(config, null, 401), status: 401,
    data: { success: false, code: 401, message: 'token已过期或无效', data: null },
  })
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}

describe('双 Token 请求流程', () => {
  const originalAdapter = axios.defaults.adapter
  let adapter: AxiosAdapter
  let request: typeof import('./index').request
  let store: typeof import('../store/user').useUserStore
  let auth: typeof import('../store/auth').useAuthStore

  beforeEach(async () => {
    vi.resetModules()
    const storage = memoryStorage()
    vi.stubGlobal('localStorage', storage)
    vi.stubGlobal('window', { localStorage: storage })
    adapter = async () => { throw new Error('Unexpected request') }
    axios.defaults.adapter = (config) => adapter(config)
    store = (await import('../store/user')).useUserStore
    auth = (await import('../store/auth')).useAuthStore
    request = (await import('./index')).request
    store.getState().setUser(user())
  })

  afterEach(() => {
    axios.defaults.adapter = originalAdapter
    vi.unstubAllGlobals()
  })

  it('在受保护请求中携带 accessToken', async () => {
    adapter = async (config) => {
      expect(config.headers.get('Authorization')).toBe('Bearer old-access')
      return response(config, { list: [], total: 0 })
    }
    await expect(request({ url: '/word-book' })).resolves.toEqual({ list: [], total: 0 })
  })

  it('401 时独立刷新双 Token，再携带新 accessToken 重发原请求', async () => {
    const urls: string[] = []
    adapter = async (config) => {
      urls.push(config.url!)
      if (config.url === '/user/refresh-token') {
        expect(JSON.parse(config.data)).toEqual({ refreshToken: 'old-refresh' })
        expect(config.headers.has('Authorization')).toBe(false)
        return response(config, newToken)
      }
      if (config.headers.get('Authorization') === 'Bearer old-access') unauthorized(config)
      expect(config.params).toEqual({ word: 'learn', page: 2 })
      expect(config.headers.get('Authorization')).toBe('Bearer new-access')
      return response(config, { total: 1 })
    }
    await expect(request({ url: '/word-book', params: { word: 'learn', page: 2 } })).resolves.toEqual({ total: 1 })
    expect(urls).toEqual(['/word-book', '/user/refresh-token', '/word-book'])
    expect(store.getState().user?.token).toEqual(newToken)
    expect(JSON.parse(localStorage.getItem('english-lab-profile')!).state.user.token).toEqual(newToken)
  })

  it('多个请求同时 401 时只刷新一次，并全部恢复', async () => {
    const started = deferred<void>()
    const release = deferred<void>()
    let refreshCount = 0
    adapter = async (config) => {
      if (config.url === '/user/refresh-token') {
        refreshCount++
        started.resolve()
        await release.promise
        return response(config, newToken)
      }
      if (config.headers.get('Authorization') === 'Bearer old-access') unauthorized(config)
      return response(config, config.params.page)
    }
    const pending = Promise.all([1, 2, 3].map((page) => request({ url: '/word-book', params: { page } })))
    await Promise.race([started.promise, pending])
    release.resolve()
    await expect(pending).resolves.toEqual([1, 2, 3])
    expect(refreshCount).toBe(1)
  })

  it('迟到的旧 Token 401 直接复用已更新的 Token', async () => {
    const late = deferred<void>()
    let refreshCount = 0
    adapter = async (config) => {
      if (config.url === '/user/refresh-token') {
        refreshCount++
        return response(config, newToken)
      }
      if (config.headers.get('Authorization') === 'Bearer old-access') {
        if (config.params.page === 2) await late.promise
        unauthorized(config)
      }
      return response(config, config.params.page)
    }
    const first = request({ url: '/word-book', params: { page: 1 } })
    const second = request({ url: '/word-book', params: { page: 2 } })
    await expect(first).resolves.toBe(1)
    late.resolve()
    await expect(second).resolves.toBe(2)
    expect(refreshCount).toBe(1)
  })

  it('刷新业务失败时所有等待者都结束，清除登录态并提示重新登录', async () => {
    let refreshCount = 0
    adapter = async (config) => {
      if (config.url === '/user/refresh-token') {
        refreshCount++
        // 课程后端业务错误仍为 HTTP 201 / success:true，必须检查 code。
        return response(config, null, 500)
      }
      unauthorized(config)
    }
    const results = await Promise.allSettled([request({ url: '/word-book' }), request({ url: '/word-book' })])
    expect(results.every((result) => result.status === 'rejected')).toBe(true)
    expect(refreshCount).toBe(1)
    expect(store.getState().user).toBeNull()
    expect(auth.getState().open).toBe(true)
  })

  it('刷新接口返回 401 时退出登录且不递归刷新', async () => {
    let refreshCount = 0
    adapter = async (config) => {
      if (config.url === '/user/refresh-token') refreshCount++
      unauthorized(config)
    }
    await expect(request({ url: '/word-book' })).rejects.toThrow()
    expect(refreshCount).toBe(1)
    expect(store.getState().user).toBeNull()
  })

  it('刷新成功后仍然 401 时停止重试', async () => {
    let requestCount = 0
    adapter = async (config) => {
      requestCount++
      if (config.url === '/user/refresh-token') return response(config, newToken)
      unauthorized(config)
    }
    await expect(request({ url: '/word-book' })).rejects.toThrow()
    expect(requestCount).toBe(3)
    expect(store.getState().user).toBeNull()
  })

  it('刷新遇到网络错误保留会话，下次请求仍能重新刷新', async () => {
    let refreshCount = 0
    adapter = async (config) => {
      if (config.url === '/user/refresh-token') {
        if (++refreshCount === 1) throw new AxiosError('Network Error', 'ERR_NETWORK', config)
        return response(config, newToken)
      }
      if (config.headers.get('Authorization') === 'Bearer old-access') unauthorized(config)
      return response(config, 'recovered')
    }
    await expect(request({ url: '/word-book' })).rejects.toThrow()
    expect(store.getState().user?.id).toBe('learner')
    expect(auth.getState().open).toBe(false)
    await expect(request({ url: '/word-book' })).resolves.toBe('recovered')
    expect(refreshCount).toBe(2)
  })

  it.each(['退出', '切换账号'])('刷新途中%s时旧响应不能恢复或覆盖会话', async (operation) => {
    const started = deferred<void>()
    const release = deferred<void>()
    adapter = async (config) => {
      if (config.url === '/user/refresh-token') {
        started.resolve()
        await release.promise
        return response(config, newToken)
      }
      unauthorized(config)
    }
    const pending = request({ url: '/word-book' })
    const result = pending.catch((error: unknown) => error)
    await Promise.race([started.promise, pending])
    store.getState().logout()
    if (operation === '切换账号') store.getState().setUser(user('other', { accessToken: 'other-access', refreshToken: 'other-refresh' }))
    release.resolve()
    expect(axios.isCancel(await result)).toBe(true)
    expect(store.getState().user?.id ?? null).toBe(operation === '退出' ? null : 'other')
    if (operation === '切换账号') expect(store.getState().user?.token.accessToken).toBe('other-access')
    expect(auth.getState().open).toBe(false)
  })

  it('旧会话的刷新失败不能清除刚登录的新账号', async () => {
    const started = deferred<void>()
    const release = deferred<void>()
    adapter = async (config) => {
      if (config.url === '/user/refresh-token') {
        started.resolve()
        await release.promise
        return response(config, null, 500)
      }
      unauthorized(config)
    }
    const pending = request({ url: '/word-book' })
    const result = pending.catch((error: unknown) => error)
    await Promise.race([started.promise, pending])
    store.getState().setUser(user('other'))
    release.resolve()
    expect(axios.isCancel(await result)).toBe(true)
    expect(store.getState().user?.id).toBe('other')
    expect(auth.getState().open).toBe(false)
  })

  it('等待刷新时取消的请求不重发，其他请求照常完成', async () => {
    const started = deferred<void>()
    const release = deferred<void>()
    const controller = new AbortController()
    const replayedPages: number[] = []
    adapter = async (config) => {
      if (config.url === '/user/refresh-token') {
        started.resolve()
        await release.promise
        return response(config, newToken)
      }
      if (config.headers.get('Authorization') === 'Bearer old-access') unauthorized(config)
      replayedPages.push(config.params.page)
      return response(config, config.params.page)
    }
    const canceled = request({ url: '/word-book', params: { page: 1 }, signal: controller.signal }).catch((error: unknown) => error)
    const active = request({ url: '/word-book', params: { page: 2 } })
    await Promise.race([started.promise, active])
    controller.abort()
    release.resolve()
    expect(axios.isCancel(await canceled)).toBe(true)
    await expect(active).resolves.toBe(2)
    expect(replayedPages).toEqual([2])
  })

  it('登录和注册不携带旧凭证，也不因 401 触发刷新', async () => {
    const urls: string[] = []
    adapter = async (config) => {
      urls.push(config.url!)
      expect(config.headers.has('Authorization')).toBe(false)
      unauthorized(config)
    }
    const { login, register } = await import('./user')
    await expect(login({ phone: '13800138000', password: 'hash' })).rejects.toThrow()
    await expect(register({ name: '学习者', phone: '13800138000', password: 'hash' })).rejects.toThrow()
    expect(urls).toEqual(['/user/login', '/user/register'])
    expect(store.getState().user?.id).toBe('learner')
  })
})

describe('登录态持久化', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('旧版本仅有用户资料、没有 Token 的缓存不能视为已登录', async () => {
    vi.resetModules()
    const storage = memoryStorage()
    const { token: ignoredToken, ...profile } = user()
    void ignoredToken
    storage.setItem('english-lab-profile', JSON.stringify({ version: 0, state: { user: profile } }))
    vi.stubGlobal('localStorage', storage)
    vi.stubGlobal('window', { localStorage: storage })
    const { useUserStore } = await import('../store/user')
    expect(useUserStore.getState().user).toBeNull()
  })

  it('页面重新加载后恢复有效的用户资料和双 Token', async () => {
    vi.resetModules()
    const storage = memoryStorage()
    storage.setItem('english-lab-profile', JSON.stringify({ version: 1, state: { user: user() } }))
    vi.stubGlobal('localStorage', storage)
    vi.stubGlobal('window', { localStorage: storage })
    const { useUserStore } = await import('../store/user')
    expect(useUserStore.getState().user?.id).toBe('learner')
    expect(useUserStore.getState().user?.token).toEqual(oldToken)
    useUserStore.getState().logout()
    expect(JSON.parse(storage.getItem('english-lab-profile')!).state.user).toBeNull()
  })
})
