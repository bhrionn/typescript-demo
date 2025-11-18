# Manual Testing Checklist

Quick reference for manual end-to-end testing.

## Pre-Testing Setup

- [ ] AWS credentials configured
- [ ] Application deployed to target environment
- [ ] Test user accounts ready (Google, Microsoft)
- [ ] Test files prepared (various types and sizes)
- [ ] Browser developer tools open

## Authentication Testing

### Google Login

- [ ] Navigate to application URL
- [ ] Click "Sign in with Google"
- [ ] Complete Google OAuth
- [ ] Verify redirect to dashboard
- [ ] Check JWT token in browser console
- [ ] Verify user session active

### Microsoft Login

- [ ] Log out from application
- [ ] Click "Sign in with Microsoft"
- [ ] Complete Microsoft OAuth
- [ ] Verify redirect to dashboard
- [ ] Check JWT token in browser console
- [ ] Verify user session active

### Session Management

- [ ] Test session expiration
- [ ] Verify redirect to login
- [ ] Test logout functionality
- [ ] Verify protected routes blocked when logged out

## File Upload Testing

### Valid Uploads

- [ ] Upload small text file (< 1MB)
- [ ] Upload medium image file (5-10MB)
- [ ] Upload large file (40-45MB)
- [ ] Verify progress bar displays
- [ ] Verify success messages
- [ ] Verify files appear in list

### Validation Testing

- [ ] Attempt upload of invalid file type (.exe)
- [ ] Attempt upload of file > 50MB
- [ ] Attempt upload of empty file
- [ ] Verify error messages display

### File Retrieval

- [ ] View list of uploaded files
- [ ] Verify metadata (name, size, date)
- [ ] Download a file
- [ ] Verify downloaded file matches uploaded

## Error Handling

- [ ] Test with network disconnected
- [ ] Test with invalid JWT token
- [ ] Test unauthorized API access
- [ ] Verify user-friendly error messages

## Browser Compatibility

- [ ] Test in Chrome
- [ ] Test in Firefox
- [ ] Test in Safari
- [ ] Test on mobile device

## Notes

Record any issues or observations:
