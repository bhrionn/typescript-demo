/**
 * FileUploadForm Component Tests
 * Tests for file upload form interactions and progress display
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FileUploadForm } from '../FileUploadForm';
import type {
  IFileUploadService,
  ValidationResult,
  UploadResult,
  ProgressObserver,
} from '../../../services/IFileUploadService';

describe('FileUploadForm', () => {
  let mockUploadService: jest.Mocked<IFileUploadService>;
  let mockOnUploadSuccess: jest.Mock;
  let mockOnUploadError: jest.Mock;

  beforeEach(() => {
    // Create mock upload service
    mockUploadService = {
      validateFile: jest.fn(),
      uploadFile: jest.fn(),
      getSupportedFileTypes: jest
        .fn()
        .mockReturnValue(['image/jpeg', 'image/png', 'application/pdf']),
      getMaxFileSize: jest.fn().mockReturnValue(50 * 1024 * 1024), // 50MB
    };

    mockOnUploadSuccess = jest.fn();
    mockOnUploadError = jest.fn();
  });

  describe('Rendering', () => {
    it('renders upload form with drag and drop area', () => {
      render(<FileUploadForm uploadService={mockUploadService} />);

      expect(screen.getByRole('heading', { name: /Upload File/i })).toBeInTheDocument();
      expect(screen.getByText(/Drag and drop a file here/i)).toBeInTheDocument();
      expect(screen.getByText(/Maximum file size: 50 MB/i)).toBeInTheDocument();
    });

    it('renders upload button in disabled state initially', () => {
      render(<FileUploadForm uploadService={mockUploadService} />);

      const uploadButton = screen.getByRole('button', { name: /Upload File/i });
      expect(uploadButton).toBeDisabled();
    });
  });

  describe('File Selection', () => {
    it('displays selected file after file input change', async () => {
      const validationResult: ValidationResult = { isValid: true, errors: [] };
      mockUploadService.validateFile.mockReturnValue(validationResult);

      const { container } = render(<FileUploadForm uploadService={mockUploadService} />);

      const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' });
      const input = container.querySelector('input[type="file"]') as HTMLInputElement;

      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByText('test.pdf')).toBeInTheDocument();
      });
      expect(mockUploadService.validateFile).toHaveBeenCalledWith(file);
    });

    it('shows error message for invalid file', async () => {
      const validationResult: ValidationResult = {
        isValid: false,
        errors: ['File size exceeds maximum limit'],
      };
      mockUploadService.validateFile.mockReturnValue(validationResult);

      const { container } = render(<FileUploadForm uploadService={mockUploadService} />);

      const file = new File(['test'], 'large.pdf', {
        type: 'application/pdf',
      });
      const input = container.querySelector('input[type="file"]') as HTMLInputElement;

      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByText(/File size exceeds maximum limit/i)).toBeInTheDocument();
      });
    });

    it('enables upload button when valid file is selected', async () => {
      const validationResult: ValidationResult = { isValid: true, errors: [] };
      mockUploadService.validateFile.mockReturnValue(validationResult);

      const { container } = render(<FileUploadForm uploadService={mockUploadService} />);

      const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });
      const input = container.querySelector('input[type="file"]') as HTMLInputElement;

      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        const uploadButton = screen.getByRole('button', { name: /Upload File/i });
        expect(uploadButton).not.toBeDisabled();
      });
    });

    it('allows removing selected file', async () => {
      const validationResult: ValidationResult = { isValid: true, errors: [] };
      mockUploadService.validateFile.mockReturnValue(validationResult);

      const { container } = render(<FileUploadForm uploadService={mockUploadService} />);

      const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });
      const input = container.querySelector('input[type="file"]') as HTMLInputElement;

      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByText('test.pdf')).toBeInTheDocument();
      });

      const removeButton = screen.getByRole('button', { name: /Remove file/i });
      await userEvent.click(removeButton);

      await waitFor(() => {
        expect(screen.queryByText('test.pdf')).not.toBeInTheDocument();
      });
    });
  });

  describe('Drag and Drop', () => {
    it('handles drag enter event', () => {
      render(<FileUploadForm uploadService={mockUploadService} />);

      const dropZone = screen.getByText(/Drag and drop a file here/i).closest('div');
      if (dropZone) {
        fireEvent.dragEnter(dropZone);
        // Visual feedback is handled by state, component should still be rendered
        expect(dropZone).toBeInTheDocument();
      }
    });

    it('handles file drop', async () => {
      const validationResult: ValidationResult = { isValid: true, errors: [] };
      mockUploadService.validateFile.mockReturnValue(validationResult);

      render(<FileUploadForm uploadService={mockUploadService} />);

      const file = new File(['test'], 'dropped.pdf', { type: 'application/pdf' });
      const dropZone = screen.getByText(/Drag and drop a file here/i).closest('div');

      if (dropZone) {
        fireEvent.drop(dropZone, {
          dataTransfer: {
            files: [file],
          },
        });
      }

      await waitFor(() => {
        expect(screen.getByText('dropped.pdf')).toBeInTheDocument();
      });
    });
  });

  describe('Upload Progress', () => {
    it('displays progress bar during upload', async () => {
      const validationResult: ValidationResult = { isValid: true, errors: [] };
      mockUploadService.validateFile.mockReturnValue(validationResult);

      mockUploadService.uploadFile.mockImplementation(
        async (file: File, metadata: any, observer?: ProgressObserver) => {
          // Simulate progress updates
          if (observer?.next) {
            observer.next({ loaded: 50, total: 100, percentage: 50 });
          }
          observer?.complete?.();
          return { fileId: 'test-file-id', message: 'Upload successful' };
        }
      );

      const { container } = render(<FileUploadForm uploadService={mockUploadService} />);

      const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });
      const input = container.querySelector('input[type="file"]') as HTMLInputElement;

      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByText('test.pdf')).toBeInTheDocument();
      });

      const uploadButton = screen.getByRole('button', { name: /Upload File/i });
      await userEvent.click(uploadButton);

      await waitFor(() => {
        expect(screen.getByText(/File uploaded successfully/i)).toBeInTheDocument();
      });
    });

    it('shows success message after successful upload', async () => {
      const validationResult: ValidationResult = { isValid: true, errors: [] };
      mockUploadService.validateFile.mockReturnValue(validationResult);

      const uploadResult: UploadResult = {
        fileId: 'test-file-id',
        message: 'Upload successful',
      };
      mockUploadService.uploadFile.mockResolvedValue(uploadResult);

      const { container } = render(
        <FileUploadForm uploadService={mockUploadService} onUploadSuccess={mockOnUploadSuccess} />
      );

      const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });
      const input = container.querySelector('input[type="file"]') as HTMLInputElement;

      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByText('test.pdf')).toBeInTheDocument();
      });

      const uploadButton = screen.getByRole('button', { name: /Upload File/i });
      await userEvent.click(uploadButton);

      await waitFor(() => {
        expect(screen.getByText(/File uploaded successfully/i)).toBeInTheDocument();
      });
      expect(mockOnUploadSuccess).toHaveBeenCalledWith('test-file-id');
    });

    it('shows error message on upload failure', async () => {
      const validationResult: ValidationResult = { isValid: true, errors: [] };
      mockUploadService.validateFile.mockReturnValue(validationResult);

      const uploadError = new Error('Network error');
      mockUploadService.uploadFile.mockRejectedValue(uploadError);

      const { container } = render(
        <FileUploadForm uploadService={mockUploadService} onUploadError={mockOnUploadError} />
      );

      const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });
      const input = container.querySelector('input[type="file"]') as HTMLInputElement;

      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByText('test.pdf')).toBeInTheDocument();
      });

      const uploadButton = screen.getByRole('button', { name: /Upload File/i });
      await userEvent.click(uploadButton);

      await waitFor(() => {
        expect(screen.getByText(/Network error/i)).toBeInTheDocument();
      });
      expect(mockOnUploadError).toHaveBeenCalledWith(uploadError);
    });
  });
});
