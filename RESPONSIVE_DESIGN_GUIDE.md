# Responsive Design Guide - MyFNG Web Application

## 📱 Overview
This guide provides responsive design patterns and utilities to ensure all web screens work perfectly on any screen size (mobile, tablet, desktop).

## 🎯 Breakpoints (Tailwind CSS)
- **sm**: 640px and up (small tablets)
- **md**: 768px and up (tablets)
- **lg**: 1024px and up (desktops)
- **xl**: 1280px and up (large desktops)
- **2xl**: 1536px and up (extra large)

## 📐 Common Responsive Patterns

### 1. Container & Padding
```tsx
// ✅ Good - Responsive padding
<div className="container mx-auto px-3 sm:px-4 md:px-6">
<div className="p-3 sm:p-4 md:p-6 lg:p-8">

// ❌ Bad - Fixed padding
<div className="container mx-auto px-4">
<div className="p-6">
```

### 2. Typography
```tsx
// ✅ Good - Responsive text sizes
<h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl">
<p className="text-sm sm:text-base md:text-lg">
<span className="text-xs sm:text-sm">

// ❌ Bad - Fixed text sizes
<h1 className="text-4xl">
<p className="text-base">
```

### 3. Spacing
```tsx
// ✅ Good - Responsive spacing
<div className="mb-4 sm:mb-6 md:mb-8">
<div className="gap-2 sm:gap-3 md:gap-4">
<div className="space-y-4 sm:space-y-6">

// ❌ Bad - Fixed spacing
<div className="mb-8">
<div className="gap-4">
```

### 4. Grid Layouts
```tsx
// ✅ Good - Responsive grids
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">

// ❌ Bad - Fixed grids
<div className="grid grid-cols-3 gap-4">
```

### 5. Flex Layouts
```tsx
// ✅ Good - Responsive flex
<div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
<div className="flex flex-col md:flex-row justify-between gap-4">

// ❌ Bad - Fixed flex
<div className="flex items-center gap-4">
```

### 6. Icons & Images
```tsx
// ✅ Good - Responsive icons
<Icon className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" />
<img className="h-6 sm:h-8 md:h-10 w-auto" />

// ❌ Bad - Fixed icons
<Icon className="w-6 h-6" />
```

### 7. Buttons
```tsx
// ✅ Good - Responsive buttons
<button className="px-3 sm:px-4 md:px-6 py-2 sm:py-2.5 md:py-3 text-sm sm:text-base">
<button className="text-xs sm:text-sm px-4 sm:px-6 py-2 sm:py-3">

// ❌ Bad - Fixed buttons
<button className="px-6 py-3 text-base">
```

### 8. Input Fields
```tsx
// ✅ Good - Responsive inputs
<input className="w-full px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base md:text-lg" />
<textarea className="w-full px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base" />

// ❌ Bad - Fixed inputs
<input className="w-full px-4 py-3 text-base" />
```

### 9. Visibility
```tsx
// ✅ Good - Show/hide based on screen size
<div className="hidden sm:block">Desktop only</div>
<div className="block sm:hidden">Mobile only</div>
<span className="hidden md:inline">Tablet+ only</span>

// ❌ Bad - Always visible
<div>Always visible</div>
```

### 10. Truncation & Overflow
```tsx
// ✅ Good - Prevent overflow
<p className="truncate max-w-[200px] sm:max-w-none">Long text</p>
<div className="min-w-0 flex-1">Flex child</div>
<div className="overflow-x-auto">Scrollable content</div>
```

## 🎨 Component-Specific Patterns

### Dashboard Layout
- **Sidebar**: Hidden on mobile, overlay on tablet, fixed on desktop
- **Header**: Compact on mobile, full on desktop
- **Main Content**: Full width on mobile, offset on desktop

### Tables
```tsx
// ✅ Good - Responsive table
<div className="overflow-x-auto">
  <table className="min-w-full text-sm sm:text-base">
    <thead className="hidden sm:table-header-group">
```

### Cards
```tsx
// ✅ Good - Responsive cards
<div className="p-3 sm:p-4 md:p-6 rounded-xl">
  <h3 className="text-base sm:text-lg md:text-xl font-bold">
```

### Modals
```tsx
// ✅ Good - Responsive modals
<div className="w-full sm:w-[90%] md:w-[80%] lg:w-[600px] max-w-2xl mx-auto p-4 sm:p-6 md:p-8">
```

## ✅ Checklist for Responsive Pages

- [ ] All containers use responsive padding (`px-3 sm:px-4 md:px-6`)
- [ ] All text uses responsive sizes (`text-sm sm:text-base md:text-lg`)
- [ ] All spacing is responsive (`mb-4 sm:mb-6 md:mb-8`)
- [ ] Grids stack on mobile (`grid-cols-1 sm:grid-cols-2`)
- [ ] Flex layouts adapt (`flex-col sm:flex-row`)
- [ ] Icons scale appropriately (`w-4 h-4 sm:w-5 sm:h-5`)
- [ ] Buttons are touch-friendly on mobile (min 44x44px)
- [ ] Images are responsive (`w-full h-auto` or fixed responsive sizes)
- [ ] Tables scroll horizontally on mobile (`overflow-x-auto`)
- [ ] Navigation is mobile-friendly (hamburger menu)
- [ ] Forms are readable on all screens
- [ ] No horizontal scrolling on any screen size
- [ ] Text doesn't overflow containers
- [ ] Interactive elements are properly spaced

## 🚀 Quick Fixes

### Fix Horizontal Scrolling
```tsx
// Add to root layout or problematic containers
<div className="overflow-x-hidden">
```

### Fix Text Overflow
```tsx
// Use truncation or word-break
<p className="truncate">Long text</p>
<p className="break-words">Long text that wraps</p>
```

### Fix Image Overflow
```tsx
<img className="w-full h-auto max-w-full" />
```

### Fix Button Sizing
```tsx
<button className="min-h-[44px] min-w-[44px]">Touch target</button>
```

## 📝 Notes

1. **Mobile First**: Always design for mobile first, then enhance for larger screens
2. **Test on Real Devices**: Use browser dev tools AND real devices
3. **Touch Targets**: Minimum 44x44px for interactive elements
4. **Readable Text**: Minimum 14px on mobile, 16px preferred
5. **Performance**: Use `flex-shrink-0` for icons/images that shouldn't shrink
6. **Accessibility**: Maintain proper contrast and spacing on all sizes

## 🔧 Common Utilities

```tsx
// Responsive container
className="container mx-auto px-3 sm:px-4 md:px-6"

// Responsive text
className="text-sm sm:text-base md:text-lg"

// Responsive spacing
className="mb-4 sm:mb-6 md:mb-8"

// Responsive grid
className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4"

// Responsive flex
className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4"

// Responsive visibility
className="hidden sm:block" // Desktop only
className="block sm:hidden" // Mobile only
```

---

**Last Updated**: 2024
**Maintained By**: Development Team
