import { useMemo, useState } from 'react';
import { Beer, Calculator, ExternalLink, GlassWater, PackagePlus, Wine } from 'lucide-react';
import { Link } from 'react-router';
import { useInventory } from '../contexts/InventoryContext';

const BEVERAGE_WORDS = ['beverage', 'wine', 'beer', 'liquor', 'spirit', 'cocktail', 'bar'];
const isBeverage = (value = '') => BEVERAGE_WORDS.some(word => value.toLowerCase().includes(word));

export function BeverageCosting() {
  const { inventory, recipes } = useInventory();
  const [bottleCost, setBottleCost] = useState(30);
  const [bottleSize, setBottleSize] = useState(750);
  const [pourSize, setPourSize] = useState(44);
  const [extrasCost, setExtrasCost] = useState(0.65);
  const [sellingPrice, setSellingPrice] = useState(15);
  const beverageInventory = inventory.filter(item => isBeverage(item.category) || isBeverage(item.storageArea) || isBeverage(item.name));
  const beverageRecipes = recipes.filter(recipe => isBeverage(recipe.category) || recipe.ingredients.some(ingredient => beverageInventory.some(item => item.id === ingredient.inventoryItemId)));
  const inventoryValue = beverageInventory.reduce((sum, item) => sum + item.currentStock * item.unitCost, 0);
  const lowStock = beverageInventory.filter(item => item.currentStock < item.parLevel * 0.5);
  const bottleYield = pourSize > 0 ? bottleSize / pourSize : 0;
  const costPerPour = bottleYield > 0 ? bottleCost / bottleYield + extrasCost : 0;
  const beverageCostPercent = sellingPrice > 0 ? (costPerPour / sellingPrice) * 100 : 0;
  const grossProfit = sellingPrice - costPerPour;

  const recipeRows = useMemo(() => beverageRecipes.map(recipe => {
    const cost = recipe.ingredients.reduce((sum, ingredient) => {
      const item = inventory.find(candidate => candidate.id === ingredient.inventoryItemId);
      return sum + (item ? item.unitCost * ingredient.quantity : 0);
    }, 0);
    return { ...recipe, cost, costPercent: recipe.price > 0 ? (cost / recipe.price) * 100 : 0 };
  }).sort((left, right) => right.costPercent - left.costPercent), [beverageRecipes, inventory]);

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <section className="overflow-hidden rounded-[30px] bg-[#0B1220] p-6 text-white sm:p-8"><div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end"><div><p className="text-xs font-black uppercase tracking-[0.2em] text-[#F5C10E]">Full restaurant mode</p><h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Liquor, wine & beer costing.</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-white/60">Track bottle and case inventory, calculate yields and pour cost, and see which drinks are protecting—or draining—beverage margin.</p></div><Link to="/app/inventory" className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#F5C10E] px-4 py-3 font-black text-[#0B1220]"><PackagePlus className="h-4 w-4" />Manage bar inventory</Link></div></section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4"><Metric icon={Wine} label="Beverage inventory" value={`$${inventoryValue.toLocaleString('en-CA', { maximumFractionDigits: 0 })}`} /><Metric icon={Wine} label="Costed drinks" value={String(beverageRecipes.length)} /><Metric icon={Beer} label="Below bar par" value={String(lowStock.length)} warning={lowStock.length > 0} /><Metric icon={GlassWater} label="Calculator pour cost" value={`${beverageCostPercent.toFixed(1)}%`} warning={beverageCostPercent > 25} /></section>

      <div className="grid gap-5 xl:grid-cols-[0.82fr_1.18fr]">
        <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-6"><div className="flex items-center gap-2"><Calculator className="h-5 w-5 text-[#B58B00]" /><h2 className="font-black">Pour-cost calculator</h2></div><p className="mt-2 text-sm leading-6 text-slate-500">Model any cocktail, glass of wine or spirit pour.</p><div className="mt-5 grid grid-cols-2 gap-3"><NumberField label="Bottle cost (CAD)" value={bottleCost} onChange={setBottleCost} step={0.01} /><NumberField label="Bottle size (ml)" value={bottleSize} onChange={setBottleSize} /><NumberField label="Pour size (ml)" value={pourSize} onChange={setPourSize} /><NumberField label="Mixers & garnish" value={extrasCost} onChange={setExtrasCost} step={0.01} /><div className="col-span-2"><NumberField label="Menu price (CAD)" value={sellingPrice} onChange={setSellingPrice} step={0.01} /></div></div><div className="mt-5 grid grid-cols-2 gap-3"><Result label="Pours per bottle" value={bottleYield.toFixed(1)} /><Result label="Cost per drink" value={`$${costPerPour.toFixed(2)}`} /><Result label="Beverage cost" value={`${beverageCostPercent.toFixed(1)}%`} tone={beverageCostPercent > 25 ? 'warning' : 'good'} /><Result label="Gross profit" value={`$${grossProfit.toFixed(2)}`} tone="good" /></div><p className="mt-4 text-[11px] leading-5 text-slate-400">Bottle yield is theoretical. Track spills, comps and over-pours through waste and variance to compare actual performance.</p></section>

        <section className="overflow-hidden rounded-3xl bg-white shadow-sm"><div className="border-b border-slate-100 p-5"><h2 className="font-black">Beverage menu margin</h2><p className="mt-1 text-sm text-slate-500">Recipe costs update when bottle or case prices change.</p></div><div className="divide-y divide-slate-100">{recipeRows.map(recipe => <div key={recipe.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 p-4 sm:grid-cols-[minmax(180px,1fr)_110px_110px_110px]"><div className="min-w-0"><p className="break-words font-black text-slate-900">{recipe.menuItemName}</p><p className="mt-1 text-xs text-slate-500">{recipe.category} · {recipe.ingredients.length} component{recipe.ingredients.length === 1 ? '' : 's'}</p></div><div className="text-right sm:text-left"><p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Cost</p><p className="mt-1 font-black">${recipe.cost.toFixed(2)}</p></div><div className="hidden sm:block"><p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Price</p><p className="mt-1 font-black">${recipe.price.toFixed(2)}</p></div><div className="hidden sm:block"><p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Cost %</p><p className={`mt-1 font-black ${recipe.costPercent > 25 ? 'text-red-600' : 'text-emerald-600'}`}>{recipe.costPercent.toFixed(1)}%</p></div></div>)}{recipeRows.length === 0 && <div className="p-10 text-center"><Wine className="mx-auto h-10 w-10 text-slate-300" /><p className="mt-3 font-bold text-slate-600">No beverage recipes yet</p><Link to="/app/recipes" className="mt-3 inline-flex items-center gap-1 text-sm font-black text-[#9A7600]">Cost your first drink<ExternalLink className="h-3.5 w-3.5" /></Link></div>}</div></section>
      </div>

      <section className="overflow-hidden rounded-3xl bg-white shadow-sm"><div className="border-b border-slate-100 p-5"><h2 className="font-black">Bar, wine cellar & beer stock</h2><p className="mt-1 text-sm text-slate-500">The same supplier and invoice price history used for food inventory.</p></div><div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">{beverageInventory.map(item => <Link to={`/app/inventory/${item.id}`} key={item.id} className="rounded-2xl border border-slate-100 p-4 transition hover:border-amber-200 hover:bg-amber-50/30"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="break-words font-black text-slate-900">{item.name}</p><p className="mt-1 break-words text-xs text-slate-500">{item.category} · {item.supplier}</p></div><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black">{item.storageArea || 'Bar'}</span></div><div className="mt-4 grid grid-cols-3 gap-2 text-xs"><div><p className="text-slate-400">On hand</p><p className="mt-1 font-black">{item.currentStock} {item.unit}</p></div><div><p className="text-slate-400">Par</p><p className="mt-1 font-black">{item.parLevel}</p></div><div><p className="text-slate-400">Unit cost</p><p className="mt-1 font-black">${item.unitCost.toFixed(2)}</p></div></div></Link>)}</div></section>
    </div>
  );
}

function Metric({ icon: Icon, label, value, warning = false }: { icon: typeof Wine; label: string; value: string; warning?: boolean }) { return <div className={`rounded-2xl border p-4 ${warning ? 'border-red-100 bg-red-50' : 'border-slate-100 bg-white'}`}><div className="flex items-center gap-2 text-xs font-bold text-slate-500"><Icon className="h-4 w-4" />{label}</div><p className={`mt-2 text-xl font-black ${warning ? 'text-red-700' : 'text-slate-900'}`}>{value}</p></div>; }
function NumberField({ label, value, onChange, step = 1 }: { label: string; value: number; onChange: (value: number) => void; step?: number }) { return <label><span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-500">{label}</span><input type="number" min="0" step={step} value={value} onChange={event => onChange(Number(event.target.value) || 0)} className="h-11 w-full rounded-xl border border-slate-200 px-3 font-bold" /></label>; }
function Result({ label, value, tone = 'normal' }: { label: string; value: string; tone?: 'normal' | 'good' | 'warning' }) { return <div className={`rounded-2xl p-3 ${tone === 'warning' ? 'bg-red-50' : tone === 'good' ? 'bg-emerald-50' : 'bg-slate-50'}`}><p className="text-[9px] font-black uppercase tracking-wider text-slate-400">{label}</p><p className={`mt-1 text-lg font-black ${tone === 'warning' ? 'text-red-700' : tone === 'good' ? 'text-emerald-700' : 'text-slate-900'}`}>{value}</p></div>; }
