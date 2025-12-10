# Home Page & Website Modifications Required

Based on the observation document, here are all the modifications needed:

## 1. Hero Section Image Size Adjustment ✅ IDENTIFIED
**Location:** `apps/web/src/app/page.tsx` (Line 176-181)
**Current:** Image height is `h-[300px] sm:h-[400px] md:h-[500px]`
**Required:** Reduce image size to be more proportionate
**Action:** Adjust height classes to smaller values (e.g., `h-[200px] sm:h-[250px] md:h-[300px]`)

---

## 2. Update Hero Section Background & Font Colors (Including Breadcrumbs) ✅ IDENTIFIED
**Location:** 
- Hero section: `apps/web/src/app/page.tsx` (Line 87-98)
- Breadcrumbs: Need to check if breadcrumbs exist on inner pages
**Current:** Dark gradient background (`from-gray-900 via-blue-900 to-purple-900`)
**Required:** Update colors for better readability and brand consistency
**Action:** 
- Review and update hero section background colors
- Apply same color scheme to breadcrumbs across all inner pages
- Ensure proper contrast for text readability

---

## 3. Rename "Learn More" to "Know More" on Service Page ✅ IDENTIFIED
**Location:** `apps/web/src/app/services/page.tsx` (Line 291)
**Current:** `Learn More`
**Required:** Change to `Know More`
**Action:** Replace text on line 291

---

## 4. Create Separate Pages for Each Service Instead of Anchor Sections ✅ IDENTIFIED
**Location:** `apps/web/src/app/services/page.tsx` (Line 288)
**Current:** Links use anchor tags `#${service.slug}` (Line 288)
**Required:** Each service should have its own dedicated page
**Action:** 
- Create individual service pages at `/services/[slug]/page.tsx`
- Update links from `#${service.slug}` to `/services/${service.slug}`
- Maintain same URLs as old website if possible
- Each page should have its own SEO-optimized content

---

## 5. Missing "Read More" Buttons on Home Page Service Section ✅ IDENTIFIED
**Location:** `apps/web/src/app/page.tsx` (Line 259-308)
**Current:** Service cards don't have "Read More" or "Know More" buttons
**Required:** Add CTAs to each service card
**Action:** 
- Add "Know More" button to each `ServiceTypeCard` component
- Link to individual service pages (after implementing #4)

---

## 6. Clarification on AI-Related Titles and Messaging ✅ IDENTIFIED
**Locations:**
- `apps/web/src/app/page.tsx` (Line 240): "Join India's fastest-growing AI-powered car service platform"
- Line 406: "Hassle-Free Car Maintenance with MY FNG AI"
- Line 421: "Transparent AI Pricing"
- Line 128: "AI Diagnostics"
**Required:** Clarify that MyFNG provides AI-powered booking/agent support, not AI-driven workshops
**Action:** 
- Update Line 240: "Join India's fastest-growing AI-powered car service **booking** platform"
- Review all AI-related messaging to ensure clarity
- Update other instances to emphasize "AI-powered booking" vs "AI-powered service stations"

---

## 7. Logo and Menu Header Visibility on Blog Page ✅ IDENTIFIED
**Location:** `apps/web/src/app/blog/page.tsx`
**Current:** Blog page doesn't include Navbar component
**Required:** Add Navbar to blog pages
**Action:** 
- Import and add `<Navbar />` component at the top of blog page
- Ensure it's also added to individual blog post pages (`/blog/[slug]/page.tsx`)

---

## 8. Quick Booking Form Size Optimization ✅ IDENTIFIED
**Location:** `apps/web/src/components/landing/BookingForm.tsx`
**Current:** Form appears oversized (Line 269: `max-w-2xl`)
**Required:** Make form more compact with visible close button
**Action:** 
- Reduce max-width (e.g., `max-w-xl` or `max-w-lg`)
- Ensure close button (Line 279-284) is clearly visible
- Optimize for mobile screens

---

## 9. Traditional Form Layout Should Be More Compact ✅ IDENTIFIED
**Location:** `apps/web/src/app/book-service/page.tsx` (needs verification)
**Required:** Traditional booking form should fit in single screen without excessive scrolling
**Action:** 
- Review traditional booking form layout
- Make it more compact
- Reduce vertical spacing where possible
- Optimize field grouping

---

## 10. Brand Logos Review ✅ IDENTIFIED
**Location:** `apps/web/src/app/page.tsx` (Line 53-80, 319-399)
**Current:** Brand logos are fetched from database
**Required:** Check for quality, consistency, and proper alignment
**Action:** 
- Review brand logo display (Line 342-393)
- Ensure proper image loading and error handling
- Check alignment and sizing
- Replace any low-resolution or outdated logos

---

## 11. Blog Menu Placement in Top Navigation ✅ IDENTIFIED
**Location:** `apps/web/src/components/landing/Navbar.tsx` (Line 280-285)
**Current:** Navigation has: Services, Roadside Assistance, AI Experience, Contact
**Required:** Add "Blog" option to navigation
**Action:** 
- Add Blog link to navigation menu (Line 280-285)
- Link to `/blog` page

---

## 12. Website Structure & Content Finalization ⚠️ NOTE
**Status:** This is a planning note, not a code change
**Action:** 
- Finalize complete website structure (sitemap)
- Lock in all content before further design/development
- Document all pages, CTAs, categories, and service flows

---

## Implementation Priority

### High Priority (User-Facing Issues):
1. **#7** - Blog page navbar (quick fix, high impact)
2. **#3** - Rename "Learn More" to "Know More" (quick fix)
3. **#11** - Add Blog to navigation (quick fix)
4. **#5** - Add "Read More" buttons to home page services (medium effort)
5. **#1** - Hero image size adjustment (quick fix)

### Medium Priority (UX Improvements):
6. **#2** - Hero section colors (design decision needed)
7. **#8** - Quick booking form optimization (medium effort)
8. **#9** - Traditional form compact layout (medium effort)
9. **#6** - AI messaging clarification (content review needed)

### Lower Priority (SEO & Structure):
10. **#4** - Separate service pages (requires new pages, routing, content)
11. **#10** - Brand logos review (content/asset review)

### Planning:
12. **#12** - Website structure finalization (planning/documentation)

---

## Files to Modify

1. `apps/web/src/app/page.tsx` - Home page (multiple changes)
2. `apps/web/src/app/services/page.tsx` - Services page
3. `apps/web/src/app/blog/page.tsx` - Blog listing page
4. `apps/web/src/app/blog/[slug]/page.tsx` - Individual blog posts (verify)
5. `apps/web/src/components/landing/Navbar.tsx` - Navigation
6. `apps/web/src/components/landing/BookingForm.tsx` - Quick booking form
7. `apps/web/src/app/book-service/page.tsx` - Traditional booking form (verify)

---

## Notes

- **URL Preservation:** When creating separate service pages (#4), try to maintain same URLs as old website
- **SEO Impact:** Separate service pages (#4) will significantly improve SEO
- **Content Review:** AI messaging (#6) requires content team review to ensure accuracy
- **Design Consistency:** Color updates (#2) should maintain brand identity
