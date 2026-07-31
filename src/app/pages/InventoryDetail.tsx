import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useInventory } from '../contexts/InventoryContext';
import { useToast } from '../contexts/ToastContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { ArrowLeft, Plus, Minus, AlertTriangle, TrendingDown, Package, TrendingUp, DollarSign, Calendar, Archive, Undo2, BookOpen } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { toast as showToast } from 'sonner';

const MARKETMAN_UOM_OPTIONS = [
  'oz', 'EA', 'gr', 'L', 'Kg', 'lb',
];
const NEW_SUPPLIER_VALUE = '__new_supplier__';

type PurchaseOptionDraft = {
  id: string;
  productName: string;
  supplier: string;
  productCode: string;
  packSize: number;
  packUnit: string;
  unitPrice: number;
  orderingStatus: 'Ready' | 'OK';
  isMain: boolean;
  isLocal: boolean;
};

function createFallbackPurchaseOption(itemName: string, itemSupplier: string, marketmanSku: string, itemUnit: string, itemPackUnit: string, itemPackSize: number, itemCost: number, itemParLevel: number, itemCurrentStock: number): PurchaseOptionDraft {
  return {
    id: 'po-main',
    productName: itemName,
    supplier: itemSupplier || 'Unknown',
    productCode: marketmanSku,
    packSize: itemPackSize || 1,
    packUnit: itemPackUnit || itemUnit || 'UNIT',
    unitPrice: itemCost || 0,
    orderingStatus: ((itemParLevel || 0) - (itemCurrentStock || 0)) > 0 ? 'Ready' : 'OK',
    isMain: true,
    isLocal: true,
  };
}

export function InventoryDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { inventory, recipes, preppedRecipes, storageAreas, suppliers, isLocationLoaded, addSupplier, addStorageArea, adjustInventory, deleteInventoryItem, updateInventoryItem } = useInventory();
  const { salesData } = useToast();
  const [supplierSelection, setSupplierSelection] = useState('');
  const [newSupplierName, setNewSupplierName] = useState('');
  const [isAdjustDialogOpen, setIsAdjustDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'stock' | 'price'>('stock');
  const [isEditing, setIsEditing] = useState(false);
  const [quickUom, setQuickUom] = useState('EA');
  const [quickReportUom, setQuickReportUom] = useState('EA');
  const [quickStorageArea, setQuickStorageArea] = useState('');
  const [quickCustomStorageArea, setQuickCustomStorageArea] = useState('');
  const [quickParLevel, setQuickParLevel] = useState(0);
  const [purchaseOptions, setPurchaseOptions] = useState<PurchaseOptionDraft[]>([]);
  const [isPurchaseOptionsExpanded, setIsPurchaseOptionsExpanded] = useState(true);
  const [editForm, setEditForm] = useState({
    name: '',
    category: '',
    storageArea: '',
    supplier: '',
    sku: '',
    vendorItemCode: '',
    unit: '',
    currentStock: 0,
    unitCost: 0,
    packSize: 1,
    packUnit: '',
    unitsPerPack: 1,
    taxRate: 0,
    wastePercent: 0,
    yieldPercent: 100,
    parLevel: 0,
    reorderPoint: 0,
    minimumOrderQty: 0,
    leadTimeDays: 0,
    targetStockDays: 7,
    lastCountedAt: '',
    notes: '',
  });

  const item = inventory.find(i => i.id === id);
  const marketmanSku = item ? item.id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12).toUpperCase() : '';
  const pricingDateLabel = item?.lastUpdated
    ? new Date(item.lastUpdated).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
    : 'N/A';

  const usedInMenuItems = recipes
    .map(recipe => {
      const ingredient = recipe.ingredients.find(ing => ing.inventoryItemId === id);
      if (!ingredient) return null;
      return {
        id: recipe.id,
        name: recipe.menuItemName,
        category: recipe.category,
        quantity: ingredient.quantity,
        unit: ingredient.unit,
        type: 'menu' as const,
      };
    })
    .filter(Boolean);

  const usedInPrepRecipes = preppedRecipes
    .map(recipe => {
      const ingredient = recipe.ingredients.find(ing => ing.inventoryItemId === id);
      if (!ingredient) return null;
      return {
        id: recipe.id,
        name: recipe.menuItemName,
        category: recipe.category,
        quantity: ingredient.quantity,
        unit: ingredient.unit,
        type: 'prep' as const,
      };
    })
    .filter(Boolean);

  const allRecipeUsage = [...usedInMenuItems, ...usedInPrepRecipes];
  const fallbackPurchaseOption = item
    ? createFallbackPurchaseOption(item.name, item.supplier, marketmanSku, item.unit, item.packUnit || item.unit, item.packSize ?? 1, item.unitCost, item.parLevel, item.currentStock)
    : null;
  const renderedPurchaseOptions = purchaseOptions.length > 0 ? purchaseOptions : (fallbackPurchaseOption ? [fallbackPurchaseOption] : []);
  const activePurchaseOption = renderedPurchaseOptions[0] || null;

  useEffect(() => {
    if (!item) return;
    setQuickUom((item.unit || 'oz').toLowerCase());
    setQuickReportUom((item.packUnit || item.unit || 'oz').toLowerCase());
    setQuickStorageArea(item.storageArea || 'Unassigned');
    setQuickParLevel(item.parLevel || 0);
    setQuickCustomStorageArea('');
    const existingOptions = item.purchaseOptions?.length
      ? item.purchaseOptions
      : [fallbackPurchaseOption ?? createFallbackPurchaseOption(item.name, item.supplier, marketmanSku, item.unit, item.packUnit || item.unit, item.packSize ?? 1, item.unitCost, item.parLevel, item.currentStock)];

    setPurchaseOptions(
      existingOptions.map((option, index) => ({
        id: option.id || `po-${index + 1}`,
        productName: option.productName || item.name,
        supplier: option.supplier || item.supplier || 'Unknown',
        productCode: option.productCode || item.vendorItemCode || item.sku || '',
        packSize: Number(option.packSize ?? item.packSize ?? 1),
        packUnit: (option.packUnit || item.packUnit || item.unit || 'oz').toLowerCase(),
        unitPrice: Number(option.unitPrice ?? item.unitCost ?? 0),
        orderingStatus: option.orderingStatus === 'Ready' ? 'Ready' : 'OK',
        isMain: index === 0 ? true : Boolean(option.isMain),
        isLocal: Boolean(option.isLocal),
      })),
    );

    setEditForm({
      name: item.name,
      category: item.category,
      storageArea: item.storageArea || '',
      supplier: item.supplier,
      sku: item.sku || '',
      vendorItemCode: item.vendorItemCode || '',
      unit: item.unit,
      currentStock: item.currentStock,
      unitCost: item.unitCost,
      packSize: item.packSize ?? 1,
      packUnit: (item.packUnit || item.unit || 'oz').toLowerCase(),
      unitsPerPack: item.unitsPerPack ?? 1,
      taxRate: item.taxRate ?? 0,
      wastePercent: item.wastePercent ?? 0,
      yieldPercent: item.yieldPercent ?? 100,
      parLevel: item.parLevel,
      reorderPoint: item.reorderPoint ?? 0,
      minimumOrderQty: item.minimumOrderQty ?? 0,
      leadTimeDays: item.leadTimeDays ?? 0,
      targetStockDays: item.targetStockDays ?? 7,
      lastCountedAt: item.lastCountedAt || '',
      notes: item.notes || '',
    });
    setSupplierSelection(item.supplier || '');
    setNewSupplierName('');
  }, [item]);

  if (!isLocationLoaded) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Package className="w-16 h-16 text-gray-400 mb-4" />
        <p className="text-gray-500">Loading item...</p>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Package className="w-16 h-16 text-gray-400 mb-4" />
        <p className="text-gray-500">Item not found</p>
        <Button onClick={() => navigate('/app/inventory')} className="mt-4">
          Back to Inventory
        </Button>
      </div>
    );
  }

  // Calculate usage from recipes (mock data for today)
  const usageByDish = recipes
    .map(recipe => {
      const ingredient = recipe.ingredients.find(ing => ing.inventoryItemId === id);
      if (!ingredient) return null;

      // Mock: assume 28 chicken sandwiches sold today
      const mockSalesCount = recipe.menuItemName.includes('Chicken') ? 28 : 
                            recipe.menuItemName.includes('Beef') ? 15 : 0;
      
      const totalUsed = ingredient.quantity * mockSalesCount;

      return {
        dishName: recipe.menuItemName,
        soldCount: mockSalesCount,
        usedAmount: totalUsed,
        unit: item.unit,
      };
    })
    .filter(usage => usage && usage.soldCount > 0);

  // Calculate 7-day trend (mock data)
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    const baseUsage = 15;
    const variance = Math.random() * 10 - 5;
    return {
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      usage: Math.max(0, baseUsage + variance),
    };
  });

  // Calculate variance
  const expectedUsage = 20;
  const actualUsage = usageByDish.reduce((sum, usage) => sum + (usage?.usedAmount || 0), 0);
  const variance = actualUsage - expectedUsage;

  const stockPercentage = (item.currentStock / item.parLevel) * 100;
  const isLowStock = stockPercentage < 30;
  const dailyUsageBaseline = Math.max(item.parLevel / Math.max(item.targetStockDays || 7, 1), 0.0001);
  const suggestedReorderQty = Math.max((item.parLevel || 0) - (item.currentStock || 0), item.minimumOrderQty || 0, 0);

  const handleAdjustInventory = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const change = Number(formData.get('change'));
    const reason = formData.get('reason') as string;
    const type = formData.get('type') as string;

    const finalChange = type === 'remove' ? -change : change;

    adjustInventory(item.id, finalChange, reason);
    setIsAdjustDialogOpen(false);
    showToast.success(`${item.name} inventory adjusted`);
    e.currentTarget.reset();
  };

  const handleSaveItem = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!item) return;

    const nextSupplier = supplierSelection === NEW_SUPPLIER_VALUE
      ? newSupplierName.trim()
      : supplierSelection.trim() || editForm.supplier.trim();

    if (!nextSupplier) {
      showToast.error('Select or create a supplier');
      return;
    }

    if (supplierSelection === NEW_SUPPLIER_VALUE) {
      addSupplier({
        name: nextSupplier,
        contactPerson: '',
        email: '',
        phone: '',
        address: '',
        category: editForm.category.trim() || item.category,
        paymentTerms: '',
        notes: `Created while editing ${item.name}`,
        source: 'manual',
      });
    }

    updateInventoryItem(item.id, {
      name: editForm.name.trim(),
      category: editForm.category.trim(),
      storageArea: editForm.storageArea.trim(),
      supplier: nextSupplier,
      sku: editForm.sku.trim(),
      vendorItemCode: editForm.vendorItemCode.trim(),
      unit: editForm.unit.trim(),
      currentStock: Number(editForm.currentStock),
      unitCost: Number(editForm.unitCost),
      packSize: Number(editForm.packSize),
      packUnit: editForm.packUnit.trim(),
      unitsPerPack: Number(editForm.unitsPerPack),
      taxRate: Number(editForm.taxRate),
      wastePercent: Number(editForm.wastePercent),
      yieldPercent: Number(editForm.yieldPercent),
      parLevel: Number(editForm.parLevel),
      reorderPoint: Number(editForm.reorderPoint),
      minimumOrderQty: Number(editForm.minimumOrderQty),
      leadTimeDays: Number(editForm.leadTimeDays),
      targetStockDays: Number(editForm.targetStockDays),
      lastCountedAt: editForm.lastCountedAt ? new Date(editForm.lastCountedAt).toISOString() : undefined,
      notes: editForm.notes.trim(),
      lastUpdated: new Date().toISOString().split('T')[0],
    });
    showToast.success(`${item.name} updated`);
    setIsEditing(false);
  };

  const toggleInactive = () => {
    updateInventoryItem(item.id, { inactive: !item.inactive });
    showToast.success(item.inactive ? `${item.name} reactivated` : `${item.name} marked inactive`);
  };

  const saveQuickUom = () => {
    const nextUnit = (quickUom || 'oz').toLowerCase();
    const nextReportUnit = quickReportUom || nextUnit;
    updateInventoryItem(item.id, {
      unit: nextUnit,
      packUnit: nextReportUnit,
      lastUpdated: new Date().toISOString().split('T')[0],
    });
    showToast.success('Units of measurement updated');
  };

  const saveQuickInventoryManagement = () => {
    const customArea = quickCustomStorageArea.trim();
    const nextStorageArea = customArea || quickStorageArea || 'Unassigned';

    if (customArea) {
      addStorageArea(customArea);
    }

    updateInventoryItem(item.id, {
      storageArea: nextStorageArea,
      parLevel: Number(quickParLevel),
      lastUpdated: new Date().toISOString().split('T')[0],
    });

    setQuickStorageArea(nextStorageArea);
    setQuickCustomStorageArea('');
    showToast.success('Storage area and par updated');
  };

  const updatePurchaseOption = (optionId: string, patch: Partial<PurchaseOptionDraft>) => {
    setPurchaseOptions(prev => prev.map(option => (option.id === optionId ? { ...option, ...patch } : option)));
  };

  const setMainPurchaseOption = (optionId: string) => {
    setPurchaseOptions(prev => prev.map(option => ({ ...option, isMain: option.id === optionId })));
  };

  const addPurchaseOption = () => {
    setPurchaseOptions(prev => {
      const next: PurchaseOptionDraft = {
        id: `po-${Date.now()}`,
        productName: item.name,
        supplier: item.supplier || '',
        productCode: '',
        packSize: 1,
        packUnit: item.packUnit || item.unit || 'UNIT',
        unitPrice: item.unitCost || 0,
        orderingStatus: 'OK',
        isMain: prev.length === 0,
        isLocal: true,
      };
      return [...prev, next];
    });
  };

  const removePurchaseOption = (optionId: string) => {
    setPurchaseOptions(prev => {
      if (prev.length <= 1) {
        showToast.error('At least one purchase option is required');
        return prev;
      }

      const filtered = prev.filter(option => option.id !== optionId);
      if (!filtered.some(option => option.isMain)) {
        filtered[0] = { ...filtered[0], isMain: true };
      }
      return filtered;
    });
  };

  const savePurchaseOptions = () => {
    const normalized = renderedPurchaseOptions.map(option => ({
      ...option,
      productName: option.productName.trim() || item.name,
      supplier: option.supplier.trim() || 'Unknown',
      productCode: option.productCode.trim(),
      packUnit: (option.packUnit || 'oz').trim().toLowerCase(),
      packSize: Number(option.packSize) > 0 ? Number(option.packSize) : 1,
      unitPrice: Number(option.unitPrice) >= 0 ? Number(option.unitPrice) : 0,
      orderingStatus: option.orderingStatus,
      isMain: option.isMain,
      isLocal: option.isLocal,
    }));

    const mainOption = normalized.find(option => option.isMain) || normalized[0];

    updateInventoryItem(item.id, {
      name: mainOption.productName,
      supplier: mainOption.supplier,
      vendorItemCode: mainOption.productCode,
      packSize: mainOption.packSize,
      packUnit: mainOption.packUnit,
      unitCost: mainOption.unitPrice,
      purchaseOptions: normalized,
      lastUpdated: new Date().toISOString().split('T')[0],
    });

    showToast.success('Purchase options saved');
  };

  const saveActivePurchaseOption = () => {
    if (!activePurchaseOption) return;
    const normalized = {
      ...activePurchaseOption,
      productName: activePurchaseOption.productName.trim() || item.name,
      supplier: activePurchaseOption.supplier.trim() || 'Unknown',
      productCode: activePurchaseOption.productCode.trim(),
      packUnit: (activePurchaseOption.packUnit || 'oz').trim().toLowerCase(),
      packSize: Number(activePurchaseOption.packSize) > 0 ? Number(activePurchaseOption.packSize) : 1,
      unitPrice: Number(activePurchaseOption.unitPrice) >= 0 ? Number(activePurchaseOption.unitPrice) : 0,
    };

    const nextOptions = purchaseOptions.length > 0
      ? purchaseOptions.map(option => (option.id === normalized.id ? normalized : option))
      : [normalized];

    const mainOption = nextOptions.find(option => option.isMain) || nextOptions[0];

    setPurchaseOptions(nextOptions);
    updateInventoryItem(item.id, {
      name: mainOption.productName,
      supplier: mainOption.supplier,
      vendorItemCode: mainOption.productCode,
      packSize: mainOption.packSize,
      packUnit: mainOption.packUnit,
      unitCost: mainOption.unitPrice,
      purchaseOptions: nextOptions,
      lastUpdated: new Date().toISOString().split('T')[0],
    });
    showToast.success('Purchase option saved');
  };

  // Combine stock and price history into unified timeline
  const stockHistory = (item.history || []).map(h => ({
    date: h.date,
    type: 'stock' as const,
    change: h.change,
    reason: h.reason,
    newStock: h.newStock,
  }));

  const priceHistory = (item.priceHistory || []).map(p => ({
    date: p.date,
    type: 'price' as const,
    oldPrice: p.oldPrice,
    newPrice: p.newPrice,
    reason: p.reason,
  }));

  const combinedHistory = [...stockHistory, ...priceHistory]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 20);

  // Calculate price trend if we have history
  const priceChange = item.priceHistory && item.priceHistory.length > 0
    ? ((item.unitCost - item.priceHistory[0].oldPrice) / item.priceHistory[0].oldPrice) * 100
    : 0;

  return (
    <div className="space-y-4 pb-20">
      {/* Header */}
      <div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/app/inventory')}
          className="mb-3"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back
        </Button>
        {item && item.deletable !== false && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (confirm(`Delete "${item.name}" from inventory? This cannot be undone.`)) {
                deleteInventoryItem(item.id);
                showToast.success('Item deleted');
                navigate('/app/inventory');
              }
            }}
            className="mb-3 ml-2 text-red-600 border-red-200 hover:bg-red-50"
          >
            Delete
          </Button>
        )}

        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">{item.name}</h2>
            <p className="text-sm text-gray-600 mt-1">{item.category} • {item.supplier}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge className={item.inactive ? 'bg-gray-200 text-gray-700' : isLowStock ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}>
              {item.inactive ? 'Inactive' : isLowStock ? '🟡 Low' : '🟢 OK'}
            </Badge>
            <Button variant="outline" size="sm" onClick={() => setIsEditing(current => !current)}>
              {isEditing ? 'Hide Editor' : 'Edit Item'}
            </Button>
            <Button variant="outline" size="sm" onClick={toggleInactive} className={item.inactive ? 'border-green-200 text-green-700 hover:bg-green-50' : 'border-gray-200 text-gray-700 hover:bg-gray-50'}>
              {item.inactive ? <Undo2 className="w-4 h-4 mr-1" /> : <Archive className="w-4 h-4 mr-1" />}
              {item.inactive ? 'Reactivate' : 'Deactivate'}
            </Button>
          </div>
        </div>
      </div>

      {/* Current Stock Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Current Stock</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-4xl font-bold text-gray-900">{item.currentStock}</p>
              <p className="text-sm text-gray-500 mt-1">{item.unit}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">Par Level</p>
              <p className="text-2xl font-semibold text-gray-700">{item.parLevel}</p>
            </div>
          </div>

          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all ${
                isLowStock ? 'bg-yellow-500' : 'bg-green-500'
              }`}
              style={{ width: `${Math.min(stockPercentage, 100)}%` }}
            />
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="bg-gray-50 rounded p-2">
              <p className="text-xs text-gray-500">Value</p>
              <p className="text-lg font-semibold text-gray-900">
                ${(item.currentStock * item.unitCost).toFixed(2)}
              </p>
            </div>
            <div className="bg-gray-50 rounded p-2">
              <p className="text-xs text-gray-500">Unit Cost</p>
              <div className="flex items-center space-x-1">
                <p className="text-lg font-semibold text-gray-900">
                  ${item.unitCost.toFixed(2)}
                </p>
                {priceChange !== 0 && (
                  <span className={`text-xs ${priceChange > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    ({priceChange > 0 ? '+' : ''}{priceChange.toFixed(1)}%)
                  </span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {isEditing && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Edit Item</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveItem} className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <Label htmlFor="name">Name</Label>
                  <Input id="name" value={editForm.name} onChange={event => setEditForm(prev => ({ ...prev, name: event.target.value }))} />
                </div>
                <div>
                  <Label htmlFor="supplier">Supplier</Label>
                  <Select
                    value={supplierSelection}
                    onValueChange={value => {
                      setSupplierSelection(value);
                      if (value !== NEW_SUPPLIER_VALUE) {
                        setEditForm(prev => ({ ...prev, supplier: value }));
                        setNewSupplierName('');
                      }
                    }}
                  >
                    <SelectTrigger className="mt-1 w-full">
                      <SelectValue placeholder="Select a supplier" />
                    </SelectTrigger>
                    <SelectContent>
                      {suppliers.length > 0 ? suppliers.map(supplier => (
                        <SelectItem key={supplier.id} value={supplier.name}>{supplier.name}</SelectItem>
                      )) : null}
                      <SelectItem value={NEW_SUPPLIER_VALUE}>Create new supplier</SelectItem>
                    </SelectContent>
                  </Select>
                  {supplierSelection === NEW_SUPPLIER_VALUE && (
                    <Input
                      id="newSupplier"
                      value={newSupplierName}
                      onChange={event => setNewSupplierName(event.target.value)}
                      placeholder="New supplier name"
                      className="mt-2"
                    />
                  )}
                </div>
                <div>
                  <Label htmlFor="sku">SKU</Label>
                  <Input id="sku" value={editForm.sku} onChange={event => setEditForm(prev => ({ ...prev, sku: event.target.value }))} />
                </div>
                <div>
                  <Label htmlFor="vendorItemCode">Vendor Item Code</Label>
                  <Input id="vendorItemCode" value={editForm.vendorItemCode} onChange={event => setEditForm(prev => ({ ...prev, vendorItemCode: event.target.value }))} />
                </div>
                <div>
                  <Label htmlFor="category">Category</Label>
                  <Input id="category" value={editForm.category} onChange={event => setEditForm(prev => ({ ...prev, category: event.target.value }))} />
                </div>
                <div>
                  <Label htmlFor="storageArea">Storage Area</Label>
                  <Input id="storageArea" value={editForm.storageArea} onChange={event => setEditForm(prev => ({ ...prev, storageArea: event.target.value }))} />
                </div>
                <div>
                  <Label htmlFor="unit">Unit</Label>
                  <select
                    id="unit"
                    value={editForm.unit}
                    onChange={event => setEditForm(prev => ({ ...prev, unit: event.target.value }))}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  >
                    {MARKETMAN_UOM_OPTIONS.map(option => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="parLevel">Par Level</Label>
                  <Input id="parLevel" type="number" step="0.01" value={editForm.parLevel} onChange={event => setEditForm(prev => ({ ...prev, parLevel: Number(event.target.value) }))} />
                </div>
                <div>
                  <Label htmlFor="currentStock">Current Stock</Label>
                  <Input id="currentStock" type="number" step="0.01" value={editForm.currentStock} onChange={event => setEditForm(prev => ({ ...prev, currentStock: Number(event.target.value) }))} />
                </div>
                <div>
                  <Label htmlFor="unitCost">Unit Cost</Label>
                  <Input id="unitCost" type="number" step="0.01" value={editForm.unitCost} onChange={event => setEditForm(prev => ({ ...prev, unitCost: Number(event.target.value) }))} />
                </div>
                <div>
                  <Label htmlFor="taxRate">Tax Rate (%)</Label>
                  <Input id="taxRate" type="number" step="0.01" value={editForm.taxRate} onChange={event => setEditForm(prev => ({ ...prev, taxRate: Number(event.target.value) }))} />
                </div>
                <div>
                  <Label htmlFor="reorderPoint">Reorder Point</Label>
                  <Input id="reorderPoint" type="number" step="0.01" value={editForm.reorderPoint} onChange={event => setEditForm(prev => ({ ...prev, reorderPoint: Number(event.target.value) }))} />
                </div>
                <div>
                  <Label htmlFor="minimumOrderQty">Minimum Order Qty</Label>
                  <Input id="minimumOrderQty" type="number" step="0.01" value={editForm.minimumOrderQty} onChange={event => setEditForm(prev => ({ ...prev, minimumOrderQty: Number(event.target.value) }))} />
                </div>
                <div>
                  <Label htmlFor="leadTimeDays">Lead Time (days)</Label>
                  <Input id="leadTimeDays" type="number" step="1" value={editForm.leadTimeDays} onChange={event => setEditForm(prev => ({ ...prev, leadTimeDays: Number(event.target.value) }))} />
                </div>
                <div>
                  <Label htmlFor="targetStockDays">Target Stock Days</Label>
                  <Input id="targetStockDays" type="number" step="1" value={editForm.targetStockDays} onChange={event => setEditForm(prev => ({ ...prev, targetStockDays: Number(event.target.value) }))} />
                </div>
                <div>
                  <Label htmlFor="packSize">Pack Size</Label>
                  <Input id="packSize" type="number" step="0.01" value={editForm.packSize} onChange={event => setEditForm(prev => ({ ...prev, packSize: Number(event.target.value) }))} />
                </div>
                <div>
                  <Label htmlFor="packUnit">Pack Unit</Label>
                  <select
                    id="packUnit"
                    value={editForm.packUnit}
                    onChange={event => setEditForm(prev => ({ ...prev, packUnit: event.target.value }))}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  >
                    {MARKETMAN_UOM_OPTIONS.map(option => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="unitsPerPack">Units Per Pack</Label>
                  <Input id="unitsPerPack" type="number" step="0.01" value={editForm.unitsPerPack} onChange={event => setEditForm(prev => ({ ...prev, unitsPerPack: Number(event.target.value) }))} />
                </div>
                <div>
                  <Label htmlFor="yieldPercent">Yield (%)</Label>
                  <Input id="yieldPercent" type="number" step="0.01" value={editForm.yieldPercent} onChange={event => setEditForm(prev => ({ ...prev, yieldPercent: Number(event.target.value) }))} />
                </div>
                <div>
                  <Label htmlFor="wastePercent">Waste (%)</Label>
                  <Input id="wastePercent" type="number" step="0.01" value={editForm.wastePercent} onChange={event => setEditForm(prev => ({ ...prev, wastePercent: Number(event.target.value) }))} />
                </div>
                <div>
                  <Label htmlFor="lastCountedAt">Last Counted</Label>
                  <Input id="lastCountedAt" type="date" value={editForm.lastCountedAt ? editForm.lastCountedAt.slice(0, 10) : ''} onChange={event => setEditForm(prev => ({ ...prev, lastCountedAt: event.target.value }))} />
                </div>
              </div>
              <div>
                <Label htmlFor="notes">Notes</Label>
                <textarea
                  id="notes"
                  value={editForm.notes}
                  onChange={event => setEditForm(prev => ({ ...prev, notes: event.target.value }))}
                  className="min-h-[84px] w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  placeholder="Storage notes, substitutions, handling instructions..."
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsEditing(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="bg-[#0F172A] hover:bg-[#1E293B] text-white">
                  Save Changes
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Item Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <div className="min-w-[860px] rounded-xl border border-gray-200 bg-white shadow-sm">
              <div
                className="grid bg-slate-50 px-3 py-2 border-b border-slate-200"
                style={{ gridTemplateColumns: '1.35fr 1fr 112px 1fr 1.1fr 96px 96px' }}
              >
                {(['Product', 'Supplier', 'SKU', 'Category', 'Price', 'Tax rate', 'Tax value'] as const).map((heading) => (
                  <p key={heading} className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                    {heading}
                  </p>
                ))}
              </div>

              <div
                className="grid px-3 py-2.5 border-b border-slate-100"
                style={{ gridTemplateColumns: '1.35fr 1fr 112px 1fr 1.1fr 96px 96px' }}
              >
                <p className="text-sm font-semibold text-slate-900 truncate pr-2" title={item.name}>{item.name}</p>
                <p className="text-sm text-slate-700 truncate pr-2" title={item.supplier || 'Unknown'}>{item.supplier || 'Unknown'}</p>
                <p className="text-xs text-slate-600" style={{ fontFamily: 'var(--font-mono)' }}>{marketmanSku || 'N/A'}</p>
                <p className="text-sm text-slate-700 truncate pr-2" title={item.category}>{item.category}</p>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900" style={{ fontFamily: 'var(--font-mono)' }}>
                    ${item.unitCost.toFixed(2)}
                  </p>
                  <p className="text-[10px] text-slate-500 truncate">
                    Pricing date - {pricingDateLabel} , Unit price - ${item.unitCost.toFixed(2)}
                  </p>
                </div>
                <p className="text-sm text-slate-600">0% tax</p>
                <p className="text-sm text-slate-600" style={{ fontFamily: 'var(--font-mono)' }}>$0.00</p>
              </div>

              <div className="grid gap-3 px-3 py-2.5 sm:grid-cols-3 bg-slate-50/40">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-slate-500">Pricing date</p>
                  <p className="text-sm font-medium text-slate-800 mt-1">{pricingDateLabel}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-slate-500">Unit price</p>
                  <p className="text-sm font-medium text-slate-800 mt-1" style={{ fontFamily: 'var(--font-mono)' }}>${item.unitCost.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-slate-500">Storage area</p>
                  <p className="text-sm font-medium text-slate-800 mt-1">{item.storageArea || 'Unassigned'}</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Purchasing & Inventory</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center justify-between gap-2 border-b border-gray-100 bg-gray-50 px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-600">Purchase options</p>
              <Button type="button" variant="outline" size="sm" onClick={() => setIsPurchaseOptionsExpanded(prev => !prev)} className="h-8 px-3 text-xs rounded-full border-gray-200 bg-white text-gray-700 hover:bg-gray-50">
                {isPurchaseOptionsExpanded ? 'Close' : 'Open'}
              </Button>
            </div>
            {isPurchaseOptionsExpanded && activePurchaseOption && (
              <div className="space-y-4 p-4 sm:p-5">
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-gray-100 bg-[#FEFCE8] px-4 py-3 shadow-sm">
                  <button type="button" className="min-w-0 flex-1 text-left text-sm font-bold text-gray-900 truncate" onClick={() => setIsEditing(prev => !prev)}>
                    {activePurchaseOption.productName}
                  </button>
                  <Button type="button" size="sm" onClick={saveActivePurchaseOption} className="h-8 rounded-full bg-[#0F172A] px-4 text-white hover:bg-[#1E293B]">
                    Save
                  </Button>
                </div>

                <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-gray-500">Product description</p>
                    <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs text-gray-400"></Button>
                  </div>

                  <div className="rounded-2xl border border-gray-100 bg-gray-50/80 p-4 space-y-4">
                    <div className="grid gap-3 md:grid-cols-[1.3fr_1.3fr_1fr]">
                      <div>
                        <Label className="text-xs font-semibold text-gray-700">Select Supplier *</Label>
                        <Select
                          value={activePurchaseOption.supplier}
                          onValueChange={(value) => updatePurchaseOption(activePurchaseOption.id, { supplier: value })}
                        >
                          <SelectTrigger className="mt-1 h-9 w-full">
                            <SelectValue placeholder="Select a supplier" />
                          </SelectTrigger>
                          <SelectContent>
                            {suppliers.map(supplier => (
                              <SelectItem key={supplier.id} value={supplier.name}>{supplier.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs font-semibold text-gray-700">Product name *</Label>
                        <Input value={activePurchaseOption.productName} onChange={(event) => updatePurchaseOption(activePurchaseOption.id, { productName: event.target.value })} className="mt-1 h-9" />
                      </div>
                      <div>
                        <Label className="text-xs font-semibold text-gray-700">Product Code</Label>
                        <Input value={activePurchaseOption.productCode} onChange={(event) => updatePurchaseOption(activePurchaseOption.id, { productCode: event.target.value })} className="mt-1 h-9" placeholder="Optional, e.g. supplier SKU" />
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-gray-100 bg-gray-50/80 p-4 space-y-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-gray-500">Purchasing case</p>
                    <p className="text-xs text-gray-500">Ordering unit description: {activePurchaseOption.packSize} {activePurchaseOption.packUnit}</p>
                    <div className="grid gap-3 md:grid-cols-[1fr_1fr_1fr]">
                      <div>
                        <Label className="text-xs font-semibold text-gray-700">Inner pack quantity *</Label>
                        <div className="mt-1 flex items-center gap-2">
                          <Input type="number" min={0} step="0.01" value={activePurchaseOption.packSize} onChange={(event) => updatePurchaseOption(activePurchaseOption.id, { packSize: Number(event.target.value) })} className="h-9" />
                          <select value={activePurchaseOption.packUnit} onChange={(event) => updatePurchaseOption(activePurchaseOption.id, { packUnit: event.target.value })} className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm">
                            {MARKETMAN_UOM_OPTIONS.map(uom => (<option key={uom} value={uom}>{uom}</option>))}
                          </select>
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs font-semibold text-gray-700">Pack nickname</Label>
                        <Input value={activePurchaseOption.packUnit} onChange={(event) => updatePurchaseOption(activePurchaseOption.id, { packUnit: event.target.value })} className="mt-1 h-9" />
                      </div>
                      <div>
                        <Label className="text-xs font-semibold text-gray-700">Packs per case</Label>
                        <Input type="number" min={0} step="0.01" value={activePurchaseOption.packSize} onChange={(event) => updatePurchaseOption(activePurchaseOption.id, { packSize: Number(event.target.value) })} className="mt-1 h-9" />
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-gray-100 bg-gray-50/80 p-4 space-y-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-gray-500">Pricing</p>
                    <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
                      <div>
                        <Label className="text-xs font-semibold text-gray-700">Price</Label>
                        <div className="mt-1 flex items-center gap-2">
                          <span className="text-sm font-semibold text-gray-500">$</span>
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            value={Number(activePurchaseOption.unitPrice ?? 0).toString()}
                            onChange={(event) => updatePurchaseOption(activePurchaseOption.id, { unitPrice: Number(event.target.value) })}
                            className="h-9"
                          />
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs font-semibold text-gray-700">Tax rate</Label>
                        <select className="mt-1 h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm" value="0% tax" readOnly>
                          <option>0% tax</option>
                        </select>
                      </div>
                      <Button type="button" variant="outline" size="sm" className="h-9 rounded-full border-gray-200 bg-white">Add Discount</Button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button type="button" variant="outline" size="sm" className="h-8 rounded-full border-gray-200 bg-white px-3 text-gray-700">Additional settings</Button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" className="text-xs rounded-full border-gray-200 bg-white text-gray-700" onClick={addPurchaseOption}>Add new purchase option</Button>
                  <Button type="button" variant="outline" size="sm" className="text-xs rounded-full border-gray-200 bg-white text-gray-700" onClick={() => removePurchaseOption(activePurchaseOption.id)}>Delete</Button>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-3 py-2 bg-slate-50 border-b border-slate-200">
              <p className="text-xs font-bold text-slate-800">Counting and Inventory management</p>
            </div>
            <div className="grid gap-2 px-3 py-3 md:grid-cols-[1fr_1fr_1fr_auto] border-b border-slate-100 bg-white">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">Storage area</p>
                <select
                  value={quickStorageArea}
                  onChange={(event) => setQuickStorageArea(event.target.value)}
                  className="w-full rounded-md border border-slate-300 px-2.5 py-2 text-sm"
                >
                  {storageAreas.map(area => (
                    <option key={area} value={area}>{area}</option>
                  ))}
                </select>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">Add storage area</p>
                <Input
                  value={quickCustomStorageArea}
                  onChange={(event) => setQuickCustomStorageArea(event.target.value)}
                  placeholder="e.g. Prep Cooler"
                  className="h-10"
                />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">Par</p>
                <Input
                  type="number"
                  step="0.01"
                  value={quickParLevel}
                  onChange={(event) => setQuickParLevel(Number(event.target.value))}
                  className="h-10"
                />
              </div>
              <div className="flex items-end">
                <Button type="button" onClick={saveQuickInventoryManagement} className="bg-[#0F172A] hover:bg-[#1E293B] text-white">
                  Save Counting
                </Button>
              </div>
            </div>
            <div className="grid gap-3 px-3 py-3 md:grid-cols-2">
              <div className="rounded-lg border border-slate-200 bg-white p-3">
                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Storage areas</p>
                <p className="mt-1 text-sm text-slate-800">{item.storageArea || 'Unassigned'}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-3">
                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Count forms (up to 4 allowed)</p>
                <p className="mt-1 text-sm text-slate-800">{item.unit}, Pack {(item.packSize ?? 1)} {item.packUnit || item.unit}</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-3 py-2 bg-slate-50 border-b border-slate-200">
              <p className="text-xs font-bold text-slate-800">Advanced item definition</p>
            </div>
            <div className="grid gap-2 px-3 py-3 md:grid-cols-[1fr_1fr_auto] border-b border-slate-100 bg-white">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">Inventory UOM</p>
                <select
                  value={quickUom}
                  onChange={(event) => setQuickUom(event.target.value)}
                  className="w-full rounded-md border border-slate-300 px-2.5 py-2 text-sm"
                >
                  {MARKETMAN_UOM_OPTIONS.map(option => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">Unit for reports</p>
                <select
                  value={quickReportUom}
                  onChange={(event) => setQuickReportUom(event.target.value)}
                  className="w-full rounded-md border border-slate-300 px-2.5 py-2 text-sm"
                >
                  {MARKETMAN_UOM_OPTIONS.map(option => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <Button type="button" onClick={saveQuickUom} className="bg-[#0F172A] hover:bg-[#1E293B] text-white">
                  Save UOM
                </Button>
              </div>
            </div>
            <div className="grid gap-3 px-3 py-3 md:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-lg border border-slate-200 bg-white p-3">
                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Inventory UOM</p>
                <p className="mt-1 text-sm text-slate-800">{item.unit}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-3">
                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Unit for reports</p>
                <p className="mt-1 text-sm text-slate-800">{item.packUnit || item.unit}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-3">
                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Min on hand</p>
                <p className="mt-1 text-sm text-slate-800">{(item.reorderPoint ?? 0).toFixed(2)} {item.unit}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-3">
                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Par</p>
                <p className="mt-1 text-sm text-slate-800">{item.parLevel.toFixed(2)} {item.unit}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-3">
                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Lead time / reorder</p>
                <p className="mt-1 text-sm text-slate-800">{item.leadTimeDays ?? 0}d / {suggestedReorderQty.toFixed(2)} {item.unit}</p>
              </div>
            </div>
            {item.notes && (
              <div className="mx-3 mb-3 rounded-lg border border-slate-200 bg-white p-3">
                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Notes</p>
                <p className="mt-1 text-sm text-slate-700 whitespace-pre-wrap">{item.notes}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center">
            <BookOpen className="w-4 h-4 mr-2 text-[#2563EB]" />
            Used In Recipes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {allRecipeUsage.length === 0 ? (
            <p className="text-sm text-gray-500">This item is not currently linked to any menu or prep recipes.</p>
          ) : (
            <div className="space-y-2">
              {allRecipeUsage.map((usage) => (
                <div key={`${usage.type}-${usage.id}`} className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-gray-900">{usage.name}</p>
                    <p className="text-xs text-gray-500">
                      {usage.type === 'menu' ? 'Menu Item' : 'Preparation'} • {usage.category}
                    </p>
                  </div>
                  <p className="ml-3 text-sm font-medium text-gray-700 whitespace-nowrap">
                    {usage.quantity} {usage.unit}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Usage Breakdown Today */}
      {usageByDish.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center">
              <TrendingDown className="w-4 h-4 mr-2 text-[#2563EB]" />
              Usage Today
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {usageByDish.map((usage, index) => (
                <div key={index} className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-medium text-sm text-gray-900">{usage?.dishName}</p>
                    <p className="text-sm font-semibold text-red-600">
                      -{usage?.usedAmount.toFixed(1)} {usage?.unit}
                    </p>
                  </div>
                  <p className="text-xs text-gray-500">
                    {usage?.soldCount} dishes sold
                  </p>
                </div>
              ))}
              <div className="pt-2 border-t">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-700">Total Used</p>
                  <p className="text-base font-bold text-red-600">
                    -{actualUsage.toFixed(1)} {item.unit}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 7-Day Trend */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center">
            <TrendingUp className="w-4 h-4 mr-2 text-[#2563EB]" />
            Usage Trend (7 Days)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={last7Days}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line 
                type="monotone" 
                dataKey="usage" 
                stroke="#3b82f6" 
                strokeWidth={2}
                name={`Usage (${item.unit})`}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Variance Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center">
            <AlertTriangle className="w-4 h-4 mr-2 text-orange-500" />
            Variance Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-[#FEFCE8] rounded p-2">
                <p className="text-xs text-gray-600">Expected</p>
                <p className="text-lg font-semibold text-gray-900">
                  {expectedUsage} {item.unit}
                </p>
              </div>
              <div className="bg-gray-50 rounded p-2">
                <p className="text-xs text-gray-600">Actual</p>
                <p className="text-lg font-semibold text-gray-900">
                  {actualUsage.toFixed(1)} {item.unit}
                </p>
              </div>
              <div className={`rounded p-2 ${variance < 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                <p className="text-xs text-gray-600">Variance</p>
                <p className={`text-lg font-semibold ${variance < 0 ? 'text-green-700' : 'text-red-700'}`}>
                  {variance > 0 ? '+' : ''}{variance.toFixed(1)} {item.unit}
                </p>
              </div>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
              <p className="text-xs font-medium text-yellow-900 mb-1">Why are we off?</p>
              <p className="text-xs text-yellow-800">
                {variance > 0 
                  ? 'Higher than expected usage - check for waste or portion control'
                  : 'Lower than expected - sales may be down or portions are smaller'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Adjust Inventory Button */}
      <Dialog open={isAdjustDialogOpen} onOpenChange={setIsAdjustDialogOpen}>
        <DialogTrigger asChild>
          <Button className="w-full bg-[#0F172A] hover:bg-[#1E293B] text-white" size="lg">
            🔄 Adjust Inventory
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-[calc(100vw-2rem)]">
          <DialogHeader>
            <DialogTitle>Adjust {item.name}</DialogTitle>
            <DialogDescription>Add or remove stock and record the reason for the adjustment</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAdjustInventory} className="space-y-4">
            <div>
              <Label>Action Type</Label>
              <div className="grid grid-cols-2 gap-3 mt-2">
                <label className="relative flex items-center justify-center p-3 border-2 border-gray-300 rounded-lg cursor-pointer has-[:checked]:border-green-500 has-[:checked]:bg-green-50">
                  <input type="radio" name="type" value="add" className="sr-only" required />
                  <div className="text-center">
                    <Plus className="w-6 h-6 mx-auto mb-1 text-green-600" />
                    <p className="text-sm font-medium">Add Stock</p>
                  </div>
                </label>
                <label className="relative flex items-center justify-center p-3 border-2 border-gray-300 rounded-lg cursor-pointer has-[:checked]:border-red-500 has-[:checked]:bg-red-50">
                  <input type="radio" name="type" value="remove" className="sr-only" required />
                  <div className="text-center">
                    <Minus className="w-6 h-6 mx-auto mb-1 text-red-600" />
                    <p className="text-sm font-medium">Remove Stock</p>
                  </div>
                </label>
              </div>
            </div>

            <div>
              <Label htmlFor="change">Amount ({item.unit})</Label>
              <Input
                id="change"
                name="change"
                type="number"
                step="0.01"
                required
                placeholder={`Enter amount in ${item.unit}`}
              />
            </div>

            <div>
              <Label htmlFor="reason">Reason</Label>
              <select
                id="reason"
                name="reason"
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                required
              >
                <option value="">Select reason...</option>
                <option value="Delivery received">Delivery received</option>
                <option value="Waste/spoilage">Waste/spoilage</option>
                <option value="Transfer">Transfer</option>
                <option value="Count adjustment">Count adjustment</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setIsAdjustDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-[#0F172A] hover:bg-[#1E293B] text-white">
                Adjust Inventory
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* History - Combined Stock & Price Changes */}
      {combinedHistory.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center">
                <Calendar className="w-4 h-4 mr-2 text-[#2563EB]" />
                Change History
              </CardTitle>
            </div>
            {/* Tabs for filtering */}
            <div className="flex space-x-2 mt-3">
              <button
                onClick={() => setActiveTab('stock')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  activeTab === 'stock'
                    ? 'bg-[#FEF9C3] text-[#0F172A]'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Stock Changes ({stockHistory.length})
              </button>
              <button
                onClick={() => setActiveTab('price')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  activeTab === 'price'
                    ? 'bg-green-100 text-green-900'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Price Changes ({priceHistory.length})
              </button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {combinedHistory
                .filter(record => activeTab === 'stock' ? record.type === 'stock' : record.type === 'price')
                .map((record, index) => (
                  <div key={index} className="flex items-start justify-between py-3 border-b last:border-0">
                    {record.type === 'stock' ? (
                      <>
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <Package className="w-4 h-4 text-[#2563EB]" />
                            <p className="text-sm font-medium text-gray-900">{record.reason}</p>
                          </div>
                          <p className="text-xs text-gray-500 ml-6 mt-1">
                            {new Date(record.date).toLocaleDateString('en-US', { 
                              month: 'short', 
                              day: 'numeric',
                              year: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit'
                            })}
                          </p>
                        </div>
                        <div className="text-right ml-4">
                          <p className={`text-sm font-semibold ${record.change > 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {record.change > 0 ? '+' : ''}{record.change} {item.unit}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            New: {record.newStock} {item.unit}
                          </p>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <DollarSign className="w-4 h-4 text-green-600" />
                            <p className="text-sm font-medium text-gray-900">
                              {record.reason || 'Price updated'}
                            </p>
                          </div>
                          <p className="text-xs text-gray-500 ml-6 mt-1">
                            {new Date(record.date).toLocaleDateString('en-US', { 
                              month: 'short', 
                              day: 'numeric',
                              year: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit'
                            })}
                          </p>
                        </div>
                        <div className="text-right ml-4">
                          <div className="flex items-center space-x-1 justify-end">
                            <p className="text-xs text-gray-500 line-through">
                              ${record.oldPrice.toFixed(2)}
                            </p>
                            <span className="text-xs text-gray-400">→</span>
                            <p className="text-sm font-semibold text-gray-900">
                              ${record.newPrice.toFixed(2)}
                            </p>
                          </div>
                          <p className={`text-xs mt-0.5 ${
                            record.newPrice > record.oldPrice ? 'text-red-600' : 'text-green-600'
                          }`}>
                            {record.newPrice > record.oldPrice ? '+' : ''}
                            {((record.newPrice - record.oldPrice) / record.oldPrice * 100).toFixed(1)}%
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              
              {((activeTab === 'stock' && stockHistory.length === 0) || 
                (activeTab === 'price' && priceHistory.length === 0)) && (
                <div className="text-center py-8 text-gray-500 text-sm">
                  No {activeTab} changes recorded yet
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
