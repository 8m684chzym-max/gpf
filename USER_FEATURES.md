# GPF Feature Updates: User Round Rejection & Expandable Leaderboard

## Summary

Two major UI/UX enhancements have been implemented:

1. **User Round Rejection** — Members can now reject their own submitted rounds
2. **Expandable Road Leaderboard** — Click players to see their best 3 qualifying rounds

## Changes Made

### 1. User Round Rejection Feature

#### Files Modified:
- `src/app/api/rounds/[id]/route.js` — Added `userReject` action
- `src/app/(app)/dashboard/page.jsx` — Added reject button to user's rounds

#### Backend Changes:
```javascript
// New API action: userReject
if (action === "userReject") {
  const user = await requireUser();
  // Verify round belongs to user
  if (round.userId !== user.id) return error 403;
  // Mark as REJECTED
  await prisma.round.update({ 
    where: { id }, 
    data: { status: "REJECTED", rejectReason: "User rejected" }
  });
  await logAudit(user.name, "round.userReject", id, null);
}
```

#### Frontend Changes:
- Dashboard "Your recent rounds" section now includes reject button (✕)
- Button only shows for non-rejected rounds
- Clicking reject prompts for confirmation
- After rejection, page reloads to show updated status
- Users can only reject their own rounds (enforced server-side)

### 2. Expandable Road Leaderboard

#### Files Modified:
- `src/app/(app)/road/page.jsx` — Made leaderboard interactive with expandable rows

#### Features:
- **Expandable rows** — Click player name to show/hide their best 3 rounds
- **Round details** — Shows:
  - Course name
  - Date
  - Gross strokes
  - Stableford points earned
- **Animated indicator** — Chevron icon rotates to show expand/collapse state
- **Smart data fetching** — Fetches all approved rounds, sorts by Stableford points, shows top 3
- **Clean UI** — Details nested under each player row with muted styling

#### Implementation Details:
```javascript
// Fetch all rounds data on component mount
Promise.all([
  api("/api/leaderboard"),
  api("/api/config"), 
  api("/api/rounds")  // NEW: Get detailed round data
]).then(([lb, cfg, rnd]) => {
  // Map and sort rounds by userId
  const map = {};
  rnd.rounds
    .filter(r => r.status === "APPROVED")
    .forEach(r => {
      if (!map[r.userId]) map[r.userId] = [];
      map[r.userId].push(r);
    });
  
  // Sort by Stableford points, keep top 3
  Object.keys(map).forEach(uid => {
    map[uid].sort((a, b) => (b.points ?? 0) - (a.points ?? 0));
    map[uid] = map[uid].slice(0, 3);
  });
});
```

## Security Considerations

### User Round Rejection:
- ✅ Users can ONLY reject their own rounds (server-side check)
- ✅ Requires authentication (`requireUser()`)
- ✅ Actions logged to audit trail
- ✅ Round ownership verified before rejection

### Expandable Leaderboard:
- ✅ Only shows approved rounds
- ✅ Client-side state management (expandable/collapsed)
- ✅ No sensitive data exposed
- ✅ Read-only operation (no mutations)

## Testing

### Test User Round Rejection:
```
1. Go to Dashboard
2. Find "Your recent rounds" section
3. Click ✕ reject button on any non-rejected round
4. Confirm in dialog
5. Verify: Round status changes to "rejected" ✅
6. Verify: Reject button disappears for rejected rounds ✅
7. Check: Leaderboard updates automatically ✅
```

### Test Expandable Leaderboard:
```
1. Go to Road to GPF leaderboard
2. Click on any player name
3. Verify: Chevron rotates 90° ✅
4. Verify: Best 3 rounds appear below player ✅
5. Each round shows:
   - Course name ✅
   - Date (YYYY-MM-DD) ✅
   - Gross strokes ✅
   - Stableford points ✅
6. Click again to collapse ✅
7. Multiple players can be expanded simultaneously ✅
```

## User Experience Improvements

### Transparency:
- Users can see exactly how their scores contribute to leaderboard
- Admin actions transparent (all audited)
- Players understand best-3 ranking system

### Control:
- Members have agency over their submissions
- Can reject rounds without admin intervention
- Useful for fixing mistaken submissions

### Clarity:
- Expandable leaderboard shows scoring breakdown
- No hidden calculations
- Complete visibility into qualification progress

## API Endpoints Affected

### New Action:
- `PATCH /api/rounds/[id]` — Added `action: "userReject"` support

### Updated Calls:
- Dashboard fetches: `/api/rounds` (unchanged)
- Road leaderboard now also fetches: `/api/rounds` (for round details)

## Browser Compatibility

- ✅ Modern browsers (Chrome, Safari, Firefox, Edge)
- ✅ Mobile responsive
- ✅ Keyboard accessible (click to expand)
- ✅ Touch-friendly (large click targets)

## Performance Notes

- Road leaderboard now makes 3 API calls (was 2)
  - `/api/leaderboard` — aggregated standings
  - `/api/config` — competition config
  - `/api/rounds` — detailed round data (NEW)
- Sorting and filtering happens client-side
- No database query changes
- Minimal performance impact

## Rollback Instructions

If needed to revert these changes:

```bash
git revert <commit-hash>
# OR
git checkout HEAD -- src/app/api/rounds/[id]/route.js src/app/(app)/dashboard/page.jsx src/app/(app)/road/page.jsx
```

## Future Enhancements

Potential additions:
- Bulk rejection (multiple rounds at once)
- Rejection reason tracking
- Admin approval of rejected rounds
- Round edit UI (instead of rejection)
- Historical rejection log
- Email notifications on rejection

## Deployment

- ✅ No database migrations needed
- ✅ No schema changes
- ✅ Backward compatible
- ✅ Ready for production
- ✅ Can be deployed immediately

## Git Commit

```
feat: Add user round rejection and expandable leaderboard

- Users can now reject their own submitted rounds from dashboard
- Road to GPF leaderboard is now expandable, showing each player's best 3 rounds
- New userReject action in PATCH /api/rounds/[id]
- Enhanced Road page with interactive expandable rows
- Full audit logging for all round rejections
- Improved transparency in leaderboard scoring
```

---

**Status:** ✅ Complete  
**Ready for Deployment:** Yes  
**Database Migrations:** None  
**Breaking Changes:** No  
