import React from 'react';
import {
  Button as MuiButton,
  ButtonProps as MuiButtonProps,
  CircularProgress,
} from '@mui/material';
import { IBaseComponent, ILoadable } from './IComponent';

/**
 * Button variant types
 */
export type ButtonVariant = 'primary' | 'secondary' | 'outlined' | 'text' | 'danger';

/**
 * Button size types
 */
export type ButtonSize = 'small' | 'medium' | 'large';

/**
 * Button component props following Interface Segregation Principle
 */
export interface IButtonProps extends IBaseComponent, ILoadable {
  /**
   * Button variant style
   */
  variant?: ButtonVariant;

  /**
   * Button size
   */
  size?: ButtonSize;

  /**
   * Button content
   */
  children: React.ReactNode;

  /**
   * Click handler
   */
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;

  /**
   * Button type
   */
  type?: 'button' | 'submit' | 'reset';

  /**
   * Full width button
   */
  fullWidth?: boolean;

  /**
   * Start icon
   */
  startIcon?: React.ReactNode;

  /**
   * End icon
   */
  endIcon?: React.ReactNode;

  /**
   * ARIA label for accessibility
   */
  ariaLabel?: string;
}

/**
 * Button component with variants following Open-Closed Principle
 * Can be extended with new variants without modifying existing code
 */
export const Button: React.FC<IButtonProps> = ({
  variant = 'primary',
  size = 'medium',
  children,
  onClick,
  type = 'button',
  fullWidth = false,
  disabled = false,
  loading = false,
  className,
  testId,
  startIcon,
  endIcon,
  ariaLabel,
}) => {
  // Map custom variants to Material-UI variants
  const getMuiVariant = (): MuiButtonProps['variant'] => {
    switch (variant) {
      case 'primary':
      case 'danger':
        return 'contained';
      case 'secondary':
        return 'contained';
      case 'outlined':
        return 'outlined';
      case 'text':
        return 'text';
      default:
        return 'contained';
    }
  };

  // Map custom variants to Material-UI colors
  const getMuiColor = (): MuiButtonProps['color'] => {
    switch (variant) {
      case 'primary':
        return 'primary';
      case 'secondary':
        return 'secondary';
      case 'danger':
        return 'error';
      default:
        return 'primary';
    }
  };

  return (
    <MuiButton
      variant={getMuiVariant()}
      color={getMuiColor()}
      size={size}
      onClick={onClick}
      type={type}
      fullWidth={fullWidth}
      disabled={disabled || loading}
      className={className}
      data-testid={testId}
      startIcon={loading ? <CircularProgress size={16} /> : startIcon}
      endIcon={endIcon}
      aria-label={ariaLabel}
    >
      {children}
    </MuiButton>
  );
};
