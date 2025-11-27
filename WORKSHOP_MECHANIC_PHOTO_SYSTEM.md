# Workshop Mechanic - Before Inspection & Photo Capture System

## 📋 Overview
This document outlines the complete implementation of mandatory photo capture system for Workshop Mechanic role, including BEFORE inspection, DURING service, and AFTER completion requirements.

---

## 🎯 Core Requirements

### 1. BEFORE INSPECTION (Mandatory - Must Complete Before Starting Repair)

#### Required Photos (Minimum 6):
1. **Front View** - Full vehicle front
2. **Rear View** - Full vehicle rear  
3. **Left Side** - Complete left side
4. **Right Side** - Complete right side
5. **Dashboard & Odometer** - Clear reading visible
6. **Engine Bay** - Engine compartment overview
7. **Visible Damages/Scratches** (Optional but recommended) - Closeup photos
8. **Tyres** (If relevant) - All 4 tyres or specific ones

#### Technical Requirements:
- **Minimum Photos**: ≥6 mandatory photos before "Start Repair" button is enabled
- **EXIF Data Capture**: 
  - GPS coordinates (latitude, longitude)
  - Timestamp (auto-captured)
  - Show warning if GPS missing
- **Photo Features**:
  - Allow retake photos
  - Annotation tool (mark scratches/dents on photo)
  - Photo preview before upload
  - Delete/remove photos

#### Validation Rules:
- Cannot start repair until all mandatory BEFORE photos are uploaded
- GPS validation warning (not blocking, but warning)
- Photo count validation (minimum 6)

---

### 2. DURING SERVICE (Optional but Recommended)

#### When to Capture:
During critical service steps:
- Oil drain (dirty oil in pan)
- New oil being poured
- New vs old filter comparison
- Brake pads removed (before/after)
- AC coil before/after
- Any part replacement process

#### Photo Categories:
- **Oil Service**: Drain, Pour, Filter comparison
- **Brake Work**: Before removal, After installation
- **AC Service**: Coil before, Coil after
- **Part Replacement**: Old part, New part installation

---

### 3. AFTER SERVICE (Mandatory - Before Completion)

#### Required Photos:
1. **Front View** (post-service)
2. **Rear View** (post-service)
3. **Left Side** (post-service)
4. **Right Side** (post-service)
5. **Engine Bay** (after service)
6. **Old Parts Photo** - All replaced parts together
7. **New Parts Installed** - Photo showing installation
8. **Final Odometer Reading** - Updated reading

#### Completion Checklist:
- ✅ All jobcard checklist items ticked or documented
- ✅ All mandatory AFTER images uploaded
- ✅ Parts used recorded in system
- ✅ Old parts photo uploaded
- ✅ Final odometer reading captured
- ✅ Mechanic notes entered

---

## 📊 Database Schema Changes

### New Tables/Columns Needed:

#### 1. `mechanic_job_photos` table:
```sql
CREATE TABLE IF NOT EXISTS public.mechanic_job_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid REFERENCES public.mechanic_jobs(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES public.service_leads(id),
  photo_type text NOT NULL, -- 'before', 'during', 'after'
  photo_category text, -- 'front', 'rear', 'left', 'right', 'dashboard', 'engine_bay', 'damage', 'tyre', 'oil_drain', 'filter', 'brake', 'ac', 'old_parts', 'new_parts'
  photo_url text NOT NULL,
  thumbnail_url text,
  latitude numeric,
  longitude numeric,
  timestamp timestamp with time zone DEFAULT now(),
  annotations jsonb, -- Store annotation data (marks, notes on photo)
  notes text,
  uploaded_by uuid REFERENCES public.users_login(id),
  created_at timestamp with time zone DEFAULT now()
);
```

#### 2. Update `mechanic_jobs` table:
```sql
ALTER TABLE public.mechanic_jobs
ADD COLUMN IF NOT EXISTS before_inspection_complete boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS before_photos_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS after_photos_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS initial_odometer_reading numeric,
ADD COLUMN IF NOT EXISTS final_odometer_reading numeric;
```

#### 3. Update `service_checklist_items`:
```sql
-- Ensure checklist has photo requirements
ALTER TABLE public.service_checklist_items
ADD COLUMN IF NOT EXISTS requires_photo boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS photo_category text;
```

---

## 🎨 UI/UX Implementation

### Mobile App (React Native)

#### Screen: Job Detail with Photo Capture

**Before Inspection Section:**
- Photo grid showing required photos
- Camera button for each required photo type
- Progress indicator (X/6 photos uploaded)
- GPS status indicator
- Annotation tool (draw on photo)
- Photo preview with delete option

**During Service Section:**
- Optional photo uploads
- Category-based photo organization
- Quick capture buttons for common actions

**After Service Section:**
- Mandatory photo checklist
- Parts photo upload
- Odometer reading input
- Final validation before completion

### Web App (Next.js)

**Similar structure with:**
- Drag & drop photo upload
- Image annotation tool
- Photo gallery view
- EXIF data display
- GPS map view

---

## 🔧 Implementation Steps

### Step 1: Database Schema
- Create `mechanic_job_photos` table
- Add columns to `mechanic_jobs`
- Update checklist structure

### Step 2: Photo Upload Service
- Implement photo upload with EXIF extraction
- GPS validation
- Thumbnail generation
- Annotation storage

### Step 3: Mobile UI
- Before inspection screen
- Photo capture component
- Annotation tool
- Validation logic

### Step 4: Web UI
- Photo upload interface
- Gallery view
- Annotation tool
- Validation dashboard

### Step 5: Validation & Enforcement
- Before start validation
- Before completion validation
- Checklist enforcement

---

## ✅ Validation Rules

### Before Starting Repair:
- [ ] Minimum 6 BEFORE photos uploaded
- [ ] Front, Rear, Left, Right, Dashboard, Engine Bay present
- [ ] Initial odometer reading captured
- [ ] GPS warning shown (if missing, but not blocking)

### Before Completing Job:
- [ ] All checklist items completed
- [ ] All AFTER photos uploaded (minimum 6)
- [ ] Old parts photo uploaded
- [ ] Final odometer reading captured
- [ ] Parts used recorded
- [ ] Mechanic notes entered

---

## 📱 User Flow

1. **Mechanic receives job assignment**
2. **Opens job detail page**
3. **BEFORE INSPECTION section visible**
4. **Takes required photos (minimum 6)**
5. **System validates photos and enables "Start Repair"**
6. **Mechanic starts repair work**
7. **During service: Optional photos for critical steps**
8. **Completes checklist items**
9. **AFTER SERVICE: Uploads mandatory photos**
10. **Records parts used**
11. **Enters final odometer reading**
12. **System validates all requirements**
13. **Enables "Mark Complete" button**

---

## 🔒 Security & Data Integrity

- Photos stored in Supabase Storage
- EXIF data validation
- GPS data for location verification
- Timestamp for audit trail
- User authentication for uploads
- File size limits
- Image format validation (JPEG, PNG)

---

## 📝 Notes

- GPS is recommended but not blocking (some workshops may have poor GPS signal)
- Annotation tool allows marking damages directly on photos
- Photo retake functionality ensures quality
- Thumbnail generation for performance
- Progressive upload for large files

