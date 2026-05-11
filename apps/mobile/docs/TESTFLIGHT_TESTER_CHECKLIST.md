# MyFNG iOS — TestFlight Tester Smoke Test (Build 1.0.6.7)

> Yeh checklist testers ko share karo. Har item test karke ✅ ya ❌ mark karo aur feedback do.
> Build mein bahut customer-flow improvements aur ek **important Account Deletion fix** hai.

---

## Setup

1. TestFlight app install karo: [App Store link](https://apps.apple.com/app/testflight/id899247664)
2. Tester invite email se TestFlight ka link kholo OR public link [https://testflight.apple.com/join/UAcDBMKu](https://testflight.apple.com/join/UAcDBMKu) use karo
3. MyFNG install karo (build **1.0.6 (7)** hona chahiye — Settings ke About screen mein verify karo)
4. **Important**: Pehle se installed app ko delete karke fresh install karo (purana data clear ho jaye)

---

## Test 1: First launch & permissions

- [ ] App splash screen blue background pe MyFNG logo dikha
- [ ] Home screen properly load hua (carousel, packages, locator CTA)
- [ ] Notch/Dynamic Island ke neeche content properly fit ho raha hai
- [ ] Status bar text dark/dikh raha hai (light mode)

## Test 2: Phone OTP login (NEW iOS-friendly behavior)

- [ ] Login → "Continue with phone" → 10-digit number daalo
- [ ] OTP SMS aaya (within 60 sec)
- [ ] **iOS Messages app se OTP suggestion** keyboard ke upar dikha (auto-fill option)
- [ ] OTP daalkar verify hua, dashboard khula
- [ ] Logout karke phir login try karo — same flow

## Test 3: Email/password login (Supabase staff users — agar applicable hai)

- [ ] Email + password se login try karo (sirf staff testers ke liye)
- [ ] Successfully dashboard khula

## Test 4: Workshop locator (Maps + Phone call)

- [ ] Home se "Workshop Locator" tap karo
- [ ] Google Maps tiles load hue
- [ ] "Detect my location" tap → location permission dialog aaya — **Allow** karo
- [ ] Map mein workshops ki pin dikhi
- [ ] Kisi pin pe tap karo → callout open
- [ ] **"Call" button** tap karo → **iOS confirmation dialog "Call this number?" aaya** (yeh new behavior hai — pehle directly dial hota tha)
- [ ] Cancel kar do

## Test 5: WhatsApp button (NEW — pehle iOS pe broken tha)

- [ ] Settings → Help & Support OR Roadside Assistance screen pe WhatsApp button dhundo
- [ ] Tap karo → **WhatsApp app khul jaaye** (agar installed hai)
- [ ] Agar WhatsApp installed nahi → Safari mein wa.me link khule

## Test 6: Push notifications (NEW background mode)

- [ ] Login ke baad permission dialog aaya — **Allow** karo
- [ ] App ko background mein bhejo (home button / swipe up)
- [ ] Server se test notification trigger karo (admin team se request karo)
- [ ] Notification banner aaya
- [ ] Banner pe tap → app khula correct screen pe

## Test 7: Booking flow

- [ ] Home → "Book Service Now" OR Customer Dashboard → "Book Service"
- [ ] Service select karo
- [ ] Date picker tap → **iOS spinner wheel** dikha (Done button ke saath)
- [ ] Date select → Done tap → date set ho gayi
- [ ] Vehicle select / add → photo upload
- [ ] Camera permission allow → photo click → upload
- [ ] OR photo library se select → load hua
- [ ] Address enter → save → continue
- [ ] Final "Confirm" tap

## Test 8: Razorpay payment (test mode)

- [ ] Cart mein item add karo → Checkout
- [ ] Razorpay native bottom sheet khula
- [ ] **Test card**: `4111 1111 1111 1111`, expiry `12/25`, CVV `123`, OTP `1234`
- [ ] Payment success → order created
- [ ] OR UPI tap → GPay/PhonePe app launch ho (agar installed) — **NEW: pehle iOS pe yeh broken tha**

## Test 9: Track booking

- [ ] Existing order se "Track" tap karo
- [ ] Live map mein driver/pickup pin dikha
- [ ] Map smooth scroll ho raha hai

## Test 10: Customer Profile edits

- [ ] Profile → name/email/phone edit
- [ ] Save → success
- [ ] Reload screen → changes saved

## Test 11: Vehicle add (Camera + Photo library)

- [ ] My Vehicles → Add Vehicle
- [ ] RC photo upload tap → 2 options: Camera OR Library
- [ ] Camera tap → permission dialog (description "MyFNG needs access to your camera...") → Allow → photo lo
- [ ] Library tap → permission dialog → Allow → photo select
- [ ] Save vehicle → list mein dikha

## Test 12: ⚠️ CRITICAL — Account deletion (NEW!)

> **App Store ke liye yeh test sabse important hai. Pehle yeh button kuch nahi karta tha — ab actually delete karta hai.**

- [ ] Settings → Delete Account
- [ ] Warning screen padho — "Once you delete your account, there is no going back..."
- [ ] **Permanently Delete Account** button tap karo
- [ ] Confirmation dialog aaya — **Delete** tap karo
- [ ] Wait — API call hoga
- [ ] "Account Deleted" success alert dikha
- [ ] OK tap → Login screen pe wapas aaye
- [ ] Phir wahi phone number se login try karo → OTP toh aayega lekin profile blank/empty hona chahiye (purane data deleted)
- [ ] Verify in admin panel: customer record mein `deleted_at` set hai, full_name = "Deleted User", phone = "deleted_*"

## Test 13: Universal Links (agar AASA hosted hai)

> Yeh tab kaam karega jab AASA file `https://myfng.in/.well-known/apple-app-site-association` pe host kar di gayi ho.

- [ ] iPhone Notes app mein `https://myfng.in/booking/123` jaisa link likho
- [ ] Tap karo
- [ ] App khulna chahiye (Safari nahi)
- [ ] Agar Safari mein khul gaya → AASA properly host nahi hua

## Test 14: Hardware back / Navigation

- [ ] Customer Dashboard → multiple screens deep navigate karo
- [ ] **Edge swipe from left** se back jao → previous screen aaye
- [ ] App ke andar back arrows kaam kare

## Test 15: Logout

- [ ] Settings → Logout
- [ ] Confirmation → Yes
- [ ] Login screen pe aaye

---

## Crash report

iPhone 17 Pro (iOS 26.5) pe pichle build mein 1 crash aaya tha. Naye build mein:

- [ ] iPhone 17 Pro / latest iPhones pe pura flow chala — **koi crash nahi**
- [ ] Agar crash aaye, screenshot le ke aur "TestFlight Feedback" se report karo

---

## Issues / Feedback report karne ke liye

TestFlight app → MyFNG → bottom mein **"Send Beta Feedback"**

Issue likhte time include karo:
- iPhone model + iOS version
- Kis screen pe issue aaya
- Steps to reproduce
- Screenshot agar possible

---

## Build info

| Field | Value |
|---|---|
| Build | 1.0.6 (7) |
| Bundle ID | com.myfng.app |
| Min iOS | 15.1 |
| Target | iOS 17+ recommended |
| Test cards | Razorpay test mode card `4111 1111 1111 1111` |

**Test report deadline**: aap decide karo (recommended: 48 hours)
