import React, { useState, useCallback } from 'react';
import { TextField, InputAdornment, IconButton } from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import { IBaseComponent } from './IComponent';

/**
 * Input type
 */
export type InputType = 'text' | 'email' | 'password' | 'number' | 'tel' | 'url';

/**
 * Validation rule interface
 */
export interface IValidationRule {
  /**
   * Validation function
   */
  validate: (value: string) => boolean;

  /**
   * Error message when validation fails
   */
  message: string;
}

/**
 * Input component props following Interface Segregation Principle
 */
export interface IInputProps extends IBaseComponent {
  /**
   * Input label
   */
  label: string;

  /**
   * Input value
   */
  value: string;

  /**
   * Change handler
   */
  onChange: (value: string) => void;

  /**
   * Input type
   */
  type?: InputType;

  /**
   * Placeholder text
   */
  placeholder?: string;

  /**
   * Whether the input is required
   */
  required?: boolean;

  /**
   * Whether the input is multiline
   */
  multiline?: boolean;

  /**
   * Number of rows for multiline input
   */
  rows?: number;

  /**
   * Validation rules
   */
  validationRules?: IValidationRule[];

  /**
   * Helper text
   */
  helperText?: string;

  /**
   * Start adornment
   */
  startAdornment?: React.ReactNode;

  /**
   * End adornment
   */
  endAdornment?: React.ReactNode;

  /**
   * Auto focus
   */
  autoFocus?: boolean;

  /**
   * ARIA label for accessibility
   */
  ariaLabel?: string;

  /**
   * Full width
   */
  fullWidth?: boolean;

  /**
   * External error message
   */
  error?: string;
}

/**
 * Input component with validation following Single Responsibility Principle
 * Handles input display and validation separately
 */
export const Input: React.FC<IInputProps> = ({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  required = false,
  multiline = false,
  rows = 1,
  validationRules = [],
  helperText,
  error,
  disabled = false,
  className,
  testId,
  startAdornment,
  endAdornment,
  autoFocus = false,
  ariaLabel,
  fullWidth = true,
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState(false);
  const [validationError, setValidationError] = useState<string | undefined>(error);

  // Validate input value
  const validateInput = useCallback(
    (inputValue: string): boolean => {
      if (required && !inputValue.trim()) {
        setValidationError('This field is required');
        return false;
      }

      for (const rule of validationRules) {
        if (!rule.validate(inputValue)) {
          setValidationError(rule.message);
          return false;
        }
      }

      setValidationError(undefined);
      return true;
    },
    [required, validationRules]
  );

  // Handle input change
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = event.target.value;
    onChange(newValue);

    if (touched) {
      validateInput(newValue);
    }
  };

  // Handle blur
  const handleBlur = () => {
    setTouched(true);
    validateInput(value);
  };

  // Toggle password visibility
  const handleTogglePassword = () => {
    setShowPassword((prev) => !prev);
  };

  // Determine input type
  const inputType = type === 'password' && showPassword ? 'text' : type;

  // Password visibility toggle
  const passwordAdornment =
    type === 'password' ? (
      <InputAdornment position="end">
        <IconButton
          aria-label="toggle password visibility"
          onClick={handleTogglePassword}
          edge="end"
          size="small"
        >
          {showPassword ? <VisibilityOff /> : <Visibility />}
        </IconButton>
      </InputAdornment>
    ) : null;

  return (
    <TextField
      label={label}
      value={value}
      onChange={handleChange}
      onBlur={handleBlur}
      type={inputType}
      placeholder={placeholder}
      required={required}
      multiline={multiline}
      rows={multiline ? rows : undefined}
      error={touched && !!validationError}
      helperText={touched && validationError ? validationError : helperText}
      disabled={disabled}
      className={className}
      inputProps={{
        'data-testid': testId,
        'aria-label': ariaLabel || label,
      }}
      InputProps={{
        startAdornment: startAdornment ? (
          <InputAdornment position="start">{startAdornment}</InputAdornment>
        ) : undefined,
        endAdornment: endAdornment || passwordAdornment,
      }}
      autoFocus={autoFocus}
      fullWidth={fullWidth}
      variant="outlined"
    />
  );
};
