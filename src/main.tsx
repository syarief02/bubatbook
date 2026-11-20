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
// and #fragments and query strings are dropped, so tokens, dates and emails in
// links never leave the site. Only ad campaign tags (utm_*) are kept, so the
// Analytics page can show which ad or post brought the visitor.
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
function analyticsBeforeSend(event: BeforeSendEvent): BeforeSendEvent | null {
  const url = new URL(event.url);
  if (url.pathname.startsWith('/admin')) return null;
  const kept = new URLSearchParams();
  for (const key of UTM_KEYS) {
    const value = url.searchParams.get(key);
    if (value) kept.set(key, value);
  }
  const query = kept.toString();
  return { ...event, url: url.origin + url.pathname + (query ? `?${query}` : '') };
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
