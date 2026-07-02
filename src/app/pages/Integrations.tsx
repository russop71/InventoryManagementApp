import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useToast } from '../contexts/ToastContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Switch } from '../components/ui/switch';
import { CheckCircle, XCircle, RefreshCw, ExternalLink, Wifi, LogOut, Mail, Phone, MapPin, Building2 } from 'lucide-react';
import { toast as showToast } from 'sonner';

interface Supplier {
  id: string;
  name: string;
  email: string;
  phone: string;
  category: string;
  contactPerson: string;
  address?: string;
}

export function Integrations() {
  const navigate = useNavigate();
  const { 
    isConnected, 
    apiKey, 
    restaurantId, 
    connectToast, 
    disconnectToast, 
    syncData, 
    lastSync,
    salesData,
    menuItems
  } = useToast();

  const [showApiKey, setShowApiKey] = useState(false);
  const [tempApiKey, setTempApiKey] = useState('');
  const [tempRestaurantId, setTempRestaurantId] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);

  // Supplier contacts
  const [suppliers] = useState<Supplier[]>([
    {
      id: '1',
      name: 'US Foods',
      email: 'orders@usfoods.com',
      phone: '(555) 123-4567',
      category: 'Proteins, Produce, Dairy',
      contactPerson: 'Mike Johnson',
      address: '123 Distribution Way, Toronto, ON'
    },
    {
      id: '2',
      name: 'Sysco',
      email: 'orders@sysco.com',
      phone: '(555) 234-5678',
      category: 'Dry Goods, Proteins',
      contactPerson: 'Sarah Williams',
      address: '456 Supplier Blvd, Toronto, ON'
    },
    {
      id: '3',
      name: 'Gordon Food Service',
      email: 'sales@gfs.com',
      phone: '(555) 345-6789',
      category: 'Produce, Beverages',
      contactPerson: 'James Chen',
      address: '789 Food Plaza, Mississauga, ON'
    },
    {
      id: '4',
      name: 'Ontario Seafood',
      email: 'fresh@ontarioseafood.ca',
      phone: '(555) 456-7890',
      category: 'Seafood',
      contactPerson: 'Maria Rodriguez',
      address: '321 Harbor St, Toronto, ON'
    },
    {
      id: '5',
      name: 'Fresh Valley Farms',
      email: 'orders@freshvalley.ca',
      phone: '(555) 567-8901',
      category: 'Produce, Dairy',
      contactPerson: 'David Kim',
      address: '555 Farm Road, Markham, ON'
    }
  ]);

  const handleConnect = () => {
    if (!tempApiKey || !tempRestaurantId) {
      showToast.error('Please enter both API Key and Restaurant ID');
      return;
    }
    connectToast(tempApiKey, tempRestaurantId);
    showToast.success('Successfully connected to Toast POS');
    setTempApiKey('');
    setTempRestaurantId('');
  };

  const handleDisconnect = () => {
    disconnectToast();
    showToast.success('Disconnected from Toast POS');
  };

  const handleLogout = () => {
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('userEmail');
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

      {/* About 86'D Card */}
      <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
        <CardHeader>
          <div className="flex items-center space-x-3">
            <div className="bg-white rounded-lg p-2 shadow-md">
              <span className="text-3xl font-black text-red-600">86</span>
            </div>
            <div>
              <CardTitle className="text-red-900">86'D Inventory Management</CardTitle>
              <CardDescription className="text-red-700">Kitchen slang for "out of stock" - we help you never run out</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-red-800">
            Built for restaurants by people who understand BOH operations. Track inventory, 
            forecast demand, automate ordering, and integrate with your POS—all from your phone.
          </p>
        </CardContent>
      </Card>

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

                <Button onClick={handleConnect} className="w-full bg-[#0F172A] hover:bg-[#1E293B] text-white">
                  Connect to Toast
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

      {/* Supplier Contacts */}
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-2">
            <Building2 className="w-5 h-5 text-[#0F172A]" />
            <CardTitle className="text-base">Supplier Contacts</CardTitle>
          </div>
          <CardDescription>
            Contact information for your suppliers
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {suppliers.map((supplier) => (
              <Card key={supplier.id} className="bg-gray-50">
                <CardContent className="pt-4">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-gray-900">{supplier.name}</h3>
                        <p className="text-xs text-gray-600 mt-1">{supplier.category}</p>
                      </div>
                      <Badge className="bg-[#FEF9C3] text-[#1E3A5F] text-xs">
                        {supplier.contactPerson}
                      </Badge>
                    </div>
                    
                    <div className="space-y-2">
                      <a 
                        href={`mailto:${supplier.email}`}
                        className="flex items-center space-x-2 text-sm text-gray-700 hover:text-[#0F172A]"
                      >
                        <Mail className="w-4 h-4 text-gray-400" />
                        <span>{supplier.email}</span>
                      </a>
                      
                      <a 
                        href={`tel:${supplier.phone}`}
                        className="flex items-center space-x-2 text-sm text-gray-700 hover:text-[#0F172A]"
                      >
                        <Phone className="w-4 h-4 text-gray-400" />
                        <span>{supplier.phone}</span>
                      </a>
                      
                      {supplier.address && (
                        <div className="flex items-start space-x-2 text-sm text-gray-700">
                          <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                          <span>{supplier.address}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
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