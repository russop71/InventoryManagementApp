import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { ArrowLeftRight, Bell, CalendarDays, CheckCircle2, Clock3, LogOut, Palmtree, Save, UserRound, XCircle } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { useLabor } from '../contexts/LaborContext';
import { registerEmployeePushNotifications } from '../utils/employeeNotifications';

type EmployeeView = 'schedule' | 'notifications' | 'swaps' | 'time-off' | 'profile';

function publishedWeekKey(date: string, role: string) {
  const value = new Date(`${date}T12:00:00`);
  value.setDate(value.getDate() - ((value.getDay() + 6) % 7));
  return `${value.toISOString().slice(0, 10)}::${role}`;
}

export function EmployeeApp() {
  const navigate = useNavigate();
  const { user, accountName, accountId, activeLocationId, logout } = useAuth();
  const { employees, shifts, timeOffRequests, shiftSwapRequests, publishedPositions, employeeNotifications, refreshLabor, requestTimeOff, updateTimeOffRequest, requestShiftSwap, updateShiftSwapRequest, updateEmployee, updateMyProfile } = useLabor();
  const canPreview = ['Owner', 'Admin', 'Manager', 'BOH Manager', 'FOH Manager'].includes(user?.role || '');
  const linkedEmployee = employees.find(employee => employee.email?.toLowerCase() === user?.email.toLowerCase());
  const [previewEmployeeId, setPreviewEmployeeId] = useState(linkedEmployee?.id || employees[0]?.id || '');
  const employee = linkedEmployee || (canPreview ? employees.find(item => item.id === previewEmployeeId) : undefined);
  const [view, setView] = useState<EmployeeView>('schedule');
  const [timeOffStart, setTimeOffStart] = useState('');
  const [timeOffEnd, setTimeOffEnd] = useState('');
  const [timeOffReason, setTimeOffReason] = useState('');
  const [swapShiftId, setSwapShiftId] = useState('');
  const [swapTargetId, setSwapTargetId] = useState('');
  const [swapNote, setSwapNote] = useState('');
  const [phone, setPhone] = useState(employee?.phone || '');
  const [preferences, setPreferences] = useState(employee?.notificationPreferences || { schedulePublished: true, scheduleChanged: true, requestUpdates: true, reminders: true });
  const [savingProfile, setSavingProfile] = useState(false);
  const [nativeNotifications, setNativeNotifications] = useState<'checking' | 'ready' | 'denied' | 'web'>('checking');

  useEffect(() => {
    const manifest = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    const touchIcon = document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]');
    const previousManifest = manifest?.href;
    const previousTouchIcon = touchIcon?.href;
    document.title = 'ZestEmployee - My Schedule';
    if (manifest) manifest.href = '/zestemployee.webmanifest';
    if (touchIcon) touchIcon.href = '/zestemployee-touch-icon.png';
    return () => {
      document.title = 'zestIQ - Restaurant Inventory Management';
      if (manifest && previousManifest) manifest.href = previousManifest;
      if (touchIcon && previousTouchIcon) touchIcon.href = previousTouchIcon;
    };
  }, []);

  useEffect(() => {
    if (!employee) return;
    setPhone(employee.phone || '');
    setPreferences(employee.notificationPreferences || { schedulePublished: true, scheduleChanged: true, requestUpdates: true, reminders: true });
  }, [employee?.id]);

  useEffect(() => {
    if (!accountId || !activeLocationId) return;
    void registerEmployeePushNotifications(accountId, activeLocationId)
      .then(result => setNativeNotifications(result.native ? (result.permission === 'granted' ? 'ready' : 'denied') : 'web'))
      .catch(() => setNativeNotifications('denied'));
  }, [accountId, activeLocationId]);

  useEffect(() => {
    const refresh = () => void refreshLabor();
    const interval = window.setInterval(refresh, 30000);
    const onVisibilityChange = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [refreshLabor]);

  const ownShifts = useMemo(() => shifts.filter(shift => shift.employeeId === employee?.id && shift.status !== 'called-off' && publishedPositions.includes(publishedWeekKey(shift.date, employee?.role || ''))).sort((left, right) => `${left.date}${left.start}`.localeCompare(`${right.date}${right.start}`)), [employee?.id, employee?.role, publishedPositions, shifts]);
  const upcomingShifts = ownShifts.filter(shift => shift.date >= new Date().toISOString().slice(0, 10));
  const ownTimeOff = timeOffRequests.filter(request => request.employeeId === employee?.id);
  const ownSwaps = shiftSwapRequests.filter(request => request.requesterEmployeeId === employee?.id || request.targetEmployeeId === employee?.id);
  const ownNotifications = employeeNotifications.filter(notification => notification.employeeId === employee?.id).sort((left, right) => right.createdAt.localeCompare(left.createdAt));

  const submitTimeOff = (event: FormEvent) => {
    event.preventDefault();
    if (!employee || !timeOffStart || !timeOffEnd) return toast.error('Choose the first and last day.');
    if (timeOffEnd < timeOffStart) return toast.error('The end date must be after the start date.');
    requestTimeOff({ employeeId: employee.id, startDate: timeOffStart, endDate: timeOffEnd, reason: timeOffReason.trim() });
    setTimeOffStart(''); setTimeOffEnd(''); setTimeOffReason('');
    toast.success('Time-off request sent to your manager.');
  };

  const submitSwap = (event: FormEvent) => {
    event.preventDefault();
    if (!employee || !swapShiftId) return toast.error('Choose one of your shifts.');
    requestShiftSwap({ shiftId: swapShiftId, requesterEmployeeId: employee.id, targetEmployeeId: swapTargetId || undefined, note: swapNote.trim() });
    setSwapShiftId(''); setSwapTargetId(''); setSwapNote('');
    toast.success('Shift-swap request sent. You still own the shift until it is approved.');
  };

  const signOut = () => { logout(); navigate('/login?returnTo=/employee'); };

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault();
    setSavingProfile(true);
    try {
      if (canPreview && !linkedEmployee) updateEmployee(employee.id, { phone: phone.trim(), notificationPreferences: preferences });
      else await updateMyProfile({ phone: phone.trim(), notificationPreferences: preferences });
      toast.success('Profile and notification settings saved.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save your settings.');
    } finally {
      setSavingProfile(false);
    }
  };

  if (!employee) {
    return <div className="grid min-h-screen place-items-center bg-[#F4F5F7] p-5"><div className="max-w-md rounded-3xl bg-white p-8 text-center shadow-sm"><UserRound className="mx-auto h-12 w-12 text-[#F5D62E]" /><h1 className="mt-4 text-2xl font-black text-[#303A43]">Your employee profile needs to be linked</h1><p className="mt-3 text-sm leading-6 text-slate-600">Ask your manager to add <strong>{user?.email}</strong> to your employee profile in ZestIQ Labour & Scheduling.</p><button onClick={signOut} className="mt-6 rounded-xl bg-[#303A43] px-5 py-3 font-bold text-white">Sign out</button></div></div>;
  }

  return (
    <div className="min-h-screen bg-[#F4F5F7] pb-24 text-[#303A43]">
      <header className="bg-[#303A43] px-5 pb-7 pt-5 text-white">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-center justify-between"><Link to="/employee" className="flex items-center gap-2 text-xl font-black"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#F5D62E] text-[#303A43]">Z</span>Zest<span className="text-[#F5D62E]">Employee</span></Link><div className="flex gap-2"><button aria-label="Notifications" onClick={() => setView('notifications')} className="relative grid h-10 w-10 place-items-center rounded-xl bg-white/10"><Bell className="h-4 w-4" />{ownNotifications.length > 0 && <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-[#F5D62E] px-1 text-[9px] font-black text-[#303A43]">{ownNotifications.length}</span>}</button><button aria-label="Sign out" onClick={signOut} className="grid h-10 w-10 place-items-center rounded-xl bg-white/10"><LogOut className="h-4 w-4" /></button></div></div>
          <div className="mt-8 flex items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-white/40">{accountName}</p><h1 className="mt-2 text-3xl font-black">Hi, {employee.name.split(' ')[0]}.</h1><p className="mt-1 text-sm text-white/55">Your schedule and requests, in one place.</p></div><div className="rounded-2xl bg-[#F5D62E] px-4 py-3 text-center text-[#303A43]"><p className="text-2xl font-black">{upcomingShifts.length}</p><p className="text-[9px] font-black uppercase tracking-wider">Upcoming</p></div></div>
          {canPreview && !linkedEmployee && <label className="mt-5 block"><span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-white/40">Employee app preview</span><select value={previewEmployeeId} onChange={event => setPreviewEmployeeId(event.target.value)} className="h-11 w-full rounded-xl border border-white/10 bg-white/10 px-3 text-sm text-white">{employees.map(item => <option className="text-black" key={item.id} value={item.id}>{item.name} · {item.role}</option>)}</select></label>}
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 p-4">
        {view === 'schedule' && <section className="space-y-3"><div className="flex items-center justify-between"><h2 className="font-black">Upcoming shifts</h2><span className="text-xs text-slate-500">Published schedule</span></div>{upcomingShifts.map(shift => { const date = new Date(`${shift.date}T12:00:00`); return <article key={shift.id} className="rounded-3xl bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-4"><div className="flex gap-4"><div className="w-12 shrink-0 rounded-2xl bg-amber-50 py-2 text-center"><p className="text-[9px] font-black uppercase text-amber-700">{date.toLocaleDateString('en-CA', { weekday: 'short' })}</p><p className="text-xl font-black">{date.getDate()}</p></div><div><p className="font-black">{shift.start}–{shift.end}</p><p className="mt-1 text-sm text-slate-500">{employee.role} · {shift.breakMinutes} min break</p>{shift.tag && <span className="mt-2 inline-flex rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-[9px] font-black tracking-wide text-amber-900">{shift.tag}</span>}{shift.notes && <p className="mt-2 text-xs leading-5 text-slate-500">{shift.notes}</p>}</div></div><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black uppercase text-emerald-700">{shift.status}</span></div><button onClick={() => { setSwapShiftId(shift.id); setView('swaps'); }} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 py-2.5 text-sm font-bold"><ArrowLeftRight className="h-4 w-4" />Swap or release</button></article>; })}{upcomingShifts.length === 0 && <Empty message="No upcoming shifts have been published." />}</section>}

        {view === 'notifications' && <section className="space-y-3"><div className="flex items-center justify-between"><h2 className="font-black">Notifications</h2><span className="text-xs text-slate-500">ZestEmployee updates</span></div>{ownNotifications.map(notification => <button key={notification.id} type="button" onClick={() => setView('schedule')} className="flex w-full items-start gap-4 rounded-3xl bg-white p-5 text-left shadow-sm"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-amber-50 text-[#B58B00]"><Bell className="h-5 w-5" /></span><span className="min-w-0"><span className="block font-black text-slate-900">{notification.title}</span><span className="mt-1 block text-sm leading-5 text-slate-500">{notification.message}</span><span className="mt-2 block text-[10px] font-bold uppercase tracking-wider text-slate-400">{new Date(notification.createdAt).toLocaleString('en-CA', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span></span></button>)}{ownNotifications.length === 0 && <Empty message="No notifications yet. Published schedules will appear here." />}</section>}

        {view === 'swaps' && <section className="space-y-4"><form onSubmit={submitSwap} className="space-y-4 rounded-3xl bg-white p-5 shadow-sm"><div><h2 className="font-black">Request a shift swap</h2><p className="mt-1 text-xs leading-5 text-slate-500">You remain responsible for the shift until a manager approves the change. Only teammates in your position can receive the shift.</p></div><EmployeeSelect label="Your shift" value={swapShiftId} onChange={setSwapShiftId} options={upcomingShifts.map(shift => ({ value: shift.id, label: `${shift.date} · ${shift.start}–${shift.end}${shift.tag ? ` · ${shift.tag}` : ''}` }))} /><EmployeeSelect label="Preferred teammate (optional)" value={swapTargetId} onChange={setSwapTargetId} options={employees.filter(item => item.id !== employee.id && item.active && item.role.trim().toLowerCase() === employee.role.trim().toLowerCase()).map(item => ({ value: item.id, label: `${item.name} · ${item.role}` }))} /><label className="block"><span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-500">Note</span><textarea value={swapNote} onChange={event => setSwapNote(event.target.value)} className="min-h-20 w-full rounded-xl border border-slate-200 p-3 text-sm" placeholder="Why do you need to swap?" /></label><button className="w-full rounded-xl bg-[#F5D62E] py-3 font-black">Send request</button></form><RequestHistory title="Your swap requests">{ownSwaps.map(request => <RequestRow key={request.id} title={shifts.find(shift => shift.id === request.shiftId)?.date || 'Shift'} detail={request.note || 'Swap requested'} status={request.status} onCancel={request.status === 'pending' ? () => updateShiftSwapRequest(request.id, 'cancelled') : undefined} />)}</RequestHistory></section>}

        {view === 'time-off' && <section className="space-y-4"><form onSubmit={submitTimeOff} className="space-y-4 rounded-3xl bg-white p-5 shadow-sm"><div><h2 className="font-black">Request time off</h2><p className="mt-1 text-xs text-slate-500">Your manager will review this before it changes the schedule.</p></div><div className="grid grid-cols-2 gap-3"><DateInput label="First day" value={timeOffStart} onChange={setTimeOffStart} /><DateInput label="Last day" value={timeOffEnd} onChange={setTimeOffEnd} /></div><label className="block"><span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-500">Reason (optional)</span><textarea value={timeOffReason} onChange={event => setTimeOffReason(event.target.value)} className="min-h-20 w-full rounded-xl border border-slate-200 p-3 text-sm" /></label><button className="w-full rounded-xl bg-[#F5D62E] py-3 font-black">Request time off</button></form><RequestHistory title="Time-off history">{ownTimeOff.map(request => <RequestRow key={request.id} title={`${request.startDate} → ${request.endDate}`} detail={request.reason || 'Time off'} status={request.status} onCancel={request.status === 'pending' ? () => updateTimeOffRequest(request.id, 'cancelled') : undefined} />)}</RequestHistory></section>}
        {view === 'profile' && <section className="space-y-4"><form onSubmit={saveProfile} className="space-y-5 rounded-3xl bg-white p-5 shadow-sm"><div className="flex items-center gap-3"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-50 font-black">{employee.name.split(' ').map(part => part[0]).slice(0, 2).join('')}</div><div><h2 className="font-black">{employee.name}</h2><p className="text-sm text-slate-500">{employee.role} · {employee.department}</p></div></div><div className="grid gap-3 rounded-2xl bg-slate-50 p-4 text-sm"><ProfileLine label="Work email" value={user?.email || employee.email || '—'} /><ProfileLine label="Clock-in number" value={employee.clockInNumber || '—'} /><ProfileLine label="Company" value={accountName} /></div><label className="block"><span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-500">Phone number</span><input type="tel" value={phone} onChange={event => setPhone(event.target.value)} className="h-12 w-full rounded-xl border border-slate-200 px-3 text-sm" placeholder="416-555-0123" /></label><div><div className="mb-2 flex items-center gap-2"><Bell className="h-4 w-4 text-[#B58B00]" /><h3 className="text-sm font-black">Notifications</h3></div><p className="mb-3 text-xs text-slate-500">{nativeNotifications === 'ready' ? 'Push notifications are enabled on this device.' : nativeNotifications === 'denied' ? 'Notifications are blocked in this device’s settings.' : nativeNotifications === 'web' ? 'Install ZestEmployee to receive native push alerts.' : 'Checking notification access…'}</p><div className="divide-y divide-slate-100 rounded-2xl border border-slate-200">{([{ key: 'schedulePublished', label: 'Schedule published' }, { key: 'scheduleChanged', label: 'Shift changes' }, { key: 'requestUpdates', label: 'Request decisions' }, { key: 'reminders', label: 'Upcoming shift reminders' }] as const).map(item => <label key={item.key} className="flex cursor-pointer items-center justify-between gap-4 p-4 text-sm font-bold"><span>{item.label}</span><input type="checkbox" checked={preferences[item.key]} onChange={event => setPreferences(current => ({ ...current, [item.key]: event.target.checked }))} className="h-5 w-5 accent-[#F5D62E]" /></label>)}</div></div><button disabled={savingProfile} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#F5D62E] py-3 font-black disabled:opacity-50"><Save className="h-4 w-4" />{savingProfile ? 'Saving…' : 'Save settings'}</button></form></section>}
      </main>

      <nav className="fixed inset-x-0 bottom-0 border-t border-slate-100 bg-white/95 p-2 backdrop-blur"><div className="mx-auto grid max-w-md grid-cols-4 gap-1">{([{ id: 'schedule', label: 'Schedule', icon: CalendarDays }, { id: 'swaps', label: 'Swaps', icon: ArrowLeftRight }, { id: 'time-off', label: 'Time off', icon: Palmtree }, { id: 'profile', label: 'Profile', icon: UserRound }] as const).map(item => <button key={item.id} onClick={() => setView(item.id)} className={`flex flex-col items-center gap-1 rounded-xl py-2 text-[10px] font-black ${view === item.id ? 'bg-amber-50 text-[#303A43]' : 'text-slate-400'}`}><item.icon className="h-5 w-5" />{item.label}</button>)}</div></nav>
    </div>
  );
}

function Empty({ message }: { message: string }) { return <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500">{message}</div>; }
function EmployeeSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }> }) { return <label className="block"><span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-500">{label}</span><select value={value} onChange={event => onChange(event.target.value)} className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"><option value="">Select</option>{options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>; }
function DateInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label><span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-500">{label}</span><input type="date" value={value} onChange={event => onChange(event.target.value)} className="h-12 w-full rounded-xl border border-slate-200 px-3 text-sm" /></label>; }
function ProfileLine({ label, value }: { label: string; value: string }) { return <div className="flex items-center justify-between gap-4"><span className="text-slate-500">{label}</span><strong className="min-w-0 break-words text-right">{value}</strong></div>; }
function RequestHistory({ title, children }: { title: string; children: React.ReactNode }) { return <div className="overflow-hidden rounded-3xl bg-white shadow-sm"><h2 className="border-b border-slate-100 p-5 font-black">{title}</h2><div className="divide-y divide-slate-100">{children}</div></div>; }
function RequestRow({ title, detail, status, onCancel }: { title: string; detail: string; status: string; onCancel?: () => void }) { const approved = status === 'approved' || status === 'accepted'; return <div className="flex items-center gap-3 p-4">{approved ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : status === 'declined' || status === 'cancelled' ? <XCircle className="h-5 w-5 text-slate-400" /> : <Clock3 className="h-5 w-5 text-amber-500" />}<div className="min-w-0 flex-1"><p className="break-words text-sm font-black">{title}</p><p className="mt-0.5 break-words text-xs text-slate-500">{detail}</p></div><span className="text-[10px] font-black uppercase text-slate-500">{status}</span>{onCancel && <button onClick={onCancel} className="text-xs font-bold text-red-500">Cancel</button>}</div>; }
