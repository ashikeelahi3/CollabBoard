# CollabBoard Bug Tracking & Testing

## Known Issues & Fixes

### ✅ Fixed Issues
1. **Board Access Denied** - Fixed `hasAccess()` method to handle populated fields
2. **Back Button Not Working** - Fixed navigation and header visibility
3. **Column Creation Failed** - Fixed position field validation
4. **Header Showing in Board View** - Removed navbar from board view

### 🔍 Potential Issues to Test

#### Authentication
- [ ] Token expiration handling
- [ ] Logout clears all state
- [ ] Persistent login after refresh
- [ ] Invalid credentials error messages

#### Board Management
- [ ] Create board with empty title
- [ ] Create board with very long title (>100 chars)
- [ ] Delete board confirmation
- [ ] Board member permissions

#### Column Operations
- [ ] Create column with empty title
- [ ] Create column with very long title (>50 chars)
- [ ] Delete column with cards
- [ ] Reorder columns

#### Card Operations
- [ ] Create card with empty title
- [ ] Create card with very long title (>200 chars)
- [ ] Card description truncation
- [ ] Card without description
- [ ] Card click opens details (currently just console.log)

#### UI/UX Issues
- [ ] Modal close on outside click
- [ ] Modal close on ESC key
- [ ] Form validation messages
- [ ] Loading states during API calls
- [ ] Error notification auto-dismiss
- [ ] Responsive design on mobile

#### State Management
- [ ] State updates trigger re-renders
- [ ] Multiple subscriptions cleanup
- [ ] Memory leaks from event listeners

## Testing Checklist

### Manual Testing Steps

#### 1. Authentication Flow
```
1. Register new user
2. Logout
3. Login with same credentials
4. Refresh page (should stay logged in)
5. Logout again
```

#### 2. Board Operations
```
1. Create new board
2. View board details
3. Go back to dashboard
4. Click board again
5. Create multiple columns
6. Create cards in different columns
```

#### 3. Permission Testing
```
1. Create board as admin
2. Add member with viewer role
3. Login as viewer
4. Try to create column (should fail)
5. Try to create card (should fail)
```

#### 4. Edge Cases
```
1. Create board with 100 character title
2. Create column with 50 character title
3. Create card with 200 character title
4. Create card with 2000 character description
5. Test with no internet connection
```

## Quick Fixes Needed

### High Priority
1. **Modal Close Enhancement** - Add ESC key and outside click
2. **Card Details Modal** - Implement full card view
3. **Form Validation** - Better error messages
4. **Loading Indicators** - Show during API calls

### Medium Priority
1. **Confirmation Dialogs** - Before delete operations
2. **Empty States** - Better messages for empty boards/columns
3. **Error Recovery** - Retry failed operations
4. **Keyboard Shortcuts** - ESC to close modals

### Low Priority
1. **Animations** - Smooth transitions
2. **Tooltips** - Help text for buttons
3. **Accessibility** - ARIA labels
4. **Dark Mode** - Theme toggle

## Bug Report Template

```
**Bug Title:** 
**Severity:** Critical / High / Medium / Low
**Steps to Reproduce:**
1. 
2. 
3. 

**Expected Behavior:**

**Actual Behavior:**

**Screenshots/Logs:**

**Environment:**
- Browser: 
- OS: 
- User Role: 
```

## Performance Issues to Monitor

1. **Large Boards** - Test with 10+ columns and 100+ cards
2. **Memory Leaks** - Check event listener cleanup
3. **API Response Time** - Monitor slow queries
4. **Bundle Size** - Check JavaScript file sizes
5. **Network Requests** - Minimize unnecessary calls

## Security Concerns

1. **XSS Prevention** - Sanitize user inputs
2. **CSRF Protection** - Add CSRF tokens
3. **Rate Limiting** - Prevent API abuse
4. **SQL Injection** - Mongoose handles this
5. **Sensitive Data** - Don't log passwords/tokens
