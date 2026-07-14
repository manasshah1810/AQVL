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

function Router() {
  const [hash, setHash] = React.useState(window.location.hash);
  React.useEffect(() => {
    const handler = () => setHash(window.location.hash);
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);

  if (hash.startsWith('#/docs')) return <Docs />;
  if (hash.startsWith('#/playground')) return <Playground />;
  if (hash.startsWith('#/ide')) return <App />;
  return <Landing />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <Router />
    </ErrorBoundary>
  </StrictMode>,
)
