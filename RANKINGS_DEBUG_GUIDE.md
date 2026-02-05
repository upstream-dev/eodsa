# Rankings Debug Guide - Step by Step

## 🎯 Goal
Find out why the Rankings page is showing 0 results and identify where the data flow is breaking.

---

## Step 1: Check Browser Console Logs (Client-Side)

### How to Access:
1. Open the Rankings page in your browser
2. Press `F12` or `Right-click → Inspect` to open Developer Tools
3. Click on the **Console** tab

### What to Look For:

#### ✅ Good Signs:
```
Loading rankings from: /api/rankings?type=nationals
Rankings data received: [array of objects]
✅ Found X rankings
```

#### ❌ Problem Signs:
```
Failed to load rankings, status: 500
Failed to load rankings
Error: ...
```

### Action Items:
- **Copy any error messages** you see
- **Check the Network tab** (see Step 2)
- **Look for the API call** to `/api/rankings`

---

## Step 2: Check Network Tab (API Calls)

### How to Access:
1. In Developer Tools, click the **Network** tab
2. Refresh the Rankings page (`F5` or `Ctrl+R`)
3. Look for a request to `/api/rankings`

### What to Check:

#### Click on the `/api/rankings` request:

1. **Headers Tab:**
   - Check the Request URL: Should be `/api/rankings?type=nationals`
   - Check Request Method: Should be `GET`

2. **Response Tab:**
   - **Status Code:**
     - `200` = Success (but might return empty array `[]`)
     - `403` = Feature disabled
     - `500` = Server error
   
   - **Response Body:**
     - If it's `[]` (empty array), the query returned no results
     - If it's an error object, copy the error message
     - If it's an array with data, the problem is in the frontend filtering

3. **Preview Tab:**
   - Shows formatted JSON response
   - Check if it's an empty array `[]` or has data

### Action Items:
- **Screenshot or copy** the Response body
- **Note the Status Code**
- **Check the Response Headers** for any error messages

---

## Step 3: Check Server-Side Logs

### Where to Find Server Logs:

#### If Running Locally (npm run dev):
- **Terminal/Console** where you ran `npm run dev`
- Look for console.log statements

#### If Running on Railway/Production:
- **Railway Dashboard** → Your Project → **Deployments** → Click on deployment → **View Logs**
- Or use Railway CLI: `railway logs`

### What to Look For:

#### ✅ Good Signs:
```
📊 Rankings API called with params: { type: 'nationals', eventIds: undefined }
📊 Rankings API returning: 15 rankings
✅ Found 15 rankings
```

#### ❌ Problem Signs:
```
⚠️ No rankings found for the given criteria
🔍 Running diagnostic queries...
  - Published performances: 0
  - Published performances with scores: 0
```

### Diagnostic Queries (Already Built-In):

The code automatically runs these when no results are found:

```
⚠️ No rankings found for the given criteria
🔍 Running diagnostic queries...
  - Published performances: X
  - Published performances with scores: X
  - Events matching filter: X
  - Published performances for filtered events: X
```

### Action Items:
- **Copy the diagnostic output** from the logs
- **Note the numbers** for each check
- **Share the full log output** if you need help

---

## Step 4: Check Database Directly (SQL Queries)

### How to Access Database:

#### Option A: Railway Dashboard
1. Go to **Railway Dashboard** → Your Project
2. Click on **Database** service
3. Click **Query** tab
4. Run the queries below

#### Option B: Neon Console
1. Go to your Neon project dashboard
2. Click **SQL Editor**
3. Run the queries below

#### Option C: Local Connection
- Use your database client (pgAdmin, DBeaver, etc.)
- Connect using `DATABASE_URL` from your `.env`

### Diagnostic SQL Queries:

#### Query 1: Check for Published Performances
```sql
SELECT COUNT(*) as total_published
FROM performances
WHERE scores_published = true;
```
**Expected:** Should be > 0 if scores have been published

#### Query 2: Check for Scores on Published Performances
```sql
SELECT COUNT(DISTINCT p.id) as performances_with_scores
FROM performances p
JOIN scores s ON s.performance_id = p.id
WHERE p.scores_published = true;
```
**Expected:** Should be > 0 if scores exist

#### Query 3: Check Specific Event (Replace 'YOUR_EVENT_ID')
```sql
SELECT 
  e.id as event_id,
  e.name as event_name,
  COUNT(DISTINCT p.id) as published_performances,
  COUNT(DISTINCT s.id) as total_scores
FROM events e
LEFT JOIN performances p ON p.event_id = e.id AND p.scores_published = true
LEFT JOIN scores s ON s.performance_id = p.id
WHERE e.id = 'YOUR_EVENT_ID'
GROUP BY e.id, e.name;
```
**Expected:** Should show event name and counts > 0

#### Query 4: Sample Published Performances
```sql
SELECT 
  p.id,
  p.title,
  p.scores_published,
  COUNT(s.id) as score_count,
  e.name as event_name
FROM performances p
JOIN events e ON p.event_id = e.id
LEFT JOIN scores s ON s.performance_id = p.id
WHERE p.scores_published = true
GROUP BY p.id, p.title, p.scores_published, e.name
LIMIT 10;
```
**Expected:** Should show sample performances with their score counts

#### Query 5: Check All Events
```sql
SELECT 
  id,
  name,
  region,
  performance_type,
  event_date
FROM events
ORDER BY event_date DESC
LIMIT 20;
```
**Expected:** Should list your events

### Action Items:
- **Run each query** and note the results
- **Share the output** if you need help interpreting
- **Check if `scores_published = true`** for any performances

---

## Step 5: Check Frontend State (React DevTools)

### How to Access:
1. Install **React Developer Tools** browser extension (if not installed)
2. Open Developer Tools (`F12`)
3. Click on **Components** tab (React DevTools)
4. Find `AdminRankingsPage` component

### What to Check:

1. **State Values:**
   - `rankings`: Should be an array (might be empty `[]`)
   - `filteredRankings`: Should be an array
   - `selectedEventId`: Check what event is selected
   - `isLoading`: Should be `false` after load
   - `error`: Should be empty string `''`

2. **Props:**
   - Check if `isPhase2Enabled` is `true`

### Action Items:
- **Screenshot the component state**
- **Note the values** of `rankings` and `filteredRankings`
- **Check if `selectedEventId`** matches an actual event

---

## Step 6: Test API Directly (Manual API Call)

### Using Browser:
1. Open a new tab
2. Go to: `http://localhost:3000/api/rankings?type=nationals`
   (Replace `localhost:3000` with your actual URL)
3. You should see JSON response

### Using curl (Terminal):
```bash
curl "http://localhost:3000/api/rankings?type=nationals"
```

### Using Postman/Insomnia:
1. Create new GET request
2. URL: `http://localhost:3000/api/rankings?type=nationals`
3. Send request
4. Check response

### What to Check:
- **Response Status:** Should be 200
- **Response Body:** Should be JSON array
- **Array Length:** Check if it's empty `[]` or has data

---

## Step 7: Common Issues & Solutions

### Issue 1: Empty Array `[]` Returned
**Possible Causes:**
- No performances have `scores_published = true`
- No scores exist for published performances
- Event filter doesn't match any events

**Solution:**
- Run Query 1 and Query 2 from Step 4
- Check if scores need to be published (admin action)
- Verify event IDs match

### Issue 2: 403 Forbidden
**Possible Causes:**
- Phase 2 feature flag is disabled

**Solution:**
- Check `lib/feature-flags.ts`
- Verify `isPhase2Enabled()` returns `true`

### Issue 3: 500 Server Error
**Possible Causes:**
- Database connection issue
- SQL query error
- Missing columns/tables

**Solution:**
- Check server logs (Step 3)
- Look for SQL error messages
- Verify database schema is up to date

### Issue 4: Data Exists But Not Showing
**Possible Causes:**
- Frontend filtering too restrictive
- Event ID mismatch
- Client-side filter removing all results

**Solution:**
- Check React DevTools (Step 5)
- Verify `selectedEventId` matches actual event
- Check `applyFilters()` function in rankings page

---

## Step 8: Quick Diagnostic Checklist

Run through this checklist:

- [ ] Browser console shows no errors
- [ ] Network tab shows `/api/rankings` returns 200
- [ ] Response body is not empty array `[]`
- [ ] Server logs show "Found X rankings"
- [ ] Database query shows `scores_published = true` performances exist
- [ ] Database query shows scores exist for those performances
- [ ] Event IDs in frontend match event IDs in database
- [ ] `isPhase2Enabled` is `true`
- [ ] No client-side filters are removing all results

---

## Step 9: Share Debug Information

If you need help, share:

1. **Browser Console Output:**
   - Copy all console.log messages
   - Copy any error messages

2. **Network Tab Response:**
   - Status code
   - Response body (first 100 lines if large)

3. **Server Logs:**
   - The diagnostic query output
   - Any error stack traces

4. **Database Query Results:**
   - Results from Query 1, 2, 3, 4 from Step 4

5. **React DevTools State:**
   - Values of `rankings`, `filteredRankings`, `selectedEventId`

---

## Quick Start Commands

### Check if rankings API works:
```bash
curl "http://localhost:3000/api/rankings?type=nationals" | jq '. | length'
```

### Check published performances count:
```sql
SELECT COUNT(*) FROM performances WHERE scores_published = true;
```

### Check scores count:
```sql
SELECT COUNT(*) FROM scores;
```

---

## Need More Help?

If you've gone through all steps and still can't find the issue:

1. **Collect all the information** from Steps 1-6
2. **Take screenshots** of:
   - Browser console
   - Network tab response
   - Server logs
   - Database query results
3. **Share the information** and we can debug further

---

## Pro Tips

1. **Clear browser cache** if you see stale data
2. **Hard refresh** with `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
3. **Check multiple events** - try selecting different events in the dropdown
4. **Check both "All Events" and specific event** - see if filtering is the issue
5. **Use browser DevTools Network tab** to see exact API requests being made
