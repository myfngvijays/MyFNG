-- MyFNG Call IQ sales SOP, written as lines a telecaller can read on a call.
-- Source: apps/web/src/lib/telecaller/salesPlaybookDefaults.ts (DEFAULT_CALL_IQ_PROMPT).
-- Safe to re-run: skips a title that is already in telecaller_scripts.

INSERT INTO public.telecaller_scripts (script_type, script_title, script_content, language, category, is_active)
SELECT v.script_type, v.script_title, v.script_content, v.language, v.category, true
FROM (
  VALUES
    (
      'OPENING',
      'MyFNG Call IQ · Opening',
      $s$Namaste sir/madam, main MY FNG se bol raha hoon. Hum Mumbai, Navi Mumbai aur Thane mein 50 se zyada verified A-grade partner workshops ke through car service karte hain. Yeh workshops company ke nahi hain, verified partner network hain. Aapki gaadi ki service ke baare mein baat kar sakta hoon?$s$,
      'hi',
      'GREETING'
    ),
    (
      'OPENING',
      'MyFNG Call IQ · Opening (English)',
      $s$Hello sir/madam, this is MY FNG. We connect car owners in Mumbai, Navi Mumbai and Thane with 50+ verified A-grade partner workshops. These workshops are a partner network, not company-owned. May I talk about your car service?$s$,
      'en',
      'GREETING'
    ),
    (
      'QUALIFICATION',
      'MyFNG Call IQ · 4 questions',
      $s$Plan suggest karne se pehle yeh 4 cheezein poochho:
1. Aap kis location se hain?
2. Car ka make aur model kya hai?
3. Last service kab hui thi?
4. Service aaj chahiye, is hafte, ya baad mein?

Service type bhi confirm karo: periodic, repair, engine, AC, brake, denting ya painting.$s$,
      'hi',
      'INFORMATION_GATHERING'
    ),
    (
      'QUALIFICATION',
      'MyFNG Call IQ · Registration before price',
      $s$Price batane se pehle registration number lo. Saath mein make, model, fuel type aur year confirm karo. Number ke bina generic price mat do. Estimate usi car ka do.$s$,
      'hi',
      'INFORMATION_GATHERING'
    ),
    (
      'QUALIFICATION',
      'MyFNG Call IQ · Registration before price (English)',
      $s$Before any price, take the registration number, plus make, model, fuel type and year. Do not quote a generic number. Give the estimate for that car.$s$,
      'en',
      'INFORMATION_GATHERING'
    ),
    (
      'USP_PITCH',
      'MyFNG Call IQ · Pitch',
      $s$Pehle zarurat suno, phir plan suggest karo. Push mat karo.
Packages: General, Premium, Platinum, ya custom repair.

USPs:
- Free pickup aur drop
- Kaam ke photo aur video
- Sirf OEM ya OES spare parts
- Transparent pricing, koi hidden charge nahi
- Warranty: 3 mahine ya 1,000 km
- Jahan possible ho, same-day service
- 6 mahine ya 5,000 km ke andar free inspection aur top-up$s$,
      'hi',
      'INFORMATION_GATHERING'
    ),
    (
      'USP_PITCH',
      'MyFNG Call IQ · Pitch (English)',
      $s$Ask what they need first, then suggest General, Premium, Platinum, or a custom repair. Do not push.
USPs: free pickup and drop, photo and video of the work, OEM or OES parts only, transparent pricing with no hidden charges, warranty of 3 months or 1,000 km, same-day service where possible, and a free inspection plus top-up within 6 months or 5,000 km.$s$,
      'en',
      'INFORMATION_GATHERING'
    ),
    (
      'PICKUP_CONFIRMATION',
      'MyFNG Call IQ · Pickup or visit',
      $s$Kya hum aapki gaadi aapke location se free pickup kar lein, aur service ke baad drop kar dein? Aap chahein toh khud workshop visit bhi kar sakte hain. Aapko kya theek rahega, pickup ya visit?$s$,
      'hi',
      'INFORMATION_GATHERING'
    ),
    (
      'WORKSHOP',
      'MyFNG Call IQ · Workshop aapka hai?',
      $s$Agar customer pooche "workshop aapka hai?":
"Nahi sir/madam. MY FNG workshops own nahi karta. Hum verified A-grade partner workshops ke through service karte hain."

Kabhi mat bolo: humare workshop, apne workshop, ya our own workshop.$s$,
      'hi',
      'OBJECTION_HANDLING'
    ),
    (
      'CLOSING',
      'MyFNG Call IQ · Booking close',
      $s$Kya main aapka slot book kar dun? Weekend slots jaldi bhar jaate hain, weekday pe time better milta hai. Pickup chahiye ya aap visit karenge? Confirm ho jaaye toh booking pakki kar do.$s$,
      'hi',
      'CLOSING'
    ),
    (
      'CLOSING',
      'MyFNG Call IQ · Booking close (English)',
      $s$Shall I book your slot? Weekend slots fill up fast, and weekdays are easier. Do you want pickup, or will you visit the workshop? Once they agree, confirm the booking.$s$,
      'en',
      'CLOSING'
    ),
    (
      'REJECTION_HANDLING',
      'MyFNG Call IQ · Objections',
      $s$"Soch ke batata hoon."
Price hai, trust hai, ya time? Registration number pe exact estimate de sakta hoon, ya ek weekday slot hold kar dun.

"Apne mechanic ko bolunga."
Local garage guesswork karta hai. Yahan photo-video, warranty, OEM/OES parts aur pickup milta hai. Compare karke decide kar lijiye.

"Sirf price dekh raha hoon."
Generic number galat padta hai. Registration ya make-model dijiye, usi car ka estimate deta hoon.

"Gaadi theek chal rahi hai."
Time pe service badi repair se bachati hai. Inspection aur top-up bhi cover rehta hai.

"Time nahi hai."
Free pickup aur drop hai. Aapko workshop aane ki zarurat nahi.

"Agle mahine karunga."
Last service kab hui thi? Delay se kharcha badh sakta hai. Date abhi fix kar dete hain.$s$,
      'hi',
      'OBJECTION_HANDLING'
    ),
    (
      'REJECTION_HANDLING',
      'MyFNG Call IQ · Objections (English)',
      $s$"I'll think about it."
Ask if it is price, trust, or timing. Offer an estimate on the registration number, or hold a weekday slot.

"I'll call my regular mechanic."
A local garage is guesswork. Here they get photos and videos, warranty, OEM/OES parts, and pickup. Let them compare.

"I'm just checking prices."
A generic number is wrong. Take the registration or make and model, then quote that car.

"My car is running fine."
A service on time avoids a bigger repair. Inspection and top-up are included.

"I don't have time."
Free pickup and drop. They do not have to visit the workshop.

"I'll do it next month."
Ask the last service date. Delay can cost more. Fix the date now.$s$,
      'en',
      'OBJECTION_HANDLING'
    ),
    (
      'FOLLOW_UP',
      'MyFNG Call IQ · Follow-up',
      $s$Hello sir/madam, MY FNG se bol raha hoon. Aapki gaadi ki service pending thi. Aaj ya is hafte slot nikalun, ya aap baad mein workshop visit karna chahenge?$s$,
      'hi',
      'FOLLOW_UP'
    )
) AS v(script_type, script_title, script_content, language, category)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.telecaller_scripts t
  WHERE t.script_title = v.script_title
);
