import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/layout';
import './index.css';
import './config/environment'; // Load and validate environment config

/**
 * Application Entry Point
 * Initializes React application with strict mode and top-level error boundary
 */
const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
