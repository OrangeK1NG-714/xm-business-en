import { createBrowserRouter } from 'react-router-dom'
import homeRoutes from './home'
import wordBookRoutes from './word-book'

const router = createBrowserRouter([
  ...homeRoutes,
  ...wordBookRoutes,
])

export default router
