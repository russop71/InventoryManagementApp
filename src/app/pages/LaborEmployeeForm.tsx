import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { ArrowLeft, CheckCircle2, Link2, RefreshCw, Save, Unplug } from 'lucide-react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { useLabor } from '../contexts/LaborContext';
import { useToast } from '../contexts/ToastContext';
import { getPosProvider } from '../data/posProviders';

const STANDARD_POSITIONS = ['General Manager', 'Assistant Manager', 'Shift Lead', 'Executive Chef', 'Kitchen Manager', 'Sous Chef', 'Line Cook', 'Prep Cook', 'Dishwasher', 'Server', 'Bartender', 'Host', 'Busser', 'Food Runner', 'Barback', 'Support'];
const DEPARTMENTS = ['Management', 'Front of house', 'Back of house', 'Bar', 'Support'];

export function LaborEmployeeForm() {
  const { employeeId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { employees, customPositions, isLaborLoaded, addEmployee, inviteEmployee, updateEmployee } = useLabor();
  const { isConnected: isPosConnected, provider: posProviderId, connectionMode, lastSync: posLastSync } = useToast();
  const posProvider = getPosProvider(posProviderId);
  const employee = employeeId ? employees.find(item => item.id === employeeId) : undefined;
  const isNew = !employeeId;
  const canManage = ['Owner', 'Admin', 'Manager', 'BOH Manager', 'FOH Manager'].includes(user?.role || '');
  const [isSaving, setIsSaving] = useState(false);
  const [sendEmployeeInvite, setSendEmployeeInvite] = useState(true);
  const [name, setName] = useState('');
  const [preferredName, setPreferredName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [alternatePhone, setAlternatePhone] = useState('');
  const [emergencyContactName, setEmergencyContactName] = useState('');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState('');
  const [clockInNumber, setClockInNumber] = useState('');
  const [posEmployeeId, setPosEmployeeId] = useState('');
  const [posPunchSyncEnabled, setPosPunchSyncEnabled] = useState(false);
  const [posMappingVerifiedAt, setPosMappingVerifiedAt] = useState('');
  const [role, setRole] = useState('Line Cook');
  const [department, setDepartment] = useState('Back of house');
  const [payType, setPayType] = useState<'hourly' | 'salary'>('hourly');
  const [hourlyRate, setHourlyRate] = useState('20');
  const [annualSalary, setAnnualSalary] = useState('65000');

  useEffect(() => {
    if (!employee) return;
    setName(employee.name);
    setPreferredName(employee.preferredName || '');
    setBirthDate(employee.birthDate || '');
    setEmail(employee.email || '');
    setPhone(employee.phone || '');
    setAlternatePhone(employee.alternatePhone || '');
    setEmergencyContactName(employee.emergencyContactName || '');
    setEmergencyContactPhone(employee.emergencyContactPhone || '');
    setClockInNumber(employee.clockInNumber || '');
    setPosEmployeeId(employee.posEmployeeId || '');
    setPosPunchSyncEnabled(employee.posPunchSyncEnabled === true);
    setPosMappingVerifiedAt(employee.posMappingVerifiedAt || '');
    setRole(employee.role);
    setDepartment(employee.department);
    setPayType(employee.payType);
    setHourlyRate(String(employee.hourlyRate || ''));
    setAnnualSalary(String(employee.annualSalary || ''));
  }, [employee]);

  const positionOptions = useMemo(() => Array.from(new Set([...STANDARD_POSITIONS, ...customPositions, ...employees.map(item => item.role), role].filter(Boolean))).sort(), [customPositions, employees, role]);

  if (!canManage) return <Navigate to="/employee" replace />;
  if (!isNew && isLaborLoaded && !employee) return <Navigate to="/app/labor" replace />;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return toast.error('Enter the employee name.');
    if (isNew && sendEmployeeInvite && !email.trim()) return toast.error('Enter a work email to send app access.');
    const duplicatePosMatch = posEmployeeId.trim() && employees.some(item => item.id !== employee?.id && item.posEmployeeId?.trim().toLowerCase() === posEmployeeId.trim().toLowerCase());
    if (duplicatePosMatch) return toast.error('That POS employee ID is already linked to another employee.');
    const details = {
      name: name.trim(), preferredName: preferredName.trim(), birthDate,
      email: email.trim().toLowerCase(), phone: phone.trim(), alternatePhone: alternatePhone.trim(),
      emergencyContactName: emergencyContactName.trim(), emergencyContactPhone: emergencyContactPhone.trim(),
      clockInNumber: clockInNumber.trim() || String(Date.now()).slice(-4), role: role.trim() || 'Team Member',
      posEmployeeId: posEmployeeId.trim(), posPunchSyncEnabled: Boolean(posEmployeeId.trim()) && posPunchSyncEnabled,
      posMappingVerifiedAt: posEmployeeId.trim() ? posMappingVerifiedAt || undefined : undefined,
      department: department.trim() || 'Restaurant team', payType,
      hourlyRate: payType === 'hourly' ? Number(hourlyRate) || 0 : 0,
      annualSalary: payType === 'salary' ? Number(annualSalary) || 0 : 0, active: true,
    };
    setIsSaving(true);
    try {
      if (employee) {
        updateEmployee(employee.id, details);
        toast.success('Employee profile saved.');
      } else if (sendEmployeeInvite) {
        const result = await inviteEmployee(details);
        if (result.welcomeEmailSent) toast.success('Employee added. Welcome email and ZestEmployee link sent.');
        else toast.warning('Employee added, but the welcome email could not be sent.');
      } else {
        addEmployee({ ...details, inviteStatus: 'not-invited' });
        toast.success('Employee profile added. App access can be sent later.');
      }
      navigate('/app/labor', { replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to save the employee.');
    } finally {
      setIsSaving(false);
    }
  };

  const verifyPosMapping = () => {
    if (!isPosConnected) return toast.error('Connect this location to a POS first.');
    if (!posEmployeeId.trim()) return toast.error('Enter the employee ID used in the POS.');
    if (employees.some(item => item.id !== employee?.id && item.posEmployeeId?.trim().toLowerCase() === posEmployeeId.trim().toLowerCase())) return toast.error('That POS employee ID is already linked to another employee.');
    setPosMappingVerifiedAt(new Date().toISOString());
    setPosPunchSyncEnabled(true);
    toast.success(`${name || 'Employee'} is ready to sync with ${posProvider.name}. Save changes to finish.`);
  };

  const clearPosMapping = () => {
    setPosEmployeeId('');
    setPosPunchSyncEnabled(false);
    setPosMappingVerifiedAt('');
  };

  return <div className="mx-auto max-w-5xl space-y-5 pb-10">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3"><button type="button" onClick={() => navigate('/app/labor')} className="grid h-11 w-11 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm" aria-label="Back to labour"><ArrowLeft className="h-5 w-5" /></button><div><p className="text-xs font-black uppercase tracking-[0.16em] text-[#B58B00]">Labour · Employees</p><h1 className="mt-1 text-2xl font-black text-slate-950 sm:text-3xl">{isNew ? 'Add employee' : 'Employee profile'}</h1><p className="mt-1 text-sm text-slate-500">{isNew ? 'Create the complete employee record before adding them to the schedule.' : 'Update personal, employment and compensation information.'}</p></div></div>
      <button type="submit" form="employee-form" disabled={isSaving} className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#F5D62E] px-5 text-sm font-black text-[#303A43] disabled:opacity-50"><Save className="h-4 w-4" />{isSaving ? 'Saving…' : isNew ? 'Save employee' : 'Save changes'}</button>
    </div>

    <form id="employee-form" onSubmit={submit} className="grid gap-5">
      <div className="space-y-5">
        {isNew && <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><label className="flex cursor-pointer items-start gap-3"><input type="checkbox" checked={sendEmployeeInvite} onChange={event => setSendEmployeeInvite(event.target.checked)} className="mt-1 h-4 w-4 accent-[#F5D62E]" /><span><span className="block text-sm font-black text-slate-900">Give ZestEmployee app access</span><span className="mt-1 block text-xs leading-5 text-slate-600">Send a secure activation email after this profile is saved. Turn this off for a scheduling-only employee.</span></span></label></section>}

        <FormSection title="Personal" description="Identity and contact information for managers."><div className="grid gap-4 sm:grid-cols-2"><Field label="Full legal name" value={name} onChange={setName} required placeholder="Employee name" /><Field label="Preferred name" value={preferredName} onChange={setPreferredName} placeholder="Name used on schedules" /><Field label="Date of birth" type="date" value={birthDate} onChange={setBirthDate} /><Field label={isNew && sendEmployeeInvite ? 'Work email' : 'Work email (optional)'} type="email" value={email} onChange={setEmail} required={isNew && sendEmployeeInvite} placeholder="employee@restaurant.ca" /><Field label="Primary phone" type="tel" value={phone} onChange={setPhone} placeholder="416-555-0123" /><Field label="Alternate phone" type="tel" value={alternatePhone} onChange={setAlternatePhone} /></div></FormSection>

        <FormSection title="Emergency contact" description="A manager-only contact for urgent situations."><div className="grid gap-4 sm:grid-cols-2"><Field label="Contact name" value={emergencyContactName} onChange={setEmergencyContactName} /><Field label="Contact phone" type="tel" value={emergencyContactPhone} onChange={setEmergencyContactPhone} /></div></FormSection>

        <FormSection title="Employment & access" description="Scheduling position, department and clock-in details."><div className="grid gap-4 sm:grid-cols-2"><Field label="Clock-in number" value={clockInNumber} onChange={setClockInNumber} placeholder="1006" /><SelectField label="Position" value={role} onChange={setRole} options={positionOptions} /><SelectField label="Department" value={department} onChange={setDepartment} options={DEPARTMENTS} /><SelectField label="Pay type" value={payType} onChange={value => setPayType(value as 'hourly' | 'salary')} options={['hourly', 'salary']} labels={{ hourly: 'Hourly', salary: 'Salaried' }} /></div>{employee && <div className="mt-4 rounded-xl bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">ZestEmployee access: <span className="font-black text-slate-900">{employee.inviteStatus.replace('-', ' ')}</span></div>}</FormSection>

        <FormSection title="POS time clock" description="Match this employee to the same person in your POS to bring clocked hours into ZestIQ.">
          {!isPosConnected ? <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-slate-500 shadow-sm"><Unplug className="h-4 w-4" /></span><div><p className="text-sm font-black text-slate-900">No POS connected</p><p className="mt-1 text-xs leading-5 text-slate-500">Connect a POS for this location before matching employee time-clock records.</p></div></div><button type="button" onClick={() => navigate('/app/integrations')} className="h-10 rounded-xl bg-[#303A43] px-4 text-xs font-black text-white">Open integrations</button></div> : <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#303A43] p-4 text-white"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#F5D62E] font-black text-[#303A43]">{posProvider.mark}</span><div><p className="text-sm font-black">{posProvider.name}</p><p className="mt-0.5 text-xs text-slate-300">{connectionMode === 'direct' ? 'Direct connection' : 'File import connection'}</p></div></div><span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-[#F5D62E]"><CheckCircle2 className="h-3.5 w-3.5" />Connected</span></div>
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto]"><Field label="POS employee ID" value={posEmployeeId} onChange={value => { setPosEmployeeId(value); if (value.trim() !== employee?.posEmployeeId) setPosMappingVerifiedAt(''); }} placeholder={`ID from ${posProvider.name}`} /><button type="button" onClick={verifyPosMapping} className="mt-[18px] inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#F5D62E] px-4 text-xs font-black text-[#303A43]"><Link2 className="h-4 w-4" />{posMappingVerifiedAt ? 'Recheck match' : 'Link employee'}</button></div>
            <p className="-mt-2 text-xs leading-5 text-slate-500">Use the employee identifier from {posProvider.name}, not their private clock-in PIN.</p>
            {posEmployeeId.trim() && <div className={`rounded-2xl border p-4 ${posMappingVerifiedAt ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}><div className="flex flex-wrap items-start justify-between gap-3"><div className="flex items-start gap-3">{posMappingVerifiedAt ? <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" /> : <RefreshCw className="mt-0.5 h-5 w-5 text-amber-600" />}<div><p className="text-sm font-black text-slate-900">{posMappingVerifiedAt ? 'Employee linked' : 'Match needs checking'}</p><p className="mt-1 text-xs leading-5 text-slate-600">{posMappingVerifiedAt ? `Clock punches for ${posEmployeeId.trim()} can be matched to this employee.` : 'Check the POS employee ID before enabling automatic imports.'}</p>{posMappingVerifiedAt && <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">Linked {new Date(posMappingVerifiedAt).toLocaleString('en-CA', { dateStyle: 'medium', timeStyle: 'short' })}{posLastSync ? ` · POS synced ${new Date(posLastSync).toLocaleString('en-CA', { dateStyle: 'medium', timeStyle: 'short' })}` : ''}</p>}</div></div><button type="button" onClick={clearPosMapping} className="text-xs font-black text-red-600">Remove match</button></div></div>}
            <label className={`flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 ${!posMappingVerifiedAt ? 'cursor-not-allowed opacity-55' : 'cursor-pointer'}`}><input type="checkbox" checked={posPunchSyncEnabled} onChange={event => setPosPunchSyncEnabled(event.target.checked)} disabled={!posMappingVerifiedAt} className="mt-0.5 h-4 w-4 accent-[#F5D62E]" /><span><span className="block text-sm font-black text-slate-900">Automatically sync time punches</span><span className="mt-1 block text-xs leading-5 text-slate-500">Import clock-ins, clock-outs and breaks when the connected POS makes workforce data available. Managers still review actual hours in ZestIQ.</span></span></label>
            {connectionMode !== 'direct' && <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">Automatic punches require direct POS access. The employee match will be saved now and become active when the direct connection is approved.</p>}
          </div>}
        </FormSection>

        <FormSection title="Compensation" description="Manager-only pay information used for labour forecasting.">{payType === 'salary' ? <Field label="Annual salary (CAD)" type="number" value={annualSalary} onChange={setAnnualSalary} /> : <Field label="Hourly rate (CAD)" type="number" value={hourlyRate} onChange={setHourlyRate} />}</FormSection>
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" onClick={() => navigate('/app/labor')} className="h-11 rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700">Cancel</button><button type="submit" disabled={isSaving} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#F5D62E] px-5 text-sm font-black text-[#303A43] disabled:opacity-50"><Save className="h-4 w-4" />{isSaving ? 'Saving…' : isNew ? 'Save employee' : 'Save changes'}</button></div>
    </form>
  </div>;
}

function FormSection({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-black text-slate-950">{title}</h2><p className="mt-1 text-sm text-slate-500">{description}</p><div className="mt-5">{children}</div></section>;
}

function Field({ label, value, onChange, type = 'text', placeholder, required = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; placeholder?: string; required?: boolean }) {
  return <label className="block"><span className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-slate-500">{label}{required && <span className="ml-1 text-red-500">*</span>}</span><input type={type} value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} required={required} min={type === 'number' ? 0 : undefined} step={type === 'number' ? '0.01' : undefined} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm shadow-sm outline-none transition focus:border-[#D6B900] focus:ring-2 focus:ring-[#F5D62E]/30" /></label>;
}

function SelectField({ label, value, onChange, options, labels = {} }: { label: string; value: string; onChange: (value: string) => void; options: string[]; labels?: Record<string, string> }) {
  return <label className="block"><span className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-slate-500">{label}</span><select value={value} onChange={event => onChange(event.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm shadow-sm outline-none transition focus:border-[#D6B900] focus:ring-2 focus:ring-[#F5D62E]/30">{options.map(option => <option key={option} value={option}>{labels[option] || option}</option>)}</select></label>;
}
