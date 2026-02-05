# Nationals qualification – Current behaviour and design options

Architecture alignment only. No code changes.

---

## Chosen approach: Option C (Hybrid)

**Option C** is the selected design: computed once → stored → enforced everywhere.

### Qualification rules (for the single compute-and-write step)

When computing whether a Regional performance qualifies a dancer for Nationals, the following rules apply:

| Mastery level | Qualifies for Nationals? |
|---------------|--------------------------|
| **Water** (Competitive) | ✅ Yes, if score ≥ minimum (e.g. 75%) |
| **Fire** (Advanced) | ✅ Yes, if score ≥ minimum (e.g. 75%) |
| **Air** (Special Needs) | 🚫 **Never**, regardless of score |
| **Earth** (Eisteddfod) | 🚫 **Never**, regardless of score |

So: only **Water** and **Fire** performances in Regional events with published scores ≥ minimum can qualify a dancer for Nationals. Air and Earth never qualify.

---

## 1. Current behaviour in plain English

### When qualification is enforced

- **Only when creating an event entry via POST /api/event-entries** for an event that requires qualification (e.g. an event in the `events` table with type NATIONAL_EVENT, or with “national” in the name).
- In that path, the server runs a **computed** check before creating the entry: it looks up whether the dancer has at least one **Regional** performance with **published scores** and **average total score ≥ the event’s minimum** (e.g. 75%). It does **not** look at the stored `qualified_for_nationals` flag. If the check fails, the request is rejected with a 400 and no entry is created.

So qualification is enforced **only on that one API path**, and only by **computed** logic (scores + event type + publish status).

### When qualification is ignored

- **Creating an entry via any other path:**  
  Qualification is **not** checked at all when entries are created by:
  - **POST /api/nationals/entries** (creates a row in `nationals_event_entries`).
  - **PayFast webhook** (creates `event_entries` by calling `db.createEventEntry` directly).
  - **POST /api/payments/process-entries** (same).
  - **POST /api/payments/eft** (inserts directly into `event_entries`).
  - **Scripts** such as `recover-missing-entries.js` (call `db.createEventEntry` directly).

So a dancer can end up with a nationals-capable entry (in either `event_entries` for a national event or in `nationals_event_entries`) **without** ever passing the qualification check, if the entry was created through one of these paths.

### How mastery currently affects (or doesn’t affect) qualification

- **In the qualification checks themselves:**  
  Mastery (Air / Earth / Fire / Water) is **not used at all**. The functions that decide “has this dancer qualified?” (`checkRegionalQualification`, `checkNationalLevelQualification`) only look at event type, published scores, and score threshold. They do **not** filter by mastery. So **Air and Earth performances can currently count as qualifying** for nationals in the same way as Water and Fire.

- **In entry validation:**  
  Mastery **is** used when **creating or updating** an entry: for events treated as “Nationals”, only **Water and Fire** are allowed as mastery on the entry; for Regional events, all four levels are allowed. So mastery is **authoritative for “allowed to submit this entry with this mastery level”**, but it is **not** part of the rule that determines “has this dancer earned qualification”.

**Summary:** Qualification is enforced only on POST /api/event-entries; everywhere else it is ignored. Mastery does not affect “has this dancer qualified?” but does affect “which mastery level can be on the form?” for Nationals vs Regional.

---

## 2. Is there a single source of truth for nationals eligibility?

**No.**

- **For “can this person enter a nationals-type event?”:**  
  The **effective** rule is the **computed** check (Regional performance with published scores ≥ minimum). That logic lives in one place (the qualification helpers) but is **invoked only** when creating an entry via POST /api/event-entries. All other entry-creation paths bypass it, so “eligibility” is not consistently enforced.

- **Stored flag:**  
  `qualified_for_nationals` is stored on entries and shown in the UI, but it is **never** used to allow or block entry. So there are two “notions” of qualification—computed (used in one path) and stored (display-only)—and they are not aligned as a single source of truth.

- **Mastery:**  
  The documented intent (e.g. DANCER_MANUAL: Air/Earth do not qualify for nationals) is **not** reflected in the qualification checks, so the “source of truth” for who qualifies is ambiguous (code says one thing, docs another).

So today there is **no** single, consistently enforced source of truth for nationals eligibility.

---

## 3. Proposed design options (not implemented yet)

Three options, stated so that **one** source of truth is chosen and then applied **everywhere** entry is created or gated.

---

### Option A: Computed qualification only (derived every time)

**Idea:**  
Eligibility is **never** stored. Whenever we need to know “can this dancer enter this nationals-type event?”, we compute it: e.g. at least one **Regional** performance with **published scores**, **score ≥ minimum**, and (if we adopt the rule) **mastery in [Water, Fire]** only. No `qualified_for_nationals` (or it becomes display-only and still not used for gating).

**Pros**

- Single source of truth: the computation. No sync issues between “stored” and “actual”.
- Correct by construction after any score publish or rule change; no backfills.
- Simpler mental model: “qualification = result of this function”.

**Cons**

- Every entry attempt (and any “am I qualified?” check) does a DB query over performances/scores. Slightly more load; still fine at typical scale.
- Slightly more complex queries if we add mastery (and possibly event-type) filters.

**Impact on existing data and flows**

- **Data:** `qualified_for_nationals` can remain for display/history but must not be used for blocking. No migration of the flag required for correctness.
- **Flows:** **Every** path that creates a nationals-capable entry (event-entries POST, nationals/entries POST, PayFast webhook, EFT, process-entries, any script) must call the **same** “can this dancer enter this event?” function before creating the entry; otherwise the path is changed to create the entry only via a single service that does the check. So all entry-creation code paths must be updated to use the shared check.

---

### Option B: Stored qualification flag only (authoritative `qualified_for_nationals`)

**Idea:**  
The **only** source of truth for “is this dancer qualified for nationals?” is the stored flag (e.g. on a **dancer** or on a **qualification record**, not per entry). Entry creation and “am I qualified?” checks **only** read this flag. The flag is updated by a **single** process (e.g. when scores are published, or by an admin action, or by a job that runs the current rules).

**Pros**

- Fast checks: one read of a flag. No joins over performances/scores at entry time.
- Clear audit trail if we store “when/how qualified” (e.g. performance id, score, rule version).

**Cons**

- We must define **when** the flag is set/cleared: on score publish, on admin action, on a nightly job, etc. If we ever add “mastery must be Water/Fire” or change the score threshold, we need a backfill or re-run of the job.
- Risk of drift if new entry paths are added and someone forgets to check the flag.

**Impact on existing data and flows**

- **Data:** We must decide what “the” flag applies to (e.g. `dancer_qualifications` table: dancer + event or event-type + “qualified” + reason). Existing `event_entries.qualified_for_nationals` could be deprecated or migrated into this. We need a one-time backfill from current rules (and possibly mastery) to set initial flag state.
- **Flows:** (1) One place that **writes** the flag (e.g. on publish, or job, or admin). (2) **Every** path that creates a nationals-capable entry must **read** that flag and block if false. So event-entries POST, nationals/entries, PayFast, EFT, process-entries, scripts—all must be updated to “if event requires qualification, then check stored flag; if not set, reject.”

---

### Option C: Hybrid (computed once → stored → enforced everywhere)

**Idea:**  
Eligibility is **computed** in one place (e.g. when scores are published for a Regional performance, or in a small job that runs after publish). The result is **written** to a stored flag (or qualification row). **All** entry-creation paths and “am I qualified?” checks **only** read that stored value; they never recompute from scores. So the source of truth is the **stored** value, but that value is **derived** by a single, shared computation (so no ad‑hoc logic in multiple places).

**Pros**

- Single source of truth: the **stored** flag/row, so entry checks stay fast and simple.
- Single place that **defines** the rule: the “compute and write” step (e.g. on publish or one job). Easier to add mastery (Water/Fire only) or change thresholds in one place.
- Clear separation: “qualification service” writes; “entry service” only reads and enforces.

**Cons**

- Same as B: we must run the “compute and write” whenever data or rules change (e.g. score publish, rule change, backfill). Slightly more moving parts than A.

**Impact on existing data and flows**

- **Data:** Same as B: we need a defined store (e.g. `dancer_qualifications` or similar) and a one-time backfill from current (and optionally new) rules. Existing `qualified_for_nationals` on entries can be phased out or kept for display only.
- **Flows:** (1) **Write path:** When scores are published (or in a job), run the **single** qualification function (Regional + score ≥ min + optional mastery filter) and write the result to the store. (2) **Read path:** Every entry-creation path (event-entries, nationals/entries, PayFast, EFT, process-entries, scripts) checks the store and blocks if not qualified. So all entry paths must be updated to use the same “read and enforce” logic; no path may create a nationals-capable entry without checking.

---

## 4. Recommendation (conceptual only)

- **Option A** is the smallest change to “source of truth” (everything uses one function) but requires touching every entry path to call it.
- **Option B** is simple operationally (just read a flag) but pushes all “when do we set it?” and “how do we backfill?” into one design.
- **Option C** keeps fast, simple entry checks (like B) but makes the **rule** live in one “compute and write” step, which makes it easier to add mastery and keep behaviour consistent.

**Chosen: Option C.** One qualification function that writes to a store, and all entry paths only read that store and enforce it. The qualification rules (including: Air and Earth never qualify) are defined in the section above.
