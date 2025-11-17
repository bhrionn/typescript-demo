/**
 * AppLayout Component
 * Main layout wrapper with header, navigation, and content area
 * Following Single Responsibility Principle - handles only layout structure
 */

import React from 'react';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Menu,
  MenuItem,
  Container,
  useMediaQuery,
  useTheme,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import DashboardIcon from '@mui/icons-material/Dashboard';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../common/Toast';

/**
 * Navigation item interface
 */
interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
}

/**
 * AppLayout Props
 */
interface AppLayoutProps {
  children: React.ReactNode;
}

/**
 * Navigation items configuration
 */
const navItems: NavItem[] = [
  {
    label: 'Dashboard',
    path: '/',
    icon: <DashboardIcon />,
  },
  {
    label: 'Upload Files',
    path: '/upload',
    icon: <CloudUploadIcon />,
  },
];

/**
 * AppLayout Component
 * Provides consistent layout with responsive navigation
 */
export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { showSuccess, showError } = useToast();

  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [profileMenuAnchor, setProfileMenuAnchor] = React.useState<null | HTMLElement>(null);

  /**
   * Handle mobile menu toggle
   */
  const handleMobileMenuToggle = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  /**
   * Handle profile menu open
   */
  const handleProfileMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setProfileMenuAnchor(event.currentTarget);
  };

  /**
   * Handle profile menu close
   */
  const handleProfileMenuClose = () => {
    setProfileMenuAnchor(null);
  };

  /**
   * Handle navigation
   */
  const handleNavigate = (path: string) => {
    navigate(path);
    setMobileMenuOpen(false);
  };

  /**
   * Handle logout
   */
  const handleLogout = async () => {
    try {
      handleProfileMenuClose();
      await logout();
      showSuccess('Successfully logged out');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Logout failed';
      showError(message);
    }
  };

  /**
   * Render navigation items
   */
  const renderNavItems = () => (
    <List>
      {navItems.map((item) => {
        const isActive = location.pathname === item.path;
        return (
          <ListItem key={item.path} disablePadding>
            <ListItemButton
              selected={isActive}
              onClick={() => handleNavigate(item.path)}
              sx={{
                '&.Mui-selected': {
                  backgroundColor: theme.palette.primary.main,
                  color: theme.palette.primary.contrastText,
                  '&:hover': {
                    backgroundColor: theme.palette.primary.dark,
                  },
                  '& .MuiListItemIcon-root': {
                    color: theme.palette.primary.contrastText,
                  },
                },
              }}
            >
              <ListItemIcon
                sx={{
                  color: isActive ? 'inherit' : theme.palette.text.secondary,
                }}
              >
                {item.icon}
              </ListItemIcon>
              <ListItemText primary={item.label} />
            </ListItemButton>
          </ListItem>
        );
      })}
    </List>
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* App Bar */}
      <AppBar position="static" elevation={1}>
        <Toolbar>
          {/* Mobile menu button */}
          {isMobile && (
            <IconButton
              color="inherit"
              aria-label="open navigation menu"
              edge="start"
              onClick={handleMobileMenuToggle}
              sx={{ mr: 2 }}
            >
              <MenuIcon />
            </IconButton>
          )}

          {/* App title */}
          <Typography
            variant="h6"
            component="div"
            sx={{
              flexGrow: 1,
              cursor: 'pointer',
              fontSize: { xs: '1rem', sm: '1.25rem' },
            }}
            onClick={() => handleNavigate('/')}
          >
            TypeScript Demo App
          </Typography>

          {/* Desktop navigation */}
          {!isMobile && (
            <Box sx={{ display: 'flex', gap: 2, mr: 2 }}>
              {navItems.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <Box
                    key={item.path}
                    onClick={() => handleNavigate(item.path)}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5,
                      px: 2,
                      py: 1,
                      cursor: 'pointer',
                      borderRadius: 1,
                      backgroundColor: isActive ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                      '&:hover': {
                        backgroundColor: 'rgba(255, 255, 255, 0.15)',
                      },
                      transition: 'background-color 0.2s',
                    }}
                  >
                    {item.icon}
                    <Typography variant="body2">{item.label}</Typography>
                  </Box>
                );
              })}
            </Box>
          )}

          {/* Profile menu */}
          <IconButton
            size="large"
            edge="end"
            color="inherit"
            aria-label="account menu"
            aria-controls="profile-menu"
            aria-haspopup="true"
            onClick={handleProfileMenuOpen}
          >
            <AccountCircleIcon />
          </IconButton>
          <Menu
            id="profile-menu"
            anchorEl={profileMenuAnchor}
            open={Boolean(profileMenuAnchor)}
            onClose={handleProfileMenuClose}
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
            <Divider />
            <MenuItem onClick={handleLogout}>Logout</MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      {/* Mobile drawer */}
      <Drawer
        anchor="left"
        open={mobileMenuOpen}
        onClose={handleMobileMenuToggle}
        sx={{
          '& .MuiDrawer-paper': {
            width: 250,
          },
        }}
      >
        <Box sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Navigation
          </Typography>
        </Box>
        <Divider />
        {renderNavItems()}
      </Drawer>

      {/* Main content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          backgroundColor: theme.palette.grey[50],
          minHeight: 'calc(100vh - 64px)',
        }}
      >
        <Container
          maxWidth="lg"
          sx={{
            py: { xs: 2, sm: 3, md: 4 },
            px: { xs: 2, sm: 3 },
          }}
        >
          {children}
        </Container>
      </Box>
    </Box>
  );
};
