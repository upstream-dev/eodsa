# Event Type System and Qualification Logic - Complete Technical Documentation

## Overview

The EODSA system uses a sophisticated event type and qualification system to control who can enter different levels of competitions. This document explains how it works in full technical detail, written for both developers and non-developers.

---

## Database Schema

### Events Table Fields

The `events` table contains the following qualification-related fields:

| Field Name | Database Column | Type | Description |
|------------|----------------|------|-------------|
| `eventType` | `event_type` | TEXT | One of: `REGIONAL_EVENT`, `NATIONAL_EVENT`, `QUALIFIER_EVENT`, `INTERNATIONAL_VIRTUAL_EVENT` |
| `eventMode` | `event_mode` | TEXT | One of: `LIVE`, `VIRTUAL`, `HYBRID` |
| `qualificationRequired` | `qualification_required` | BOOLEAN | Whether qualification is required to enter this event |
| `qualificationSource` | `qualification_source` | TEXT | Source of qualification: `NONE`, `REGIONAL`, `ANY_NATIONAL_LEVEL`, `MANUAL`, `CUSTOM` |
| `minimumQualificationScore` | `minimum_qualification_score` | INTEGER | Minimum score percentage required (e.g., 75) |

### Event Entries Table Fields

| Field Name | Database Column | Type | Description |
|------------|----------------|------|-------------|
| `qualifiedForNationals` | `qualified_for_nationals` | BOOLEAN | Manual flag set by admin (legacy field, not used for validation) |

### Supporting Tables

**`event_manual_qualifications`** - Stores manually qualified dancers for specific events
- `id` - Unique identifier
- `event_id` - Event they're qualified for
- `dancer_id` - Dancer who is qualified
- `added_by` - Admin/judge who added the qualification
- `created_at` - When qualification was added

**`qualification_audit_logs`** - Tracks all qualification-related actions
- `id` - Unique identifier
- `event_id` - Event involved
- `dancer_id` - Dancer involved
- `action_type` - Type of action: `ENTRY_ATTEMPT`, `ENTRY_BLOCKED`, `MANUAL_QUALIFICATION_ADDED`, etc.
- `action_details` - JSONB field with detailed information
- `performed_by` - Who performed the action (EODSA ID or 'system')
- `performed_at` - Timestamp

---

## Event Types and Their Behaviors

### 1. REGIONAL_EVENT

**Purpose**: Entry-level competitions open to all dancers.

**Default Configuration**:
- `qualificationRequired`: `false`
- `qualificationSource`: `null`
- `minimumQualificationScore`: `null`

**Behavior**:
- ✅ **No qualification required** - Any dancer can enter
- ✅ **Qualification source** - Dancers can earn qualification here for Nationals
- ✅ **Score threshold** - When scores are published, dancers with scores ≥ minimum threshold (typically 75%) become qualified for Nationals

**Entry Rules**:
- No qualification check is performed
- Entry is allowed immediately if all other validations pass (age, payment, etc.)

**Example Scenario**:
- Dancer enters "Gauteng Regional Championships 2025"
- Performs and receives score of 82%
- When scores are published, dancer automatically qualifies for Nationals (if Nationals requires 75% minimum)

---

### 2. NATIONAL_EVENT

**Purpose**: High-level competition requiring qualification from Regional events.

**Default Configuration** (automatically set when event type is selected):
- `qualificationRequired`: `true` (auto-enforced)
- `qualificationSource`: `REGIONAL` (default)
- `minimumQualificationScore`: `75` (default)

**Behavior**:
- ❌ **Qualification required** - Entry is blocked if dancer doesn't meet requirements
- ✅ **Checks Regional qualification** - Looks for published scores from REGIONAL_EVENT events
- ✅ **Score threshold** - Only scores ≥ minimumQualificationScore count as qualification
- ✅ **Auto-enforcement** - Even if `qualificationRequired` is set to `false`, the system automatically enforces it for NATIONAL_EVENT

**Entry Rules**:
1. System checks if `qualificationRequired` is `true`
2. If event name contains "national" but `event_type` is not set, system treats it as NATIONAL_EVENT
3. For each entry attempt:
   - Gets the primary dancer (first participant in `participantIds`)
   - Calls `checkRegionalQualification(dancerId, minimumScore)`
   - This function:
     - Finds the dancer's EODSA ID
     - Searches for performances in REGIONAL_EVENT events
     - Checks if any performance has:
       - `scores_published = true` (scores must be published)
       - Average score (across all judges) ≥ minimumQualificationScore
     - Returns `true` if at least one qualifying performance exists
4. If qualification check fails:
   - Entry is **blocked** with error message
   - Audit log entry is created with `ENTRY_BLOCKED` action
   - User sees: "You must qualify from a Regional Event with a minimum score of X% to enter this event."

**Example Scenario**:
- Dancer tries to enter "EODSA Nationals 2025"
- System checks: Does this dancer have a published score ≥ 75% from any REGIONAL_EVENT?
- If yes: Entry allowed
- If no: Entry blocked with clear error message

---

### 3. QUALIFIER_EVENT

**Purpose**: Standalone qualifier events that don't require prior qualification.

**Default Configuration**:
- `qualificationRequired`: `false`
- `qualificationSource`: `null`
- `minimumQualificationScore`: `null`

**Behavior**:
- ✅ **No qualification required** - Open to all dancers
- ✅ **Can serve as qualification source** - If configured, can qualify dancers for other events
- ⚠️ **Not automatically checked** - Unlike REGIONAL_EVENT, these don't automatically qualify dancers for Nationals unless specifically configured

**Entry Rules**:
- No qualification check is performed
- Entry is allowed immediately if all other validations pass

**Example Scenario**:
- Dancer enters "Spring Qualifier 2025"
- Performs and receives score
- This score does NOT automatically qualify them for Nationals (unless Nationals is configured to accept QUALIFIER_EVENT as a source)

---

### 4. INTERNATIONAL_VIRTUAL_EVENT

**Purpose**: International virtual competitions with flexible qualification rules.

**Default Configuration**:
- `qualificationRequired`: `false` (but can be enabled)
- `qualificationSource`: `null` (can be set to `REGIONAL`, `ANY_NATIONAL_LEVEL`, `MANUAL`, or `CUSTOM`)
- `minimumQualificationScore`: `null` (can be set)

**Behavior**:
- ⚙️ **Configurable** - Admin can set custom qualification requirements
- ✅ **Flexible source** - Can require qualification from Regional, National, or Manual
- ✅ **Custom rules** - Can implement custom qualification logic (though `CUSTOM` source currently blocks all entries)

**Entry Rules**:
- Depends on configuration
- If `qualificationRequired = true`, checks based on `qualificationSource`:
  - `REGIONAL`: Same as NATIONAL_EVENT
  - `ANY_NATIONAL_LEVEL`: Checks for participation in NATIONAL_EVENT or QUALIFIER_EVENT
  - `MANUAL`: Checks `event_manual_qualifications` table
  - `CUSTOM`: Currently blocks all entries (not implemented)

**Example Scenario**:
- Admin creates "International Virtual Championships 2025"
- Sets `qualificationRequired = true`, `qualificationSource = 'ANY_NATIONAL_LEVEL'`
- Dancer must have participated in at least one National or Qualifier event to enter

---

## Qualification Checking Logic

### How Qualification is Checked

When a dancer attempts to enter an event that requires qualification, the system performs the following steps:

#### Step 1: Event Configuration Check

```typescript
// Location: app/api/event-entries/route.ts:196-223

1. Get eventType from database (defaults to 'REGIONAL_EVENT' if not set)
2. Safety check: If event name contains "national" but event_type is NULL, treat as NATIONAL_EVENT
3. If eventType === 'NATIONAL_EVENT' and qualificationRequired is false:
   - Auto-enforce qualificationRequired = true
   - Set qualificationSource = 'REGIONAL' (if not set)
   - Set minimumQualificationScore = 75 (if not set)
```

#### Step 2: Qualification Source Validation

The system checks qualification based on `qualificationSource`:

**REGIONAL Qualification** (`checkRegionalQualification`):
```sql
-- Location: lib/database.ts:4840-4888

SELECT DISTINCT p.id
FROM performances p
JOIN event_entries ee ON ee.id = p.event_entry_id
JOIN events e ON e.id = ee.event_id
JOIN scores s ON s.performance_id = p.id
WHERE (
  ee.eodsa_id = {dancerEodsaId}
  OR ee.participant_ids::text LIKE '%{dancerId}%'
  OR ee.participant_ids::text LIKE '%{dancerEodsaId}%'
)
AND e.event_type = 'REGIONAL_EVENT'
AND p.scores_published = true
GROUP BY p.id
HAVING AVG(
  s.technical_score + s.musical_score + s.performance_score + 
  s.styling_score + s.overall_impression_score
) >= {minimumScore}
LIMIT 1
```

**Key Points**:
- Only checks REGIONAL_EVENT events
- Only counts published scores (`scores_published = true`)
- Calculates average across all judges
- Must meet or exceed minimum score threshold
- Returns `true` if at least one qualifying performance exists

**ANY_NATIONAL_LEVEL Qualification** (`checkNationalLevelQualification`):
```sql
-- Location: lib/database.ts:4891-4944

SELECT DISTINCT p.id
FROM performances p
JOIN event_entries ee ON ee.id = p.event_entry_id
JOIN events e ON e.id = p.event_id
JOIN scores s ON s.performance_id = p.id
WHERE (
  ee.eodsa_id = {dancerEodsaId}
  OR ee.participant_ids::text LIKE '%{dancerId}%'
  OR ee.participant_ids::text LIKE '%{dancerEodsaId}%'
)
AND e.event_type IN ('NATIONAL_EVENT', 'QUALIFIER_EVENT')
AND p.scores_published = true
GROUP BY p.id
HAVING AVG(...) >= {minimumScore}  -- If minimumScore is set
LIMIT 1
```

**Key Points**:
- Checks both NATIONAL_EVENT and QUALIFIER_EVENT
- Optional minimum score (if not set, any participation counts)
- Only counts published scores

**MANUAL Qualification** (`checkManualQualification`):
```sql
-- Location: lib/database.ts:4829-4837

SELECT id FROM event_manual_qualifications 
WHERE event_id = {eventId} AND dancer_id = {dancerId}
```

**Key Points**:
- Checks `event_manual_qualifications` table
- Event-specific (each event has its own manual qualifications)
- Admin must explicitly add dancers to this table

#### Step 3: Entry Blocking or Allowing

If qualification check fails:
- Entry is **rejected** with HTTP 400 status
- Error message returned to user
- Audit log entry created (`ENTRY_BLOCKED`)
- User cannot proceed with entry

If qualification check passes:
- Entry validation continues (age, payment, etc.)
- Entry is created normally

---

## Entry Creation Rules

### Validation Order

When creating an entry, the system validates in this order:

1. **Required Fields Check**
   - `eventId`, `contestantId`, `eodsaId`, `participantIds` must be present

2. **Event Existence Check**
   - Event must exist in database

3. **Event Date Check**
   - Event must not have already completed
   - Registration deadline must not have passed

4. **Event Mode vs Entry Type Check**
   - If `eventMode = 'LIVE'` and `entryType = 'virtual'` → Blocked
   - If `eventMode = 'VIRTUAL'` and `entryType = 'live'` → Blocked
   - If `eventMode = 'HYBRID'` → Both allowed

5. **Qualification Check** (if `qualificationRequired = true`)
   - Performs qualification validation as described above
   - Blocks entry if qualification fails

6. **Dancer Eligibility Check**
   - Dancer account must not be disabled
   - Dancer age must match event age category

7. **Performance Type Validation**
   - Solo: exactly 1 participant
   - Duet: exactly 2 participants
   - Trio: exactly 3 participants
   - Group: 4-30 participants

8. **Time Limit Validation**
   - Solo: max 2 minutes
   - Duet: max 3 minutes
   - Trio: max 3 minutes
   - Group: max 3.5 minutes

9. **Fee Calculation**
   - Validates and corrects fee based on existing entries
   - Special handling for solo entries (1st, 2nd, 3rd+ pricing)

10. **Age Category Calculation**
    - Calculates average age of all participants
    - Determines age category from average

---

## How Dancers Become Qualified

### Automatic Qualification (Regional Events)

Dancers automatically become qualified when:

1. **They perform in a REGIONAL_EVENT**
   - Entry is created for a Regional event
   - Performance is scored by judges
   - Scores are published (`scores_published = true`)

2. **Their score meets the threshold**
   - Average score across all judges ≥ minimumQualificationScore (typically 75%)
   - Score must be published (not just submitted)

3. **Qualification is checked dynamically**
   - System doesn't store a "qualified" flag
   - Instead, it checks in real-time when entry is attempted
   - Looks for qualifying performances at entry time

**Example Flow**:
```
1. Dancer enters "Gauteng Regional 2025" (REGIONAL_EVENT)
2. Judges score the performance: 80%, 78%, 82%, 75%
3. Average = 78.75%
4. Admin publishes scores → scores_published = true
5. Dancer later tries to enter "EODSA Nationals 2025" (NATIONAL_EVENT)
6. System checks: Does dancer have published score ≥ 75% from REGIONAL_EVENT?
7. ✅ Yes → Entry allowed
```

### Manual Qualification

Admins can manually qualify dancers for specific events:

**Process**:
1. Admin navigates to event management page
2. Finds the dancer
3. Clicks "Qualify for Nationals" or similar button
4. System adds entry to `event_manual_qualifications` table
5. Dancer can now enter that specific event

**API Endpoint**: `PUT /api/admin/entries/[id]/qualify`

**Database Operation**:
```sql
INSERT INTO event_manual_qualifications (id, event_id, dancer_id, added_by, created_at)
VALUES ({id}, {eventId}, {dancerId}, {adminId}, now())
```

**Use Cases**:
- Dancer had technical issues at Regional but is known to be qualified
- Special circumstances (injury, etc.)
- International dancers who don't have Regional qualification
- Administrative override

---

## Manual Overrides

### Admin Qualification Override

**Location**: `app/admin/events/[id]/page.tsx`

Admins can manually qualify or disqualify entries:

1. **Toggle Qualification Button**
   - Button: "Qualify for Nationals" / "Qualified ✓"
   - Updates `qualifiedForNationals` field in `event_entries` table
   - **Note**: This is a legacy field and doesn't affect entry validation

2. **Manual Qualification Entry**
   - Adds dancer to `event_manual_qualifications` table
   - This DOES affect entry validation for events with `qualificationSource = 'MANUAL'`

### Important Distinction

There are TWO different qualification mechanisms:

1. **`qualifiedForNationals` field** (legacy)
   - Stored in `event_entries` table
   - Used for display purposes
   - Does NOT block or allow entries
   - Can be toggled by admin

2. **Qualification validation** (active)
   - Checked at entry creation time
   - Uses `checkRegionalQualification`, `checkNationalLevelQualification`, or `checkManualQualification`
   - DOES block or allow entries
   - Cannot be bypassed by toggling `qualifiedForNationals`

---

## Frontend vs Backend Validation

### Frontend (What Users See)

The frontend provides a **user-friendly experience** but does NOT enforce qualification rules:

**Frontend Behavior**:
- Shows event types and descriptions
- Displays entry forms
- May show warnings or information about qualification requirements
- **Does NOT block entry submission** based on qualification

**Location**: `app/event-dashboard/[region]/competition/page.tsx`

**Example**:
- User sees "EODSA Nationals 2025" in event list
- User fills out entry form
- User clicks "Submit Entry"
- Frontend sends request to backend
- **Backend validates and may reject**

### Backend (What Actually Enforces Rules)

The backend performs **all qualification validation**:

**Backend Behavior**:
- Receives entry submission request
- Checks event configuration
- Performs qualification check
- **Blocks entry if qualification fails**
- Returns error message to frontend
- Frontend displays error to user

**Location**: `app/api/event-entries/route.ts:194-421`

**Error Response Example**:
```json
{
  "error": "You must qualify from a Regional Event with a minimum score of 75% to enter this event.",
  "qualificationBlocked": true,
  "requiredScore": 75,
  "qualificationSource": "REGIONAL"
}
```

### Why This Design?

- **Security**: Frontend validation can be bypassed
- **Consistency**: All validation logic in one place
- **User Experience**: Frontend can show helpful messages, but backend enforces rules

---

## What Happens When Multiple Events Overlap

### Scenario 1: Dancer Enters Multiple Regional Events

**Situation**:
- Dancer enters "Gauteng Regional 2025" and "Western Cape Regional 2025"
- Both are REGIONAL_EVENT types
- Dancer scores 70% in Gauteng, 80% in Western Cape

**Qualification Check for Nationals**:
- System checks: "Does dancer have ANY published score ≥ 75% from ANY REGIONAL_EVENT?"
- ✅ Yes (80% from Western Cape qualifies)
- Entry to Nationals is allowed

**Key Point**: System looks for the BEST qualifying performance, not all of them.

### Scenario 2: Dancer Enters Regional and Qualifier

**Situation**:
- Dancer enters "Gauteng Regional 2025" (REGIONAL_EVENT) - scores 65%
- Dancer enters "Spring Qualifier 2025" (QUALIFIER_EVENT) - scores 85%

**Qualification Check for Nationals** (if Nationals requires REGIONAL qualification):
- System checks REGIONAL_EVENT events only
- ❌ 65% does not meet 75% threshold
- Entry to Nationals is blocked

**Key Point**: QUALIFIER_EVENT scores don't count for REGIONAL qualification requirements.

### Scenario 3: Multiple National Events

**Situation**:
- "EODSA Nationals 2025" requires REGIONAL qualification (75%)
- "International Championships 2025" requires ANY_NATIONAL_LEVEL qualification

**Qualification Check**:
- For Nationals: Checks REGIONAL_EVENT scores
- For International: Checks NATIONAL_EVENT or QUALIFIER_EVENT participation
- These are independent checks

**Key Point**: Each event has its own qualification requirements.

### Scenario 4: Event Type Changes After Entries Exist

**Situation**:
- Event created as REGIONAL_EVENT
- Dancers enter and perform
- Admin changes event type to NATIONAL_EVENT

**What Happens**:
- Existing entries remain valid
- New entries require qualification
- Old entries don't automatically qualify dancers (they were in a REGIONAL_EVENT, so they count)

**Recommendation**: Don't change event types after entries exist. Create new events instead.

---

## Edge Cases and Special Scenarios

### Edge Case 1: Event Name Contains "National" But Type Not Set

**Situation**:
- Event name: "EODSA National Championships 2025"
- `event_type` field is NULL or not set

**System Behavior**:
```typescript
// Location: app/api/event-entries/route.ts:205-208

if (!(event as any).eventType && event.name && event.name.toLowerCase().includes('national')) {
  console.warn('Event has "national" in name but event_type not set. Treating as NATIONAL_EVENT.');
  eventType = 'NATIONAL_EVENT';
}
```

**Result**: System automatically treats it as NATIONAL_EVENT and enforces qualification.

**Recommendation**: Always set `event_type` explicitly when creating events.

---

### Edge Case 2: Scores Not Published Yet

**Situation**:
- Dancer performs in Regional event
- Judges submit scores
- Scores are NOT published yet (`scores_published = false`)
- Dancer tries to enter Nationals

**System Behavior**:
- Qualification check looks for `scores_published = true`
- Unpublished scores don't count
- Entry is blocked

**Solution**: Admin must publish scores before dancers can use them for qualification.

---

### Edge Case 3: Minimum Score Not Set

**Situation**:
- Event has `qualificationRequired = true`
- `qualificationSource = 'REGIONAL'`
- `minimumQualificationScore = NULL`

**System Behavior**:
```typescript
// Location: app/api/event-entries/route.ts:267-273

if (minimumQualificationScore === null || minimumQualificationScore === undefined) {
  return NextResponse.json(
    { error: 'This event requires qualification from a Regional Event, but no minimum score is set. Please contact support.' },
    { status: 400 }
  );
}
```

**Result**: Entry is blocked with error message asking admin to set minimum score.

---

### Edge Case 4: Group Entry Qualification Check

**Situation**:
- Group entry with 5 dancers
- Only the primary dancer (first in `participantIds`) is checked for qualification

**System Behavior**:
```typescript
// Location: app/api/event-entries/route.ts:236

const primaryDancerId = body.participantIds[0];
const hasQualification = await db.checkRegionalQualification(primaryDancerId, minimumQualificationScore);
```

**Result**: Only the first dancer's qualification is checked. Other dancers' qualifications are not verified.

**Implication**: If a group has dancers with different qualification statuses, the group can enter if the primary dancer is qualified.

---

### Edge Case 5: Dancer ID vs EODSA ID Matching

**Situation**:
- `participantIds` array may contain either dancer IDs or EODSA IDs
- Qualification check needs to match both

**System Behavior**:
```sql
WHERE (
  ee.eodsa_id = {dancerEodsaId}
  OR ee.participant_ids::text LIKE '%{dancerId}%'
  OR ee.participant_ids::text LIKE '%{dancerEodsaId}%'
)
```

**Result**: System checks all three possible matching methods to find the dancer's performances.

---

### Edge Case 6: Multiple Scores for Same Performance

**Situation**:
- Performance has scores from 4 judges
- System calculates average

**System Behavior**:
```sql
HAVING AVG(
  s.technical_score + s.musical_score + s.performance_score + 
  s.styling_score + s.overall_impression_score
) >= {minimumScore}
```

**Result**: Average is calculated across all judges' scores. All judges must have scored for the average to be meaningful.

---

### Edge Case 7: CUSTOM Qualification Source

**Situation**:
- Event has `qualificationSource = 'CUSTOM'`

**System Behavior**:
```typescript
// Location: app/api/event-entries/route.ts:390-420

else if (qualificationSource === 'CUSTOM') {
  return NextResponse.json(
    { 
      error: 'This event has custom qualification requirements. Please contact the administrator for more information.',
      qualificationBlocked: true,
      qualificationSource: 'CUSTOM'
    },
    { status: 400 }
  );
}
```

**Result**: All entries are blocked. Custom qualification logic is not implemented yet.

---

### Edge Case 8: Event Mode vs Participation Mode

**Situation**:
- `eventMode` (LIVE/VIRTUAL/HYBRID) vs `participationMode` (live/virtual/hybrid)

**System Behavior**:
- `eventMode` is checked for qualification/entry validation
- `participationMode` is checked for entry type validation
- These are separate but related fields

**Recommendation**: Keep them in sync. When `eventMode = 'LIVE'`, set `participationMode = 'live'`.

---

## Audit Logging

All qualification-related actions are logged in `qualification_audit_logs`:

**Action Types**:
- `ENTRY_ATTEMPT` - Dancer tried to enter an event requiring qualification
- `ENTRY_BLOCKED` - Entry was blocked due to failed qualification check
- `MANUAL_QUALIFICATION_ADDED` - Admin manually qualified a dancer
- `MANUAL_QUALIFICATION_REMOVED` - Admin removed manual qualification

**Query Example**:
```sql
SELECT * FROM qualification_audit_logs
WHERE event_id = 'event-123'
ORDER BY performed_at DESC;
```

**Use Cases**:
- Debugging qualification issues
- Tracking who qualified manually
- Understanding entry patterns
- Compliance and auditing

---

## Common Scenarios

### Scenario 1: New Dancer Enters Regional

1. Dancer creates account
2. Dancer enters "Gauteng Regional 2025" (REGIONAL_EVENT)
3. No qualification check (Regional doesn't require it)
4. Entry created successfully
5. Dancer performs
6. Judges score: 78%, 80%, 75%, 82%
7. Average: 78.75%
8. Admin publishes scores
9. Dancer is now qualified for Nationals (if Nationals requires 75%)

---

### Scenario 2: Qualified Dancer Enters Nationals

1. Dancer has published score of 80% from Regional event
2. Dancer tries to enter "EODSA Nationals 2025" (NATIONAL_EVENT)
3. System checks: Does dancer have score ≥ 75% from REGIONAL_EVENT?
4. ✅ Yes (80% qualifies)
5. Entry created successfully

---

### Scenario 3: Unqualified Dancer Tries Nationals

1. Dancer has published score of 65% from Regional event
2. Dancer tries to enter "EODSA Nationals 2025" (NATIONAL_EVENT)
3. System checks: Does dancer have score ≥ 75% from REGIONAL_EVENT?
4. ❌ No (65% < 75%)
5. Entry blocked with error: "You must qualify from a Regional Event with a minimum score of 75% to enter this event."
6. Dancer cannot proceed

---

### Scenario 4: Admin Manually Qualifies Dancer

1. Dancer has score of 70% (below threshold)
2. Admin navigates to event management
3. Admin finds dancer's entry
4. Admin clicks "Qualify for Nationals"
5. System adds entry to `event_manual_qualifications` table
6. Dancer can now enter Nationals (if Nationals uses MANUAL qualification source)

**Note**: If Nationals uses REGIONAL qualification source, manual qualification in `event_manual_qualifications` won't help. Admin would need to change the event's `qualificationSource` to `MANUAL`.

---

### Scenario 5: International Virtual Event with Custom Rules

1. Admin creates "International Virtual Championships 2025"
2. Sets `eventType = 'INTERNATIONAL_VIRTUAL_EVENT'`
3. Sets `qualificationRequired = true`
4. Sets `qualificationSource = 'ANY_NATIONAL_LEVEL'`
5. Sets `minimumQualificationScore = 80`
6. Dancer tries to enter
7. System checks: Does dancer have participation in NATIONAL_EVENT or QUALIFIER_EVENT with score ≥ 80%?
8. If yes: Entry allowed
9. If no: Entry blocked

---

## Best Practices

### For Admins

1. **Always set event_type explicitly** when creating events
2. **Set minimumQualificationScore** when qualification is required
3. **Publish scores promptly** so dancers can use them for qualification
4. **Use manual qualification sparingly** - prefer automatic qualification
5. **Keep eventMode and participationMode in sync**

### For Developers

1. **Always validate on backend** - never trust frontend
2. **Log all qualification checks** for debugging
3. **Use the qualification check functions** - don't duplicate logic
4. **Handle edge cases** - NULL values, missing data, etc.
5. **Test with different event type combinations**

### For Dancers

1. **Enter Regional events first** to qualify for Nationals
2. **Check your scores** after they're published
3. **Contact admin** if you believe you're qualified but entry is blocked
4. **Understand qualification requirements** before entering events

---

## Troubleshooting

### Issue: Dancer Should Be Qualified But Entry Is Blocked

**Check**:
1. Is the score published? (`scores_published = true`)
2. Does the score meet the minimum threshold?
3. Was the performance in a REGIONAL_EVENT (if Nationals requires REGIONAL)?
4. Is the event type set correctly?

**SQL Query**:
```sql
SELECT 
  p.id,
  e.name as event_name,
  e.event_type,
  p.scores_published,
  AVG(s.technical_score + s.musical_score + s.performance_score + 
      s.styling_score + s.overall_impression_score) as avg_score
FROM performances p
JOIN event_entries ee ON ee.id = p.event_entry_id
JOIN events e ON e.id = ee.event_id
JOIN scores s ON s.performance_id = p.id
WHERE ee.eodsa_id = 'E123456'  -- Replace with dancer's EODSA ID
  AND e.event_type = 'REGIONAL_EVENT'
  AND p.scores_published = true
GROUP BY p.id, e.name, e.event_type, p.scores_published;
```

---

### Issue: Event Type Not Being Recognized

**Check**:
1. Is `event_type` set in database?
2. Does event name contain "national" (triggers auto-detection)?
3. Check `qualification_required` field

**SQL Query**:
```sql
SELECT 
  id,
  name,
  event_type,
  qualification_required,
  qualification_source,
  minimum_qualification_score
FROM events
WHERE id = 'event-123';
```

---

### Issue: Manual Qualification Not Working

**Check**:
1. Is `qualificationSource = 'MANUAL'` for the event?
2. Is dancer in `event_manual_qualifications` table?
3. Is the correct `event_id` used?

**SQL Query**:
```sql
SELECT * FROM event_manual_qualifications
WHERE event_id = 'event-123'
  AND dancer_id = 'dancer-456';
```

---

## Summary

The Event Type and Qualification system provides:

1. **Four event types** with different qualification rules
2. **Automatic qualification** from Regional events based on scores
3. **Manual qualification** override for special cases
4. **Real-time validation** at entry creation time
5. **Comprehensive audit logging** for tracking
6. **Flexible configuration** for different competition structures

The system is designed to be:
- **Secure**: Backend validation cannot be bypassed
- **Flexible**: Supports various qualification scenarios
- **Auditable**: All actions are logged
- **User-friendly**: Clear error messages guide users

For questions or issues, check the audit logs and use the SQL queries provided in the Troubleshooting section.

