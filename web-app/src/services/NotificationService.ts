/**
 * Notification Service Implementation
 * Following SOLID principles:
 * - Single Responsibility: Manages user notifications
 * - Dependency Inversion: Implements INotificationService interface
 */

import type {
  INotificationService,
  NotificationType,
  NotificationOptions,
} from './INotificationService';
import type { IToastContext } from '../components/common/Toast';

/**
 * Notification Service using Toast system
 */
export class NotificationService implements INotificationService {
  private toastContext: IToastContext;

  constructor(toastContext: IToastContext) {
    this.toastContext = toastContext;
  }

  /**
   * Show a notification
   */
  notify(message: string, type: NotificationType, options?: NotificationOptions): void {
    const duration = options?.duration;
    this.toastContext.showToast(message, type, duration);
  }

  /**
   * Show success notification
   */
  success(message: string, options?: NotificationOptions): void {
    this.notify(message, 'success', options);
  }

  /**
   * Show error notification
   */
  error(message: string, options?: NotificationOptions): void {
    // Error notifications should stay longer by default
    const duration = options?.duration ?? 8000;
    this.notify(message, 'error', { ...options, duration });
  }

  /**
   * Show warning notification
   */
  warning(message: string, options?: NotificationOptions): void {
    this.notify(message, 'warning', options);
  }

  /**
   * Show info notification
   */
  info(message: string, options?: NotificationOptions): void {
    this.notify(message, 'info', options);
  }

  /**
   * Clear all notifications
   */
  clearAll(): void {
    this.toastContext.hideAllToasts();
  }
}
