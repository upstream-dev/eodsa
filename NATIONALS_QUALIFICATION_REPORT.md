# Nationals Qualification – Current Behaviour (Report Only)

This document describes **exactly** how Nationals qualification works in the codebase today. No changes or fixes are proposed.

---

## 1. Where qualification is determined

### Stored field: `qualified_for_nationals`

**Database:**  
- **Table:** `event_entries`  
- **Column:** `qualified_for_nationals` (BOOLEAN, default FALSE)  
- **Also present on:** `nationals_event_entries` (same column name)

**Where it is set (written):**

| Location | When | How |
|----------|------|-----|
| **lib/database.ts** | On **entry create** | `createEventEntry()` writes `qualifiedForNationals \|\| false` from the passed-in object (line ~819). |
| **lib/database.ts** | On **entry update** | `updateEventEntry(id, { qualifiedForNationals })` runs `UPDATE event_entries SET qualified_for_nationals = ...` (lines 979–982). |
| **app/api/event-entries/route.ts** | On **regional/other event entry create** | POST passes `body.qualifiedForNationals \|\| false` into `db.createEventEntry()` (line 743). Whatever the client sends (or default false) is stored. |
| **app/api/admin/entries/[id]/qualify/route.ts** | On **admin toggle** | PUT accepts `{ qualifiedForNationals: boolean }` and calls `db.updateEventEntry(entryId, { qualifiedForNationals })`. This is the **manual “Qualify for Nationals”** action. |
| **app/admin/events/[id]/page.tsx** | UI | `toggleQualification(entryId)` calls the qualify API above (lines 390–398). |
| **app/api/nationals/entries/route.ts** | On **nationals entry create** | Creates a **nationals_event_entry** with `qualifiedForNationals: body.qualifiedForNationals \|\| true` (line 34). No qualification check is run here. |
| **app/api/payments/payfast/webhook/route.ts** | On **PayFast webhook** | When creating/updating an entry, sets `qualifiedForNationals: true` (line 361). |
| **app/api/payments/process-entries/route.ts** | On **process entries** | Sets `qualifiedForNationals: true` when creating entries (line 92). |
| **scripts/recover-missing-entries.js** | Script | Sets `qualifiedForNationals: true` when recovering entries (line 99). |

**Where it is NOT set:**

- **Not on score save** – saving scores does not touch `qualified_for_nationals`.
- **Not on score publish** – `publishPerformanceScores()` in `lib/database.ts` (lines 2803–2811) only sets `performances.scores_published = true` (and certificate generation); it does **not** update `event_entries.qualified_for_nationals`.
- **Not by a background job** – no job derives or updates `qualified_for_nationals` from scores or rules.
- **Not by certificate generation** – certificate flow does not write to `qualified_for_nationals`.

So: **the stored flag is set only on entry create (from request body or defaults), on admin qualify toggle, and in payment/script flows. It is never set automatically from scores or publish.**

### Computed qualification (used when *entering* a Nationals-type event)

**When does the system actually “decide” if someone is qualified?**

Only when **creating an event entry** for an event that **requires qualification** (e.g. a NATIONAL_EVENT in the `events` table). That happens in:

- **File:** `app/api/event-entries/route.ts`  
- **Function:** POST handler (create entry)  
- **When:** After validation, before `db.createEventEntry()`.  
- **Logic:** If `qualificationRequired` and `qualificationSource === 'REGIONAL'`, it calls `db.checkRegionalQualification(primaryDancerId, minimumQualificationScore)`. That function **does not read** `qualified_for_nationals`; it **queries performances and scores** (see below).

So:

- **Entry to events in `events` with type NATIONAL_EVENT:**  
  Qualification is **computed at request time** via `checkRegionalQualification` (or other source checks). The **stored** `qualified_for_nationals` on `event_entries` is **not** used for this decision.
- **Entry to events in `nationals_events` (nationals_event_entries):**  
  The **nationals entries** API (`app/api/nationals/entries/route.ts`) does **not** run any qualification check. It just creates the entry and defaults `qualifiedForNationals` to true.

**Summary:**

- **Stored:** `qualified_for_nationals` is set on **entry create** (body/defaults), **admin qualify toggle**, and in **payment/script** flows; never on score save, score publish, or certificate generation.
- **Used for gating Nationals:** Only for events in the **events** table (e.g. NATIONAL_EVENT). There, the system uses **query-time logic** (`checkRegionalQualification` etc.), **not** the stored `qualified_for_nationals` flag. For **nationals_events** entries, no qualification check is applied in code.

---

## 2. What conditions are currently applied

### Regional events (earning qualification)

**Relevant code:** `lib/database.ts` → `checkRegionalQualification(dancerId, minimumScore)` (lines 5481–5528).

**Behaviour:**

- **Event type:** Only performances in events with `e.event_type = 'REGIONAL_EVENT'` are considered.
- **Score threshold:** For each performance, the condition is  
  `AVG(technical_score + musical_score + performance_score + styling_score + overall_impression_score) >= minimumScore`.  
  So there **is** a score threshold (e.g. ≥ 75 when `minimumQualificationScore` is 75). The score is the **average across judges** of the **sum** of the five criteria (typically on a 0–100 scale).
- **Publish requirement:** Only performances with `p.scores_published = true` are considered.
- **Mastery:** **Not considered.** The query does not filter on `ee.mastery` or `p.mastery`. So **Air (Special Needs) and Earth (Eisteddfod)** are **included** in the qualification check; there is no exclusion.
- **Special Needs (Air) / Eisteddfod (Earth):** Neither is excluded; both can qualify if they have a REGIONAL_EVENT performance with published scores meeting the minimum.

So for **Regional events**, the only enforced rule is: **REGIONAL_EVENT + scores_published + average total score ≥ minimum (e.g. 75%).** Mastery is not part of the rule.

### Nationals events (consuming qualification)

**Events in `events` table with `event_type = 'NATIONAL_EVENT'` (and qualification required):**

- **Qualification is enforced** when creating an **event_entry** via `app/api/event-entries/route.ts`.
- **Source of truth for the check:** **Computed at request time** via:
  - `qualificationSource === 'REGIONAL'` → `checkRegionalQualification(dancerId, minimumQualificationScore)` (no use of stored `qualified_for_nationals`).
  - `qualificationSource === 'ANY_NATIONAL_LEVEL'` → `checkNationalLevelQualification(dancerId, minimumScore)` (national/qualifier participation + optional score).
  - `qualificationSource === 'MANUAL'` → `checkManualQualification(eventId, dancerId)` (lookup in `event_manual_qualifications`).
- So for these Nationals events, **qualification is not “stored then read”** for the gate; it is **computed from performances / manual table**.

**Events in `nationals_events` table (entries in `nationals_event_entries`):**

- **No qualification logic** is applied in `app/api/nationals/entries/route.ts`. Any payload that passes validation can create an entry. `qualifiedForNationals` is set from body or defaulted to `true`.

So:

- **Regional:** Qualification “earned” by: REGIONAL_EVENT + published + score ≥ threshold. Stored `qualified_for_nationals` is not used for this rule; mastery is not considered; Air/Earth are not excluded.
- **Nationals (events table):** Qualification is **computed** (regional / national-level / manual); **not** read from `qualified_for_nationals`.
- **Nationals (nationals_events table):** Qualification is **ignored** in the API; no check is run.

---

## 3. Source of truth

- **Stored:**  
  - **Table:** `event_entries`  
  - **Column:** `qualified_for_nationals` (BOOLEAN).  
  - Same column exists on `nationals_event_entries`.

- **When it is written:**  
  - On **create** (event-entries POST, nationals entries POST, payment webhooks, process-entries, recover script): from request body or defaults.  
  - On **update**: admin qualify API only (`PUT /api/admin/entries/[id]/qualify`).

- **When it is used for “can this person enter Nationals?”:**  
  - For **events** (e.g. NATIONAL_EVENT in `events`): it is **not** used. The system uses **query-time** checks (`checkRegionalQualification`, etc.).  
  - For **nationals_events**: the API does not check qualification at all; the field is stored but not used to block entry.

So the **source of truth for gating entry** to Nationals (when gating exists) is **computed at query time** (performances + scores + manual table), not the `qualified_for_nationals` column.

---

## 4. Data check (important)

You asked to confirm, using production or staging data:

- Are there **Regional** performances where **Mastery = Air or Earth** and **qualified_for_nationals = true**?
- Are there **Water/Fire** performances **below 75%** marked as qualified?

I cannot run SQL against your database from this environment. Run the following yourself against your DB (adjust schema/names if needed).

**4.1 – Regional entries: Air or Earth with qualified_for_nationals = true**

```sql
-- Regional performances where entry has mastery Air or Earth and qualified_for_nationals = true
SELECT ee.id AS entry_id, ee.mastery, ee.qualified_for_nationals, ee.item_name, e.name AS event_name, e.event_type
FROM event_entries ee
JOIN events e ON e.id = ee.event_id
WHERE e.event_type = 'REGIONAL_EVENT'
  AND ee.qualified_for_nationals = true
  AND (ee.mastery ILIKE '%Air%' OR ee.mastery ILIKE '%Earth%');
```

**4.2 – Regional performances with published scores below 75% whose entry is qualified**

Score scale: the code uses the **sum** of the five criteria (e.g. out of 100). So “below 75%” here means average total score &lt; 75.

```sql
-- Regional performances with published scores whose average total score < 75
-- but the corresponding event_entry has qualified_for_nationals = true
SELECT ee.id AS entry_id, ee.qualified_for_nationals, ee.mastery, ee.item_name,
       p.id AS performance_id,
       AVG(s.technical_score + s.musical_score + s.performance_score + s.styling_score + s.overall_impression_score) AS avg_total_score
FROM event_entries ee
JOIN events e ON e.id = ee.event_id
JOIN performances p ON p.event_entry_id = ee.id
JOIN scores s ON s.performance_id = p.id
WHERE e.event_type = 'REGIONAL_EVENT'
  AND p.scores_published = true
  AND ee.qualified_for_nationals = true
GROUP BY ee.id, ee.qualified_for_nationals, ee.mastery, ee.item_name, p.id
HAVING AVG(s.technical_score + s.musical_score + s.performance_score + s.styling_score + s.overall_impression_score) < 75;
```

If either query returns rows, you have examples of the cases you asked about. Record those **entry_id** / **performance_id** values for your report.

---

## 5. Summary (plain English)

**Currently, the system qualifies entry to Nationals-capable events as follows:**

- **For events in the main `events` table (e.g. NATIONAL_EVENT):**  
  Qualification is **computed when the dancer tries to create an entry**. The rule used is the event’s `qualificationSource` (e.g. REGIONAL) and `minimumQualificationScore` (e.g. 75%). For REGIONAL, the system looks for at least one **Regional** performance with **published scores** and **average total score ≥ that minimum**. Mastery (Air/Earth vs Water/Fire) is **not** part of this rule. The stored field **qualified_for_nationals** is **not** used for this check; it is only a display/legacy flag that can be set manually (admin toggle) or by payment/script flows.

- **For events in the `nationals_events` table:**  
  The nationals entries API **does not enforce** any qualification. It creates the entry and typically sets **qualified_for_nationals** to true by default. So qualification is **effectively ignored** at entry time for that path.

- **The stored flag** **qualified_for_nationals** lives in **event_entries** (and nationals_event_entries). It is written **on entry create** (from request or defaults), **on admin “Qualify for Nationals” toggle**, and in **payment/script** flows. It is **never** set automatically on score save, score publish, or certificate generation, and it is **not** the source of truth for whether someone is allowed to enter a Nationals event when the app does check (that is done by the computed checks above).

---

*Report generated from codebase inspection. No code or data was modified.*
