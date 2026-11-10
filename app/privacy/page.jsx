export const metadata = {
  title: 'سياسة الخصوصية — لعبة الكلمات',
  description: 'Privacy policy for لعبة الكلمات (Arabic Word Game)',
};

const UPDATED = '10 نوفمبر 2026';
// TODO قبل النشر: حط إيميل التواصل اللي تبيه يظهر للناس
const CONTACT_EMAIL = 'contact@example.com';

export default function PrivacyPage() {
  return (
    <main className="min-h-dvh safe-screen px-5 py-8" style={{ background: '#f5f3ff', color: '#2e1065' }}>
      <div className="max-w-xl mx-auto space-y-8 leading-relaxed">
        <section dir="rtl" className="space-y-3">
          <h1 className="font-display font-black text-3xl">سياسة الخصوصية</h1>
          <p className="text-sm opacity-70">آخر تحديث: {UPDATED}</p>
          <p>«لعبة الكلمات» لعبة كلمات عربية. خصوصيتك مهمة لنا، وهذا ملخص بسيط لكل اللي نتعامل معه:</p>
          <ul className="list-disc pr-5 space-y-2">
            <li><b>بدون حسابات:</b> ما نطلب تسجيل دخول ولا بريد ولا رقم جوال.</li>
            <li><b>الاسم اللي تكتبه:</b> يظهر لصاحبك داخل غرفة اللعب فقط. تقدر تكتب أي اسم مستعار.</li>
            <li><b>غرف اللعب أونلاين:</b> نحفظ مؤقتاً حالة الغرفة (الأسماء والكلمات والنتيجة) على خادم Supabase حتى تتزامن اللعبة بين الجوالين، وتنحذف الغرف القديمة تلقائياً.</li>
            <li><b>على جهازك فقط:</b> اسمك المحفوظ، أفضل نتائجك، وإحصائيات «خمّن الكلمة» تنحفظ في جهازك ولا ترسل لأحد.</li>
            <li><b>لا إعلانات ولا تتبّع:</b> ما نستخدم أي أدوات إعلانات أو تحليلات أو تتبّع، وما نبيع أو نشارك أي بيانات.</li>
            <li><b>الأطفال:</b> اللعبة مناسبة لكل الأعمار ولا تجمع بيانات شخصية.</li>
          </ul>
          <p>لأي سؤال: <a className="underline font-bold" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></p>
        </section>

        <hr className="border-[#ddd6fe]" />

        <section dir="ltr" className="space-y-3 text-left">
          <h2 className="font-black text-2xl">Privacy Policy</h2>
          <p className="text-sm opacity-70">Last updated: November 10, 2026</p>
          <ul className="list-disc pl-5 space-y-2">
            <li><b>No accounts:</b> we never ask for sign-in, email or phone number.</li>
            <li><b>Your display name</b> is only shown to the other player in your game room. Any nickname works.</li>
            <li><b>Online rooms:</b> the room state (names, words, score) is stored temporarily on Supabase so both phones stay in sync; old rooms are deleted automatically.</li>
            <li><b>On-device only:</b> your saved name, best scores and word-guess statistics stay on your device.</li>
            <li><b>No ads, analytics or tracking.</b> We do not sell or share any data.</li>
          </ul>
          <p>Contact: <a className="underline font-bold" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></p>
        </section>
      </div>
    </main>
  );
}
