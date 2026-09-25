import React, { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

import { ErrorBoundary } from './ErrorBoundary'
import { Router } from './Router'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <Router />
    </ErrorBoundary>
  </StrictMode>,
)
