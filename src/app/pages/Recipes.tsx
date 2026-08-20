import { useState, useEffect, useMemo } from 'react';
import { useInventory } from '../contexts/InventoryContext';
import { useToast } from '../contexts/ToastContext';
import { useLocation, useNavigate } from 'react-router';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Badge } from '../components/ui/badge';
import { Plus, ChefHat, Trash2, Edit, RefreshCw, Camera } from 'lucide-react';
import { toast as showToast } from 'sonner';
import { RecipeScan, type ScannedRecipeData } from '../components/RecipeScan';
import { convertQuantity, formatUnitLabel, getCompatibleUnits, normalizeUnit } from '../utils/unitConversion';

type IngredientSelection = { inventoryItemId: string; quantity: number; unit: string };

function IngredientAutocomplete({
  inventory,
  onAddIngredient,
}: {
  inventory: { id: string; name: string; unit: string; supplier: string; unitCost: number }[];
  onAddIngredient: (itemId: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  const matches = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return inventory.slice(0, 8);

    return inventory
      .map(item => {
        const name = item.name.toLowerCase();
        const supplier = item.supplier.toLowerCase();
        const nameIndex = name.indexOf(normalized);
        const supplierIndex = supplier.indexOf(normalized);
        const score = name.startsWith(normalized)
          ? 0
          : nameIndex >= 0
            ? nameIndex + 1
            : supplier.startsWith(normalized)
              ? 50
              : supplierIndex >= 0
                ? supplierIndex + 51
                : 999;
        return { item, score };
      })
      .filter(entry => entry.score < 999)
      .sort((left, right) => left.score - right.score || left.item.name.localeCompare(right.item.name))
      .slice(0, 8)
      .map(entry => entry.item);
  }, [inventory, query]);

  const addItem = (itemId: string) => {
    onAddIngredient(itemId);
    setQuery('');
    setOpen(false);
  };

  return (
    <div className="space-y-2">
      <Input
        value={query}
        onChange={event => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={event => {
          if (event.key === 'Enter' && matches[0]) {
            event.preventDefault();
            addItem(matches[0].id);
          }
        }}
        onBlur={() => {
          window.setTimeout(() => setOpen(false), 150);
        }}
        placeholder="Start typing an inventory item..."
        className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
      />

      {open && matches.length > 0 && (
        <div className="max-h-56 overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
            Closest matches
          </div>
          <div className="divide-y divide-slate-100">
            {matches.map(item => (
              <button
                key={item.id}
                type="button"
                onMouseDown={event => event.preventDefault()}
                onClick={() => addItem(item.id)}
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-slate-50"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">{item.name}</p>
                  <p className="truncate text-[11px] text-slate-500">
                    {item.unit} unit • {item.supplier}
                  </p>
                </div>
                <div className="shrink-0 text-right text-[11px] text-slate-500">
                  ${item.unitCost.toFixed(2)}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {open && query.trim() && matches.length === 0 && (
        <p className="text-xs text-slate-500">No inventory items match “{query.trim()}”.</p>
      )}
    </div>
  );
}

export function Recipes() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    inventory,
    recipes,
    preppedRecipes,
    addRecipe,
    updateRecipe,
    deleteRecipe,
    syncToastMenuItems,
    addPreppedRecipe,
    updatePreppedRecipe,
    deletePreppedRecipe,
  } = useInventory();
  const { isConnected, menuItems } = useToast();
  const toastMenuItemOptions = useMemo(() => menuItems.slice().sort((left, right) => left.name.localeCompare(right.name)), [menuItems]);

  const topSellerName = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('menuItem') || '';
  }, [location.search]);
  const normalizedTopSellerName = topSellerName.trim().toLowerCase();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isScanOpen, setIsScanOpen] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<string | null>(null);
  const [recipeMenuItemName, setRecipeMenuItemName] = useState('');
  const [recipeCategory, setRecipeCategory] = useState('');
  const [recipePrice, setRecipePrice] = useState('');
  const [selectedIngredients, setSelectedIngredients] = useState<IngredientSelection[]>([]);
  const [recipeExternalId, setRecipeExternalId] = useState('');
  const [activeTab, setActiveTab] = useState<'menuItems' | 'preppedRecipes'>('menuItems');
  const [isPrepDialogOpen, setIsPrepDialogOpen] = useState(false);
  const [editingPrepId, setEditingPrepId] = useState<string | null>(null);
  const [prepMenuItemName, setPrepMenuItemName] = useState('');
  const [prepCategory, setPrepCategory] = useState('');
  const [prepYieldQuantity, setPrepYieldQuantity] = useState('1');
  const [prepYieldUnit, setPrepYieldUnit] = useState('batch');
  const [selectedPrepIngredients, setSelectedPrepIngredients] = useState<IngredientSelection[]>([]);
  const [scannedRecipeData, setScannedRecipeData] = useState<ScannedRecipeData | null>(null);

  const resetRecipeForm = () => {
    setEditingRecipe(null);
    setRecipeMenuItemName('');
    setRecipeCategory('');
    setRecipePrice('');
    setSelectedIngredients([]);
    setRecipeExternalId('');
    setScannedRecipeData(null);
  };

  const resetPrepForm = () => {
    setEditingPrepId(null);
    setPrepMenuItemName('');
    setPrepCategory('Prepped Items');
    setPrepYieldQuantity('1');
    setPrepYieldUnit('batch');
    setSelectedPrepIngredients([]);
    setScannedRecipeData(null);
  };

  const calculateIngredientLineCost = (ingredient: IngredientSelection) => {
    const item = inventory.find((inventoryItem) => inventoryItem.id === ingredient.inventoryItemId);
    if (!item) return 0;

    const sourceUnit = ingredient.unit || item.unit;
    const quantityInInventoryUnit = convertQuantity(ingredient.quantity, sourceUnit, item.unit);
    if (quantityInInventoryUnit === null) return 0;
    return quantityInInventoryUnit * item.unitCost;
  };

  const calculateRecipeCost = (recipeId: string) => {
    const recipe = recipes.find((recipe) => recipe.id === recipeId);
    if (!recipe) return 0;
    return recipe.ingredients.reduce((total, ingredient) => total + calculateIngredientLineCost(ingredient), 0);
  };

  const calculateIngredientCost = (ingredients: IngredientSelection[]) => {
    return ingredients.reduce((total, ingredient) => total + calculateIngredientLineCost(ingredient), 0);
  };

  const currentMenuItemCost = calculateIngredientCost(selectedIngredients);
  const currentMenuItemPrice = Number(recipePrice || 0);
  const currentFoodCostPercent = currentMenuItemPrice > 0 ? (currentMenuItemCost / currentMenuItemPrice) * 100 : 0;
  const currentMenuItemMargin = currentMenuItemPrice - currentMenuItemCost;
  const currentMenuItemMarginPercent = currentMenuItemPrice > 0 ? (currentMenuItemMargin / currentMenuItemPrice) * 100 : 0;
  const getMarginColor = (marginPercent: number) => {
    if (marginPercent < 60) return '#b91c1c';
    if (marginPercent < 70) return '#c2410c';
    return '#15803d';
  };
  const unlinkedMenuItemCount = recipes.filter((recipe) => !recipe.externalId).length;
  const uncostedMenuItemCount = recipes.filter((recipe) => recipe.ingredients.length === 0).length;
  const averageMarginPercent = recipes.length > 0
    ? recipes.reduce((sum, recipe) => {
        const cost = calculateRecipeCost(recipe.id);
        const marginPercent = recipe.price > 0 ? ((recipe.price - cost) / recipe.price) * 100 : 0;
        return sum + marginPercent;
      }, 0) / recipes.length
    : 0;

  const handleAddIngredient = (
    itemId: string,
    setIngredients: React.Dispatch<React.SetStateAction<IngredientSelection[]>>,
  ) => {
    if (!itemId) return;
    const item = inventory.find((inventoryItem) => inventoryItem.id === itemId);
    if (!item) return;
    setIngredients((current) => {
      if (current.find((ingredient) => ingredient.inventoryItemId === itemId)) {
        showToast.error('Ingredient already added');
        return current;
      }
      return [...current, { inventoryItemId: item.id, quantity: 0, unit: item.unit }];
    });
  };

  const handleUpdateIngredientQuantity = (
    itemId: string,
    quantity: number,
    setIngredients: React.Dispatch<React.SetStateAction<IngredientSelection[]>>,
  ) => {
    setIngredients((current) => current.map((ingredient) => ingredient.inventoryItemId === itemId ? { ...ingredient, quantity } : ingredient));
  };

  const handleUpdateIngredientUnit = (
    itemId: string,
    unit: string,
    setIngredients: React.Dispatch<React.SetStateAction<IngredientSelection[]>>,
  ) => {
    setIngredients((current) => current.map((ingredient) => {
      if (ingredient.inventoryItemId !== itemId) return ingredient;

      const currentUnit = ingredient.unit;
      const convertedQuantity = convertQuantity(ingredient.quantity, currentUnit, unit);
      return {
        ...ingredient,
        unit,
        quantity: convertedQuantity ?? ingredient.quantity,
      };
    }));
  };

  const handleRemoveIngredient = (
    itemId: string,
    setIngredients: React.Dispatch<React.SetStateAction<IngredientSelection[]>>,
  ) => {
    setIngredients((current) => current.filter((ingredient) => ingredient.inventoryItemId !== itemId));
  };

  const handleAddMenuIngredient = (itemId: string) => {
    handleAddIngredient(itemId, setSelectedIngredients);
  };

  const handleAddPrepIngredient = (itemId: string) => {
    handleAddIngredient(itemId, setSelectedPrepIngredients);
  };

  const handleUpdateMenuIngredientQuantity = (itemId: string, quantity: number) => {
    handleUpdateIngredientQuantity(itemId, quantity, setSelectedIngredients);
  };

  const handleUpdatePrepIngredientQuantity = (itemId: string, quantity: number) => {
    handleUpdateIngredientQuantity(itemId, quantity, setSelectedPrepIngredients);
  };

  const handleUpdateMenuIngredientUnit = (itemId: string, unit: string) => {
    handleUpdateIngredientUnit(itemId, unit, setSelectedIngredients);
  };

  const handleUpdatePrepIngredientUnit = (itemId: string, unit: string) => {
    handleUpdateIngredientUnit(itemId, unit, setSelectedPrepIngredients);
  };

  const handleRemoveMenuIngredient = (itemId: string) => {
    handleRemoveIngredient(itemId, setSelectedIngredients);
  };

  const handleRemovePrepIngredient = (itemId: string) => {
    handleRemoveIngredient(itemId, setSelectedPrepIngredients);
  };

  const renderIngredientEditor = (
    ingredients: IngredientSelection[],
    onAddIngredient: (itemId: string) => void,
    onUpdateIngredientQuantity: (itemId: string, quantity: number) => void,
    onUpdateIngredientUnit: (itemId: string, unit: string) => void,
    onRemoveIngredient: (itemId: string) => void,
    emptyMessage: string,
    yieldContext?: { quantity: number; unit: string },
  ) => (
    <div className="space-y-3">
      <div>
        <Label>Ingredients</Label>
        <IngredientAutocomplete inventory={inventory} onAddIngredient={onAddIngredient} />
      </div>

      {ingredients.length > 0 ? (
        <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-4">
          {ingredients.map((ingredient) => {
            const item = inventory.find((inventoryItem) => inventoryItem.id === ingredient.inventoryItemId);
            if (!item) return null;
            const compatibleUnits = getCompatibleUnits(item.unit);
            const normalizedIngredientUnit = normalizeUnit(ingredient.unit || item.unit);
            const availableUnits = compatibleUnits.some((unitOption) => unitOption.value === normalizedIngredientUnit)
              ? compatibleUnits
              : [...compatibleUnits, { value: normalizedIngredientUnit, label: formatUnitLabel(normalizedIngredientUnit) }];
            const lineCost = calculateIngredientLineCost(ingredient);
            return (
              <div key={ingredient.inventoryItemId} className="grid gap-3 rounded-lg border border-slate-100 bg-slate-50/50 p-3 sm:grid-cols-[1.5fr_0.8fr_0.8fr_0.8fr_auto] sm:items-end">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900 truncate">{item.name}</p>
                  <p className="mt-1 text-[11px] text-slate-500 truncate">
                    Base: {formatUnitLabel(item.unit)} • {item.supplier} • ${item.unitCost.toFixed(2)}/{formatUnitLabel(item.unit)}
                  </p>
                </div>
                <div>
                  <Label htmlFor={`qty-${ingredient.inventoryItemId}`}>Quantity</Label>
                  <Input
                    id={`qty-${ingredient.inventoryItemId}`}
                    type="number"
                    step="0.01"
                    value={ingredient.quantity}
                    onChange={(e) => onUpdateIngredientQuantity(ingredient.inventoryItemId, Number(e.target.value))}
                    className="min-w-0"
                  />
                  <p className="mt-1 text-[11px] text-slate-500">Used in {formatUnitLabel(ingredient.unit || item.unit)}</p>
                </div>
                <div>
                  <Label htmlFor={`unit-${ingredient.inventoryItemId}`}>Unit</Label>
                  <select
                    id={`unit-${ingredient.inventoryItemId}`}
                    value={normalizedIngredientUnit}
                    onChange={(e) => onUpdateIngredientUnit(ingredient.inventoryItemId, e.target.value)}
                    className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                  >
                    {availableUnits.map((unitOption) => (
                      <option key={unitOption.value} value={unitOption.value}>
                        {unitOption.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Line Cost</p>
                  <span className="text-sm font-semibold text-slate-900">${lineCost.toFixed(2)}</span>
                </div>
                <div className="flex justify-end">
                  <Button size="sm" variant="outline" type="button" onClick={() => onRemoveIngredient(ingredient.inventoryItemId)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            );
          })}

          <div className="grid gap-3 rounded-lg bg-slate-100 px-4 py-3 text-sm sm:grid-cols-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Ingredient Lines</p>
              <p className="mt-1 font-semibold text-slate-900">{ingredients.length}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Total Cost</p>
              <p className="mt-1 font-semibold text-slate-900">${calculateIngredientCost(ingredients).toFixed(2)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Per Yield</p>
              <p className="mt-1 font-semibold text-slate-900">
                {yieldContext && yieldContext.quantity > 0
                  ? `$${(calculateIngredientCost(ingredients) / yieldContext.quantity).toFixed(2)} / ${yieldContext.unit}`
                  : 'Set yield to calculate'}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-sm text-slate-500">{emptyMessage}</p>
      )}
    </div>
  );

  const handleSyncToastItems = () => {
    if (!isConnected) {
      showToast.error('Connect to Toast POS first');
      return;
    }
    if (menuItems.length === 0) {
      showToast.error('No menu items available to sync');
      return;
    }
    syncToastMenuItems(menuItems);
    showToast.success(`Synced ${menuItems.length} menu items from Toast`);
  };

  useEffect(() => {
    if (isConnected && recipes.every((recipe) => recipe.source !== 'toast')) {
      handleSyncToastItems();
    }
  }, [isConnected]);

  useEffect(() => {
    if (topSellerName) {
      setActiveTab('menuItems');
    }
  }, [topSellerName]);

  const topSellerMatch = useMemo(() => {
    if (!normalizedTopSellerName) return null;
    return recipes.find((recipe) => recipe.menuItemName.trim().toLowerCase() === normalizedTopSellerName) || null;
  }, [normalizedTopSellerName, recipes]);

  const visibleRecipes = useMemo(() => {
    if (!normalizedTopSellerName) return recipes;

    const matching = recipes.filter((recipe) => recipe.menuItemName.trim().toLowerCase() === normalizedTopSellerName);
    const remaining = recipes.filter((recipe) => recipe.menuItemName.trim().toLowerCase() !== normalizedTopSellerName);
    return [...matching, ...remaining];
  }, [normalizedTopSellerName, recipes]);

  const totalMenuItemRevenue = recipes.reduce((sum, recipe) => sum + recipe.price, 0);
  const totalMenuItemCost = recipes.reduce((sum, recipe) => sum + calculateRecipeCost(recipe.id), 0);
  const linkedMenuItemCount = recipes.filter((recipe) => Boolean(recipe.externalId)).length;

  const handleEditRecipe = (recipeId: string) => {
    const recipe = recipes.find((item) => item.id === recipeId);
    if (!recipe) return;
    setEditingRecipe(recipeId);
    setRecipeMenuItemName(recipe.menuItemName);
    setRecipeCategory(recipe.category);
    setRecipePrice(String(recipe.price));
    setSelectedIngredients(recipe.ingredients);
    setRecipeExternalId(recipe.externalId || '');
    setScannedRecipeData(null);
    setIsDialogOpen(true);
  };

  const handleRecipeExternalIdChange = (externalId: string) => {
    setRecipeExternalId(externalId);
    const linkedItem = toastMenuItemOptions.find((item) => item.id === externalId);
    if (!linkedItem) return;
    setRecipeMenuItemName(linkedItem.name);
    setRecipeCategory(linkedItem.category);
    setRecipePrice(String(linkedItem.price));
  };

  const handleTopSellerSelect = (recipeId: string) => {
    navigate(`/app/recipes?menuItem=${encodeURIComponent(recipes.find((recipe) => recipe.id === recipeId)?.menuItemName || '')}`);
    setActiveTab('menuItems');
  };

  const handleDeleteRecipe = (recipeId: string, name: string) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    deleteRecipe(recipeId);
    showToast.success('Recipe deleted');
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const recipePayload = {
      menuItemName: recipeMenuItemName.trim(),
      category: recipeCategory.trim(),
      price: Number(recipePrice || 0),
      ingredients: selectedIngredients,
      externalId: recipeExternalId.trim() || undefined,
      deletable: true,
    };

    if (editingRecipe) {
      updateRecipe(editingRecipe, recipePayload);
      showToast.success('Recipe updated');
    } else {
      addRecipe(recipePayload);
      showToast.success('Recipe created');
    }

    setIsDialogOpen(false);
    resetRecipeForm();
  };

  const handleRecipeScanned = (scannedData: ScannedRecipeData) => {
    setScannedRecipeData(scannedData);

    const autoMappedIngredients: IngredientSelection[] = [];
    let readyLineCount = 0;
    scannedData.ingredients.forEach((ingredient) => {
      const item = inventory.find(entry => entry.id === ingredient.matchedInventoryItemId);
      if (!item || ingredient.matchConfidence < 0.7 || ingredient.quantity <= 0) return;
      const quantityInInventoryUnit = convertQuantity(ingredient.quantity, ingredient.unit, item.unit);
      if (quantityInInventoryUnit === null) return;
      readyLineCount += 1;
      const existing = autoMappedIngredients.find(entry => entry.inventoryItemId === item.id);
      if (existing) {
        existing.quantity += quantityInInventoryUnit;
        return;
      }
      autoMappedIngredients.push({ inventoryItemId: item.id, quantity: quantityInInventoryUnit, unit: item.unit });
    });

    setEditingPrepId(null);
    setPrepMenuItemName(scannedData.menuItemName?.trim() || 'Scanned Recipe');
    setPrepCategory(scannedData.category?.trim() || 'Prepped Items');
    setPrepYieldQuantity(String(scannedData.yieldQuantity || 1));
    setPrepYieldUnit(scannedData.yieldUnit || 'batch');
    setSelectedPrepIngredients(autoMappedIngredients);

    setIsDialogOpen(false);
    setIsScanOpen(false);
    setActiveTab('preppedRecipes');
    setIsPrepDialogOpen(true);

    const reviewCount = scannedData.ingredients.length - readyLineCount;
    showToast.success(reviewCount > 0
      ? `AI matched ${readyLineCount} ingredient lines. Review ${reviewCount} before saving.`
      : `AI matched and costed all ${readyLineCount} ingredient lines. Review before saving.`);
  };

  const openPrepDialog = (prepId?: string) => {
    if (prepId) {
      const prepItem = preppedRecipes.find((item) => item.id === prepId);
      if (!prepItem) return;
      setEditingPrepId(prepId);
      setPrepMenuItemName(prepItem.menuItemName);
      setPrepCategory(prepItem.category);
      setPrepYieldQuantity(String(prepItem.yieldQuantity));
      setPrepYieldUnit(prepItem.yieldUnit);
      setSelectedPrepIngredients(prepItem.ingredients);
    } else {
      resetPrepForm();
    }
    setIsPrepDialogOpen(true);
  };

  const handleCreatePreppedRecipe = () => {
    if (!prepMenuItemName.trim()) {
      showToast.error('Enter a recipe name');
      return;
    }
    if (selectedPrepIngredients.length === 0) {
      showToast.error('Add at least one ingredient');
      return;
    }

    const invalidIngredient = selectedPrepIngredients.find(ingredient => {
      const item = inventory.find(entry => entry.id === ingredient.inventoryItemId);
      return !item || ingredient.quantity <= 0 || convertQuantity(ingredient.quantity, ingredient.unit, item.unit) === null;
    });
    if (invalidIngredient) {
      showToast.error('Every ingredient needs a quantity and a compatible unit before the recipe can be costed.');
      return;
    }

    const parsedYieldQuantity = Number(prepYieldQuantity);
    if (!parsedYieldQuantity || parsedYieldQuantity <= 0) {
      showToast.error('Enter a valid yield quantity');
      return;
    }

    const payload = {
      menuItemName: prepMenuItemName.trim(),
      category: prepCategory.trim() || 'Prepped Items',
      ingredients: selectedPrepIngredients,
      yieldQuantity: parsedYieldQuantity,
      yieldUnit: prepYieldUnit.trim() || 'batch',
      cost: calculateIngredientCost(selectedPrepIngredients),
      deletable: true,
    };

    if (editingPrepId) {
      updatePreppedRecipe(editingPrepId, payload);
      showToast.success(`Updated recipe ${payload.menuItemName}`);
    } else {
      addPreppedRecipe(payload);
      showToast.success(`Created recipe ${payload.menuItemName}`);
    }

    setIsPrepDialogOpen(false);
    resetPrepForm();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900">Menu Item Builder</h1>
          <p className="text-sm text-slate-500">Build menu items from inventory ingredients and create reusable prep components.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetRecipeForm();
          }}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-slate-900 text-white hover:bg-slate-700">
                <Plus className="w-4 h-4 mr-2" />New Menu Item
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[calc(100vw-2rem)] max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingRecipe ? 'Edit Menu Item' : 'Create Menu Item'}</DialogTitle>
                <DialogDescription>
                  {editingRecipe ? 'Update menu item details and ingredient cost mapping.' : 'Build a new menu item and attach inventory ingredients.'}
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="externalId">POS Number</Label>
                    <select
                      id="externalId"
                      name="externalId"
                      value={recipeExternalId}
                      onChange={(e) => handleRecipeExternalIdChange(e.target.value)}
                      className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                    >
                      <option value="">Not linked to POS</option>
                      {toastMenuItemOptions.map((item) => (
                        <option key={item.id} value={item.id}>{item.name} · {item.id}</option>
                      ))}
                    </select>
                    <p className="mt-1 text-xs text-slate-500">Link this menu item to a POS item so sync matches by POS number.</p>
                  </div>
                  <div>
                    <Label htmlFor="menuItemName">Menu Item Name</Label>
                    <Input
                      id="menuItemName"
                      name="menuItemName"
                      value={recipeMenuItemName}
                      onChange={(e) => setRecipeMenuItemName(e.target.value)}
                      placeholder="Chicken Sandwich"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="category">Category</Label>
                    <Input
                      id="category"
                      name="category"
                      value={recipeCategory}
                      onChange={(e) => setRecipeCategory(e.target.value)}
                      placeholder="Entrees"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="price">Price</Label>
                    <Input
                      id="price"
                      name="price"
                      type="number"
                      step="0.01"
                      value={recipePrice}
                      onChange={(e) => setRecipePrice(e.target.value)}
                      placeholder="15.99"
                      required
                    />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-4">
                  <Card className="border-slate-200 bg-slate-50">
                    <CardContent className="p-4">
                      <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Linked POS</p>
                      <p className="mt-2 text-sm font-semibold text-slate-900 truncate">{recipeExternalId || 'Manual item'}</p>
                    </CardContent>
                  </Card>
                  <Card className="border-slate-200 bg-slate-50">
                    <CardContent className="p-4">
                      <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Ingredients</p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">{selectedIngredients.length}</p>
                    </CardContent>
                  </Card>
                  <Card className="border-slate-200 bg-slate-50">
                    <CardContent className="p-4">
                      <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Food Cost</p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">${currentMenuItemCost.toFixed(2)}</p>
                      <p className="text-[11px] text-slate-500">{currentFoodCostPercent.toFixed(0)}%</p>
                    </CardContent>
                  </Card>
                  <Card className="border-slate-200 bg-slate-50">
                    <CardContent className="p-4">
                      <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Margin</p>
                      <p className="mt-2 text-sm font-semibold" style={{ color: getMarginColor(currentMenuItemMarginPercent) }}>
                        ${currentMenuItemMargin.toFixed(2)} · {currentMenuItemMarginPercent.toFixed(0)}%
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {renderIngredientEditor(
                  selectedIngredients,
                  handleAddMenuIngredient,
                  handleUpdateMenuIngredientQuantity,
                  handleUpdateMenuIngredientUnit,
                  handleRemoveMenuIngredient,
                  'Add ingredients from inventory to compute food cost.',
                  undefined,
                )}

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" className="bg-slate-900 text-white hover:bg-slate-700">
                    {editingRecipe ? 'Update Menu Item' : 'Save Menu Item'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          <Button size="sm" className="bg-violet-600 text-white hover:bg-violet-700" onClick={() => setIsScanOpen(true)}>
            <Camera className="w-4 h-4 mr-2" /> Scan Recipe
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(value: string) => setActiveTab(value as 'menuItems' | 'preppedRecipes')}>
        <TabsList>
          <TabsTrigger value="menuItems">Menu Items</TabsTrigger>
          <TabsTrigger value="preppedRecipes">Recipes</TabsTrigger>
        </TabsList>

        <TabsContent value="menuItems" className="space-y-4">
          {topSellerName && (
            <Card className={topSellerMatch ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-slate-50'}>
              <CardContent>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Top Seller Selection</p>
                    <p className="text-xs mt-1" style={{ color: topSellerMatch ? '#92400E' : '#475569' }}>
                      {topSellerMatch
                        ? `Showing recipe for ${topSellerName}.`
                        : `${topSellerName} was clicked from Top Sellers, but no matching recipe exists yet.`}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => navigate('/app/recipes')}>
                    Clear
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <Card className="border-slate-200 bg-white shadow-sm">
              <CardContent>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Recipe Intake</p>
                    <p className="text-xs text-slate-500 mt-1">Create manually, scan a recipe card, or connect an item to POS before costing it.</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setIsScanOpen(true)}>
                    <Camera className="w-4 h-4 mr-2" /> Scan
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200 bg-white shadow-sm">
              <CardContent>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">POS Sync</p>
                    <p className="text-xs text-slate-500 mt-1">Keep menu items aligned with connected POS records and prices.</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={handleSyncToastItems}>
                    <RefreshCw className="w-4 h-4 mr-2" /> Sync
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <Card className="border-slate-200 bg-white shadow-sm">
              <CardContent className="p-4">
                <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Menu Items</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">{recipes.length}</p>
              </CardContent>
            </Card>
            <Card className="border-slate-200 bg-white shadow-sm">
              <CardContent className="p-4">
                <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Not Linked To POS</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">{unlinkedMenuItemCount}</p>
              </CardContent>
            </Card>
            <Card className="border-slate-200 bg-white shadow-sm">
              <CardContent className="p-4">
                <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Missing Costing</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">{uncostedMenuItemCount}</p>
              </CardContent>
            </Card>
            <Card className="border-slate-200 bg-white shadow-sm">
              <CardContent className="p-4">
                <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Average Margin</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">{averageMarginPercent.toFixed(0)}%</p>
              </CardContent>
            </Card>
          </div>

          {recipes.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <ChefHat className="w-12 h-12 text-slate-400 mb-4" />
                <p className="text-sm text-slate-500">No menu items yet. Create one or scan one from your menu.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
              <div className="grid items-center gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3 text-[10px] uppercase tracking-[0.2em] text-slate-500" style={{ gridTemplateColumns: '1.3fr 0.9fr 0.9fr 0.9fr 0.9fr 0.8fr 0.9fr' }}>
                <span>Menu Item</span>
                <span className="text-right">POS #</span>
                <span className="text-right">Category</span>
                <span className="text-right">Food Cost</span>
                <span className="text-right">Price</span>
                <span className="text-right">Margin</span>
                <span className="text-right">Actions</span>
              </div>
              <div className="divide-y divide-slate-100">
                {visibleRecipes.map((recipe) => {
                  const recipeCost = calculateRecipeCost(recipe.id);
                  const foodCostPercent = recipe.price > 0 ? (recipeCost / recipe.price) * 100 : 0;
                  const margin = recipe.price - recipeCost;
                  const marginPercent = recipe.price > 0 ? (margin / recipe.price) * 100 : 0;
                  const isTopSellerMatch = recipe.menuItemName.trim().toLowerCase() === normalizedTopSellerName;
                  return (
                    <div
                      key={recipe.id}
                      className={`grid items-center gap-3 px-4 py-4 text-sm text-slate-700 ${isTopSellerMatch ? 'bg-amber-50' : ''}`}
                      style={{ gridTemplateColumns: '1.3fr 0.9fr 0.9fr 0.9fr 0.9fr 0.8fr 0.9fr' }}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <button
                            type="button"
                            onClick={() => handleEditRecipe(recipe.id)}
                            className="truncate text-left font-semibold text-slate-900 hover:text-slate-700 hover:underline"
                          >
                            {recipe.menuItemName}
                          </button>
                          {isTopSellerMatch && (
                            <Badge className="bg-amber-100 text-amber-800 text-[10px]">Top Seller</Badge>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-1 truncate">{recipe.ingredients.length} ingredients</p>
                      </div>
                      <p className="text-right text-slate-500 truncate">{recipe.externalId || 'Not linked'}</p>
                      <p className="text-right text-slate-500 truncate">{recipe.category}</p>
                      <div className="text-right">
                        <p className="font-semibold text-slate-900 tabular-nums">${recipeCost.toFixed(2)}</p>
                        <p className="text-[11px] text-slate-500">{foodCostPercent.toFixed(0)}%</p>
                      </div>
                      <p className="text-right font-semibold text-slate-900 tabular-nums">${recipe.price.toFixed(2)}</p>
                      <div className="text-right">
                        <p className="font-semibold" style={{ color: getMarginColor(marginPercent) }}>${margin.toFixed(2)}</p>
                        <p className="text-[11px]" style={{ color: getMarginColor(marginPercent) }}>{marginPercent.toFixed(0)}%</p>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => handleEditRecipe(recipe.id)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleDeleteRecipe(recipe.id, recipe.menuItemName)}>
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="preppedRecipes" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
            <Card className="bg-slate-50 border-slate-200">
              <CardContent>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Recipes</p>
                    <p className="text-xs text-slate-500 mt-1">Build reusable component recipes for sauces, dressings, batters, and other menu-item building blocks.</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => openPrepDialog()}>
                    New Recipe
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-emerald-50 border-emerald-200">
              <CardContent>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-emerald-900">Recipes</p>
                    <p className="text-xs text-emerald-700 mt-1">{preppedRecipes.length} recipes created</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-emerald-900">{preppedRecipes.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {preppedRecipes.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center text-slate-500">
                <p>No recipes yet. Build one like a reusable component recipe and add your yield.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
              <div
                className="grid items-center px-4 py-3 text-[10px] uppercase tracking-[0.2em] text-slate-500 bg-slate-50 border-b border-slate-100"
                style={{ gridTemplateColumns: '1.6fr 1fr 1fr 1fr 0.9fr' }}
              >
                <span className="font-black">Recipe</span>
                <span className="font-black text-right">Category</span>
                <span className="font-black text-right">Yield</span>
                <span className="font-black text-right">Cost</span>
                <span className="font-black text-right">Actions</span>
              </div>
              <div className="divide-y divide-slate-100">
                {preppedRecipes.map((component) => (
                  <div
                    key={component.id}
                    className="grid items-center gap-3 px-4 py-4 text-sm text-slate-700"
                    style={{ gridTemplateColumns: '1.6fr 1fr 1fr 1fr 0.9fr' }}
                  >
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{component.menuItemName}</p>
                      <p className="text-[11px] text-slate-500 truncate mt-1">{component.ingredients.length} ingredients</p>
                    </div>
                    <p className="text-right text-slate-500 truncate">{component.category}</p>
                    <p className="text-right font-semibold text-slate-900 tabular-nums">{component.yieldQuantity} {component.yieldUnit}</p>
                    <p className="text-right font-semibold text-slate-900 tabular-nums">${calculateIngredientCost(component.ingredients).toFixed(2)}</p>
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => openPrepDialog(component.id)}>
                        Edit
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => deletePreppedRecipe(component.id)}>
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={isPrepDialogOpen} onOpenChange={(open: boolean) => {
        setIsPrepDialogOpen(open);
        if (!open) {
          resetPrepForm();
        }
      }}>
        <DialogContent className="max-w-[calc(100vw-2rem)] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPrepId ? 'Edit Recipe' : 'Create Recipe'}</DialogTitle>
            <DialogDescription>Build a reusable component recipe with ingredients and yield for menu items.</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              handleCreatePreppedRecipe();
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="prepMenuItemName">Recipe Name</Label>
                <Input
                  id="prepMenuItemName"
                  value={prepMenuItemName}
                  onChange={(e) => setPrepMenuItemName(e.target.value)}
                  placeholder="Classic Ranch"
                  required
                />
              </div>
              <div>
                <Label htmlFor="prepCategory">Category</Label>
                <Input
                  id="prepCategory"
                  value={prepCategory}
                  onChange={(e) => setPrepCategory(e.target.value)}
                  placeholder="Prepped Items"
                  required
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="prepYieldQuantity">Yield Qty</Label>
                <Input
                  id="prepYieldQuantity"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={prepYieldQuantity}
                  onChange={(e) => setPrepYieldQuantity(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="prepYieldUnit">Yield Unit</Label>
                <Input
                  id="prepYieldUnit"
                  value={prepYieldUnit}
                  onChange={(e) => setPrepYieldUnit(e.target.value)}
                  placeholder="quart"
                  required
                />
              </div>
            </div>

            {scannedRecipeData && (
              <Card className="border-violet-200 bg-violet-50">
                <CardContent className="py-4">
                  <p className="text-sm font-semibold text-violet-950">AI scan review</p>
                  <p className="mt-1 text-xs text-violet-800">Costs below use current inventory prices, never AI-generated prices.</p>
                  <div className="mt-3 space-y-2">
                    {scannedRecipeData.ingredients.map((ingredient, index) => {
                      const item = inventory.find(entry => entry.id === ingredient.matchedInventoryItemId);
                      const converted = item ? convertQuantity(ingredient.quantity, ingredient.unit, item.unit) : null;
                      const isReady = Boolean(item && ingredient.matchConfidence >= 0.7 && ingredient.quantity > 0 && converted !== null);
                      return (
                        <div key={`${ingredient.rawText}-${index}`} className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 text-sm">
                          <div className="min-w-0">
                            <p className="truncate font-medium text-slate-900">{ingredient.quantity} {ingredient.unit} {ingredient.name}</p>
                            <p className="truncate text-xs text-slate-500">{item ? `Matched to ${item.name}` : 'No inventory match'}</p>
                          </div>
                          <Badge className={isReady ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}>
                            {isReady ? 'Cost-ready' : 'Review'}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {renderIngredientEditor(
              selectedPrepIngredients,
              handleAddPrepIngredient,
              handleUpdatePrepIngredientQuantity,
              handleUpdatePrepIngredientUnit,
              handleRemovePrepIngredient,
              'Add ingredients from inventory to build this recipe.',
              { quantity: Number(prepYieldQuantity) || 0, unit: prepYieldUnit || 'yield' },
            )}

            <div className="flex items-center justify-between rounded-md bg-slate-50 px-4 py-3 text-sm">
              <span>Recipe cost</span>
              <span className="font-semibold text-slate-900">${calculateIngredientCost(selectedPrepIngredients).toFixed(2)}</span>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsPrepDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-slate-900 text-white hover:bg-slate-700">
                {editingPrepId ? 'Update Recipe' : 'Save Recipe'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <RecipeScan inventory={inventory} isOpen={isScanOpen} onClose={() => setIsScanOpen(false)} onRecipeExtracted={handleRecipeScanned} />
    </div>
  );
}
