import React, { useEffect, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Divider,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { IBaseComponent } from './IComponent';

/**
 * Modal size types
 */
export type ModalSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'fullscreen';

/**
 * Modal component props following Interface Segregation Principle
 */
export interface IModalProps extends IBaseComponent {
  /**
   * Whether the modal is open
   */
  open: boolean;

  /**
   * Close handler
   */
  onClose: () => void;

  /**
   * Modal title
   */
  title?: string;

  /**
   * Modal content
   */
  children: React.ReactNode;

  /**
   * Modal actions (buttons, etc.)
   */
  actions?: React.ReactNode;

  /**
   * Modal size
   */
  size?: ModalSize;

  /**
   * Whether to show close button
   */
  showCloseButton?: boolean;

  /**
   * Whether to close on backdrop click
   */
  closeOnBackdropClick?: boolean;

  /**
   * Whether to close on escape key
   */
  closeOnEscape?: boolean;

  /**
   * Whether to show dividers
   */
  showDividers?: boolean;

  /**
   * ARIA label for accessibility
   */
  ariaLabel?: string;
}

/**
 * Modal component with accessibility features following SOLID principles
 * Implements focus management and keyboard navigation
 */
export const Modal: React.FC<IModalProps> = ({
  open,
  onClose,
  title,
  children,
  actions,
  size = 'sm',
  showCloseButton = true,
  closeOnBackdropClick = true,
  closeOnEscape = true,
  showDividers = false,
  className,
  testId,
  ariaLabel,
}) => {
  const contentRef = useRef<HTMLDivElement>(null);

  // Focus management for accessibility
  useEffect(() => {
    if (open && contentRef.current) {
      // Focus the first focusable element in the modal
      const focusableElements = contentRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusableElements.length > 0) {
        (focusableElements[0] as HTMLElement).focus();
      }
    }
  }, [open]);

  // Handle escape key
  const handleEscapeKey = (event: React.KeyboardEvent) => {
    if (closeOnEscape && event.key === 'Escape') {
      onClose();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={closeOnBackdropClick ? onClose : undefined}
      maxWidth={size === 'fullscreen' ? false : size}
      fullScreen={size === 'fullscreen'}
      fullWidth
      className={className}
      data-testid={testId}
      aria-labelledby={title ? 'modal-title' : undefined}
      aria-label={ariaLabel || title}
      onKeyDown={handleEscapeKey}
    >
      {title && (
        <>
          <DialogTitle id="modal-title">
            {title}
            {showCloseButton && (
              <IconButton
                aria-label="close"
                onClick={onClose}
                sx={{
                  position: 'absolute',
                  right: 8,
                  top: 8,
                }}
              >
                <CloseIcon />
              </IconButton>
            )}
          </DialogTitle>
          {showDividers && <Divider />}
        </>
      )}

      <DialogContent ref={contentRef}>{children}</DialogContent>

      {actions && (
        <>
          {showDividers && <Divider />}
          <DialogActions>{actions}</DialogActions>
        </>
      )}
    </Dialog>
  );
};
