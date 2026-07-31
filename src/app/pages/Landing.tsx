import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { ArrowRight, BarChart3, Building2, CheckCircle2, ChevronRight, Menu, Sparkles, TrendingUp, X } from 'lucide-react';

function ZestIQLogo({ size = 64 }: { size?: number }) {
  const h = Math.round(size * 1.16);
  return (
    <svg width={size} height={h} viewBox="0 0 100 116" fill="none" aria-hidden="true">
      <path
        d="M 12 52 C 22 28, 36 16, 50 16 C 64 16, 78 28, 88 52 C 78 76, 64 88, 50 88 C 36 88, 22 76, 12 52 Z"
        stroke="#0F172A" strokeWidth="6" fill="none"
        strokeLinejoin="round" strokeLinecap="round"
      />
        <rect x="34" y="62" width="6" height="14" rx="2" fill="#0F172A" />
        <rect x="43" y="55" width="6" height="21" rx="2" fill="#0F172A" />
        <rect x="52" y="47" width="6" height="29" rx="2" fill="#0F172A" />
      <path d="M 58 16 C 64 3, 84 3, 88 16 C 80 23, 64 23, 58 16 Z" fill="#5FAF4B" />
      <path d="M 60 16 C 69 12, 79 11, 86 16" stroke="#3F8D3A" strokeWidth="1.5" strokeLinecap="round" fill="none" />
    </svg>
  );
}

export function Landing() {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuPanelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
      }
    };

    const handleMouseDown = (event: MouseEvent) => {
      if (menuPanelRef.current && !menuPanelRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousedown', handleMouseDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousedown', handleMouseDown);
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#F5C10E] text-[#0F172A]">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-24 top-10 h-72 w-72 rounded-full bg-white/35 blur-3xl" />
        <div className="absolute right-[-120px] top-56 h-80 w-80 rounded-full bg-[#0F172A]/15 blur-3xl" />
      </div>
      <header className="flex items-center justify-between px-5 pt-5">
        <div className="flex items-center gap-3">
          <ZestIQLogo size={40} />
          <div className="flex items-baseline">
            <span className="text-2xl font-black tracking-tight">zest</span>
            <span className="ml-1 text-2xl font-black tracking-tight text-[#0F172A]">IQ</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setMenuOpen(value => !value)}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-black/10 bg-white/70 shadow-sm backdrop-blur transition-transform active:scale-95"
          aria-label="Open menu"
          aria-expanded={menuOpen}
        >
          {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </header>

      {menuOpen && (
        <div className="fixed inset-0 z-30 bg-black/15 px-5 pt-20 backdrop-blur-[2px]">
          <div ref={menuPanelRef} className="ml-auto w-full max-w-[440px] rounded-[1.75rem] border border-black/10 bg-white p-4 shadow-2xl shadow-black/20">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#0F172A]/45">Menu</p>
                <p className="mt-1 text-lg font-black">Explore zestIQ</p>
                <p className="mt-1 text-sm leading-6 text-[#0F172A]/65">Navigate the product, results, and demo path from one panel.</p>
              </div>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F8FAFC] text-[#0F172A]"
                aria-label="Close menu"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-[1fr_0.95fr]">
              <div className="grid gap-3">
                {[
                  { title: 'Platform', text: 'Inventory, recipes, forecasting, and ordering in one view.', href: '#platform' },
                  { title: 'How it works', text: 'See the workflow from counting stock to placing smarter orders.', href: '#how-it-works' },
                  { title: 'Results', text: 'See how teams reduce waste and improve margins.', href: '#results' },
                  { title: 'Why zestIQ', text: 'A single system for operators running one or many locations.', href: '#why' },
                ].map((item) => (
                  <a
                    key={item.title}
                    href={item.href}
                    onClick={() => setMenuOpen(false)}
                    className="group flex items-center justify-between rounded-2xl border border-black/10 bg-[#F8FAFC] px-4 py-3 transition-colors hover:bg-white"
                  >
                    <div>
                      <p className="text-sm font-black">{item.title}</p>
                      <p className="mt-1 text-sm leading-6 text-[#0F172A]/65">{item.text}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-[#0F172A]/35 transition-transform group-hover:translate-x-0.5" />
                  </a>
                ))}
              </div>

              <div className="grid gap-3">
                <a
                  href="#platform"
                  onClick={() => setMenuOpen(false)}
                  className="group flex items-center justify-between rounded-2xl border border-black/10 bg-[#0F172A] px-4 py-3 text-white transition-colors hover:opacity-95"
                >
                  <div>
                    <p className="text-sm font-black">Product overview</p>
                    <p className="mt-1 text-sm leading-6 text-white/70">Inventory, recipes, and forecasting in one operating system.</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-white/55 transition-transform group-hover:translate-x-0.5" />
                </a>

                <div className="rounded-2xl border border-black/10 bg-[#0F172A] p-4 text-white">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50">Fast path</p>
                  <p className="mt-2 text-lg font-black">Explore the app without leaving the homepage.</p>
                  <p className="mt-2 text-sm leading-6 text-white/70">
                    The menu now stays informational and jumps around the page instead of redirecting to login.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <main className="px-5 pb-16 pt-16 sm:px-7">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <section>
              <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/75 px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.22em] shadow-sm backdrop-blur">
                <Sparkles className="h-4 w-4" />
                Built for modern restaurant teams
              </div>

              <h1 className="max-w-3xl text-6xl font-black leading-[0.9] tracking-tight sm:text-7xl lg:text-[5.5rem]">
                Smarter Inventory for Restaurants
              </h1>

              <p className="mt-7 max-w-2xl text-lg leading-8 text-[#0F172A]/75 sm:text-xl">
                Stop losing money to inventory chaos. Simple control, real results.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  to="/login"
                  className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl bg-[#0F172A] px-8 text-base font-black text-[#F5C10E] shadow-xl shadow-black/20 transition-transform active:scale-[0.98]"
                >
                  Book a demo
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <a
                  href="#platform"
                  className="inline-flex h-14 items-center justify-center rounded-2xl border border-black/10 bg-white/80 px-8 text-base font-bold text-[#0F172A] shadow-sm backdrop-blur transition-transform active:scale-[0.98]"
                >
                  Explore platform
                </a>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#0F172A]/55">
                <span>Live inventory</span>
                <span className="text-[#0F172A]/30">•</span>
                <span>Recipe costing</span>
                <span className="text-[#0F172A]/30">•</span>
                <span>Multi-location ready</span>
              </div>

            </section>

            <section className="relative">
              <div className="rounded-[2rem] border border-black/10 bg-white/85 p-6 shadow-md backdrop-blur-sm sm:p-7">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#0F172A]/45">Live snapshot</p>
                <h2 className="mt-2 text-2xl font-black sm:text-3xl">One view for service, prep, and purchasing.</h2>
                <p className="mt-3 text-base leading-7 text-[#0F172A]/70">
                  See what is on hand, what is running low, and what to order next without juggling spreadsheets.
                </p>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {[['Food cost', '28.4%'], ['Low stock', '12 items'], ['Orders pending', '4'], ['Waste variance', '-6.2%']].map(([label, value]) => (
                    <div key={label} className="rounded-2xl border border-black/10 bg-[#F8FAFC] p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0F172A]/45">{label}</p>
                      <p className="mt-2 text-xl font-black">{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

          </div>

          <section id="kitchen-photos" className="mt-8 rounded-[2rem] bg-white p-6 shadow-lg sm:p-7">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-3xl font-black sm:text-4xl">A look inside the kitchen.</h2>
              </div>
              <p className="max-w-md text-base leading-7 text-[#0F172A]/65">
                A quick real-world moment that shows how zestIQ supports daily service.
              </p>
            </div>

            <div className="mt-6 overflow-hidden rounded-[1.75rem] border border-black/10 bg-[#0F172A] shadow-lg">
              <div className="grid lg:grid-cols-[1.15fr_0.85fr]">
                <div className="relative aspect-[16/10] lg:aspect-auto">
                  <img
                    src="https://images.unsplash.com/photo-1577219491135-ce391730fb2c?auto=format&fit=crop&w=1400&q=80"
                    alt="Chef plating food during service in a professional restaurant kitchen"
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0F172A]/40 via-transparent to-transparent" />
                </div>

                <div className="flex flex-col justify-center p-6 text-white sm:p-7">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/60">Kitchen operations</p>
                  <h3 className="mt-2 text-2xl font-black sm:text-3xl">Chef-led rush hour service</h3>
                  <p className="mt-3 text-base leading-7 text-white/75">
                    One chef-driven command point for counts, prep lists, and fast ordering decisions during the busiest hours.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section id="platform" className="mt-10 rounded-[2rem] border border-black/10 bg-white/60 p-6 shadow-md backdrop-blur-sm sm:p-7">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#0F172A]/45">Platform overview</p>
                <h2 className="mt-2 text-3xl font-black sm:text-4xl">Everything teams need to run every branch on one operating rhythm.</h2>
              </div>
              <Link to="/login" className="text-sm font-bold underline decoration-[#0F172A]/20 underline-offset-4">
                Book a demo
              </Link>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {['Orders and requisitions', 'Inventory and transfers', 'Recipe and prep costing', 'Forecasting and BI'].map((label) => (
                <div key={label} className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    <p className="text-sm font-bold">{label}</p>
                  </div>
                  <p className="mt-2 text-sm text-[#0F172A]/65">
                    One view for the data that actually moves margin and keeps teams aligned.
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section id="how-it-works" className="mt-10 rounded-[2rem] border border-black/10 bg-white/80 p-6 shadow-md backdrop-blur-sm sm:p-7">
            <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#0F172A]/45">How it works</p>
                <h2 className="mt-2 text-3xl font-black sm:text-4xl">A simple workflow from inventory count to smarter ordering.</h2>
                <p className="mt-3 text-sm leading-6 text-[#0F172A]/70">
                  zestIQ keeps the routine tasks connected so managers can move quickly from stock counts to recipes, forecasts, and purchase decisions.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  ['Count stock', 'Start with accurate counts and item status.'],
                  ['Cost recipes', 'Tie ingredients to menu items and prep builds.'],
                  ['Forecast demand', 'Use sales patterns to plan the next order.'],
                  ['Take action', 'Adjust inventory, suppliers, and prep before service.'],
                ].map(([title, text]) => (
                  <div key={title} className="rounded-2xl border border-black/10 bg-[#F8FAFC] p-4 shadow-sm">
                    <p className="text-sm font-black">{title}</p>
                    <p className="mt-2 text-sm leading-6 text-[#0F172A]/65">{text}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="mt-10 rounded-[2rem] border border-black/10 bg-white/80 p-6 shadow-md backdrop-blur-sm sm:p-7">
            <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#0F172A]/45">Our partnerships</p>
                <h2 className="mt-2 text-3xl font-black sm:text-4xl">Everything works better when the right systems are connected.</h2>
                <p className="mt-3 text-sm leading-6 text-[#0F172A]/70">
                  zestIQ is designed to sit at the center of restaurant operations and help teams move between inventory, recipes, orders, and reporting without friction.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  ['Integration partners', 'Connect your POS, purchasing, and reporting tools.'],
                  ['Reseller partners', 'Offer a modern operations stack to more restaurants.'],
                  ['Referral partners', 'Help operators discover a simpler way to run the business.'],
                ].map(([title, text]) => (
                  <article key={title} className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
                    <p className="text-sm font-black">{title}</p>
                    <p className="mt-2 text-sm leading-6 text-[#0F172A]/65">{text}</p>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section className="mt-10 rounded-[2rem] bg-[#111827] px-6 py-7 text-white shadow-2xl shadow-black/25 sm:px-7">
            <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/55">You’re in great company</p>
                <h2 className="mt-2 text-3xl font-black sm:text-4xl">Join operators who need clear numbers, faster decisions, and less admin.</h2>
              </div>
              <div className="flex flex-wrap gap-3">
                {['Toast', 'Lightspeed', 'Square', 'Clover'].map((label) => (
                  <div key={label} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white/85">
                    {label}
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                ['Forecasting accuracy', 'Improved planning with fewer surprises.'],
                ['Food waste', 'Track what gets used and what gets lost.'],
                ['Labour planning', 'Turn sales patterns into staffing decisions.'],
                ['Margin clarity', 'See where every category is helping or hurting.'],
              ].map(([title, text]) => (
                <div key={title} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-sm font-black text-[#F5C10E]">{title}</p>
                  <p className="mt-2 text-sm leading-6 text-white/70">{text}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-10 rounded-[2rem] border border-black/10 bg-white/80 p-6 shadow-md backdrop-blur-sm sm:p-7">
            <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#0F172A]/45">Experience the power of zestIQ</p>
                <h2 className="mt-2 text-3xl font-black sm:text-4xl">One all-in-one hospitality operating system.</h2>
                <p className="mt-3 text-sm leading-6 text-[#0F172A]/70">
                  From inventory management to workforce planning, zestIQ gives your team the insight and control to run the business with less waste and more consistency.
                </p>
                <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                  <Link to="/login" className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#0F172A] px-6 text-sm font-black text-[#F5C10E] transition-transform active:scale-[0.98]">
                    Explore the product
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <a href="#results" className="inline-flex h-12 items-center justify-center rounded-2xl border border-black/10 bg-white px-6 text-sm font-bold text-[#0F172A] transition-transform active:scale-[0.98]">
                    See results
                  </a>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  ['Business intelligence', 'Spot trends and act before they become costly.'],
                  ['Inventory management', 'Keep counts, par levels, and waste in one place.'],
                  ['Workforce planning', 'Match staffing to demand more confidently.'],
                  ['Ordering & prep', 'Reduce last-minute surprises with better forecasts.'],
                ].map(([title, text]) => (
                  <div key={title} className="rounded-2xl border border-black/10 bg-[#F8FAFC] p-4 shadow-sm">
                    <p className="text-sm font-black">{title}</p>
                    <p className="mt-2 text-sm leading-6 text-[#0F172A]/65">{text}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="mt-10 rounded-[2rem] bg-[#0F172A] px-6 py-7 text-white shadow-2xl shadow-black/25 sm:px-7">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/55">What the app has to offer</p>
                <h2 className="mt-2 text-3xl font-black sm:text-4xl">A complete restaurant operating system, built around the way teams actually work.</h2>
              </div>
              <Link to="/login" className="text-sm font-bold text-white/80 underline decoration-white/20 underline-offset-4">
                Explore the app
              </Link>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {[
                {
                  title: 'Inventory management',
                  text: 'Track stock on hand, inactive items, counts, suppliers, and ordering from one place.',
                },
                {
                  title: 'Recipe costing',
                  text: 'Build menu items, cost ingredients, scan recipes, and understand margin before you launch.',
                },
                {
                  title: 'Forecasting and AI orders',
                  text: 'Use sales trends and prep data to generate smarter purchase decisions and order plans.',
                },
                {
                  title: 'Multi-location control',
                  text: 'Switch between locations, keep data separate, and give every team the right visibility.',
                },
              ].map(({ title, text }) => (
                <article key={title} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-sm font-black text-[#F5C10E]">{title}</p>
                  <p className="mt-2 text-sm leading-6 text-white/70">{text}</p>
                </article>
              ))}
            </div>
          </section>

          <section id="why" className="mt-10 grid gap-5 lg:grid-cols-3">
            {[
              {
                title: 'The power of one platform',
                text: 'Track inventory, recipes, and orders in one system so teams stop stitching together spreadsheets and POS exports.',
                icon: Building2,
              },
              {
                title: 'Smarter decisions, faster',
                text: 'Use data and AI-assisted recommendations to prep, order, and plan with less guesswork every day.',
                icon: Sparkles,
              },
              {
                title: 'Growth without chaos',
                text: 'Scale from one site to many locations while keeping visibility, consistency, and accountability in place.',
                icon: BarChart3,
              },
            ].map(({ title, text, icon: Icon }) => (
              <article key={title} className="rounded-[1.75rem] border border-black/10 bg-white/80 p-6 shadow-md backdrop-blur-sm">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#F5C10E]/20 text-[#0F172A]">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-xl font-black">{title}</h3>
                <p className="mt-2 text-base leading-7 text-[#0F172A]/70">{text}</p>
              </article>
            ))}
          </section>

          <section id="results" className="mt-10 rounded-[2rem] bg-[#0F172A] px-6 py-7 text-white shadow-2xl shadow-black/25 sm:px-7">
            <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/55">Results you can take to the bank</p>
                <h2 className="mt-2 text-3xl font-black sm:text-4xl">Reduce waste, improve forecasting, and give managers a better operating rhythm.</h2>
              </div>
              <div className="flex flex-wrap gap-3">
                {['Food cost', 'Waste', 'Ordering'].map((label) => (
                  <div key={label} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white/85">
                    {label}
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {[
                ['10-25%', 'Potential labour cost reduction'],
                ['Up to 50%', 'Reduction in food waste'],
                ['100+', 'Hours per month saved on admin'],
              ].map(([value, text]) => (
                <div key={value} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-3xl font-black text-[#F5C10E]">{value}</p>
                  <p className="mt-2 text-sm leading-6 text-white/70">{text}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-10 grid gap-5 lg:grid-cols-[1fr_1fr]">
            <div className="rounded-[2rem] border border-black/10 bg-white/80 p-6 shadow-md backdrop-blur-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#0F172A]/45">Why teams love zestIQ</p>
              <h2 className="mt-2 text-3xl font-black">A crew of tools that help the team act on the same numbers.</h2>
              <ul className="mt-4 space-y-3 text-base text-[#0F172A]/70">
                <li className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-500" /> Inventory, recipes, and ordering stay connected.</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-500" /> Multi-location teams can switch sites without losing context.</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-500" /> Managers get faster insight into stock, cost, and demand.</li>
              </ul>
            </div>

            <div className="rounded-[2rem] border border-black/10 bg-white p-6 shadow-md">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#0F172A]/45">Get started</p>
              <h2 className="mt-2 text-3xl font-black">See the dashboard, live counts, and recipe costing in one demo.</h2>
              <p className="mt-3 text-base leading-7 text-[#0F172A]/70">
                If you manage one store or a chain, zestIQ is built to show the same operating picture to everyone who needs it.
              </p>
              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                <Link to="/login" className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#0F172A] px-6 text-sm font-black text-[#F5C10E] transition-transform active:scale-[0.98]">
                  Book a demo
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link to="/login" className="inline-flex h-12 items-center justify-center rounded-2xl border border-black/10 bg-[#F8FAFC] px-6 text-sm font-bold text-[#0F172A] transition-transform active:scale-[0.98]">
                  Sign in
                </Link>
              </div>
            </div>
          </section>

          <footer className="mt-8 pb-2 text-center text-xs font-semibold uppercase tracking-[0.2em] text-[#0F172A]/45">
            zestIQ for restaurant operations
          </footer>
        </div>
      </main>
    </div>
  );
}