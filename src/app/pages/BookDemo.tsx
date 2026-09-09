import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { ArrowLeft, ArrowRight, BarChart3, CalendarCheck, Check, CheckCircle2, FileScan, Loader2, Mail, ShieldCheck, Sparkles } from 'lucide-react';
import { POS_PROVIDERS } from '../data/posProviders';
import { usePageSeo } from '../utils/seo';
import { ZestIQBrand } from '../components/ZestIQBrand';

const fieldClass = 'mt-1 h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-[#B58B00] focus:ring-4 focus:ring-[#F5D62E]/15';

export function BookDemo() {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  usePageSeo({ title: 'Book a ZestIQ Restaurant Software Demo', description: 'Book a tailored ZestIQ demo for restaurant inventory, food cost, invoice scanning, purchasing, beverage and labour workflows.', path: '/book-demo' });
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setSubmitError('');
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());
    try {
      const response = await fetch('/api/send-demo-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result?.error || 'We could not send your request. Please try again.');
      navigate('/book-demo/thank-you', { replace: true });
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'We could not send your request. Please try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#F4F1E9] px-4 py-4 text-[#303A43] sm:px-7 sm:py-7">
      <div className="mx-auto grid max-w-[1440px] gap-3 lg:min-h-[calc(100vh-3.5rem)] lg:grid-cols-[0.98fr_1.02fr]">
        <section className="rounded-[28px] bg-white p-6 shadow-sm sm:p-10 lg:p-12">
          <Link to="/" className="inline-flex items-center gap-2 text-sm font-black underline decoration-1 underline-offset-4"><ArrowLeft className="h-4 w-4" />Back to the website</Link>
          <Link to="/" aria-label="ZestIQ home" className="mt-10 inline-flex rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F5D62E]"><ZestIQBrand className="gap-3" markClassName="h-14 w-14 rounded-none bg-transparent" wordmarkClassName="text-3xl" /></Link>
          <h1 className="mt-7 text-4xl font-black leading-[0.98] tracking-[-0.04em] sm:text-5xl">See ZestIQ in action.</h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-slate-500">Tell us a little about your operation. We’ll tailor the conversation around the workflows and margin opportunities that matter to you.</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <label className="absolute -left-[10000px] h-px w-px overflow-hidden" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
            <div className="grid gap-4 sm:grid-cols-2"><Field label="First name" name="firstName" autoComplete="given-name" /><Field label="Last name" name="lastName" autoComplete="family-name" /></div>
            <Field label="Work email" name="email" type="email" autoComplete="email" />
            <Field label="Phone number" name="phone" type="tel" autoComplete="tel" />
            <Field label="Restaurant or company" name="restaurant" autoComplete="organization" />
            <SelectField label="Role" name="role" options={['Owner / CEO', 'Operations', 'Finance', 'Chef / Culinary', 'General manager', 'Other']} />
            <SelectField label="Current POS system" name="pos" options={POS_PROVIDERS.filter(item => item.id !== 'generic').map(item => item.name).concat('Other / Not listed', 'No POS yet')} />
            <SelectField label="Number of venues" name="venues" options={['1 venue', '2–5 venues', '6–15 venues', '16–50 venues', '51+ venues']} />
            <label className="block"><span className="text-xs font-black text-slate-700">What is your main goal? <span className="text-red-500">*</span></span><textarea required name="goal" rows={4} placeholder="Reduce food cost, speed up counts, control labour, improve ordering…" className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-[#B58B00] focus:ring-4 focus:ring-[#F5D62E]/15" /></label>
            {submitError && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{submitError}</div>}
            <button type="submit" disabled={isSubmitting} className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#303A43] px-6 font-black text-white transition hover:bg-[#172238] disabled:cursor-wait disabled:opacity-70">{isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}{isSubmitting ? 'Sending request…' : 'Request my demo'}{!isSubmitting && <ArrowRight className="h-4 w-4" />}</button>
            <p className="text-center text-[11px] leading-5 text-slate-400">Your inquiry will be sent securely to demo@zestiq.ca. By continuing, you acknowledge our <Link to="/privacy" className="font-bold text-slate-600 underline underline-offset-2">Privacy Policy</Link> and <Link to="/terms" className="font-bold text-slate-600 underline underline-offset-2">Terms of Service</Link>.</p>
          </form>
        </section>

        <section className="flex flex-col gap-3">
          <div className="relative flex min-h-[520px] flex-1 overflow-hidden rounded-[28px] bg-[#F5D62E] p-7 sm:p-10 lg:p-12">
            <div className="relative z-10 flex w-full flex-col">
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-black/10 bg-white/50 px-3 py-2 text-xs font-black uppercase tracking-[0.16em]"><Sparkles className="h-4 w-4" />Built for restaurant operators</div>
              <h2 className="mt-7 max-w-2xl text-4xl font-black leading-[0.98] tracking-[-0.04em] sm:text-5xl xl:text-6xl">A clearer operation starts with one useful conversation.</h2>
              <p className="mt-5 max-w-xl text-base font-semibold leading-7 text-black/60">See how inventory, food and beverage cost, labour, purchasing and AI can work from the same restaurant data.</p>

              <div className="mt-8 rounded-[24px] bg-[#303A43] p-4 text-white shadow-2xl sm:ml-auto sm:w-[82%]">
                <div className="flex items-center justify-between border-b border-white/10 pb-3"><div><p className="text-[9px] font-black uppercase tracking-wider text-white/40">Today’s margin brief</p><p className="mt-1 font-black">3 actions worth reviewing</p></div><span className="rounded-full bg-emerald-400/15 px-2 py-1 text-[9px] font-black text-emerald-300">LIVE</span></div>
                <div className="mt-3 grid grid-cols-3 gap-2">{[['Food cost', '28.4%'], ['Labour', '29.7%'], ['At risk', '$624']].map(([label, value]) => <div key={label} className="rounded-xl bg-white/8 p-3"><p className="text-[8px] font-black uppercase text-white/35">{label}</p><p className="mt-1 text-lg font-black text-[#F5D62E]">{value}</p></div>)}</div>
                <div className="mt-3 space-y-2">{['Olive oil cost increased 15%', 'Friday labour is above target', '12 items are below par'].map((item, index) => <div key={item} className="flex items-center justify-between rounded-xl bg-white/8 px-3 py-2.5 text-xs font-bold"><span>{item}</span><span className="grid h-6 w-6 place-items-center rounded-full bg-[#F5D62E] text-[#303A43]">{index + 1}</span></div>)}</div>
              </div>

              <div className="mt-auto flex flex-wrap gap-2 pt-8">{['Full service', 'Quick service', 'Bars & beverage', 'Multi-location'].map(item => <span key={item} className="rounded-full border border-black/10 bg-white/40 px-3 py-2 text-xs font-black">{item}</span>)}</div>
            </div>
            <div aria-hidden="true" className="absolute -bottom-28 -right-24 h-80 w-80 rounded-full border-[42px] border-black/5" />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <DemoBenefit icon={FileScan} title="Bring a real invoice" text="See the scan-and-review workflow." />
            <DemoBenefit icon={BarChart3} title="Use your numbers" text="Model your food and labour opportunity." />
            <DemoBenefit icon={CalendarCheck} title="Plan next steps" text="Leave with a practical rollout path." />
          </div>
          <div className="flex items-center justify-center gap-2 rounded-[22px] bg-[#303A43] p-4 text-center text-xs font-bold text-white/65"><ShieldCheck className="h-4 w-4 text-[#F5D62E]" />No free-trial pressure. A focused product walkthrough for your operation.</div>
        </section>
      </div>
    </main>
  );
}

export function BookDemoThankYou() {
  usePageSeo({ title: 'Thank You | ZestIQ Demo', description: 'Your ZestIQ demo inquiry has been received.', path: '/book-demo/thank-you' });
  return (
    <main className="grid min-h-screen place-items-center bg-[#F4F1E9] px-4 py-10 text-[#303A43]">
      <section className="w-full max-w-2xl rounded-[30px] bg-white p-8 text-center shadow-xl sm:p-12">
        <Link to="/" aria-label="ZestIQ home" className="inline-flex rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F5D62E]"><ZestIQBrand className="gap-3" markClassName="h-14 w-14 rounded-none bg-transparent" wordmarkClassName="text-3xl" /></Link>
        <div className="mx-auto mt-8 grid h-16 w-16 place-items-center rounded-2xl bg-[#F5D62E]"><CheckCircle2 className="h-8 w-8" /></div>
        <p className="mt-7 text-xs font-black uppercase tracking-[0.2em] text-[#B58B00]">Inquiry received</p>
        <h1 className="mt-3 text-4xl font-black leading-tight tracking-[-0.04em] sm:text-5xl">Thank you for your inquiry.</h1>
        <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-slate-500">Our team will reach out for more information shortly. We’ll use those details to tailor your ZestIQ demo.</p>
        <div className="mt-8 rounded-2xl bg-slate-50 px-5 py-4 text-sm font-semibold text-slate-600">A confirmation is not required—your request has already been sent to our team.</div>
        <Link to="/" className="mt-8 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#303A43] px-6 font-black text-white transition hover:bg-[#172238]"><ArrowLeft className="h-4 w-4" />Back to the website</Link>
      </section>
    </main>
  );
}

function Field({ label, name, type = 'text', autoComplete }: { label: string; name: string; type?: string; autoComplete: string }) { return <label className="block"><span className="text-xs font-black text-slate-700">{label} <span className="text-red-500">*</span></span><input required className={fieldClass} name={name} type={type} autoComplete={autoComplete} /></label>; }
function SelectField({ label, name, options }: { label: string; name: string; options: string[] }) { return <label className="block"><span className="text-xs font-black text-slate-700">{label} <span className="text-red-500">*</span></span><select required className={fieldClass} name={name} defaultValue=""><option value="" disabled>Please select</option>{options.map(option => <option value={option} key={option}>{option}</option>)}</select></label>; }
function DemoBenefit({ icon: Icon, title, text }: { icon: typeof Check; title: string; text: string }) { return <div className="rounded-[22px] bg-white p-5 shadow-sm"><Icon className="h-5 w-5 text-[#B58B00]" /><p className="mt-3 font-black">{title}</p><p className="mt-1 text-xs leading-5 text-slate-500">{text}</p></div>; }
