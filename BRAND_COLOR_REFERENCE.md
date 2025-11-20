# MyFNG Brand Color Quick Reference

## 🎨 Color Palette

### Primary Brand Colors

| Color Name | Hex Code | Usage | Tailwind Class |
|------------|----------|-------|----------------|
| **my (Dark Blue)** | `#023D95` | Logo "my", Headings, Secondary buttons | `bg-brand-my` `text-brand-my` `border-brand-my` |
| **fng (Bright Blue)** | `#0088E8` | Logo "fng", Primary buttons, Links | `bg-brand-fng` `text-brand-fng` `border-brand-fng` |
| **Primary** | `#0088E8` | Main CTAs, Active states | `bg-brand-primary` `text-brand-primary` `border-brand-primary` |
| **Primary Hover** | `#0367C4` | Button hover states | `bg-brand-primary-hover` `hover:bg-brand-primary-hover` |
| **Secondary** | `#023D95` | Secondary actions, Important elements | `bg-brand-secondary` `text-brand-secondary` `border-brand-secondary` |

### Background Colors

| Color Name | Hex Code | Usage | Tailwind Class |
|------------|----------|-------|----------------|
| **White** | `#FFFFFF` | Cards, containers, clean backgrounds | `bg-background-white` `bg-white` |
| **Light Grey** | `#F5F7FA` | Page backgrounds, subtle sections | `bg-background-grey` |

### Text Colors

| Color Name | Hex Code | Usage | Tailwind Class |
|------------|----------|-------|----------------|
| **Heading Text** | `#023D95` | All headings (h1-h6) | `text-text-heading` (auto-applied to h1-h6) |
| **Body Text** | `#3A3F45` | Paragraphs, descriptions, general text | `text-text-body` |
| **Link Text** | `#0088E8` | Hyperlinks, clickable text | `text-text-link` `text-brand-primary` |

### Status Colors (Complementary)

| Color | Hex Code | Usage | Example Classes |
|-------|----------|-------|-----------------|
| **Success Green** | `#10B981` | Success states, completed items | `bg-green-500` `text-green-600` |
| **Warning Orange** | `#F97316` | Warnings, pending actions | `bg-orange-500` `text-orange-600` |
| **Error Red** | `#EF4444` | Errors, critical alerts, urgent | `bg-red-500` `text-red-600` |
| **Info Yellow** | `#F59E0B` | Information, neutral alerts | `bg-yellow-500` `text-yellow-600` |

---

## 📝 Typography

### Font Family
**Poppins** - Used throughout the entire application

Imported via:
```css
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap');
```

### Font Weights
- 300 - Light
- 400 - Regular (default)
- 500 - Medium
- 600 - Semi-Bold
- 700 - Bold

### Tailwind Class
```css
font-poppins
```

---

## 🎯 Common Component Classes

### Buttons

#### Primary Button
```jsx
<button className="btn btn-primary">
  Click Me
</button>
```
**Result:** Blue background (#0088E8), white text, hover effect (#0367C4)

#### Secondary Button
```jsx
<button className="btn btn-secondary">
  Click Me
</button>
```
**Result:** Dark blue background (#023D95), white text, hover effect

#### Outline Button
```jsx
<button className="btn btn-outline">
  Click Me
</button>
```
**Result:** Transparent background, blue border and text, fills on hover

---

### Cards

```jsx
<div className="card">
  {/* Your content */}
</div>
```
**Result:** White background, rounded corners, shadow, padding

---

### Inputs

```jsx
<input className="input" placeholder="Enter text" />
```
**Result:** Border, rounded corners, focus ring in brand-primary

---

### Labels

```jsx
<label className="label">Field Name</label>
```
**Result:** Brand heading color, medium weight

---

## 🎨 Visual Color Swatches

### Brand Colors
```
████ #023D95 - my / Secondary / Headings
████ #0088E8 - fng / Primary / Links
████ #0367C4 - Primary Hover
```

### Background Colors
```
████ #FFFFFF - White
████ #F5F7FA - Light Grey
```

### Text Colors
```
████ #023D95 - Headings
████ #3A3F45 - Body Text
████ #0088E8 - Links
```

### Status Colors
```
████ #10B981 - Success
████ #F97316 - Warning
████ #EF4444 - Error
████ #F59E0B - Info
```

---

## 💡 Usage Examples

### Dashboard Header
```jsx
<div className="bg-gradient-to-r from-brand-secondary to-brand-primary text-white p-6">
  <h1 className="text-3xl font-bold">Dashboard Title</h1>
  <p className="text-white/90 mt-1">Subtitle text</p>
</div>
```

### Stat Card
```jsx
<div className="card">
  <div className="flex items-center gap-3">
    <Icon className="w-6 h-6 text-brand-primary" />
    <div>
      <p className="text-2xl font-bold text-text-heading">125</p>
      <p className="text-sm text-text-body">New Leads</p>
    </div>
  </div>
</div>
```

### Status Badge
```jsx
<span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
  ACTIVE
</span>
```

### Alert Box (Critical)
```jsx
<div className="bg-red-50 border-2 border-red-500 rounded-lg p-4">
  <h3 className="font-semibold text-red-700">Critical Alert</h3>
  <p className="text-sm text-red-600 mt-1">Action required immediately</p>
</div>
```

### Navigation Link (Active)
```jsx
<a href="#" className="flex items-center gap-3 px-4 py-3 rounded-lg bg-brand-primary text-white">
  <Icon className="w-5 h-5" />
  <span className="font-medium">Dashboard</span>
</a>
```

### Navigation Link (Inactive)
```jsx
<a href="#" className="flex items-center gap-3 px-4 py-3 rounded-lg text-text-body hover:bg-brand-primary/10 hover:text-brand-primary">
  <Icon className="w-5 h-5" />
  <span className="font-medium">Dashboard</span>
</a>
```

---

## ⚠️ Common Mistakes to Avoid

### ❌ DON'T
```jsx
// Hardcoded colors
<div className="bg-blue-600">...</div>
<p className="text-gray-900">...</p>
<button className="bg-[#0088E8]">...</button>

// Wrong font
<p className="font-sans">...</p>

// Inconsistent button styles
<button className="px-6 py-3 bg-blue-500 rounded">...</button>
```

### ✅ DO
```jsx
// Brand colors
<div className="bg-brand-primary">...</div>
<p className="text-text-heading">...</p>
<button className="btn btn-primary">...</button>

// Correct font (auto-applied)
<p>...</p>

// Consistent button styles
<button className="btn btn-primary">...</button>
```

---

## 🔍 Finding Colors in Code

### Search for hardcoded colors that need updating:
```bash
# Find potential issues
grep -r "blue-[0-9]" apps/web/src/
grep -r "gray-900" apps/web/src/
grep -r "bg-\[#" apps/web/src/
```

### Verify brand color usage:
```bash
# Check brand color usage
grep -r "brand-primary" apps/web/src/
grep -r "text-text-heading" apps/web/src/
grep -r "btn-primary" apps/web/src/
```

---

## 📱 Brand Application by Role

| Role | Primary Color Usage | Accent Colors |
|------|-------------------|---------------|
| **Super Admin** | Primary actions, system status | Red (critical), Green (success) |
| **Lead Manager** | Assignment actions, metrics | Orange (SLA warnings), Red (breaches) |
| **Telecaller** | New leads, active calls | Green (completed), Orange (callbacks) |
| **Workshop Admin** | Active jobs, approvals | Yellow (pending), Green (accepted) |
| **Workshop Supervisor** | Job monitoring, assignments | Blue gradients, status colors |
| **Workshop Mechanic** | Active jobs, performance | Orange (urgent), Green (completed) |
| **Pickup Boy** | Active tasks, navigation | Green (in-transit), Blue (assigned) |
| **Customer** | Bookings, services | Brand gradient for CTAs |

---

## 🎨 Color Psychology

**Why these colors?**

- **#023D95 (Dark Blue)**: Trust, professionalism, stability
- **#0088E8 (Bright Blue)**: Innovation, efficiency, clarity
- **#3A3F45 (Dark Grey)**: Readability, sophistication, neutrality
- **#F5F7FA (Light Grey)**: Cleanliness, space, modern design

---

## 📚 Additional Resources

- **Full Guidelines**: See `BRAND_GUIDELINES.md`
- **Implementation Summary**: See `BRAND_COLORS_IMPLEMENTATION_SUMMARY.md`
- **Tailwind Config**: `apps/web/tailwind.config.ts`
- **Global Styles**: `apps/web/src/app/globals.css`

---

**Last Updated:** November 19, 2025
**Version:** 1.0

