import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

/**
 * Main Application Component
 * Sets up routing and global providers
 */
const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* Default route - will be replaced with actual routes in later tasks */}
        <Route path="/" element={<HomePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

/**
 * Temporary Home Page Component
 * Will be replaced with actual implementation in later tasks
 */
const HomePage: React.FC = () => {
  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1>TypeScript Demo Application</h1>
      <p>React + TypeScript application with federated authentication</p>
      <p>
        <strong>Status:</strong> Project initialized successfully
      </p>
    </div>
  );
};

export default App;
