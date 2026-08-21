import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  ArrowRight,
  ArrowLeftRight,
  BarChart3,
  Beer,
  Bot,
  Building2,
  CalendarClock,
  CalendarDays,
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
  UsersRound,
  Warehouse,
  Wine,
  Zap,
} from 'lucide-react';
import { usePageSeo } from '../utils/seo';
import { ZestIQBrand } from '../components/ZestIQBrand';

const DEMO_URL = '/book-demo';

const features = [
  [PackageSearch, 'Live inventory control', 'Count stock, track variance, transfers and low-stock items without spreadsheet chaos.'],
  [ReceiptText, 'Food cost & recipe intelligence', 'Use current inventory prices to see recipe cost, margin and ingredient price changes.'],
  [FileScan, 'AI document scanning', 'Capture invoice images or PDFs and handwritten recipe cards with less manual entry.'],
  [BarChart3, 'Ordering & forecasting', 'Use inventory, pars and sales patterns to tighten orders and reduce over-buying.'],
  [Warehouse, 'Multi-location operations', 'Standardize counts, costs and ordering while keeping location-level visibility.'],
  [ShieldCheck, 'Operational controls', 'Protect invoice integrity, user roles and supplier purchasing data in one system.'],
  [MessageCircle, 'Company-aware AI assistant', 'Ask about your operation and get help using only your authorized company data.'],
  [CalendarClock, 'Labour & scheduling', 'Build weekly schedules and compare planned labour cost with sales before payroll closes.'],
  [Wine, 'Liquor, wine & beer costing', 'Track bottle and case stock, pour yields, drink cost and beverage margin.'],
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
  {
    icon: UsersRound,
    title: 'Labour & scheduling',
    description: 'Plan the week with labour cost visible before shifts are worked.',
    items: [
      'Team roles, hourly rates and active staff',
      'Mobile-friendly weekly shift scheduling',
      'Scheduled hours and cost by location',
      'Labour percentage compared with sales',
      'Target labour alerts for managers and owners',
    ],
  },
  {
    icon: Wine,
    title: 'Beverage costing',
    description: 'Run kitchen and bar costing together in full restaurant mode.',
    items: [
      'Liquor, wine and beer inventory by bottle or case',
      'Pour size, bottle yield and cost-per-drink calculator',
      'Cocktail, wine-by-the-glass and beer margins',
      'Bar pars, stock alerts and supplier price history',
      'Actual variance support for spills, comps and over-pours',
    ],
  },
];

function Product() {
  const reduceMotion = useReducedMotion();
  const [activeView, setActiveView] = useState(0);
  const views = [
    { label: 'Margin', status: '3 alerts', bars: [52, 66, 61, 78, 72, 86, 68, 58, 64, 48], attention: [['Salmon', 'Cost +8.4%'], ['Parmigiano', 'Margin below target'], ['Olive oil', 'Below par']] },
    { label: 'Ordering', status: '$366 suggested', bars: [35, 49, 44, 63, 57, 69, 60, 76, 53, 42], attention: [['Great Lakes Seafood', 'Order 12 lb salmon'], ['Harbour Specialty Foods', 'Order 6 kg cheese'], ['Maple Foodservice', 'Review pack size']] },
    { label: 'Labour', status: '29.7% of sales', bars: [58, 63, 55, 73, 82, 78, 65, 61, 70, 56], attention: [['Friday dinner', '$312 over target'], ['2 open shifts', 'Needs coverage'], ['Time off', '1 request pending']] },
  ];
  const active = views[activeView];

  useEffect(() => {
    if (reduceMotion) return undefined;
    const timer = window.setInterval(() => setActiveView(current => (current + 1) % views.length), 4200);
    return () => window.clearInterval(timer);
  }, [reduceMotion, views.length]);

  return (
    <motion.div initial={reduceMotion ? false : { opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }} className="relative rounded-[28px] border border-white/10 bg-[#111A2B] p-3 shadow-2xl">
      <motion.div aria-hidden="true" className="absolute -right-8 -top-8 h-28 w-28 rounded-full border border-[#F5C10E]/25" animate={reduceMotion ? undefined : { rotate: 360, scale: [1, 1.08, 1] }} transition={{ rotate: { duration: 18, repeat: Infinity, ease: 'linear' }, scale: { duration: 4, repeat: Infinity } }} />
      <div className="rounded-[22px] bg-[#F7F8FA] p-5 text-[#0B1220]">
        <div className="flex justify-between border-b border-black/10 pb-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.18em] text-black/40">Operations overview</p>
            <p className="mt-1 text-xl font-black">Good afternoon, Chef.</p>
          </div>
          <span className="h-fit rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-800">Live</span>
        </div>
        <div className="mt-4 flex gap-2 overflow-x-auto">
          {views.map((view, index) => <button key={view.label} type="button" onClick={() => setActiveView(index)} className={`relative shrink-0 rounded-full px-3 py-2 text-xs font-black transition ${activeView === index ? 'bg-[#0B1220] text-white' : 'bg-white text-black/45 hover:text-black'}`}>{view.label}{activeView === index && <motion.span layoutId="product-tab" className="absolute inset-x-3 -bottom-0.5 h-0.5 rounded-full bg-[#F5C10E]" />}</button>)}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {[
            ['Food cost', '28.4%'],
            ['Inventory', '$18,420'],
            ['Low stock', '12'],
            ['Waste', '-6.2%'],
            ['Labour', '29.7%'],
          ].map(([label, value]) => (
            <div className="rounded-2xl border border-black/10 bg-white p-3" key={label}>
              <p className="text-[10px] font-bold uppercase text-black/40">{label}</p>
              <p className="mt-2 text-lg font-black">{value}</p>
            </div>
          ))}
        </div>
        <AnimatePresence mode="wait">
        <motion.div key={active.label} initial={reduceMotion ? false : { opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={reduceMotion ? undefined : { opacity: 0, x: -18 }} transition={{ duration: 0.28 }} className="mt-3 grid gap-3 sm:grid-cols-[1.2fr_.8fr]">
          <div className="rounded-2xl border border-black/10 bg-white p-4">
            <div className="flex items-center justify-between gap-3"><p className="font-black">{active.label} signal</p><span className="rounded-full bg-[#FFF2B5] px-2 py-1 text-[10px] font-black">{active.status}</span></div>
            <div className="mt-6 flex h-28 items-end gap-2">
              {active.bars.map((height, index) => (
                <motion.div key={`${active.label}-${index}`} initial={reduceMotion ? false : { height: 0 }} animate={{ height: `${height}%` }} transition={{ delay: index * 0.025, duration: 0.35 }} className="flex-1 rounded-t bg-[#F5C10E]" />
              ))}
            </div>
          </div>
          <div className="rounded-2xl bg-[#0B1220] p-4 text-white">
            <p className="text-xs font-bold uppercase text-white/40">Needs attention</p>
            {active.attention.map(([name, insight], index) => (
              <motion.div initial={reduceMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 + index * 0.06 }} key={name} className="mt-3 rounded-xl bg-white/10 p-3">
                <p className="text-sm font-bold">{name}</p>
                <p className="text-xs text-[#F5C10E]">{insight}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function SavingsCalculator() {
  const [monthlySales, setMonthlySales] = useState(150000);
  const [foodCostPercent, setFoodCostPercent] = useState(31);
  const [laborPercent, setLaborPercent] = useState(32);
  const [foodImprovement, setFoodImprovement] = useState(3);
  const [laborImprovement, setLaborImprovement] = useState(2);
  const foodSpend = monthlySales * (foodCostPercent / 100);
  const laborSpend = monthlySales * (laborPercent / 100);
  const foodOpportunity = foodSpend * (foodImprovement / 100);
  const laborOpportunity = laborSpend * (laborImprovement / 100);
  const monthlyOpportunity = foodOpportunity + laborOpportunity;
  const money = (value: number) => new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(value);

  return (
    <section className="bg-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-20 sm:px-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-center lg:py-28">
        <div>
          <p className="text-sm font-black uppercase tracking-[.2em] text-[#9A7600]">Model the opportunity</p>
          <h2 className="mt-3 text-4xl font-black tracking-[-.035em] sm:text-5xl">What could tighter food and labour control be worth?</h2>
          <p className="mt-5 text-lg leading-8 text-black/60">Move the controls to match your restaurant. This is a planning estimate—not a promised saving—and shows why small operational improvements matter.</p>
          <div className="mt-7 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-[#FBFAF6] p-4"><p className="text-[10px] font-black uppercase tracking-wider text-black/40">Food opportunity</p><p className="mt-2 text-2xl font-black">{money(foodOpportunity)}<span className="text-sm text-black/40">/mo</span></p></div>
            <div className="rounded-2xl bg-[#FBFAF6] p-4"><p className="text-[10px] font-black uppercase tracking-wider text-black/40">Labour opportunity</p><p className="mt-2 text-2xl font-black">{money(laborOpportunity)}<span className="text-sm text-black/40">/mo</span></p></div>
          </div>
        </div>
        <div className="overflow-hidden rounded-[32px] bg-[#0B1220] text-white shadow-2xl">
          <div className="border-b border-white/10 p-6 sm:p-8">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-black uppercase tracking-[.18em] text-white/45">Estimated opportunity</p><output className="mt-2 block text-4xl font-black text-[#F5C10E] sm:text-5xl">{money(monthlyOpportunity)}<span className="text-base text-white/45"> / month</span></output></div><div className="rounded-2xl bg-white/10 px-4 py-3"><p className="text-[10px] uppercase tracking-wider text-white/45">Annualized</p><p className="mt-1 text-xl font-black">{money(monthlyOpportunity * 12)}</p></div></div>
          </div>
          <div className="grid gap-6 p-6 sm:grid-cols-2 sm:p-8">
            <Slider label="Monthly sales" value={monthlySales} min={30000} max={500000} step={5000} display={money(monthlySales)} onChange={setMonthlySales} />
            <Slider label="Food cost" value={foodCostPercent} min={20} max={50} step={1} display={`${foodCostPercent}%`} onChange={setFoodCostPercent} />
            <Slider label="Labour cost" value={laborPercent} min={15} max={50} step={1} display={`${laborPercent}%`} onChange={setLaborPercent} />
            <div className="grid grid-cols-2 gap-3"><Slider label="Food improvement" value={foodImprovement} min={0} max={10} step={0.5} display={`${foodImprovement}%`} onChange={setFoodImprovement} /><Slider label="Labour improvement" value={laborImprovement} min={0} max={10} step={0.5} display={`${laborImprovement}%`} onChange={setLaborImprovement} /></div>
          </div>
          <div className="border-t border-white/10 px-6 py-4 text-xs leading-5 text-white/40 sm:px-8">Estimate applies the selected improvements to monthly food and labour spend. Actual outcomes depend on adoption, starting controls, sales mix and operating conditions.</div>
        </div>
      </div>
    </section>
  );
}

function Slider({ label, value, min, max, step, display, onChange }: { label: string; value: number; min: number; max: number; step: number; display: string; onChange: (value: number) => void }) {
  return (
    <label className="block min-w-0"><span className="flex items-center justify-between gap-3 text-xs font-bold text-white/55"><span>{label}</span><span className="shrink-0 font-black text-white">{display}</span></span><input aria-label={label} type="range" value={value} min={min} max={max} step={step} onChange={event => onChange(Number(event.target.value))} className="mt-3 w-full accent-[#F5C10E]" /></label>
  );
}

function PhoneShowcase() {
  const reduceMotion = useReducedMotion();
  return (
    <section className="overflow-hidden bg-[#F5C10E]">
      <div className="mx-auto grid max-w-7xl gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-center lg:py-28">
        <div><p className="text-sm font-black uppercase tracking-[.2em] text-black/45">One website. Two apps.</p><h2 className="mt-3 text-4xl font-black tracking-[-.035em] sm:text-5xl">The office and the floor stay connected.</h2><p className="mt-5 text-lg leading-8 text-black/60">Managers run the operation in ZestIQ. Employees carry ZestEmployee for schedules, swaps and time off. Both use the same protected restaurant and location data.</p><div className="mt-7 flex flex-col gap-3 sm:flex-row"><Link to="/login" className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#0B1220] px-5 font-black text-white">Open ZestIQ<ArrowRight className="h-4 w-4" /></Link><Link to="/login?returnTo=/employee" className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border-2 border-[#0B1220] px-5 font-black">Open ZestEmployee<ArrowRight className="h-4 w-4" /></Link></div></div>
        <div className="relative mx-auto flex w-full max-w-2xl items-end justify-center gap-3 sm:gap-7">
          <motion.div animate={reduceMotion ? undefined : { y: [0, -9, 0], rotate: [-1.5, 0, -1.5] }} transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }} className="w-[47%] max-w-[270px]"><ManagementPhone /></motion.div>
          <motion.div animate={reduceMotion ? undefined : { y: [-5, 5, -5], rotate: [1.5, 0, 1.5] }} transition={{ duration: 5.5, repeat: Infinity, ease: 'easeInOut' }} className="w-[47%] max-w-[270px]"><EmployeePhone /></motion.div>
          <div aria-hidden="true" className="absolute -bottom-12 left-1/2 h-16 w-4/5 -translate-x-1/2 rounded-full bg-black/15 blur-2xl" />
        </div>
      </div>
    </section>
  );
}

function LiveProductTour() {
  const reduceMotion = useReducedMotion();
  const [activeScreen, setActiveScreen] = useState(0);
  const screens = [
    { label: 'Daily brief', title: 'See what needs attention today.', text: 'Live sales, food cost, labour, top sellers and operating signals come together in one working dashboard.', image: '/product-dashboard.png', alt: 'ZestIQ live demo dashboard showing restaurant sales and performance data', metric: '$7,532 in demo sales' },
    { label: 'Inventory', title: 'Count and cost the stock you actually carry.', text: 'Move from storage areas and counts to item-level stock, pars, supplier choices and current restaurant cost.', image: '/product-inventory.png', alt: 'ZestIQ live inventory screen with count and item controls', metric: 'Food + beverage inventory' },
    { label: 'Ordering', title: 'Turn low stock into a reviewable order.', text: 'Suggested purchasing connects on-hand inventory, pars, recent sales, suppliers and pack sizes before anyone sends an order.', image: '/product-ordering.png', alt: 'ZestIQ live ordering screen with forecasting and AI order controls', metric: 'Human-approved AI suggestions' },
  ];

  useEffect(() => {
    if (reduceMotion) return undefined;
    const timer = window.setInterval(() => setActiveScreen(current => (current + 1) % screens.length), 5200);
    return () => window.clearInterval(timer);
  }, [reduceMotion, screens.length]);

  const active = screens[activeScreen];
  return <section id="product-tour" className="overflow-hidden bg-[#EEF1F5]">
    <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-28">
      <div className="max-w-3xl"><p className="text-sm font-black uppercase tracking-[.2em] text-[#9A7600]">The working product</p><h2 className="mt-3 text-4xl font-black tracking-[-.035em] sm:text-6xl">Meet Zestaurant—our working demo.</h2><p className="mt-5 text-lg leading-8 text-black/60">Explore genuine ZestIQ screens populated with a running fictional restaurant. Choose a workflow or let the tour move for you.</p></div>
      <div className="mt-12 grid gap-7 lg:grid-cols-[.72fr_1.28fr] lg:items-center">
        <div className="space-y-3">{screens.map((screen, index) => <button key={screen.label} type="button" onClick={() => setActiveScreen(index)} className={`w-full rounded-3xl border p-5 text-left transition ${activeScreen === index ? 'border-[#0B1220] bg-[#0B1220] text-white shadow-xl' : 'border-black/10 bg-white hover:-translate-y-0.5 hover:shadow-md'}`}><div className="flex items-center justify-between gap-3"><span className={`text-xs font-black uppercase tracking-[.18em] ${activeScreen === index ? 'text-[#F5C10E]' : 'text-[#9A7600]'}`}>{screen.label}</span><span className={`grid h-7 w-7 place-items-center rounded-full text-xs font-black ${activeScreen === index ? 'bg-[#F5C10E] text-[#0B1220]' : 'bg-black/5'}`}>0{index + 1}</span></div><h3 className="mt-3 text-xl font-black">{screen.title}</h3><p className={`mt-2 text-sm leading-6 ${activeScreen === index ? 'text-white/55' : 'text-black/50'}`}>{screen.text}</p></button>)}</div>
        <div className="relative min-w-0">
          <motion.div aria-hidden="true" className="absolute -inset-8 rounded-full bg-[#F5C10E]/20 blur-3xl" animate={reduceMotion ? undefined : { scale: [0.92, 1.04, 0.92], rotate: [0, 8, 0] }} transition={{ duration: 7, repeat: Infinity }} />
          <div className="relative overflow-hidden rounded-[30px] border-[8px] border-[#0B1220] bg-[#0B1220] shadow-2xl"><div className="flex h-8 items-center gap-1.5 bg-[#0B1220] px-3"><span className="h-2.5 w-2.5 rounded-full bg-red-400" /><span className="h-2.5 w-2.5 rounded-full bg-[#F5C10E]" /><span className="h-2.5 w-2.5 rounded-full bg-emerald-400" /><span className="ml-3 truncate text-[10px] font-bold text-white/35">app.zestiq.ca · Main Location</span></div><AnimatePresence mode="wait"><motion.img key={active.image} src={active.image} alt={active.alt} initial={reduceMotion ? false : { opacity: 0, x: 35, scale: .98 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={reduceMotion ? undefined : { opacity: 0, x: -35 }} transition={{ duration: .38 }} className="block aspect-video w-full bg-white object-cover object-top" /></AnimatePresence></div>
          <motion.div key={active.metric} initial={reduceMotion ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="absolute -bottom-4 right-3 rounded-2xl bg-[#F5C10E] px-4 py-3 text-xs font-black text-[#0B1220] shadow-xl sm:right-6">{active.metric}</motion.div>
        </div>
      </div>
    </div>
  </section>;
}

function PhoneFrame({ children, label }: { children: React.ReactNode; label: string }) {
  return <div className="rounded-[36px] border-[7px] border-[#0B1220] bg-[#0B1220] p-1 shadow-2xl"><div className="relative aspect-[9/18.5] overflow-hidden rounded-[25px] bg-[#F4F5F7]"><div className="absolute left-1/2 top-1.5 z-10 h-4 w-20 -translate-x-1/2 rounded-full bg-[#0B1220]" /><span className="sr-only">{label}</span>{children}</div></div>;
}

function ManagementPhone() {
  return <PhoneFrame label="ZestIQ management app screen"><div className="bg-[#0B1220] px-3 pb-4 pt-8 text-white"><ZestIQBrand className="gap-1.5 text-white" markClassName="h-6 w-6 rounded-lg" wordmarkClassName="text-sm" /><p className="mt-5 text-[8px] font-black uppercase tracking-wider text-white/40">Today at King Street</p><h3 className="mt-1 text-lg font-black">Protect the margin.</h3></div><div className="space-y-2 p-3"><div className="grid grid-cols-2 gap-2"><div className="rounded-xl bg-white p-2 shadow-sm"><p className="text-[7px] font-black uppercase text-slate-400">Food cost</p><p className="mt-1 text-sm font-black text-emerald-600">28.4%</p></div><div className="rounded-xl bg-white p-2 shadow-sm"><p className="text-[7px] font-black uppercase text-slate-400">Labour</p><p className="mt-1 text-sm font-black text-violet-600">29.7%</p></div></div><div className="rounded-xl bg-white p-3 shadow-sm"><div className="flex items-center justify-between"><p className="text-[9px] font-black">Needs attention</p><span className="rounded-full bg-red-50 px-1.5 py-0.5 text-[6px] font-black text-red-600">3</span></div>{[['Salmon', '+8.4% cost'], ['Friday labour', '$312 over'], ['Pinot Grigio', 'Below par']].map(([name, value]) => <div key={name} className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2"><p className="text-[8px] font-bold">{name}</p><p className="text-[7px] font-black text-amber-700">{value}</p></div>)}</div><div className="rounded-xl bg-[#FFF7D1] p-3"><p className="text-[7px] font-black uppercase text-amber-700">AI order suggestion</p><p className="mt-1 text-[9px] font-black">$366 across 2 suppliers</p><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white"><div className="h-full w-3/4 rounded-full bg-[#F5C10E]" /></div></div></div><PhoneNav items={[[BarChart3, 'Today'], [PackageSearch, 'Stock'], [Wine, 'Beverage']]} /></PhoneFrame>;
}

function EmployeePhone() {
  return <PhoneFrame label="ZestEmployee schedule app screen"><div className="bg-[#0B1220] px-3 pb-4 pt-8 text-white"><div className="flex items-center gap-1.5 text-sm font-black"><span className="grid h-6 w-6 place-items-center rounded-lg bg-[#F5C10E] text-[11px] text-[#0B1220]">Z</span>Zest<span className="text-[#F5C10E]">Employee</span></div><p className="mt-5 text-[8px] font-black uppercase tracking-wider text-white/40">Your week</p><h3 className="mt-1 text-lg font-black">Hi, team member.</h3></div><div className="space-y-2 p-3"><p className="text-[8px] font-black uppercase tracking-wider text-slate-400">Upcoming shifts</p>{[['FRI', '22', '4:00–11:00', 'Server'], ['SAT', '23', '3:30–11:30', 'Server']].map(([day, date, time, role]) => <div key={date} className="flex items-center gap-2 rounded-xl bg-white p-2 shadow-sm"><div className="w-9 rounded-lg bg-amber-50 py-1 text-center"><p className="text-[6px] font-black text-amber-700">{day}</p><p className="text-sm font-black">{date}</p></div><div><p className="text-[9px] font-black">{time}</p><p className="text-[7px] text-slate-400">{role}</p></div><span className="ml-auto rounded-full bg-emerald-50 px-1.5 py-1 text-[6px] font-black text-emerald-700">CONFIRMED</span></div>)}<div className="grid grid-cols-2 gap-2"><div className="rounded-xl bg-white p-2 text-center shadow-sm"><ArrowLeftRight className="mx-auto h-4 w-4 text-[#B58B00]" /><p className="mt-1 text-[7px] font-black">Swap a shift</p></div><div className="rounded-xl bg-white p-2 text-center shadow-sm"><CalendarDays className="mx-auto h-4 w-4 text-[#B58B00]" /><p className="mt-1 text-[7px] font-black">Request time off</p></div></div><div className="rounded-xl border border-amber-100 bg-amber-50 p-2"><p className="text-[7px] font-black text-amber-800">Time off · Pending</p><p className="mt-1 text-[7px] text-amber-700">Sep 1–2 · Family event</p></div></div><PhoneNav items={[[CalendarDays, 'Schedule'], [ArrowLeftRight, 'Swaps'], [UsersRound, 'Profile']]} /></PhoneFrame>;
}

function PhoneNav({ items }: { items: Array<[typeof Smartphone, string]> }) {
  return <div className="absolute inset-x-0 bottom-0 grid grid-cols-3 border-t border-slate-100 bg-white px-1 py-2">{items.map(([Icon, label], index) => <div key={label} className={`flex flex-col items-center gap-0.5 text-[6px] font-black ${index === 0 ? 'text-[#0B1220]' : 'text-slate-300'}`}><Icon className="h-3.5 w-3.5" />{label}</div>)}</div>;
}

export function Landing() {
  usePageSeo({
    title: 'Restaurant Inventory Management Software | ZestIQ',
    description: 'ZestIQ is restaurant inventory management software for counts, food and beverage cost, invoice scanning, purchasing, labour and multi-location operations.',
    path: '/',
  });
  return (
    <div className="min-h-screen bg-[#FBFAF6] text-[#0B1220]">
      <header className="sticky top-0 z-40 border-b border-black/5 bg-[#FBFAF6]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-8">
          <ZestIQBrand compact />
          <nav className="hidden gap-7 text-sm font-bold md:flex">
            <a href="#platform">Platform</a>
            <a href="#product-tour">Product tour</a>
            <a href="#capabilities">Capabilities</a>
            <a href="#how">How it works</a>
            <a href="#pricing">Pricing</a>
          </nav>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link className="rounded-xl border border-[#0B1220]/15 bg-white px-3 py-2.5 text-sm font-black text-[#0B1220] shadow-sm transition hover:border-[#0B1220]/35 sm:px-5 sm:py-3" to="/login">Log in</Link>
            <Link className="rounded-xl bg-[#0B1220] px-3 py-2.5 text-sm font-black text-white sm:px-5 sm:py-3" to={DEMO_URL}>Book a demo</Link>
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
                ZestIQ is AI-powered restaurant inventory management software for food and beverage cost, labour, purchasing and forecasting—so operators can protect margin without living in spreadsheets.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link to={DEMO_URL} className="inline-flex h-14 items-center justify-center gap-2 rounded-xl bg-[#F5C10E] px-7 font-black text-[#0B1220]">
                  Book a demo <ArrowRight className="h-4 w-4" />
                </Link>
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

        <SavingsCalculator />
        <LiveProductTour />
        <PhoneShowcase />

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
              <p className="mt-5 max-w-xl text-lg leading-8 text-black/60">Inventory, labour scheduling, purchasing, recipe costing, AI scanning, forecasting, owner controls, users and billing in one subscription.</p>
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
              <Link to={DEMO_URL} className="mt-7 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#F5C10E] px-6 font-black text-[#0B1220]">
                Book a demo <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>

        <section className="px-5 py-20 sm:px-8">
          <div className="mx-auto max-w-7xl rounded-[36px] bg-[#0B1220] px-6 py-14 text-center text-white">
            <h2 className="mx-auto max-w-3xl text-4xl font-black sm:text-5xl">See what ZestIQ can do with your operation.</h2>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-white/60">Inventory, AI, food cost, labour, purchasing, recipes and forecasting—connected in one operating system.</p>
            <div className="mt-6 flex items-center justify-center gap-2 text-sm font-bold text-[#F5C10E]"><Smartphone className="h-4 w-4" /> Mobile-ready web experience · native iOS and Android next</div>
            <Link to={DEMO_URL} className="mt-8 inline-flex h-14 items-center gap-2 rounded-xl bg-[#F5C10E] px-8 font-black text-[#0B1220]">
              Book a demo <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </main>

      <footer className="overflow-hidden bg-[#0B1220] text-white">
        <div className="mx-auto max-w-7xl px-5 pb-8 pt-14 sm:px-8 sm:pt-20">
          <div className="flex flex-col gap-6 border-b border-white/10 pb-10 lg:flex-row lg:items-end lg:justify-between"><div><ZestIQBrand className="text-white" /><p className="mt-4 max-w-md text-sm leading-6 text-white/45">Restaurant inventory, food and beverage cost, purchasing, labour and AI—connected for operators.</p></div><div className="flex flex-col gap-3 sm:flex-row"><Link to="/login" className="inline-flex h-12 items-center justify-center rounded-xl border border-white/15 px-6 font-black">Log in</Link><Link to="/book-demo" className="inline-flex h-12 items-center justify-center rounded-xl bg-[#F5C10E] px-6 font-black text-[#0B1220]">Book a demo</Link></div></div>
          <nav aria-label="Footer" className="grid gap-9 py-12 sm:grid-cols-2 lg:grid-cols-5">
            <FooterGroup title="Product" links={[["Product tour", "/#product-tour"], ["Capabilities", "/#capabilities"], ["Pricing", "/#pricing"], ["Demo account", "/login"]]} />
            <FooterGroup title="Operations" links={[["Inventory software", "/restaurant-inventory-management-software"], ["Food cost software", "/restaurant-food-cost-software"], ["Invoice scanner", "/restaurant-invoice-scanner"], ["Labour & scheduling", "/#capabilities"], ["Beverage costing", "/#capabilities"]]} />
            <FooterGroup title="Platform" links={[["AI & data", "/ai-transparency"], ["Subprocessors", "/subprocessors"], ["Security & privacy", "/privacy"], ["Multi-location", "/#capabilities"], ["POS integrations", "/#capabilities"]]} />
            <FooterGroup title="Company" links={[["Book a demo", "/book-demo"], ["Contact", "mailto:demo@zestiq.ca"], ["Canadian owned", "/#canadian-owned"], ["Legal centre", "/legal"]]} />
            <FooterGroup title="Legal" links={[["Privacy Policy", "/privacy"], ["Terms of Service", "/terms"], ["Cookie Policy", "/cookies"], ["AI Transparency", "/ai-transparency"]]} />
          </nav>
          <div id="canadian-owned" className="flex flex-col gap-4 border-t border-white/10 py-6 text-sm text-white/40 sm:flex-row sm:items-center sm:justify-between"><p>© 2026 ZestIQ. All rights reserved.</p><p className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 font-bold text-white/70"><span aria-hidden="true">🇨🇦</span>Proudly Canadian owned &amp; operated</p></div>
          <p aria-hidden="true" className="pointer-events-none -mb-[.17em] mt-2 whitespace-nowrap text-[18vw] font-black leading-[.78] tracking-[-.08em] text-[#F5C10E] opacity-95">zestIQ</p>
        </div>
      </footer>
    </div>
  );
}

function FooterGroup({ title, links }: { title: string; links: string[][] }) { return <div><p className="text-xs font-black uppercase tracking-[.18em] text-[#F5C10E]">{title}</p><ul className="mt-4 space-y-3">{links.map(([label, href]) => <li key={`${label}-${href}`}>{href.startsWith('mailto:') ? <a href={href} className="text-sm font-bold text-white/70 hover:text-white">{label}</a> : <Link to={href} className="text-sm font-bold text-white/70 hover:text-white">{label}</Link>}</li>)}</ul></div>; }
