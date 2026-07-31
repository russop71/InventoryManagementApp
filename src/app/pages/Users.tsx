import { useEffect, useState } from 'react';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Users as UsersIcon, Plus, Mail, Shield, Trash2, Edit } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { apiRequest } from '../utils/api';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'Owner' | 'Admin' | 'Manager' | 'Staff';
  status: 'Active' | 'Inactive';
  lastLogin: string;
}

export function Users() {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<string | null>(null);

  const { user: currentUser, accountId, accountName } = useAuth();
  const isOwner = currentUser?.role === 'Owner';
  const localUsersKey = accountId ? `zestiq:account:${accountId}:users` : null;

  const loadUsers = async () => {
    if (!accountId) {
      setUsers([]);
      return;
    }

    try {
      setIsLoading(true);
      const payload = await apiRequest<{ users: User[] }>(`/api/v1/accounts/${encodeURIComponent(accountId)}/users`);
      setUsers(payload.users || []);
      if (localUsersKey) {
        localStorage.setItem(localUsersKey, JSON.stringify(payload.users || []));
      }
    } catch (error) {
      const fallback = localUsersKey ? localStorage.getItem(localUsersKey) : null;
      if (fallback) {
        try {
          setUsers(JSON.parse(fallback) as User[]);
        } catch {
          setUsers([]);
        }
      } else {
        setUsers([]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadUsers();
  }, [accountId]);

  useEffect(() => {
    if (!accountId) return;
    const intervalId = window.setInterval(() => {
      void loadUsers();
    }, 10000);
    return () => window.clearInterval(intervalId);
  }, [accountId]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!accountId) return;

    const formData = new FormData(e.currentTarget);
    const payload = {
      name: String(formData.get('name') || '').trim(),
      email: String(formData.get('email') || '').trim(),
      role: formData.get('role') as User['role'],
      status: 'Active' as const,
    };

    if (!isOwner) {
      toast.error('Only owners can manage users');
      return;
    }

    try {
      setIsLoading(true);
      if (editingUser) {
        const response = await apiRequest<{ users: User[] }>(`/api/v1/accounts/${encodeURIComponent(accountId)}/users/${encodeURIComponent(editingUser)}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        if (localUsersKey) {
          localStorage.setItem(localUsersKey, JSON.stringify(response.users || []));
        }
        toast.success('User updated successfully');
      } else {
        const response = await apiRequest<{ users: User[] }>(`/api/v1/accounts/${encodeURIComponent(accountId)}/users`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        if (localUsersKey) {
          localStorage.setItem(localUsersKey, JSON.stringify(response.users || []));
        }
        toast.success('User added successfully');
      }

      await loadUsers();
      setIsDialogOpen(false);
      setEditingUser(null);
      e.currentTarget.reset();
    } catch (error) {
      const fallbackUsers = users.slice();
      if (editingUser) {
        const next = fallbackUsers.map(u => (u.id === editingUser ? { ...u, ...payload, id: editingUser } : u));
        setUsers(next);
        if (localUsersKey) localStorage.setItem(localUsersKey, JSON.stringify(next));
      } else {
        const next = [...fallbackUsers, { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, ...payload, lastLogin: 'Never' } as User];
        setUsers(next);
        if (localUsersKey) localStorage.setItem(localUsersKey, JSON.stringify(next));
      }
      toast.success(editingUser ? 'User updated locally' : 'User added locally');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditUser = (userId: string) => {
    if (!isOwner) return;
    setEditingUser(userId);
    setIsDialogOpen(true);
  };

  const handleDeleteUser = async (userId: string, name: string) => {
    if (!isOwner || !accountId) return;
    if (!confirm(`Delete user "${name}"? This cannot be undone.`)) return;

    try {
      setIsLoading(true);
      const response = await apiRequest<{ users: User[] }>(`/api/v1/accounts/${encodeURIComponent(accountId)}/users/${encodeURIComponent(userId)}`, {
        method: 'DELETE',
      });
      if (localUsersKey) {
        localStorage.setItem(localUsersKey, JSON.stringify(response.users || []));
      }
      await loadUsers();
      toast.success('User deleted');
    } catch (error) {
      const next = users.filter(u => u.id !== userId);
      setUsers(next);
      if (localUsersKey) localStorage.setItem(localUsersKey, JSON.stringify(next));
      toast.success('User deleted locally');
    } finally {
      setIsLoading(false);
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'Admin':
        return 'bg-red-100 text-red-800';
      case 'Manager':
        return 'bg-[#FEF9C3] text-[#1E3A5F]';
      case 'Staff':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">User Management</h2>
          <p className="text-sm text-gray-600 mt-1">Manage team access & roles</p>
          <p className="text-xs text-gray-500 mt-1">Account: {accountName || 'Unassigned Account'}</p>
        </div>
        <Dialog
          open={isDialogOpen}
          onOpenChange={open => {
            setIsDialogOpen(open);
            if (!open) setEditingUser(null);
          }}
        >
          <DialogTrigger asChild>
            <Button size="sm" disabled={!isOwner || isLoading} className="bg-[#0F172A] hover:bg-[#1E293B] text-white disabled:bg-slate-300 disabled:text-slate-600">
              <Plus className="w-4 h-4 mr-1" />
              Add User
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-[calc(100vw-2rem)]">
            <DialogHeader>
              <DialogTitle>{editingUser ? 'Edit User' : 'Add New User'}</DialogTitle>
              <DialogDescription>{editingUser ? 'Update user information below.' : 'Create a new user account.'}</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  name="name"
                  required
                  placeholder="John Smith"
                  defaultValue={editingUser ? users.find(u => u.id === editingUser)?.name : ''}
                />
              </div>

              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  required
                  placeholder="john@zestiq.com"
                  defaultValue={editingUser ? users.find(u => u.id === editingUser)?.email : ''}
                />
              </div>

              <div>
                <Label htmlFor="role">Role</Label>
                <select
                  id="role"
                  name="role"
                  required
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  defaultValue={editingUser ? users.find(u => u.id === editingUser)?.role : 'Staff'}
                >
                  <option value="Staff">Staff</option>
                  <option value="Manager">Manager</option>
                  <option value="Admin">Admin</option>
                  <option value="Owner">Owner</option>
                </select>
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsDialogOpen(false);
                    setEditingUser(null);
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isLoading} className="bg-[#0F172A] hover:bg-[#1E293B] text-white">
                  {editingUser ? 'Update User' : 'Add User'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">{users.length}</p>
              <p className="text-xs text-gray-500 mt-1">Total Users</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">{users.filter(u => u.status === 'Active').length}</p>
              <p className="text-xs text-gray-500 mt-1">Active</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-red-600">{users.filter(u => u.role === 'Admin').length}</p>
              <p className="text-xs text-gray-500 mt-1">Admins</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {!isOwner && (
        <Card>
          <CardContent className="bg-yellow-50 border border-yellow-100 text-yellow-700">
            <p className="text-sm font-semibold">Owner access required</p>
            <p className="text-sm text-gray-500 mt-1">Only users with the Owner role can add, edit, or delete team members.</p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {isLoading && users.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <p className="text-gray-500 text-center text-sm">Loading users...</p>
            </CardContent>
          </Card>
        ) : users.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <UsersIcon className="w-12 h-12 text-gray-400 mb-4" />
              <p className="text-gray-500 text-center text-sm">No users yet. Add your first team member.</p>
            </CardContent>
          </Card>
        ) : (
          users.map(user => (
            <Card key={user.id}>
              <CardContent className="py-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-start space-x-3">
                    <div className="w-10 h-10 bg-[#FEF9C3] rounded-full flex items-center justify-center">
                      <span className="text-[#0F172A] font-bold text-sm">{user.name.split(' ').map(n => n[0]).join('')}</span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{user.name}</h3>
                      <p className="text-sm text-gray-500 flex items-center mt-0.5">
                        <Mail className="w-3 h-3 mr-1" />
                        {user.email}
                      </p>
                    </div>
                  </div>
                  <Badge className={getRoleBadgeColor(user.role)}>
                    <Shield className="w-3 h-3 mr-1" />
                    {user.role}
                  </Badge>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                  <div className="flex items-center space-x-4">
                    <div>
                      <p className="text-xs text-gray-500">Last Login</p>
                      <p className="text-sm font-medium text-gray-700">{user.lastLogin}</p>
                    </div>
                    <Badge className={user.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>{user.status}</Badge>
                  </div>

                  <div className="flex space-x-2">
                    <Button size="sm" variant="outline" disabled={!isOwner || isLoading} onClick={() => handleEditUser(user.id)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="outline" disabled={!isOwner || isLoading} onClick={() => handleDeleteUser(user.id, user.name)}>
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
