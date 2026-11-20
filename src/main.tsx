import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Analytics, type BeforeSendEvent } from '@vercel/analytics/react';
import './i18n';
import App from './App.jsx';
import './index.css';

const queryClient = new QueryClient();

// Vercel Web Analytics (cookieless page-view counts). Admin pages are left out,
// and query strings and #fragments are dropped, so tokens, dates and emails in
// links never leave the site: only the page path is counted.
function analyticsBeforeSend(event: BeforeSendEvent): BeforeSendEvent | null {
  const url = new URL(event.url);
  if (url.pathname.startsWith('/admin')) return null;
  return { ...event, url: url.origin + url.pathname };
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
        <Analytics beforeSend={analyticsBeforeSend} />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
