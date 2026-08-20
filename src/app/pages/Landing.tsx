import { Link } from 'react-router';
import {
  ArrowRight,
  BarChart3,
  Bot,
  Building2,
  Check,
  ClipboardCheck,
  FileScan,
  KeyRound,
  LockKeyhole,
  MessageCircle,
  PackageSearch,
  ReceiptText,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Smartphone,
  TrendingDown,
  Users,
  Warehouse,
  Zap,
} from 'lucide-react';

const CALENDLY_URL = import.meta.env.VITE_CALENDLY_URL || 'https://calendly.com';

const features = [
  [PackageSearch, 'Live inventory control', 'Count stock, track variance, transfers and low-stock items without spreadsheet chaos.'],
  [ReceiptText, 'Food cost & recipe intelligence', 'Use current inventory prices to see recipe cost, margin and ingredient price changes.'],
  [FileScan, 'AI document scanning', 'Capture invoice images or PDFs and handwritten recipe cards with less manual entry.'],
  [BarChart3, 'Ordering & forecasting', 'Use inventory, pars and sales patterns to tighten orders and reduce over-buying.'],
  [Warehouse, 'Multi-location operations', 'Standardize counts, costs and ordering while keeping location-level visibility.'],
  [ShieldCheck, 'Operational controls', 'Protect invoice integrity, user roles and supplier purchasing data in one system.'],
  [MessageCircle, 'Company-aware AI assistant', 'Ask about your operation and get help using only your authorized company data.'],
];

const capabilityGroups = [
  {
    icon: ClipboardCheck,
    title: 'Inventory & purchasing',
    description: 'Know what is on hand, what changed and what needs to be ordered.',
    items: [
      'Inventory counts, par levels and low-stock alerts',
      'Invoice image and PDF scanning',
      'Duplicate invoice-number protection',
      'One inventory item with multiple supplier options',
      'Supplier-specific pricing and price history',
    ],
  },
  {
    icon: Bot,
    title: 'AI recipes & costing',
    description: 'Turn handwritten recipes into reviewable, inventory-linked costs.',
    items: [
      'Camera capture for handwritten recipe cards',
      'AI transcription of ingredients, quantities and yield',
      'AI matching to existing inventory items',
      'Current inventory pricing—not invented AI costs',
      'Review flags for uncertain matches or incompatible units',
    ],
  },
  {
    icon: ShoppingCart,
    title: 'Decisions & oversight',
    description: 'Give operators and owners the visibility to act earlier.',
    items: [
      'Recipe margins and food-cost breakdowns',
      'Forecast-assisted daily ordering',
      'Supplier and invoice history',
      'POS integration workflows',
      'Location, user and role management',
    ],
  },
  {
    icon: LockKeyhole,
    title: 'Owner administration',
    description: 'Keep every company isolated while giving owners clear oversight.',
    items: [
      'Separate inventory and records for every company',
      'Owner-only user, usage and billing controls',
      'Secure invitations and password-reset links',
      'Per-user last login and 30-day app activity',
      'Stripe-hosted subscriptions and payment history',
    ],
  },
];

function Logo() {
  return (
    <div className="flex items-center gap-2 text-2xl font-black tracking-tight">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#F5C10E]">Z</span>
      <span>zest<span className="text-[#D9A900]">IQ</span></span>
    </div>
  );
}

function Product() {
  return (
    <div className="rounded-[28px] border border-white/10 bg-[#111A2B] p-3 shadow-2xl">
      <div className="rounded-[22px] bg-[#F7F8FA] p-5 text-[#0B1220]">
        <div className="flex justify-between border-b border-black/10 pb-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.18em] text-black/40">Operations overview</p>
            <p className="mt-1 text-xl font-black">Good afternoon, Chef.</p>
          </div>
          <span className="h-fit rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-800">Live</span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ['Food cost', '28.4%'],
            ['Inventory', '$18,420'],
            ['Low stock', '12'],
            ['Waste', '-6.2%'],
          ].map(([label, value]) => (
            <div className="rounded-2xl border border-black/10 bg-white p-3" key={label}>
              <p className="text-[10px] font-bold uppercase text-black/40">{label}</p>
              <p className="mt-2 text-lg font-black">{value}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-[1.2fr_.8fr]">
          <div className="rounded-2xl border border-black/10 bg-white p-4">
            <p className="font-black">Food cost trend</p>
            <div className="mt-6 flex h-28 items-end gap-2">
              {[52, 66, 61, 78, 72, 86, 68, 58, 64, 48].map((height, index) => (
                <div key={index} className="flex-1 rounded-t bg-[#F5C10E]" style={{ height: `${height}%` }} />
              ))}
            </div>
          </div>
          <div className="rounded-2xl bg-[#0B1220] p-4 text-white">
            <p className="text-xs font-bold uppercase text-white/40">Needs attention</p>
            {[
              ['Olive oil', 'Below par'],
              ['Salmon', 'Cost +8.4%'],
              ['Parmigiano', 'Order today'],
            ].map(([name, insight]) => (
              <div key={name} className="mt-3 rounded-xl bg-white/10 p-3">
                <p className="text-sm font-bold">{name}</p>
                <p className="text-xs text-[#F5C10E]">{insight}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function Landing() {
  return (
    <div className="min-h-screen bg-[#FBFAF6] text-[#0B1220]">
      <header className="sticky top-0 z-40 border-b border-black/5 bg-[#FBFAF6]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-8">
          <Logo />
          <nav className="hidden gap-7 text-sm font-bold md:flex">
            <a href="#platform">Platform</a>
            <a href="#capabilities">Capabilities</a>
            <a href="#how">How it works</a>
            <a href="#pricing">Pricing</a>
          </nav>
          <div className="flex items-center gap-4">
            <Link className="hidden text-sm font-bold sm:block" to="/login">Log in</Link>
            <a className="rounded-xl bg-[#0B1220] px-5 py-3 text-sm font-black text-white" href={CALENDLY_URL} target="_blank" rel="noreferrer">Book a demo</a>
          </div>
        </div>
      </header>

      <main>
        <section className="bg-[#0B1220] text-white">
          <div className="mx-auto grid max-w-7xl gap-14 px-5 py-20 sm:px-8 lg:grid-cols-[.9fr_1.1fr] lg:items-center lg:py-28">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold uppercase tracking-[.18em] text-white/70">
                <Sparkles className="h-4 w-4 text-[#F5C10E]" /> AI-powered restaurant control
              </div>
              <h1 className="mt-7 text-5xl font-black leading-[.95] tracking-[-.045em] sm:text-6xl xl:text-7xl">
                Know what you have.<br /><span className="text-[#F5C10E]">Know what it costs.</span><br />Know what to order.
              </h1>
              <p className="mt-7 max-w-xl text-lg leading-8 text-white/65">
                ZestIQ gives restaurant teams one intelligent system for inventory, food cost, purchasing and forecasting—so operators can protect margin without living in spreadsheets.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a href={CALENDLY_URL} target="_blank" rel="noreferrer" className="inline-flex h-14 items-center justify-center gap-2 rounded-xl bg-[#F5C10E] px-7 font-black text-[#0B1220]">
                  Book a demo <ArrowRight className="h-4 w-4" />
                </a>
                <a href="#capabilities" className="inline-flex h-14 items-center justify-center rounded-xl border border-white/15 px-7 font-bold">See every capability</a>
              </div>
              <div className="mt-8 flex flex-wrap gap-2 text-xs font-semibold text-white/60">
                {['AI invoice & recipe scanning', 'Company-isolated data', 'Live food costing', 'Owner controls'].map(item => (
                  <span key={item} className="rounded-full border border-white/10 bg-white/5 px-3 py-2">{item}</span>
                ))}
              </div>
            </div>
            <Product />
          </div>
        </section>

        <section className="border-y border-black/10 bg-[#F5C10E]">
          <div className="mx-auto grid max-w-7xl gap-px bg-black/10 sm:grid-cols-2 lg:grid-cols-4">
            {[
              [FileScan, 'Capture faster', 'Invoices, PDFs and handwritten recipes'],
              [Zap, 'Match intelligently', 'AI links ingredients to real inventory'],
              [TrendingDown, 'Protect margin', 'Current costs, variance and forecasting'],
              [LockKeyhole, 'Stay separated', 'One protected workspace per company'],
            ].map(([Icon, title, text]: any) => (
              <div key={title} className="flex gap-3 bg-[#F5C10E] px-6 py-6">
                <Icon className="mt-0.5 h-6 w-6 shrink-0" />
                <div>
                  <p className="font-black">{title}</p>
                  <p className="mt-1 text-sm text-black/60">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section id="platform" className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-28">
          <p className="text-sm font-black uppercase tracking-[.2em] text-[#9A7600]">The platform</p>
          <h2 className="mt-3 max-w-3xl text-4xl font-black tracking-[-.035em] sm:text-5xl">Restaurant control without the operational clutter.</h2>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-black/60">Every feature answers a practical question: What do we have? What did it cost? What changed? What should we buy next?</p>
          <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {features.map(([Icon, title, text]: any) => (
              <article key={title} className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm">
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-[#FFF2B5]"><Icon className="h-5 w-5" /></div>
                <h3 className="mt-5 text-xl font-black">{title}</h3>
                <p className="mt-2 leading-7 text-black/55">{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="overflow-hidden bg-[#0B1220] text-white">
          <div className="mx-auto grid max-w-7xl gap-12 px-5 py-20 sm:px-8 lg:grid-cols-2 lg:items-center lg:py-28">
            <div>
              <p className="text-sm font-black uppercase tracking-[.2em] text-[#F5C10E]">Built-in AI</p>
              <h2 className="mt-3 text-4xl font-black tracking-[-.035em] sm:text-5xl">Less typing. Better answers. Costs you can trust.</h2>
              <p className="mt-5 text-lg leading-8 text-white/60">
                ZestIQ reads operational documents and helps your team understand the business—while inventory prices and company permissions remain authoritative.
              </p>
              <div className="mt-8 space-y-4">
                {[
                  ['Scan', 'Photograph a handwritten recipe or upload an invoice PDF.'],
                  ['Match', 'AI connects extracted ingredients and products to your company inventory.'],
                  ['Review', 'Uncertain matches and incompatible units are flagged before saving.'],
                  ['Ask', 'Chat with zestIQ about costs, stock, invoices and how to use the app.'],
                ].map(([title, text], index) => (
                  <div key={title} className="flex gap-4">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F5C10E] text-sm font-black text-[#0B1220]">{index + 1}</span>
                    <div>
                      <p className="font-black">{title}</p>
                      <p className="mt-1 text-sm leading-6 text-white/55">{text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative">
              <div className="absolute -inset-8 rounded-full bg-[#F5C10E]/10 blur-3xl" />
              <div className="relative rounded-[30px] border border-white/10 bg-white/5 p-4 shadow-2xl backdrop-blur">
                <div className="flex items-center gap-3 border-b border-white/10 p-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F5C10E] text-[#0B1220]"><Bot className="h-5 w-5" /></span>
                  <div><p className="font-black">zestIQ AI Assistant</p><p className="text-xs text-white/45">Authorized company data only</p></div>
                  <span className="ml-auto h-2.5 w-2.5 animate-pulse rounded-full bg-green-400" />
                </div>
                <div className="space-y-4 p-3">
                  <div className="ml-auto max-w-[82%] rounded-2xl rounded-br-sm bg-[#F5C10E] px-4 py-3 text-sm font-medium text-[#0B1220]">What needs my attention before tomorrow’s order?</div>
                  <div className="max-w-[88%] rounded-2xl rounded-bl-sm bg-white px-4 py-4 text-sm leading-6 text-[#0B1220] shadow-xl">
                    <p className="font-black">Three items stand out:</p>
                    <p className="mt-2">• Salmon is below par and its latest cost increased.</p>
                    <p>• Olive oil is projected to run short.</p>
                    <p>• One invoice needs a duplicate-number review.</p>
                    <p className="mt-3 text-xs text-black/45">Review the suggested order before placing it.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="capabilities" className="bg-white">
          <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-28">
            <div className="max-w-3xl">
              <p className="text-sm font-black uppercase tracking-[.2em] text-[#9A7600]">Capabilities</p>
              <h2 className="mt-3 text-4xl font-black tracking-[-.035em] sm:text-5xl">What the system actually does.</h2>
              <p className="mt-5 text-lg leading-8 text-black/60">A clear view of the operational workflows ZestIQ brings together today.</p>
            </div>
            <div className="mt-12 grid gap-5 md:grid-cols-2">
              {capabilityGroups.map(group => {
                const Icon = group.icon;
                return (
                  <article key={group.title} className="rounded-3xl border border-black/10 bg-[#FBFAF6] p-7">
                    <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#0B1220] text-[#F5C10E]"><Icon className="h-6 w-6" /></div>
                    <h3 className="mt-5 text-2xl font-black">{group.title}</h3>
                    <p className="mt-2 leading-7 text-black/55">{group.description}</p>
                    <ul className="mt-6 space-y-3">
                      {group.items.map(item => (
                        <li key={item} className="flex gap-3 text-sm leading-6 text-black/70">
                          <Check className="mt-1 h-4 w-4 shrink-0 text-[#9A7600]" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </article>
                );
              })}
            </div>
            <div className="mt-6 flex flex-col gap-3 rounded-3xl bg-[#0B1220] p-6 text-white sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <Building2 className="mt-1 h-5 w-5 text-[#F5C10E]" />
                <div>
                  <p className="font-black">Designed for operators, managers and company owners</p>
                  <p className="mt-1 text-sm text-white/60">Role-based access keeps day-to-day work focused while owners retain company-level oversight.</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-2 text-sm font-bold text-[#F5C10E]"><Users className="h-4 w-4" /> Team-ready</div>
                <div className="flex items-center gap-2 text-sm font-bold text-[#F5C10E]"><KeyRound className="h-4 w-4" /> Owner-controlled</div>
              </div>
            </div>
          </div>
        </section>

        <section id="how" className="bg-[#F5C10E]">
          <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8">
            <p className="text-sm font-black uppercase tracking-[.2em] text-black/45">How it works</p>
            <h2 className="mt-3 max-w-3xl text-4xl font-black sm:text-5xl">From count to decision, without the spreadsheet relay race.</h2>
            <div className="mt-10 grid gap-4 lg:grid-cols-3">
              {[
                ['01', 'Capture', 'Bring inventory, invoices, handwritten recipes and purchasing into one system.'],
                ['02', 'Understand', 'Turn operating data into food-cost, variance and stock visibility.'],
                ['03', 'Act', 'Know what to order, where margin is leaking and what needs attention next.'],
              ].map(([number, title, description]) => (
                <div key={number} className="rounded-3xl bg-[#0B1220] p-7 text-white">
                  <p className="font-black text-[#F5C10E]">{number}</p>
                  <h3 className="mt-8 text-2xl font-black">{title}</h3>
                  <p className="mt-3 leading-7 text-white/60">{description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="pricing" className="bg-white px-5 py-20 sm:px-8">
          <div className="mx-auto grid max-w-5xl gap-8 rounded-[36px] border border-black/10 bg-[#FBFAF6] p-7 shadow-sm md:grid-cols-[1fr_.8fr] md:items-center md:p-12">
            <div>
              <p className="text-sm font-black uppercase tracking-[.2em] text-black/45">Simple pricing</p>
              <h2 className="mt-3 text-4xl font-black sm:text-5xl">ZestIQ Premium</h2>
              <p className="mt-5 max-w-xl text-lg leading-8 text-black/60">All core inventory, purchasing, recipe costing, AI scanning, forecasting, owner controls, users and billing features in one subscription.</p>
              <div className="mt-6 space-y-3 text-sm font-semibold text-black/70">
                {['One location included', 'CAD $100/month for each additional location', 'No free trial', 'Stripe-secured monthly billing'].map(item => (
                  <p key={item} className="flex items-center gap-2"><Check className="h-4 w-4 text-[#A16207]" />{item}</p>
                ))}
              </div>
            </div>
            <div className="rounded-3xl bg-[#0B1220] p-7 text-white">
              <p className="text-sm font-bold uppercase tracking-[.18em] text-white/45">Premium</p>
              <p className="mt-5 text-5xl font-black text-[#F5C10E]">$249.99</p>
              <p className="mt-2 font-bold">CAD per month</p>
              <p className="mt-4 text-sm leading-6 text-white/55">Includes one location. Every location after the first adds CAD $100/month.</p>
              <a href={CALENDLY_URL} target="_blank" rel="noreferrer" className="mt-7 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#F5C10E] px-6 font-black text-[#0B1220]">
                Book a demo <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>
        </section>

        <section className="px-5 py-20 sm:px-8">
          <div className="mx-auto max-w-7xl rounded-[36px] bg-[#0B1220] px-6 py-14 text-center text-white">
            <h2 className="mx-auto max-w-3xl text-4xl font-black sm:text-5xl">See what ZestIQ can do with your operation.</h2>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-white/60">Inventory, AI, food cost, purchasing, recipes and forecasting—connected in one operating system.</p>
            <div className="mt-6 flex items-center justify-center gap-2 text-sm font-bold text-[#F5C10E]"><Smartphone className="h-4 w-4" /> Mobile-ready web experience · native iOS and Android next</div>
            <a href={CALENDLY_URL} target="_blank" rel="noreferrer" className="mt-8 inline-flex h-14 items-center gap-2 rounded-xl bg-[#F5C10E] px-8 font-black text-[#0B1220]">
              Book a demo <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </section>
      </main>

      <footer className="border-t border-black/5 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <Logo />
          <p className="text-sm text-black/45">Restaurant inventory intelligence, built for operators.</p>
        </div>
      </footer>
    </div>
  );
}
