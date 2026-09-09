import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Label } from '../components/ui/label';
import { Bell, Mail, MessageSquare, AlertTriangle, TrendingUp, Package } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { locationScopedStorageKey } from '../utils/storageScope';

interface NotificationSetting {
  id: string;
  label: string;
  description: string;
  icon: any;
  email: boolean;
  push: boolean;
  sms: boolean;
}

const DEFAULT_NOTIFICATION_SETTINGS: NotificationSetting[] = [
  { id: 'stockouts', label: 'Stockout Alerts', description: 'Get notified when items are 86\'d', icon: AlertTriangle, email: true, push: true, sms: false },
  { id: 'low-inventory', label: 'Low Inventory', description: 'Alert when items fall below par levels', icon: Package, email: true, push: true, sms: true },
  { id: 'ai-orders', label: 'AI Order Updates', description: 'Notifications about automated orders', icon: TrendingUp, email: true, push: false, sms: false },
  { id: 'forecast', label: 'Forecast Alerts', description: 'Daily forecast summaries', icon: TrendingUp, email: true, push: false, sms: false },
  { id: 'integrations', label: 'Integration Updates', description: 'POS sync notifications', icon: Bell, email: false, push: true, sms: false },
];

export function Notifications() {
  const { accountId, activeLocationId } = useAuth();
  const [settings, setSettings] = useState<NotificationSetting[]>(DEFAULT_NOTIFICATION_SETTINGS);
  const storageKey = accountId && activeLocationId ? locationScopedStorageKey(accountId, activeLocationId, 'notificationPreferences') : null;

  useEffect(() => {
    if (!storageKey) return;
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
      if (Array.isArray(saved)) setSettings(DEFAULT_NOTIFICATION_SETTINGS.map(setting => ({ ...setting, ...(saved.find(item => item?.id === setting.id) || {}) })));
    } catch { setSettings(DEFAULT_NOTIFICATION_SETTINGS); }
  }, [storageKey]);

  const updateSettings = (updater: (current: NotificationSetting[]) => NotificationSetting[]) => {
    setSettings(current => {
      const next = updater(current);
      if (storageKey) localStorage.setItem(storageKey, JSON.stringify(next.map(({ icon: _icon, ...setting }) => setting)));
      return next;
    });
  };

  const handleToggle = (id: string, type: 'email' | 'push' | 'sms') => {
    updateSettings(current => current.map(setting => {
      if (setting.id === id) {
        return { ...setting, [type]: !setting[type] };
      }
      return setting;
    }));
    toast.success('Notification preferences updated');
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">Notification Settings</h2>
        <p className="text-sm text-gray-600 mt-1">Manage how you receive alerts and updates</p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="cursor-pointer hover:bg-gray-50" onClick={() => {
          updateSettings(current => current.map(s => ({ ...s, email: true, push: true })));
          toast.success('All notifications enabled');
        }}>
          <CardContent className="pt-4 text-center">
            <Bell className="w-6 h-6 mx-auto text-[#0F172A] mb-2" />
            <p className="text-sm font-medium">Enable All</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:bg-gray-50" onClick={() => {
          updateSettings(current => current.map(s => ({ ...s, email: false, push: false, sms: false })));
          toast.success('All notifications disabled');
        }}>
          <CardContent className="pt-4 text-center">
            <Bell className="w-6 h-6 mx-auto text-gray-400 mb-2" />
            <p className="text-sm font-medium">Disable All</p>
          </CardContent>
        </Card>
      </div>

      {/* Notification Settings */}
      <div className="space-y-3">
        {settings.map(setting => {
          const Icon = setting.icon;
          return (
            <Card key={setting.id}>
              <CardContent className="py-4">
                <div className="flex items-start space-x-3 mb-4">
                  <div className="w-10 h-10 bg-[#FEF9C3] rounded-lg flex items-center justify-center">
                    <Icon className="w-5 h-5 text-[#0F172A]" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">{setting.label}</h3>
                    <p className="text-sm text-gray-600">{setting.description}</p>
                  </div>
                </div>

                <div className="space-y-3 pt-3 border-t border-gray-100">
                  {/* Email Toggle */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Mail className="w-4 h-4 text-gray-500" />
                      <Label className="text-sm font-normal">Email</Label>
                    </div>
                    <button
                      onClick={() => handleToggle(setting.id, 'email')}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        setting.email ? 'bg-[#0F172A]' : 'bg-gray-200'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          setting.email ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Push Toggle */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Bell className="w-4 h-4 text-gray-500" />
                      <Label className="text-sm font-normal">Push Notifications</Label>
                    </div>
                    <button
                      onClick={() => handleToggle(setting.id, 'push')}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        setting.push ? 'bg-[#0F172A]' : 'bg-gray-200'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          setting.push ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  {/* SMS Toggle */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <MessageSquare className="w-4 h-4 text-gray-500" />
                      <Label className="text-sm font-normal">SMS</Label>
                    </div>
                    <button
                      onClick={() => handleToggle(setting.id, 'sms')}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        setting.sms ? 'bg-[#0F172A]' : 'bg-gray-200'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          setting.sms ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Quiet Hours */}
      <Card>
        <CardHeader>
          <CardTitle>Quiet Hours</CardTitle>
          <CardDescription>Pause non-critical notifications during specific hours</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Enable Quiet Hours</Label>
            <button
              type="button"
              disabled
              aria-label="Quiet hours are not available yet"
              className="relative inline-flex h-6 w-11 cursor-not-allowed items-center rounded-full bg-gray-200 opacity-70"
            >
              <span className="inline-block h-4 w-4 transform rounded-full bg-white translate-x-1" />
            </button>
          </div>
          <p className="text-sm text-gray-500">Not available yet. This control will be enabled after background notification delivery is connected.</p>
        </CardContent>
      </Card>
    </div>
  );
}
