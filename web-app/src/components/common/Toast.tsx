import React, { createContext, useContext, useState, useCallback } from 'react';
import { Snackbar, Alert, AlertColor, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

/**
 * Toast notification type
 */
export type ToastType = 'success' | 'error' | 'warning' | 'info';

/**
 * Toast notification interface
 */
export interface IToast {
  /**
   * Unique toast ID
   */
  id: string;

  /**
   * Toast message
   */
  message: string;

  /**
   * Toast type
   */
  type: ToastType;

  /**
   * Duration in milliseconds (0 for persistent)
   */
  duration?: number;
}

/**
 * Toast context interface following Dependency Inversion Principle
 */
export interface IToastContext {
  /**
   * Show a toast notification
   */
  showToast: (message: string, type?: ToastType, duration?: number) => void;

  /**
   * Show success toast
   */
  showSuccess: (message: string, duration?: number) => void;

  /**
   * Show error toast
   */
  showError: (message: string, duration?: number) => void;

  /**
   * Show warning toast
   */
  showWarning: (message: string, duration?: number) => void;

  /**
   * Show info toast
   */
  showInfo: (message: string, duration?: number) => void;

  /**
   * Hide a specific toast
   */
  hideToast: (id: string) => void;

  /**
   * Hide all toasts
   */
  hideAllToasts: () => void;
}

// Create context
const ToastContext = createContext<IToastContext | undefined>(undefined);

/**
 * Toast provider props
 */
export interface IToastProviderProps {
  children: React.ReactNode;
  /**
   * Default duration for toasts in milliseconds
   */
  defaultDuration?: number;
  /**
   * Maximum number of toasts to show at once
   */
  maxToasts?: number;
}

/**
 * Toast provider component following Single Responsibility Principle
 * Manages toast state and provides toast functions
 */
export const ToastProvider: React.FC<IToastProviderProps> = ({
  children,
  defaultDuration = 6000,
  maxToasts = 3,
}) => {
  const [toasts, setToasts] = useState<IToast[]>([]);

  // Generate unique ID
  const generateId = useCallback(() => {
    return `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  // Show toast
  const showToast = useCallback(
    (message: string, type: ToastType = 'info', duration: number = defaultDuration) => {
      const id = generateId();
      const newToast: IToast = { id, message, type, duration };

      setToasts((prev) => {
        const updated = [...prev, newToast];
        // Limit number of toasts
        return updated.slice(-maxToasts);
      });

      // Auto-hide after duration
      if (duration > 0) {
        setTimeout(() => {
          hideToast(id);
        }, duration);
      }
    },
    [defaultDuration, maxToasts, generateId]
  );

  // Convenience methods
  const showSuccess = useCallback(
    (message: string, duration?: number) => showToast(message, 'success', duration),
    [showToast]
  );

  const showError = useCallback(
    (message: string, duration?: number) => showToast(message, 'error', duration),
    [showToast]
  );

  const showWarning = useCallback(
    (message: string, duration?: number) => showToast(message, 'warning', duration),
    [showToast]
  );

  const showInfo = useCallback(
    (message: string, duration?: number) => showToast(message, 'info', duration),
    [showToast]
  );

  // Hide specific toast
  const hideToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  // Hide all toasts
  const hideAllToasts = useCallback(() => {
    setToasts([]);
  }, []);

  const contextValue: IToastContext = {
    showToast,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    hideToast,
    hideAllToasts,
  };

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      {toasts.map((toast) => (
        <Snackbar
          key={toast.id}
          open={true}
          autoHideDuration={toast.duration || null}
          onClose={() => hideToast(toast.id)}
          anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        >
          <Alert
            severity={toast.type as AlertColor}
            variant="filled"
            onClose={() => hideToast(toast.id)}
            role="alert"
            aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
            aria-atomic="true"
            action={
              <IconButton
                size="small"
                aria-label={`Close ${toast.type} notification`}
                color="inherit"
                onClick={() => hideToast(toast.id)}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            }
          >
            {toast.message}
          </Alert>
        </Snackbar>
      ))}
    </ToastContext.Provider>
  );
};

/**
 * Hook to use toast notifications
 * Following Dependency Inversion Principle - depends on abstraction (IToastContext)
 */
export const useToast = (): IToastContext => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
