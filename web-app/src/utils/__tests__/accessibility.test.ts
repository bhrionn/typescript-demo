/**
 * Accessibility Utilities Tests
 * Tests for accessibility helper functions
 */

import {
  announceToScreenReader,
  getFocusableElements,
  createFocusManager,
  generateAriaId,
  isVisibleToScreenReader,
  isEnterKey,
  isSpaceKey,
  isEscapeKey,
  isArrowKey,
  AriaLiveRegion,
} from '../accessibility';

describe('Accessibility Utilities', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  describe('announceToScreenReader', () => {
    it('should create and remove announcement element', () => {
      announceToScreenReader('Test message', 'polite');

      const announcements = document.querySelectorAll('[role="status"]');
      expect(announcements.length).toBeGreaterThan(0);

      // Wait for cleanup
      setTimeout(() => {
        const afterCleanup = document.querySelectorAll('[role="status"]');
        expect(afterCleanup.length).toBe(0);
      }, 1100);
    });

    it('should set correct aria-live priority', () => {
      announceToScreenReader('Urgent message', 'assertive');

      const announcement = document.querySelector('[aria-live="assertive"]');
      expect(announcement).toBeTruthy();
      expect(announcement?.textContent).toBe('Urgent message');
    });
  });

  describe('getFocusableElements', () => {
    it('should find all focusable elements', () => {
      const container = document.createElement('div');
      container.innerHTML = `
        <button>Button 1</button>
        <a href="#">Link</a>
        <input type="text" />
        <button disabled>Disabled</button>
        <div tabindex="0">Focusable div</div>
      `;
      document.body.appendChild(container);

      const focusable = getFocusableElements(container);
      expect(focusable.length).toBe(4); // Excludes disabled button
    });

    it('should return empty array for container with no focusable elements', () => {
      const container = document.createElement('div');
      container.innerHTML = '<div>No focusable elements</div>';
      document.body.appendChild(container);

      const focusable = getFocusableElements(container);
      expect(focusable.length).toBe(0);
    });
  });

  describe('createFocusManager', () => {
    it('should save and restore focus', () => {
      const button = document.createElement('button');
      button.textContent = 'Test Button';
      document.body.appendChild(button);
      button.focus();

      const focusManager = createFocusManager();
      focusManager.saveFocus();

      const input = document.createElement('input');
      document.body.appendChild(input);
      input.focus();

      expect(document.activeElement).toBe(input);

      focusManager.restoreFocus();
      expect(document.activeElement).toBe(button);
    });
  });

  describe('generateAriaId', () => {
    it('should generate unique IDs', () => {
      const id1 = generateAriaId('test');
      const id2 = generateAriaId('test');

      expect(id1).not.toBe(id2);
      expect(id1).toContain('test');
      expect(id2).toContain('test');
    });

    it('should use default prefix when not provided', () => {
      const id = generateAriaId();
      expect(id).toContain('aria');
    });
  });

  describe('isVisibleToScreenReader', () => {
    it('should return false for aria-hidden elements', () => {
      const element = document.createElement('div');
      element.setAttribute('aria-hidden', 'true');
      document.body.appendChild(element);

      expect(isVisibleToScreenReader(element)).toBe(false);
    });

    it('should return false for display:none elements', () => {
      const element = document.createElement('div');
      element.style.display = 'none';
      document.body.appendChild(element);

      expect(isVisibleToScreenReader(element)).toBe(false);
    });

    it('should return true for visible elements', () => {
      const element = document.createElement('div');
      document.body.appendChild(element);

      expect(isVisibleToScreenReader(element)).toBe(true);
    });
  });

  describe('Keyboard event helpers', () => {
    it('should detect Enter key', () => {
      const event = new KeyboardEvent('keydown', { key: 'Enter' });
      expect(isEnterKey(event)).toBe(true);

      const otherEvent = new KeyboardEvent('keydown', { key: 'a' });
      expect(isEnterKey(otherEvent)).toBe(false);
    });

    it('should detect Space key', () => {
      const event1 = new KeyboardEvent('keydown', { key: ' ' });
      expect(isSpaceKey(event1)).toBe(true);

      const event2 = new KeyboardEvent('keydown', { key: 'Space' });
      expect(isSpaceKey(event2)).toBe(true);

      const otherEvent = new KeyboardEvent('keydown', { key: 'a' });
      expect(isSpaceKey(otherEvent)).toBe(false);
    });

    it('should detect Escape key', () => {
      const event1 = new KeyboardEvent('keydown', { key: 'Escape' });
      expect(isEscapeKey(event1)).toBe(true);

      const event2 = new KeyboardEvent('keydown', { key: 'Esc' });
      expect(isEscapeKey(event2)).toBe(true);

      const otherEvent = new KeyboardEvent('keydown', { key: 'a' });
      expect(isEscapeKey(otherEvent)).toBe(false);
    });

    it('should detect Arrow keys', () => {
      const upEvent = new KeyboardEvent('keydown', { key: 'ArrowUp' });
      expect(isArrowKey(upEvent)).toBe(true);

      const downEvent = new KeyboardEvent('keydown', { key: 'ArrowDown' });
      expect(isArrowKey(downEvent)).toBe(true);

      const leftEvent = new KeyboardEvent('keydown', { key: 'ArrowLeft' });
      expect(isArrowKey(leftEvent)).toBe(true);

      const rightEvent = new KeyboardEvent('keydown', { key: 'ArrowRight' });
      expect(isArrowKey(rightEvent)).toBe(true);

      const otherEvent = new KeyboardEvent('keydown', { key: 'a' });
      expect(isArrowKey(otherEvent)).toBe(false);
    });
  });

  describe('AriaLiveRegion', () => {
    it('should create live region on instantiation', () => {
      const region = new AriaLiveRegion('polite');

      const liveRegion = document.querySelector('[aria-live="polite"]');
      expect(liveRegion).toBeTruthy();

      region.destroy();
    });

    it('should announce messages', () => {
      const region = new AriaLiveRegion('assertive');

      region.announce('Test announcement');

      const liveRegion = document.querySelector('[aria-live="assertive"]');
      expect(liveRegion?.textContent).toBe('Test announcement');

      region.destroy();
    });

    it('should clean up on destroy', () => {
      const region = new AriaLiveRegion('polite');
      const liveRegion = document.querySelector('[aria-live="polite"]');
      expect(liveRegion).toBeTruthy();

      region.destroy();

      const afterDestroy = document.querySelector('[aria-live="polite"]');
      expect(afterDestroy).toBeFalsy();
    });
  });
});
