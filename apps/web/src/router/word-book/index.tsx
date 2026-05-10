import { lazy, Suspense } from 'react'
import type { RouteObject } from 'react-router-dom'

const WordBook = lazy(() => import('@/pages/WordBook'))

const wordBookRoutes: RouteObject[] = [
  {
    path: '/word-book',
    element: (
      <Suspense fallback={<div>加载中...</div>}>
        <WordBook />
      </Suspense>
    ),
  },
]

export default wordBookRoutes
