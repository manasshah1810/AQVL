import { StrictMode } from 'react'
import React from 'react';
import ReactDOM from 'react-dom/client';
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import Docs from './pages/Docs.tsx'
import Playground from './pages/Playground.tsx'

import { ErrorBoundary } from './ErrorBoundary'

import Landing from './pages/Landing.tsx'

const path = window.location.pathname;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      {path.startsWith('/docs') ? <Docs /> : 
       path.startsWith('/playground') ? <Playground /> : 
       path.startsWith('/ide') ? <App /> : 
       <Landing />}
    </ErrorBoundary>
  </StrictMode>,
)
