/**
 * Accessibility Utilities
 * Provides helper functions for accessibility features
 * Following WCAG 2.1 Level AA guidelines
 */

/**
 * Announce message to screen readers using ARIA live region
 */
export const announceToScreenReader = (
  message: string,
  priority: 'polite' | 'assertive' = 'polite'
): void => {
  const announcement = document.createElement('div');
  announcement.setAttribute('role', 'status');
  announcement.setAttribute('aria-live', priority);
  announcement.setAttribute('aria-atomic', 'true');
  announcement.className = 'sr-only';
  announcement.textContent = message;

  document.body.appendChild(announcement);

  // Remove after announcement
  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 1000);
};

/**
 * Trap focus within a container (for modals, dialogs)
 */
export const trapFocus = (container: HTMLElement): (() => void) => {
  const focusableElements = container.querySelectorAll<HTMLElement>(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );

  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Tab') return;

    if (e.shiftKey) {
      // Shift + Tab
      if (document.activeElement === firstElement) {
        e.preventDefault();
        lastElement?.focus();
      }
    } else {
      // Tab
      if (document.activeElement === lastElement) {
        e.preventDefault();
        firstElement?.focus();
      }
    }
  };

  container.addEventListener('keydown', handleKeyDown);

  // Focus first element
  firstElement?.focus();

  // Return cleanup function
  return () => {
    container.removeEventListener('keydown', handleKeyDown);
  };
};

/**
 * Get all focusable elements within a container
 */
export const getFocusableElements = (container: HTMLElement): HTMLElement[] => {
  const elements = container.querySelectorAll<HTMLElement>(
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  );
  return Array.from(elements);
};

/**
 * Restore focus to a previously focused element
 */
export const createFocusManager = () => {
  let previouslyFocusedElement: HTMLElement | null = null;

  return {
    saveFocus: () => {
      previouslyFocusedElement = document.activeElement as HTMLElement;
    },
    restoreFocus: () => {
      if (previouslyFocusedElement && previouslyFocusedElement.focus) {
        previouslyFocusedElement.focus();
      }
    },
  };
};

/**
 * Generate unique ID for ARIA relationships
 */
let idCounter = 0;
export const generateAriaId = (prefix: string = 'aria'): string => {
  idCounter += 1;
  return `${prefix}-${idCounter}-${Date.now()}`;
};

/**
 * Check if element is visible to screen readers
 */
export const isVisibleToScreenReader = (element: HTMLElement): boolean => {
  return (
    element.getAttribute('aria-hidden') !== 'true' &&
    element.style.display !== 'none' &&
    element.style.visibility !== 'hidden'
  );
};

/**
 * Create skip link for keyboard navigation
 */
export const createSkipLink = (
  targetId: string,
  label: string = 'Skip to main content'
): HTMLAnchorElement => {
  const skipLink = document.createElement('a');
  skipLink.href = `#${targetId}`;
  skipLink.textContent = label;
  skipLink.className = 'skip-link';
  skipLink.setAttribute('aria-label', label);

  skipLink.addEventListener('click', (e) => {
    e.preventDefault();
    const target = document.getElementById(targetId);
    if (target) {
      target.focus();
      target.scrollIntoView({ behavior: 'smooth' });
    }
  });

  return skipLink;
};

/**
 * Keyboard event helpers
 */
export const isEnterKey = (event: React.KeyboardEvent | KeyboardEvent): boolean => {
  return event.key === 'Enter';
};

export const isSpaceKey = (event: React.KeyboardEvent | KeyboardEvent): boolean => {
  return event.key === ' ' || event.key === 'Space';
};

export const isEscapeKey = (event: React.KeyboardEvent | KeyboardEvent): boolean => {
  return event.key === 'Escape' || event.key === 'Esc';
};

export const isArrowKey = (event: React.KeyboardEvent | KeyboardEvent): boolean => {
  return ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key);
};

/**
 * ARIA live region manager
 */
export class AriaLiveRegion {
  private region: HTMLDivElement;

  constructor(priority: 'polite' | 'assertive' = 'polite') {
    this.region = document.createElement('div');
    this.region.setAttribute('role', 'status');
    this.region.setAttribute('aria-live', priority);
    this.region.setAttribute('aria-atomic', 'true');
    this.region.className = 'sr-only';
    document.body.appendChild(this.region);
  }

  announce(message: string): void {
    this.region.textContent = message;
  }

  destroy(): void {
    if (this.region.parentNode) {
      this.region.parentNode.removeChild(this.region);
    }
  }
}
