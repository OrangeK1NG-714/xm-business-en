import { lazy, Suspense } from 'react'
import type { RouteObject } from 'react-router-dom'
import RequireAuth from '../RequireAuth'

const WordBook = lazy(() => import('@/pages/WordBook'))

const wordBookRoutes: RouteObject[] = [
  {
    path: '/word-book',
    element: (
      <RequireAuth>
        <Suspense fallback={<div>加载中...</div>}>
          <WordBook />
        </Suspense>
      </RequireAuth>
    ),
  },
]

export default wordBookRoutes
