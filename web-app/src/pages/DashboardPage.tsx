/**
 * Dashboard Page Component
 * Main authenticated page for the application
 * Following Single Responsibility Principle - handles only dashboard UI
 */

import React, { useState, useMemo } from 'react';
import { Typography, Paper, Stack, Box } from '@mui/material';
import { useAuth } from '../hooks/useAuth';
import { AppLayout } from '../components/layout';
import { FileUploadForm, FileList } from '../components/files';
import { FileUploadService } from '../services/FileUploadService';
import { ApiClient } from '../services/ApiClient';
import { AuthService } from '../services/AuthService';

/**
 * Dashboard Page Component
 * Displays user information and file upload functionality using AppLayout wrapper
 */
export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Initialize services (memoized to prevent recreation on each render)
  const authService = useMemo(() => new AuthService(), []);
  const apiClient = useMemo(() => new ApiClient(authService), [authService]);
  const uploadService = useMemo(() => new FileUploadService(apiClient), [apiClient]);

  /**
   * Handle successful upload - refresh file list
   */
  const handleUploadSuccess = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <AppLayout>
      <Stack spacing={3}>
        {/* Welcome Section */}
        <Paper sx={{ p: 3 }} component="section" aria-label="Welcome section">
          <Typography variant="h4" component="h2" gutterBottom>
            Welcome, {user?.name || user?.email}!
          </Typography>
          <Typography variant="body1" color="text.secondary">
            You are successfully authenticated via {user?.provider}.
          </Typography>
        </Paper>

        {/* File Upload and List Section */}
        <Box
          component="section"
          aria-label="File management"
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
            gap: 3,
          }}
        >
          <FileUploadForm uploadService={uploadService} onUploadSuccess={handleUploadSuccess} />
          <FileList apiClient={apiClient} refreshTrigger={refreshTrigger} />
        </Box>

        {/* User Info Section */}
        <Paper sx={{ p: 3 }} component="section" aria-label="User information">
          <Typography variant="h6" component="h3" gutterBottom>
            User Information
          </Typography>
          <Stack spacing={1} component="dl">
            <Typography variant="body2" component="div">
              <strong>Email:</strong> {user?.email}
            </Typography>
            <Typography variant="body2" component="div">
              <strong>Provider:</strong> {user?.provider}
            </Typography>
            <Typography variant="body2" component="div">
              <strong>User ID:</strong> {user?.id}
            </Typography>
          </Stack>
        </Paper>

        {/* Features Section */}
        <Paper sx={{ p: 3 }} component="section" aria-label="Available features">
          <Typography variant="h6" component="h3" gutterBottom>
            Available Features
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            This is a demonstration application showcasing:
          </Typography>
          <Stack spacing={1} sx={{ pl: 2 }} component="ul" role="list">
            <Typography variant="body2" component="li">
              Federated authentication (Google, Microsoft)
            </Typography>
            <Typography variant="body2" component="li">
              Secure file upload with drag-and-drop
            </Typography>
            <Typography variant="body2" component="li">
              File management and download
            </Typography>
            <Typography variant="body2" component="li">
              Secure session management
            </Typography>
            <Typography variant="body2" component="li">
              Protected routes
            </Typography>
            <Typography variant="body2" component="li">
              AWS Cognito integration
            </Typography>
            <Typography variant="body2" component="li">
              Responsive layout and navigation
            </Typography>
          </Stack>
        </Paper>
      </Stack>
    </AppLayout>
  );
};
