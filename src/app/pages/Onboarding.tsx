import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { ArrowLeft, ArrowRight, Building2, Check, CheckCircle2, ChefHat, ClipboardCheck, MapPin, PackagePlus, Plus, Rocket, Sparkles, Store, Truck } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth, type OnboardingStepId } from '../contexts/AuthContext';
import { useInventory } from '../contexts/InventoryContext';
import { createInventoryCount } from '../utils/inventoryCounts';

const STEPS: Array<{ id: OnboardingStepId; label: string; description: string; icon: typeof Store }> = [
  { id: 'restaurant', label: 'Restaurant', description: 'Confirm the business this workspace belongs to.', icon: Building2 },
  { id: 'location', label: 'First location', description: 'Name the kitchen your team will count and order for.', icon: MapPin },
  { id: 'suppliers', label: 'Suppliers', description: 'Add the vendors that appear on invoices and orders.', icon: Truck },
  { id: 'inventory', label: 'Inventory', description: 'Create the ingredients you buy, count, and cost.', icon: PackagePlus },
  { id: 'recipes', label: 'Recipes & menu', description: 'Connect a menu item to a real ingredient price.', icon: ChefHat },
  { id: 'count', label: 'First count', description: 'Set the opening stock baseline for this location.', icon: ClipboardCheck },
];

function FieldLabel({ htmlFor, children }: { htmlFor: string; children: ReactNode }) {
  return <label htmlFor={htmlFor} className="mb-1.5 block text-xs font-black uppercase tracking-[0.16em] text-slate-500">{children}</label>;
}

function SetupProgress({ currentStep, completedSteps }: { currentStep: OnboardingStepId; completedSteps: OnboardingStepId[] }) {
  const currentIndex = STEPS.findIndex(step => step.id === currentStep);
  return (
    <aside className="rounded-[28px] bg-[#0B1220] p-5 text-white lg:sticky lg:top-28 lg:self-start">
      <div className="flex items-center gap-3 border-b border-white/10 pb-5">
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[#F5C10E] text-[#0B1220]"><Rocket className="h-5 w-5" /></div>
        <div><p className="text-xs font-black uppercase tracking-[0.18em] text-white/45">First-run setup</p><p className="mt-1 font-black">Get useful data in</p></div>
      </div>
      <ol className="mt-5 grid grid-cols-3 gap-2 lg:grid-cols-1">
        {STEPS.map((step, index) => {
          const complete = completedSteps.includes(step.id);
          const active = step.id === currentStep;
          const Icon = step.icon;
          return (
            <li key={step.id} className={`flex items-center gap-3 rounded-2xl p-2.5 ${active ? 'bg-white text-[#0B1220]' : 'text-white/60'}`}>
              <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl ${complete ? 'bg-emerald-500 text-white' : active ? 'bg-[#F5C10E] text-[#0B1220]' : 'bg-white/10'}`}>{complete ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}</span>
              <span className="hidden lg:block"><span className="block text-[10px] font-black uppercase tracking-[0.16em] opacity-55">Step {index + 1}</span><span className="block text-sm font-bold">{step.label}</span></span>
              <span className="text-[10px] font-bold lg:hidden">{index + 1}</span>
            </li>
          );
        })}
      </ol>
      <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-[#F5C10E]" style={{ width: `${Math.max(8, ((currentIndex + 1) / STEPS.length) * 100)}%` }} /></div>
      <p className="mt-2 text-xs text-white/45">Progress saves to this company account.</p>
    </aside>
  );
}

function StepHeading({ step }: { step: (typeof STEPS)[number] }) {
  return <div><p className="text-xs font-black uppercase tracking-[0.2em] text-[#9A7600]">Step {STEPS.findIndex(item => item.id === step.id) + 1} of {STEPS.length}</p><h1 className="mt-2 text-3xl font-black tracking-[-0.03em] text-[#0B1220] sm:text-4xl">{step.label}</h1><p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">{step.description}</p></div>;
}

export function Onboarding() {
  const navigate = useNavigate();
  const {
    user, accountName, onboarding, locations, activeLocationId,
    updateAccountProfile, updateLocation, updateOnboarding,
  } = useAuth();
  const {
    inventory, suppliers, recipes, addSupplier, addInventoryItem, addRecipe,
    finalizeInventoryCount,
  } = useInventory();
  const [restaurantName, setRestaurantName] = useState(accountName);
  const [locationName, setLocationName] = useState(locations.find(location => location.id === activeLocationId)?.name || 'Main Location');
  const [supplierName, setSupplierName] = useState('');
  const [supplierCategory, setSupplierCategory] = useState('Food & Beverage');
  const [itemName, setItemName] = useState('');
  const [itemUnit, setItemUnit] = useState('each');
  const [itemCost, setItemCost] = useState('');
  const [itemStock, setItemStock] = useState('');
  const [itemSupplier, setItemSupplier] = useState('');
  const [recipeName, setRecipeName] = useState('');
  const [recipePrice, setRecipePrice] = useState('');
  const [recipeItemId, setRecipeItemId] = useState('');
  const [recipeQuantity, setRecipeQuantity] = useState('1');
  const [countValues, setCountValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const currentStep = STEPS.find(step => step.id === onboarding.currentStep) || STEPS[0];
  const completedSteps = onboarding.completedSteps || [];
  const stepIndex = STEPS.findIndex(step => step.id === currentStep.id);
  const canManage = user?.role === 'Owner' || user?.role === 'Admin';
  const primaryInventoryItem = inventory.find(item => item.id === recipeItemId) || inventory[0];
  const estimatedRecipeCost = primaryInventoryItem ? primaryInventoryItem.unitCost * (Number(recipeQuantity) || 0) : 0;
  const countTotal = useMemo(() => inventory.reduce((sum, item) => {
    const quantity = Number(countValues[item.id] ?? item.currentStock) || 0;
    return sum + quantity * item.unitCost;
  }, 0), [countValues, inventory]);

  const moveToStep = async (nextStep: OnboardingStepId, completed?: OnboardingStepId) => {
    const nextCompleted = completed && !completedSteps.includes(completed) ? [...completedSteps, completed] : completedSteps;
    await updateOnboarding({
      status: 'in_progress',
      currentStep: nextStep,
      completedSteps: nextCompleted,
      startedAt: onboarding.startedAt || new Date().toISOString(),
    });
  };

  const next = async (completed = currentStep.id) => {
    const following = STEPS[Math.min(stepIndex + 1, STEPS.length - 1)];
    await moveToStep(following.id, completed);
  };

  const skip = async () => {
    const following = STEPS[Math.min(stepIndex + 1, STEPS.length - 1)];
    await updateOnboarding({
      status: 'in_progress',
      currentStep: following.id,
      skippedSteps: onboarding.skippedSteps.includes(currentStep.id) ? onboarding.skippedSteps : [...onboarding.skippedSteps, currentStep.id],
      startedAt: onboarding.startedAt || new Date().toISOString(),
    });
  };

  const runStep = async (action: () => void | Promise<void>) => {
    setSaving(true);
    try {
      await action();
      await next();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Setup could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const saveRestaurant = (event: FormEvent) => {
    event.preventDefault();
    if (!restaurantName.trim()) return toast.error('Enter your restaurant name.');
    void runStep(() => updateAccountProfile(restaurantName));
  };

  const saveLocation = (event: FormEvent) => {
    event.preventDefault();
    if (!activeLocationId || !locationName.trim()) return toast.error('Enter a location name.');
    void runStep(() => updateLocation(activeLocationId, locationName));
  };

  const saveSupplier = (event: FormEvent) => {
    event.preventDefault();
    if (!supplierName.trim()) return toast.error('Enter a supplier name.');
    void runStep(() => addSupplier({
      name: supplierName.trim(), contactPerson: '', email: '', phone: '', address: '',
      category: supplierCategory, paymentTerms: '', notes: '', source: 'manual',
    }));
  };

  const saveItem = (event: FormEvent) => {
    event.preventDefault();
    if (!itemName.trim()) return toast.error('Enter an inventory item name.');
    void runStep(() => addInventoryItem({
      name: itemName.trim(), category: 'Uncategorized', storageArea: 'Unassigned',
      currentStock: Number(itemStock) || 0, unit: itemUnit, unitCost: Number(itemCost) || 0,
      parLevel: Math.max(Number(itemStock) || 0, 1), supplier: itemSupplier || suppliers[0]?.name || 'Not assigned',
    }));
  };

  const saveRecipe = (event: FormEvent) => {
    event.preventDefault();
    if (!recipeName.trim() || !primaryInventoryItem) return toast.error('Add a recipe name and at least one inventory item.');
    void runStep(() => addRecipe({
      menuItemName: recipeName.trim(), category: 'Menu', price: Number(recipePrice) || 0,
      ingredients: [{ inventoryItemId: primaryInventoryItem.id, quantity: Number(recipeQuantity) || 1, unit: primaryInventoryItem.unit }],
      source: 'manual',
    }));
  };

  const finishCount = async () => {
    if (inventory.length === 0) return toast.error('Add at least one inventory item before your first count.');
    const count = createInventoryCount(inventory, { description: 'Opening inventory count' });
    count.entries = count.entries.map(entry => {
      const counted = Number(countValues[entry.itemId] ?? entry.counted) || 0;
      return { ...entry, counted, value: counted * entry.unitCost };
    });
    count.value = count.entries.reduce((sum, entry) => sum + entry.value, 0);
    setSaving(true);
    try {
      finalizeInventoryCount(count);
      await updateOnboarding({
        status: 'completed', currentStep: 'count',
        completedSteps: STEPS.map(step => step.id), completedAt: new Date().toISOString(),
      });
      toast.success('Your ZestIQ workspace is ready.');
      navigate('/app');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'The count could not be finalized.');
    } finally {
      setSaving(false);
    }
  };

  if (!canManage) {
    return (
      <div className="mx-auto max-w-xl rounded-3xl bg-white p-8 text-center shadow-sm">
        <Building2 className="mx-auto h-12 w-12 text-[#F5C10E]" />
        <h1 className="mt-4 text-2xl font-black text-[#0B1220]">An owner or admin completes setup</h1>
        <p className="mt-2 text-slate-600">Your account is protected. Ask your company owner to finish the restaurant setup.</p>
        <Link to="/app" className="mt-6 inline-flex rounded-xl bg-[#0B1220] px-5 py-3 font-bold text-white">Back to dashboard</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl py-3 sm:py-6">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div><p className="text-xs font-black uppercase tracking-[0.18em] text-[#9A7600]">ZestIQ setup guide</p><p className="mt-1 text-sm text-slate-500">A useful workspace in six short steps.</p></div>
        <button type="button" onClick={() => navigate('/app')} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700">Save & exit</button>
      </div>
      <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
        <SetupProgress currentStep={currentStep.id} completedSteps={completedSteps} />
        <section className="rounded-[30px] border border-slate-100 bg-white p-5 shadow-sm sm:p-8">
          <StepHeading step={currentStep} />
          <div className="mt-8">
            {currentStep.id === 'restaurant' && (
              <form onSubmit={saveRestaurant} className="space-y-5">
                <div><FieldLabel htmlFor="restaurant-name">Restaurant or company name</FieldLabel><input id="restaurant-name" value={restaurantName} onChange={event => setRestaurantName(event.target.value)} className="h-13 w-full rounded-2xl border border-slate-200 px-4 text-base font-semibold outline-none focus:border-[#F5C10E]" placeholder="e.g. North & Vine" /></div>
                <div className="rounded-2xl bg-amber-50 p-4 text-sm leading-6 text-amber-900"><Sparkles className="mr-2 inline h-4 w-4" />This name stays inside your company workspace and appears on reports.</div>
                <StepActions saving={saving} onSkip={skip} label="Save restaurant" />
              </form>
            )}
            {currentStep.id === 'location' && (
              <form onSubmit={saveLocation} className="space-y-5">
                <div><FieldLabel htmlFor="location-name">Location name</FieldLabel><input id="location-name" value={locationName} onChange={event => setLocationName(event.target.value)} className="h-13 w-full rounded-2xl border border-slate-200 px-4 font-semibold outline-none focus:border-[#F5C10E]" placeholder="e.g. King Street" /></div>
                <p className="rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">Inventory, counts, invoices, recipes, labour and schedules are isolated by location. Additional locations can be added to your plan later.</p>
                <StepActions saving={saving} onSkip={skip} label="Save location" />
              </form>
            )}
            {currentStep.id === 'suppliers' && (
              <form onSubmit={saveSupplier} className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2"><div><FieldLabel htmlFor="supplier-name">Supplier name</FieldLabel><input id="supplier-name" value={supplierName} onChange={event => setSupplierName(event.target.value)} className="h-12 w-full rounded-2xl border border-slate-200 px-4" placeholder="e.g. GFS" /></div><div><FieldLabel htmlFor="supplier-category">Category</FieldLabel><input id="supplier-category" value={supplierCategory} onChange={event => setSupplierCategory(event.target.value)} className="h-12 w-full rounded-2xl border border-slate-200 px-4" /></div></div>
                {suppliers.length > 0 && <p className="text-sm text-emerald-700"><CheckCircle2 className="mr-1.5 inline h-4 w-4" />{suppliers.length} supplier{suppliers.length === 1 ? '' : 's'} already added.</p>}
                <StepActions saving={saving} onSkip={skip} label="Add supplier" />
              </form>
            )}
            {currentStep.id === 'inventory' && (
              <form onSubmit={saveItem} className="space-y-5">
                <div><FieldLabel htmlFor="item-name">First ingredient</FieldLabel><input id="item-name" value={itemName} onChange={event => setItemName(event.target.value)} className="h-12 w-full rounded-2xl border border-slate-200 px-4" placeholder="e.g. Extra virgin olive oil" /></div>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4"><div><FieldLabel htmlFor="item-unit">Count unit</FieldLabel><input id="item-unit" value={itemUnit} onChange={event => setItemUnit(event.target.value)} className="h-12 w-full rounded-2xl border border-slate-200 px-3" /></div><div><FieldLabel htmlFor="item-cost">Unit cost</FieldLabel><input id="item-cost" type="number" min="0" step="0.01" value={itemCost} onChange={event => setItemCost(event.target.value)} className="h-12 w-full rounded-2xl border border-slate-200 px-3" placeholder="0.00" /></div><div><FieldLabel htmlFor="item-stock">On hand</FieldLabel><input id="item-stock" type="number" min="0" step="0.01" value={itemStock} onChange={event => setItemStock(event.target.value)} className="h-12 w-full rounded-2xl border border-slate-200 px-3" placeholder="0" /></div><div><FieldLabel htmlFor="item-supplier">Supplier</FieldLabel><select id="item-supplier" value={itemSupplier} onChange={event => setItemSupplier(event.target.value)} className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-3"><option value="">Select</option>{suppliers.map(supplier => <option key={supplier.id} value={supplier.name}>{supplier.name}</option>)}</select></div></div>
                {inventory.length > 0 && <p className="text-sm text-emerald-700"><CheckCircle2 className="mr-1.5 inline h-4 w-4" />{inventory.length} inventory item{inventory.length === 1 ? '' : 's'} ready.</p>}
                <StepActions saving={saving} onSkip={skip} label="Add inventory item" />
              </form>
            )}
            {currentStep.id === 'recipes' && (
              <form onSubmit={saveRecipe} className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2"><div><FieldLabel htmlFor="recipe-name">Menu item</FieldLabel><input id="recipe-name" value={recipeName} onChange={event => setRecipeName(event.target.value)} className="h-12 w-full rounded-2xl border border-slate-200 px-4" placeholder="e.g. Margherita Pizza" /></div><div><FieldLabel htmlFor="recipe-price">Selling price</FieldLabel><input id="recipe-price" type="number" min="0" step="0.01" value={recipePrice} onChange={event => setRecipePrice(event.target.value)} className="h-12 w-full rounded-2xl border border-slate-200 px-4" placeholder="0.00" /></div></div>
                <div className="grid gap-4 sm:grid-cols-[1fr_140px]"><div><FieldLabel htmlFor="recipe-item">Ingredient</FieldLabel><select id="recipe-item" value={recipeItemId || inventory[0]?.id || ''} onChange={event => setRecipeItemId(event.target.value)} className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4"><option value="">Select an inventory item</option>{inventory.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div><div><FieldLabel htmlFor="recipe-quantity">Quantity</FieldLabel><input id="recipe-quantity" type="number" min="0" step="0.01" value={recipeQuantity} onChange={event => setRecipeQuantity(event.target.value)} className="h-12 w-full rounded-2xl border border-slate-200 px-4" /></div></div>
                <div className="rounded-2xl bg-[#0B1220] p-4 text-white"><p className="text-xs uppercase tracking-wider text-white/50">Live ingredient cost</p><p className="mt-1 text-2xl font-black">${estimatedRecipeCost.toFixed(2)}</p><p className="mt-1 text-xs text-white/55">Future invoice price changes will flow into this recipe.</p></div>
                <StepActions saving={saving} onSkip={skip} label="Create recipe" />
              </form>
            )}
            {currentStep.id === 'count' && (
              <div className="space-y-5">
                <div className="max-h-[390px] space-y-2 overflow-auto rounded-2xl border border-slate-100 p-2">{inventory.map(item => <label key={item.id} className="grid grid-cols-[1fr_100px] items-center gap-3 rounded-xl p-3 hover:bg-slate-50"><span className="min-w-0"><span className="block break-words font-bold text-slate-900">{item.name}</span><span className="text-xs text-slate-500">${item.unitCost.toFixed(2)} / {item.unit}</span></span><input aria-label={`${item.name} count`} type="number" min="0" step="0.01" value={countValues[item.id] ?? String(item.currentStock)} onChange={event => setCountValues(current => ({ ...current, [item.id]: event.target.value }))} className="h-11 rounded-xl border border-slate-200 px-3 text-right font-bold" /></label>)}</div>
                <div className="flex items-center justify-between rounded-2xl bg-emerald-50 p-4"><span className="font-bold text-emerald-950">Opening inventory value</span><span className="text-xl font-black text-emerald-800">${countTotal.toFixed(2)}</span></div>
                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between"><button type="button" onClick={() => moveToStep(STEPS[Math.max(0, stepIndex - 1)].id)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-5 py-3 font-bold text-slate-700"><ArrowLeft className="h-4 w-4" />Back</button><button type="button" disabled={saving} onClick={() => void finishCount()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#F5C10E] px-5 py-3 font-black text-[#0B1220] disabled:opacity-50">Finish setup<CheckCircle2 className="h-5 w-5" /></button></div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function StepActions({ saving, onSkip, label }: { saving: boolean; onSkip: () => Promise<void>; label: string }) {
  return (
    <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
      <button type="button" onClick={() => void onSkip()} className="rounded-xl px-4 py-3 text-sm font-bold text-slate-500 hover:bg-slate-50">Skip for now</button>
      <button type="submit" disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#F5C10E] px-5 py-3 font-black text-[#0B1220] disabled:opacity-50">{saving ? 'Saving…' : label}<ArrowRight className="h-4 w-4" /></button>
    </div>
  );
}
