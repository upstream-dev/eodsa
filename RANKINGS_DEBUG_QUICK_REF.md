# Rankings Debug - Quick Reference Card

## 🚀 Quick Checks (Do These First!)

### 1. Browser Console (F12 → Console Tab)
```
Look for:
✅ "Rankings data received: [...]"
❌ "Failed to load rankings"
❌ Any red error messages
```

### 2. Network Tab (F12 → Network → Find /api/rankings)
```
Check:
- Status: Should be 200
- Response: Should be JSON array (not empty [])
```

### 3. Server Logs (Terminal or Railway Dashboard)
```
Look for:
✅ "📊 Rankings API returning: X rankings"
❌ "⚠️ No rankings found"
❌ Diagnostic query results
```

---

## 🔍 Key SQL Queries (Run in Database)

### Quick Check #1: Are there published performances?
```sql
SELECT COUNT(*) FROM performances WHERE scores_published = true;
```
**If 0 → Scores haven't been published yet**

### Quick Check #2: Do published performances have scores?
```sql
SELECT COUNT(DISTINCT p.id) 
FROM performances p
JOIN scores s ON s.performance_id = p.id
WHERE p.scores_published = true;
```
**If 0 → No scores exist for published performances**

### Quick Check #3: What events exist?
```sql
SELECT id, name, region FROM events ORDER BY event_date DESC LIMIT 10;
```
**Use these IDs to test in the frontend**

---

## 🐛 Common Issues

| Issue | Symptom | Quick Fix |
|-------|---------|-----------|
| Empty results | `[]` returned | Check if `scores_published = true` |
| 403 Error | "Feature unavailable" | Check feature flags |
| 500 Error | Server error | Check server logs for SQL errors |
| Wrong event | Data exists but not showing | Check `selectedEventId` matches database |

---

## 📋 Debug Checklist

- [ ] Browser console: No errors?
- [ ] Network tab: Status 200?
- [ ] Network tab: Response not empty `[]`?
- [ ] Server logs: "Found X rankings"?
- [ ] Database: `scores_published = true` exists?
- [ ] Database: Scores exist for published performances?
- [ ] Frontend: `selectedEventId` matches database event ID?

---

## 🎯 Where to Find Logs

| Location | How to Access |
|----------|---------------|
| **Browser Console** | F12 → Console tab |
| **Network Requests** | F12 → Network tab → Click `/api/rankings` |
| **Server Logs (Local)** | Terminal where `npm run dev` is running |
| **Server Logs (Railway)** | Railway Dashboard → Deployments → View Logs |
| **Database** | Railway Dashboard → Database → Query tab |

---

## 💡 Pro Tips

1. **Hard Refresh:** `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
2. **Clear Cache:** DevTools → Application → Clear Storage
3. **Test API Directly:** Open `http://localhost:3000/api/rankings?type=nationals` in browser
4. **Check Multiple Events:** Try different events in the dropdown

---

## 📞 What to Share When Asking for Help

1. Browser console output (screenshot or copy)
2. Network tab response (status code + response body)
3. Server logs (especially diagnostic queries)
4. Database query results (from Quick Checks above)
