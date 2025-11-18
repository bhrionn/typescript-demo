/**
 * Error Handling Usage Examples
 * Demonstrates how to use the error handling system in components
 */

import React, { useState } from 'react';
import { useErrorHandler } from '../hooks/useErrorHandler';
import { ValidationError, AppFileUploadError, NetworkError, AuthenticationError } from '../types';
import { Button, Box, Typography } from '@mui/material';

/**
 * Example Component: Form with Error Handling
 */
export const FormWithErrorHandling: React.FC = () => {
  const { handleError } = useErrorHandler();
  const [email, setEmail] = useState('');

  const handleSubmit = async () => {
    try {
      // Validate input
      if (!email) {
        throw new ValidationError('Email is required', {
          email: 'This field is required',
        });
      }

      if (!email.includes('@')) {
        throw new ValidationError('Invalid email format', {
          email: 'Must be a valid email address',
        });
      }

      // Simulate API call
      await submitForm(email);

      // Success - no error handling needed
    } catch (error) {
      // Error is automatically shown to user and logged
      handleError(error);
    }
  };

  return (
    <Box>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Enter email"
      />
      <Button onClick={handleSubmit}>Submit</Button>
    </Box>
  );
};

/**
 * Example Component: File Upload with Error Handling
 */
export const FileUploadWithErrorHandling: React.FC = () => {
  const { handleErrorWithMessage } = useErrorHandler();

  const handleFileUpload = async (file: File) => {
    try {
      // Validate file
      const MAX_SIZE = 50 * 1024 * 1024; // 50MB
      if (file.size > MAX_SIZE) {
        throw new AppFileUploadError('File is too large', {
          maxSize: MAX_SIZE,
          actualSize: file.size,
          fileName: file.name,
        });
      }

      const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
      if (!allowedTypes.includes(file.type)) {
        throw new AppFileUploadError('Invalid file type', {
          allowedTypes,
          actualType: file.type,
          fileName: file.name,
        });
      }

      // Upload file
      await uploadFile(file);

      // Success
    } catch (error) {
      // Show custom message to user
      handleErrorWithMessage(error, 'Failed to upload file. Please try again.');
    }
  };

  return (
    <Box>
      <input
        type="file"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFileUpload(file);
        }}
      />
    </Box>
  );
};

/**
 * Example Component: API Call with Error Handling
 */
export const ApiCallWithErrorHandling: React.FC = () => {
  const { wrapAsync } = useErrorHandler();
  const [data, setData] = useState<any>(null);

  // Wrap async function to automatically handle errors
  const fetchData = wrapAsync(
    async () => {
      const response = await fetch('/api/data');

      if (!response.ok) {
        if (response.status === 401) {
          throw new AuthenticationError('Please log in to continue');
        }
        if (response.status === 404) {
          throw new NetworkError('Data not found');
        }
        throw new NetworkError('Failed to fetch data');
      }

      const data = await response.json();
      setData(data);
    },
    {
      customMessage: 'Failed to load data',
    }
  );

  return (
    <Box>
      <Button onClick={fetchData}>Load Data</Button>
      {data && <Typography>{JSON.stringify(data)}</Typography>}
    </Box>
  );
};

/**
 * Example Component: Multiple Error Types
 */
export const MultipleErrorTypesExample: React.FC = () => {
  const { handleError } = useErrorHandler();

  const handleOperation = async (operation: string) => {
    try {
      switch (operation) {
        case 'validation':
          throw new ValidationError('Invalid input', {
            field1: 'Required',
            field2: 'Must be positive',
          });

        case 'auth':
          throw new AuthenticationError('Session expired');

        case 'network':
          throw new NetworkError('Connection lost');

        case 'upload':
          throw new AppFileUploadError('Upload failed', {
            reason: 'Network timeout',
          });

        default:
          throw new Error('Unknown operation');
      }
    } catch (error) {
      // All errors are handled appropriately based on their type
      handleError(error);
    }
  };

  return (
    <Box>
      <Typography variant="h6">Test Different Error Types</Typography>
      <Button onClick={() => handleOperation('validation')}>Validation Error</Button>
      <Button onClick={() => handleOperation('auth')}>Authentication Error</Button>
      <Button onClick={() => handleOperation('network')}>Network Error</Button>
      <Button onClick={() => handleOperation('upload')}>Upload Error</Button>
    </Box>
  );
};

/**
 * Example Component: Silent Error Logging
 */
export const SilentErrorLogging: React.FC = () => {
  const { logError } = useErrorHandler();

  const handleBackgroundTask = async () => {
    try {
      // Some background operation
      await backgroundTask();
    } catch (error) {
      // Log error without showing notification to user
      logError(error, {
        task: 'background-sync',
        timestamp: new Date().toISOString(),
      });
    }
  };

  return (
    <Box>
      <Button onClick={handleBackgroundTask}>Run Background Task</Button>
    </Box>
  );
};

// Mock functions for examples
async function submitForm(_email: string): Promise<void> {
  // Simulate API call
  await new Promise((resolve) => setTimeout(resolve, 1000));
}

async function uploadFile(_file: File): Promise<void> {
  // Simulate upload
  await new Promise((resolve) => setTimeout(resolve, 2000));
}

async function backgroundTask(): Promise<void> {
  // Simulate background task
  await new Promise((resolve) => setTimeout(resolve, 500));
}
