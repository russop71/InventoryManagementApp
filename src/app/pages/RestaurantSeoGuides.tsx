import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { ArrowRight, Calculator, Check, ClipboardList, PackageSearch, Search, ShieldCheck } from 'lucide-react';
import { ZestIQBrand } from '../components/ZestIQBrand';
import { usePageSeo } from '../utils/seo';

const guideLinks = [
  ['Canadian buyer’s guide', '/best-restaurant-inventory-management-software-canada'],
  ['Inventory management guide', '/restaurant-inventory-management-guide'],
  ['Food-cost calculator', '/restaurant-food-cost-calculator'],
] as const;

export function RestaurantInventoryBuyerGuide() {
  usePageSeo({
    title: 'Best Restaurant Inventory Software in Canada: 2026 Buyer’s Guide',
    description: 'A practical 2026 guide to choosing restaurant inventory management software in Canada. Compare counting, food cost, invoices, ordering, POS, labour and multi-location requirements.',
    path: '/best-restaurant-inventory-management-software-canada',
  });

  return <GuideLayout eyebrow="2026 Canadian buyer’s guide" title="How to choose the best restaurant inventory software for your operation." intro="The best system is not the one with the longest feature list. It is the one your team will actually use every week—and the one that turns counts, purchases and recipes into decisions before margin disappears.">
    <GuideSection title="Start with the operating problem, not the software demo">
      <p>Restaurant inventory systems generally promise tighter food cost, faster counts and better purchasing. Those outcomes only happen when the system fits how products are received, stored, prepared and sold in your restaurant. Before comparing vendors, document who counts inventory, how often it happens, which units are used, how invoices arrive and who approves an order.</p>
      <p>Independent restaurants often need a simpler workflow than a national chain. Multi-location groups need consistent item definitions and owner visibility without mixing each location’s operational records. Canadian operators should also confirm CAD pricing, tax handling, privacy documentation, support availability and compatibility with the POS and suppliers they actually use.</p>
    </GuideSection>
    <GuideSection title="The seven capabilities worth testing">
      <Checklist items={[
        'Mobile counts organized by walk-in, freezer, dry storage, bar and other storage areas.',
        'Units and conversions that understand cases, kilograms, bottles, ounces, portions and eaches.',
        'Invoice scanning with human review, duplicate protection and supplier-item matching.',
        'Recipe and beverage costing tied to current purchase prices rather than a static spreadsheet.',
        'Pars, usage signals, supplier pack sizes and reviewable suggested orders.',
        'Waste and variance reporting that identifies item, reason, employee and financial impact.',
        'Location-level permissions with protected company-wide reporting for authorized owners.',
      ]} />
    </GuideSection>
    <GuideSection title="Use a simple scorecard during the demo">
      <p>Score each workflow from <strong>0 to 2</strong>: 0 means the vendor cannot demonstrate it, 1 means it requires a workaround, and 2 means the workflow is clear and usable. Compare the completed score—not the number of features on the sales slide.</p>
      <div className="overflow-x-auto rounded-2xl border border-black/10">
        <table className="min-w-[680px] w-full border-collapse text-left text-sm">
          <thead className="bg-[#303A43] text-white"><tr><th className="p-4 font-black">Workflow</th><th className="p-4 font-black">Ask the vendor to show</th><th className="w-24 p-4 text-center font-black">Score</th></tr></thead>
          <tbody className="divide-y divide-black/10 bg-[#FBFAF6]">
            {[
              ['Inventory counting', 'Count one item in two units and move through storage areas in physical count order.'],
              ['Invoice accuracy', 'Import an invoice, review uncertain fields and prevent a duplicate from posting.'],
              ['Live food cost', 'Change a supplier price and show every affected recipe and menu margin.'],
              ['Ordering logic', 'Build an order using on-hand stock, incoming purchases, pars, demand and supplier packs.'],
              ['Operational control', 'Show approvals, audit history and separate access for managers, locations and owners.'],
            ].map(([workflow, test]) => <tr key={workflow}><th scope="row" className="p-4 font-black text-[#303A43]">{workflow}</th><td className="p-4 leading-6 text-black/60">{test}</td><td className="p-4 text-center font-black text-black/35">0–2</td></tr>)}
          </tbody>
        </table>
      </div>
      <p>A perfect score is not required. The scorecard makes trade-offs visible and gives operators a repeatable way to compare products against the work their restaurant performs every week.</p>
    </GuideSection>
    <GuideSection title="Questions to ask during every restaurant inventory demo">
      <p>Ask the vendor to perform a real workflow: count one ingredient in two units, receive a changed supplier price, show the affected recipe margin and build a suggested order. Request a clear explanation of what happens when a scan is uncertain, a POS item does not match a recipe or the internet connection is interrupted.</p>
      <p>Also ask what is included in the advertised price. Onboarding, additional locations, invoice volume, POS connections, scheduling and support may be separate charges. A transparent total cost is more useful than a low starting price that excludes the workflows your restaurant needs.</p>
    </GuideSection>
    <GuideSection title="How ZestIQ fits the comparison">
      <p>ZestIQ is Canadian restaurant operations software connecting inventory, current food and beverage cost, invoices, purchasing, forecasting, waste, labour and multi-location control. It is designed around reviewable recommendations and human-approved AI workflows. The product is available to explore through a live demo account, so operators can inspect the workflow rather than relying only on screenshots.</p>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row"><Link to="/restaurant-inventory-management-software" className="guide-primary">Explore restaurant inventory software<ArrowRight className="h-4 w-4" /></Link><Link to="/product-tour" className="guide-secondary">Tour ZestIQ</Link><Link to="/pricing" className="guide-secondary">See Canadian pricing</Link></div>
    </GuideSection>
    <Faq items={[
      ['What is restaurant inventory management software?', 'It is software that helps restaurants count ingredients and beverages, value on-hand stock, organize suppliers and purchasing, calculate recipe cost, monitor waste and make replenishment decisions.'],
      ['How much does restaurant inventory software cost in Canada?', 'Pricing varies by location count, feature set, invoice volume and integrations. Compare the total monthly cost in Canadian dollars, including onboarding and required add-ons.'],
      ['Can one system manage food, beverage and labour?', 'Some platforms focus only on stock. Broader restaurant operations systems can connect kitchen and bar inventory with food cost, purchasing, waste, sales and labour.'],
    ]} />
  </GuideLayout>;
}

export function RestaurantInventoryManagementGuide() {
  usePageSeo({
    title: 'Restaurant Inventory Management Guide: Counts, Food Cost & Ordering',
    description: 'A practical restaurant inventory management guide covering count sheets, units, recipe costing, invoice prices, waste, variance, pars and ordering.',
    path: '/restaurant-inventory-management-guide',
  });

  return <GuideLayout eyebrow="Restaurant operations guide" title="Restaurant inventory management: from weekly count to daily decision." intro="Good inventory control is a repeatable operating rhythm. It connects what you bought, what you counted, what you sold and what should remain—then gives the team a short list of actions.">
    <GuideSection title="1. Build one clean item list">
      <p>Start with the ingredients and beverages that materially affect cost. Give every item a clear name, category, base unit, purchase unit, supplier and storage location. Avoid duplicate entries such as “tomatoes,” “Roma tomato” and a supplier code that all represent the same product.</p>
      <p>Document conversions. If tomatoes are purchased by a 25-pound case but counted by case and pound, the system needs a reliable relationship between those units. The same principle applies to bottles, ounces, kegs, litres and individual portions.</p>
    </GuideSection>
    <GuideSection title="2. Design a count people can finish">
      <p>Arrange count sheets in the physical order the team walks each storage area. Use a consistent cut-off time, assign ownership and avoid receiving or transferring product during the count whenever possible. Weekly counting is common for full inventory, while high-value or high-variance products may deserve daily spot counts.</p>
      <p>Consistency matters more than false precision. A count completed the same way every week creates a useful trend; a complicated count that is skipped or rushed does not.</p>
    </GuideSection>
    <GuideSection title="3. Keep purchase prices current">
      <p>Invoice prices are the bridge between physical inventory and financial insight. Capture supplier, item, quantity, unit and price, then review matches before posting. Current purchase cost should flow into on-hand value and affected recipes so operators can see margin movement earlier.</p>
    </GuideSection>
    <GuideSection title="4. Connect recipes, sales and theoretical usage">
      <p>A recipe should include ingredient quantity, preparation yield, portion count and menu price. Linking POS menu items to recipes creates theoretical usage: what inventory should have been consumed based on sales. Comparing theoretical and actual usage can reveal over-portioning, unrecorded waste, receiving mistakes or theft.</p>
    </GuideSection>
    <GuideSection title="5. Turn variance into a short action list">
      <Checklist items={['Review the highest-dollar variances first.', 'Separate price variance from usage variance.', 'Check unit conversions and duplicate items before blaming operations.', 'Log waste with a consistent reason and responsible area.', 'Adjust pars using demand and lead time—not habit.', 'Review suggested orders before sending anything to a supplier.']} />
      <p className="mt-5">The goal is not to explain every gram. It is to identify repeatable causes that change purchasing, prep, portioning or menu decisions.</p>
      <Link to="/restaurant-inventory-management-software" className="guide-primary mt-6">Explore restaurant inventory management software<ArrowRight className="h-4 w-4" /></Link>
    </GuideSection>
    <Faq items={[
      ['How often should a restaurant count inventory?', 'Many restaurants complete a full count weekly and use daily spot counts for expensive, fast-moving or high-variance products. The right cadence depends on product value and operating volume.'],
      ['What is restaurant inventory variance?', 'Inventory variance is the difference between expected usage or stock and the actual count, often expressed in units or dollars.'],
      ['How do pars improve restaurant ordering?', 'A par is a target stock level. Comparing par with current stock, incoming orders and expected demand produces a more defensible order quantity.'],
    ]} />
  </GuideLayout>;
}

export function RestaurantFoodCostCalculator() {
  usePageSeo({
    title: 'Free Restaurant Food Cost Calculator | Food Cost Percentage',
    description: 'Calculate restaurant food cost percentage, gross profit and target menu price. Includes the formula and practical guidance for recipe and menu costing.',
    path: '/restaurant-food-cost-calculator',
  });
  const [ingredientCost, setIngredientCost] = useState(6.4);
  const [menuPrice, setMenuPrice] = useState(24);
  const [targetPercent, setTargetPercent] = useState(30);
  const results = useMemo(() => {
    const cost = Math.max(0, Number(ingredientCost) || 0);
    const price = Math.max(0, Number(menuPrice) || 0);
    const target = Math.max(1, Number(targetPercent) || 1);
    return { percentage: price ? (cost / price) * 100 : 0, grossProfit: price - cost, targetPrice: cost / (target / 100) };
  }, [ingredientCost, menuPrice, targetPercent]);

  return <GuideLayout eyebrow="Free restaurant calculator" title="Restaurant food-cost calculator." intro="Enter the current ingredient cost and menu price to calculate food-cost percentage and gross profit. Then compare the price required to reach your target food-cost percentage.">
    <section className="rounded-[30px] bg-[#303A43] p-6 text-white shadow-xl sm:p-9">
      <div className="grid gap-5 md:grid-cols-3">
        <NumberField label="Ingredient cost" prefix="$" value={ingredientCost} onChange={setIngredientCost} />
        <NumberField label="Menu price" prefix="$" value={menuPrice} onChange={setMenuPrice} />
        <NumberField label="Target food cost" suffix="%" value={targetPercent} onChange={setTargetPercent} />
      </div>
      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        <Result label="Current food cost" value={`${results.percentage.toFixed(1)}%`} />
        <Result label="Gross profit per item" value={`$${results.grossProfit.toFixed(2)}`} />
        <Result label="Price at target" value={`$${results.targetPrice.toFixed(2)}`} />
      </div>
    </section>
    <GuideSection title="Restaurant food-cost formula">
      <p><strong>Food cost percentage = ingredient cost ÷ menu price × 100.</strong> A dish with $6.40 of ingredients and a $24 menu price has a food cost of 26.7%. Its gross profit before labour, occupancy, fees and other operating expenses is $17.60.</p>
      <p>A target percentage is a planning tool, not a universal rule. The right target depends on concept, category, labour, waste, contribution margin and what guests will pay. Use current supplier prices and realistic recipe yields.</p>
    </GuideSection>
    <GuideSection title="Make the calculation operational">
      <p>A one-time calculation becomes outdated as purchase prices change. Connect invoice prices to ingredient units and recipes, then review which menu items moved outside target. ZestIQ is designed to keep recipe and beverage cost connected with current supplier pricing.</p>
      <Link to="/restaurant-food-cost-software" className="guide-primary mt-6">Explore live food-cost software<ArrowRight className="h-4 w-4" /></Link>
    </GuideSection>
    <Faq items={[
      ['What is a good food cost percentage for a restaurant?', 'There is no single ideal percentage. Many operators set category-specific targets and evaluate food cost together with contribution margin, labour and menu demand.'],
      ['Should food cost include waste?', 'Recipe cost measures the expected ingredients in a portion. Actual food cost is also affected by waste, over-portioning, theft, receiving errors and count accuracy.'],
      ['How often should menu food cost be updated?', 'Review when supplier prices change and complete a broader menu-cost review regularly. High-volatility or low-margin items deserve more frequent attention.'],
    ]} />
  </GuideLayout>;
}

function GuideLayout({ eyebrow, title, intro, children }: { eyebrow: string; title: string; intro: string; children: React.ReactNode }) {
  return <div className="min-h-screen bg-[#FBFAF6] text-[#303A43]">
    <header className="border-b border-black/5 bg-white"><div className="mx-auto flex h-20 max-w-6xl items-center justify-between px-5 sm:px-8"><Link to="/"><ZestIQBrand compact /></Link><div className="flex gap-2"><Link to="/product-tour" className="rounded-xl border border-black/10 px-4 py-2.5 text-sm font-black">Product tour</Link><Link to="/book-demo" className="rounded-xl bg-[#303A43] px-4 py-2.5 text-sm font-black text-white">Book a demo</Link></div></div></header>
    <main>
      <section className="bg-[#303A43] text-white"><div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 lg:py-28"><nav aria-label="Breadcrumb" className="mb-8 flex flex-wrap items-center gap-2 text-sm font-bold text-white/55"><Link to="/" className="hover:text-white">Home</Link><span aria-hidden="true">/</span><span className="text-[#F5D62E]">Restaurant resources</span></nav><p className="text-xs font-black uppercase tracking-[.2em] text-[#F5D62E]">{eyebrow}</p><h1 className="mt-5 max-w-5xl text-5xl font-black leading-[.96] tracking-[-.045em] sm:text-6xl">{title}</h1><p className="mt-6 max-w-3xl text-lg leading-8 text-white/65">{intro}</p></div></section>
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 sm:px-8 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-start">
        <article className="space-y-8">{children}</article>
        <aside className="rounded-3xl border border-black/10 bg-white p-6 lg:sticky lg:top-6"><Search className="h-6 w-6 text-[#B58B00]" /><h2 className="mt-4 text-lg font-black">Restaurant resources</h2><nav className="mt-4 grid gap-3 text-sm font-bold">{guideLinks.map(([label, href]) => <Link key={href} to={href} className="underline decoration-black/20 underline-offset-4 hover:decoration-[#B58B00]">{label}</Link>)}</nav><div className="my-6 border-t border-black/10" /><h2 className="text-sm font-black uppercase tracking-[.12em] text-black/45">Related software</h2><nav className="mt-4 grid gap-3 text-sm font-bold"><Link to="/restaurant-inventory-management-software">Inventory management</Link><Link to="/restaurant-food-cost-software">Food and recipe cost</Link><Link to="/restaurant-invoice-scanner">Invoice scanning</Link><Link to="/restaurant-ordering-forecasting-software">Ordering and forecasting</Link></nav><Link to="/product-tour" className="mt-6 inline-flex items-center gap-2 text-sm font-black text-[#8A6900]">Explore ZestIQ<ArrowRight className="h-4 w-4" /></Link></aside>
      </div>
    </main>
    <footer className="bg-[#303A43] text-white"><div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-8"><ZestIQBrand className="text-white" /><p className="text-sm text-white/50">Canadian restaurant operations intelligence</p></div></footer>
  </div>;
}

function GuideSection({ title, children }: { title: string; children: React.ReactNode }) { return <section className="rounded-3xl border border-black/8 bg-white p-6 shadow-sm sm:p-8"><h2 className="text-3xl font-black tracking-[-.025em]">{title}</h2><div className="mt-5 space-y-4 text-[17px] leading-8 text-black/65">{children}</div></section>; }
function Checklist({ items }: { items: string[] }) { return <ul className="grid gap-3">{items.map(item => <li key={item} className="flex gap-3"><Check className="mt-1.5 h-4 w-4 shrink-0 text-[#B58B00]" /><span>{item}</span></li>)}</ul>; }
function Faq({ items }: { items: Array<[string, string]> }) { return <section className="rounded-3xl bg-[#F5D62E] p-6 sm:p-8"><h2 className="text-3xl font-black">Frequently asked questions</h2><div className="mt-6 grid gap-5">{items.map(([q, a]) => <div key={q}><h3 className="text-lg font-black">{q}</h3><p className="mt-2 leading-7 text-black/60">{a}</p></div>)}</div></section>; }
function NumberField({ label, value, onChange, prefix, suffix }: { label: string; value: number; onChange: (value: number) => void; prefix?: string; suffix?: string }) { return <label><span className="text-xs font-black uppercase tracking-[.14em] text-white/55">{label}</span><span className="mt-2 flex h-14 items-center rounded-xl bg-white px-4 text-[#303A43]"><span className="font-black text-black/35">{prefix}</span><input type="number" min="0" step="0.01" value={value} onChange={e => onChange(Number(e.target.value))} className="min-w-0 flex-1 bg-transparent px-2 text-xl font-black outline-none" /><span className="font-black text-black/35">{suffix}</span></span></label>; }
function Result({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl bg-white/8 p-5"><p className="text-xs font-bold uppercase tracking-[.12em] text-white/45">{label}</p><p className="mt-2 text-3xl font-black text-[#F5D62E]">{value}</p></div>; }
