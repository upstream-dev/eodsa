# 🎵 Music Upload Flow Debugging Guide

## 🔧 **What Was Fixed:**

### **Issue 1: Event Entries API Not Saving Music Data** ✅ FIXED
**Problem**: The `/api/event-entries` endpoint wasn't processing music file fields
**Solution**: Added Phase 2 fields to `db.createEventEntry()` call:
- `entryType` (live/virtual)
- `musicFileUrl` & `musicFileName` 
- `videoExternalUrl` & `videoExternalType`

### **Issue 2: Cloudinary Browser Compatibility** ✅ FIXED  
**Problem**: Server-side Cloudinary library causing browser errors
**Solution**: Separated server/client Cloudinary usage in `lib/cloudinary.ts`

## 🧪 **How to Test the Complete Flow:**

### **Step 1: Test Music Upload**
1. Go to: `/event-dashboard/Nationals/competition?eodsaId=test&eventId=your_event_id`
2. Add new performance entry
3. Select **"Live Performance"** 
4. Upload a music file (MP3/WAV)
5. **Check browser console** for upload success message
6. Complete and submit the entry

### **Step 2: Check Database Storage**
The entry should now include:
```json
{
  "entryType": "live",
  "musicFileUrl": "https://res.cloudinary.com/...",
  "musicFileName": "your-file.mp3"
}
```

### **Step 3: Test Sound Tech Access**
1. Go to: `/admin/sound-tech`
2. **Check browser console** for debug messages:
   - "📊 Sound Tech: Fetched entries"
   - "📊 Live entries with music" 
3. Look for Live Performances section
4. Test music player and download

## 🔍 **Debug Console Messages:**

### **Expected Console Output:**
```
📊 Sound Tech: Fetched entries: [array of entries]
📊 Live entries with music: [entries with musicFileUrl]
```

### **If No Music Shows:**
- Check if `entryType` is "live" 
- Check if `musicFileUrl` is not null
- Verify entry was submitted after the API fix

## 🎯 **Test Checklist:**

### **Music Upload Flow:**
- [ ] Music file uploads to Cloudinary successfully
- [ ] Form shows uploaded file preview
- [ ] Entry submission includes music data
- [ ] Database stores musicFileUrl and musicFileName

### **Sound Tech Dashboard:**
- [ ] Dashboard loads without errors
- [ ] Shows Live Performances section
- [ ] Music player appears for entries with music
- [ ] Download button works
- [ ] Filter by "Live" shows only music entries

### **Virtual Entry Flow:**
- [ ] Select "Virtual Performance" 
- [ ] Enter YouTube/Vimeo URL
- [ ] Entry saves with videoExternalUrl
- [ ] Sound Tech dashboard shows video links

## 🐛 **Troubleshooting:**

### **Music Not Showing in Sound Tech:**
1. **Check browser console** for debug messages
2. **Verify entry type**: Should be "live" not null
3. **Check music URL**: Should start with "https://res.cloudinary.com"
4. **Refresh dashboard**: Data might be cached

### **Upload Fails:**
1. **Check Cloudinary credentials** in .env
2. **Verify file type**: Must be MP3/WAV/AAC/M4A
3. **Check file size**: Must be under 50MB
4. **Check browser network tab** for API errors

### **No Entries Show:**
1. **Create test entries** after the API fix
2. **Check event approvals** in admin dashboard
3. **Verify database migration** ran successfully

## 🚀 **Quick Test Script:**

### **Test Complete Flow:**
1. Upload music file in entry form
2. Check browser console for success messages
3. Submit entry and approve in admin
4. Open Sound Tech dashboard
5. Look for entry in Live Performances section
6. Test music playback and download

## 📊 **Database Verification:**

Entries should now have these fields populated:
- `entry_type`: "live" or "virtual"
- `music_file_url`: Cloudinary URL (for live entries)
- `music_file_name`: Original filename
- `video_external_url`: YouTube/Vimeo URL (for virtual entries)
- `video_external_type`: "youtube", "vimeo", or "other"

---

**The flow should now work end-to-end! Try uploading a music file and check the Sound Tech dashboard.**
