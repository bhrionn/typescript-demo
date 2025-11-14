import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import './config/environment'; // Load and validate environment config

/**
 * Application Entry Point
 * Initializes React application with strict mode enabled
 */
const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
