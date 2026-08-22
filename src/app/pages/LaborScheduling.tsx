import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { ArrowLeftRight, CalendarDays, Check, ChevronLeft, ChevronRight, Clock3, Copy, DollarSign, MailPlus, Plus, Target, Trash2, UsersRound, X } from 'lucide-react';
import { Navigate } from 'react-router';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { useAuth } from '../contexts/AuthContext';
import { useLabor, type LaborEmployee, type LaborShift } from '../contexts/LaborContext';
import { useToast } from '../contexts/ToastContext';

const SHIFT_TAGS = ['OPEN', 'CLOSE', 'ADMIN', 'TRAINING', 'ON-CALL', 'PREP', 'EXPO', 'BAR', 'HOST', 'DINNER'];

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

function formatMoney(value: number, digits = 0) {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: digits }).format(value);
}

function shiftHours(shift: LaborShift) {
  const [startHour, startMinute] = shift.start.split(':').map(Number);
  const [endHour, endMinute] = shift.end.split(':').map(Number);
  let minutes = (endHour * 60 + endMinute) - (startHour * 60 + startMinute);
  if (minutes < 0) minutes += 24 * 60;
  return Math.max(0, minutes - shift.breakMinutes) / 60;
}

function formatShiftTime(value: string, useAmPm: boolean) {
  if (!useAmPm) return value;
  const [hour, minute] = value.split(':').map(Number);
  const suffix = hour >= 12 ? 'PM' : 'AM';
  return `${((hour + 11) % 12) + 1}:${String(minute).padStart(2, '0')} ${suffix}`;
}

function isNightShift(shift: LaborShift) {
  const startHour = Number(shift.start.split(':')[0]);
  return startHour >= 17 || startHour < 5;
}

function shiftsOverlap(left: LaborShift, right: LaborShift) {
  const minutes = (value: string) => {
    const [hour, minute] = value.split(':').map(Number);
    return hour * 60 + minute;
  };
  const range = (shift: LaborShift) => {
    const start = minutes(shift.start);
    const rawEnd = minutes(shift.end);
    return [start, rawEnd <= start ? rawEnd + 24 * 60 : rawEnd] as const;
  };
  const [leftStart, leftEnd] = range(left);
  const [rightStart, rightEnd] = range(right);
  return leftStart < rightEnd && rightStart < leftEnd;
}

function shiftAccentClass(tag = '') {
  if (tag.includes('CLOSE')) return 'border-l-violet-500';
  if (tag.includes('OPEN')) return 'border-l-emerald-500';
  if (tag.includes('ON-CALL')) return 'border-l-orange-500';
  if (tag.includes('TRAIN')) return 'border-l-blue-500';
  if (tag.includes('ADMIN')) return 'border-l-slate-500';
  if (tag.includes('BAR')) return 'border-l-cyan-500';
  return 'border-l-amber-500';
}

function tagClass(tag = '') {
  if (tag.includes('CLOSE')) return 'border-violet-200 bg-violet-50 text-violet-800';
  if (tag.includes('OPEN')) return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (tag.includes('ON-CALL')) return 'border-orange-200 bg-orange-50 text-orange-800';
  if (tag.includes('TRAIN')) return 'border-blue-200 bg-blue-50 text-blue-800';
  if (tag.includes('ADMIN')) return 'border-slate-300 bg-slate-100 text-slate-700';
  if (tag.includes('BAR')) return 'border-cyan-200 bg-cyan-50 text-cyan-800';
  return 'border-amber-200 bg-amber-50 text-amber-900';
}

export function LaborScheduling() {
  const { user } = useAuth();
  const { employees, shifts, timeOffRequests, shiftSwapRequests, targetLaborPercent, inviteEmployee, updateEmployee, removeEmployee, addShift, updateShift, removeShift, updateTimeOffRequest, updateShiftSwapRequest, setTargetLaborPercent, scheduledHoursForRange, laborCostBreakdownForRange } = useLabor();
  const { salesData } = useToast();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [view, setView] = useState<'schedule' | 'requests' | 'team'>('schedule');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null);
  const [isInviting, setIsInviting] = useState(false);
  const [employeeName, setEmployeeName] = useState('');
  const [employeeEmail, setEmployeeEmail] = useState('');
  const [employeePhone, setEmployeePhone] = useState('');
  const [employeeClockInNumber, setEmployeeClockInNumber] = useState('');
  const [employeeRole, setEmployeeRole] = useState('Line Cook');
  const [employeeDepartment, setEmployeeDepartment] = useState('Back of house');
  const [employeePayType, setEmployeePayType] = useState<'hourly' | 'salary'>('hourly');
  const [employeeRate, setEmployeeRate] = useState('20');
  const [employeeSalary, setEmployeeSalary] = useState('65000');
  const [shiftEmployeeId, setShiftEmployeeId] = useState('');
  const [shiftDate, setShiftDate] = useState(() => localDateKey(new Date()));
  const [shiftStart, setShiftStart] = useState('09:00');
  const [shiftEnd, setShiftEnd] = useState('17:00');
  const [shiftBreak, setShiftBreak] = useState('30');
  const [shiftTag, setShiftTag] = useState('');
  const [shiftNotes, setShiftNotes] = useState('');
  const [shiftEditorOpen, setShiftEditorOpen] = useState(false);
  const [useAmPm, setUseAmPm] = useState(true);
  const [draggedShiftId, setDraggedShiftId] = useState<string | null>(null);
  const [copiedShiftId, setCopiedShiftId] = useState<string | null>(null);
  const canManage = user?.role === 'Owner' || user?.role === 'Admin' || user?.role === 'Manager';

  const days = useMemo(() => Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + index);
    return date;
  }), [weekStart]);
  const startKey = localDateKey(days[0]);
  const endKey = localDateKey(days[6]);
  const weekHours = scheduledHoursForRange(startKey, endKey);
  const weekCost = laborCostBreakdownForRange(startKey, endKey);
  const todayKey = localDateKey(new Date());
  const todayCost = laborCostBreakdownForRange(todayKey, todayKey);
  const weekSales = salesData.filter(day => day.date >= startKey && day.date <= endKey).reduce((sum, day) => sum + day.revenue, 0);
  const labourPercent = weekSales > 0 ? (weekCost.total / weekSales) * 100 : 0;
  const activeEmployees = employees.filter(employee => employee.active).sort((left, right) => left.department.localeCompare(right.department) || left.name.localeCompare(right.name));

  if (!canManage) return <Navigate to="/employee" replace />;

  const resetEmployeeForm = () => {
    setEmployeeName('');
    setEmployeeEmail('');
    setEmployeePhone('');
    setEmployeeClockInNumber('');
    setEmployeeRole('Line Cook');
    setEmployeeDepartment('Back of house');
    setEmployeePayType('hourly');
    setEmployeeRate('20');
    setEmployeeSalary('65000');
  };

  const submitEmployee = async (event: FormEvent) => {
    event.preventDefault();
    if (!employeeName.trim() || !employeeEmail.trim()) return toast.error('Enter the employee name and email.');
    setIsInviting(true);
    try {
      await inviteEmployee({
        name: employeeName.trim(),
        email: employeeEmail.trim().toLowerCase(),
        phone: employeePhone.trim(),
        clockInNumber: employeeClockInNumber.trim() || String(Date.now()).slice(-4),
        role: employeeRole.trim() || 'Team Member',
        department: employeeDepartment.trim() || 'Restaurant team',
        payType: employeePayType,
        hourlyRate: employeePayType === 'hourly' ? Number(employeeRate) || 0 : 0,
        annualSalary: employeePayType === 'salary' ? Number(employeeSalary) || 0 : 0,
        active: true,
      });
      resetEmployeeForm();
      setInviteOpen(false);
      toast.success('Employee profile saved and ZestEmployee access is ready.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to invite employee.');
    } finally {
      setIsInviting(false);
    }
  };

  const submitShift = (event: FormEvent) => {
    event.preventDefault();
    const employeeId = shiftEmployeeId || activeEmployees[0]?.id;
    if (!employeeId) return toast.error('Invite an employee first.');
    addShift({ employeeId, date: shiftDate, start: shiftStart, end: shiftEnd, breakMinutes: Number(shiftBreak) || 0, status: 'scheduled', tag: shiftTag.trim().toUpperCase(), notes: shiftNotes.trim() });
    setShiftTag('');
    setShiftNotes('');
    setShiftEditorOpen(false);
    toast.success('Shift added to the schedule.');
  };

  const openEmployeeEditor = (employee: LaborEmployee) => {
    setEditingEmployeeId(employee.id); setEmployeeName(employee.name); setEmployeeEmail(employee.email || ''); setEmployeePhone(employee.phone || ''); setEmployeeClockInNumber(employee.clockInNumber || ''); setEmployeeRole(employee.role); setEmployeeDepartment(employee.department); setEmployeePayType(employee.payType); setEmployeeRate(String(employee.hourlyRate || '')); setEmployeeSalary(String(employee.annualSalary || ''));
  };
  const saveEmployeeChanges = (event: FormEvent) => {
    event.preventDefault();
    if (!editingEmployeeId || !employeeName.trim()) return;
    updateEmployee(editingEmployeeId, { name: employeeName.trim(), email: employeeEmail.trim().toLowerCase(), phone: employeePhone.trim(), clockInNumber: employeeClockInNumber.trim(), role: employeeRole.trim() || 'Team Member', department: employeeDepartment.trim() || 'Restaurant team', payType: employeePayType, hourlyRate: employeePayType === 'hourly' ? Number(employeeRate) || 0 : 0, annualSalary: employeePayType === 'salary' ? Number(employeeSalary) || 0 : 0 });
    setEditingEmployeeId(null); toast.success('Employee details saved.');
  };

  const openShiftEditor = (employeeId: string, date: string) => {
    setShiftEmployeeId(employeeId);
    setShiftDate(date);
    setShiftEditorOpen(true);
  };

  const moveWeek = (daysToAdd: number) => setWeekStart(current => {
    const next = new Date(current);
    next.setDate(next.getDate() + daysToAdd);
    return next;
  });

  const placeShift = (employeeId: string, date: string) => {
    const shiftId = draggedShiftId || copiedShiftId;
    const source = shifts.find(shift => shift.id === shiftId);
    const sourceEmployee = employees.find(employee => employee.id === source?.employeeId);
    const targetEmployee = employees.find(employee => employee.id === employeeId);
    if (!source || !sourceEmployee || !targetEmployee) return;
    if (sourceEmployee.role !== targetEmployee.role) {
      toast.error(`Only ${sourceEmployee.role} shifts can be assigned to another ${sourceEmployee.role}.`);
      setDraggedShiftId(null);
      return;
    }
    const overlappingShift = shifts.find(shift => shift.id !== source.id && shift.employeeId === employeeId && shift.date === date && shift.status !== 'called-off' && shiftsOverlap(source, shift));
    if (overlappingShift && !window.confirm(`${targetEmployee.name} already has an overlapping ${formatShiftTime(overlappingShift.start, useAmPm)}–${formatShiftTime(overlappingShift.end, useAmPm)} shift. Add this shift anyway?`)) {
      setDraggedShiftId(null);
      setCopiedShiftId(null);
      return;
    }
    if (copiedShiftId) {
      addShift({ ...source, employeeId, date });
      toast.success(`Copied shift to ${targetEmployee.name}.`);
      setCopiedShiftId(null);
      return;
    }
    updateShift(source.id, { employeeId, date });
    toast.success(`Moved shift to ${targetEmployee.name}.`);
    setDraggedShiftId(null);
  };

  return (
    <div className="mx-auto max-w-[1500px] space-y-5">
      <section className="overflow-hidden rounded-2xl bg-[#0B1220] p-3 text-white sm:p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex min-w-0 flex-1 rounded-xl bg-white/10 p-1 sm:flex-none"><ViewButton label="Schedule" active={view === 'schedule'} onClick={() => setView('schedule')} /><ViewButton label="Requests" active={view === 'requests'} count={timeOffRequests.filter(request => request.status === 'pending').length + shiftSwapRequests.filter(request => request.status === 'pending').length} onClick={() => setView('requests')} /><ViewButton label="Employees" active={view === 'team'} onClick={() => setView('team')} /></div>
          <button type="button" onClick={() => setInviteOpen(true)} className="inline-flex items-center gap-1.5 rounded-xl bg-[#F5C10E] px-3 py-2.5 text-xs font-black text-[#0B1220]"><MailPlus className="h-3.5 w-3.5" />Invite employee</button>
          <button type="button" onClick={() => setUseAmPm(current => !current)} className="rounded-xl border border-white/20 px-3 py-2.5 text-xs font-black text-white">{useAmPm ? '12-hour time' : '24-hour time'}</button>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <Metric icon={Clock3} label="Scheduled hours" value={`${weekHours.toFixed(1)}h`} />
        <Metric icon={DollarSign} label="Today's labour" value={formatMoney(todayCost.total)} />
        <Metric icon={DollarSign} label="Projected labour" value={formatMoney(weekCost.total)} />
        <Metric icon={DollarSign} label="Salaried labour" value={formatMoney(weekCost.salaried)} />
        <Metric icon={Target} label="Total vs sales" value={weekSales > 0 ? `${labourPercent.toFixed(1)}%` : formatMoney(weekCost.total)} tone={weekSales > 0 && labourPercent > targetLaborPercent ? 'warning' : 'normal'} />
        <Metric icon={UsersRound} label="Active team" value={String(activeEmployees.length)} />
      </section>

      {view === 'schedule' && (
        <div className="grid gap-5">
          <section className="min-w-0 overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4">
              <div><p className="font-black text-slate-900">{days[0].toLocaleDateString('en-CA', { month: 'long', day: 'numeric' })} – {days[6].toLocaleDateString('en-CA', { month: 'long', day: 'numeric' })}</p></div>
              <div className="flex gap-2"><button aria-label="Previous week" onClick={() => moveWeek(-7)} className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200"><ChevronLeft className="h-4 w-4" /></button><button onClick={() => setWeekStart(startOfWeek(new Date()))} className="rounded-xl border border-slate-200 px-3 text-sm font-bold">Today</button><button aria-label="Next week" onClick={() => moveWeek(7)} className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200"><ChevronRight className="h-4 w-4" /></button></div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1180px] border-collapse text-left">
                <thead><tr className="bg-slate-50"><th className="sticky left-0 z-20 w-[210px] min-w-[210px] border-b border-r border-slate-200 bg-slate-50 p-3 text-[10px] font-black uppercase tracking-wider text-slate-500">Employee</th>{days.map(day => <th key={localDateKey(day)} className="min-w-[138px] border-b border-r border-slate-200 p-3 last:border-r-0"><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{day.toLocaleDateString('en-CA', { weekday: 'short' })}</p><p className="mt-1 font-black text-slate-900">{day.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}</p></th>)}</tr></thead>
                <tbody>{activeEmployees.map(employee => {
                  const employeeWeekShifts = shifts.filter(shift => shift.employeeId === employee.id && shift.date >= startKey && shift.date <= endKey && shift.status !== 'called-off');
                  const employeeHours = employeeWeekShifts.reduce((sum, shift) => sum + shiftHours(shift), 0);
                  return <tr key={employee.id} className="align-top"><th className="sticky left-0 z-10 border-b border-r border-slate-200 bg-white p-3"><div className="flex items-start gap-2"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#FEF3C7] text-xs font-black text-[#0B1220]">{employee.name.split(' ').map(part => part[0]).slice(0, 2).join('')}</div><div className="min-w-0"><p className="break-words text-sm font-black text-slate-900">{employee.name}</p><p className="mt-0.5 break-words text-[10px] font-bold text-slate-500">{employee.role}</p><p className="mt-1 text-[10px] text-slate-400">{employeeWeekShifts.length} shifts · {employeeHours.toFixed(1)}h</p>{employee.payType === 'salary' && <span className="mt-1 inline-flex rounded-full bg-[#0B1220] px-2 py-0.5 text-[9px] font-black text-[#F5C10E]">SALARIED</span>}</div></div></th>{days.map(day => {
                    const key = localDateKey(day);
                    const dayShifts = employeeWeekShifts.filter(shift => shift.date === key);
                    const isCopyTarget = copiedShiftId && employees.find(item => item.id === shifts.find(item => item.id === copiedShiftId)?.employeeId)?.role === employee.role;
                    return <td key={key} onDragOver={event => event.preventDefault()} onDrop={() => placeShift(employee.id, key)} onClick={() => copiedShiftId && placeShift(employee.id, key)} className={`h-[116px] border-b border-r border-slate-200 p-2 last:border-r-0 ${isCopyTarget ? 'cursor-copy bg-amber-50/70' : ''}`}><div className="space-y-2">{dayShifts.map(shift => <div key={shift.id} draggable onDragStart={() => setDraggedShiftId(shift.id)} onDragEnd={() => setDraggedShiftId(null)} className={`group cursor-grab rounded-xl border border-l-4 p-2 shadow-sm active:cursor-grabbing ${shiftAccentClass(shift.tag)} ${isNightShift(shift) ? 'bg-slate-100' : 'bg-white'}`}><div className="flex items-start justify-between gap-1"><p className="text-[11px] font-black text-slate-900">{formatShiftTime(shift.start, useAmPm)}–{formatShiftTime(shift.end, useAmPm)}</p><div className="flex items-center gap-1"><button aria-label={`Copy ${employee.name} shift`} onClick={event => { event.stopPropagation(); setCopiedShiftId(shift.id); setDraggedShiftId(null); toast.message('Select a matching-position schedule cell to copy this shift.'); }} className="text-slate-400 opacity-100 sm:opacity-0 sm:group-hover:opacity-100"><Copy className="h-3 w-3" /></button><button aria-label={`Delete ${employee.name} shift`} onClick={event => { event.stopPropagation(); removeShift(shift.id); }} className="text-red-400 opacity-100 sm:opacity-0 sm:group-hover:opacity-100"><X className="h-3 w-3" /></button></div></div>{shift.tag && <span className={`mt-1 inline-flex rounded-md border px-1.5 py-0.5 text-[8px] font-black tracking-wide ${tagClass(shift.tag)}`}>{shift.tag}</span>}{shift.notes && <p className="mt-1 line-clamp-2 text-[9px] leading-4 text-slate-500">{shift.notes}</p>}</div>)}<button type="button" aria-label={`Add shift for ${employee.name} on ${key}`} onClick={event => { event.stopPropagation(); openShiftEditor(employee.id, key); }} className="grid h-8 w-full place-items-center rounded-lg border border-dashed border-slate-200 text-slate-400 hover:border-[#F5C10E] hover:bg-amber-50 hover:text-[#B58B00]"><Plus className="h-4 w-4" /></button></div></td>;
                  })}</tr>;
                })}{activeEmployees.length === 0 && <tr><td colSpan={8} className="p-10 text-center text-sm text-slate-500">Invite employees to start building the schedule.</td></tr>}</tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {view === 'requests' && <div className="grid gap-5 lg:grid-cols-2"><RequestQueue title="Time-off requests" empty="No time-off requests." icon={CalendarDays}>{timeOffRequests.map(request => { const employee = employees.find(item => item.id === request.employeeId); return <ManagerRequest key={request.id} title={employee?.name || 'Team member'} detail={`${request.startDate} → ${request.endDate}${request.reason ? ` · ${request.reason}` : ''}`} status={request.status} onApprove={() => updateTimeOffRequest(request.id, 'approved')} onDecline={() => updateTimeOffRequest(request.id, 'declined')} />; })}</RequestQueue><RequestQueue title="Shift-swap requests" empty="No shift-swap requests." icon={ArrowLeftRight}>{shiftSwapRequests.map(request => { const employee = employees.find(item => item.id === request.requesterEmployeeId); const target = employees.find(item => item.id === request.targetEmployeeId); const shift = shifts.find(item => item.id === request.shiftId); return <ManagerRequest key={request.id} title={`${employee?.name || 'Team member'}${target ? ` → ${target.name}` : ''}`} detail={`${shift?.date || 'Shift'} · ${shift?.start || ''}–${shift?.end || ''}${request.note ? ` · ${request.note}` : ''}`} status={request.status} onApprove={() => updateShiftSwapRequest(request.id, 'approved')} onDecline={() => updateShiftSwapRequest(request.id, 'declined')} />; })}</RequestQueue></div>}

      {view === 'team' && <section className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5"><h2 className="font-black text-slate-900">Employees</h2><button type="button" onClick={() => setInviteOpen(true)} className="inline-flex items-center gap-2 rounded-xl bg-[#0B1220] px-4 py-3 text-sm font-black text-white"><MailPlus className="h-4 w-4 text-[#F5C10E]" />Invite employee</button></div><div className="divide-y divide-slate-100">{employees.map(employee => <EmployeeRow key={employee.id} employee={employee} onOpen={() => openEmployeeEditor(employee)} onRemove={() => { if (window.confirm(`Remove ${employee.name} and all of their shifts from this location?`)) removeEmployee(employee.id); }} />)}{employees.length === 0 && <div className="p-10 text-center text-sm text-slate-500">Invite your first employee to create the employee list.</div>}</div></section>}

      <section className="flex flex-col gap-3 rounded-3xl border border-amber-100 bg-amber-50 p-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-black text-amber-950">Target labour percentage</p><p className="mt-1 text-sm text-amber-800">Hourly scheduled labour plus prorated active salaries are measured against sales.</p></div><label className="flex items-center gap-2 font-black text-amber-950"><input aria-label="Target labour percentage" type="number" min="0" max="100" step="0.5" value={targetLaborPercent} onChange={event => setTargetLaborPercent(Number(event.target.value) || 0)} className="h-11 w-24 rounded-xl border border-amber-200 bg-white px-3 text-right" />%</label></section>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}><DialogContent className="max-h-[calc(100vh-2rem)] max-w-[calc(100vw-2rem)] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>Invite an employee</DialogTitle><DialogDescription>Creates their protected employee profile and sends access to ZestEmployee. Managers can be hourly or salaried.</DialogDescription></DialogHeader><form onSubmit={submitEmployee} className="space-y-4"><div className="grid gap-3 sm:grid-cols-2"><FormInput label="Full name" value={employeeName} onChange={setEmployeeName} placeholder="Employee name" required /><FormInput label="Work email" type="email" value={employeeEmail} onChange={setEmployeeEmail} placeholder="employee@restaurant.ca" required /><FormInput label="Phone" type="tel" value={employeePhone} onChange={setEmployeePhone} placeholder="416-555-0123" /><FormInput label="Clock-in number" value={employeeClockInNumber} onChange={setEmployeeClockInNumber} placeholder="1006" /><FormInput label="Position" value={employeeRole} onChange={setEmployeeRole} placeholder="General Manager" /><FormSelect label="Department" value={employeeDepartment} onChange={setEmployeeDepartment} options={['Management', 'Front of house', 'Back of house', 'Bar', 'Support'].map(value => ({ value, label: value }))} /><FormSelect label="Pay type" value={employeePayType} onChange={value => setEmployeePayType(value as 'hourly' | 'salary')} options={[{ value: 'hourly', label: 'Hourly' }, { value: 'salary', label: 'Salaried' }]} /></div>{employeePayType === 'salary' ? <FormInput label="Annual salary (CAD)" type="number" value={employeeSalary} onChange={setEmployeeSalary} /> : <FormInput label="Hourly rate (CAD)" type="number" value={employeeRate} onChange={setEmployeeRate} />}<div className="flex justify-end gap-2 pt-2"><button type="button" onClick={() => setInviteOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2.5 font-bold text-slate-700">Cancel</button><button type="submit" disabled={isInviting} className="rounded-xl bg-[#F5C10E] px-4 py-2.5 font-black text-[#0B1220] disabled:opacity-50">{isInviting ? 'Sending…' : 'Save & send invite'}</button></div></form></DialogContent></Dialog>
      <Dialog open={Boolean(editingEmployeeId)} onOpenChange={open => { if (!open) setEditingEmployeeId(null); }}><DialogContent className="max-h-[calc(100vh-2rem)] max-w-[calc(100vw-2rem)] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>Edit employee</DialogTitle><DialogDescription>Update the employee profile, role, pay details and clock-in number.</DialogDescription></DialogHeader><form onSubmit={saveEmployeeChanges} className="space-y-4"><div className="grid gap-3 sm:grid-cols-2"><FormInput label="Full name" value={employeeName} onChange={setEmployeeName} required /><FormInput label="Work email" type="email" value={employeeEmail} onChange={setEmployeeEmail} /><FormInput label="Phone" type="tel" value={employeePhone} onChange={setEmployeePhone} /><FormInput label="Clock-in number" value={employeeClockInNumber} onChange={setEmployeeClockInNumber} /><FormInput label="Position" value={employeeRole} onChange={setEmployeeRole} /><FormSelect label="Department" value={employeeDepartment} onChange={setEmployeeDepartment} options={['Management', 'Front of house', 'Back of house', 'Bar', 'Support'].map(value => ({ value, label: value }))} /><FormSelect label="Pay type" value={employeePayType} onChange={value => setEmployeePayType(value as 'hourly' | 'salary')} options={[{ value: 'hourly', label: 'Hourly' }, { value: 'salary', label: 'Salaried' }]} /></div>{employeePayType === 'salary' ? <FormInput label="Annual salary (CAD)" type="number" value={employeeSalary} onChange={setEmployeeSalary} /> : <FormInput label="Hourly rate (CAD)" type="number" value={employeeRate} onChange={setEmployeeRate} />}<div className="flex justify-end gap-2 pt-2"><button type="button" onClick={() => setEditingEmployeeId(null)} className="rounded-xl border border-slate-200 px-4 py-2.5 font-bold text-slate-700">Cancel</button><button type="submit" className="rounded-xl bg-[#F5C10E] px-4 py-2.5 font-black text-[#0B1220]">Save changes</button></div></form></DialogContent></Dialog>
      <Dialog open={shiftEditorOpen} onOpenChange={setShiftEditorOpen}><DialogContent className="max-h-[calc(100vh-2rem)] max-w-[calc(100vw-2rem)] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>Add a shift</DialogTitle><DialogDescription>Choose the time, tag and any handoff notes for this employee.</DialogDescription></DialogHeader><form onSubmit={submitShift} className="space-y-4"><FormSelect label="Employee" value={shiftEmployeeId || activeEmployees[0]?.id || ''} onChange={setShiftEmployeeId} options={activeEmployees.map(employee => ({ value: employee.id, label: `${employee.name} · ${employee.role}` }))} /><FormInput label="Date" type="date" value={shiftDate} onChange={setShiftDate} /><div className="grid grid-cols-2 gap-3"><FormInput label="Starts" type="time" value={shiftStart} onChange={setShiftStart} /><FormInput label="Ends" type="time" value={shiftEnd} onChange={setShiftEnd} /></div><FormInput label="Unpaid break (min)" type="number" value={shiftBreak} onChange={setShiftBreak} /><FormInput label="Shift tag" value={shiftTag} onChange={setShiftTag} placeholder="CLOSE, EXPO, TRAINING…" list="shift-tags" /><datalist id="shift-tags">{SHIFT_TAGS.map(tag => <option key={tag} value={tag} />)}</datalist><FormInput label="Shift notes" value={shiftNotes} onChange={setShiftNotes} placeholder="Section, training or handoff note" /><div className="flex justify-end gap-2 pt-2"><button type="button" onClick={() => setShiftEditorOpen(false)} className="rounded-xl border border-slate-200 px-4 py-3 font-bold text-slate-700">Cancel</button><button type="submit" className="rounded-xl bg-[#F5C10E] px-4 py-3 font-black text-[#0B1220]">Add tagged shift</button></div></form></DialogContent></Dialog>
    </div>
  );
}

function ViewButton({ label, active, count = 0, onClick }: { label: string; active: boolean; count?: number; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`relative rounded-lg px-3 py-2 text-sm font-bold ${active ? 'bg-[#F5C10E] text-[#0B1220]' : 'text-white/65'}`}>{label}{count > 0 && <span className="ml-1 rounded-full bg-red-500 px-1.5 py-0.5 text-[9px] text-white">{count}</span>}</button>;
}

function EmployeeRow({ employee, onOpen, onRemove }: { employee: LaborEmployee; onOpen: () => void; onRemove: () => void }) {
  const pay = employee.payType === 'salary' ? `${formatMoney(employee.annualSalary)}/yr` : `${formatMoney(employee.hourlyRate, 2)}/hr`;
  return <div className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1.5fr)_minmax(110px,0.65fr)_minmax(100px,0.55fr)_auto] sm:items-center"><button type="button" onClick={onOpen} className="flex min-w-0 items-center gap-3 text-left"><div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#FEF3C7] font-black text-[#0B1220]">{employee.name.split(' ').map(part => part[0]).slice(0, 2).join('')}</div><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="truncate font-black text-slate-900">{employee.name}</p><span className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase ${employee.inviteStatus === 'pending' ? 'bg-amber-50 text-amber-700' : employee.inviteStatus === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{employee.inviteStatus.replace('-', ' ')}</span></div><p className="mt-1 truncate text-xs font-semibold text-slate-500">{employee.role} · {employee.department}</p><p className="mt-1 truncate text-xs text-slate-400">{employee.email || employee.phone || 'No contact details'}</p></div></button><button type="button" onClick={onOpen} className="rounded-xl bg-slate-50 px-3 py-2 text-left"><p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Clock-in #</p><p className="mt-1 font-black tabular-nums text-slate-900">{employee.clockInNumber || '—'}</p></button><button type="button" onClick={onOpen} className="rounded-xl bg-slate-50 px-3 py-2 text-left sm:text-right"><p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Pay</p><p className="mt-1 font-black tabular-nums text-slate-900">{pay}</p></button><button aria-label={`Remove ${employee.name}`} onClick={onRemove} className="grid h-10 w-10 place-items-center rounded-xl text-red-500 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button></div>;
}

function Metric({ icon: Icon, label, value, tone = 'normal' }: { icon: typeof CalendarDays; label: string; value: string; tone?: 'normal' | 'warning' }) {
  return <div className={`rounded-2xl border p-4 ${tone === 'warning' ? 'border-red-100 bg-red-50' : 'border-slate-100 bg-white'}`}><div className="flex items-center gap-2 text-xs font-bold text-slate-500"><Icon className="h-4 w-4" />{label}</div><p className={`mt-2 break-words text-xl font-black ${tone === 'warning' ? 'text-red-700' : 'text-slate-900'}`}>{value}</p></div>;
}

function FormInput({ label, value, onChange, type = 'text', placeholder, list, required = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; placeholder?: string; list?: string; required?: boolean }) {
  return <label className="block"><span className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-slate-500">{label}</span><input type={type} value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} list={list} required={required} min={type === 'number' ? 0 : undefined} step={type === 'number' ? '0.01' : undefined} className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm" /></label>;
}

function FormSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }> }) {
  return <label className="block"><span className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-slate-500">{label}</span><select value={value} onChange={event => onChange(event.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"><option value="">Select</option>{options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
}

function RequestQueue({ title, empty, icon: Icon, children }: { title: string; empty: string; icon: typeof CalendarDays; children: ReactNode }) {
  const hasRequests = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return <section className="overflow-hidden rounded-3xl bg-white shadow-sm"><div className="flex items-center gap-2 border-b border-slate-100 p-5"><Icon className="h-5 w-5 text-[#B58B00]" /><h2 className="font-black">{title}</h2></div><div className="divide-y divide-slate-100">{hasRequests ? children : <p className="p-8 text-center text-sm text-slate-500">{empty}</p>}</div></section>;
}

function ManagerRequest({ title, detail, status, onApprove, onDecline }: { title: string; detail: string; status: string; onApprove: () => void; onDecline: () => void }) {
  return <div className="p-5"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="break-words font-black text-slate-900">{title}</p><p className="mt-1 break-words text-sm leading-6 text-slate-500">{detail}</p></div><span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${status === 'pending' ? 'bg-amber-50 text-amber-700' : status === 'approved' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{status}</span></div>{status === 'pending' && <div className="mt-4 flex gap-2"><button onClick={onApprove} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-2.5 text-sm font-black text-white"><Check className="h-4 w-4" />Approve</button><button onClick={onDecline} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-red-200 py-2.5 text-sm font-black text-red-600"><X className="h-4 w-4" />Decline</button></div>}</div>;
}
