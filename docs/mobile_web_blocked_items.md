# Blocked Items (Mobile/Web Parity)

These items could not be fully implemented under the "reuse existing APIs only" constraint.

## Mobile (Android)

- KB Questions (`/api/admin/kb-question-events`) requires cookie-based auth (web-only). Mobile bearer auth is rejected.
- KB Manager has no mobile API endpoints; web-only admin UI.
- Home Carousel image upload requires file upload (`/api/super_admin/home-carousel/upload-image`). Mobile currently supports URL entry only.
- Workshop Public Pages image uploads (profile/cover/gallery) require file upload; mobile supports URL entry only.

## Web

- None identified in this batch.
