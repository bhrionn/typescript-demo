import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import { AuthProvider } from './contexts';
import { ToastProvider } from './components/common/Toast';
import { ProtectedRoute, SessionExpirationHandler } from './components/auth';
import { ErrorBoundary } from './components/layout';
import { LoginPage, DashboardPage } from './pages';

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
 * Error handler for ErrorBoundary
 * Logs errors to console (in production, would send to monitoring service)
 */
const handleError = (error: Error, errorInfo: React.ErrorInfo) => {
  // Log to console in development
  console.error('Application error:', error, errorInfo);

  // In production, send to error monitoring service
  // Example: logErrorToService(error, errorInfo);
};

/**
 * Main Application Component
 * Sets up routing and global providers with error boundary
 */
const App: React.FC = () => {
  return (
    <ErrorBoundary onError={handleError}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <ToastProvider>
          <AuthProvider>
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
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
};

export default App;
