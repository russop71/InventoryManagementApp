import type { ReactNode } from 'react';
import { ArrowLeft, Mail, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router';
import { ZestIQBrand } from './ZestIQBrand';

export function PublicLegalLayout({ eyebrow, title, description, lastUpdated, children }: { eyebrow: string; title: string; description: string; lastUpdated: string; children: ReactNode }) {
  return <div className="min-h-screen bg-[#FBFAF6] text-[#0B1220]">
    <header className="border-b border-black/5 bg-white"><div className="mx-auto flex h-20 max-w-6xl items-center justify-between px-5 sm:px-8"><Link to="/" aria-label="ZestIQ home" className="rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F5C10E]"><ZestIQBrand /></Link><div className="flex items-center gap-2"><Link to="/legal" className="rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm font-black">Legal centre</Link><Link to="/book-demo" className="hidden rounded-xl bg-[#0B1220] px-4 py-2.5 text-sm font-black text-white sm:block">Book a demo</Link></div></div></header>
    <main>
      <section className="border-b border-black/5 bg-[#0B1220] text-white"><div className="mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-20"><Link to="/" className="inline-flex items-center gap-2 text-sm font-bold text-white/60 hover:text-white"><ArrowLeft className="h-4 w-4" />Back to ZestIQ</Link><p className="mt-10 text-xs font-black uppercase tracking-[0.2em] text-[#F5C10E]">{eyebrow}</p><h1 className="mt-4 max-w-4xl text-4xl font-black tracking-[-0.04em] sm:text-6xl">{title}</h1><p className="mt-5 max-w-3xl text-lg leading-8 text-white/65">{description}</p><p className="mt-6 text-sm font-bold text-white/40">Effective and last updated: {lastUpdated}</p></div></section>
      <div className="mx-auto grid max-w-6xl gap-8 px-5 py-12 sm:px-8 lg:grid-cols-[minmax(0,1fr)_260px] lg:py-16"><article className="space-y-5">{children}</article><aside className="h-fit rounded-3xl border border-black/10 bg-white p-6 lg:sticky lg:top-6"><ShieldCheck className="h-7 w-7 text-[#B58B00]" /><h2 className="mt-4 text-lg font-black">Questions or requests?</h2><p className="mt-2 text-sm leading-6 text-black/55">Contact ZestIQ and include “Privacy” or “Legal” in the subject so the right person can respond.</p><a href="mailto:demo@zestiq.ca?subject=ZestIQ%20privacy%20or%20legal%20request" className="mt-5 inline-flex items-center gap-2 font-black underline underline-offset-4"><Mail className="h-4 w-4" />demo@zestiq.ca</a></aside></div>
    </main>
    <footer className="border-t border-black/5 bg-white"><div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-8 text-sm text-black/50 sm:px-8 md:flex-row md:items-center md:justify-between"><p>© 2026 ZestIQ · Proudly Canadian owned &amp; operated</p><div className="flex flex-wrap gap-x-5 gap-y-2 font-bold"><Link to="/privacy">Privacy</Link><Link to="/terms">Terms</Link><Link to="/cookies">Cookies</Link><Link to="/ai-transparency">AI &amp; data</Link><Link to="/subprocessors">Subprocessors</Link></div></div></footer>
  </div>;
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) { return <section className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm sm:p-8"><h2 className="text-xl font-black sm:text-2xl">{title}</h2><div className="mt-4 space-y-4 text-sm leading-7 text-black/65 sm:text-base">{children}</div></section>; }
export function LegalList({ children }: { children: ReactNode }) { return <ul className="list-disc space-y-2 pl-5 marker:text-[#B58B00]">{children}</ul>; }
export function LegalNote({ children }: { children: ReactNode }) { return <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold leading-6 text-amber-950">{children}</div>; }
