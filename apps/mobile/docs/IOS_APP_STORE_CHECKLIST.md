# iOS App Store Submission Checklist (MyFNG)

> **Status:** Code-side iOS App Store readiness fixes are committed in this PR/branch.
> Sections marked **CODE DONE** are already in the repo. Sections marked **MANUAL** require Apple Developer Portal / App Store Connect / asset work outside the codebase.

---

## What was changed in code (CODE DONE)

| # | Change | File |
|---|--------|------|
| 1 | Added `LSApplicationQueriesSchemes` (whatsapp, tel/telprompt, mailto, sms, comgooglemaps, gpay/phonepe/paytmmp/tez/upi, razorpay, credpay) — without this, `Linking.canOpenURL` returns false for these apps on iOS, breaking WhatsApp / UPI app detection | [`apps/mobile/ios/MyFNG/Info.plist`](apps/mobile/ios/MyFNG/Info.plist) |
| 2 | Added `UIBackgroundModes` = `remote-notification`, `fetch` — required for silent push notifications and background data refresh | [`apps/mobile/ios/MyFNG/Info.plist`](apps/mobile/ios/MyFNG/Info.plist) |
| 3 | Replaced legacy `armv7` capability with `arm64` (iOS 15.1 deployment target is arm64-only anyway, `armv7` was a leftover from old templates) | [`apps/mobile/ios/MyFNG/Info.plist`](apps/mobile/ios/MyFNG/Info.plist) |
| 4 | Added `com.apple.developer.associated-domains` with `applinks:myfng.in`, `applinks:www.myfng.in`, `applinks:myfng.astric.ai` — enables iOS Universal Links (https deep links into the app) | [`apps/mobile/ios/MyFNG/MyFNG.entitlements`](apps/mobile/ios/MyFNG/MyFNG.entitlements) |
| 5 | Created shared phone helper `openPhoneCall` / `openWhatsApp` / `openEmail` — uses `telprompt:` on iOS (App-Review-friendly confirm dialog) and `tel:` on Android | [`apps/mobile/src/lib/phone.ts`](apps/mobile/src/lib/phone.ts) |
| 6 | Migrated customer-flow phone/email taps to the helper (Public Home, Public Service Packages, Roadside Assistance, Settings, RSA Lead Detail) | various screens |
| 7 | Replaced Android-biased "Please rebuild the Android app" alert with neutral copy in workshop locator | [`apps/mobile/src/screens/PublicWorkshopLocatorScreen.tsx`](apps/mobile/src/screens/PublicWorkshopLocatorScreen.tsx) line 202 |
| 8 | Bumped iOS `CURRENT_PROJECT_VERSION` and `app.json` `ios.buildNumber` from `1` to `7` (matches Android `versionCode`) | [`apps/mobile/ios/MyFNG.xcodeproj/project.pbxproj`](apps/mobile/ios/MyFNG.xcodeproj/project.pbxproj), [`apps/mobile/app.json`](apps/mobile/app.json) |
| 9 | Cleaned Xcode scheme — removed dead `MyFNGTests.xctest` reference (no test target exists) and changed `LaunchAction` from `Release` → `Debug` so dev runs use Debug config | [`apps/mobile/ios/MyFNG.xcodeproj/xcshareddata/xcschemes/MyFNG.xcscheme`](apps/mobile/ios/MyFNG.xcodeproj/xcshareddata/xcschemes/MyFNG.xcscheme) |
| 10 | **Real account deletion flow** — `Settings → Delete Account` button now actually calls `POST /api/customer/auth/delete-account` which anonymizes PII (phone/email/name set to deleted markers, `is_active=false`, `deleted_at` stamped), wipes customer sessions, cart, addresses, vehicles, push devices, then signs the user out. Required by Apple Guideline 5.1.1(v) and Google Play Data Safety. | [`apps/mobile/src/screens/SettingsScreen.tsx`](apps/mobile/src/screens/SettingsScreen.tsx) + [`apps/web/src/app/api/customer/auth/delete-account/route.ts`](apps/web/src/app/api/customer/auth/delete-account/route.ts) |

Already in place from earlier work:

- `aps-environment = production` in entitlements (push notifications)
- `ITSAppUsesNonExemptEncryption = false` in Info.plist (export compliance)
- `PrivacyInfo.xcprivacy` privacy manifest with declared data types & required-reason API codes
- `NSCameraUsageDescription`, `NSLocationWhenInUseUsageDescription`, `NSPhotoLibraryUsageDescription`, `NSPhotoLibraryAddUsageDescription` strings
- iOS deployment target 15.1 (modern devices)
- Hermes JS engine ON
- Static framework linkage for Firebase Swift modules

---

## What you must still do MANUALLY before submission

### A. Apple Developer Portal ([developer.apple.com](https://developer.apple.com)) — one-time

1. **App ID configuration** for `com.myfng.app`:
   - ✅ Push Notifications capability enabled
   - ⚠️ **Associated Domains capability** — enable in App ID, regenerate provisioning profile after code changes are picked up
2. **Apple Push Notification key (.p8)** — generate at *Keys → +* → "APNs" if not already; upload to Firebase Console → Cloud Messaging → APNs Authentication Key (so `expo-notifications` / FCM can deliver pushes)
3. **Provisioning profile** — let Xcode auto-manage signing (Team `JUN6TX4JD3` already set) OR generate distribution profile manually for App Store

### B. Universal Links domain hosting (required for `applinks:`)

You must host `apple-app-site-association` (AASA) JSON at all three URLs (HTTPS, no redirects, `Content-Type: application/json`):

- `https://myfng.in/.well-known/apple-app-site-association`
- `https://www.myfng.in/.well-known/apple-app-site-association`
- `https://myfng.astric.ai/.well-known/apple-app-site-association`

Sample content:

```json
{
  "applinks": {
    "details": [
      {
        "appIDs": ["JUN6TX4JD3.com.myfng.app"],
        "components": [
          { "/": "/customer/*", "comment": "Customer pages" },
          { "/": "/booking/*", "comment": "Booking flow" },
          { "/": "/track/*", "comment": "Tracking" },
          { "/": "/invoice/*", "comment": "Invoices" },
          { "/": "/refer/*", "comment": "Refer & Rise invite links" }
        ]
      }
    ]
  }
}
```

Test after deploy with: `https://branch.io/resources/aasa-validator/?domain=myfng.in`

### C. App Store Connect ([appstoreconnect.apple.com](https://appstoreconnect.apple.com))

1. **Create app record** (if not already):
   - Bundle ID: `com.myfng.app`
   - SKU: `myfng-app`
   - Primary language: English (India)
2. **App Privacy questionnaire** — fill based on `PrivacyInfo.xcprivacy`:
   - Data types: Name, Email, Phone, Precise Location, Photos, Payment Info, User ID, Crash Data
   - Linked to user: Yes (except Crash Data)
   - Used for tracking: No
   - Purpose: App Functionality (+ Authentication for User ID, + Analytics for Crash Data, + Product Personalization for Location)
3. **App Information**:
   - Category: Auto & Vehicles (primary) / Lifestyle (secondary)
   - Content rights / Age rating: 4+
4. **Pricing & Availability**: Free, India + any other regions
5. **Demo account credentials** — Reviewers need a working test account. Provide:
   - Phone: `+919XXXXXXXXX` (with OTP backdoor or whitelisted test OTP)
   - Or email + password for Supabase login
6. **Review notes** — explain that the app requires a phone OTP or pre-created test account; mention multiple roles exist but reviewers should test as Customer

### D. App Store assets (required at submission)

| Asset | Spec | Status |
|-------|------|--------|
| App icon | 1024×1024 PNG, no transparency | ✅ already present at [`Images.xcassets/AppIcon.appiconset/App-Icon-1024x1024@1x.png`](apps/mobile/ios/MyFNG/Images.xcassets/AppIcon.appiconset/App-Icon-1024x1024@1x.png) |
| iPhone 6.7" screenshots (iPhone 15 Pro Max) | 1290×2796, min 3 max 10 | ❌ Capture from Simulator — Home, Booking, Workshop Locator, Tracking, Invoice |
| iPhone 6.5" screenshots (iPhone 11 Pro Max) | 1242×2688 | ❌ Same content, different size |
| iPad 12.9" screenshots | 2048×2732 (only if you ship iPad) | ⚠️ `app.json` has `supportsTablet: true` → required |
| App preview video (optional) | 15-30s mp4, portrait | optional |
| Description | up to 4000 chars | ❌ Write |
| Keywords | up to 100 chars CSV | ❌ Write |
| Support URL | required | use https://myfng.in/support or similar |
| Marketing URL | optional | https://myfng.in |
| Privacy Policy URL | **required** | https://myfng.in/privacy |

### E. TestFlight (recommended before public release)

1. Archive in Xcode → Distribute App → App Store Connect
2. Upload build → wait ~10-30 min for processing
3. Add **internal testers** (up to 100, no review needed) — your team
4. Add **external testers** (up to 10,000, requires Beta App Review ~24-48h) — selected real users
5. Test all customer flows: signup OTP, book, pay, track, support call

### F. Final pre-submission smoke tests on real iPhone

- [ ] Email + password login (Supabase)
- [ ] Phone OTP login (Firebase) — **test on real device, NOT simulator** (APNs unavailable on simulator)
- [ ] WhatsApp button on Customer Support → opens WhatsApp (validates `LSApplicationQueriesSchemes`)
- [ ] Workshop locator map loads + tappable pin shows phone confirm dialog (`telprompt:`)
- [ ] Razorpay test payment in Cart (use test card `4111 1111 1111 1111`)
- [ ] Push notification received when app backgrounded (validates `aps-environment=production` + APNs key + `UIBackgroundModes`)
- [ ] Tap https://myfng.in/booking/123 link in Notes app → opens app via Universal Link (validates AASA + entitlement)
- [ ] Photo upload from Customer Vehicles screen → camera permission prompt with correct usage string
- [ ] Logout → public home → re-login flow

### G. Common rejection reasons to pre-empt

1. **Guideline 5.1.1 (Data collection)** — privacy policy URL must be live and match your privacy manifest claims
2. **Guideline 4.0 (Design)** — buttons must have proper touch targets (44×44 pt minimum); ensure no Android-only UI patterns visible (e.g. floating action buttons that look out of place on iOS)
3. **Guideline 2.1 (Performance)** — app must launch within reasonable time, no crashes; test on iPhone 8 (oldest supported by iOS 15.1)
4. **Guideline 2.5.1 (Software Requirements)** — only use public APIs; you're fine here
5. **Account deletion** — Apple requires in-app account deletion (not just deactivation) since 2022. Verify `CustomerProfileScreen` has a "Delete Account" option that actually purges data
6. **Sign-in option** — if you offer Google/Apple/Facebook/email sign-in, you **must** also offer Sign in with Apple. Currently MyFNG uses email + Phone OTP, so this is OK (no third-party social login = no Apple sign-in requirement)

---

## Build & upload commands (Mac required)

```bash
cd apps/mobile

# 1. Install JS deps
npm install

# 2. Install CocoaPods (first time or after Pod changes)
cd ios && pod install --repo-update && cd ..

# 3. Open in Xcode
open ios/MyFNG.xcworkspace

# 4. In Xcode:
#    - Select "Any iOS Device" as destination (NOT simulator)
#    - Product → Archive
#    - Wait for archive (~5 min)
#    - In Organizer: Distribute App → App Store Connect → Upload
#    - Use automatic signing
#    - Symbols: include
#    - Wait for upload + processing
```

Or via CLI (Expo EAS Build, recommended for CI):

```bash
npm install -g eas-cli
eas login
eas build --platform ios --profile production
eas submit --platform ios --latest
```

(Requires `eas.json` configuration if not already present.)

---

## Quick parity table — Android vs iOS (after these fixes)

| Capability | Android | iOS |
|------------|---------|-----|
| Bundle/package id | `com.myfng.app` | `com.myfng.app` ✅ |
| Version name | 1.0.6 | 1.0.6 ✅ |
| Build/version code | 7 | 7 ✅ |
| Push notifications | FCM via `google-services.json` | APNs via `aps-environment=production` ✅ |
| Camera permission | `CAMERA` | `NSCameraUsageDescription` ✅ |
| Location | `ACCESS_FINE_LOCATION` + COARSE | `NSLocationWhenInUseUsageDescription` ✅ |
| Photo library | system picker | `NSPhotoLibraryUsageDescription` + Add ✅ |
| Notifications perm | `POST_NOTIFICATIONS` (A13+) | runtime via expo-notifications ✅ |
| Maps | `GOOGLE_MAPS_API_KEY` in manifest meta-data | `GMSApiKey` in Info.plist ✅ |
| Deep link custom scheme | `com.myfng.app://` intent filter | `com.myfng.app://` `CFBundleURLTypes` ✅ |
| Universal/App Links | https intent (no autoVerify) | `applinks:myfng.in` entitlement ✅ (needs AASA hosted) |
| WhatsApp/UPI app launch | `<queries>` block | `LSApplicationQueriesSchemes` ✅ |
| Background push | `POST_NOTIFICATIONS` always-deliver via channel | `UIBackgroundModes: remote-notification` ✅ |
| Code obfuscation | ProGuard + R8 enabled | not applicable (no obfuscation on iOS) |
| Privacy declaration | Play Console Data Safety form (manual) | `PrivacyInfo.xcprivacy` ✅ |

---

## Open items / nice-to-haves (not blocking submission)

- [ ] Migrate remaining staff-side `tel:` calls (workshop, telecaller, lead manager screens) to `openPhoneCall` helper for consistency — currently customer-facing screens are done
- [ ] Add iPad-specific screenshots if shipping for tablet
- [ ] Verify backend `customers` table has a `deleted_at TIMESTAMPTZ NULL` column. If absent, add it (otherwise the delete-account endpoint will silently fail on that field). SQL: `ALTER TABLE customers ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;`
- [ ] Set up EAS Build for CI/CD (currently manual Xcode archive)
- [ ] Add fastlane lane for App Store automation (optional)

---

**Generated:** Sunday, May 10, 2026 — initial App Store readiness pass for MyFNG iOS.
