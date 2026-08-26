import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { Activity, CreditCard, Edit, KeyRound, Mail, Plus, Shield, Trash2, UserCheck, Users as UsersIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { useAuth } from '../contexts/AuthContext';
import { apiRequest } from '../utils/api';

interface UserUsage {
  eventCount: number;
  lastActive: string | null;
  topArea: string | null;
}

interface CompanyUser {
  id: string;
  name: string;
  email: string;
  role: 'Owner' | 'Admin' | 'Manager' | 'BOH Manager' | 'FOH Manager' | 'Staff';
  status: 'Active' | 'Inactive';
  lastLogin: string;
  usage?: UserUsage;
}

function formatDate(value: string | null | undefined) {
  if (!value || value === 'Never') return 'Never';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
}

function roleBadgeClass(role: CompanyUser['role']) {
  if (role === 'Owner') return 'bg-[#0F172A] text-white';
  if (role === 'Admin') return 'bg-red-100 text-red-800';
  if (role === 'Manager' || role === 'BOH Manager' || role === 'FOH Manager') return 'bg-[#FEF9C3] text-[#1E3A5F]';
  return 'bg-slate-100 text-slate-700';
}

export function Users() {
  const navigate = useNavigate();
  const { user: currentUser, accountId, accountName } = useAuth();
  const isOwner = currentUser?.role === 'Owner';
  const [users, setUsers] = useState<CompanyUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);

  const loadUsers = useCallback(async (quiet = false) => {
    if (!accountId || !isOwner) {
      setUsers([]);
      return;
    }
    if (!quiet) setIsLoading(true);
    try {
      const payload = await apiRequest<{ users: CompanyUser[] }>(`/api/v1/accounts/${encodeURIComponent(accountId)}/users`);
      setUsers(payload.users || []);
    } catch (error) {
      if (!quiet) toast.error(error instanceof Error ? error.message : 'Unable to load company users');
    } finally {
      if (!quiet) setIsLoading(false);
    }
  }, [accountId, isOwner]);

  useEffect(() => {
    void loadUsers();
    if (!accountId || !isOwner) return;
    const intervalId = window.setInterval(() => void loadUsers(true), 30_000);
    return () => window.clearInterval(intervalId);
  }, [accountId, isOwner, loadUsers]);

  const selectedUser = users.find(user => user.id === editingUserId);
  const activeUserCount = users.filter(user => user.status === 'Active').length;
  const activeThisMonth = users.filter(user => user.usage?.lastActive).length;
  const totalActivity = users.reduce((total, user) => total + (user.usage?.eventCount || 0), 0);
  const topArea = useMemo(() => {
    const counts = new Map<string, number>();
    users.forEach(user => {
      if (user.usage?.topArea) counts.set(user.usage.topArea, (counts.get(user.usage.topArea) || 0) + (user.usage.eventCount || 0));
    });
    return [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] || 'No activity';
  }, [users]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!accountId || !isOwner) return;
    const formData = new FormData(event.currentTarget);
    const payload = {
      name: String(formData.get('name') || '').trim(),
      email: String(formData.get('email') || '').trim(),
      role: String(formData.get('role') || 'Staff') as CompanyUser['role'],
      status: String(formData.get('status') || 'Active') as CompanyUser['status'],
    };

    setIsLoading(true);
    try {
      const path = editingUserId
        ? `/api/v1/accounts/${encodeURIComponent(accountId)}/users/${encodeURIComponent(editingUserId)}`
        : `/api/v1/accounts/${encodeURIComponent(accountId)}/users`;
      await apiRequest(path, {
        method: editingUserId ? 'PUT' : 'POST',
        body: JSON.stringify(payload),
      });
      toast.success(editingUserId ? 'User access updated' : 'User added and secure setup email sent');
      setIsDialogOpen(false);
      setEditingUserId(null);
      await loadUsers(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to save user');
    } finally {
      setIsLoading(false);
    }
  };

  const sendPasswordReset = async (user: CompanyUser) => {
    if (!accountId || !isOwner) return;
    setIsLoading(true);
    try {
      await apiRequest(`/api/v1/accounts/${encodeURIComponent(accountId)}/users/${encodeURIComponent(user.id)}/password-reset`, {
        method: 'POST',
      });
      toast.success(`Secure password-reset link sent to ${user.email}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to send password reset');
    } finally {
      setIsLoading(false);
    }
  };

  const deleteUser = async (user: CompanyUser) => {
    if (!accountId || !isOwner || !confirm(`Remove ${user.name} from ${accountName}? This revokes their company access.`)) return;
    setIsLoading(true);
    try {
      await apiRequest(`/api/v1/accounts/${encodeURIComponent(accountId)}/users/${encodeURIComponent(user.id)}`, {
        method: 'DELETE',
      });
      toast.success('User access removed');
      await loadUsers(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to remove user');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOwner) {
    return (
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="py-8">
          <Shield className="mb-3 h-8 w-8 text-amber-700" />
          <h2 className="text-xl font-bold text-slate-950">Company owner access required</h2>
          <p className="mt-2 text-sm text-slate-600">Only a company Owner can view team members, usage, password resets, roles, and billing.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Owner control center</p>
          <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-950">Users & app usage</h2>
          <p className="mt-1 text-sm text-slate-600">{accountName} · isolated company workspace</p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => navigate('/app/payment-method')}>
            <CreditCard className="mr-2 h-4 w-4" /> Billing
          </Button>
          <Dialog
            open={isDialogOpen}
            onOpenChange={open => {
              setIsDialogOpen(open);
              if (!open) setEditingUserId(null);
            }}
          >
            <DialogTrigger asChild>
              <Button
                type="button"
                disabled={isLoading}
                className="bg-[#0F172A] text-white hover:bg-[#1E293B]"
                onClick={() => setEditingUserId(null)}
              >
                <Plus className="mr-2 h-4 w-4" /> Add user
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
              <DialogHeader>
                <DialogTitle>{editingUserId ? 'Edit company access' : 'Add a company user'}</DialogTitle>
                <DialogDescription>
                  {editingUserId ? 'Update this person’s role or access status.' : 'Add their details and role. They will receive a secure email to create their password.'}
                </DialogDescription>
              </DialogHeader>
              <form key={editingUserId || 'new'} onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="team-name">Full name</Label>
                  <Input id="team-name" name="name" required defaultValue={selectedUser?.name || ''} />
                </div>
                <div>
                  <Label htmlFor="team-email">Email</Label>
                  <Input id="team-email" name="email" type="email" required defaultValue={selectedUser?.email || ''} />
                </div>
                <div>
                  <Label htmlFor="team-role">Role</Label>
                  <select id="team-role" name="role" defaultValue={selectedUser?.role || 'Staff'} className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm">
                    <option value="Staff">Staff</option>
                    <option value="Manager">Manager</option>
                    <option value="BOH Manager">BOH management</option>
                    <option value="FOH Manager">FOH management</option>
                    <option value="Admin">Admin</option>
                    <option value="Owner">Owner</option>
                  </select>
                </div>
                {editingUserId && (
                  <div>
                    <Label htmlFor="team-status">Access status</Label>
                    <select id="team-status" name="status" defaultValue={selectedUser?.status || 'Active'} className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm">
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                )}
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={isLoading} className="bg-[#0F172A] text-white hover:bg-[#1E293B]">
                    {editingUserId ? 'Save access' : 'Add user'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Company users', value: users.length, icon: UsersIcon },
          { label: 'Active access', value: activeUserCount, icon: UserCheck },
          { label: 'Active in 30 days', value: activeThisMonth, icon: Activity },
          { label: '30-day app actions', value: totalActivity, icon: Activity },
        ].map(metric => (
          <Card key={metric.label}>
            <CardContent className="flex items-center gap-3 py-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FEF9C3] text-[#0F172A]">
                <metric.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-950">{metric.value}</p>
                <p className="text-xs text-slate-500">{metric.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="py-4">
          <p className="text-sm font-semibold text-blue-950">Protected company access</p>
          <p className="mt-1 text-sm text-blue-800">
            Users can only access {accountName} data. Owners can manage access and send reset links, but cannot view passwords or silently impersonate another user. Most-used area this month: <span className="font-semibold capitalize">{topArea}</span>.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Company team</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading && users.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">Loading protected user records…</p>
          ) : users.length === 0 ? (
            <div className="py-10 text-center">
              <UsersIcon className="mx-auto mb-3 h-10 w-10 text-slate-300" />
              <p className="text-sm text-slate-500">No company users have been added yet.</p>
            </div>
          ) : users.map(user => (
            <div key={user.id} className="rounded-2xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#FEF9C3] font-bold text-[#0F172A]">
                    {user.name.split(' ').filter(Boolean).map(part => part[0]).join('').slice(0, 2)}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-950">{user.name}</p>
                    <p className="flex items-center gap-1 truncate text-sm text-slate-500"><Mail className="h-3.5 w-3.5" /> {user.email}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge className={roleBadgeClass(user.role)}><Shield className="mr-1 h-3 w-3" />{user.role}</Badge>
                  <Badge className={user.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'}>{user.status}</Badge>
                </div>
              </div>

              <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 text-sm sm:grid-cols-4">
                <div>
                  <p className="text-xs text-slate-400">Last login</p>
                  <p className="mt-1 font-medium text-slate-700">{formatDate(user.lastLogin)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Last app activity</p>
                  <p className="mt-1 font-medium text-slate-700">{formatDate(user.usage?.lastActive)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">30-day actions</p>
                  <p className="mt-1 font-medium text-slate-700">{user.usage?.eventCount || 0}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Most-used area</p>
                  <p className="mt-1 font-medium capitalize text-slate-700">{user.usage?.topArea || 'No activity'}</p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap justify-end gap-2">
                <Button type="button" size="sm" variant="outline" disabled={isLoading} onClick={() => void sendPasswordReset(user)}>
                  <KeyRound className="mr-1.5 h-4 w-4" /> Send reset
                </Button>
                <Button type="button" size="sm" variant="outline" disabled={isLoading} onClick={() => {
                  setEditingUserId(user.id);
                  setIsDialogOpen(true);
                }}>
                  <Edit className="mr-1.5 h-4 w-4" /> Edit
                </Button>
                <Button type="button" size="sm" variant="outline" disabled={isLoading} onClick={() => void deleteUser(user)}>
                  <Trash2 className="h-4 w-4 text-red-600" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
