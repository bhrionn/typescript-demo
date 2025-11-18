/**
 * Protected Route Component
 * Restricts access to authenticated users only
 * Following Single Responsibility Principle - handles only route protection
 */

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Box, CircularProgress, Container, Typography } from '@mui/material';
import { useAuth } from '../../hooks/useAuth';

/**
 * Props for ProtectedRoute component
 */
export interface IProtectedRouteProps {
  /**
   * Child components to render if authenticated
   */
  children: React.ReactNode;

  /**
   * Optional redirect path for unauthenticated users
   * Defaults to '/login'
   */
  redirectTo?: string;
}

/**
 * Protected Route Component
 * Renders children only if user is authenticated, otherwise redirects to login
 */
export const ProtectedRoute: React.FC<IProtectedRouteProps> = ({
  children,
  redirectTo = '/login',
}) => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  /**
   * Show loading state while checking authentication
   */
  if (isLoading) {
    return (
      <Container maxWidth="sm">
        <Box
          sx={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
          }}
          role="status"
          aria-live="polite"
          aria-label="Verifying authentication"
          data-testid="protected-route-loading"
        >
          <CircularProgress size={48} aria-label="Loading" />
          <Typography variant="body1" color="text.secondary">
            Verifying authentication...
          </Typography>
        </Box>
      </Container>
    );
  }

  /**
   * Redirect to login if not authenticated
   * Preserve the attempted location for redirect after login
   */
  if (!isAuthenticated) {
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  /**
   * Render protected content
   */
  return <>{children}</>;
};
