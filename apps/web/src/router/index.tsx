import { createBrowserRouter, Link, Navigate } from 'react-router-dom'
import { Result } from 'antd'
import homeRoutes from './home'
import wordBookRoutes from './word-book'

const router = createBrowserRouter([
  {
    ...homeRoutes[0],
    index: false,
    children: [
      ...homeRoutes[0].children!,
      ...wordBookRoutes,
      { path: '/word-book/index', element: <Navigate to="/word-book" replace /> },
      { path: '*', element: <Result status="404" title="这一页还没有单词" subTitle="换条路，继续探索吧。" extra={<Link to="/">回到首页</Link>} /> },
    ],
  },
])

export default router
