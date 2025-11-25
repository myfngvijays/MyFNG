# 🚀 Workshop Mechanic - Quick Start Guide

## Getting Started

The workshop mechanic functionality is now fully integrated with real-time database and ready to use!

---

## 🌐 Web Application

### Access
Navigate to: `/dashboard/workshop_mechanic/jobs/[job-id]`

### Features Available
- ✅ Start/Pause/Complete jobs
- ✅ Upload media (BEFORE, PROGRESS, AFTER)
- ✅ Complete service checklists
- ✅ Update parts usage
- ✅ Add work notes
- ✅ Real-time updates

### Quick Actions

**1. Start a Job:**
```
1. Click on assigned job from dashboard
2. Click "Start Job" button
3. Status changes to IN_PROGRESS
4. Timer starts
```

**2. Upload Images:**
```
1. Go to "Media" tab
2. Select category (BEFORE/PROGRESS/AFTER)
3. Click "Upload Photos"
4. Select images (max 10MB each)
5. Wait for upload confirmation
6. Count updates automatically
```

**3. Complete Checklist:**
```
1. Go to "Checklist" tab
2. Click checkbox for each item
3. Status changes to COMPLETED
4. Progress percentage updates
5. Green checkmark appears
```

**4. Complete Job:**
```
1. Ensure requirements met:
   - Before images: 3+
   - After images: 3+
   - Checklist: 100% complete
2. Click "Mark Completed"
3. System validates requirements
4. Status changes to COMPLETED
5. Notification sent to supervisor
```

---

## 📱 Mobile Application

### Access
Open: `MechanicJobDetailScreenV2.tsx` (use this new version)

### Features Available
- ✅ Camera photo capture
- ✅ Gallery image selection
- ✅ Real-time job updates
- ✅ Interactive checklist
- ✅ Status management
- ✅ Work notes editing
- ✅ Parts viewing

### Quick Actions

**1. Take Photo:**
```
1. Open job detail
2. Tap "Media" tab
3. Select category (BEFORE/PROGRESS/AFTER)
4. Tap "📷 Take Picture"
5. Grant camera permission (first time)
6. Capture photo
7. Image uploads automatically
8. Count updates in real-time
```

**2. Upload from Gallery:**
```
1. Go to "Media" tab
2. Select category
3. Tap "🖼️ Choose Image"
4. Grant gallery permission (first time)
5. Select image
6. Upload starts automatically
7. Success notification appears
```

**3. Update Checklist:**
```
1. Tap "Checklist" tab
2. Tap on any item
3. Checkbox toggles
4. Status syncs to server
5. Completion percentage updates
```

**4. Add Work Notes:**
```
1. Tap "Notes" tab
2. Type your observations
3. Tap "Save Notes"
4. Confirmation appears
5. Notes saved to database
```

---

## 🔄 Real-Time Features

### Auto-Updates
- ✅ Job status changes sync instantly
- ✅ Image counts update automatically
- ✅ Checklist progress reflects immediately
- ✅ Multiple devices stay in sync
- ✅ No manual refresh needed

### How It Works
```typescript
// Automatic subscription
useEffect(() => {
  const channel = supabase
    .channel(`job-${jobId}-updates`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'mechanic_jobs',
      filter: `lead_id=eq.${jobId}`
    }, () => {
      // Auto-refresh data
      fetchJobDetails();
    })
    .subscribe();

  return () => channel.unsubscribe();
}, [jobId]);
```

---

## 🔧 API Endpoints

### Use These URLs

**Media Upload:**
```
POST /api/mechanic/jobs/{job-id}/media
Body: {
  media_url: string,
  media_category: 'BEFORE' | 'PROGRESS' | 'AFTER',
  media_type: 'IMAGE' | 'VIDEO',
  file_size_kb: number
}
```

**Update Status:**
```
POST /api/mechanic/jobs/{job-id}/status
Body: {
  status: 'ASSIGNED' | 'IN_PROGRESS' | 'HOLD' | 'COMPLETED',
  notes: string
}
```

**Update Checklist:**
```
PUT /api/mechanic/jobs/{job-id}/checklist
Body: {
  item_id: string,
  status: 'PENDING' | 'COMPLETED',
  notes: string
}
```

**Update Parts:**
```
PUT /api/mechanic/jobs/{job-id}/parts
Body: {
  part_id: string,
  quantity_used: number,
  usage_status: string
}
```

**Save Notes:**
```
PUT /api/mechanic/jobs/{job-id}/notes
Body: {
  work_notes: string
}
```

---

## 📋 Requirements Before Completion

### Minimum Image Requirements
- Before Images: **3 minimum**
- Progress Images: **2 minimum**
- After Images: **3 minimum**

### Checklist Requirements
- All **mandatory items** must be completed
- Optional items can be skipped
- Notes should be added for important items

### Status Flow
```
ASSIGNED → IN_PROGRESS → COMPLETED
    ↓           ↓
  HOLD    WAITING_APPROVAL
```

---

## ⚠️ Common Issues & Solutions

### Issue: "Cannot complete job"
**Solution:**
1. Check image counts meet minimums
2. Verify all mandatory checklist items done
3. Ensure status is IN_PROGRESS
4. Check console for specific error

### Issue: "Media upload fails"
**Solution:**
1. Check file size < 10MB
2. Verify file type (JPEG, PNG, MP4)
3. Check internet connection
4. Try again with smaller file

### Issue: "Real-time not working"
**Solution:**
1. Check Supabase connection
2. Verify subscription active
3. Refresh page/app
4. Check console errors

---

## 🎯 Best Practices

### For Mechanics

**✅ DO:**
- Upload clear, well-lit photos
- Complete checklist as you work
- Add detailed work notes
- Update parts usage regularly
- Start job when ready to work
- Upload before images first

**❌ DON'T:**
- Upload blurry or dark photos
- Skip mandatory checklist items
- Leave work notes empty
- Complete without all images
- Start job if not ready
- Rush through checklist

### For Quality Work

**Image Tips:**
- Take photos in good lighting
- Show full work area
- Capture damage clearly
- Include reference objects for scale
- Take extra photos if unsure
- Delete bad photos and retake

**Checklist Tips:**
- Read each item carefully
- Check thoroughly before marking
- Add notes for unusual findings
- Don't skip safety checks
- Ask supervisor if unsure
- Document everything

---

## 📊 Performance Tracking

Your work is tracked automatically:
- Job completion time
- SLA adherence
- Quality scores
- Image upload count
- Checklist completion rate
- Rework count

**Aim For:**
- 95%+ SLA success rate
- 100% checklist completion
- Minimum rework
- Detailed work notes
- Quality photos

---

## 🆘 Need Help?

### Development Issues
- Check console for errors
- Verify API endpoint URLs
- Test with Postman/Insomnia
- Check Supabase logs
- Review network requests

### User Issues
- Contact workshop supervisor
- Review training materials
- Check this guide
- Ask team members

---

## 📞 Quick Reference

### Web Shortcuts
- `Ctrl/Cmd + R` - Refresh
- `Esc` - Close modals
- Tab navigation - Move between fields

### Mobile Gestures
- Swipe left/right - Switch tabs
- Pull down - Refresh
- Tap - Select/toggle
- Long press - Additional options

---

## ✨ New Features

### Just Added
1. ✅ Real-time database sync
2. ✅ Mobile camera integration
3. ✅ API-based operations
4. ✅ Enhanced validations
5. ✅ Activity logging
6. ✅ Better error messages
7. ✅ Progress indicators

### Coming Soon
- Offline mode support
- Voice notes
- Video uploads
- Image annotations
- GPS tracking
- Barcode scanning

---

## 🎉 Success!

You now have a complete, production-ready workshop mechanic system with:

✅ Real-time updates
✅ Media upload
✅ Job management
✅ Checklist system
✅ Parts tracking
✅ Work notes
✅ Mobile support
✅ Web interface

**Ready to start working!** 🚀

---

**Version:** 2.0 (Real-Time Edition)  
**Last Updated:** November 25, 2025  
**Status:** Production Ready

