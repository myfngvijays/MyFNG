# MyFNG Brand Guidelines

## 🎨 Official Brand Colors

### Logo Colors
- **my** (Dark Blue): `#023D95`
- **fng** (Bright Blue): `#0088E8`

### Color Palette

#### Primary Colors
- **Primary**: `#0088E8` - Used for main CTAs, active states, primary buttons
- **Primary Hover**: `#0367C4` - Hover state for primary buttons
- **Secondary**: `#023D95` - Used for headings, secondary buttons, important elements

#### Background Colors
- **White**: `#FFFFFF` - Cards, containers, clean backgrounds
- **Light Grey**: `#F5F7FA` - Page background, subtle sections

#### Text Colors
- **Headings**: `#023D95` - All h1, h2, h3, h4, h5, h6 elements
- **Body Text**: `#3A3F45` - Paragraphs, descriptions, general text
- **Links**: `#0088E8` - Hyperlinks, clickable text

#### Status Colors (Complementary)
- **Success/Green**: `#10B981` - Success states, completed items
- **Warning/Orange**: `#F97316` - Warnings, pending actions
- **Error/Red**: `#EF4444` - Errors, critical alerts, urgent items
- **Info/Yellow**: `#F59E0B` - Information, neutral alerts

---

## 📝 Typography

### Font Family
**Poppins** (Primary font for entire application)
- Weights: 300 (Light), 400 (Regular), 500 (Medium), 600 (Semi-Bold), 700 (Bold)
- Fallback: sans-serif

### Font Sizes
- **Headings**: 
  - H1: 3xl (1.875rem / 30px)
  - H2: 2xl (1.5rem / 24px)
  - H3: xl (1.25rem / 20px)
- **Body**: text-base (1rem / 16px)
- **Small**: text-sm (0.875rem / 14px)
- **Tiny**: text-xs (0.75rem / 12px)

---

## 🎯 Component Styling Guidelines

### Buttons

#### Primary Button
```css
Background: #0088E8
Hover: #0367C4
Text: White
Classes: btn btn-primary
```

#### Secondary Button
```css
Background: #023D95
Hover: #023D95 with 90% opacity
Text: White
Classes: btn btn-secondary
```

#### Outline Button
```css
Border: 2px solid #0088E8
Text: #0088E8
Hover Background: #0088E8
Hover Text: White
Classes: btn btn-outline
```

### Cards
```css
Background: White (#FFFFFF)
Border-radius: 12px (rounded-xl)
Shadow: shadow-md
Padding: 24px (p-6)
Classes: card
```

### Input Fields
```css
Border: 1px solid #D1D5DB (gray-300)
Focus Ring: 2px #0088E8
Focus Border: transparent
Border-radius: 8px (rounded-lg)
Classes: input
```

### Navigation (Sidebar)
```css
Active State:
  Background: #0088E8
  Text: White

Hover State:
  Background: #0088E8 with 10% opacity
  Text: #0088E8

Default:
  Text: #3A3F45
```

---

## 📊 Dashboard Specific Guidelines

### Stats Cards
- Background: White or Light Grey gradient
- Icon colors: Use brand colors or status colors
- Value text: Large, bold, using text-heading color
- Label text: Small, using text-body color

### Data Tables
- Header Background: Light Grey (#F5F7FA)
- Header Text: Headings color (#023D95)
- Row Border: Gray-200
- Hover: Light Grey background

### Badges/Status Pills
- Border-radius: Full (rounded-full)
- Padding: px-3 py-1
- Font: text-xs, font-semibold
- Colors based on status (see Status Colors)

---

## 🎨 Tailwind CSS Classes Reference

### Brand Colors
```css
bg-brand-primary      /* Background: #0088E8 */
bg-brand-primary-hover /* Background: #0367C4 */
bg-brand-secondary    /* Background: #023D95 */
bg-brand-my           /* Background: #023D95 */
bg-brand-fng          /* Background: #0088E8 */

text-brand-primary    /* Text: #0088E8 */
text-brand-secondary  /* Text: #023D95 */
text-brand-my         /* Text: #023D95 */
text-brand-fng        /* Text: #0088E8 */

border-brand-primary  /* Border: #0088E8 */
border-brand-secondary /* Border: #023D95 */
```

### Background Colors
```css
bg-background-white   /* Background: #FFFFFF */
bg-background-grey    /* Background: #F5F7FA */
```

### Text Colors
```css
text-text-heading     /* Text: #023D95 */
text-text-body        /* Text: #3A3F45 */
text-text-link        /* Text: #0088E8 */
```

### Typography
```css
font-poppins          /* Font-family: Poppins, sans-serif */
```

---

## ✅ DO's and DON'Ts

### ✅ DO
- Use brand colors for all primary UI elements
- Use Poppins font throughout the application
- Maintain consistent spacing (multiples of 4: 4px, 8px, 12px, 16px, 24px)
- Use pre-defined Tailwind classes for brand colors
- Ensure headings always use #023D95
- Keep body text at #3A3F45 for readability

### ❌ DON'T
- Use hardcoded color values (use Tailwind classes instead)
- Mix multiple blue shades that aren't part of brand palette
- Use other fonts besides Poppins
- Create custom button styles without following brand guidelines
- Use black (#000000) or pure gray for text (use brand colors)

---

## 📱 Role-Specific Color Usage

### Super Admin
- Primary actions: brand-primary (#0088E8)
- Critical alerts: Red (#EF4444)
- System status: Green (#10B981)

### Lead Manager
- Assignment actions: brand-primary (#0088E8)
- SLA warnings: Orange (#F97316)
- SLA breaches: Red (#EF4444)

### Telecaller
- New leads: brand-primary (#0088E8)
- Callbacks: Orange (#F97316)
- Completed: Green (#10B981)

### Workshop Roles (Admin, Supervisor, Mechanic, Pickup Boy)
- Active jobs: brand-primary (#0088E8)
- Pending: Orange (#F97316)
- Completed: Green (#10B981)
- Hold/Issues: Yellow (#F59E0B)

---

## 🔄 Migration Checklist

When updating existing screens:
1. ✅ Replace hardcoded blues with `brand-primary` or `brand-secondary`
2. ✅ Ensure all headings use `text-text-heading` or auto-applied via globals.css
3. ✅ Replace body text colors with `text-text-body`
4. ✅ Update button classes to use `btn-primary`, `btn-secondary`, or `btn-outline`
5. ✅ Replace card styling with `card` class
6. ✅ Verify Poppins font is being used (auto-applied via globals.css)
7. ✅ Update background colors to `bg-background-grey` or `bg-background-white`

---

## 📞 Contact

For questions about brand guidelines implementation:
- Check: `/apps/web/tailwind.config.ts`
- Check: `/apps/web/src/app/globals.css`

**Last Updated**: November 19, 2025
**Version**: 1.0

