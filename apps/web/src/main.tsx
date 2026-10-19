import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App as AntApp, ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import './assets/base.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ConfigProvider locale={zhCN} theme={{ token: { colorPrimary: '#0d817a', colorText: '#0f2638', borderRadius: 10, fontFamily: "'Avenir Next', 'PingFang SC', 'Microsoft YaHei', sans-serif", controlHeight: 38 } }}>
      <AntApp><App /></AntApp>
    </ConfigProvider>
  </StrictMode>,
)
