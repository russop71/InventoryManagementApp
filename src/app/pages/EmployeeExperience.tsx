import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { ArrowLeftRight, CalendarDays, CheckCircle2, ClipboardCheck, Clock3, Home, Lightbulb, LogOut, Palmtree, Send, Star, UserRound } from 'lucide-react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { useLabor } from '../contexts/LaborContext';

type View = 'home' | 'schedule' | 'tasks' | 'requests' | 'profile';

export function EmployeeExperience() {
  const navigate = useNavigate();
  const { user, accountName, logout } = useAuth();
  const labor = useLabor();
  const { employees, shifts, timeOffRequests, shiftSwapRequests, requestTimeOff, requestShiftSwap } = labor;
  const canPreview = ['Owner', 'Admin', 'Manager', 'BOH Manager', 'FOH Manager'].includes(user?.role || '');
  const linkedEmployee = employees.find(item => item.email?.toLowerCase() === user?.email.toLowerCase());
  const [previewId, setPreviewId] = useState(linkedEmployee?.id || employees[0]?.id || '');
  const employee = linkedEmployee || (canPreview ? employees.find(item => item.id === previewId) : undefined);
  const [view, setView] = useState<View>('home');
  const [completed, setCompleted] = useState<string[]>([]);
  const [idea, setIdea] = useState('');
  const [timeOffStart, setTimeOffStart] = useState('');
  const [timeOffEnd, setTimeOffEnd] = useState('');
  const [timeOffReason, setTimeOffReason] = useState('');
  const [swapShiftId, setSwapShiftId] = useState('');
  const [swapNote, setSwapNote] = useState('');

  useEffect(() => {
    document.title = 'ZestEmployee';
    return () => { document.title = 'ZestIQ - Restaurant Inventory Management'; };
  }, []);

  const ownShifts = useMemo(() => shifts
    .filter(shift => shift.employeeId === employee?.id && shift.status !== 'called-off')
    .sort((a, b) => `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`)), [employee?.id, shifts]);
  const upcoming = ownShifts.filter(shift => shift.date >= new Date().toISOString().slice(0, 10));
  const nextShift = upcoming[0];
  const firstName = employee?.name.split(' ')[0] || 'there';
  const tasks = employee?.role.toLowerCase().includes('bar')
    ? ['Complete bar opening checklist', 'Verify liquor delivery', 'Restock service wells', 'Submit closing count']
    : ['Complete station opening checklist', 'Verify prep levels', 'Review low-stock items', 'Submit closing count'];

  const signOut = () => { logout(); navigate('/login?returnTo=/employee'); };
  const submitTimeOff = (event: FormEvent) => {
    event.preventDefault();
    if (!employee || !timeOffStart || !timeOffEnd) return toast.error('Choose the first and last day.');
    requestTimeOff({ employeeId: employee.id, startDate: timeOffStart, endDate: timeOffEnd, reason: timeOffReason.trim() });
    setTimeOffStart(''); setTimeOffEnd(''); setTimeOffReason(''); toast.success('Time-off request sent.');
  };
  const submitSwap = (event: FormEvent) => {
    event.preventDefault();
    if (!employee || !swapShiftId) return toast.error('Choose one of your shifts.');
    requestShiftSwap({ shiftId: swapShiftId, requesterEmployeeId: employee.id, note: swapNote.trim() });
    setSwapShiftId(''); setSwapNote(''); toast.success('Shift-swap request sent.');
  };

  if (!employee) return <div className="grid min-h-screen place-items-center bg-[#F1EFE6] p-5"><div className="max-w-sm rounded-2xl bg-white p-8 text-center shadow-xl"><UserRound className="mx-auto h-11 w-11 text-[#C59B38]" /><h1 className="mt-4 text-2xl font-black">Link your employee profile</h1><p className="mt-2 text-sm text-slate-500">Ask your manager to add {user?.email} to the employee directory.</p><button onClick={signOut} className="mt-6 rounded-xl bg-[#12233F] px-5 py-3 font-bold text-white">Sign out</button></div></div>;

  return (
    <div className="zestiq-employee-shell min-h-screen bg-[#ECEAE2] pb-24 text-[#101827]">
      <header className="employee-hero relative overflow-hidden bg-[#12233F] px-5 pb-7 pt-5 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_5%,rgba(205,164,71,.55),transparent_38%)]" />
        <div className="relative mx-auto max-w-lg">
          <div className="flex items-center justify-between"><div className="flex items-center gap-2 font-black"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#D0A546] text-[#13213B]">Z</span>ZestEmployee</div><button onClick={signOut} aria-label="Sign out" className="grid h-9 w-9 place-items-center rounded-full bg-white/10"><LogOut className="h-4 w-4" /></button></div>
          <p className="mt-8 text-xs font-bold uppercase tracking-[.18em] text-white/55">{accountName}</p>
          <h1 className="mt-1 text-3xl font-black">Good {new Date().getHours() < 12 ? 'morning' : 'afternoon'}, {firstName}!</h1>
          <p className="mt-2 text-sm text-white/65">{employee.role} · Everything you need for today.</p>
          {canPreview && !linkedEmployee && <select value={previewId} onChange={event => setPreviewId(event.target.value)} className="mt-4 h-11 w-full rounded-xl border border-white/10 bg-white/10 px-3 text-sm">{employees.map(item => <option className="text-black" key={item.id} value={item.id}>{item.name} · {item.role}</option>)}</select>}
        </div>
      </header>

      <main className="mx-auto max-w-lg space-y-4 p-4">
        {view === 'home' && <>
          <section className="-mt-9 rounded-2xl bg-white p-5 shadow-xl shadow-slate-900/10"><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#A27C2D]">Next shift</p>{nextShift ? <div className="mt-3 flex items-center justify-between gap-4"><div><p className="text-xl font-black">{new Date(`${nextShift.date}T12:00:00`).toLocaleDateString('en-CA', { weekday: 'long', month: 'short', day: 'numeric' })}</p><p className="mt-1 text-sm text-slate-500">{nextShift.start}–{nextShift.end}{nextShift.tag ? ` · ${nextShift.tag}` : ''}</p></div><span className="rounded-xl bg-[#F3E8C7] px-3 py-2 text-xs font-black">Published</span></div> : <p className="mt-2 text-sm text-slate-500">No upcoming shift is published.</p>}</section>
          <section className="grid grid-cols-2 gap-3">
            <Quick icon={Clock3} label="Clock in" note="Start your shift" onClick={() => toast.info('Clock-in will connect to the restaurant time clock.')} />
            <Quick icon={CalendarDays} label="Schedule" note="View your week" onClick={() => setView('schedule')} />
            <Quick icon={ArrowLeftRight} label="Swap shift" note="Request a change" onClick={() => setView('requests')} />
            <Quick icon={ClipboardCheck} label="Tasks" note={`${tasks.length - completed.length} remaining`} onClick={() => setView('tasks')} />
          </section>
          <section className="rounded-2xl bg-white p-5 shadow-sm"><p className="font-black">Daily pulse</p><p className="mt-1 text-xs text-slate-500">How is your shift going?</p><div className="mt-4 flex justify-between text-3xl">{['😣','😕','😐','🙂','😄'].map(face => <button key={face} onClick={() => toast.success('Thanks for checking in.')} className="rounded-xl p-2 hover:bg-[#F3E8C7]">{face}</button>)}</div></section>
        </>}

        {view === 'schedule' && <section className="space-y-3"><ScreenTitle title="My schedule" note="Published shifts" />{upcoming.map(shift => <article key={shift.id} className="rounded-2xl bg-white p-5 shadow-sm"><div className="flex justify-between gap-3"><div><p className="font-black">{new Date(`${shift.date}T12:00:00`).toLocaleDateString('en-CA', { weekday: 'long', month: 'short', day: 'numeric' })}</p><p className="mt-1 text-sm text-slate-500">{shift.start}–{shift.end} · {shift.breakMinutes} min break</p></div><span className="h-fit rounded-lg bg-[#F3E8C7] px-2 py-1 text-[10px] font-black">{shift.tag || employee.role}</span></div><button onClick={() => { setSwapShiftId(shift.id); setView('requests'); }} className="mt-4 w-full rounded-xl border border-slate-200 py-2 text-sm font-bold">Swap or release</button></article>)}</section>}

        {view === 'tasks' && <section className="space-y-4"><ScreenTitle title="Tasks & checklists" note={`${completed.length} of ${tasks.length} completed`} /><div className="overflow-hidden rounded-2xl bg-white shadow-sm">{tasks.map(task => <label key={task} className="flex cursor-pointer items-center gap-3 border-b border-slate-100 p-4 last:border-0"><input type="checkbox" checked={completed.includes(task)} onChange={() => setCompleted(current => current.includes(task) ? current.filter(item => item !== task) : [...current, task])} className="h-5 w-5 accent-[#C59B38]" /><span className={completed.includes(task) ? 'text-slate-400 line-through' : 'font-semibold'}>{task}</span></label>)}</div><form onSubmit={event => { event.preventDefault(); if (idea.trim()) { toast.success('Idea sent to your manager.'); setIdea(''); } }} className="rounded-2xl bg-white p-5 shadow-sm"><div className="flex items-center gap-2 font-black"><Lightbulb className="h-5 w-5 text-[#C59B38]" />Ideas box</div><textarea value={idea} onChange={event => setIdea(event.target.value)} placeholder="Share an idea for the team..." className="mt-3 min-h-24 w-full rounded-xl border border-slate-200 p-3 text-sm" /><button className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-[#12233F] py-3 font-black text-white"><Send className="h-4 w-4" />Send idea</button></form></section>}

        {view === 'requests' && <section className="space-y-4"><ScreenTitle title="Requests" note="Time off and shift changes" /><form onSubmit={submitSwap} className="rounded-2xl bg-white p-5 shadow-sm"><h3 className="font-black">Swap a shift</h3><select value={swapShiftId} onChange={event => setSwapShiftId(event.target.value)} className="mt-3 h-12 w-full rounded-xl border border-slate-200 px-3 text-sm"><option value="">Choose your shift</option>{upcoming.map(shift => <option key={shift.id} value={shift.id}>{shift.date} · {shift.start}–{shift.end}</option>)}</select><textarea value={swapNote} onChange={event => setSwapNote(event.target.value)} placeholder="Optional note" className="mt-3 min-h-20 w-full rounded-xl border border-slate-200 p-3 text-sm" /><button className="mt-2 w-full rounded-xl bg-[#12233F] py-3 font-black text-white">Send swap request</button></form><form onSubmit={submitTimeOff} className="rounded-2xl bg-white p-5 shadow-sm"><h3 className="font-black">Request time off</h3><div className="mt-3 grid grid-cols-2 gap-2"><input aria-label="First day" type="date" value={timeOffStart} onChange={event => setTimeOffStart(event.target.value)} className="h-12 min-w-0 rounded-xl border border-slate-200 px-2" /><input aria-label="Last day" type="date" value={timeOffEnd} onChange={event => setTimeOffEnd(event.target.value)} className="h-12 min-w-0 rounded-xl border border-slate-200 px-2" /></div><textarea value={timeOffReason} onChange={event => setTimeOffReason(event.target.value)} placeholder="Reason (optional)" className="mt-3 min-h-20 w-full rounded-xl border border-slate-200 p-3 text-sm" /><button className="mt-2 w-full rounded-xl bg-[#C59B38] py-3 font-black text-white">Send time-off request</button></form><p className="px-2 text-xs text-slate-500">{timeOffRequests.filter(item => item.employeeId === employee.id).length} time-off requests · {shiftSwapRequests.filter(item => item.requesterEmployeeId === employee.id).length} swap requests</p></section>}

        {view === 'profile' && <section className="space-y-4"><ScreenTitle title="Performance & social" note="Your progress and recognition" /><section className="rounded-2xl bg-white p-5 shadow-sm"><div className="flex items-center gap-4"><div className="grid h-16 w-16 place-items-center rounded-full bg-[#12233F] text-xl font-black text-white">{employee.name.split(' ').map(part => part[0]).join('').slice(0,2)}</div><div><h2 className="text-xl font-black">{employee.name}</h2><p className="text-sm text-slate-500">{employee.role}</p></div></div><div className="mt-5 grid grid-cols-3 gap-2"><Metric value="4.8" label="Rating" /><Metric value={`${ownShifts.length}`} label="Shifts" /><Metric value="96%" label="Tasks" /></div></section><section className="rounded-2xl bg-white p-5 shadow-sm"><div className="flex items-center gap-2 font-black"><Star className="h-5 w-5 text-[#C59B38]" />Team recognition</div>{['Great guest recovery during Friday service', 'Reliable opening checklist completion'].map(note => <div key={note} className="mt-3 rounded-xl bg-[#F5F1E5] p-3 text-sm">{note}</div>)}</section></section>}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-black/5 bg-white/95 p-2 backdrop-blur"><div className="mx-auto grid max-w-lg grid-cols-5">{([{ id:'home', label:'Home', icon:Home },{ id:'schedule', label:'Schedule', icon:CalendarDays },{ id:'tasks', label:'Tasks', icon:CheckCircle2 },{ id:'requests', label:'Requests', icon:Palmtree },{ id:'profile', label:'Me', icon:UserRound }] as const).map(item => <button key={item.id} onClick={() => setView(item.id)} className={`flex flex-col items-center gap-1 rounded-xl py-2 text-[9px] font-black ${view === item.id ? 'bg-[#F3E8C7] text-[#12233F]' : 'text-slate-400'}`}><item.icon className="h-5 w-5" />{item.label}</button>)}</div></nav>
    </div>
  );
}

function Quick({ icon: Icon, label, note, onClick }: { icon: typeof Home; label: string; note: string; onClick: () => void }) { return <button onClick={onClick} className="rounded-2xl bg-white p-4 text-left shadow-sm"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#F3E8C7]"><Icon className="h-5 w-5 text-[#9B7529]" /></span><p className="mt-3 font-black">{label}</p><p className="mt-1 text-[11px] text-slate-500">{note}</p></button>; }
function ScreenTitle({ title, note }: { title: string; note: string }) { return <div className="pt-1"><h2 className="text-2xl font-black">{title}</h2><p className="mt-1 text-sm text-slate-500">{note}</p></div>; }
function Metric({ value, label }: { value: string; label: string }) { return <div className="rounded-xl bg-[#F5F1E5] p-3 text-center"><p className="text-lg font-black">{value}</p><p className="text-[9px] font-black uppercase tracking-wider text-slate-500">{label}</p></div>; }
