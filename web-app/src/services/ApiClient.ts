/**
 * API Client Implementation
 * Axios-based HTTP client with interceptors for authentication and error handling
 * Follows SOLID principles:
 * - Single Responsibility: Handles HTTP communication
 * - Dependency Inversion: Depends on IAuthService abstraction
 */

import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig, AxiosResponse } from 'axios';
import type { IApiClient, RequestConfig } from './IApiClient';
import type { IAuthService } from './IAuthService';
import type {
  FileMetadata,
  UploadResponse,
  PresignedUrlResponse,
  ApiErrorResponse,
} from '../types/api';
import { environment } from '../config/environment';

/**
 * Custom error class for API errors
 */
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public originalError?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * API Client implementation using Axios
 * Provides automatic token attachment, error handling, and retry logic
 */
export class ApiClient implements IApiClient {
  private axiosInstance: AxiosInstance;
  private authService: IAuthService;
  private readonly maxRetries = 3;
  private readonly retryDelay = 1000; // ms

  constructor(authService: IAuthService) {
    this.authService = authService;

    // Create Axios instance with base configuration
    this.axiosInstance = axios.create({
      baseURL: environment.apiUrl,
      timeout: 30000, // 30 seconds
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Set up interceptors
    this.setupRequestInterceptor();
    this.setupResponseInterceptor();
  }

  /**
   * Request interceptor to attach JWT token
   */
  private setupRequestInterceptor(): void {
    this.axiosInstance.interceptors.request.use(
      async (config: InternalAxiosRequestConfig) => {
        try {
          // Get token from auth service
          const token = await this.authService.getToken();

          // Attach token to Authorization header if available
          if (token && config.headers) {
            config.headers.Authorization = `Bearer ${token}`;
          }

          return config;
        } catch (error) {
          // If token retrieval fails, proceed without token
          // The API will return 401 if authentication is required
          return config;
        }
      },
      (error) => {
        return Promise.reject(error);
      }
    );
  }

  /**
   * Response interceptor for error handling and retry logic
   */
  private setupResponseInterceptor(): void {
    this.axiosInstance.interceptors.response.use(
      (response: AxiosResponse) => {
        // Return successful response
        return response;
      },
      async (error: AxiosError<ApiErrorResponse>) => {
        const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: number };

        // Handle 401 Unauthorized - attempt token refresh
        if (error.response?.status === 401 && !originalRequest._retry) {
          try {
            // Attempt to refresh token
            await this.authService.refreshToken();

            // Retry the original request
            originalRequest._retry = 1;
            return this.axiosInstance(originalRequest);
          } catch (refreshError) {
            // Token refresh failed, user needs to re-authenticate
            throw new ApiError(
              401,
              'AUTH_ERROR',
              'Authentication failed. Please log in again.',
              refreshError
            );
          }
        }

        // Handle network errors and 5xx errors with retry logic
        if (
          this.shouldRetry(error) &&
          (!originalRequest._retry || originalRequest._retry < this.maxRetries)
        ) {
          originalRequest._retry = (originalRequest._retry || 0) + 1;

          // Wait before retrying with exponential backoff
          await this.delay(this.retryDelay * originalRequest._retry);

          return this.axiosInstance(originalRequest);
        }

        // Transform error to ApiError
        throw this.transformError(error);
      }
    );
  }

  /**
   * Determine if request should be retried
   */
  private shouldRetry(error: AxiosError): boolean {
    // Retry on network errors
    if (!error.response) {
      return true;
    }

    // Retry on 5xx server errors (except 501 Not Implemented)
    const status = error.response.status;
    return status >= 500 && status !== 501;
  }

  /**
   * Transform Axios error to ApiError
   */
  private transformError(error: AxiosError<ApiErrorResponse>): ApiError {
    if (error.response) {
      // Server responded with error
      const { status, data } = error.response;
      return new ApiError(
        status,
        data?.error || 'API_ERROR',
        data?.message || error.message || 'An error occurred',
        error
      );
    } else if (error.request) {
      // Request made but no response received
      return new ApiError(
        0,
        'NETWORK_ERROR',
        'Network error. Please check your connection.',
        error
      );
    } else {
      // Error setting up request
      return new ApiError(0, 'REQUEST_ERROR', error.message || 'Failed to make request', error);
    }
  }

  /**
   * Delay helper for retry logic
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Generic GET request
   */
  async get<T>(endpoint: string, config?: RequestConfig): Promise<T> {
    const response = await this.axiosInstance.get<T>(endpoint, config);
    return response.data;
  }

  /**
   * Generic POST request
   */
  async post<T>(endpoint: string, data?: any, config?: RequestConfig): Promise<T> {
    const response = await this.axiosInstance.post<T>(endpoint, data, config);
    return response.data;
  }

  /**
   * Generic PUT request
   */
  async put<T>(endpoint: string, data?: any, config?: RequestConfig): Promise<T> {
    const response = await this.axiosInstance.put<T>(endpoint, data, config);
    return response.data;
  }

  /**
   * Generic DELETE request
   */
  async delete<T>(endpoint: string, config?: RequestConfig): Promise<T> {
    const response = await this.axiosInstance.delete<T>(endpoint, config);
    return response.data;
  }

  /**
   * Upload a file to the API
   */
  async uploadFile(file: File, onProgress?: (progress: number) => void): Promise<UploadResponse> {
    const formData = new FormData();
    formData.append('file', file);

    const config: RequestConfig = {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    };

    // Add progress tracking if callback provided
    if (onProgress) {
      const axiosConfig = {
        ...config,
        onUploadProgress: (progressEvent: any) => {
          if (progressEvent.total) {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            onProgress(percentCompleted);
          }
        },
      };
      const response = await this.axiosInstance.post<UploadResponse>(
        '/files/upload',
        formData,
        axiosConfig
      );
      return response.data;
    }

    return this.post<UploadResponse>('/files/upload', formData, config);
  }

  /**
   * Get list of files for the authenticated user
   */
  async getUserFiles(): Promise<FileMetadata[]> {
    return this.get<FileMetadata[]>('/api/files');
  }

  /**
   * Get metadata for a specific file
   */
  async getFileMetadata(fileId: string): Promise<FileMetadata> {
    return this.get<FileMetadata>(`/api/files/${fileId}`);
  }

  /**
   * Generate a presigned URL for file download
   */
  async getPresignedUrl(fileId: string): Promise<PresignedUrlResponse> {
    return this.post<PresignedUrlResponse>(`/api/files/${fileId}/presigned-url`);
  }
}
