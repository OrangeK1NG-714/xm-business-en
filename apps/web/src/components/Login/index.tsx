import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Alert, App, Button, Form, Input, Modal, Spin } from 'antd'
import { ArrowRightOutlined, LockOutlined, MailOutlined, PhoneOutlined, UserOutlined } from '@ant-design/icons'
import md5 from 'md5'
import type { UserRegister } from '@en/common/user'
import { login, register } from '@/api/user'
import { getErrorMessage } from '@/api'
import { useAuthStore } from '@/store/auth'
import type { AuthMode } from '@/store/auth'
import { useUserStore } from '@/store/user'
import './login.css'

const ModelScene = lazy(() => import('@/components/ModelScene'))

function AuthForm({ mode }: { mode: AuthMode }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const pending = useRef<AbortController | null>(null)
  const { message } = App.useApp()
  const setUser = useUserStore((state) => state.setUser)
  const hide = useAuthStore((state) => state.hide)
  const setMode = useAuthStore((state) => state.setMode)
  const reason = useAuthStore((state) => state.reason)
  const isRegister = mode === 'register'

  useEffect(() => () => pending.current?.abort(), [])

  const submit = async (values: UserRegister) => {
    if (pending.current) return
    const controller = new AbortController()
    pending.current = controller
    setBusy(true)
    setError('')
    try {
      const user = await (isRegister
        ? register({ ...values, name: values.name.trim(), email: values.email?.trim() || undefined, password: md5(values.password) }, controller.signal)
        : login({ phone: values.phone, password: md5(values.password) }, controller.signal))
      if (controller.signal.aborted) return
      setUser(user)
      const onSuccess = useAuthStore.getState().onSuccess
      message.success(isRegister ? '注册成功，欢迎加入！' : '登录成功，欢迎回来！')
      hide()
      onSuccess?.()
    } catch (error) {
      if (!controller.signal.aborted) setError(getErrorMessage(error))
    } finally {
      pending.current = null
      if (!controller.signal.aborted) setBusy(false)
    }
  }

  return (
    <div className="auth-form-panel">
      <span className="eyebrow">{isRegister ? 'YOUR NEXT CHAPTER' : 'GOOD TO SEE YOU'}</span>
      <h2>{isRegister ? '把世界，读得更广。' : '欢迎回来。'}</h2>
      <p className="auth-description">{isRegister ? '创建你的账户，从今天的第一个单词开始。' : '登录 English Lab，继续你的英语探索。'}</p>
      {reason && <Alert className="auth-error" type="info" showIcon title={reason} />}
      <Form layout="vertical" requiredMark={false} onFinish={submit} size="large" disabled={busy}>
        {isRegister && (
          <Form.Item name="name" label="昵称" rules={[{ required: true, whitespace: true, message: '请输入昵称' }, { min: 2, max: 10, message: '昵称长度为 2–10 个字符' }]}>
            <Input prefix={<UserOutlined />} placeholder="怎么称呼你" autoComplete="nickname" maxLength={10} autoFocus />
          </Form.Item>
        )}
        <Form.Item name="phone" label="手机号" rules={[{ required: true, message: '请输入手机号' }, { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的 11 位手机号' }]}>
          <Input prefix={<PhoneOutlined />} placeholder="请输入手机号" autoComplete="tel" inputMode="tel" maxLength={11} autoFocus={!isRegister} />
        </Form.Item>
        {isRegister && (
          <Form.Item name="email" label="邮箱（选填）" rules={[{ type: 'email', message: '请输入正确的邮箱地址' }]}>
            <Input prefix={<MailOutlined />} placeholder="you@example.com" autoComplete="email" maxLength={254} />
          </Form.Item>
        )}
        <Form.Item name="password" label="密码" rules={[{ required: true, message: '请输入密码' }, ...(isRegister ? [{ min: 6, max: 128, message: '密码长度为 6–128 个字符' }] : [])]}>
          <Input.Password prefix={<LockOutlined />} placeholder={isRegister ? '设置 6–128 位密码' : '请输入密码'} autoComplete={isRegister ? 'new-password' : 'current-password'} maxLength={128} />
        </Form.Item>
        {error && <Alert className="auth-error" type="error" showIcon title={error} role="alert" />}
        <Button className="auth-submit" htmlType="submit" type="primary" block loading={busy} icon={<ArrowRightOutlined />} iconPlacement="end">
          {isRegister ? '创建账户' : '登录'}
        </Button>
      </Form>
      <p className="auth-switch">
        {isRegister ? '已经有账户？' : '第一次来到这里？'}
        <Button type="link" disabled={busy} onClick={() => setMode(isRegister ? 'login' : 'register')}>
          {isRegister ? '去登录' : '创建账户'}
        </Button>
      </p>
    </div>
  )
}

export default function Login() {
  const { open, mode, hide } = useAuthStore()
  return (
    <Modal open={open} onCancel={hide} footer={null} width={1000} centered destroyOnHidden className="auth-modal" title={<span className="sr-only">{mode === 'register' ? '注册账户' : '登录账户'}</span>}>
      <div className="auth-grid">
        <div className="auth-visual">
          <span className="auth-wordmark">e<span>.</span></span>
          <div className="auth-model">
            <Suspense fallback={<Spin />}>
              <ModelScene src={`/models/${mode}/scene.gltf`} label={mode === 'login' ? '登录主题 3D 模型' : '注册主题 3D 模型'} />
            </Suspense>
          </div>
          <div className="auth-visual-copy"><span>SMALL STEPS. BIG WORLDS.</span><h3>A little English,<br />a bigger world.</h3><p>每一个新词，都是一扇新的窗。</p></div>
        </div>
        <AuthForm key={mode} mode={mode} />
      </div>
    </Modal>
  )
}
