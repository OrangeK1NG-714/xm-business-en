import type { WebResultUser, UserLogin, UserRegister } from '@en/common/user'
import { request } from './index'

export const login = (data: UserLogin, signal?: AbortSignal) =>
  request<WebResultUser>({ method: 'POST', url: '/user/login', data, signal, skipAuth: true })

export const register = (data: UserRegister, signal?: AbortSignal) =>
  request<WebResultUser>({ method: 'POST', url: '/user/register', data, signal, skipAuth: true })
