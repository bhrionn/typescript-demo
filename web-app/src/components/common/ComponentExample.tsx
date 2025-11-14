/**
 * Example usage of UI components
 * This file demonstrates how to use the component library
 */

import React, { useState } from 'react';
import { Box, Typography, Stack } from '@mui/material';
import { Button } from './Button';
import { Input } from './Input';
import { Card } from './Card';
import { Modal } from './Modal';
import { useToast } from './Toast';

/**
 * Component examples demonstrating SOLID principles in action
 */
export const ComponentExample: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  // Button examples
  const handleButtonClick = (variant: string) => {
    toast.showInfo(`${variant} button clicked!`);
  };

  // Form submission example
  const handleSubmit = async () => {
    setLoading(true);

    // Simulate API call
    setTimeout(() => {
      setLoading(false);
      toast.showSuccess('Form submitted successfully!');
    }, 2000);
  };

  // Modal example
  const handleOpenModal = () => {
    setModalOpen(true);
  };

  const handleConfirm = () => {
    toast.showSuccess('Action confirmed!');
    setModalOpen(false);
  };

  return (
    <Box sx={{ p: 4, maxWidth: 1200, margin: '0 auto' }}>
      <Typography variant="h3" gutterBottom>
        UI Component Library Examples
      </Typography>

      {/* Button Examples */}
      <Card title="Button Component" subtitle="Various button variants" elevation={2}>
        <Stack direction="row" spacing={2} flexWrap="wrap" gap={2}>
          <Button variant="primary" onClick={() => handleButtonClick('Primary')}>
            Primary Button
          </Button>
          <Button variant="secondary" onClick={() => handleButtonClick('Secondary')}>
            Secondary Button
          </Button>
          <Button variant="outlined" onClick={() => handleButtonClick('Outlined')}>
            Outlined Button
          </Button>
          <Button variant="text" onClick={() => handleButtonClick('Text')}>
            Text Button
          </Button>
          <Button variant="danger" onClick={() => handleButtonClick('Danger')}>
            Danger Button
          </Button>
          <Button variant="primary" loading={true}>
            Loading Button
          </Button>
          <Button variant="primary" disabled>
            Disabled Button
          </Button>
        </Stack>
      </Card>

      <Box sx={{ mt: 3 }} />

      {/* Input Examples */}
      <Card title="Input Component" subtitle="Form inputs with validation" elevation={2}>
        <Stack spacing={3}>
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={setEmail}
            placeholder="Enter your email"
            required
            validationRules={[
              {
                validate: (value) => value.includes('@'),
                message: 'Please enter a valid email address',
              },
            ]}
            helperText="We'll never share your email"
          />

          <Input
            label="Password"
            type="password"
            value={password}
            onChange={setPassword}
            placeholder="Enter your password"
            required
            validationRules={[
              {
                validate: (value) => value.length >= 8,
                message: 'Password must be at least 8 characters',
              },
            ]}
          />

          <Input
            label="Comments"
            value=""
            onChange={() => {}}
            multiline
            rows={4}
            placeholder="Enter your comments"
          />

          <Button variant="primary" onClick={handleSubmit} loading={loading} fullWidth>
            Submit Form
          </Button>
        </Stack>
      </Card>

      <Box sx={{ mt: 3 }} />

      {/* Card Examples */}
      <Stack direction="row" spacing={2} flexWrap="wrap" gap={2}>
        <Card
          title="Simple Card"
          subtitle="A basic card example"
          elevation={2}
          actions={
            <>
              <Button variant="text">Cancel</Button>
              <Button variant="primary">Save</Button>
            </>
          }
        >
          <Typography>
            This is a simple card with a title, subtitle, content, and actions.
          </Typography>
        </Card>

        <Card
          title="Clickable Card"
          subtitle="Click me!"
          elevation={2}
          onClick={() => toast.showInfo('Card clicked!')}
        >
          <Typography>
            This card is clickable and will show a toast notification when clicked.
          </Typography>
        </Card>

        <Card title="Outlined Card" variant="outlined">
          <Typography>This card uses the outlined variant instead of elevation.</Typography>
        </Card>
      </Stack>

      <Box sx={{ mt: 3 }} />

      {/* Modal Example */}
      <Card title="Modal Component" subtitle="Dialog and modal examples" elevation={2}>
        <Stack spacing={2}>
          <Typography>Click the button below to open a modal dialog.</Typography>
          <Button variant="primary" onClick={handleOpenModal}>
            Open Modal
          </Button>
        </Stack>
      </Card>

      {/* Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Confirm Action"
        size="sm"
        showDividers
        actions={
          <>
            <Button variant="text" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleConfirm}>
              Confirm
            </Button>
          </>
        }
      >
        <Typography>
          Are you sure you want to proceed with this action? This is an example of a confirmation
          modal with proper accessibility features.
        </Typography>
      </Modal>

      <Box sx={{ mt: 3 }} />

      {/* Toast Examples */}
      <Card title="Toast Notifications" subtitle="Temporary notification messages" elevation={2}>
        <Stack direction="row" spacing={2} flexWrap="wrap" gap={2}>
          <Button variant="primary" onClick={() => toast.showSuccess('Success message!')}>
            Show Success
          </Button>
          <Button variant="primary" onClick={() => toast.showError('Error message!')}>
            Show Error
          </Button>
          <Button variant="primary" onClick={() => toast.showWarning('Warning message!')}>
            Show Warning
          </Button>
          <Button variant="primary" onClick={() => toast.showInfo('Info message!')}>
            Show Info
          </Button>
        </Stack>
      </Card>
    </Box>
  );
};
