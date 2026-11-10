# نشر اللعبة على App Store — بدون ماك

كل شي جاهز في المشروع. الباقي خطوات في حساباتك أنت (ما أقدر أسويها عنك).
الوقت المتوقع: ساعة إلى ساعتين + انتظار موافقة أبل.

---

## 0) قبل أي شي (مرة وحدة)
1. **Supabase → SQL Editor:** شغّل `supabase-migration-v2.sql` ثم `supabase-migration-v3-cleanup.sql`.
2. **إيميل التواصل:** عدّل `CONTACT_EMAIL` في `app/privacy/page.jsx` لإيميل تبيه يظهر للناس.
3. **ارفع الكود:** ادمج فرع `enhancements` في `master` وسوّ push → Vercel ينشر الموقع.
   تأكد إن هذا يفتح: `https://arabic-word-game.vercel.app/privacy`
   (لو رابط موقعك مختلف، عدّل `NEXT_PUBLIC_SITE_URL` في `codemagic.yaml`.)

## 1) حساب مطوّر أبل ($99 بالسنة)
- سجّل في https://developer.apple.com/programs/enroll — بحساب Apple ID حقك (نفس اللي في جوالك).
- اختر **Individual**. الموافقة عادة من يوم إلى يومين.

## 2) أنشئ التطبيق في App Store Connect
1. https://appstoreconnect.apple.com ← **Apps** ← **+** ← **New App**
2. Platform: **iOS** — Name: **لعبة الكلمات** — Primary language: **Arabic**
3. Bundle ID: اضغط "Register a new bundle ID" وحط **`com.yousifalbrahim.kalimat`** (لازم يطابق بالضبط)
4. SKU: أي شي، مثلاً `kalimat-001`
5. بعد الإنشاء: **App Information → Apple ID** (رقم طويل) — انسخه وحطه مكان `0000000000` في `codemagic.yaml` (`APP_STORE_APP_ID`).

## 3) مفتاح API عشان Codemagic يرفع عنك
1. App Store Connect ← **Users and Access** ← **Integrations** ← **App Store Connect API** ← **+**
2. Name: `Codemagic` — Access: **App Manager**
3. حمّل ملف **.p8** (ينحمّل مرة وحدة بس! احفظه)، وانسخ **Issuer ID** و **Key ID**.

## 4) Codemagic (الماك السحابي)
1. سجّل في https://codemagic.io بحساب GitHub، واختر الريبو `arabic-word-game`.
2. **Team settings → Team integrations → Developer Portal → Manage keys → Add key**
   - الاسم لازم يكون بالضبط: **`Kalimat ASC key`**
   - ارفع ملف .p8 وحط Issuer ID و Key ID.
3. **Code signing identities → iOS certificates → Generate certificate** (نوع Apple Distribution) — Codemagic يسويه عنك.
   ثم **iOS provisioning profiles → Fetch profiles** واختر App Store للـ bundle id.
4. افتح التطبيق في Codemagic ← **Start new build** ← workflow: **iOS → TestFlight** ← فرع `master`.
5. البناء ياخذ ~15 دقيقة. لو نجح، يوصلك إيميل من أبل إن البناء في TestFlight.
   (الخطة المجانية فيها 500 دقيقة بالشهر — تكفي.)

## 5) جرّبه على جوالك (TestFlight)
- حمّل تطبيق **TestFlight** من المتجر.
- App Store Connect ← التطبيق ← **TestFlight** ← Internal Testing ← أضف نفسك. يوصلك دعوة.
- جرّب كل الألعاب، والاهتزاز، والمشاركة، والدعوة.

## 6) قدّم للمراجعة
App Store Connect ← التطبيق ← نسخة 1.0:
- **الصور:** ارفع الملفات في `store/screenshots/` (مقاس 6.9" — أبل تصغّرها للباقي تلقائياً).
- **النصوص:** انسخها من `store/listing.md` (الوصف، الكلمات المفتاحية، الخصوصية، ملاحظات المراجع).
- **Build:** اختر البناء اللي وصل من Codemagic.
- **Pricing:** Free.
- اضغط **Add for Review** ← **Submit**. المراجعة عادة 1–3 أيام.

---

## تحديثات لاحقة
عدّل الكود ← ارفعه لـ master ← في Codemagic اضغط Start new build (أو سوّ tag مثل `v1.1.0`).
رقم البناء يزيد تلقائياً. لما تبي نسخة جديدة للمتجر غيّر `MARKETING_VERSION` في
`ios/App/App.xcodeproj/project.pbxproj` (مثلاً 1.1).

## بناء نسخة التطبيق محلياً (اختياري للتجربة)
```
npm run build:app     # يبني out/ وينسخها لمشروع iOS
```

## لو رفضت أبل
- **4.2 (Minimum functionality):** التطبيق فيه ألعاب فردية تشتغل بدون نت + اهتزاز + مشاركة أصلية — رد عليهم بهذا.
- **5.1.1 (Privacy):** تأكد إن رابط الخصوصية يفتح وفيه إيميل حقيقي.
- أرسل لي نص الرفض وأساعدك بالتعديل.
