/**
 * LoadingSpinner Component
 * Displays loading state for async operations
 * Following Single Responsibility Principle - handles only loading UI
 */

import React from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';

/**
 * LoadingSpinner Props
 */
interface LoadingSpinnerProps {
  message?: string;
  size?: number;
  fullScreen?: boolean;
}

/**
 * LoadingSpinner Component
 * Displays a centered loading spinner with optional message
 */
export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  message = 'Loading...',
  size = 40,
  fullScreen = false,
}) => {
  const content = (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
      }}
    >
      <CircularProgress size={size} />
      {message && (
        <Typography variant="body2" color="text.secondary">
          {message}
        </Typography>
      )}
    </Box>
  );

  if (fullScreen) {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          width: '100%',
        }}
      >
        {content}
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        py: 4,
      }}
    >
      {content}
    </Box>
  );
};
