/**
 * Unit tests for NotificationService
 * Following SOLID principles: Single Responsibility, Dependency Inversion
 */

import { NotificationService } from '../NotificationService';
import type { IToastContext } from '../../components/common/Toast';

describe('NotificationService', () => {
  let mockToastContext: jest.Mocked<IToastContext>;
  let notificationService: NotificationService;

  beforeEach(() => {
    mockToastContext = {
      showToast: jest.fn(),
      hideAllToasts: jest.fn(),
    };

    notificationService = new NotificationService(mockToastContext);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('notify', () => {
    it('should call showToast with correct parameters', () => {
      notificationService.notify('Test message', 'info');

      expect(mockToastContext.showToast).toHaveBeenCalledWith('Test message', 'info', undefined);
    });

    it('should pass duration option to showToast', () => {
      notificationService.notify('Test message', 'success', { duration: 5000 });

      expect(mockToastContext.showToast).toHaveBeenCalledWith('Test message', 'success', 5000);
    });

    it('should handle all notification types', () => {
      const types: Array<'success' | 'error' | 'warning' | 'info'> = [
        'success',
        'error',
        'warning',
        'info',
      ];

      types.forEach((type) => {
        mockToastContext.showToast.mockClear();
        notificationService.notify('Message', type);
        expect(mockToastContext.showToast).toHaveBeenCalledWith('Message', type, undefined);
      });
    });
  });

  describe('success', () => {
    it('should show success notification', () => {
      notificationService.success('Operation successful');

      expect(mockToastContext.showToast).toHaveBeenCalledWith(
        'Operation successful',
        'success',
        undefined
      );
    });

    it('should pass duration option', () => {
      notificationService.success('Success', { duration: 3000 });

      expect(mockToastContext.showToast).toHaveBeenCalledWith('Success', 'success', 3000);
    });
  });

  describe('error', () => {
    it('should show error notification', () => {
      notificationService.error('Operation failed');

      expect(mockToastContext.showToast).toHaveBeenCalledWith('Operation failed', 'error', 8000);
    });

    it('should use default duration of 8000ms for errors', () => {
      notificationService.error('Error message');

      const [, , duration] = mockToastContext.showToast.mock.calls[0];
      expect(duration).toBe(8000);
    });

    it('should allow custom duration', () => {
      notificationService.error('Error message', { duration: 10000 });

      expect(mockToastContext.showToast).toHaveBeenCalledWith('Error message', 'error', 10000);
    });

    it('should preserve other options', () => {
      notificationService.error('Error', { duration: 5000 });

      const [message, type, duration] = mockToastContext.showToast.mock.calls[0];
      expect(message).toBe('Error');
      expect(type).toBe('error');
      expect(duration).toBe(5000);
    });
  });

  describe('warning', () => {
    it('should show warning notification', () => {
      notificationService.warning('Warning message');

      expect(mockToastContext.showToast).toHaveBeenCalledWith(
        'Warning message',
        'warning',
        undefined
      );
    });

    it('should pass duration option', () => {
      notificationService.warning('Warning', { duration: 4000 });

      expect(mockToastContext.showToast).toHaveBeenCalledWith('Warning', 'warning', 4000);
    });
  });

  describe('info', () => {
    it('should show info notification', () => {
      notificationService.info('Information');

      expect(mockToastContext.showToast).toHaveBeenCalledWith('Information', 'info', undefined);
    });

    it('should pass duration option', () => {
      notificationService.info('Info', { duration: 6000 });

      expect(mockToastContext.showToast).toHaveBeenCalledWith('Info', 'info', 6000);
    });
  });

  describe('clearAll', () => {
    it('should call hideAllToasts on toast context', () => {
      notificationService.clearAll();

      expect(mockToastContext.hideAllToasts).toHaveBeenCalledTimes(1);
    });

    it('should clear all toasts even after multiple notifications', () => {
      notificationService.success('Message 1');
      notificationService.error('Message 2');
      notificationService.warning('Message 3');
      notificationService.clearAll();

      expect(mockToastContext.hideAllToasts).toHaveBeenCalledTimes(1);
    });
  });

  describe('integration', () => {
    it('should handle multiple notifications in sequence', () => {
      notificationService.success('First message');
      notificationService.error('Second message');
      notificationService.warning('Third message');

      expect(mockToastContext.showToast).toHaveBeenCalledTimes(3);
      expect(mockToastContext.showToast).toHaveBeenNthCalledWith(
        1,
        'First message',
        'success',
        undefined
      );
      expect(mockToastContext.showToast).toHaveBeenNthCalledWith(
        2,
        'Second message',
        'error',
        8000
      );
      expect(mockToastContext.showToast).toHaveBeenNthCalledWith(
        3,
        'Third message',
        'warning',
        undefined
      );
    });

    it('should handle empty messages', () => {
      notificationService.notify('', 'info');

      expect(mockToastContext.showToast).toHaveBeenCalledWith('', 'info', undefined);
    });

    it('should handle very long messages', () => {
      const longMessage = 'x'.repeat(1000);
      notificationService.info(longMessage);

      expect(mockToastContext.showToast).toHaveBeenCalledWith(longMessage, 'info', undefined);
    });
  });
});
