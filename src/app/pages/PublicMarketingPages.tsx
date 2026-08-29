import { Link } from 'react-router';
import { ArrowRight, BarChart3, Building2, CalendarClock, Check, FileScan, Flag, Layers3, Mail, PackageSearch, ReceiptText, ShieldCheck, Sparkles, UsersRound, Wine } from 'lucide-react';
import { ZestIQBrand } from '../components/ZestIQBrand';
import { usePageSeo } from '../utils/seo';

type PublicPageKey = 'productTour' | 'capabilities' | 'pricing' | 'contact' | 'canadianOwned';

const pages = {
  productTour: {
    path: '/product-tour',
    title: 'ZestIQ Product Tour | Restaurant Operations Software',
    description: 'Tour ZestIQ restaurant inventory, food and beverage costing, purchasing, labour scheduling, forecasting and AI workflows.',
    eyebrow: 'Product tour',
    heading: 'Follow the work from delivery to daily decision.',
    intro: 'ZestIQ brings the workflows restaurant teams repeat every week into one protected operating system. Explore the major parts of the product and see how they connect.',
    sections: [
      [PackageSearch, 'Count and control inventory', 'Organize storage areas, count in practical units, compare expected and actual stock, then review variance.'],
      [FileScan, 'Turn invoices into current cost', 'Upload a PDF or photo, review extracted supplier and line data, and update inventory and price history.'],
      [ReceiptText, 'Cost recipes and menu items', 'Link recipes to real inventory ingredients so food and beverage margins react when purchase prices change.'],
      [BarChart3, 'Forecast and order', 'Combine on-hand stock, pars, sales patterns, weather signals and supplier packs into reviewable order suggestions.'],
      [UsersRound, 'Schedule with labour visible', 'Build shifts by employee and role while seeing projected labour dollars and percentage against sales.'],
      [Sparkles, 'Ask ZestIQ AI', 'Get help with authorized company data while uncertain scans and recommendations remain subject to human review.'],
    ],
  },
  capabilities: {
    path: '/capabilities',
    title: 'ZestIQ Capabilities | Full Restaurant Operations Platform',
    description: 'Explore ZestIQ capabilities for inventory, food and beverage cost, invoices, ordering, forecasting, waste, labour, users and AI.',
    eyebrow: 'Platform capabilities',
    heading: 'One operating view for kitchen, bar, purchasing and labour.',
    intro: 'Each capability is designed to answer an operational question and pass useful information into the next workflow instead of creating another disconnected tool.',
    sections: [
      [PackageSearch, 'Inventory', 'Counts by storage area, units and conversions, pars, transfers, low-stock signals and variance.'],
      [ReceiptText, 'Recipes and cost', 'Current ingredient cost, yields, portions, menu prices, food-cost percentage and margin alerts.'],
      [Wine, 'Beverage operations', 'Liquor, wine and beer by case, bottle, keg and pour, plus cocktails and beverage margin.'],
      [FileScan, 'Invoices and suppliers', 'PDF, image and camera intake, duplicate protection, supplier matching and price history.'],
      [BarChart3, 'Ordering and forecasts', 'Suggested orders using stock, pars, sales usage, weather and supplier packs with approval controls.'],
      [UsersRound, 'Labour and teams', 'Employees, roles, clock-in numbers, shifts, requests, projected labour and sales comparison.'],
      [Layers3, 'Waste and reporting', 'Log item, quantity, reason, employee and cost, decrement inventory and report where loss occurs.'],
      [ShieldCheck, 'Owner controls', 'Company-isolated data, location access, user roles, usage visibility, billing and platform administration.'],
    ],
  },
  pricing: {
    path: '/pricing',
    title: 'ZestIQ Pricing | CAD $249.99 per Month',
    description: 'ZestIQ Basic costs CAD $249.99 per month for the first location. Additional locations are CAD $199 per month each with Scheduling included.',
    eyebrow: 'Clear Canadian pricing',
    heading: 'Start with ZestIQ Basic for CAD $249.99 per month.',
    intro: 'Basic is CAD $249.99 per month for the first restaurant location and includes the core inventory, costing, purchasing and AI platform. Each additional location is CAD $199 per month with Scheduling included.',
    sections: [
      [Check, 'ZestIQ Basic — CAD $249.99/month', 'Inventory, recipes, food and beverage costing, invoices, purchasing, forecasts, waste, users and AI tools for one location.'],
      [CalendarClock, 'Scheduling — add CAD $49.99/month', 'Optional labour scheduling with employees, shifts, requests, projected labour and sales comparison.'],
      [Building2, 'Additional locations — CAD $199/month', 'Each additional restaurant location includes Scheduling at no separate add-on charge.'],
      [ShieldCheck, 'Subscription terms', 'A 12-month commitment applies. Non-renewal notice is due at least 90 days before the renewal date.'],
      [ReceiptText, 'Acceptance record', 'Checkout records the agreement version, acceptance date and time, and the authorized customer acceptance.'],
    ],
  },
  contact: {
    path: '/contact',
    title: 'Contact ZestIQ | Restaurant Software Canada',
    description: 'Contact ZestIQ about restaurant inventory, food and beverage cost, labour, integrations, security, billing or a tailored product demonstration.',
    eyebrow: 'Contact ZestIQ',
    heading: 'Talk with us about your restaurant operation.',
    intro: 'Tell us what you run, how many locations you manage and which workflows need the most attention. We will respond from demo@zestiq.ca.',
    sections: [
      [Mail, 'General and demo enquiries', 'Email demo@zestiq.ca or use the tailored demo request form.'],
      [Building2, 'Operations fit', 'Share your venue count, current POS, inventory process and goals so the conversation is useful.'],
      [ShieldCheck, 'Security and privacy', 'Use the legal and trust centre for privacy, AI transparency and subprocessor information.'],
    ],
  },
  canadianOwned: {
    path: '/canadian-owned',
    title: 'Canadian-Owned Restaurant Software | ZestIQ',
    description: 'ZestIQ is a Canadian-owned restaurant operations software company building inventory, cost, labour and AI tools for hospitality operators.',
    eyebrow: 'Proudly Canadian owned',
    heading: 'Built in Canada for the realities of restaurant operations.',
    intro: 'ZestIQ uses Canadian pricing and is being built around the day-to-day needs of independent restaurants and multi-location hospitality operators.',
    sections: [
      [Flag, 'Canadian ownership', 'ZestIQ is Canadian owned and operated, with pricing displayed in Canadian dollars.'],
      [Building2, 'Restaurant-first design', 'The product is shaped around real inventory, recipes, purchasing, beverage and labour workflows.'],
      [ShieldCheck, 'Responsible operations', 'Company separation, access controls, privacy documentation and human-reviewed AI are core product requirements.'],
    ],
  },
} satisfies Record<PublicPageKey, { path: string; title: string; description: string; eyebrow: string; heading: string; intro: string; sections: Array<[typeof PackageSearch, string, string]> }>;

export function ProductTourPage() { return <PublicMarketingPage pageKey="productTour" />; }
export function CapabilitiesPage() { return <PublicMarketingPage pageKey="capabilities" />; }
export function PricingPage() { return <PublicMarketingPage pageKey="pricing" />; }
export function PublicContactPage() { return <PublicMarketingPage pageKey="contact" />; }
export function CanadianOwnedPage() { return <PublicMarketingPage pageKey="canadianOwned" />; }

function PublicMarketingPage({ pageKey }: { pageKey: PublicPageKey }) {
  const page = pages[pageKey];
  usePageSeo({ title: page.title, description: page.description, path: page.path });

  return <div className="min-h-screen bg-[#FBFAF6] text-[#0B1220]">
    <header className="border-b border-black/5 bg-white"><div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-8"><ZestIQBrand compact /><div className="flex items-center gap-2"><Link to="/login" className="rounded-xl border border-black/10 px-4 py-2.5 text-sm font-black">Log in</Link><Link to="/book-demo" className="rounded-xl bg-[#0B1220] px-4 py-2.5 text-sm font-black text-white">Book a demo</Link></div></div></header>
    <main>
      <section className="overflow-hidden bg-[#0B1220] text-white"><div className="mx-auto grid max-w-7xl gap-10 px-5 py-20 sm:px-8 lg:grid-cols-[1fr_.72fr] lg:items-center lg:py-28"><div><p className="text-xs font-black uppercase tracking-[.2em] text-[#F5C10E]">{page.eyebrow}</p><h1 className="mt-5 max-w-4xl text-5xl font-black leading-[.95] tracking-[-.045em] sm:text-6xl">{page.heading}</h1><p className="mt-6 max-w-3xl text-lg leading-8 text-white/65">{page.intro}</p><div className="mt-8 flex flex-col gap-3 sm:flex-row"><Link to="/book-demo" className="inline-flex h-14 items-center justify-center gap-2 rounded-xl bg-[#F5C10E] px-7 font-black text-[#0B1220]">Book a tailored demo<ArrowRight className="h-4 w-4" /></Link><Link to="/product-tour" className="inline-flex h-14 items-center justify-center rounded-xl border border-white/15 px-7 font-black">Explore the product</Link></div></div><img src="/zestiq-lemon.svg" alt="" className="mx-auto hidden w-full max-w-xs rotate-[-8deg] lg:block" /></div></section>
      <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8"><div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">{page.sections.map(([Icon, title, text]) => <article key={title} className="rounded-3xl border border-black/10 bg-white p-7 shadow-sm"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#FFF2B5]"><Icon className="h-6 w-6" /></div><h2 className="mt-5 text-2xl font-black">{title}</h2><p className="mt-3 leading-7 text-black/55">{text}</p></article>)}</div></section>
      <section className="bg-[#F5C10E]"><div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-14 sm:px-8 lg:flex-row lg:items-center lg:justify-between"><div><p className="text-xs font-black uppercase tracking-[.2em] text-black/45">Next step</p><h2 className="mt-2 text-3xl font-black">See how this fits your restaurant.</h2></div><div className="flex flex-col gap-3 sm:flex-row"><a href="mailto:demo@zestiq.ca" className="inline-flex h-12 items-center justify-center rounded-xl border-2 border-[#0B1220] px-6 font-black">Email ZestIQ</a><Link to="/book-demo" className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#0B1220] px-6 font-black text-white">Book a demo<ArrowRight className="h-4 w-4" /></Link></div></div></section>
    </main>
    <footer className="bg-[#0B1220] text-white"><div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-10 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-8"><ZestIQBrand className="text-white" /><div className="flex flex-wrap gap-x-5 gap-y-2 text-white/65"><Link to="/capabilities">Capabilities</Link><Link to="/pricing">Pricing</Link><Link to="/contact">Contact</Link><Link to="/legal">Legal centre</Link><Link to="/">Home</Link></div></div></footer>
  </div>;
}
