import React, { useMemo } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import { AuthProvider } from './contexts';
import { ToastProvider } from './components/common/Toast';
import { ProtectedRoute, SessionExpirationHandler } from './components/auth';
import { ErrorBoundary } from './components/layout';
import { LoginPage, DashboardPage } from './pages';
import { ErrorHandlerProvider } from './contexts/ErrorHandlerContext';
import { AuthService, ApiClient } from './services';

/**
 * Material-UI theme configuration
 */
const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
});

/**
 * App Content Component
 * Contains the routing and requires auth context
 */
const AppContent: React.FC = () => {
  // Create services that depend on auth context
  const authService = useMemo(() => new AuthService(), []);
  const apiClient = useMemo(() => new ApiClient(authService), [authService]);

  return (
    <ErrorHandlerProvider apiClient={apiClient}>
      <BrowserRouter>
        <SessionExpirationHandler>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<LoginPage />} />

            {/* Protected routes */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <DashboardPage />
                </ProtectedRoute>
              }
            />

            {/* Catch all - redirect to home */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </SessionExpirationHandler>
      </BrowserRouter>
    </ErrorHandlerProvider>
  );
};

/**
 * Main Application Component
 * Sets up global providers with error boundary
 */
const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <ToastProvider>
          <AuthProvider>
            <AppContent />
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
};

export default App;
