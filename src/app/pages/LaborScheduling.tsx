import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { ArrowLeftRight, CalendarDays, Check, ChevronLeft, ChevronRight, Clock3, DollarSign, ExternalLink, Plus, Target, Trash2, UsersRound, X } from 'lucide-react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { useLabor } from '../contexts/LaborContext';
import { useToast } from '../contexts/ToastContext';

function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function startOfWeek(source: Date) {
  const date = new Date(source);
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return date;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(value);
}

export function LaborScheduling() {
  const { user } = useAuth();
  const { employees, shifts, timeOffRequests, shiftSwapRequests, targetLaborPercent, addEmployee, removeEmployee, addShift, removeShift, updateTimeOffRequest, updateShiftSwapRequest, setTargetLaborPercent, scheduledCostForRange, scheduledHoursForRange } = useLabor();
  const { salesData } = useToast();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [view, setView] = useState<'schedule' | 'requests' | 'team'>('schedule');
  const [employeeName, setEmployeeName] = useState('');
  const [employeeEmail, setEmployeeEmail] = useState('');
  const [employeeRole, setEmployeeRole] = useState('Line Cook');
  const [employeeRate, setEmployeeRate] = useState('20');
  const [shiftEmployeeId, setShiftEmployeeId] = useState('');
  const [shiftDate, setShiftDate] = useState(() => localDateKey(new Date()));
  const [shiftStart, setShiftStart] = useState('09:00');
  const [shiftEnd, setShiftEnd] = useState('17:00');
  const [shiftBreak, setShiftBreak] = useState('30');
  const canManage = user?.role === 'Owner' || user?.role === 'Admin' || user?.role === 'Manager';

  const days = useMemo(() => Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + index);
    return date;
  }), [weekStart]);
  const startKey = localDateKey(days[0]);
  const endKey = localDateKey(days[6]);
  const weekHours = scheduledHoursForRange(startKey, endKey);
  const weekCost = scheduledCostForRange(startKey, endKey);
  const weekSales = salesData.filter(day => day.date >= startKey && day.date <= endKey).reduce((sum, day) => sum + day.revenue, 0);
  const labourPercent = weekSales > 0 ? (weekCost / weekSales) * 100 : 0;
  const targetSales = targetLaborPercent > 0 ? weekCost / (targetLaborPercent / 100) : 0;

  const submitEmployee = (event: FormEvent) => {
    event.preventDefault();
    if (!employeeName.trim()) return toast.error('Enter the employee name.');
    addEmployee({ name: employeeName.trim(), email: employeeEmail.trim().toLowerCase(), role: employeeRole.trim() || 'Team Member', hourlyRate: Number(employeeRate) || 0, active: true });
    setEmployeeName('');
    setEmployeeEmail('');
    toast.success('Team member added.');
  };

  const submitShift = (event: FormEvent) => {
    event.preventDefault();
    const employeeId = shiftEmployeeId || employees[0]?.id;
    if (!employeeId) return toast.error('Add a team member first.');
    addShift({ employeeId, date: shiftDate, start: shiftStart, end: shiftEnd, breakMinutes: Number(shiftBreak) || 0, status: 'scheduled' });
    toast.success('Shift added to the schedule.');
  };

  const moveWeek = (daysToAdd: number) => setWeekStart(current => {
    const next = new Date(current);
    next.setDate(next.getDate() + daysToAdd);
    return next;
  });

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <section className="overflow-hidden rounded-[30px] bg-[#0B1220] p-6 text-white sm:p-8">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div><p className="text-xs font-black uppercase tracking-[0.2em] text-[#F5C10E]">Labour & scheduling</p><h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Put labour on the same scoreboard as food cost.</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-white/60">Build the week, see scheduled hours and cost, and compare labour against sales before the schedule becomes a payroll problem.</p></div>
          <div className="flex flex-wrap items-center gap-2"><div className="flex rounded-xl bg-white/10 p-1"><button onClick={() => setView('schedule')} className={`rounded-lg px-3 py-2 text-sm font-bold ${view === 'schedule' ? 'bg-[#F5C10E] text-[#0B1220]' : 'text-white/65'}`}>Schedule</button><button onClick={() => setView('requests')} className={`relative rounded-lg px-3 py-2 text-sm font-bold ${view === 'requests' ? 'bg-[#F5C10E] text-[#0B1220]' : 'text-white/65'}`}>Requests{timeOffRequests.filter(request => request.status === 'pending').length + shiftSwapRequests.filter(request => request.status === 'pending').length > 0 && <span className="ml-1 rounded-full bg-red-500 px-1.5 py-0.5 text-[9px] text-white">{timeOffRequests.filter(request => request.status === 'pending').length + shiftSwapRequests.filter(request => request.status === 'pending').length}</span>}</button><button onClick={() => setView('team')} className={`rounded-lg px-3 py-2 text-sm font-bold ${view === 'team' ? 'bg-[#F5C10E] text-[#0B1220]' : 'text-white/65'}`}>Team</button></div><Link to="/employee" className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 px-3 py-2 text-xs font-bold text-white/75">Open ZestEmployee<ExternalLink className="h-3.5 w-3.5" /></Link></div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric icon={Clock3} label="Scheduled hours" value={`${weekHours.toFixed(1)}h`} />
        <Metric icon={DollarSign} label="Scheduled cost" value={formatMoney(weekCost)} />
        <Metric icon={Target} label="Labour % of sales" value={weekSales > 0 ? `${labourPercent.toFixed(1)}%` : 'Waiting for sales'} tone={weekSales > 0 && labourPercent > targetLaborPercent ? 'warning' : 'normal'} />
        <Metric icon={UsersRound} label="Active team" value={String(employees.filter(employee => employee.active).length)} />
      </section>

      {view === 'schedule' && (
        <div className="grid gap-5 xl:grid-cols-[1fr_310px]">
          <section className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4">
              <div><p className="font-black text-slate-900">{days[0].toLocaleDateString('en-CA', { month: 'long', day: 'numeric' })} – {days[6].toLocaleDateString('en-CA', { month: 'long', day: 'numeric' })}</p><p className="mt-1 text-xs text-slate-500">{formatMoney(targetSales)} sales needed to hit a {targetLaborPercent}% labour target.</p></div>
              <div className="flex gap-2"><button aria-label="Previous week" onClick={() => moveWeek(-7)} className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200"><ChevronLeft className="h-4 w-4" /></button><button onClick={() => setWeekStart(startOfWeek(new Date()))} className="rounded-xl border border-slate-200 px-3 text-sm font-bold">Today</button><button aria-label="Next week" onClick={() => moveWeek(7)} className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200"><ChevronRight className="h-4 w-4" /></button></div>
            </div>
            <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-7">
              {days.map(day => {
                const key = localDateKey(day);
                const dayShifts = shifts.filter(shift => shift.date === key && shift.status !== 'called-off');
                return <div key={key} className="min-w-0 rounded-2xl bg-slate-50 p-3"><div className="flex items-center justify-between"><div><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{day.toLocaleDateString('en-CA', { weekday: 'short' })}</p><p className="font-black text-slate-900">{day.getDate()}</p></div><span className="rounded-full bg-white px-2 py-1 text-[10px] font-bold text-slate-500">{dayShifts.length}</span></div><div className="mt-3 space-y-2">{dayShifts.map(shift => { const employee = employees.find(item => item.id === shift.employeeId); return <div key={shift.id} className="group rounded-xl border-l-4 border-[#F5C10E] bg-white p-2 shadow-sm"><p className="break-words text-xs font-black text-slate-900">{employee?.name || 'Team member'}</p><p className="mt-1 text-[10px] text-slate-500">{shift.start}–{shift.end}</p>{canManage && <button aria-label={`Delete ${employee?.name || 'shift'}`} onClick={() => removeShift(shift.id)} className="mt-2 text-[10px] font-bold text-red-500 sm:opacity-0 sm:group-hover:opacity-100">Remove</button>}</div>})}{dayShifts.length === 0 && <p className="py-4 text-center text-[10px] text-slate-400">No shifts</p>}</div></div>;
              })}
            </div>
          </section>
          {canManage && <form onSubmit={submitShift} className="h-fit space-y-4 rounded-3xl bg-white p-5 shadow-sm"><div className="flex items-center gap-2"><Plus className="h-5 w-5 text-[#B58B00]" /><h2 className="font-black text-slate-900">Add a shift</h2></div><FormSelect label="Team member" value={shiftEmployeeId || employees[0]?.id || ''} onChange={setShiftEmployeeId} options={employees.filter(employee => employee.active).map(employee => ({ value: employee.id, label: `${employee.name} · ${employee.role}` }))} /><FormInput label="Date" type="date" value={shiftDate} onChange={setShiftDate} /><div className="grid grid-cols-2 gap-3"><FormInput label="Starts" type="time" value={shiftStart} onChange={setShiftStart} /><FormInput label="Ends" type="time" value={shiftEnd} onChange={setShiftEnd} /></div><FormInput label="Unpaid break (min)" type="number" value={shiftBreak} onChange={setShiftBreak} /><button type="submit" className="w-full rounded-xl bg-[#F5C10E] px-4 py-3 font-black text-[#0B1220]">Add shift</button></form>}
        </div>
      )}

      {view === 'requests' && (
        <div className="grid gap-5 lg:grid-cols-2">
          <RequestQueue title="Time-off requests" empty="No time-off requests." icon={CalendarDays}>{timeOffRequests.map(request => { const employee = employees.find(item => item.id === request.employeeId); return <ManagerRequest key={request.id} title={employee?.name || 'Team member'} detail={`${request.startDate} → ${request.endDate}${request.reason ? ` · ${request.reason}` : ''}`} status={request.status} onApprove={() => updateTimeOffRequest(request.id, 'approved')} onDecline={() => updateTimeOffRequest(request.id, 'declined')} />; })}</RequestQueue>
          <RequestQueue title="Shift-swap requests" empty="No shift-swap requests." icon={ArrowLeftRight}>{shiftSwapRequests.map(request => { const employee = employees.find(item => item.id === request.requesterEmployeeId); const target = employees.find(item => item.id === request.targetEmployeeId); const shift = shifts.find(item => item.id === request.shiftId); return <ManagerRequest key={request.id} title={`${employee?.name || 'Team member'}${target ? ` → ${target.name}` : ''}`} detail={`${shift?.date || 'Shift'} · ${shift?.start || ''}–${shift?.end || ''}${request.note ? ` · ${request.note}` : ''}`} status={request.status} onApprove={() => updateShiftSwapRequest(request.id, 'approved')} onDecline={() => updateShiftSwapRequest(request.id, 'declined')} />; })}</RequestQueue>
        </div>
      )}

      {view === 'team' && (
        <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
          <section className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm"><div className="border-b border-slate-100 p-5"><h2 className="font-black text-slate-900">Team & hourly rates</h2><p className="mt-1 text-sm text-slate-500">The email links this profile to the employee's ZestEmployee login.</p></div><div className="divide-y divide-slate-100">{employees.map(employee => <div key={employee.id} className="flex items-center gap-4 p-4"><div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-slate-100 font-black text-slate-600">{employee.name.split(' ').map(part => part[0]).slice(0, 2).join('')}</div><div className="min-w-0 flex-1"><p className="break-words font-black text-slate-900">{employee.name}</p><p className="break-words text-xs text-slate-500">{employee.role}{employee.email ? ` · ${employee.email}` : ' · Employee app not linked'}</p></div>{canManage && <><p className="text-sm font-black tabular-nums text-slate-800">${employee.hourlyRate.toFixed(2)}/hr</p><button aria-label={`Remove ${employee.name}`} onClick={() => removeEmployee(employee.id)} className="grid h-9 w-9 place-items-center rounded-xl text-red-500 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button></>}</div>)}{employees.length === 0 && <div className="p-10 text-center text-sm text-slate-500">Add your team to start building a labour plan.</div>}</div></section>
          {canManage && <form onSubmit={submitEmployee} className="h-fit space-y-4 rounded-3xl bg-white p-5 shadow-sm"><h2 className="font-black text-slate-900">Add team member</h2><FormInput label="Name" value={employeeName} onChange={setEmployeeName} placeholder="Employee name" /><FormInput label="Employee login email" type="email" value={employeeEmail} onChange={setEmployeeEmail} placeholder="employee@restaurant.ca" /><FormInput label="Role" value={employeeRole} onChange={setEmployeeRole} /><FormInput label="Hourly rate (CAD)" type="number" value={employeeRate} onChange={setEmployeeRate} /><button type="submit" className="w-full rounded-xl bg-[#F5C10E] px-4 py-3 font-black text-[#0B1220]">Add team member</button></form>}
        </div>
      )}

      {canManage && <section className="flex flex-col gap-3 rounded-3xl border border-amber-100 bg-amber-50 p-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-black text-amber-950">Target labour percentage</p><p className="mt-1 text-sm text-amber-800">ZestIQ uses this target to show how much sales the schedule needs.</p></div><label className="flex items-center gap-2 font-black text-amber-950"><input aria-label="Target labour percentage" type="number" min="0" max="100" step="0.5" value={targetLaborPercent} onChange={event => setTargetLaborPercent(Number(event.target.value) || 0)} className="h-11 w-24 rounded-xl border border-amber-200 bg-white px-3 text-right" />%</label></section>}
    </div>
  );
}

function Metric({ icon: Icon, label, value, tone = 'normal' }: { icon: typeof CalendarDays; label: string; value: string; tone?: 'normal' | 'warning' }) {
  return <div className={`rounded-2xl border p-4 ${tone === 'warning' ? 'border-red-100 bg-red-50' : 'border-slate-100 bg-white'}`}><div className="flex items-center gap-2 text-xs font-bold text-slate-500"><Icon className="h-4 w-4" />{label}</div><p className={`mt-2 break-words text-xl font-black ${tone === 'warning' ? 'text-red-700' : 'text-slate-900'}`}>{value}</p></div>;
}

function FormInput({ label, value, onChange, type = 'text', placeholder }: { label: string; value: string; onChange: (value: string) => void; type?: string; placeholder?: string }) {
  return <label className="block"><span className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-slate-500">{label}</span><input type={type} value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} min={type === 'number' ? 0 : undefined} step={type === 'number' ? '0.01' : undefined} className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm" /></label>;
}

function FormSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }> }) {
  return <label className="block"><span className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-slate-500">{label}</span><select value={value} onChange={event => onChange(event.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"><option value="">Select team member</option>{options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
}

function RequestQueue({ title, empty, icon: Icon, children }: { title: string; empty: string; icon: typeof CalendarDays; children: ReactNode }) {
  const hasRequests = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return <section className="overflow-hidden rounded-3xl bg-white shadow-sm"><div className="flex items-center gap-2 border-b border-slate-100 p-5"><Icon className="h-5 w-5 text-[#B58B00]" /><h2 className="font-black">{title}</h2></div><div className="divide-y divide-slate-100">{hasRequests ? children : <p className="p-8 text-center text-sm text-slate-500">{empty}</p>}</div></section>;
}

function ManagerRequest({ title, detail, status, onApprove, onDecline }: { title: string; detail: string; status: string; onApprove: () => void; onDecline: () => void }) {
  return <div className="p-5"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="break-words font-black text-slate-900">{title}</p><p className="mt-1 break-words text-sm leading-6 text-slate-500">{detail}</p></div><span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${status === 'pending' ? 'bg-amber-50 text-amber-700' : status === 'approved' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{status}</span></div>{status === 'pending' && <div className="mt-4 flex gap-2"><button onClick={onApprove} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-2.5 text-sm font-black text-white"><Check className="h-4 w-4" />Approve</button><button onClick={onDecline} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-red-200 py-2.5 text-sm font-black text-red-600"><X className="h-4 w-4" />Decline</button></div>}</div>;
}
