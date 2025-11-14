/**
 * Dashboard Page Component
 * Main authenticated page for the application
 * Following Single Responsibility Principle - handles only dashboard UI
 */

import React from 'react';
import {
  Container,
  Box,
  Typography,
  Paper,
  Stack,
  AppBar,
  Toolbar,
  IconButton,
  Menu,
  MenuItem,
} from '@mui/material';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../components/common/Toast';

/**
 * Dashboard Page Component
 * Displays user information and provides logout functionality
 */
export const DashboardPage: React.FC = () => {
  const { user, logout } = useAuth();
  const { showSuccess, showError } = useToast();
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = async () => {
    try {
      handleMenuClose();
      await logout();
      showSuccess('Successfully logged out');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Logout failed';
      showError(message);
    }
  };

  return (
    <Box sx={{ flexGrow: 1 }}>
      {/* App Bar */}
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            TypeScript Demo Application
          </Typography>
          <IconButton
            size="large"
            edge="end"
            color="inherit"
            aria-label="account menu"
            aria-controls="account-menu"
            aria-haspopup="true"
            onClick={handleMenuOpen}
          >
            <AccountCircleIcon />
          </IconButton>
          <Menu
            id="account-menu"
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleMenuClose}
            anchorOrigin={{
              vertical: 'bottom',
              horizontal: 'right',
            }}
            transformOrigin={{
              vertical: 'top',
              horizontal: 'right',
            }}
          >
            <MenuItem disabled>
              <Typography variant="body2" color="text.secondary">
                {user?.email}
              </Typography>
            </MenuItem>
            <MenuItem onClick={handleLogout}>Logout</MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      {/* Main Content */}
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Stack spacing={3}>
          {/* Welcome Section */}
          <Paper sx={{ p: 3 }}>
            <Typography variant="h4" gutterBottom>
              Welcome, {user?.name || user?.email}!
            </Typography>
            <Typography variant="body1" color="text.secondary">
              You are successfully authenticated via {user?.provider}.
            </Typography>
          </Paper>

          {/* User Info Section */}
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              User Information
            </Typography>
            <Stack spacing={1}>
              <Typography variant="body2">
                <strong>Email:</strong> {user?.email}
              </Typography>
              <Typography variant="body2">
                <strong>Provider:</strong> {user?.provider}
              </Typography>
              <Typography variant="body2">
                <strong>User ID:</strong> {user?.id}
              </Typography>
            </Stack>
          </Paper>

          {/* Features Section */}
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Available Features
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              This is a demonstration application showcasing:
            </Typography>
            <Stack spacing={1} sx={{ pl: 2 }}>
              <Typography variant="body2">
                • Federated authentication (Google, Microsoft)
              </Typography>
              <Typography variant="body2">• Secure session management</Typography>
              <Typography variant="body2">• Protected routes</Typography>
              <Typography variant="body2">• AWS Cognito integration</Typography>
            </Stack>
          </Paper>
        </Stack>
      </Container>
    </Box>
  );
};
