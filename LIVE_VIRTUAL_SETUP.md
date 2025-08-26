# Live/Virtual Entry System Setup Guide

This guide walks through setting up the Live vs Virtual entry system with Cloudinary integration.

## ✅ What's Been Implemented

### **Phase 2 Features Completed:**
- ✅ Live/Virtual entry toggle on performance forms
- ✅ Music file upload for Live entries (MP3/WAV support)
- ✅ Video URL support for Virtual entries (YouTube/Vimeo)
- ✅ Music player with download functionality
- ✅ Database schema updated with new fields
- ✅ Form validation for entry type requirements

## 📋 Setup Instructions

### **1. Database Migration**
Run the migration script to add new columns:
```bash
# Make sure your DATABASE_URL is set in .env
node scripts/add-live-virtual-entry-columns.js
```

### **2. Cloudinary Setup (FREE)**

1. **Create Cloudinary Account:**
   - Go to [https://cloudinary.com](https://cloudinary.com)
   - Sign up for free account (25GB storage/month)

2. **Get Credentials:**
   - Go to Dashboard after signup
   - Copy: Cloud Name, API Key, API Secret

3. **Add to .env file:**
   ```env
   # Cloudinary Configuration
   NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your_cloud_name_here
   CLOUDINARY_API_KEY=your_api_key_here
   CLOUDINARY_API_SECRET=your_api_secret_here
   ```

### **3. Install Dependencies**
```bash
npm install cloudinary next-cloudinary
```

## 🎵 Music Upload Features

### **For Users:**
- **Live Entries**: Upload music files (MP3, WAV, AAC, M4A up to 50MB)
- **Virtual Entries**: Provide YouTube/Vimeo URLs
- **Drag & Drop**: Support for easy file upload
- **Real-time Validation**: Instant feedback on file types/sizes

### **For Judges/Admins:**
- **Music Player**: Play uploaded music with controls
- **Download**: Download original music files
- **Progress Tracking**: See upload progress
- **File Info**: View file details (duration, size, format)

## 📱 User Experience

### **Entry Form Flow:**
1. Select **Live** or **Virtual** entry type
2. **If Live**: Upload music file via drag-and-drop or browse
3. **If Virtual**: Enter YouTube/Vimeo URL
4. Form validates requirements before submission
5. Real-time feedback on missing requirements

### **Music Player Features:**
- Play/pause controls
- Seek bar with time display
- Volume control
- Download button
- Compact mode for listings
- Full player mode for detailed view

## 🔧 File Storage Strategy

### **Hybrid Approach (Cost-Optimized):**
- **Music Files**: Cloudinary (free 25GB/month)
- **Videos**: YouTube/Vimeo URLs (completely free)
- **Benefits**: 
  - Zero video storage costs
  - Professional video hosting
  - High-quality music storage
  - Easy downloads for judges

## 📊 Database Schema

### **New Columns Added:**
```sql
ALTER TABLE event_entries ADD COLUMN:
- entry_type VARCHAR(10) DEFAULT 'live'
- music_file_url TEXT
- music_file_name TEXT  
- video_external_url TEXT
- video_external_type VARCHAR(20)
```

## 🚀 Testing

### **Test Live Entries:**
1. Go to event dashboard
2. Add new performance entry
3. Select "Live Performance"
4. Upload a music file
5. Verify file appears in form
6. Submit entry

### **Test Virtual Entries:**
1. Select "Virtual Performance" 
2. Choose platform (YouTube/Vimeo)
3. Enter video URL
4. Verify preview link works
5. Submit entry

### **Test Music Player:**
1. View submitted Live entries
2. Click on music file
3. Test play/pause/seek/volume
4. Test download functionality

## 🔐 Security Features

- **File Type Validation**: Only audio files for music upload
- **Size Limits**: 50MB maximum for music files
- **URL Validation**: Validates video URLs
- **Cloudinary Security**: Secure upload with API keys
- **Error Handling**: Graceful failure recovery

## 📈 Free Tier Limits

### **Cloudinary Free Tier:**
- **Storage**: 25GB
- **Bandwidth**: 25GB/month
- **Transformations**: 25,000/month
- **More than enough for dance competition music files**

### **YouTube/Vimeo:**
- **Unlimited storage** for video links
- **No bandwidth costs**
- **Professional video hosting**

## 🎯 Next Steps

After setup, users can:
1. ✅ Upload music for live performances
2. ✅ Provide video URLs for virtual performances  
3. ✅ Judges can play and download music files
4. ✅ System validates all requirements before submission
5. ✅ Automatic file optimization via Cloudinary

The system is now ready for Phase 2 testing!
