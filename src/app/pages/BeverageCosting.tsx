import { useMemo, useState } from 'react';
import { Beer, Calculator, ExternalLink, GlassWater, PackagePlus, Plus, Trash2, Wine } from 'lucide-react';
import { Link } from 'react-router';
import { useInventory, type InventoryItem } from '../contexts/InventoryContext';
import { useAuth } from '../contexts/AuthContext';
import { buildDemoLocationData } from '../utils/demoData';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { toast } from 'sonner';
import { convertIngredientQuantity, formatUnitLabel, getIngredientCompatibleUnits, normalizeUnit } from '../utils/unitConversion';

const BEVERAGE_WORDS = ['beverage', 'wine', 'beer', 'liquor', 'spirit', 'cocktail', 'bar'];
const isBeverage = (value = '') => BEVERAGE_WORDS.some(word => value.toLowerCase().includes(word));
type IngredientSelection = { inventoryItemId: string; quantity: number; unit: string };
const DEMO_COST_INVENTORY = buildDemoLocationData().inventory as unknown as InventoryItem[];

export function BeverageCosting() {
  const { inventory, recipes, updateRecipe } = useInventory();
  const { user } = useAuth();
  const isDemoAccount = user?.email?.trim().toLowerCase() === 'demo@zestiq.com';
  const [bottleCost, setBottleCost] = useState(30);
  const [bottleSize, setBottleSize] = useState(750);
  const [pourSizeOz, setPourSizeOz] = useState(1.5);
  const [extrasCost, setExtrasCost] = useState(0.65);
  const [sellingPrice, setSellingPrice] = useState(15);
  const [editingRecipeId, setEditingRecipeId] = useState<string | null>(null);
  const [editingRecipeName, setEditingRecipeName] = useState('');
  const [editingRecipeCategory, setEditingRecipeCategory] = useState('');
  const [editingRecipePrice, setEditingRecipePrice] = useState('');
  const [editingRecipeIngredients, setEditingRecipeIngredients] = useState<IngredientSelection[]>([]);
  const [newIngredientId, setNewIngredientId] = useState('');
  const beverageInventory = inventory.filter(item => isBeverage(item.category) || isBeverage(item.storageArea) || isBeverage(item.name));
  const beverageRecipes = recipes.filter(recipe => isBeverage(recipe.category) || recipe.ingredients.some(ingredient => beverageInventory.some(item => item.id === ingredient.inventoryItemId)));
  const inventoryValue = beverageInventory.reduce((sum, item) => sum + item.currentStock * item.unitCost, 0);
  const lowStock = beverageInventory.filter(item => item.currentStock < item.parLevel * 0.5);
  const pourSizeMl = pourSizeOz * 29.5735;
  const bottleYield = pourSizeMl > 0 ? bottleSize / pourSizeMl : 0;
  const costPerPour = bottleYield > 0 ? bottleCost / bottleYield + extrasCost : 0;
  const beverageCostPercent = sellingPrice > 0 ? (costPerPour / sellingPrice) * 100 : 0;
  const grossProfit = sellingPrice - costPerPour;

  const calculateIngredientLineCost = (ingredient: IngredientSelection) => {
    const item = inventory.find(candidate => candidate.id === ingredient.inventoryItemId)
      || (isDemoAccount ? DEMO_COST_INVENTORY.find(candidate => candidate.id === ingredient.inventoryItemId) : undefined);
    if (!item) return 0;
    const quantityInInventoryUnit = convertIngredientQuantity(item, ingredient.quantity, ingredient.unit || item.unit, item.unit);
    return quantityInInventoryUnit === null ? 0 : quantityInInventoryUnit * item.unitCost;
  };
  const recipeRows = useMemo(() => beverageRecipes.map(recipe => {
    const cost = recipe.ingredients.reduce((sum, ingredient) => sum + calculateIngredientLineCost(ingredient), 0);
    return { ...recipe, cost, costPercent: recipe.price > 0 ? (cost / recipe.price) * 100 : 0 };
  }).sort((left, right) => right.costPercent - left.costPercent), [beverageRecipes, inventory, isDemoAccount]);
  const editingRecipe = recipeRows.find(recipe => recipe.id === editingRecipeId) || null;
  const openRecipeEditor = (recipe: typeof recipeRows[number]) => {
    setEditingRecipeId(recipe.id);
    setEditingRecipeName(recipe.menuItemName);
    setEditingRecipeCategory(recipe.category);
    setEditingRecipePrice(String(recipe.price));
    setEditingRecipeIngredients(recipe.ingredients.map(ingredient => ({
      ...ingredient,
      unit: ingredient.unit || inventory.find(item => item.id === ingredient.inventoryItemId)?.unit || '',
    })));
    setNewIngredientId('');
  };
  const editingIngredientCost = editingRecipeIngredients.reduce((sum, ingredient) => sum + calculateIngredientLineCost(ingredient), 0);
  const editingPrice = Number(editingRecipePrice || 0);
  const editingCostPercent = editingPrice > 0 ? (editingIngredientCost / editingPrice) * 100 : 0;
  const editingGrossMargin = editingPrice - editingIngredientCost;
  const addIngredient = () => {
    if (!newIngredientId) return;
    const item = inventory.find(candidate => candidate.id === newIngredientId);
    if (!item) return;
    if (editingRecipeIngredients.some(ingredient => ingredient.inventoryItemId === item.id)) return toast.error('Ingredient already added.');
    setEditingRecipeIngredients(current => [...current, { inventoryItemId: item.id, quantity: 0, unit: item.unit }]);
    setNewIngredientId('');
  };
  const updateIngredientQuantity = (itemId: string, quantity: number) => {
    setEditingRecipeIngredients(current => current.map(ingredient => ingredient.inventoryItemId === itemId ? { ...ingredient, quantity } : ingredient));
  };
  const updateIngredientUnit = (itemId: string, unit: string) => {
    const item = inventory.find(candidate => candidate.id === itemId);
    setEditingRecipeIngredients(current => current.map(ingredient => {
      if (ingredient.inventoryItemId !== itemId) return ingredient;
      const convertedQuantity = item ? convertIngredientQuantity(item, ingredient.quantity, ingredient.unit || item.unit, unit) : null;
      return { ...ingredient, unit, quantity: convertedQuantity ?? ingredient.quantity };
    }));
  };
  const saveRecipeEditor = () => {
    if (!editingRecipe || !editingRecipeName.trim()) return toast.error('Enter a menu item name.');
    const price = Number(editingRecipePrice);
    if (!Number.isFinite(price) || price < 0) return toast.error('Enter a valid selling price.');
    const invalidIngredient = editingRecipeIngredients.find(ingredient => {
      const item = inventory.find(candidate => candidate.id === ingredient.inventoryItemId);
      return !item || ingredient.quantity <= 0 || convertIngredientQuantity(item, ingredient.quantity, ingredient.unit, item.unit) === null;
    });
    if (invalidIngredient) return toast.error('Every ingredient needs a quantity and a compatible unit.');
    updateRecipe(editingRecipe.id, {
      menuItemName: editingRecipeName.trim(),
      category: editingRecipeCategory.trim() || 'Beverage',
      price,
      ingredients: editingRecipeIngredients,
    });
    setEditingRecipeId(null);
    toast.success('Beverage menu item updated.');
  };

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <section className="overflow-hidden rounded-[30px] bg-[#303A43] p-6 text-white sm:p-8"><div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end"><div><p className="text-xs font-black uppercase tracking-[0.2em] text-[#F5D62E]">Full restaurant mode</p><h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Liquor, wine & beer costing.</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-white/60">Track bottle and case inventory, calculate yields and pour cost, and see which drinks are protecting—or draining—beverage margin.</p></div><Link to="/app/inventory" className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#F5D62E] px-4 py-3 font-black text-[#303A43]"><PackagePlus className="h-4 w-4" />Manage bar inventory</Link></div></section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4"><Metric icon={Wine} label="Beverage inventory" value={`$${inventoryValue.toLocaleString('en-CA', { maximumFractionDigits: 0 })}`} /><Metric icon={Wine} label="Costed drinks" value={String(beverageRecipes.length)} /><Metric icon={Beer} label="Below bar par" value={String(lowStock.length)} warning={lowStock.length > 0} /><Metric icon={GlassWater} label="Calculator pour cost" value={`${beverageCostPercent.toFixed(1)}%`} warning={beverageCostPercent > 25} /></section>

      <div className="grid gap-5 xl:grid-cols-[0.82fr_1.18fr]">
        <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-6"><div className="flex items-center gap-2"><Calculator className="h-5 w-5 text-[#B58B00]" /><h2 className="font-black">Pour-cost calculator</h2></div><p className="mt-2 text-sm leading-6 text-slate-500">Model any cocktail, glass of wine or spirit pour.</p><div className="mt-5 grid grid-cols-2 gap-3"><NumberField label="Bottle cost (CAD)" value={bottleCost} onChange={setBottleCost} step={0.01} /><NumberField label="Bottle size (ml)" value={bottleSize} onChange={setBottleSize} /><NumberField label="Pour size (oz)" value={pourSizeOz} onChange={setPourSizeOz} step={0.25} /><NumberField label="Mixers & garnish" value={extrasCost} onChange={setExtrasCost} step={0.01} /><div className="col-span-2"><NumberField label="Menu price (CAD)" value={sellingPrice} onChange={setSellingPrice} step={0.01} /></div></div><div className="mt-5 grid grid-cols-2 gap-3"><Result label="Pours per bottle" value={bottleYield.toFixed(1)} /><Result label="Cost per drink" value={`$${costPerPour.toFixed(2)}`} /><Result label="Beverage cost" value={`${beverageCostPercent.toFixed(1)}%`} tone={beverageCostPercent > 25 ? 'warning' : 'good'} /><Result label="Gross profit" value={`$${grossProfit.toFixed(2)}`} tone="good" /></div><p className="mt-4 text-[11px] leading-5 text-slate-400">Bottle yield is theoretical. Pour ounces are converted to millilitres for the bottle-yield calculation. Track spills, comps and over-pours through waste and variance to compare actual performance.</p></section>

        <section className="overflow-hidden rounded-3xl bg-white shadow-sm"><div className="border-b border-slate-100 p-5"><h2 className="font-black">Beverage menu margin</h2><p className="mt-1 text-sm text-slate-500">Recipe costs update when bottle or case prices change. Select an item to edit it.</p></div><div className="divide-y divide-slate-100">{recipeRows.map(recipe => <button type="button" key={recipe.id} onClick={() => openRecipeEditor(recipe)} className="grid w-full grid-cols-[minmax(0,1fr)_auto] gap-4 p-4 text-left transition hover:bg-amber-50/60 sm:grid-cols-[minmax(180px,1fr)_110px_110px_110px]"><div className="min-w-0"><p className="break-words font-black text-slate-900">{recipe.menuItemName}</p><p className="mt-1 text-xs text-slate-500">{recipe.category} · {recipe.ingredients.length} component{recipe.ingredients.length === 1 ? '' : 's'}</p></div><div className="text-right sm:text-left"><p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Cost</p><p className="mt-1 font-black">${recipe.cost.toFixed(2)}</p></div><div className="hidden sm:block"><p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Price</p><p className="mt-1 font-black">${recipe.price.toFixed(2)}</p></div><div className="hidden sm:block"><p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Cost %</p><p className={`mt-1 font-black ${recipe.costPercent > 25 ? 'text-red-600' : 'text-emerald-600'}`}>{recipe.costPercent.toFixed(1)}%</p></div></button>)}{recipeRows.length === 0 && <div className="p-10 text-center"><Wine className="mx-auto h-10 w-10 text-slate-300" /><p className="mt-3 font-bold text-slate-600">No beverage recipes yet</p><Link to="/app/recipes" className="mt-3 inline-flex items-center gap-1 text-sm font-black text-[#9A7600]">Cost your first drink<ExternalLink className="h-3.5 w-3.5" /></Link></div>}</div></section>
      </div>

      <section className="overflow-hidden rounded-3xl bg-white shadow-sm"><div className="border-b border-slate-100 p-5"><h2 className="font-black">Bar, wine cellar & beer stock</h2><p className="mt-1 text-sm text-slate-500">The same supplier and invoice price history used for food inventory.</p></div><div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">{beverageInventory.map(item => <Link to={`/app/inventory/${item.id}`} key={item.id} className="rounded-2xl border border-slate-100 p-4 transition hover:border-amber-200 hover:bg-amber-50/30"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="break-words font-black text-slate-900">{item.name}</p><p className="mt-1 break-words text-xs text-slate-500">{item.category} · {item.supplier}</p></div><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black">{item.storageArea || 'Bar'}</span></div><div className="mt-4 grid grid-cols-3 gap-2 text-xs"><div><p className="text-slate-400">On hand</p><p className="mt-1 font-black">{item.currentStock} {item.unit}</p></div><div><p className="text-slate-400">Par</p><p className="mt-1 font-black">{item.parLevel}</p></div><div><p className="text-slate-400">Unit cost</p><p className="mt-1 font-black">${item.unitCost.toFixed(2)}</p></div></div></Link>)}</div></section>
      <Dialog open={Boolean(editingRecipeId)} onOpenChange={open => !open && setEditingRecipeId(null)}>
        <DialogContent className="max-h-[90vh] max-w-[calc(100vw-2rem)] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Cost beverage menu item</DialogTitle>
            <DialogDescription>Edit the recipe exactly like any other menu item. Ingredient quantities and current inventory prices calculate the live beverage cost and margin.</DialogDescription>
          </DialogHeader>
          {editingRecipe && (
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-3">
                <label className="block sm:col-span-1">
                  <span className="mb-1 block text-xs font-black uppercase tracking-wider text-slate-500">Menu item name</span>
                  <Input value={editingRecipeName} onChange={event => setEditingRecipeName(event.target.value)} className="h-11 rounded-xl font-bold" />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-black uppercase tracking-wider text-slate-500">Category</span>
                  <Input value={editingRecipeCategory} onChange={event => setEditingRecipeCategory(event.target.value)} className="h-11 rounded-xl font-bold" />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-black uppercase tracking-wider text-slate-500">Selling price (CAD)</span>
                  <Input type="number" min="0" step="0.01" value={editingRecipePrice} onChange={event => setEditingRecipePrice(event.target.value)} className="h-11 rounded-xl font-bold" />
                </label>
              </div>

              <section className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <label className="min-w-0 flex-1">
                    <span className="mb-1 block text-xs font-black uppercase tracking-wider text-slate-500">Add ingredient from inventory</span>
                    <select value={newIngredientId} onChange={event => setNewIngredientId(event.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800">
                      <option value="">Choose an inventory item…</option>
                      {inventory.slice().sort((left, right) => left.name.localeCompare(right.name)).map(item => (
                        <option key={item.id} value={item.id}>{item.name} · ${item.unitCost.toFixed(2)}/{formatUnitLabel(item.unit)}</option>
                      ))}
                    </select>
                  </label>
                  <button type="button" onClick={addIngredient} disabled={!newIngredientId} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#303A43] px-4 font-black text-white disabled:cursor-not-allowed disabled:opacity-40">
                    <Plus className="h-4 w-4" /> Add ingredient
                  </button>
                </div>

                <div className="mt-4 space-y-3">
                  {editingRecipeIngredients.map(ingredient => {
                    const item = inventory.find(candidate => candidate.id === ingredient.inventoryItemId);
                    if (!item) return null;
                    const normalizedUnit = normalizeUnit(ingredient.unit || item.unit);
                    const unitOptions = getIngredientCompatibleUnits(item);
                    const availableUnits = unitOptions.some(option => option.value === normalizedUnit) ? unitOptions : [...unitOptions, { value: normalizedUnit, label: formatUnitLabel(normalizedUnit) }];
                    return (
                      <div key={ingredient.inventoryItemId} className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-3 md:grid-cols-[minmax(180px,1.4fr)_110px_130px_100px_44px] md:items-end">
                        <div className="min-w-0">
                          <p className="truncate font-black text-slate-900">{item.name}</p>
                          <p className="mt-1 truncate text-[11px] text-slate-500">Base cost ${item.unitCost.toFixed(2)}/{formatUnitLabel(item.unit)} · {item.supplier}</p>
                        </div>
                        <label>
                          <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-400">Quantity</span>
                          <Input type="number" min="0" step="0.01" value={ingredient.quantity} onChange={event => updateIngredientQuantity(ingredient.inventoryItemId, Number(event.target.value))} className="h-10 rounded-lg" />
                        </label>
                        <label>
                          <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-400">Unit</span>
                          <select value={normalizedUnit} onChange={event => updateIngredientUnit(ingredient.inventoryItemId, event.target.value)} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm font-semibold">
                            {availableUnits.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                          </select>
                        </label>
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Line cost</p>
                          <p className="mt-2 font-black text-slate-900">${calculateIngredientLineCost(ingredient).toFixed(2)}</p>
                        </div>
                        <button type="button" aria-label={`Remove ${item.name}`} onClick={() => setEditingRecipeIngredients(current => current.filter(entry => entry.inventoryItemId !== ingredient.inventoryItemId))} className="flex h-10 w-10 items-center justify-center rounded-lg border border-red-100 text-red-600 transition hover:bg-red-50">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })}
                  {editingRecipeIngredients.length === 0 && <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm font-semibold text-slate-500">Add ingredients to calculate this beverage recipe.</div>}
                </div>
              </section>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Result label="Ingredients" value={String(editingRecipeIngredients.length)} />
                <Result label="Recipe cost" value={`$${editingIngredientCost.toFixed(2)}`} />
                <Result label="Beverage cost" value={`${editingCostPercent.toFixed(1)}%`} tone={editingCostPercent > 25 ? 'warning' : 'good'} />
                <Result label="Gross margin" value={`$${editingGrossMargin.toFixed(2)}`} tone={editingGrossMargin >= 0 ? 'good' : 'warning'} />
              </div>

              <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
                <button type="button" onClick={() => setEditingRecipeId(null)} className="rounded-xl border border-slate-200 px-5 py-2.5 font-bold text-slate-700">Cancel</button>
                <button type="button" onClick={saveRecipeEditor} className="rounded-xl bg-[#F5D62E] px-5 py-2.5 font-black text-[#303A43]">Save recipe costing</button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Metric({ icon: Icon, label, value, warning = false }: { icon: typeof Wine; label: string; value: string; warning?: boolean }) { return <div className={`rounded-2xl border p-4 ${warning ? 'border-red-100 bg-red-50' : 'border-slate-100 bg-white'}`}><div className="flex items-center gap-2 text-xs font-bold text-slate-500"><Icon className="h-4 w-4" />{label}</div><p className={`mt-2 text-xl font-black ${warning ? 'text-red-700' : 'text-slate-900'}`}>{value}</p></div>; }
function NumberField({ label, value, onChange, step = 1 }: { label: string; value: number; onChange: (value: number) => void; step?: number }) { return <label><span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-500">{label}</span><Input type="number" min="0" step={step} value={value} onChange={event => onChange(Number(event.target.value) || 0)} className="h-11 w-full rounded-xl border border-slate-200 px-3 font-bold" /></label>; }
function Result({ label, value, tone = 'normal' }: { label: string; value: string; tone?: 'normal' | 'good' | 'warning' }) { return <div className={`rounded-2xl p-3 ${tone === 'warning' ? 'bg-red-50' : tone === 'good' ? 'bg-emerald-50' : 'bg-slate-50'}`}><p className="text-[9px] font-black uppercase tracking-wider text-slate-400">{label}</p><p className={`mt-1 text-lg font-black ${tone === 'warning' ? 'text-red-700' : tone === 'good' ? 'text-emerald-700' : 'text-slate-900'}`}>{value}</p></div>; }
