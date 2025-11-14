/**
 * Base component interface following SOLID principles
 * Open-Closed Principle: Components can be extended without modification
 */

export interface IBaseComponent {
  /**
   * Optional CSS class name for styling
   */
  className?: string;

  /**
   * Optional test ID for testing
   */
  testId?: string;

  /**
   * Optional disabled state
   */
  disabled?: boolean;
}

/**
 * Interface for components that can be validated
 */
export interface IValidatable {
  /**
   * Validates the component's current state
   * @returns true if valid, false otherwise
   */
  validate(): boolean;

  /**
   * Error message to display when validation fails
   */
  error?: string;
}

/**
 * Interface for components with loading states
 */
export interface ILoadable {
  /**
   * Whether the component is in a loading state
   */
  loading?: boolean;
}

/**
 * Interface for components that can be submitted
 */
export interface ISubmittable {
  /**
   * Callback when the component is submitted
   */
  onSubmit?: () => void | Promise<void>;
}
