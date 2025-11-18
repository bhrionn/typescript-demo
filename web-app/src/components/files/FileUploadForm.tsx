/**
 * File Upload Form Component
 * Provides drag-and-drop file upload with progress tracking
 * Following SOLID principles:
 * - Single Responsibility: Handles file upload UI
 * - Dependency Inversion: Depends on IFileUploadService abstraction
 */

import React, { useState, useRef, useCallback } from 'react';
import {
  Box,
  Button,
  LinearProgress,
  Typography,
  Paper,
  Stack,
  Alert,
  IconButton,
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  Close as CloseIcon,
  InsertDriveFile as FileIcon,
} from '@mui/icons-material';
import type { IFileUploadService, UploadProgress } from '../../services/IFileUploadService';
import { announceToScreenReader } from '../../utils/accessibility';

interface FileUploadFormProps {
  uploadService: IFileUploadService;
  onUploadSuccess?: (fileId: string) => void;
  onUploadError?: (error: Error) => void;
}

/**
 * File Upload Form Component
 * Provides drag-and-drop interface with progress tracking
 */
export const FileUploadForm: React.FC<FileUploadFormProps> = ({
  uploadService,
  onUploadSuccess,
  onUploadError,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * Handle file selection
   */
  const handleFileSelect = useCallback(
    (file: File | null) => {
      if (!file) {
        setSelectedFile(null);
        setError(null);
        return;
      }

      // Validate file
      const validation = uploadService.validateFile(file);
      if (!validation.isValid) {
        const errorMsg = validation.errors.join(', ');
        setError(errorMsg);
        setSelectedFile(null);
        announceToScreenReader(`File validation failed: ${errorMsg}`, 'assertive');
        return;
      }

      setSelectedFile(file);
      setError(null);
      setSuccess(null);
      announceToScreenReader(`File selected: ${file.name}`, 'polite');
    },
    [uploadService]
  );

  /**
   * Handle file input change
   */
  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    handleFileSelect(file);
  };

  /**
   * Handle drag events
   */
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0] || null;
    handleFileSelect(file);
  };

  /**
   * Handle file upload
   */
  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setError(null);
    setSuccess(null);
    setUploadProgress(0);

    try {
      const result = await uploadService.uploadFile(selectedFile, undefined, {
        next: (progress: UploadProgress) => {
          setUploadProgress(progress.percentage);
          // Announce progress at 25%, 50%, 75%, and 100%
          if (progress.percentage % 25 === 0) {
            announceToScreenReader(`Upload progress: ${progress.percentage}%`, 'polite');
          }
        },
        error: (err: Error) => {
          setError(err.message);
          setIsUploading(false);
          announceToScreenReader(`Upload failed: ${err.message}`, 'assertive');
          onUploadError?.(err);
        },
        complete: () => {
          setIsUploading(false);
        },
      });

      const successMsg = `File uploaded successfully! File ID: ${result.fileId}`;
      setSuccess(successMsg);
      setSelectedFile(null);
      setUploadProgress(0);
      announceToScreenReader('File uploaded successfully', 'polite');
      onUploadSuccess?.(result.fileId);

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to upload file';
      setError(errorMessage);
      setIsUploading(false);
      onUploadError?.(err instanceof Error ? err : new Error(errorMessage));
    }
  };

  /**
   * Clear selected file
   */
  const handleClearFile = () => {
    setSelectedFile(null);
    setError(null);
    setSuccess(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  /**
   * Open file picker
   */
  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  /**
   * Format file size for display
   */
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Upload File
      </Typography>

      {/* Drag and Drop Area */}
      <Box
        role="button"
        tabIndex={0}
        aria-label="File upload area. Drag and drop a file here, or press Enter to browse"
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={handleBrowseClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleBrowseClick();
          }
        }}
        sx={{
          border: '2px dashed',
          borderColor: isDragging ? 'primary.main' : 'grey.300',
          borderRadius: 2,
          p: 4,
          textAlign: 'center',
          bgcolor: isDragging ? 'action.hover' : 'background.paper',
          cursor: 'pointer',
          transition: 'all 0.2s',
          '&:hover': {
            borderColor: 'primary.main',
            bgcolor: 'action.hover',
          },
          '&:focus-visible': {
            outline: '2px solid',
            outlineColor: 'primary.main',
            outlineOffset: '2px',
          },
        }}
      >
        <UploadIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} aria-hidden="true" />
        <Typography variant="body1" gutterBottom>
          Drag and drop a file here, or click to browse
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Maximum file size: {formatFileSize(uploadService.getMaxFileSize())}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Supported: Images and Documents
        </Typography>
      </Box>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        onChange={handleFileInputChange}
        style={{ display: 'none' }}
        accept={uploadService.getSupportedFileTypes().join(',')}
        aria-label="File input"
      />

      {/* Selected File Preview */}
      {selectedFile && (
        <Box sx={{ mt: 2 }}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Stack direction="row" alignItems="center" spacing={2}>
              <FileIcon color="primary" />
              <Box sx={{ flexGrow: 1 }}>
                <Typography variant="body1">{selectedFile.name}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {formatFileSize(selectedFile.size)} • {selectedFile.type}
                </Typography>
              </Box>
              {!isUploading && (
                <IconButton onClick={handleClearFile} size="small" aria-label="Remove file">
                  <CloseIcon />
                </IconButton>
              )}
            </Stack>
          </Paper>
        </Box>
      )}

      {/* Upload Progress */}
      {isUploading && (
        <Box sx={{ mt: 2 }} role="status" aria-live="polite" aria-atomic="true">
          <Stack spacing={1}>
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="body2">Uploading...</Typography>
              <Typography variant="body2" aria-label={`Upload progress: ${uploadProgress} percent`}>
                {uploadProgress}%
              </Typography>
            </Stack>
            <LinearProgress
              variant="determinate"
              value={uploadProgress}
              aria-label="Upload progress bar"
            />
          </Stack>
        </Box>
      )}

      {/* Error Message */}
      {error && (
        <Alert severity="error" sx={{ mt: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Success Message */}
      {success && (
        <Alert severity="success" sx={{ mt: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      {/* Upload Button */}
      <Box sx={{ mt: 2 }}>
        <Button
          variant="contained"
          startIcon={<UploadIcon />}
          onClick={handleUpload}
          disabled={!selectedFile || isUploading}
          fullWidth
          aria-label={isUploading ? 'Uploading file, please wait' : 'Upload selected file'}
        >
          {isUploading ? 'Uploading...' : 'Upload File'}
        </Button>
      </Box>
    </Paper>
  );
};
