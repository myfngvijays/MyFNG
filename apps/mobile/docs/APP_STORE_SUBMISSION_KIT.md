# MyFNG iOS — App Store Public Submission Kit

> **Use this document to fill App Store Connect "1.0 Prepare for Submission" page.**
> Har section ka content niche copy-paste ke liye ready hai.
> Build 7 (1.0.6) testFlight pe approved hai — wahi build production ke liye use hoga.

---

## NAVIGATION: App Store Connect → MyFNG → Distribution

Aapne pehle se yeh page kholi thi (yellow "1.0 Prepare for Submission" status). Wahi page step-by-step bharo:

```
appstoreconnect.apple.com → My Apps → MyFNG - Trusted Car Care → Distribution
```

---

## 1. Previews and Screenshots (REQUIRED)

⚠️ **Bina screenshots ke submit nahi hoga.** iPhone Simulator ya real device se 5+ screenshots lo.

### Required sizes

| Display | Pixels | Required? | Devices that match |
|---------|--------|-----------|---------------------|
| iPhone 6.9" | 1320×2868 | optional but recommended | iPhone 16 Pro Max, 17 Pro Max |
| **iPhone 6.7"** | **1290×2796** | **REQUIRED** if 6.9" not provided | iPhone 15 Pro Max, 14 Pro Max |
| iPhone 6.5" | 1242×2688 | optional fallback | iPhone 11 Pro Max |
| iPhone 5.5" | 1242×2208 | only if shipping iOS < 13 | retired |
| **iPad 12.9" (3rd gen+)** | **2048×2732** | **REQUIRED** because `supportsTablet=true` | iPad Pro 12.9 |
| iPad 13" | 2064×2752 | recommended | iPad Pro M4 |

### Recommended screenshot order (most impactful first)

1. **Hero / Home screen** — "Book your car service in 60 seconds"
2. **Workshop locator with map** — "Find trusted workshops near you"
3. **Booking flow** — "Choose date, time, and pickup"
4. **Live tracking** — "Track your car service in real-time"
5. **Roadside Assistance** — "24/7 emergency help — battery, towing, fuel"

### How to capture (iPhone Simulator)

```bash
# Run app in iPhone 15 Pro Max simulator from Xcode
# Then in simulator: File → Save Screen (Cmd+S)
# Or: xcrun simctl io booted screenshot myfng-1.png
```

For iPad screenshots: change simulator to **iPad Pro (12.9-inch) (6th generation)** and repeat.

---

## 2. Promotional Text (170 chars max)

> Updateable without resubmission. Use for current offer / season.

```
Book trusted car service & roadside assistance across India. Live tracking, doorstep pickup, expert mechanics. New users get 10% off first service!
```

(150 chars — well within limit)

---

## 3. Description (4000 chars max)

```
MyFNG — Trusted Car Care, Right at Your Doorstep

India's most reliable car service platform. From routine maintenance to 24/7 roadside assistance, MyFNG connects you with expert mechanics, certified workshops, and instant emergency help — all from one app.

★ WHY CHOOSE MYFNG?

✓ DOORSTEP CAR SERVICE — Book a service, we'll pick up your car, service it at a certified workshop, and deliver it back home. No driving to the workshop. No haggling.

✓ TRANSPARENT PRICING — Pre-approved estimates before any work begins. See what you're paying for. No hidden charges. No surprise bills.

✓ LIVE TRACKING — Real-time updates from pickup to delivery. Photos before & after every service. Talk to your mechanic anytime.

✓ 24/7 ROADSIDE ASSISTANCE
  • Battery jumpstart
  • Flat tyre / puncture fix
  • Fuel delivery (petrol & diesel)
  • Towing service
  • Accident vehicle recovery
  • On-road minor repairs
  • Live location-based dispatch

✓ CERTIFIED WORKSHOPS — Every workshop on MyFNG is verified, rated, and audited. Your car is in trusted hands.

★ KEY FEATURES

• AI-powered service recommendations based on your vehicle
• Service history & digital invoices for every visit
• Wallet & rewards program for loyal customers
• Membership plans with unlimited roadside assistance
• Multi-vehicle support — manage your entire family's cars
• Refer & earn — get cashback when friends sign up
• Secure payments via Razorpay (UPI, cards, netbanking)
• Photo proof of every service step
• Real ratings from verified customers
• Multi-language support

★ FOR ALL CAR BRANDS

Maruti Suzuki • Hyundai • Tata • Mahindra • Honda • Toyota • Kia • Renault • Skoda • Volkswagen • Ford • BMW • Mercedes-Benz • Audi • and many more.

★ SERVICES OFFERED

• Periodic / scheduled maintenance
• Oil & filter change
• Brake service
• Wheel alignment & balancing
• AC service & gas refill
• Battery replacement
• Tyre service & rotation
• Detailing & polishing
• Insurance claim support
• Custom mechanical work

★ WHO IS MYFNG FOR?

• Car owners who want hassle-free servicing without driving to a workshop
• Frequent travellers who need 24/7 roadside backup
• Fleet owners managing multiple vehicles
• Anyone who values transparent pricing and verified workshops

★ SAFETY & TRUST

Your car, your data, your privacy — all protected. We use industry-standard encryption and never share your information with third parties without consent. Account deletion is available right within the app at any time.

★ COVERAGE

Currently serving major Indian cities and expanding rapidly. Check serviceability in-app for your location.

Download MyFNG today and never worry about car service again.

Need help? Email support@myfng.in or call +91 91523 07030.
Website: https://myfng.in
```

(~3500 chars — leaves room for tweaks)

---

## 4. Keywords (100 chars max, comma-separated, no spaces after commas)

```
car service,roadside assistance,car repair,workshop,mechanic,towing,RSA,car wash,booking,auto care
```

(99 chars — perfect)

> **Tip:** "MyFNG" is auto-counted from the app name, don't waste keywords on it.

---

## 5. Support URL (REQUIRED)

```
https://myfng.in/contact-us
```

✅ **Verified live** — same URL as Android Play Store submission. Reuse confirmed.

---

## 6. Marketing URL (optional)

```
https://myfng.in
```

✅ **Verified live**

---

## 7. Privacy Policy URL (REQUIRED — Apple won't submit without this)

```
https://myfng.in/privacy-policy
```

✅ **Verified live** — same URL as Android Play Store submission. Apple aur Google dono is URL ko accept karte hain.

Yeh privacy policy already include karti hai:
- Konsa data collect hota hai (Name, Phone, Email, Location, Photos, Payment Info, User ID, Crash Data)
- Kis purpose ke liye (App functionality, Authentication, Analytics, Personalization)
- User account delete karke data hata sakta hai
- Contact email: support@myfng.in

---

## 7b. Terms & Conditions URL (optional but referenced in app)

```
https://myfng.in/terms-and-conditions
```

✅ **Verified live**

---

## 8. App Review Information

> Yeh sirf Apple reviewers dekhte hain, public ko nahi.

### Sign-in required: **YES**

### Demo Account:

```
Username (phone): +91 9999900007
Password (OTP):    777777
```

⚠️ **Backend mein abhi yeh test number whitelist karna hoga** — taaki reviewers ko OTP `777777` accept ho jaye SMS bheje bina.

Agar test backdoor banana mushkil hai, toh yeh reviewer ko bata do (notes mein):

```
Reviewer can request OTP via WhatsApp/SMS to the number above by tapping
"Send OTP" — please contact support@myfng.in if OTP doesn't arrive within
60 seconds and we'll provide a fresh code immediately.
```

(Apple usually accepts this if responsive)

### Contact Information

```
First name:    [Your First Name]
Last name:     [Your Last Name]
Phone:         +91 91523 07030
Email:         support@myfng.in
```

### Notes (CRITICAL — copy-paste this)

```
MyFNG is a car servicing and roadside assistance platform for Indian customers.

DEMO ACCOUNT
- Phone: +91 9999900007
- OTP: 777777 (test bypass enabled in backend)

Alternative: any Indian mobile number can be used; OTP will arrive via SMS within 60 seconds. Please contact support@myfng.in if any issue.

KEY FLOWS TO TEST
1. Phone OTP login → Customer Dashboard
2. Browse "Book Service" → select package → date → address → confirm (Razorpay test card 4111 1111 1111 1111, exp 12/25, CVV 123, OTP 1234)
3. Workshop locator → tap "Detect my location" → tap workshop pin → "Call" (telprompt confirm dialog will appear)
4. Settings → Delete Account → Permanently Delete Account → Delete (REAL deletion as per Guideline 5.1.1(v))
5. Push notifications enabled — admin can trigger test push to your token

NOTES ON DATA COLLECTION
All data types listed in App Privacy match the embedded PrivacyInfo.xcprivacy. We collect only what is needed to provide the service: name, phone (for OTP/contact), email (optional), precise location (workshop search & ETAs), photos (vehicle inspection), payment info (handled by Razorpay PCI-DSS, no card storage), user ID (Supabase), crash data (Sentry-style, anonymized).

NO TRACKING. We do not track users across other apps or websites.

UNIVERSAL LINKS
The app declares applinks:myfng.in via associated-domains entitlement. AASA file is hosted at https://myfng.in/.well-known/apple-app-site-association.

PAYMENT
Razorpay processes all payments. We are PCI-DSS compliant via Razorpay. No card details are stored on our servers or in the app.

ACCOUNT DELETION
Available at: Settings → Delete Account → Permanently Delete Account.
This anonymizes all PII (name, email, phone) and disables the account.
Required by Guideline 5.1.1(v).

ROADSIDE ASSISTANCE
Some screens show "24/7 Roadside Assistance" with a call button. The button uses telprompt:// (iOS confirm) and only initiates a call after user confirmation.

THIRD-PARTY SERVICES
- Supabase (backend)
- Firebase Auth (Phone OTP)
- Razorpay (payments)
- Google Maps (location)
- Expo Notifications + APNs (push)

LANGUAGES
English (primary), Hindi.

Thank you for reviewing!
```

---

## 9. Version Information

### What's New in This Version (4000 chars max — release notes)

```
First public release of MyFNG!

★ Welcome to MyFNG — Trusted Car Care
We're thrilled to bring India's most reliable car servicing platform to your iPhone.

★ Book Service in 60 Seconds
• Doorstep pickup & delivery
• Certified workshops near you
• Live tracking with photo proof
• Transparent pricing with pre-approved estimates

★ 24/7 Roadside Assistance
• Battery jumpstart
• Flat tyre fix
• Fuel delivery
• Towing
• On-road repairs

★ Secure & Private
• Bank-grade encryption
• Real account deletion right in the app
• No third-party tracking

★ For All Car Brands
Maruti, Hyundai, Tata, Mahindra, Honda, Toyota, Kia, Renault, Skoda, VW, Ford, and luxury brands.

Got feedback? Write to us at support@myfng.in.
Drive safe!
— The MyFNG Team
```

### Build

- Click **"Select a Build before You Submit Your App"** → choose **Build 7 (1.0.6)** ← the TestFlight-tested one
- Save

### Copyright

```
© 2026 MY FNG AUTOCARE PRIVATE LIMITED
```

### Routing App Coverage File — leave blank (not a navigation app)

---

## 10. App Privacy questionnaire

> Left sidebar → **App Privacy** → "Edit" / "Get Started"

Answer **YES** to "Does your app collect data?" (because PrivacyInfo.xcprivacy declares it). Then for each data type, answer:

| Data Type | Collected? | Linked to user? | Used for tracking? | Purposes |
|-----------|-----------|-----------------|---------------------|----------|
| **Contact Info → Name** | Yes | Yes | No | App Functionality |
| **Contact Info → Email Address** | Yes | Yes | No | App Functionality, Customer Support |
| **Contact Info → Phone Number** | Yes | Yes | No | App Functionality, Customer Support |
| **Contact Info → Physical Address** | Yes | Yes | No | App Functionality (pickup address) |
| **Location → Precise Location** | Yes | Yes | No | App Functionality, Product Personalization |
| **Identifiers → User ID** | Yes | Yes | No | App Functionality, Authentication |
| **User Content → Photos or Videos** | Yes | Yes | No | App Functionality |
| **Financial Info → Payment Info** | Yes | Yes | No | App Functionality |
| **Diagnostics → Crash Data** | Yes | No | No | App Functionality, Analytics |
| **Diagnostics → Performance Data** | Yes | No | No | Analytics |
| **Usage Data → Product Interaction** | (skip if not analyzing) | — | — | — |

⚠️ **Tracking → "Used to track users?"** = **NO** for everything. (We don't share data with data brokers or use it for advertising across other apps.)

After filling, click **Publish** at top right.

---

## 11. App Information (left sidebar → App Information)

| Field | Value |
|---|---|
| **Subtitle** (30 chars) | `Trusted Car Care & Roadside` |
| **Category** (Primary) | `Auto & Vehicles` |
| **Category** (Secondary) | `Lifestyle` (or `Travel`) |
| **Content Rights** | "Does your app contain, show, or access third-party content?" → **No** (you're not displaying others' copyrighted material) |
| **Age Rating** | Click "Edit" → answer all "None" → result will be **4+** |
| **Made for Kids** | No |

---

## 12. Pricing & Availability (left sidebar)

| Field | Value |
|---|---|
| Price | **Free** (₹0) |
| Availability | Select **All Countries and Regions** OR specifically **India** + neighbors |
| Pre-orders | No |

---

## 13. Final review & submission

After filling everything above, top-right corner pe **"Add for Review"** ya **"Submit for Review"** button green ho jayega.

1. Click **"Add for Review"**
2. Apple's **3 export compliance questions**:
   - Does your app use encryption? → **No** (since `ITSAppUsesNonExemptEncryption = false`)
   - Idea Standard ITC question — answer **No**
3. Content rights & advertising identifier → **No** to both
4. Click **Submit to App Review**

✅ Status changes from **"Prepare for Submission"** → **"Waiting for Review"** → **"In Review"** → **"Pending Developer Release"** OR **"Ready for Sale"**

⏱️ Timeline: 24-48 hours typical, sometimes <24h. Rejections within 24h with reason.

---

## 14. Common rejection reasons (pre-empt these)

| Issue | Status | Mitigation |
|-------|--------|-------------|
| Privacy policy URL not live | ❌ Critical | Host before submitting |
| Demo account doesn't work | ❌ Critical | Whitelist test phone OR ensure SMS works |
| Account deletion doesn't actually delete | ❌ Critical | ✅ Already fixed in build 7 |
| Crashes on launch | ❌ | Tested on TestFlight already |
| Misleading screenshots | ⚠️ | Use real app UI, not mockups |
| App seems unfinished | ⚠️ | Make sure all main flows work |
| Missing features described | ⚠️ | Don't promise what app doesn't deliver |
| Sign in with Apple not offered (with social login) | N/A | We use phone OTP — exempt |

---

## 15. Post-submission monitoring

- Check App Store Connect → **Activity** tab daily
- Email notifications: `noreply@email.apple.com`
- Status meaning:
  - 🟡 **Waiting for Review** — in queue (~24h)
  - 🟢 **In Review** — actively reviewing (4-12h)
  - ✅ **Pending Developer Release** — approved! Click "Release" when ready
  - ✅ **Ready for Sale** — live on App Store within 1 hour
  - ❌ **Rejected** — read reason in "Resolution Center", fix, re-submit

---

## 16. After approval — Release options

### Manual release (recommended for first launch)
- ✅ Approved → Status: **Pending Developer Release**
- Wait until you're ready (e.g. announce on social media)
- Click **Release This Version** → live in 1-24 hours

### Automatic release
- Set in advance: "Automatically release this version" → goes live immediately on approval

### Phased release (recommended for production updates)
- 7-day phased rollout: 1% → 2% → 5% → 10% → 20% → 50% → 100% of users
- Allows you to monitor crashes and pull build if issues found

---

## 17. AASA (Universal Links) — host before launch

Don't forget to host these JSON files on your domain BEFORE the app goes live (otherwise Universal Links won't work for end users):

```
https://myfng.in/.well-known/apple-app-site-association
https://www.myfng.in/.well-known/apple-app-site-association
https://myfng.astric.ai/.well-known/apple-app-site-association
```

Content (no extension, `Content-Type: application/json`):

```json
{
  "applinks": {
    "details": [
      {
        "appIDs": ["JUN6TX4JD3.com.myfng.app"],
        "components": [
          { "/": "/customer/*" },
          { "/": "/booking/*" },
          { "/": "/track/*" },
          { "/": "/invoice/*" },
          { "/": "/order/*" },
          { "/": "/refer/*" }
        ]
      }
    ]
  }
}
```

Validate after deploy:
```
https://branch.io/resources/aasa-validator/?domain=myfng.in
```

---

## DONE checklist

Before clicking "Submit to App Review", verify:

- [ ] Screenshots uploaded for iPhone 6.7" (and iPad if `supportsTablet=true`)
- [ ] Description, keywords, promotional text filled
- [x] **Support URL live** — `https://myfng.in/contact-us` ✅ (HTTP 200, same as Android)
- [x] **Privacy Policy URL live** — `https://myfng.in/privacy-policy` ✅ (HTTP 200, same as Android)
- [x] **Marketing URL live** — `https://myfng.in` ✅ (HTTP 200)
- [ ] Demo account phone + OTP works (verify with reviewer-style test)
- [ ] App Privacy questionnaire submitted
- [ ] Age rating filled (4+)
- [ ] Category set (Auto & Vehicles)
- [ ] Pricing set (Free, India)
- [ ] Build 7 selected
- [ ] What's New release notes
- [ ] Copyright text
- [ ] Reviewer notes copied
- [ ] AASA file hosted ⚠️ (recommended but not strictly blocking)

---

**Generated**: Sunday, May 10, 2026 — production submission package for MyFNG iOS 1.0.
