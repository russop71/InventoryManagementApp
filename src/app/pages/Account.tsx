import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { User, Mail, Building, Phone, MapPin, KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { clearLocationScopedData } from '../utils/storageScope';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/dialog';

export function Account() {
  const { user, accountId, accountName, locations, addLocation, logout, changePassword, deleteCurrentAccount, updateLocalAccountProfile } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [newLocationName, setNewLocationName] = useState('');
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [isPasswordSaving, setIsPasswordSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || 'Team Member',
    email: user?.email || '',
    phone: '(555) 123-4567',
    restaurant: accountName || 'Restaurant Group',
    address: '123 Main Street, New York, NY 10001'
  });

  const profileStorageKey = accountId ? `zestiq:account:${accountId}:profile` : null;

  useEffect(() => {
    if (!profileStorageKey) return;
    const raw = localStorage.getItem(profileStorageKey);
    if (!raw) return;
    try {
      const saved = JSON.parse(raw) as Partial<typeof formData>;
      setFormData(prev => ({ ...prev, ...saved }));
    } catch {
      // Ignore malformed profile payloads.
    }
  }, [profileStorageKey]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (profileStorageKey) {
      localStorage.setItem(profileStorageKey, JSON.stringify(formData));
    }
    updateLocalAccountProfile({
      name: formData.name,
      accountName: formData.restaurant,
    });
    setIsEditing(false);
    toast.success('Account updated successfully');
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleAddLocation = async () => {
    if (!newLocationName.trim()) {
      toast.error('Enter a location name first');
      return;
    }
    try {
      await addLocation(newLocationName);
      setNewLocationName('');
      toast.success('Location added');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to add location');
    }
  };

  const handlePasswordChange = async (event: React.FormEvent) => {
    event.preventDefault();
    if (newPassword.length < 10) {
      toast.error('Use a password with at least 10 characters.');
      return;
    }
    if (newPassword !== passwordConfirmation) {
      toast.error('The passwords do not match.');
      return;
    }
    setIsPasswordSaving(true);
    try {
      await changePassword(newPassword);
      setNewPassword('');
      setPasswordConfirmation('');
      setIsPasswordDialogOpen(false);
      toast.success('Password changed securely');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to change password');
    } finally {
      setIsPasswordSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">Account Settings</h2>
        <p className="text-sm text-gray-600 mt-1">Manage your profile and restaurant information</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Profile Information</CardTitle>
            {!isEditing && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsEditing(true)}
              >
                Edit
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex items-center justify-center mb-6">
              <div className="w-24 h-24 bg-[#FEF9C3] rounded-full flex items-center justify-center">
                <span className="text-[#0F172A] font-bold text-3xl">
                  {formData.name.split(' ').map(n => n[0]).join('')}
                </span>
              </div>
            </div>

            <div>
              <Label htmlFor="name">Full Name</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  disabled={!isEditing}
                  className="pl-10"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  disabled
                  className="pl-10"
                />
                <p className="mt-1 text-xs text-slate-500">Email changes require a verified account update.</p>
              </div>
            </div>

            <div>
              <Label htmlFor="phone">Phone Number</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  disabled={!isEditing}
                  className="pl-10"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="restaurant">Restaurant Name</Label>
              <div className="relative">
                <Building className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="restaurant"
                  name="restaurant"
                  value={formData.restaurant}
                  onChange={handleChange}
                  disabled={!isEditing}
                  className="pl-10"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="address">Address</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="address"
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  disabled={!isEditing}
                  className="pl-10"
                />
              </div>
            </div>

            {isEditing && (
              <div className="flex space-x-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditing(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-[#0F172A] hover:bg-[#1E293B] text-white"
                >
                  Save Changes
                </Button>
              </div>
            )}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Security</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => setIsPasswordDialogOpen(true)}
          >
            <KeyRound className="mr-2 h-4 w-4" /> Change Password
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => toast.info('2FA feature coming soon')}
          >
            Enable Two-Factor Authentication
          </Button>
        </CardContent>
      </Card>

      <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change your password</DialogTitle>
            <DialogDescription>Choose a unique password with at least 10 characters.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div>
              <Label htmlFor="account-new-password">New password</Label>
              <Input
                id="account-new-password"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={event => setNewPassword(event.target.value)}
                minLength={10}
                required
              />
            </div>
            <div>
              <Label htmlFor="account-confirm-password">Confirm password</Label>
              <Input
                id="account-confirm-password"
                type="password"
                autoComplete="new-password"
                value={passwordConfirmation}
                onChange={event => setPasswordConfirmation(event.target.value)}
                minLength={10}
                required
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsPasswordDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isPasswordSaving} className="bg-[#0F172A] text-white hover:bg-[#1E293B]">
                {isPasswordSaving ? 'Saving…' : 'Save password'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle>Locations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            {locations.map(location => (
              <div key={location.id} className="rounded-lg border border-gray-100 px-3 py-2">
                <p className="text-sm font-medium text-gray-800">{location.name}</p>
                <p className="text-xs text-gray-400">ID: {location.id}</p>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              value={newLocationName}
              onChange={(event) => setNewLocationName(event.target.value)}
              placeholder="Add location (example: Downtown)"
            />
            <Button onClick={() => void handleAddLocation()} className="bg-[#0F172A] hover:bg-[#1E293B] text-white">
              Add
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-red-600">Danger Zone</CardTitle>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            className="w-full text-red-600 border-red-300 mb-3 hover:bg-red-50"
            onClick={() => {
              if (!accountId) return;
              if (confirm('Are you sure you want to reset all location data for this account? This clears inventory, recipes, orders, integrations, and alarms for every location in this account.')) {
                locations.forEach(location => clearLocationScopedData(accountId, location.id));
                toast.success('App data reset. Redirecting to login...');
                setTimeout(() => {
                  logout();
                }, 800);
              }
            }}
          >
            Reset App Data
          </Button>
          <Button
            variant="outline"
            className="w-full text-red-600 border-red-300 hover:bg-red-50"
            onClick={async () => {
              if (!confirm('Are you sure you want to delete your account? This cannot be undone.')) {
                return;
              }

              try {
                await deleteCurrentAccount();
                toast.success('Account deleted');
              } catch (error) {
                const message = error instanceof Error ? error.message : 'Failed to delete account';
                toast.error(message);
              }
            }}
          >
            Delete Account
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
