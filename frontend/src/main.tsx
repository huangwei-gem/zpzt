import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import router from './router'
import './index.css'
import { AuthProvider } from './contexts/AuthContext'
import { ResponsiblePersonProvider } from './contexts/ResponsiblePersonContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <ResponsiblePersonProvider>
        <RouterProvider router={router} />
      </ResponsiblePersonProvider>
    </AuthProvider>
  </StrictMode>,
)
