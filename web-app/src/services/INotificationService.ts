/**
 * Notification Service Interface
 * Following Interface Segregation Principle - focused interface for notifications
 * Following Dependency Inversion Principle - depend on abstraction
 */

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

/**
 * Notification options
 */
export interface NotificationOptions {
  /**
   * Duration in milliseconds (0 for persistent)
   */
  duration?: number;

  /**
   * Whether notification can be dismissed
   */
  dismissible?: boolean;

  /**
   * Action button configuration
   */
  action?: {
    label: string;
    onClick: () => void;
  };
}

/**
 * Notification Service Interface
 * Provides methods for showing user notifications
 */
export interface INotificationService {
  /**
   * Show a notification
   */
  notify(message: string, type: NotificationType, options?: NotificationOptions): void;

  /**
   * Show success notification
   */
  success(message: string, options?: NotificationOptions): void;

  /**
   * Show error notification
   */
  error(message: string, options?: NotificationOptions): void;

  /**
   * Show warning notification
   */
  warning(message: string, options?: NotificationOptions): void;

  /**
   * Show info notification
   */
  info(message: string, options?: NotificationOptions): void;

  /**
   * Clear all notifications
   */
  clearAll(): void;
}
