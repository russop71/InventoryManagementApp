import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { useMemo, useState } from 'react';
import { apiRequest } from '../utils/api';
import { useInventory } from '../contexts/InventoryContext';
import { useToast } from '../contexts/ToastContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Calendar, Plus, TrendingUp, Sparkles, ShoppingBag, DollarSign, Mail, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { getSupplierCcEmails, getSupplierEmailAddress } from '../utils/supplierEmailDraft.js';
import { useAuth } from '../contexts/AuthContext';

interface SupplierEmail {
  supplier: string;
  supplierEmail: string;
  ccEmails: string[];
  items: {
    name: string;
    quantity: number;
    unit: string;
    unitCost: number;
    totalCost: number;
  }[];
  totalCost: number;
  emailBody: string;
  emailSubject: string;
}

async function resolveWeatherContext(targetDate: string) {
  const fallbackWeather = {
    summary: 'Typical local conditions',
    tempC: 20,
    precipitationChance: 0.2,
  };

  try {
    const coordinates = await new Promise<{ latitude: number; longitude: number } | null>(resolve => {
      if (!navigator.geolocation) return resolve(null);
      const timeout = window.setTimeout(() => resolve(null), 3500);
      navigator.geolocation.getCurrentPosition(
        position => { window.clearTimeout(timeout); resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude }); },
        () => { window.clearTimeout(timeout); resolve(null); },
        { enableHighAccuracy: false, maximumAge: 30 * 60 * 1000, timeout: 3000 },
      );
    });
    const latitude = coordinates?.latitude ?? 43.6532;
    const longitude = coordinates?.longitude ?? -79.3832;
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_mean&timezone=auto&forecast_days=7`;
    const response = await fetch(weatherUrl);
    if (!response.ok) throw new Error('Weather lookup failed');

    const data = await response.json();
    const dailyTimes = data.daily?.time || [];
    const dailyTempsMax = data.daily?.temperature_2m_max || [];
    const dailyTempsMin = data.daily?.temperature_2m_min || [];
    const dailyPrecip = data.daily?.precipitation_probability_mean || [];
    const targetIndex = dailyTimes.findIndex((date: string) => date === targetDate);
    const lookupIndex = targetIndex >= 0 ? targetIndex : Math.max(dailyTimes.length - 1, 0);

    const tempMax = Number(dailyTempsMax[lookupIndex] ?? 20);
    const tempMin = Number(dailyTempsMin[lookupIndex] ?? 20);
    const temperature = Number.isFinite(tempMax) && Number.isFinite(tempMin) ? (tempMax + tempMin) / 2 : 20;
    const precipitationChance = Number(dailyPrecip[lookupIndex] ?? 0.2) / 100;

    return {
      summary: precipitationChance > 0.6 ? 'Rain expected' : 'Dry weather expected',
      tempC: Math.round(temperature),
      precipitationChance,
      source: coordinates ? 'Restaurant device location' : 'Toronto fallback',
    };
  } catch {
    return fallbackWeather;
  }
}

async function resolveEventContext(targetDate: string) {
  try {
    const [year] = targetDate.split('-');
    const response = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/CA`);
    if (!response.ok) throw new Error('Holiday lookup failed');

    const data = await response.json();
    const matchingEvents = Array.isArray(data)
      ? data.filter((event: { date?: string }) => event.date === targetDate)
      : [];
    const holidayNames = matchingEvents
      .map((event: { localName?: string; name?: string }) => event.localName || event.name)
      .filter(Boolean) as string[];

    return {
      localEvents: holidayNames.length > 0 ? holidayNames : ['No major local events detected'],
      holidayNames,
      eventCount: holidayNames.length,
    };
  } catch {
    const month = Number((targetDate || '').slice(5, 7));
    const day = Number((targetDate || '').slice(8, 10));
    const fallbackEvents = [] as string[];

    if ((month === 12 && day >= 20) || (month === 1 && day <= 3)) fallbackEvents.push('Holiday season');
    if (month === 7 && day === 1) fallbackEvents.push('Canada Day');
    if (month === 10 && day === 31) fallbackEvents.push('Halloween');
    if (month === 12 && day === 25) fallbackEvents.push('Christmas');

    return {
      localEvents: fallbackEvents.length > 0 ? fallbackEvents : ['No major local events detected'],
      holidayNames: fallbackEvents,
      eventCount: fallbackEvents.length,
    };
  }
}

export function Forecasting() {
  const { accountName, user } = useAuth();
  const restaurantName = accountName?.trim() || 'Your Restaurant';
  const { inventory, forecasts, addForecast, generateDailyOrder, suppliers } = useInventory();
  const { isConnected, salesData, menuItems } = useToast();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedItems, setSelectedItems] = useState<{ itemId: string; expectedUsage: number }[]>([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [expectedRevenue, setExpectedRevenue] = useState<number>(0);
  const [predictedMenuItems, setPredictedMenuItems] = useState<{ name: string; quantity: number }[]>([]);
  const [forecastContext, setForecastContext] = useState<{ weatherSummary: string; confidence: number } | null>(null);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [draftEmails, setDraftEmails] = useState<SupplierEmail[]>([]);
  const isDemoAccount = user?.email?.trim().toLowerCase() === 'demo@zestiq.com';

  // Calculate predicted item usage based on connected POS sales data
  const handleAutoPredict = async () => {
    if (!selectedDate || !expectedRevenue) {
      toast.error('Please enter a date and expected revenue');
      return;
    }

    if (!isConnected || salesData.length === 0) {
      toast.error('Connect POS sales first so AI can learn from historical sales');
      return;
    }

    try {
      const forecastDate = new Date(selectedDate);
      const dayOfWeek = forecastDate.getDay();
      const month = forecastDate.getMonth() + 1;
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

      const weatherContext = await resolveWeatherContext(selectedDate);
      const eventContext = await resolveEventContext(selectedDate);

      const eventSummary = {
        localEvents: eventContext.localEvents,
        season: month >= 6 && month <= 8 ? 'summer' : month >= 9 && month <= 11 ? 'fall' : month >= 12 || month <= 2 ? 'winter' : 'spring',
        isWeekend,
      };

      const payload = {
        date: selectedDate,
        expectedRevenue,
        history: salesData,
        menuItems,
        inventory,
        weather: weatherContext,
        events: eventSummary,
      };

      const result = await apiRequest<{ predictedMenuItems: Array<{ name: string; quantity: number }>; ingredientUsage: Array<{ itemId: string; expectedUsage: number }>; summary: string; confidence: number }>(
        '/api/forecast/sales',
        {
          method: 'POST',
          body: JSON.stringify(payload),
        },
      );

      const predicted = (result.ingredientUsage || []).filter(item => inventory.some(i => i.id === item.itemId));
      const menuForecast = (result.predictedMenuItems || []).length > 0
        ? (result.predictedMenuItems || [])
        : menuItems.map(menuItem => ({
            name: menuItem.name,
            quantity: Math.max(1, Math.round((salesData[salesData.length - 1]?.revenue || expectedRevenue) / Math.max(menuItem.price, 1) / 10)),
          }));
      setPredictedMenuItems(menuForecast);
      setSelectedItems(predicted);
      setForecastContext({ weatherSummary: `${weatherContext.summary} · ${weatherContext.tempC}°C`, confidence: result.confidence || 0.6 });
      toast.success(result.summary || `Forecast ready with ${predicted.length} ingredient predictions`);
    } catch (error) {
      console.error('AI forecast failed', error);
      const avgRevenue = salesData.reduce((sum, day) => sum + day.revenue, 0) / salesData.length;
      const revenueMultiplier = expectedRevenue / Math.max(avgRevenue, 1);
      const itemPredictions = menuItems.map(menuItem => {
        const totalSold = salesData.reduce((sum, day) => {
          const itemSales = day.topItems.find(item => item.itemName === menuItem.name);
          return sum + (itemSales?.quantity || 0);
        }, 0);
        const avgSold = salesData.length > 0 ? totalSold / salesData.length : 0;
        const predictedSold = Math.max(1, Math.round(avgSold * revenueMultiplier));
        return {
          menuItem,
          predictedSold,
        };
      });

      const ingredientUsage = new Map<string, number>();
      itemPredictions.forEach(({ menuItem, predictedSold }) => {
        menuItem.ingredients.forEach(ingredient => {
          const currentUsage = ingredientUsage.get(ingredient.inventoryItemId) || 0;
          ingredientUsage.set(ingredient.inventoryItemId, currentUsage + (predictedSold * ingredient.quantity));
        });
      });

      const fallbackPredicted = Array.from(ingredientUsage.entries()).map(([itemId, usage]) => ({
        itemId,
        expectedUsage: Math.round(usage * 100) / 100,
      })).filter(item => inventory.some(i => i.id === item.itemId));

      setPredictedMenuItems(itemPredictions.map(p => ({ name: p.menuItem.name, quantity: p.predictedSold })));
      setSelectedItems(fallbackPredicted);
      setForecastContext({ weatherSummary: 'Sales-history forecast', confidence: 0.45 });
      toast.success('Forecast generated with fallback rules');
    }
  };

  const handleAddForecast = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    const newForecast = {
      date: selectedDate,
      expectedCovers: expectedRevenue, // Storing as expectedCovers for backwards compatibility
      weatherSummary: forecastContext?.weatherSummary,
      confidence: forecastContext?.confidence,
      items: selectedItems,
    };

    addForecast(newForecast);
    setIsAddDialogOpen(false);
    setSelectedItems([]);
    setSelectedDate('');
    setExpectedRevenue(0);
    setPredictedMenuItems([]);
    setForecastContext(null);
    toast.success('Forecast added successfully');
  };

  const handleAddItemToForecast = (itemId: string) => {
    if (!selectedItems.find(item => item.itemId === itemId)) {
      setSelectedItems([...selectedItems, { itemId, expectedUsage: 0 }]);
    }
  };

  const handleUpdateItemUsage = (itemId: string, usage: number) => {
    setSelectedItems(selectedItems.map(item =>
      item.itemId === itemId ? { ...item, expectedUsage: usage } : item
    ));
  };

  const handleRemoveItem = (itemId: string) => {
    setSelectedItems(selectedItems.filter(item => item.itemId !== itemId));
  };

  const handleGenerateOrder = (forecastId: string) => {
    const forecast = forecasts.find(f => f.id === forecastId);
    if (!forecast) return;

    // Calculate which items need to be ordered based on forecast
    const itemsToOrder: {
      item: any;
      quantity: number;
      projectedStock: number;
    }[] = [];

    forecast.items.forEach(({ itemId, expectedUsage }) => {
      const item = inventory.find(i => i.id === itemId);
      if (!item) return;

      const projectedStock = item.currentStock - expectedUsage;
      const needsOrder = projectedStock < item.parLevel;

      if (needsOrder) {
        const orderQuantity = item.parLevel - projectedStock;
        itemsToOrder.push({
          item,
          quantity: Math.ceil(orderQuantity),
          projectedStock,
        });
      }
    });

    if (itemsToOrder.length === 0) {
      toast.success('No orders needed - all items are well stocked!');
      return;
    }

    // Group orders by supplier
    const supplierMap: { [key: string]: typeof itemsToOrder } = {};
    itemsToOrder.forEach(orderItem => {
      const supplier = orderItem.item.supplier;
      if (!supplierMap[supplier]) {
        supplierMap[supplier] = [];
      }
      supplierMap[supplier].push(orderItem);
    });

    const forecastDate = new Date(forecast.date).toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    const emails: SupplierEmail[] = Object.keys(supplierMap).map(supplier => {
      const items = supplierMap[supplier];
      const totalCost = items.reduce((sum, orderItem) => sum + (orderItem.quantity * orderItem.item.unitCost), 0);
      
      const emailItems = items.map(orderItem => ({
        name: orderItem.item.name,
        quantity: orderItem.quantity,
        unit: orderItem.item.unit,
        unitCost: orderItem.item.unitCost,
        totalCost: orderItem.quantity * orderItem.item.unitCost,
      }));

      const emailBody = `Subject: Order Request for ${forecastDate} - ${restaurantName}

Dear ${supplier} Team,

We'd like to place the following order for ${restaurantName} based on our sales forecast for ${forecastDate}:

ORDER DETAILS:
${emailItems.map((item, idx) => 
  `${idx + 1}. ${item.name}
   Quantity: ${item.quantity} ${item.unit}
   Unit Price: $${item.unitCost.toFixed(2)}
   Line Total: $${item.totalCost.toFixed(2)}`
).join('\n\n')}

TOTAL ORDER VALUE: $${totalCost.toFixed(2)}

Expected Revenue: $${forecast.expectedCovers.toFixed(2)}
Forecast Date: ${forecastDate}

Please confirm availability and estimated delivery date at your earliest convenience.

Thank you for your continued partnership.

Best regards,
${restaurantName}
Restaurant Operations Team`;

      return {
        supplier,
        supplierEmail: getSupplierEmailAddress(supplier, suppliers),
        ccEmails: getSupplierCcEmails(supplier, suppliers),
        items: emailItems,
        totalCost,
        emailBody,
        emailSubject: `Order Request for ${forecastDate} - ${restaurantName}`,
      };
    });

    setDraftEmails(emails);
    setShowEmailDialog(true);
    generateDailyOrder(forecastId);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Email copied to clipboard!');
  };

  const openEmailClient = (email: SupplierEmail) => {
    const params = new URLSearchParams({ subject: email.emailSubject, body: email.emailBody });
    if (email.ccEmails.length) params.set('cc', email.ccEmails.join(','));
    const mailtoLink = `mailto:${encodeURIComponent(email.supplierEmail)}?${params.toString()}`;
    window.location.href = mailtoLink;
  };

  // Calculate average revenue from connected POS data for placeholder
  const avgRevenue = isConnected && salesData.length > 0
    ? Math.round(salesData.reduce((sum, day) => sum + day.revenue, 0) / salesData.length)
    : 0;

  const salesProjection = useMemo(() => {
    if (!salesData.length) return [];
    const recentWeek = salesData.slice(-7);
    const previousWeek = salesData.slice(-14, -7);
    const recentAverage = recentWeek.reduce((sum, day) => sum + day.revenue, 0) / Math.max(recentWeek.length, 1);
    const previousAverage = previousWeek.reduce((sum, day) => sum + day.revenue, 0) / Math.max(previousWeek.length, 1);
    const trend = previousAverage > 0 ? Math.min(1.12, Math.max(0.9, recentAverage / previousAverage)) : 1;

    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setHours(12, 0, 0, 0);
      date.setDate(date.getDate() + index + 1);
      const matchingDays = salesData.filter(day => new Date(`${day.date}T12:00:00`).getDay() === date.getDay());
      const baseline = matchingDays.length
        ? matchingDays.reduce((sum, day) => sum + day.revenue, 0) / matchingDays.length
        : recentAverage;
      const revenue = Math.round(baseline * trend);
      return {
        date: date.toISOString().slice(0, 10),
        label: date.toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' }),
        revenue,
        covers: Math.round(revenue / 42),
      };
    });
  }, [salesData]);

  const buildDemoForecast = () => {
    const tomorrow = salesProjection[0];
    if (!tomorrow) return;
    const usage = new Map<string, number>();
    const menuPrediction = menuItems.map(menuItem => {
      const historicQuantity = salesData.reduce((sum, day) => {
        const line = day.topItems.find(item => item.itemName === menuItem.name);
        return sum + (line?.quantity || 0);
      }, 0) / Math.max(salesData.length, 1);
      const quantity = Math.max(1, Math.round(historicQuantity * (tomorrow.revenue / Math.max(avgRevenue, 1))));
      menuItem.ingredients.forEach(ingredient => {
        usage.set(ingredient.inventoryItemId, (usage.get(ingredient.inventoryItemId) || 0) + ingredient.quantity * quantity);
      });
      return { name: menuItem.name, quantity };
    });

    setSelectedDate(tomorrow.date);
    setExpectedRevenue(tomorrow.revenue);
    setPredictedMenuItems(menuPrediction);
    setSelectedItems(Array.from(usage.entries()).map(([itemId, expectedUsage]) => ({
      itemId,
      expectedUsage: Math.round(expectedUsage * 100) / 100,
    })).filter(item => inventory.some(inventoryItem => inventoryItem.id === item.itemId)));
    setIsAddDialogOpen(true);
    toast.success("Tomorrow's Zestaurant sales projection is ready to review.");
  };

  return (
    <div className="space-y-4 pb-20">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">Forecasting</h2>
          <p className="text-sm text-gray-600 mt-1">AI-powered sales predictions</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-[#0F172A] hover:bg-[#1E293B] text-white">
              <Plus className="w-4 h-4 mr-1" />
              New
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-[calc(100vw-2rem)] max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Sales Forecast</DialogTitle>
              <DialogDescription>
                Use AI to predict ingredient usage based on connected POS sales data.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddForecast} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="date">Date</Label>
                  <Input 
                    id="date" 
                    name="date" 
                    type="date" 
                    required 
                    onChange={(e) => setSelectedDate(e.target.value)} 
                  />
                </div>
                <div>
                  <Label htmlFor="expectedRevenue">Expected Revenue ($)</Label>
                  <Input 
                    id="expectedRevenue" 
                    name="expectedRevenue" 
                    type="number" 
                    step="0.01"
                    required 
                    placeholder={avgRevenue > 0 ? `Avg: $${avgRevenue}` : "$3000"}
                    value={expectedRevenue || ''}
                    onChange={(e) => setExpectedRevenue(Number(e.target.value))} 
                  />
                </div>
              </div>

              {isConnected && (
                <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
                  <CardContent className="pt-4">
                    <Button
                      type="button"
                      onClick={handleAutoPredict}
                      className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                      disabled={!expectedRevenue || !selectedDate}
                    >
                      <Sparkles className="w-4 h-4 mr-2" />
                      Auto-Predict from POS Sales
                    </Button>
                    {avgRevenue > 0 && (
                      <p className="text-xs text-purple-700 mt-2 text-center">
                        Based on {salesData.length} days • Avg revenue: ${avgRevenue.toFixed(2)}
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}

              {predictedMenuItems.length > 0 && (
                <Card className="border-green-200 bg-green-50">
                  <CardHeader>
                    <CardTitle className="text-sm">Predicted Menu Items</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-2">
                      {predictedMenuItems.map((item, idx) => (
                        <div key={idx} className="bg-white rounded p-2 text-xs">
                          <p className="font-medium text-gray-900">{item.name}</p>
                          <p className="text-gray-600">{item.quantity} sales</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Ingredient Usage Predictions</Label>
                  {selectedItems.length > 0 && (
                    <Badge className="bg-[#F5C10E] text-white">
                      {selectedItems.length} items
                    </Badge>
                  )}
                </div>
                <div className="space-y-2">
                  <select
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    onChange={(e) => handleAddItemToForecast(e.target.value)}
                    value=""
                  >
                    <option value="">Add item manually...</option>
                    {inventory.map(item => (
                      <option key={item.id} value={item.id}>
                        {item.name} ({item.currentStock} {item.unit})
                      </option>
                    ))}
                  </select>

                  {selectedItems.length > 0 && (
                    <div className="border border-gray-200 rounded-md divide-y max-h-64 overflow-y-auto">
                      {selectedItems.map(({ itemId, expectedUsage }) => {
                        const item = inventory.find(i => i.id === itemId);
                        if (!item) return null;
                        
                        return (
                          <div key={itemId} className="p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <p className="font-medium text-sm">{item.name}</p>
                                <p className="text-xs text-gray-500">
                                  Current: {item.currentStock} {item.unit}
                                </p>
                              </div>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => handleRemoveItem(itemId)}
                              >
                                Remove
                              </Button>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="Usage"
                                value={expectedUsage || ''}
                                onChange={(e) => handleUpdateItemUsage(itemId, Number(e.target.value))}
                                className="flex-1"
                              />
                              <span className="text-sm text-gray-500">{item.unit}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => {
                  setIsAddDialogOpen(false);
                  setSelectedItems([]);
                  setPredictedMenuItems([]);
                  setExpectedRevenue(0);
                  setSelectedDate('');
                }}>
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={selectedItems.length === 0} 
                  className="bg-[#0F172A] hover:bg-[#1E293B] text-white disabled:bg-gray-400 disabled:hover:bg-gray-400"
                >
                  Create Forecast
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {salesProjection.length > 0 && (
        <Card className="overflow-hidden border-[#F5C10E]/40 bg-[#0F172A] text-white">
          <CardContent className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-[#F5C10E]">Sales projection</p>
                <h3 className="mt-1 text-2xl font-black">Plan the next seven days.</h3>
                <p className="mt-1 text-sm text-white/60">Built from {salesData.length} days of POS sales, day-of-week patterns and recent trend.</p>
              </div>
              {isDemoAccount && (
                <Button onClick={buildDemoForecast} className="bg-[#F5C10E] font-bold text-[#0F172A] hover:bg-[#ffd34a]">
                  <Sparkles className="mr-2 h-4 w-4" /> Build tomorrow's forecast
                </Button>
              )}
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
              {salesProjection.map((day, index) => (
                <div key={day.date} className={`rounded-xl p-3 ${index === 0 ? 'bg-[#F5C10E] text-[#0F172A]' : 'bg-white/10'}`}>
                  <p className="text-[11px] font-bold opacity-70">{day.label}</p>
                  <p className="mt-2 text-lg font-black">${day.revenue.toLocaleString('en-CA')}</p>
                  <p className="mt-1 text-[11px] font-medium opacity-70">{day.covers} covers</p>
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-4 text-xs text-white/70">
              <span>Projected food spend: <strong className="text-white">28%</strong></span>
              <span>Projected labour: <strong className="text-white">29%</strong></span>
              <span>Tomorrow: <strong className="text-white">${salesProjection[0]?.revenue.toLocaleString('en-CA')}</strong></span>
            </div>
          </CardContent>
        </Card>
      )}

      {isConnected && salesData.length > 0 && (
        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center">
                <ShoppingBag className="w-5 h-5 mr-2 text-orange-600" />
                POS Sales Insights
              </CardTitle>
              <Badge className="bg-orange-500 text-white">Live</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-orange-700">Avg Daily Revenue</p>
                <p className="text-xl font-bold text-orange-900">${avgRevenue.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs text-orange-700">Days Tracked</p>
                <p className="text-xl font-bold text-orange-900">{salesData.length}</p>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-orange-200">
              <p className="text-xs text-orange-700 mb-2">Top Selling Items</p>
              <div className="space-y-1">
                {salesData[0]?.topItems.slice(0, 3).map((item, idx) => (
                  <div key={idx} className="flex justify-between text-xs">
                    <span className="text-orange-900">{item.itemName}</span>
                    <span className="font-medium text-orange-700">{item.quantity} sold</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {forecasts.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <TrendingUp className="w-12 h-12 text-gray-400 mb-4" />
              <p className="text-gray-500 text-center text-sm">
                No forecasts yet. Create your first forecast to start generating orders.
              </p>
            </CardContent>
          </Card>
        ) : (
          forecasts.map(forecast => {
            const totalExpectedUsage = forecast.items.reduce((sum, item) => {
              const inventoryItem = inventory.find(i => i.id === item.itemId);
              return sum + (inventoryItem ? item.expectedUsage * inventoryItem.unitCost : 0);
            }, 0);

            return (
              <Card key={forecast.id}>
                <CardHeader>
                  <CardTitle className="flex items-center text-base">
                    <Calendar className="w-5 h-5 mr-2" />
                    {new Date(forecast.date).toLocaleDateString()}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-[#FEFCE8] rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-[#1D4ED8]">Expected Revenue</p>
                        <p className="text-2xl font-bold text-[#0F172A]">
                          ${forecast.expectedCovers.toFixed(2)}
                        </p>
                      </div>
                      <DollarSign className="w-8 h-8 text-[#2563EB]" />
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">Predicted Ingredient Usage</p>
                    <div className="space-y-2">
                      {forecast.items.map(({ itemId, expectedUsage }) => {
                        const item = inventory.find(i => i.id === itemId);
                        if (!item) return null;

                        const projectedStock = item.currentStock - expectedUsage;
                        const needsOrder = projectedStock < item.parLevel;

                        return (
                          <div key={itemId} className="text-sm bg-gray-50 rounded p-2">
                            <div className="flex justify-between">
                              <span className="font-medium">{item.name}</span>
                              <span className="text-red-600 font-medium">
                                -{expectedUsage} {item.unit}
                              </span>
                            </div>
                            <div className="flex justify-between text-xs text-gray-500 mt-1">
                              <span>Projected: {projectedStock.toFixed(1)} {item.unit}</span>
                              {needsOrder && (
                                <span className="text-orange-600 font-medium">⚠ Needs order</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="pt-3 border-t space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Expected Usage Value</span>
                      <span className="font-semibold">${totalExpectedUsage.toFixed(2)}</span>
                    </div>
                    <Button 
                      className="w-full bg-[#0F172A] hover:bg-[#1E293B] text-white" 
                      onClick={() => handleGenerateOrder(forecast.id)}
                    >
                      Generate Order
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Email Dialog */}
      <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
        <DialogContent className="w-[95vw] max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <Mail className="w-5 h-5 mr-2 text-[#2563EB]" />
              Draft Supplier Emails ({draftEmails.length})
            </DialogTitle>
            <DialogDescription>
              Copy and send these emails to your suppliers
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            {draftEmails.map((email) => (
              <Card key={email.supplier} className="overflow-hidden">
                <CardHeader className="bg-gradient-to-r from-[#FEFCE8] to-[#FEF9C3] pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">{email.supplier}</CardTitle>
                      <p className="text-sm text-gray-600 mt-1">
                        {email.items.length} item(s) • ${email.totalCost.toFixed(2)}
                      </p>
                      {email.ccEmails.length > 0 && <p className="mt-1 text-xs text-gray-500">CC: {email.ccEmails.join(', ')}</p>}
                    </div>
                    <div className="flex space-x-2">
                      <Button
                        size="sm"
                        onClick={() => copyToClipboard(email.emailBody)}
                        className="bg-[#0F172A] hover:bg-[#1E293B]"
                      >
                        <Copy className="w-4 h-4 mr-2" />
                        Copy
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => openEmailClient(email)}
                        className="bg-[#0F172A] hover:bg-[#1E293B]"
                      >
                        <Mail className="w-4 h-4 mr-2" />
                        Open Email
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                    <pre className="text-xs text-gray-800 whitespace-pre-wrap font-mono leading-relaxed">
                      {email.emailBody}
                    </pre>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {email.items.map((item, idx) => (
                      <Badge 
                        key={idx} 
                        className="bg-[#FEF9C3] text-[#1E3A5F] border border-[#F5C10E]/50 text-xs"
                      >
                        {item.name} ({item.quantity} {item.unit})
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
