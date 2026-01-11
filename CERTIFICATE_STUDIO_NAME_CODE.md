# Certificate Studio Name Fetching Code

## Current Implementation

The studio name fetching logic is in `app/api/certificates/regenerate/route.ts` (lines 26-203).

### Step 1: Initial Query (lines 28-49)
```typescript
const perfResult = await sqlClient`
  SELECT 
    p.*,
    e.event_date,
    e.name as event_name,
    e.certificate_template_url,
    ee.performance_type,
    ee.contestant_id,
    ee.id as event_entry_id,
    ee.participant_ids,
    c.studio_name,                    -- From contestants table
    c.name as contestant_name,
    c.type as contestant_type,
    s.name as studio_name_from_studios  -- From studios table (joined via email/name match)
  FROM performances p
  JOIN events e ON e.id = p.event_id
  LEFT JOIN event_entries ee ON ee.id = p.event_entry_id
  LEFT JOIN contestants c ON c.id = ee.contestant_id
  LEFT JOIN studios s ON (s.email = c.email OR s.name = c.studio_name)
  WHERE p.id = ${performanceId}
` as any[];
```

### Step 2: Get Studio Name (line 161)
```typescript
let studioName = perf.studio_name_from_studios || perf.studio_name;
```

### Step 3: Fallback - Get from Participants (lines 164-190)
If studio name is still not found and it's a group/duet/trio, try to get it from participants' studio associations:

```typescript
if (isGroupPerformance && (!studioName || studioName.trim() === '') && perf.participant_ids) {
  try {
    const participantIds = Array.isArray(perf.participant_ids) 
      ? perf.participant_ids 
      : (typeof perf.participant_ids === 'string' ? JSON.parse(perf.participant_ids) : []);
    
    if (participantIds.length > 0) {
      // Try to get studio name from first participant's studio association
      const studioResult = await sqlClient`
        SELECT DISTINCT s.name as studio_name
        FROM dancers d
        LEFT JOIN studio_applications sa ON d.id = sa.dancer_id AND sa.status = 'accepted'
        LEFT JOIN studios s ON sa.studio_id = s.id
        WHERE (d.id = ANY(${participantIds}) OR d.eodsa_id = ANY(${participantIds}))
          AND s.name IS NOT NULL
        LIMIT 1
      ` as any[];
      
      if (studioResult.length > 0 && studioResult[0].studio_name) {
        studioName = studioResult[0].studio_name;
        console.log(`📝 Found studio name from participants: ${studioName}`);
      }
    }
  } catch (error) {
    console.warn('⚠️ Could not fetch studio name from participants:', error);
  }
}
```

### Step 4: Display Name Logic (lines 192-211)
```typescript
let displayName: string;
if (isGroupPerformance) {
  // For groups/duos/trios, ALWAYS use studio name, never participant names
  if (studioName && studioName.trim() !== '') {
    displayName = studioName;
    console.log(`📝 Group performance - Using studio name: ${displayName}`);
  } else {
    // If studio name not found, use contestant name as fallback (but NOT participant names)
    displayName = perf.contestant_name || 'Studio Name';
    console.warn(`⚠️ Group performance - Studio name not found, using fallback: ${displayName}`);
    console.warn(`⚠️ Available data - studioName: ${studioName || 'N/A'}, contestant_name: ${perf.contestant_name || 'N/A'}`);
  }
} else {
  // For solo performances, use participant names
  if (participantNames.length > 0) {
    displayName = participantNames.join(', ');
    console.log(`📝 Solo performance - Using participant names: ${displayName}`);
  } else {
    displayName = perf.contestant_name || studioName || 'Participant';
    console.warn(`⚠️ No participant names found, using fallback: ${displayName}`);
  }
}
```

## Problem

For "Testing Duos" with dancers "Bernardo, Cristiano":
- The studio name "KB Studio" is not being found from:
  1. `contestants.studio_name` (might be NULL)
  2. `studios.name` (join might not match)
  3. Participants' studio associations (query might not work with JSONB participant_ids)

## Solution Needed

We need to improve the query to handle JSONB `participant_ids` correctly and ensure we get the studio name from the participants' studio associations.

