/**
 * Login Page Component
 * Provides federated authentication UI with Google and Microsoft providers
 * Following Single Responsibility Principle - handles only login UI
 */

import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Box, Typography, Container, Paper, Stack } from '@mui/material';
import GoogleIcon from '@mui/icons-material/Google';
import MicrosoftIcon from '@mui/icons-material/Microsoft';
import { useAuth } from '../hooks/useAuth';
import { Button, Card } from '../components/common';
import { useToast } from '../components/common/Toast';
import { IdentityProvider } from '../types/auth';

/**
 * Login Page Component
 * Displays provider selection buttons and handles authentication flow
 */
export const LoginPage: React.FC = () => {
  const { login, isAuthenticated, isLoading, error } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { showError } = useToast();

  // Get the redirect path from location state or default to home
  const from = (location.state as any)?.from?.pathname || '/';

  /**
   * Redirect to original destination if already authenticated
   */
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate, from]);

  /**
   * Display error notifications
   */
  useEffect(() => {
    if (error) {
      showError(error);
    }
  }, [error, showError]);

  /**
   * Handle provider selection and initiate login
   */
  const handleProviderLogin = async (provider: IdentityProvider) => {
    try {
      await login(provider);
      // Note: login will redirect to provider, so code after this won't execute
    } catch (err) {
      // Error is already set in auth context and will be displayed via useEffect
      console.error('Login error:', err);
    }
  };

  /**
   * Render loading state
   */
  if (isLoading) {
    return (
      <Container maxWidth="sm">
        <Box
          sx={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          role="status"
          aria-live="polite"
          aria-label="Checking authentication status"
        >
          <Card title="Loading..." testId="login-loading">
            <Typography>Checking authentication status...</Typography>
          </Card>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="sm">
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          py: 4,
        }}
      >
        <Paper
          elevation={3}
          sx={{
            p: 4,
            width: '100%',
            borderRadius: 2,
          }}
          role="region"
          aria-label="Login form"
        >
          <Stack spacing={3}>
            {/* Header */}
            <Box textAlign="center">
              <Typography variant="h4" component="h1" gutterBottom fontWeight="bold">
                Welcome
              </Typography>
              <Typography variant="body1" color="text.secondary" id="login-description">
                Sign in to continue to the application
              </Typography>
            </Box>

            {/* Provider Buttons */}
            <Stack spacing={2}>
              <Button
                variant="outlined"
                size="large"
                fullWidth
                startIcon={<GoogleIcon />}
                onClick={() => handleProviderLogin('google')}
                disabled={isLoading}
                ariaLabel="Sign in with Google"
                testId="login-google-button"
              >
                Continue with Google
              </Button>

              <Button
                variant="outlined"
                size="large"
                fullWidth
                startIcon={<MicrosoftIcon />}
                onClick={() => handleProviderLogin('microsoft')}
                disabled={isLoading}
                ariaLabel="Sign in with Microsoft"
                testId="login-microsoft-button"
              >
                Continue with Microsoft
              </Button>
            </Stack>

            {/* Footer */}
            <Box textAlign="center" pt={2}>
              <Typography variant="caption" color="text.secondary">
                By signing in, you agree to our Terms of Service and Privacy Policy
              </Typography>
            </Box>
          </Stack>
        </Paper>
      </Box>
    </Container>
  );
};
