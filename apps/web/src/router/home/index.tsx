import type { RouteObject } from 'react-router-dom'
import BasicLayout from '@/layouts/BasicLayout'
import Home from '@/pages/Home'

const homeRoutes: RouteObject[] = [
  {
    path: '/',
    element: <BasicLayout />,
    children: [
      {
        index: true,
        element: <Home />,
      },
    ],
  },
]

export default homeRoutes
