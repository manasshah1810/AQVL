import { StrictMode, Suspense, lazy } from 'react'
import React from 'react';
import ReactDOM from 'react-dom/client';
import { createRoot } from 'react-dom/client'
import './index.css'

import { ErrorBoundary } from './ErrorBoundary'

const App = lazy(() => import('./App.tsx'));
const Docs = lazy(() => import('./pages/Docs.tsx'));
const Playground = lazy(() => import('./pages/Playground.tsx'));
const Landing = lazy(() => import('./pages/Landing.tsx'));
const Privacy = lazy(() => import('./pages/Privacy.tsx'));

function RouteFallback() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      width: '100vw', height: '100vh', background: '#06060a', color: '#8888aa',
      fontFamily: 'system-ui, sans-serif', fontSize: '14px',
    }}>
      Loading…
    </div>
  );
}

function Router() {
  const [hash, setHash] = React.useState(window.location.hash);
  React.useEffect(() => {
    const handler = () => setHash(window.location.hash);
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);

  let Page: React.ComponentType = Landing;
  if (hash.startsWith('#/docs')) Page = Docs;
  else if (hash.startsWith('#/playground')) Page = Playground;
  else if (hash.startsWith('#/ide')) Page = App;
  else if (hash.startsWith('#/privacy')) Page = Privacy;

  return (
    <Suspense fallback={<RouteFallback />}>
      <Page />
    </Suspense>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <Router />
    </ErrorBoundary>
  </StrictMode>,
)
