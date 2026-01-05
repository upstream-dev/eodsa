# Phase 2 Feature Flag Implementation

## Overview

This document describes the implementation of the `PHASE_2_ENABLED` feature flag that temporarily disables Phase 2 functionality in a reversible, low-risk way.

## Configuration

Set the environment variable `PHASE_2_ENABLED` to control Phase 2 features:

- `PHASE_2_ENABLED=false` (default) - Phase 2 features are disabled
- `PHASE_2_ENABLED=true` - Phase 2 features are enabled

Add this to your `.env.local` or environment configuration:

```bash
PHASE_2_ENABLED=false
```

## Disabled Features (when `PHASE_2_ENABLED=false`)

### 1. Rankings
- **UI**: Rankings page shows "Feature Temporarily Unavailable" message
- **API**: `/api/rankings` routes return HTTP 403 with message "This feature is temporarily unavailable."
- **Buttons**: Export CSV buttons are greyed out and disabled

### 2. Backend Tools / Backend Dashboard
The following portals are disabled:
- Backstage Manager (`/portal/backstage`)
- Announcer Portal (`/portal/announcer`)
- Registration Desk (`/portal/registration`)
- Media Portal (`/portal/media`)
- Sound Tech (`/admin/sound-tech`)
- Admin Notifications (`/admin/notifications`)
- Event Type Manager (`/event-type-manager`)

**UI Behavior**: Portal links in the Backend Dashboard are greyed out and show "This feature is temporarily unavailable." on hover.

**Direct Access**: If accessed via URL, these pages show the "Feature Temporarily Unavailable" component.

### 3. Admin Actions
The following admin actions are disabled:
- **Create Event**: Button is greyed out and shows alert when clicked
- **Create User**: Button is greyed out and shows alert when clicked
- **Export buttons** (CSV / Excel / PDF): All export buttons are greyed out and disabled
- **Media Upload Tracking**: Tab is hidden from admin navigation

**API Behavior**: 
- `POST /api/events` returns HTTP 403
- `POST /api/users` returns HTTP 403
- `GET /api/admin/music-tracking` returns HTTP 403
- `POST /api/admin/notifications/send` returns HTTP 403

## Features NOT Affected

The following features remain fully functional regardless of the flag:
- User authentication / login
- Viewing existing events
- Judging & scoring for existing events
- Viewing results
- PayFast payments

## Implementation Details

### Feature Flag Utility
- **Location**: `lib/feature-flags.ts`
- **Function**: `isPhase2Enabled()` - Server-side check
- **Client Hook**: `hooks/usePhase2Feature.ts` - Client-side hook that fetches flag status

### API Route Guards
All Phase 2 API routes check the flag and return HTTP 403 if disabled:
- `app/api/rankings/route.ts`
- `app/api/events/route.ts` (POST only)
- `app/api/users/route.ts` (POST only)
- `app/api/admin/music-tracking/route.ts`
- `app/api/admin/notifications/send/route.ts`

### UI Components
- **Feature Unavailable Component**: `components/FeatureUnavailable.tsx` - Reusable component for showing unavailable message
- **Backend Dashboard**: `app/backend/page.tsx` - Conditionally renders portal links
- **Admin Dashboard**: `app/admin/page.tsx` - Conditionally shows/hides buttons and tabs
- **Portal Pages**: All portal pages check the flag and show unavailable component if disabled

## Reversibility

All changes are fully reversible:
1. Set `PHASE_2_ENABLED=true` in environment variables
2. Restart the application
3. All Phase 2 features will be re-enabled immediately

No data is deleted, no database schema changes are made, and all business logic remains intact.

## Testing

To test the feature flag:

1. **Disable Phase 2**:
   ```bash
   PHASE_2_ENABLED=false
   ```
   - Verify rankings page shows unavailable message
   - Verify backend portal links are greyed out
   - Verify admin actions are disabled
   - Verify API routes return 403

2. **Enable Phase 2**:
   ```bash
   PHASE_2_ENABLED=true
   ```
   - Verify all features work normally
   - Verify no errors in console

## Notes

- The flag defaults to `false` (disabled) if not set
- The flag accepts `'true'`, `'True'`, `'TRUE'`, or `'1'` as enabled values
- All other values are treated as disabled
