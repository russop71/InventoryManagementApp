import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useToast } from '../contexts/ToastContext';
import { useInventory } from '../contexts/InventoryContext';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { Switch } from '../components/ui/switch';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '../components/ui/dropdown-menu';
import { CheckCircle, XCircle, RefreshCw, ExternalLink, Wifi, LogOut, Mail, Phone, MapPin, ChevronDown } from 'lucide-react';
import { toast as showToast } from 'sonner';

export function Integrations() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { 
    isConnected, 
    apiKey, 
    restaurantId, 
    connectToast, 
    disconnectToast, 
    syncData,
    importSalesData,
    lastSync,
    salesData,
    menuItems
  } = useToast();

  const [showApiKey, setShowApiKey] = useState(false);
  const [tempApiKey, setTempApiKey] = useState('');
  const [tempRestaurantId, setTempRestaurantId] = useState('');
  const [importPayload, setImportPayload] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const { suppliers } = useInventory();

  const handleConnect = () => {
    const normalizedApiKey = tempApiKey.trim() || 'demo-toast-api-key';
    const normalizedRestaurantId = tempRestaurantId.trim() || 'demo-restaurant';

    connectToast(normalizedApiKey, normalizedRestaurantId);
    showToast.success(
      normalizedApiKey === 'demo-toast-api-key' && normalizedRestaurantId === 'demo-restaurant'
        ? 'Connected to demo POS data. Forecasting is ready to use.'
        : 'Successfully connected to Toast POS'
    );
    setTempApiKey('');
    setTempRestaurantId('');
  };

  const handleDisconnect = () => {
    disconnectToast();
    showToast.success('Disconnected from Toast POS');
  };

  const handleLogout = () => {
    logout();
    showToast.success('Logged out successfully');
    navigate('/login');
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await syncData();
      showToast.success('Data synced successfully');
    } catch (error) {
      showToast.error('Failed to sync data');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleImport = async () => {
    if (!importPayload.trim()) {
      showToast.error('Paste a POS export payload first');
      return;
    }

    setIsImporting(true);
    try {
      const parsed = JSON.parse(importPayload);
      await importSalesData(parsed);
      setImportPayload('');
      showToast.success('POS import completed');
    } catch (error) {
      console.error(error);
      showToast.error('That payload could not be imported');
    } finally {
      setIsImporting(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      hour: 'numeric', 
      minute: '2-digit' 
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">Settings & Integrations</h2>
        <p className="text-sm text-gray-600 mt-1">Connect Toast POS to sync sales data</p>
      </div>

      {/* Toast POS Integration Card */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-orange-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-xl">T</span>
              </div>
              <div>
                <CardTitle className="text-base">Toast POS</CardTitle>
                <CardDescription className="text-sm">
                  Sync sales, menu & customer data
                </CardDescription>
              </div>
            </div>
            <Badge className={isConnected ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
              {isConnected ? (
                <>
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Connected
                </>
              ) : (
                <>
                  <XCircle className="w-3 h-3 mr-1" />
                  Not Connected
                </>
              )}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isConnected ? (
            <div className="space-y-4">
              <div className="bg-[#FEFCE8] border border-[#F5C10E]/30 rounded-lg p-3">
                <p className="text-sm text-[#0F172A]">
                  Connect your Toast POS to automatically sync sales data, track popular items, and improve inventory forecasting.
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <Label htmlFor="apiKey">Toast API Key</Label>
                  <Input
                    id="apiKey"
                    type={showApiKey ? 'text' : 'password'}
                    placeholder="Enter your Toast API key"
                    value={tempApiKey}
                    onChange={(e) => setTempApiKey(e.target.value)}
                  />
                  <button
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="text-xs text-[#2563EB] mt-1"
                  >
                    {showApiKey ? 'Hide' : 'Show'} API Key
                  </button>
                </div>

                <div>
                  <Label htmlFor="restaurantId">Restaurant ID</Label>
                  <Input
                    id="restaurantId"
                    placeholder="Enter your Toast Restaurant ID"
                    value={tempRestaurantId}
                    onChange={(e) => setTempRestaurantId(e.target.value)}
                  />
                </div>

                <p className="text-xs text-gray-500">
                  Leave the fields blank to connect with demo POS data and start forecasting immediately.
                </p>

                <Button onClick={handleConnect} className="w-full bg-[#0F172A] hover:bg-[#1E293B] text-white">
                  Connect POS
                </Button>

                <a
                  href="https://doc.toasttab.com/doc/platformguide/getting-started/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center text-sm text-[#2563EB] hover:underline"
                >
                  <ExternalLink className="w-4 h-4 mr-1" />
                  How to get your API credentials
                </a>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-green-900">Status</span>
                  <div className="flex items-center text-green-700">
                    <Wifi className="w-4 h-4 mr-1" />
                    <span className="text-sm">Active</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-green-900">Restaurant ID</span>
                  <span className="text-sm text-green-700 font-mono">{restaurantId}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-green-900">Last Sync</span>
                  <span className="text-sm text-green-700">{formatDate(lastSync)}</span>
                </div>
              </div>

              {/* Sync Stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">Sales Records</p>
                  <p className="text-xl font-semibold text-gray-900">{salesData.length}</p>
                  <p className="text-xs text-gray-500 mt-1">Last 7 days</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">Menu Items</p>
                  <p className="text-xl font-semibold text-gray-900">{menuItems.length}</p>
                  <p className="text-xs text-gray-500 mt-1">Synced items</p>
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-2">
                <div className="rounded-lg border border-dashed border-slate-300 p-3 space-y-2">
                  <Label htmlFor="posImport">Import Marketman profitability rows</Label>
                  <Textarea
                    id="posImport"
                    value={importPayload}
                    onChange={(e) => setImportPayload(e.target.value)}
                    placeholder='{"marketmanReport":[{"Menu item name":"Chicken Sandwich","Qty sold":3,"Total sales":45}],"menuItems":[...]}'
                    className="min-h-[90px] font-mono text-xs"
                  />
                  <Button onClick={handleImport} variant="outline" className="w-full" disabled={isImporting}>
                    {isImporting ? 'Importing...' : 'Import sales data'}
                  </Button>
                  <p className="text-[11px] text-gray-500">
                    Paste a JSON payload with Marketman profitability rows (only Qty sold {'>'} 0 will be imported) plus optional menuItems to power forecasting.
                  </p>
                </div>
                <Button 
                  onClick={handleSync} 
                  variant="outline" 
                  className="w-full"
                  disabled={isSyncing}
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
                  {isSyncing ? 'Syncing...' : 'Sync Now'}
                </Button>
                
                <Button 
                  onClick={handleDisconnect} 
                  variant="outline" 
                  className="w-full text-red-600 hover:text-red-700"
                >
                  Disconnect
                </Button>
                
                <Button 
                  onClick={handleLogout} 
                  variant="outline" 
                  className="w-full text-red-600 hover:text-red-700"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Logout
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Features when connected */}
      {isConnected && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Connected Features</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">Auto-sync sales data</p>
                  <p className="text-xs text-gray-500">Sync every hour</p>
                </div>
                <Switch checked disabled />
              </div>
              <div className="flex items-center justify-between py-2">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">Menu item mapping</p>
                  <p className="text-xs text-gray-500">Link menu items to inventory</p>
                </div>
                <Switch checked disabled />
              </div>
              <div className="flex items-center justify-between py-2">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">Smart forecasting</p>
                  <p className="text-xs text-gray-500">AI-powered predictions</p>
                </div>
                <Switch checked disabled />
              </div>
              <div className="flex items-center justify-between py-2">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">Low stock alerts</p>
                  <p className="text-xs text-gray-500">Based on sales velocity</p>
                </div>
                <Switch checked disabled />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Toast Data Preview */}
      {isConnected && salesData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Sales Data</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {salesData.slice(0, 3).map((day) => (
                <div key={day.date} className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-900">
                      {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                    <span className="text-sm font-semibold text-green-600">
                      ${day.revenue.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>{day.covers} covers</span>
                    <span>{day.topItems.length} top items</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Supplier dropdown */}
      <Card>
        <CardHeader className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">Supplier Contacts</CardTitle>
            <CardDescription>Quick access to supplier emails and phone numbers</CardDescription>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="inline-flex items-center gap-2">
                <span>View Suppliers</span>
                <ChevronDown className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-80">
              <DropdownMenuLabel>Supplier Contacts</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {suppliers.map((supplier, index) => (
                <div key={supplier.id} className="space-y-2 py-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-gray-900">{supplier.name}</span>
                    <span className="text-[11px] text-gray-500">{supplier.category}</span>
                  </div>
                  <div className="text-xs text-gray-500">{supplier.contactPerson}</div>
                  <div className="flex flex-col gap-1 text-xs text-gray-600">
                    <a href={`mailto:${supplier.email}`} className="inline-flex items-center gap-1 hover:text-[#0F172A]">
                      <Mail className="w-3.5 h-3.5" />
                      {supplier.email}
                    </a>
                    <a href={`tel:${supplier.phone}`} className="inline-flex items-center gap-1 hover:text-[#0F172A]">
                      <Phone className="w-3.5 h-3.5" />
                      {supplier.phone}
                    </a>
                    {supplier.address && (
                      <div className="inline-flex items-start gap-1 text-gray-500">
                        <MapPin className="w-3.5 h-3.5 mt-0.5" />
                        {supplier.address}
                      </div>
                    )}
                  </div>
                  {index < suppliers.length - 1 && <DropdownMenuSeparator />}
                </div>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </CardHeader>
      </Card>

      {/* Account Section - Always show logout */}
      {!isConnected && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Account</CardTitle>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={handleLogout} 
              variant="outline" 
              className="w-full text-red-600 hover:text-red-700"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}