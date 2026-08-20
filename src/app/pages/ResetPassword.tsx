import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';

export function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const recoveryToken = useMemo(() => {
    const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    return fragment.get('access_token') || '';
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!recoveryToken) {
      toast.error('This password link is missing or expired. Ask your company owner to send a new one.');
      return;
    }
    if (password.length < 10) {
      toast.error('Use a password with at least 10 characters.');
      return;
    }
    if (password !== confirmation) {
      toast.error('The passwords do not match.');
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch('/api/v1/auth/password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${recoveryToken}`,
        },
        body: JSON.stringify({ password }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error || 'Unable to update password');
      localStorage.removeItem('zestiq:auth:session');
      toast.success('Password updated. Sign in with your new password.');
      navigate('/login', { replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to update password');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F5C10E] p-4">
      <Card className="w-full max-w-md border-0 shadow-2xl">
        <CardHeader>
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0F172A] text-[#F5C10E]">
            <KeyRound className="h-6 w-6" />
          </div>
          <CardTitle>Choose a new password</CardTitle>
          <p className="text-sm text-slate-600">This secure link can be used to accept an invitation or reset your zestIQ password.</p>
        </CardHeader>
        <CardContent>
          {recoveryToken ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="new-password">New password</Label>
                <Input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={event => setPassword(event.target.value)}
                  minLength={10}
                  required
                />
              </div>
              <div>
                <Label htmlFor="confirm-password">Confirm password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirmation}
                  onChange={event => setConfirmation(event.target.value)}
                  minLength={10}
                  required
                />
              </div>
              <Button type="submit" disabled={isSaving} className="w-full bg-[#0F172A] text-white hover:bg-[#1E293B]">
                {isSaving ? 'Saving…' : 'Save password'}
              </Button>
            </form>
          ) : (
            <div className="space-y-4">
              <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
                This link is missing or expired. Ask your company owner to send a new password-reset email.
              </p>
              <Button type="button" variant="outline" className="w-full" onClick={() => navigate('/login')}>
                Return to sign in
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
