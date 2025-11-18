# Accessibility Implementation Guide

This document outlines the accessibility features implemented in the application and how to test them.

## WCAG 2.1 Level AA Compliance

This application follows WCAG 2.1 Level AA guidelines to ensure accessibility for all users.

## Implemented Features

### 1. ARIA Labels and Roles

All interactive elements have appropriate ARIA labels:

- **Buttons**: All buttons have descriptive `aria-label` attributes
- **Forms**: Form inputs have associated labels and ARIA descriptions
- **Navigation**: Navigation elements use `role="navigation"` and `aria-label`
- **Regions**: Page sections use semantic HTML and ARIA landmarks
- **Live Regions**: Dynamic content updates use `aria-live` for screen reader announcements

### 2. Keyboard Navigation

Full keyboard support is implemented:

- **Tab Navigation**: All interactive elements are keyboard accessible
- **Enter/Space**: Buttons and links respond to Enter and Space keys
- **Escape**: Modals and dialogs close with Escape key
- **Arrow Keys**: List navigation where appropriate
- **Focus Management**: Focus is properly managed in modals and dynamic content
- **Skip Links**: Skip to main content link for keyboard users

### 3. Focus Management

- **Focus Trap**: Modals trap focus within the dialog
- **Focus Restoration**: Focus returns to trigger element when modals close
- **Visible Focus**: Clear focus indicators on all interactive elements
- **Focus Order**: Logical tab order throughout the application

### 4. Screen Reader Support

- **Announcements**: Dynamic content changes are announced to screen readers
- **Progress Updates**: Upload progress is announced at 25%, 50%, 75%, and 100%
- **Error Messages**: Errors are announced with `aria-live="assertive"`
- **Success Messages**: Success notifications use `aria-live="polite"`
- **Loading States**: Loading indicators have appropriate ARIA labels

### 5. Semantic HTML

- **Headings**: Proper heading hierarchy (h1, h2, h3)
- **Landmarks**: Main, navigation, and section elements
- **Lists**: Proper use of ul/ol and li elements
- **Buttons vs Links**: Correct semantic elements for actions vs navigation

## Testing Accessibility

### Automated Testing Tools

#### 1. axe DevTools (Browser Extension)

Install the axe DevTools browser extension:

- [Chrome Extension](https://chrome.google.com/webstore/detail/axe-devtools-web-accessib/lhdoppojpmngadmnindnejefpokejbdd)
- [Firefox Extension](https://addons.mozilla.org/en-US/firefox/addon/axe-devtools/)

**How to use:**

1. Open the application in your browser
2. Open Developer Tools (F12)
3. Navigate to the "axe DevTools" tab
4. Click "Scan ALL of my page"
5. Review any issues found

#### 2. Lighthouse (Built into Chrome)

**How to use:**

1. Open Chrome DevTools (F12)
2. Navigate to the "Lighthouse" tab
3. Select "Accessibility" category
4. Click "Generate report"
5. Review the accessibility score and recommendations

#### 3. WAVE (Web Accessibility Evaluation Tool)

Install the WAVE browser extension:

- [Chrome Extension](https://chrome.google.com/webstore/detail/wave-evaluation-tool/jbbplnpkjmmeebjpijfedlgcdilocofh)
- [Firefox Extension](https://addons.mozilla.org/en-US/firefox/addon/wave-accessibility-tool/)

**How to use:**

1. Navigate to any page in the application
2. Click the WAVE extension icon
3. Review the visual indicators and summary

### Manual Testing

#### Keyboard Navigation Testing

1. **Tab Through the Page**
   - Press Tab to move forward through interactive elements
   - Press Shift+Tab to move backward
   - Verify all interactive elements are reachable
   - Verify focus indicators are visible

2. **Test Interactive Elements**
   - Press Enter on buttons and links
   - Press Space on buttons
   - Press Escape to close modals
   - Verify all actions work without a mouse

3. **Test Skip Link**
   - Press Tab on page load
   - Verify "Skip to main content" link appears
   - Press Enter to skip to main content

#### Screen Reader Testing

##### NVDA (Windows - Free)

1. Download NVDA from [nvaccess.org](https://www.nvaccess.org/)
2. Start NVDA (Ctrl+Alt+N)
3. Navigate the application using:
   - Arrow keys to read content
   - Tab to move between interactive elements
   - H to jump between headings
   - D to jump between landmarks

##### JAWS (Windows - Commercial)

1. Start JAWS
2. Navigate using similar commands to NVDA
3. Test all interactive features

##### VoiceOver (macOS - Built-in)

1. Enable VoiceOver (Cmd+F5)
2. Navigate using:
   - VO+Arrow keys to read content
   - Tab to move between interactive elements
   - VO+H to jump between headings
   - VO+U to open rotor for navigation

##### TalkBack (Android - Built-in)

1. Enable TalkBack in Settings > Accessibility
2. Swipe right/left to navigate
3. Double-tap to activate elements

#### Color Contrast Testing

1. Use browser DevTools to check contrast ratios
2. Verify text meets WCAG AA standards:
   - Normal text: 4.5:1 minimum
   - Large text: 3:1 minimum
3. Test with color blindness simulators

#### Zoom and Magnification Testing

1. Test at 200% zoom (Ctrl/Cmd + +)
2. Verify content remains readable and functional
3. Test with browser zoom and OS magnification

## Common Accessibility Patterns

### Button with Icon

```tsx
<Button startIcon={<UploadIcon />} aria-label="Upload file">
  Upload
</Button>
```

### Loading State

```tsx
<Box role="status" aria-live="polite" aria-label="Loading content">
  <CircularProgress aria-label="Loading" />
  <Typography>Loading...</Typography>
</Box>
```

### Form Input

```tsx
<TextField
  label="Email"
  required
  inputProps={{
    'aria-label': 'Email address',
    'aria-required': 'true',
  }}
/>
```

### Modal Dialog

```tsx
<Dialog
  open={open}
  onClose={onClose}
  aria-labelledby="dialog-title"
  aria-describedby="dialog-description"
>
  <DialogTitle id="dialog-title">Title</DialogTitle>
  <DialogContent id="dialog-description">Content</DialogContent>
</Dialog>
```

### Dynamic Content Announcement

```tsx
import { announceToScreenReader } from './utils/accessibility';

// Announce success
announceToScreenReader('File uploaded successfully', 'polite');

// Announce error
announceToScreenReader('Upload failed', 'assertive');
```

## Accessibility Checklist

Use this checklist when adding new features:

- [ ] All images have alt text
- [ ] All buttons have descriptive labels
- [ ] All form inputs have associated labels
- [ ] Color is not the only means of conveying information
- [ ] Text has sufficient contrast (4.5:1 for normal, 3:1 for large)
- [ ] All functionality is keyboard accessible
- [ ] Focus indicators are visible
- [ ] Heading hierarchy is logical (h1 → h2 → h3)
- [ ] ARIA landmarks are used appropriately
- [ ] Dynamic content changes are announced
- [ ] Modals trap focus and restore it on close
- [ ] Error messages are associated with form fields
- [ ] Loading states have appropriate ARIA labels
- [ ] Lists use proper semantic markup
- [ ] Links have descriptive text (not "click here")

## Resources

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/)
- [WebAIM Articles](https://webaim.org/articles/)
- [Material-UI Accessibility Guide](https://mui.com/material-ui/guides/accessibility/)
- [React Accessibility Guide](https://reactjs.org/docs/accessibility.html)

## Reporting Accessibility Issues

If you discover an accessibility issue:

1. Document the issue with screenshots/recordings
2. Note which assistive technology was used
3. Describe the expected vs actual behavior
4. Create an issue in the project repository
5. Tag with "accessibility" label
