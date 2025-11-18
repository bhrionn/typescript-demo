/**
 * File List Component
 * Displays list of uploaded files with download functionality
 * Following SOLID principles:
 * - Single Responsibility: Handles file list display
 * - Dependency Inversion: Depends on IApiClient abstraction
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  IconButton,
  CircularProgress,
  Alert,
  Chip,
  Stack,
} from '@mui/material';
import {
  InsertDriveFile as FileIcon,
  Download as DownloadIcon,
  Refresh as RefreshIcon,
  Image as ImageIcon,
  Description as DocumentIcon,
} from '@mui/icons-material';
import type { IApiClient } from '../../services/IApiClient';
import type { FileMetadata } from '../../types/api';
import { announceToScreenReader } from '../../utils/accessibility';

interface FileListProps {
  apiClient: IApiClient;
  refreshTrigger?: number;
}

/**
 * File List Component
 * Displays uploaded files with download functionality
 */
export const FileList: React.FC<FileListProps> = ({ apiClient, refreshTrigger }) => {
  const [files, setFiles] = useState<FileMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadingFileId, setDownloadingFileId] = useState<string | null>(null);

  /**
   * Load files from API
   */
  const loadFiles = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const userFiles = await apiClient.getUserFiles();
      setFiles(userFiles);
      announceToScreenReader(
        `Loaded ${userFiles.length} ${userFiles.length === 1 ? 'file' : 'files'}`,
        'polite'
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load files';
      setError(errorMessage);
      announceToScreenReader(`Error: ${errorMessage}`, 'assertive');
    } finally {
      setIsLoading(false);
    }
  }, [apiClient]);

  /**
   * Load files on mount and when refresh trigger changes
   */
  useEffect(() => {
    loadFiles();
  }, [loadFiles, refreshTrigger]);

  /**
   * Handle file download
   */
  const handleDownload = async (file: FileMetadata) => {
    setDownloadingFileId(file.id);
    setError(null);
    announceToScreenReader(`Downloading ${file.fileName}`, 'polite');

    try {
      // Get presigned URL
      const { url } = await apiClient.getPresignedUrl(file.id);

      // Create temporary link and trigger download
      const link = document.createElement('a');
      link.href = url;
      link.download = file.fileName;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      announceToScreenReader(`Download started for ${file.fileName}`, 'polite');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to download file';
      setError(errorMessage);
      announceToScreenReader(`Download failed: ${errorMessage}`, 'assertive');
    } finally {
      setDownloadingFileId(null);
    }
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

  /**
   * Format date for display
   */
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  /**
   * Get file icon based on MIME type
   */
  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) {
      return <ImageIcon color="primary" />;
    } else if (
      mimeType.includes('pdf') ||
      mimeType.includes('document') ||
      mimeType.includes('text')
    ) {
      return <DocumentIcon color="primary" />;
    }
    return <FileIcon color="primary" />;
  };

  /**
   * Get file type label
   */
  const getFileTypeLabel = (mimeType: string): string => {
    if (mimeType.startsWith('image/')) return 'Image';
    if (mimeType.includes('pdf')) return 'PDF';
    if (mimeType.includes('document')) return 'Document';
    if (mimeType.includes('spreadsheet')) return 'Spreadsheet';
    if (mimeType.includes('presentation')) return 'Presentation';
    if (mimeType.includes('text')) return 'Text';
    return 'File';
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h6">My Files</Typography>
        <IconButton onClick={loadFiles} disabled={isLoading} aria-label="Refresh file list">
          <RefreshIcon />
        </IconButton>
      </Stack>

      {/* Error Message */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Loading State */}
      {isLoading && (
        <Box
          sx={{ display: 'flex', justifyContent: 'center', p: 4 }}
          role="status"
          aria-live="polite"
          aria-label="Loading files"
        >
          <CircularProgress aria-label="Loading" />
        </Box>
      )}

      {/* Empty State */}
      {!isLoading && files.length === 0 && (
        <Box sx={{ textAlign: 'center', p: 4 }} role="status">
          <FileIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} aria-hidden="true" />
          <Typography variant="body1" color="text.secondary">
            No files uploaded yet
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Upload your first file to get started
          </Typography>
        </Box>
      )}

      {/* File List */}
      {!isLoading && files.length > 0 && (
        <List aria-label="Uploaded files list">
          {files.map((file) => (
            <ListItem
              key={file.id}
              sx={{
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
                mb: 1,
                '&:last-child': { mb: 0 },
              }}
              secondaryAction={
                <IconButton
                  edge="end"
                  onClick={() => handleDownload(file)}
                  disabled={downloadingFileId === file.id}
                  aria-label={`Download ${file.fileName}`}
                >
                  {downloadingFileId === file.id ? (
                    <CircularProgress size={24} aria-label="Downloading" />
                  ) : (
                    <DownloadIcon />
                  )}
                </IconButton>
              }
            >
              <ListItemIcon aria-hidden="true">{getFileIcon(file.mimeType)}</ListItemIcon>
              <ListItemText
                primary={
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="body1">{file.fileName}</Typography>
                    <Chip
                      label={getFileTypeLabel(file.mimeType)}
                      size="small"
                      aria-label={`File type: ${getFileTypeLabel(file.mimeType)}`}
                    />
                  </Stack>
                }
                secondary={
                  <Stack spacing={0.5} sx={{ mt: 0.5 }}>
                    <Typography variant="body2" color="text.secondary">
                      Size: {formatFileSize(file.fileSize)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Uploaded: {formatDate(file.uploadedAt)}
                    </Typography>
                  </Stack>
                }
              />
            </ListItem>
          ))}
        </List>
      )}

      {/* File Count */}
      {!isLoading && files.length > 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2, textAlign: 'center' }}>
          {files.length} {files.length === 1 ? 'file' : 'files'} total
        </Typography>
      )}
    </Paper>
  );
};
