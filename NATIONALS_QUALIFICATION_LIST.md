# Nationals qualification – Mastery, entry paths, and flag usage

Report only. No code changes.

---

## 1. All places where mastery (Air/Earth/Fire/Water) is read or ignored in qualification logic

### 1.1 Qualification logic (checks that determine “has this dancer qualified”)

| File | Function | Mastery | Authoritative or ignored |
|------|----------|---------|---------------------------|
| **lib/database.ts** | `checkRegionalQualification` | Not in query; no filter on `ee.mastery` or `p.mastery`. | **Ignored** |
| **lib/database.ts** | `checkNationalLevelQualification` | Not in query; no filter on mastery. | **Ignored** |
| **lib/database.ts** | `checkManualQualification` | N/A (looks up `event_manual_qualifications` only). | N/A |

So in the logic that decides “has this dancer qualified”, mastery is **never** read; it is **ignored** in both regional and national-level qualification checks.

---

### 1.2 Entry validation (mastery used for “allowed to submit / update” an entry)

| File | Function | Mastery | Authoritative or ignored |
|------|----------|---------|---------------------------|
| **app/api/event-entries/route.ts** | POST (create event entry) | Read from `body.mastery`. Regional = all 4 levels allowed; Nationals = Water/Fire only. Invalid mastery returns 400. | **Authoritative** (blocks entry if mastery not in allowed set for event type) |
| **app/api/studios/entries/[id]/route.ts** | PUT (update entry) | Read from `updates.mastery`. Valid set = all 4 levels (MASTERY_LEVELS + REGIONAL_MASTERY_LEVELS). Invalid mastery returns 400. | **Authoritative** (blocks update if mastery not in valid set; does not vary by event type) |

So mastery is **read and authoritative** only for “allowed mastery levels” on create (event-entries) and on update (studios/entries); it is **not** used in the qualification checks themselves.

---

## 2. All places where nationals entry can be created WITHOUT any qualification check

“Nationals entry” here means either: (a) a row in `nationals_event_entries`, or (b) a row in `event_entries` for an event whose `event_type` is `NATIONAL_EVENT` (or treated as national).  
A path “has no qualification check” if it does not call `checkRegionalQualification`, `checkNationalLevelQualification`, or `checkManualQualification` before creating the entry.

| File | Function / path | What is created | Qualification check? |
|------|------------------|-----------------|------------------------|
| **app/api/nationals/entries/route.ts** | POST | `nationals_event_entries` via `unifiedDb.createNationalsEventEntry` | **No** – no qualification check. |
| **app/api/payments/payfast/webhook/route.ts** | POST (webhook handler) | `event_entries` via `db.createEventEntry` (can be for any `eventId`, including NATIONAL_EVENT) | **No** – creates entry directly; does not go through event-entries API. |
| **app/api/payments/process-entries/route.ts** | POST | `event_entries` via `db.createEventEntry` | **No** – creates entry directly; does not go through event-entries API. |
| **app/api/payments/eft/route.ts** | POST | `event_entries` via raw `INSERT INTO event_entries` | **No** – inserts directly; does not go through event-entries API. |
| **scripts/recover-missing-entries.js** | (script) | `event_entries` via `db.createEventEntry` | **No** – creates entry directly; does not go through event-entries API. |

By contrast:

- **app/api/event-entries/route.ts** POST: when the event is NATIONAL_EVENT (or name contains “national”), it sets `qualificationRequired` and runs the qualification check (e.g. `checkRegionalQualification`) before calling `db.createEventEntry`. So that path **does** enforce qualification for nationals; it is the only API path that creates `event_entries` with a qualification check.

---

## 3. Whether the stored `qualified_for_nationals` flag is used for blocking entry

**Answer: No.** The stored `qualified_for_nationals` flag is **not** used anywhere to block entry.

Evidence:

- **Entry blocking** is done only in:
  - **app/api/event-entries/route.ts** POST: uses `checkRegionalQualification`, `checkNationalLevelQualification`, or `checkManualQualification` (and returns 400 if the check fails). It does **not** read `qualified_for_nationals` from the database to decide allow/block.
  - **app/api/events/[id]/check-qualification/route.ts** GET: uses the same three check functions to return `qualified: true/false`. It does **not** read `qualified_for_nationals`.

- **Uses of `qualified_for_nationals` / `qualifiedForNationals` in code:**
  - **Written:** on create/update (event-entries POST, admin qualify PUT, nationals/entries POST, payfast webhook, process-entries, EFT, recover script; and in `lib/database.ts` in `createEventEntry`, `updateEventEntry`, `createNationalsEventEntry`).
  - **Read:** for display only (e.g. admin events page – badge “QUALIFIED FOR NATIONALS”, count of qualified entries, toggle button; admin dancer profile; types/interfaces). None of these reads are used in a condition that blocks or allows entry.

So: the stored flag is **never** used for blocking entry; it is only written and read for display/admin.
