/**
 * FileList Component Tests
 * Tests for file list rendering and interactions
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FileList } from '../FileList';
import type { IApiClient } from '../../../services/IApiClient';
import type { FileMetadata } from '../../../types/api';

describe('FileList', () => {
  let mockApiClient: jest.Mocked<IApiClient>;

  beforeEach(() => {
    // Create mock API client
    mockApiClient = {
      uploadFile: jest.fn(),
      getUserFiles: jest.fn(),
      getFileMetadata: jest.fn(),
      getPresignedUrl: jest.fn(),
      post: jest.fn(),
      get: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
    } as jest.Mocked<IApiClient>;

    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders file list component with title', () => {
      mockApiClient.getUserFiles.mockResolvedValue([]);

      render(<FileList apiClient={mockApiClient} />);

      expect(screen.getByText(/My Files/i)).toBeInTheDocument();
    });

    it('shows loading state initially', () => {
      mockApiClient.getUserFiles.mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      render(<FileList apiClient={mockApiClient} />);

      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('shows empty state when no files exist', async () => {
      mockApiClient.getUserFiles.mockResolvedValue([]);

      render(<FileList apiClient={mockApiClient} />);

      await waitFor(() => {
        expect(screen.getByText(/No files uploaded yet/i)).toBeInTheDocument();
      });
      expect(screen.getByText(/Upload your first file to get started/i)).toBeInTheDocument();
    });
  });

  describe('File List Display', () => {
    const mockFiles: FileMetadata[] = [
      {
        id: 'file-1',
        userId: 'user-1',
        fileName: 'document.pdf',
        fileSize: 1024 * 1024, // 1 MB
        mimeType: 'application/pdf',
        s3Key: 'uploads/document.pdf',
        s3Bucket: 'test-bucket',
        uploadedAt: '2024-01-15T10:30:00Z',
      },
      {
        id: 'file-2',
        userId: 'user-1',
        fileName: 'image.jpg',
        fileSize: 2 * 1024 * 1024, // 2 MB
        mimeType: 'image/jpeg',
        s3Key: 'uploads/image.jpg',
        s3Bucket: 'test-bucket',
        uploadedAt: '2024-01-16T14:45:00Z',
      },
    ];

    it('displays list of files', async () => {
      mockApiClient.getUserFiles.mockResolvedValue(mockFiles);

      render(<FileList apiClient={mockApiClient} />);

      await waitFor(() => {
        expect(screen.getByText('document.pdf')).toBeInTheDocument();
      });
      expect(screen.getByText('image.jpg')).toBeInTheDocument();
    });

    it('displays file metadata correctly', async () => {
      mockApiClient.getUserFiles.mockResolvedValue(mockFiles);

      render(<FileList apiClient={mockApiClient} />);

      await waitFor(() => {
        expect(screen.getByText('document.pdf')).toBeInTheDocument();
      });

      // Check file size formatting
      expect(screen.getByText(/1 MB/i)).toBeInTheDocument();
      expect(screen.getByText(/2 MB/i)).toBeInTheDocument();

      // Check file type labels
      expect(screen.getByText('PDF')).toBeInTheDocument();
      expect(screen.getByText('Image')).toBeInTheDocument();
    });

    it('displays file count', async () => {
      mockApiClient.getUserFiles.mockResolvedValue(mockFiles);

      render(<FileList apiClient={mockApiClient} />);

      await waitFor(() => {
        expect(screen.getByText(/2 files total/i)).toBeInTheDocument();
      });
    });

    it('displays singular file count for one file', async () => {
      mockApiClient.getUserFiles.mockResolvedValue([mockFiles[0]]);

      render(<FileList apiClient={mockApiClient} />);

      await waitFor(() => {
        expect(screen.getByText(/1 file total/i)).toBeInTheDocument();
      });
    });
  });

  describe('File Download', () => {
    const mockFile: FileMetadata = {
      id: 'file-1',
      userId: 'user-1',
      fileName: 'document.pdf',
      fileSize: 1024 * 1024,
      mimeType: 'application/pdf',
      s3Key: 'uploads/document.pdf',
      s3Bucket: 'test-bucket',
      uploadedAt: '2024-01-15T10:30:00Z',
    };

    it('handles file download on button click', async () => {
      mockApiClient.getUserFiles.mockResolvedValue([mockFile]);
      mockApiClient.getPresignedUrl.mockResolvedValue({
        url: 'https://example.com/download/document.pdf',
        expiresIn: 3600,
      });

      render(<FileList apiClient={mockApiClient} />);

      await waitFor(() => {
        expect(screen.getByText('document.pdf')).toBeInTheDocument();
      });

      const downloadButton = screen.getByRole('button', { name: /Download document.pdf/i });
      await userEvent.click(downloadButton);

      await waitFor(() => {
        expect(mockApiClient.getPresignedUrl).toHaveBeenCalledWith('file-1');
      });
    });

    it('shows error message on download failure', async () => {
      mockApiClient.getUserFiles.mockResolvedValue([mockFile]);
      mockApiClient.getPresignedUrl.mockRejectedValue(new Error('Download failed'));

      render(<FileList apiClient={mockApiClient} />);

      await waitFor(() => {
        expect(screen.getByText('document.pdf')).toBeInTheDocument();
      });

      const downloadButton = screen.getByRole('button', { name: /Download document.pdf/i });
      await userEvent.click(downloadButton);

      await waitFor(() => {
        expect(screen.getByText(/Download failed/i)).toBeInTheDocument();
      });
    });
  });

  describe('Refresh Functionality', () => {
    it('reloads files when refresh button is clicked', async () => {
      const initialFiles: FileMetadata[] = [
        {
          id: 'file-1',
          userId: 'user-1',
          fileName: 'old.pdf',
          fileSize: 1024,
          mimeType: 'application/pdf',
          s3Key: 'uploads/old.pdf',
          s3Bucket: 'test-bucket',
          uploadedAt: '2024-01-15T10:30:00Z',
        },
      ];

      const updatedFiles: FileMetadata[] = [
        ...initialFiles,
        {
          id: 'file-2',
          userId: 'user-1',
          fileName: 'new.pdf',
          fileSize: 2048,
          mimeType: 'application/pdf',
          s3Key: 'uploads/new.pdf',
          s3Bucket: 'test-bucket',
          uploadedAt: '2024-01-16T10:30:00Z',
        },
      ];

      mockApiClient.getUserFiles
        .mockResolvedValueOnce(initialFiles)
        .mockResolvedValueOnce(updatedFiles);

      render(<FileList apiClient={mockApiClient} />);

      await waitFor(() => {
        expect(screen.getByText('old.pdf')).toBeInTheDocument();
      });

      const refreshButton = screen.getByRole('button', { name: /Refresh file list/i });
      await userEvent.click(refreshButton);

      await waitFor(() => {
        expect(screen.getByText('new.pdf')).toBeInTheDocument();
      });
      expect(mockApiClient.getUserFiles).toHaveBeenCalledTimes(2);
    });

    it('reloads files when refreshTrigger prop changes', async () => {
      const files: FileMetadata[] = [
        {
          id: 'file-1',
          userId: 'user-1',
          fileName: 'test.pdf',
          fileSize: 1024,
          mimeType: 'application/pdf',
          s3Key: 'uploads/test.pdf',
          s3Bucket: 'test-bucket',
          uploadedAt: '2024-01-15T10:30:00Z',
        },
      ];

      mockApiClient.getUserFiles.mockResolvedValue(files);

      const { rerender } = render(<FileList apiClient={mockApiClient} refreshTrigger={1} />);

      await waitFor(() => {
        expect(screen.getByText('test.pdf')).toBeInTheDocument();
      });

      expect(mockApiClient.getUserFiles).toHaveBeenCalledTimes(1);

      // Change refresh trigger
      rerender(<FileList apiClient={mockApiClient} refreshTrigger={2} />);

      await waitFor(() => {
        expect(mockApiClient.getUserFiles).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Error Handling', () => {
    it('displays error message when file loading fails', async () => {
      mockApiClient.getUserFiles.mockRejectedValue(new Error('Failed to load files'));

      render(<FileList apiClient={mockApiClient} />);

      await waitFor(() => {
        expect(screen.getByText(/Failed to load files/i)).toBeInTheDocument();
      });
    });

    it('allows dismissing error message', async () => {
      mockApiClient.getUserFiles.mockRejectedValue(new Error('Failed to load files'));

      render(<FileList apiClient={mockApiClient} />);

      await waitFor(() => {
        expect(screen.getByText(/Failed to load files/i)).toBeInTheDocument();
      });

      // Find and click the close button in the alert
      const closeButton = screen.getByRole('button', { name: /close/i });
      await userEvent.click(closeButton);

      await waitFor(() => {
        expect(screen.queryByText(/Failed to load files/i)).not.toBeInTheDocument();
      });
    });
  });
});
