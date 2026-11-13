import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { App } from './app/App';
import { FleetProvider } from './fleet/FleetProvider';
import { DashboardErrorBoundary } from './app/DashboardErrorBoundary';
import './styles/theme.css';

const root = document.getElementById('root');
if (!root) throw new Error('Missing root element');

createRoot(root).render(
  <StrictMode>
    <DashboardErrorBoundary>
      <BrowserRouter><FleetProvider><App /></FleetProvider></BrowserRouter>
    </DashboardErrorBoundary>
  </StrictMode>,
);
