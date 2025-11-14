import { render, screen, waitFor } from '@testing-library/react';
import App from './App';

// Mock AWS Amplify to avoid actual authentication calls
jest.mock('aws-amplify/auth', () => ({
  fetchAuthSession: jest.fn().mockResolvedValue({ tokens: null }),
  getCurrentUser: jest.fn().mockRejectedValue(new Error('Not authenticated')),
  fetchUserAttributes: jest.fn().mockResolvedValue({}),
  signInWithRedirect: jest.fn(),
  signOut: jest.fn(),
}));

jest.mock('aws-amplify', () => ({
  Amplify: {
    configure: jest.fn(),
  },
}));

describe('App', () => {
  it('renders without crashing', async () => {
    render(<App />);

    // Wait for authentication check to complete
    await waitFor(() => {
      expect(screen.queryByText(/Verifying authentication/i)).not.toBeInTheDocument();
    });

    // Should show login page since user is not authenticated
    expect(screen.getByText(/Welcome/i)).toBeInTheDocument();
  });

  it('displays login page for unauthenticated users', async () => {
    render(<App />);

    // Wait for authentication check and login page to render
    await waitFor(() => {
      expect(screen.queryByText(/Verifying authentication/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Checking authentication status/i)).not.toBeInTheDocument();
    });

    // Should show provider buttons
    await waitFor(() => {
      expect(screen.getByText(/Continue with Google/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/Continue with Microsoft/i)).toBeInTheDocument();
  });
});
