import { Fragment, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { ArrowLeftRight, CalendarDays, Check, ChevronLeft, ChevronRight, Clock3, CloudSun, Copy, DollarSign, Eye, EyeOff, FileText, Filter, Plus, Save, Search, SlidersHorizontal, Target, Trash2, UsersRound, X } from 'lucide-react';
import { Navigate } from 'react-router';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { useAuth } from '../contexts/AuthContext';
import { useInventory } from '../contexts/InventoryContext';
import { useLabor, type LaborEmployee, type LaborScheduleTemplate, type LaborShift } from '../contexts/LaborContext';
import { useToast } from '../contexts/ToastContext';

const SHIFT_TAGS = ['OPEN', 'CLOSE', 'ADMIN', 'TRAINING', 'ON-CALL', 'PREP', 'EXPO', 'BAR', 'HOST', 'DINNER'];

type ScheduleView = 'employees' | 'positions' | 'daily';
type LaborWorkspaceView = 'schedule' | 'requests' | 'team' | 'report';

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

function daysInRange(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T12:00:00`);
  const end = new Date(`${endDate}T12:00:00`);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end < start) return 0;
  return Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
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
  const { forecasts } = useInventory();
  const { employees, shifts, timeOffRequests, shiftSwapRequests, targetLaborPercent, scheduleTemplates, publishedPositions, openShifts, addEmployee, inviteEmployee, updateEmployee, removeEmployee, addShift, updateShift, removeShift, updateTimeOffRequest, updateShiftSwapRequest, setTargetLaborPercent, updateSchedulerSettings, scheduledHoursForRange, laborCostBreakdownForRange } = useLabor();
  const { salesData } = useToast();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [view, setView] = useState<LaborWorkspaceView>('schedule');
  const [reportStartDate, setReportStartDate] = useState(() => localDateKey(startOfWeek(new Date())));
  const [reportEndDate, setReportEndDate] = useState(() => localDateKey(new Date()));
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null);
  const [isInviting, setIsInviting] = useState(false);
  const [employeeName, setEmployeeName] = useState('');
  const [employeeEmail, setEmployeeEmail] = useState('');
  const [employeePhone, setEmployeePhone] = useState('');
  const [employeeAlternatePhone, setEmployeeAlternatePhone] = useState('');
  const [employeePreferredName, setEmployeePreferredName] = useState('');
  const [employeeBirthDate, setEmployeeBirthDate] = useState('');
  const [employeeEmergencyContactName, setEmployeeEmergencyContactName] = useState('');
  const [employeeEmergencyContactPhone, setEmployeeEmergencyContactPhone] = useState('');
  const [employeeClockInNumber, setEmployeeClockInNumber] = useState('');
  const [employeeRole, setEmployeeRole] = useState('Line Cook');
  const [employeeDepartment, setEmployeeDepartment] = useState('Back of house');
  const [employeePayType, setEmployeePayType] = useState<'hourly' | 'salary'>('hourly');
  const [employeeRate, setEmployeeRate] = useState('20');
  const [employeeSalary, setEmployeeSalary] = useState('65000');
  const [sendEmployeeInvite, setSendEmployeeInvite] = useState(true);
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
  const [scheduleView, setScheduleView] = useState<ScheduleView>('employees');
  const [focusDay, setFocusDay] = useState(() => Math.max(0, (new Date().getDay() + 6) % 7));
  const [showOptions, setShowOptions] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showCosts, setShowCosts] = useState(true);
  const [showWeather, setShowWeather] = useState(true);
  const [showOpenShifts, setShowOpenShifts] = useState(true);
  const [showAvailability, setShowAvailability] = useState(true);
  const [compactRows, setCompactRows] = useState(false);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [positionFilter, setPositionFilter] = useState('all');
  const [openShiftEditorOpen, setOpenShiftEditorOpen] = useState(false);
  const [openShiftDate, setOpenShiftDate] = useState(() => localDateKey(new Date()));
  const [openShiftRole, setOpenShiftRole] = useState('Support');
  const [openShiftStart, setOpenShiftStart] = useState('16:00');
  const [openShiftEnd, setOpenShiftEnd] = useState('22:00');
  const [openShiftTag, setOpenShiftTag] = useState('ON-CALL');
  const [openShiftBeingAssignedId, setOpenShiftBeingAssignedId] = useState<string | null>(null);
  const canManage = ['Owner', 'Admin', 'Manager', 'BOH Manager', 'FOH Manager'].includes(user?.role || '');

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
  const allActiveEmployees = employees.filter(employee => employee.active);
  const positions = useMemo(() => Array.from(new Set(employees.filter(employee => employee.active).map(employee => employee.role))).sort(), [employees]);
  const departments = useMemo(() => Array.from(new Set(employees.filter(employee => employee.active).map(employee => employee.department))).sort(), [employees]);
  const activeEmployees = allActiveEmployees
    .filter(employee => departmentFilter === 'all' || employee.department === departmentFilter)
    .filter(employee => positionFilter === 'all' || employee.role === positionFilter)
    .filter(employee => !employeeSearch.trim() || `${employee.name} ${employee.role} ${employee.department}`.toLowerCase().includes(employeeSearch.trim().toLowerCase()))
    .sort((left, right) => scheduleView === 'positions'
      ? left.role.localeCompare(right.role) || left.name.localeCompare(right.name)
      : left.department.localeCompare(right.department) || left.name.localeCompare(right.name));
  const visibleDays = scheduleView === 'daily' ? [days[focusDay]] : days;
  const salesForecastByDate = useMemo(() => {
    const historicalSales = salesData.filter(item => Number.isFinite(item.revenue) && item.revenue > 0);
    const averageCheck = historicalSales.reduce((sum, item) => sum + item.revenue, 0) / Math.max(1, historicalSales.reduce((sum, item) => sum + item.covers, 0));

    return new Map(days.map(day => {
      const key = localDateKey(day);
      const savedForecast = forecasts.find(item => item.date === key);
      const sameWeekdaySales = historicalSales
        .filter(item => new Date(`${item.date}T12:00:00`).getDay() === day.getDay())
        .slice(-8);
      const historicalRevenue = sameWeekdaySales.length
        ? sameWeekdaySales.reduce((sum, item) => sum + item.revenue, 0) / sameWeekdaySales.length
        : 0;
      const historicalCovers = sameWeekdaySales.length
        ? Math.round(sameWeekdaySales.reduce((sum, item) => sum + item.covers, 0) / sameWeekdaySales.length)
        : 0;
      const expectedRevenue = savedForecast ? Number(savedForecast.expectedCovers) : historicalRevenue;
      const expectedCovers = historicalCovers || (expectedRevenue > 0 && averageCheck > 0 ? Math.round(expectedRevenue / averageCheck) : 0);

      return [key, {
        expectedRevenue,
        expectedCovers,
        source: savedForecast ? 'Saved forecast' : sameWeekdaySales.length ? 'Historical sales' : 'No sales history',
        weatherSummary: savedForecast?.weatherSummary,
      }];
    }));
  }, [days, forecasts, salesData]);
  const reportRangeValid = reportStartDate <= reportEndDate;
  const reportDayCount = reportRangeValid ? daysInRange(reportStartDate, reportEndDate) : 0;
  const reportSales = reportRangeValid ? salesData.filter(day => day.date >= reportStartDate && day.date <= reportEndDate).reduce((sum, day) => sum + day.revenue, 0) : 0;
  const reportCovers = reportRangeValid ? salesData.filter(day => day.date >= reportStartDate && day.date <= reportEndDate).reduce((sum, day) => sum + day.covers, 0) : 0;
  const reportShifts = reportRangeValid ? shifts.filter(shift => shift.date >= reportStartDate && shift.date <= reportEndDate && shift.status !== 'called-off') : [];
  const reportCost = reportRangeValid ? laborCostBreakdownForRange(reportStartDate, reportEndDate) : { hourly: 0, salaried: 0, total: 0 };
  const reportHours = reportShifts.reduce((sum, shift) => sum + shiftHours(shift), 0);
  const reportActualHours = reportShifts.reduce((sum, shift) => sum + (typeof shift.actualMinutes === 'number' ? shift.actualMinutes / 60 : shiftHours(shift)), 0);
  const laborPercentOfSales = reportSales > 0 ? (reportCost.total / reportSales) * 100 : 0;
  const categoryReport = useMemo(() => {
    if (!reportRangeValid) return [] as Array<{ label: string; amount: number; hours: number; percent: number; scheduled: number; actual: number }>;
    const rows = new Map<string, { amount: number; scheduled: number; actual: number }>();
    const add = (label: string, amount: number, scheduled = 0, actual = scheduled) => {
      const row = rows.get(label) || { amount: 0, scheduled: 0, actual: 0 };
      row.amount += amount; row.scheduled += scheduled; row.actual += actual;
      rows.set(label, row);
    };
    reportShifts.forEach(shift => {
      const employee = employees.find(item => item.id === shift.employeeId);
      if (!employee || employee.payType === 'salary') return;
      const scheduled = shiftHours(shift);
      const actual = typeof shift.actualMinutes === 'number' ? shift.actualMinutes / 60 : scheduled;
      add(employee.department || 'Unassigned', scheduled * (Number(employee.hourlyRate) || 0), scheduled, actual);
    });
    employees.filter(employee => employee.active && employee.payType === 'salary').forEach(employee => {
      add(employee.department || 'Unassigned', ((Number(employee.annualSalary) || 0) / 365) * reportDayCount, 0, 0);
    });
    return Array.from(rows.entries()).map(([label, value]) => ({ label, amount: value.amount, hours: value.scheduled, percent: reportSales > 0 ? (value.amount / reportSales) * 100 : 0, scheduled: value.scheduled, actual: value.actual })).sort((left, right) => right.amount - left.amount);
  }, [employees, reportDayCount, reportRangeValid, reportSales, reportShifts]);
  const positionReport = useMemo(() => {
    if (!reportRangeValid) return [] as Array<{ label: string; amount: number; hours: number; percent: number; scheduled: number; actual: number }>;
    const rows = new Map<string, { amount: number; scheduled: number; actual: number }>();
    const add = (label: string, amount: number, scheduled = 0, actual = scheduled) => {
      const row = rows.get(label) || { amount: 0, scheduled: 0, actual: 0 };
      row.amount += amount; row.scheduled += scheduled; row.actual += actual;
      rows.set(label, row);
    };
    reportShifts.forEach(shift => {
      const employee = employees.find(item => item.id === shift.employeeId);
      if (!employee || employee.payType === 'salary') return;
      const scheduled = shiftHours(shift);
      const actual = typeof shift.actualMinutes === 'number' ? shift.actualMinutes / 60 : scheduled;
      add(employee.role || 'Unassigned', scheduled * (Number(employee.hourlyRate) || 0), scheduled, actual);
    });
    employees.filter(employee => employee.active && employee.payType === 'salary').forEach(employee => {
      add(employee.role || 'Unassigned', ((Number(employee.annualSalary) || 0) / 365) * reportDayCount, 0, 0);
    });
    return Array.from(rows.entries()).map(([label, value]) => ({ label, amount: value.amount, hours: value.scheduled, percent: reportSales > 0 ? (value.amount / reportSales) * 100 : 0, scheduled: value.scheduled, actual: value.actual })).sort((left, right) => right.amount - left.amount);
  }, [employees, reportDayCount, reportRangeValid, reportSales, reportShifts]);

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
    setSendEmployeeInvite(true);
  };

  const submitEmployee = async (event: FormEvent) => {
    event.preventDefault();
    if (!employeeName.trim()) return toast.error('Enter the employee name.');
    if (sendEmployeeInvite && !employeeEmail.trim()) return toast.error('Enter an email to send ZestEmployee access.');
    setIsInviting(true);
    try {
      const employee = {
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
      };
      if (sendEmployeeInvite) await inviteEmployee(employee);
      else addEmployee({ ...employee, inviteStatus: 'not-invited' });
      resetEmployeeForm();
      setInviteOpen(false);
      toast.success(sendEmployeeInvite ? 'Employee profile saved and ZestEmployee access is ready.' : 'Employee profile added. You can send app access later.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to add employee.');
    } finally {
      setIsInviting(false);
    }
  };

  const submitShift = (event: FormEvent) => {
    event.preventDefault();
    const employeeId = shiftEmployeeId || allActiveEmployees[0]?.id;
    if (!employeeId) return toast.error('Invite an employee first.');
    addShift({ employeeId, date: shiftDate, start: shiftStart, end: shiftEnd, breakMinutes: Number(shiftBreak) || 0, status: 'scheduled', tag: shiftTag.trim().toUpperCase(), notes: shiftNotes.trim() });
    if (openShiftBeingAssignedId) {
      updateSchedulerSettings({ openShifts: openShifts.filter(shift => shift.id !== openShiftBeingAssignedId) });
      setOpenShiftBeingAssignedId(null);
    }
    setShiftTag('');
    setShiftNotes('');
    setShiftEditorOpen(false);
    toast.success('Shift added to the schedule.');
  };

  const openEmployeeEditor = (employee: LaborEmployee) => {
    setEditingEmployeeId(employee.id); setEmployeeName(employee.name); setEmployeeEmail(employee.email || ''); setEmployeePhone(employee.phone || ''); setEmployeeAlternatePhone(employee.alternatePhone || ''); setEmployeePreferredName(employee.preferredName || ''); setEmployeeBirthDate(employee.birthDate || ''); setEmployeeEmergencyContactName(employee.emergencyContactName || ''); setEmployeeEmergencyContactPhone(employee.emergencyContactPhone || ''); setEmployeeClockInNumber(employee.clockInNumber || ''); setEmployeeRole(employee.role); setEmployeeDepartment(employee.department); setEmployeePayType(employee.payType); setEmployeeRate(String(employee.hourlyRate || '')); setEmployeeSalary(String(employee.annualSalary || ''));
  };
  const saveEmployeeChanges = (event: FormEvent) => {
    event.preventDefault();
    if (!editingEmployeeId || !employeeName.trim()) return;
    updateEmployee(editingEmployeeId, { name: employeeName.trim(), email: employeeEmail.trim().toLowerCase(), phone: employeePhone.trim(), alternatePhone: employeeAlternatePhone.trim(), preferredName: employeePreferredName.trim(), birthDate: employeeBirthDate, emergencyContactName: employeeEmergencyContactName.trim(), emergencyContactPhone: employeeEmergencyContactPhone.trim(), clockInNumber: employeeClockInNumber.trim(), role: employeeRole.trim() || 'Team Member', department: employeeDepartment.trim() || 'Restaurant team', payType: employeePayType, hourlyRate: employeePayType === 'hourly' ? Number(employeeRate) || 0 : 0, annualSalary: employeePayType === 'salary' ? Number(employeeSalary) || 0 : 0 });
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
    if (overlappingShift) toast.warning(`${targetEmployee.name} now has overlapping shifts.`);
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

  const saveWeekTemplate = () => {
    const weekShifts = shifts.filter(shift => shift.date >= startKey && shift.date <= endKey && shift.status !== 'called-off');
    if (weekShifts.length === 0) return toast.error('Add at least one shift before saving a template.');
    const name = window.prompt('Template name', `Week of ${days[0].toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}`)?.trim();
    if (!name) return;
    const template: LaborScheduleTemplate = {
      id: `template-${Date.now()}`,
      name,
      shifts: weekShifts.map(({ id: _id, date, ...shift }) => ({ ...shift, dayOffset: Math.round((new Date(`${date}T12:00:00`).getTime() - days[0].getTime()) / 86400000) })),
    };
    updateSchedulerSettings({ scheduleTemplates: [template, ...scheduleTemplates] });
    toast.success(`Saved “${name}” as a schedule template.`);
  };

  const applyTemplate = (template: LaborScheduleTemplate) => {
    template.shifts.forEach(({ dayOffset, ...shift }) => {
      const date = new Date(days[0]);
      date.setDate(date.getDate() + dayOffset);
      addShift({ ...shift, date: localDateKey(date), status: 'scheduled' });
    });
    toast.success(`Applied “${template.name}” to this week.`);
  };

  const publishWeek = () => {
    const allPositions = Array.from(new Set(activeEmployees.map(employee => employee.role)));
    const weekKeys = allPositions.map(position => `${startKey}::${position}`);
    const allPublished = weekKeys.every(key => publishedPositions.includes(key));
    updateSchedulerSettings({ publishedPositions: allPublished ? publishedPositions.filter(key => !weekKeys.includes(key)) : Array.from(new Set([...publishedPositions, ...weekKeys])) });
    toast.success(allPublished ? 'This week is back in draft.' : 'Schedule published to the team.');
  };

  const submitOpenShift = (event: FormEvent) => {
    event.preventDefault();
    if (!openShiftRole.trim()) return toast.error('Choose a position for the open shift.');
    updateSchedulerSettings({ openShifts: [...openShifts, { id: `open-shift-${Date.now()}`, date: openShiftDate, role: openShiftRole.trim(), start: openShiftStart, end: openShiftEnd, breakMinutes: 0, tag: openShiftTag.trim().toUpperCase() }] });
    setOpenShiftEditorOpen(false);
    toast.success('Open shift added for managers to assign.');
  };

  const assignOpenShift = (openShiftId: string) => {
    const openShift = openShifts.find(item => item.id === openShiftId);
    const matchingEmployees = employees.filter(employee => employee.active && employee.role === openShift?.role);
    if (!openShift || matchingEmployees.length === 0) return toast.error(`Add an active ${openShift?.role || 'matching'} employee before assigning this shift.`);
    setOpenShiftBeingAssignedId(openShift.id);
    setShiftEmployeeId(matchingEmployees[0].id);
    setShiftDate(openShift.date); setShiftStart(openShift.start); setShiftEnd(openShift.end);
    setShiftBreak(String(openShift.breakMinutes)); setShiftTag(openShift.tag || ''); setShiftNotes(openShift.notes || '');
    setShiftEditorOpen(true);
  };

  const allVisiblePublished = activeEmployees.length > 0 && Array.from(new Set(activeEmployees.map(employee => employee.role))).every(position => publishedPositions.includes(`${startKey}::${position}`));

  return (
    <div className="mx-auto max-w-[1500px] space-y-5">
      <section className="overflow-hidden rounded-2xl bg-[#0B1220] p-3 text-white sm:p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex min-w-0 flex-1 overflow-x-auto rounded-xl bg-white/10 p-1 sm:flex-none"><ViewButton label="Schedule" active={view === 'schedule'} onClick={() => setView('schedule')} /><ViewButton label="Requests" active={view === 'requests'} count={timeOffRequests.filter(request => request.status === 'pending').length + shiftSwapRequests.filter(request => request.status === 'pending').length} onClick={() => setView('requests')} /><ViewButton label="Employees" active={view === 'team'} onClick={() => setView('team')} /><ViewButton label="Reports" active={view === 'report'} onClick={() => setView('report')} /></div>
          <button type="button" onClick={() => setInviteOpen(true)} className="inline-flex items-center gap-1.5 rounded-xl bg-[#F5C10E] px-3 py-2.5 text-xs font-black text-[#0B1220]"><Plus className="h-3.5 w-3.5" />Add employee</button>
          <button type="button" onClick={() => setUseAmPm(current => !current)} className="rounded-xl border border-white/20 px-3 py-2.5 text-xs font-black text-white">{useAmPm ? '12-hour time' : '24-hour time'}</button>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <Metric icon={Clock3} label="Scheduled hours" value={`${weekHours.toFixed(1)}h`} />
        <Metric icon={DollarSign} label="Today's labour" value={formatMoney(todayCost.total)} />
        <Metric icon={DollarSign} label="Projected labour" value={formatMoney(weekCost.total)} />
        <Metric icon={DollarSign} label="Salaried labour" value={formatMoney(weekCost.salaried)} />
        <Metric icon={Target} label="Total vs sales" value={weekSales > 0 ? `${labourPercent.toFixed(1)}%` : formatMoney(weekCost.total)} tone={weekSales > 0 && labourPercent > targetLaborPercent ? 'warning' : 'normal'} />
        <Metric icon={UsersRound} label="Active team" value={String(allActiveEmployees.length)} />
      </section>

      {view === 'schedule' && (
        <div className="grid gap-5">
          <section className="min-w-0 overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
            <div className="border-b border-slate-100 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div><p className="font-black text-slate-900">{days[0].toLocaleDateString('en-CA', { month: 'long', day: 'numeric' })} – {days[6].toLocaleDateString('en-CA', { month: 'long', day: 'numeric' })}</p><p className="mt-1 text-xs font-bold text-slate-400">{allVisiblePublished ? 'Published to employees' : 'Draft schedule'}</p></div>
                <div className="flex gap-2"><button aria-label="Previous week" onClick={() => moveWeek(-7)} className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200"><ChevronLeft className="h-4 w-4" /></button><button onClick={() => setWeekStart(startOfWeek(new Date()))} className="rounded-xl border border-slate-200 px-3 text-sm font-bold">Today</button><button aria-label="Next week" onClick={() => moveWeek(7)} className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200"><ChevronRight className="h-4 w-4" /></button></div>
              </div>
              <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
                <label className="shrink-0"><span className="sr-only">Schedule view</span><select value={scheduleView} onChange={event => setScheduleView(event.target.value as ScheduleView)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black"><option value="employees">Employees</option><option value="positions">Positions</option><option value="daily">Daily</option></select></label>
                {scheduleView === 'daily' && <label className="shrink-0"><span className="sr-only">Day</span><select value={focusDay} onChange={event => setFocusDay(Number(event.target.value))} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black">{days.map((day, index) => <option key={localDateKey(day)} value={index}>{day.toLocaleDateString('en-CA', { weekday: 'long' })}</option>)}</select></label>}
                <ToolbarButton icon={SlidersHorizontal} label="Options" active={showOptions} onClick={() => setShowOptions(current => !current)} />
                <ToolbarButton icon={DollarSign} label="Costs" active={showCosts} onClick={() => setShowCosts(current => !current)} />
                <ToolbarButton icon={Filter} label="Filter" active={showFilters} onClick={() => setShowFilters(current => !current)} />
                <ToolbarButton icon={Save} label="Save template" onClick={saveWeekTemplate} />
                {scheduleTemplates.length > 0 && <label className="shrink-0"><span className="sr-only">Apply schedule template</span><select defaultValue="" onChange={event => { const template = scheduleTemplates.find(item => item.id === event.target.value); if (template) applyTemplate(template); event.target.value = ''; }} className="h-10 max-w-[190px] rounded-xl border border-slate-200 bg-white px-3 text-xs font-black"><option value="">Apply template…</option>{scheduleTemplates.map(template => <option key={template.id} value={template.id}>{template.name}</option>)}</select></label>}
                <button type="button" onClick={publishWeek} className={`ml-auto inline-flex h-10 shrink-0 items-center gap-2 rounded-xl px-4 text-xs font-black ${allVisiblePublished ? 'border border-slate-200 bg-white text-slate-700' : 'bg-[#0B1220] text-white'}`}>{allVisiblePublished ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}{allVisiblePublished ? 'Unpublish' : 'Publish week'}</button>
              </div>
              {showOptions && <div className="mt-3 grid gap-2 rounded-2xl bg-slate-50 p-3 sm:grid-cols-4"><OptionToggle label="Forecast" checked={showWeather} onChange={setShowWeather} /><OptionToggle label="Open shifts" checked={showOpenShifts} onChange={setShowOpenShifts} /><OptionToggle label="Availability" checked={showAvailability} onChange={setShowAvailability} /><OptionToggle label="Compact rows" checked={compactRows} onChange={setCompactRows} /></div>}
              {showFilters && <div className="mt-3 grid gap-2 rounded-2xl bg-slate-50 p-3 sm:grid-cols-3"><label className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><input value={employeeSearch} onChange={event => setEmployeeSearch(event.target.value)} placeholder="Search employee…" className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm" /></label><select value={departmentFilter} onChange={event => setDepartmentFilter(event.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"><option value="all">All departments</option>{departments.map(department => <option key={department} value={department}>{department}</option>)}</select><select value={positionFilter} onChange={event => setPositionFilter(event.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"><option value="all">All positions</option>{positions.map(position => <option key={position} value={position}>{position}</option>)}</select></div>}
            </div>
            <div className="overflow-x-auto">
              <table className={`w-full border-collapse text-left ${scheduleView === 'daily' ? 'min-w-[520px]' : 'min-w-[1180px]'}`}>
                <thead><tr className="bg-slate-50"><th className="sticky left-0 z-20 w-[210px] min-w-[210px] border-b border-r border-slate-200 bg-slate-50 p-3 text-[10px] font-black uppercase tracking-wider text-slate-500">{scheduleView === 'positions' ? 'Position / employee' : 'Employee'}</th>{visibleDays.map(day => { const dayKey = localDateKey(day); const dayCost = showCosts ? laborCostBreakdownForRange(dayKey, dayKey).total : 0; return <th key={dayKey} className="min-w-[138px] border-b border-r border-slate-200 p-3 last:border-r-0"><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{day.toLocaleDateString('en-CA', { weekday: 'short' })}</p><p className="mt-1 font-black text-slate-900">{day.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}</p>{showCosts && <p className="mt-1 text-[10px] font-black text-emerald-700">{formatMoney(dayCost)}</p>}</th>; })}</tr></thead>
                <tbody>
                  {showWeather && <tr className="bg-sky-50/60"><th className="sticky left-0 z-10 border-b border-r border-slate-200 bg-sky-50 p-3 text-xs font-black text-slate-700"><span className="inline-flex items-center gap-2"><CloudSun className="h-4 w-4 text-sky-600" />Forecast</span></th>{visibleDays.map(day => { const key = localDateKey(day); const forecast = salesForecastByDate.get(key); return <td key={key} className="border-b border-r border-slate-200 p-3 text-xs last:border-r-0"><p className="font-black text-slate-800">{forecast && forecast.expectedRevenue > 0 ? `${formatMoney(forecast.expectedRevenue)} expected sales` : 'No sales history yet'}</p><p className="mt-1 text-[10px] font-bold text-sky-700">{forecast && forecast.expectedCovers > 0 ? `${forecast.expectedCovers} expected covers · ${forecast.source}` : 'Import POS sales to build the forecast'}</p>{forecast?.weatherSummary && <p className="mt-1 text-[10px] font-medium text-slate-500">{forecast.weatherSummary}</p>}</td>; })}</tr>}
                  {showOpenShifts && <tr className="bg-amber-50/30"><th className="sticky left-0 z-10 border-b border-r border-slate-200 bg-amber-50 p-3 text-xs font-black text-slate-700">Open shifts</th>{visibleDays.map(day => { const key = localDateKey(day); const dayOpenShifts = openShifts.filter(item => item.date === key); return <td key={key} className="border-b border-r border-slate-200 p-2 align-top last:border-r-0"><div className="space-y-1">{dayOpenShifts.map(item => <button key={item.id} type="button" onClick={() => assignOpenShift(item.id)} className="block w-full rounded-lg border border-l-4 border-amber-200 border-l-orange-500 bg-white px-2 py-1.5 text-left text-[10px] text-slate-700" title="Click to assign"><span className="block font-black">{item.role}</span><span>{formatShiftTime(item.start, useAmPm)}–{formatShiftTime(item.end, useAmPm)}</span>{item.tag && <span className="mt-1 block text-[8px] font-black text-orange-700">{item.tag}</span>}</button>)}<button type="button" aria-label={`Add open shift on ${key}`} onClick={() => { setOpenShiftDate(key); setOpenShiftEditorOpen(true); }} className="grid h-7 w-full place-items-center rounded-lg border border-dashed border-amber-200 text-amber-500"><Plus className="h-3.5 w-3.5" /></button></div></td>; })}</tr>}
                  {activeEmployees.map((employee, employeeIndex) => {
                  const employeeWeekShifts = shifts.filter(shift => shift.employeeId === employee.id && shift.date >= startKey && shift.date <= endKey && shift.status !== 'called-off');
                  const employeeHours = employeeWeekShifts.reduce((sum, shift) => sum + shiftHours(shift), 0);
                  const showPositionHeader = scheduleView === 'positions' && (employeeIndex === 0 || activeEmployees[employeeIndex - 1]?.role !== employee.role);
                  return <Fragment key={employee.id}>{showPositionHeader && <tr className="bg-[#0B1220]"><th colSpan={visibleDays.length + 1} className="px-4 py-2 text-xs font-black text-white"><div className="flex items-center justify-between gap-3"><span>{employee.role}</span><button type="button" onClick={() => { const publishKey = `${startKey}::${employee.role}`; updateSchedulerSettings({ publishedPositions: publishedPositions.includes(publishKey) ? publishedPositions.filter(key => key !== publishKey) : [...publishedPositions, publishKey] }); }} className="rounded-lg bg-white/10 px-2.5 py-1 text-[10px] font-black text-[#F5C10E]">{publishedPositions.includes(`${startKey}::${employee.role}`) ? 'Unpublish position' : 'Publish position'}</button></div></th></tr>}<tr className="align-top"><th className="sticky left-0 z-10 border-b border-r border-slate-200 bg-white p-3"><div className="flex items-start gap-2"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#FEF3C7] text-xs font-black text-[#0B1220]">{employee.name.split(' ').map(part => part[0]).slice(0, 2).join('')}</div><div className="min-w-0"><div className="flex flex-wrap items-center gap-1.5"><p className="break-words text-sm font-black text-slate-900">{employee.name}</p>{publishedPositions.includes(`${startKey}::${employee.role}`) && <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[8px] font-black text-emerald-700">PUBLISHED</span>}</div><p className="mt-0.5 break-words text-[10px] font-bold text-slate-500">{employee.role}</p><p className="mt-1 text-[10px] text-slate-400">{employeeWeekShifts.length} shifts · {employeeHours.toFixed(1)}h</p>{employee.payType === 'salary' && <span className="mt-1 inline-flex rounded-full bg-[#0B1220] px-2 py-0.5 text-[9px] font-black text-[#F5C10E]">SALARIED</span>}</div></div></th>{visibleDays.map(day => {
                    const key = localDateKey(day);
                    const dayShifts = employeeWeekShifts.filter(shift => shift.date === key);
                    const unavailable = showAvailability && timeOffRequests.some(request => request.employeeId === employee.id && request.status === 'approved' && key >= request.startDate && key <= request.endDate);
                    const isCopyTarget = copiedShiftId && employees.find(item => item.id === shifts.find(item => item.id === copiedShiftId)?.employeeId)?.role === employee.role;
                    return <td key={key} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); placeShift(employee.id, key); }} onClick={() => copiedShiftId && placeShift(employee.id, key)} className={`${compactRows ? 'h-[88px]' : 'h-[116px]'} border-b border-r border-slate-200 p-2 last:border-r-0 ${isCopyTarget ? 'cursor-copy bg-amber-50/70' : unavailable ? 'bg-red-50/70' : ''}`}><div className="space-y-2">{unavailable && <div className="rounded-lg bg-red-100 px-2 py-1 text-[9px] font-black uppercase text-red-700">Unavailable</div>}{dayShifts.map(shift => <div key={shift.id} draggable onDragStart={() => setDraggedShiftId(shift.id)} onDragEnd={() => setDraggedShiftId(null)} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); event.stopPropagation(); placeShift(employee.id, key); }} className={`group cursor-grab rounded-xl border border-l-4 p-2 shadow-sm active:cursor-grabbing ${shiftAccentClass(shift.tag)} ${isNightShift(shift) ? 'bg-slate-100' : 'bg-white'}`}><div className="flex items-start justify-between gap-1"><p className="text-[11px] font-black text-slate-900">{formatShiftTime(shift.start, useAmPm)}–{formatShiftTime(shift.end, useAmPm)}</p><div className="flex items-center gap-1"><button aria-label={`Copy ${employee.name} shift`} onClick={event => { event.stopPropagation(); setCopiedShiftId(shift.id); setDraggedShiftId(null); toast.message('Select a matching-position schedule cell to copy this shift.'); }} className="text-slate-400 opacity-100 sm:opacity-0 sm:group-hover:opacity-100"><Copy className="h-3 w-3" /></button><button aria-label={`Delete ${employee.name} shift`} onClick={event => { event.stopPropagation(); removeShift(shift.id); }} className="text-red-400 opacity-100 sm:opacity-0 sm:group-hover:opacity-100"><X className="h-3 w-3" /></button></div></div>{shift.tag && <span className={`mt-1 inline-flex rounded-md border px-1.5 py-0.5 text-[8px] font-black tracking-wide ${tagClass(shift.tag)}`}>{shift.tag}</span>}{shift.notes && <p className="mt-1 line-clamp-2 text-[9px] leading-4 text-slate-500">{shift.notes}</p>}</div>)}<button type="button" aria-label={`Add shift for ${employee.name} on ${key}`} onClick={event => { event.stopPropagation(); openShiftEditor(employee.id, key); }} className="grid h-8 w-full place-items-center rounded-lg border border-dashed border-slate-200 text-slate-400 hover:border-[#F5C10E] hover:bg-amber-50 hover:text-[#B58B00]"><Plus className="h-4 w-4" /></button></div></td>;
                  })}</tr></Fragment>;
                })}{activeEmployees.length === 0 && <tr><td colSpan={visibleDays.length + 1} className="p-10 text-center text-sm text-slate-500">No employees match these filters.</td></tr>}</tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {view === 'requests' && <div className="grid gap-5 lg:grid-cols-2"><RequestQueue title="Time-off requests" empty="No time-off requests." icon={CalendarDays}>{timeOffRequests.map(request => { const employee = employees.find(item => item.id === request.employeeId); return <ManagerRequest key={request.id} title={employee?.name || 'Team member'} detail={`${request.startDate} → ${request.endDate}${request.reason ? ` · ${request.reason}` : ''}`} status={request.status} onApprove={() => updateTimeOffRequest(request.id, 'approved')} onDecline={() => updateTimeOffRequest(request.id, 'declined')} />; })}</RequestQueue><RequestQueue title="Shift-swap requests" empty="No shift-swap requests." icon={ArrowLeftRight}>{shiftSwapRequests.map(request => { const employee = employees.find(item => item.id === request.requesterEmployeeId); const target = employees.find(item => item.id === request.targetEmployeeId); const shift = shifts.find(item => item.id === request.shiftId); return <ManagerRequest key={request.id} title={`${employee?.name || 'Team member'}${target ? ` → ${target.name}` : ''}`} detail={`${shift?.date || 'Shift'} · ${shift?.start || ''}–${shift?.end || ''}${request.note ? ` · ${request.note}` : ''}`} status={request.status} onApprove={() => updateShiftSwapRequest(request.id, 'approved')} onDecline={() => updateShiftSwapRequest(request.id, 'declined')} />; })}</RequestQueue></div>}

      {view === 'team' && <section className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5"><h2 className="font-black text-slate-900">Employees</h2><button type="button" onClick={() => setInviteOpen(true)} className="inline-flex items-center gap-2 rounded-xl bg-[#0B1220] px-4 py-3 text-sm font-black text-white"><Plus className="h-4 w-4 text-[#F5C10E]" />Add employee</button></div><div className="divide-y divide-slate-100">{employees.map(employee => <EmployeeRow key={employee.id} employee={employee} onOpen={() => openEmployeeEditor(employee)} onRemove={() => { if (window.confirm(`Remove ${employee.name} and all of their shifts from this location?`)) removeEmployee(employee.id); }} />)}{employees.length === 0 && <div className="p-10 text-center text-sm text-slate-500">Add your first employee to create the employee list.</div>}</div></section>}

      {view === 'report' && <section className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex items-center gap-2"><FileText className="h-5 w-5 text-[#B58B00]" /><h2 className="font-black text-slate-900">Labour report</h2></div><p className="mt-1 text-sm text-slate-500">Accounting-ready labour costs, hours and percentage of sales for the selected date range.</p></div><div className="grid grid-cols-2 gap-2"><label className="text-[10px] font-black uppercase tracking-wider text-slate-500">From<input aria-label="Report start date" type="date" value={reportStartDate} onChange={event => setReportStartDate(event.target.value)} className="mt-1 block h-10 rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-900" /></label><label className="text-[10px] font-black uppercase tracking-wider text-slate-500">To<input aria-label="Report end date" type="date" value={reportEndDate} onChange={event => setReportEndDate(event.target.value)} className="mt-1 block h-10 rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-900" /></label></div></div></div>
        {!reportRangeValid ? <p className="p-8 text-center text-sm font-bold text-red-600">Choose an end date that is on or after the start date.</p> : <div className="space-y-6 p-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><ReportMetric label="Sales" value={formatMoney(reportSales)} detail={`${reportCovers.toLocaleString('en-CA')} covers`} /><ReportMetric label="Total labour" value={formatMoney(reportCost.total)} detail={`${reportDayCount} days selected`} /><ReportMetric label="Labour %" value={reportSales > 0 ? `${laborPercentOfSales.toFixed(1)}%` : '—'} detail={reportSales > 0 ? `Target ${targetLaborPercent}%` : 'Import sales to calculate'} warning={reportSales > 0 && laborPercentOfSales > targetLaborPercent} /><ReportMetric label="Scheduled hours" value={`${reportHours.toFixed(1)}h`} detail={`${reportShifts.length} shifts`} /><ReportMetric label="Actual hours" value={`${reportActualHours.toFixed(1)}h`} detail="Uses clocked time when available" /></div>
          <div className="grid gap-4 lg:grid-cols-2"><ReportTable title="By department" rows={categoryReport} salesAvailable={reportSales > 0} /><ReportTable title="By position" rows={positionReport} salesAvailable={reportSales > 0} /></div>
          <div className="grid gap-3 rounded-2xl bg-slate-50 p-4 sm:grid-cols-3"><ReportMetric label="Hourly labour" value={formatMoney(reportCost.hourly)} detail={reportCost.total > 0 ? `${((reportCost.hourly / reportCost.total) * 100).toFixed(1)}% of labour` : 'No hourly cost'} /><ReportMetric label="Salaried labour" value={formatMoney(reportCost.salaried)} detail={reportCost.total > 0 ? `${((reportCost.salaried / reportCost.total) * 100).toFixed(1)}% of labour` : 'No salary cost'} /><ReportMetric label="Cost per cover" value={reportCovers > 0 ? formatMoney(reportCost.total / reportCovers, 2) : '—'} detail={reportCovers > 0 ? 'Total labour ÷ covers' : 'Import sales to calculate'} /></div>
          <p className="text-xs leading-5 text-slate-500">Hourly amounts are calculated from scheduled shifts and hourly pay rates. Salaried labour is prorated daily across active salaried employees. Actual hours use clocked time when it has been recorded; otherwise scheduled hours are shown.</p>
        </div>}
      </section>}

      <section className="flex flex-col gap-3 rounded-3xl border border-amber-100 bg-amber-50 p-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-black text-amber-950">Target labour percentage</p><p className="mt-1 text-sm text-amber-800">Hourly scheduled labour plus prorated active salaries are measured against sales.</p></div><label className="flex items-center gap-2 font-black text-amber-950"><input aria-label="Target labour percentage" type="number" min="0" max="100" step="0.5" value={targetLaborPercent} onChange={event => setTargetLaborPercent(Number(event.target.value) || 0)} className="h-11 w-24 rounded-xl border border-amber-200 bg-white px-3 text-right" />%</label></section>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}><DialogContent className="max-h-[calc(100vh-2rem)] max-w-[calc(100vw-2rem)] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>Add employee</DialogTitle><DialogDescription>Create an employee profile for schedules, pay and clock-in. App access is optional and can be sent now or later.</DialogDescription></DialogHeader><form onSubmit={submitEmployee} className="space-y-4"><div className="rounded-xl border border-amber-200 bg-amber-50 p-3"><label className="flex cursor-pointer items-start gap-3"><input type="checkbox" checked={sendEmployeeInvite} onChange={event => setSendEmployeeInvite(event.target.checked)} className="mt-1 h-4 w-4 accent-[#F5C10E]" /><span><span className="block text-sm font-black text-slate-900">Give ZestEmployee app access</span><span className="mt-0.5 block text-xs leading-5 text-slate-600">When selected, the employee receives a secure email to activate their account. Leave this off for a scheduling-only employee.</span></span></label></div><div className="grid gap-3 sm:grid-cols-2"><FormInput label="Full name" value={employeeName} onChange={setEmployeeName} placeholder="Employee name" required /><FormInput label={sendEmployeeInvite ? "Work email" : "Work email (optional)"} type="email" value={employeeEmail} onChange={setEmployeeEmail} placeholder="employee@restaurant.ca" required={sendEmployeeInvite} /><FormInput label="Phone" type="tel" value={employeePhone} onChange={setEmployeePhone} placeholder="416-555-0123" /><FormInput label="Clock-in number" value={employeeClockInNumber} onChange={setEmployeeClockInNumber} placeholder="1006" /><FormInput label="Position" value={employeeRole} onChange={setEmployeeRole} placeholder="General Manager" /><FormSelect label="Department" value={employeeDepartment} onChange={setEmployeeDepartment} options={['Management', 'Front of house', 'Back of house', 'Bar', 'Support'].map(value => ({ value, label: value }))} /><FormSelect label="Pay type" value={employeePayType} onChange={value => setEmployeePayType(value as 'hourly' | 'salary')} options={[{ value: 'hourly', label: 'Hourly' }, { value: 'salary', label: 'Salaried' }]} /></div>{employeePayType === 'salary' ? <FormInput label="Annual salary (CAD)" type="number" value={employeeSalary} onChange={setEmployeeSalary} /> : <FormInput label="Hourly rate (CAD)" type="number" value={employeeRate} onChange={setEmployeeRate} />}<div className="flex justify-end gap-2 pt-2"><button type="button" onClick={() => setInviteOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2.5 font-bold text-slate-700">Cancel</button><button type="submit" disabled={isInviting} className="rounded-xl bg-[#F5C10E] px-4 py-2.5 font-black text-[#0B1220] disabled:opacity-50">{isInviting ? 'Saving…' : sendEmployeeInvite ? 'Save & send app access' : 'Add employee'}</button></div></form></DialogContent></Dialog>
      <Dialog open={Boolean(editingEmployeeId)} onOpenChange={open => { if (!open) setEditingEmployeeId(null); }}><DialogContent className="max-h-[calc(100vh-2rem)] max-w-[calc(100vw-2rem)] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Employee profile</DialogTitle><DialogDescription>Manager-only personnel information. This is not shown in ZestEmployee.</DialogDescription></DialogHeader><form onSubmit={saveEmployeeChanges} className="space-y-5"><div className="flex items-center gap-3 rounded-2xl bg-[#0B1220] p-4 text-white"><div className="grid h-14 w-14 place-items-center rounded-2xl bg-[#F5C10E] text-lg font-black text-[#0B1220]">{employeeName.split(' ').map(part => part[0]).slice(0, 2).join('') || 'EM'}</div><div><p className="font-black">{employeePreferredName || employeeName || 'Employee'}</p><p className="mt-1 text-sm text-slate-300">{employeeRole || 'Team member'} · {employeeDepartment || 'Restaurant team'}</p></div></div><section className="rounded-2xl border border-slate-200 p-4"><h3 className="font-black text-slate-900">Personal</h3><p className="mt-1 text-xs text-slate-500">Identity and contact details for managers.</p><div className="mt-4 grid gap-3 sm:grid-cols-2"><FormInput label="Full legal name" value={employeeName} onChange={setEmployeeName} required /><FormInput label="Preferred name" value={employeePreferredName} onChange={setEmployeePreferredName} placeholder="Name used on schedules" /><FormInput label="Date of birth" type="date" value={employeeBirthDate} onChange={setEmployeeBirthDate} /><FormInput label="Work email" type="email" value={employeeEmail} onChange={setEmployeeEmail} /></div></section><section className="rounded-2xl border border-slate-200 p-4"><h3 className="font-black text-slate-900">Contact & emergency contact</h3><div className="mt-4 grid gap-3 sm:grid-cols-2"><FormInput label="Primary phone" type="tel" value={employeePhone} onChange={setEmployeePhone} /><FormInput label="Alternate phone" type="tel" value={employeeAlternatePhone} onChange={setEmployeeAlternatePhone} /><FormInput label="Emergency contact name" value={employeeEmergencyContactName} onChange={setEmployeeEmergencyContactName} /><FormInput label="Emergency contact phone" type="tel" value={employeeEmergencyContactPhone} onChange={setEmployeeEmergencyContactPhone} /></div></section><section className="rounded-2xl border border-slate-200 p-4"><h3 className="font-black text-slate-900">Employment & access</h3><div className="mt-4 grid gap-3 sm:grid-cols-2"><FormInput label="Clock-in number" value={employeeClockInNumber} onChange={setEmployeeClockInNumber} /><FormInput label="Position" value={employeeRole} onChange={setEmployeeRole} /><FormSelect label="Department" value={employeeDepartment} onChange={setEmployeeDepartment} options={['Management', 'Front of house', 'Back of house', 'Bar', 'Support'].map(value => ({ value, label: value }))} /><FormSelect label="Pay type" value={employeePayType} onChange={value => setEmployeePayType(value as 'hourly' | 'salary')} options={[{ value: 'hourly', label: 'Hourly' }, { value: 'salary', label: 'Salaried' }]} /></div><div className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">ZestEmployee access: <span className="font-black text-slate-900">{employees.find(employee => employee.id === editingEmployeeId)?.inviteStatus.replace('-', ' ') || 'not invited'}</span></div></section><section className="rounded-2xl border border-slate-200 p-4"><h3 className="font-black text-slate-900">Compensation</h3><div className="mt-4">{employeePayType === 'salary' ? <FormInput label="Annual salary (CAD)" type="number" value={employeeSalary} onChange={setEmployeeSalary} /> : <FormInput label="Hourly rate (CAD)" type="number" value={employeeRate} onChange={setEmployeeRate} />}</div></section><div className="flex justify-end gap-2 pt-1"><button type="button" onClick={() => setEditingEmployeeId(null)} className="rounded-xl border border-slate-200 px-4 py-2.5 font-bold text-slate-700">Cancel</button><button type="submit" className="rounded-xl bg-[#F5C10E] px-4 py-2.5 font-black text-[#0B1220]">Save employee profile</button></div></form></DialogContent></Dialog>
      <Dialog open={shiftEditorOpen} onOpenChange={open => { setShiftEditorOpen(open); if (!open) setOpenShiftBeingAssignedId(null); }}><DialogContent className="max-h-[calc(100vh-2rem)] max-w-[calc(100vw-2rem)] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>{openShiftBeingAssignedId ? 'Assign open shift' : 'Add a shift'}</DialogTitle><DialogDescription>Choose the time, tag and any handoff notes for this employee.</DialogDescription></DialogHeader><form onSubmit={submitShift} className="space-y-4"><FormSelect label="Employee" value={shiftEmployeeId || activeEmployees[0]?.id || ''} onChange={setShiftEmployeeId} options={activeEmployees.map(employee => ({ value: employee.id, label: `${employee.name} · ${employee.role}` }))} /><FormInput label="Date" type="date" value={shiftDate} onChange={setShiftDate} /><div className="grid grid-cols-2 gap-3"><FormInput label="Starts" type="time" value={shiftStart} onChange={setShiftStart} /><FormInput label="Ends" type="time" value={shiftEnd} onChange={setShiftEnd} /></div><FormInput label="Unpaid break (min)" type="number" value={shiftBreak} onChange={setShiftBreak} /><FormInput label="Shift tag" value={shiftTag} onChange={setShiftTag} placeholder="CLOSE, EXPO, TRAINING…" list="shift-tags" /><datalist id="shift-tags">{SHIFT_TAGS.map(tag => <option key={tag} value={tag} />)}</datalist><FormInput label="Shift notes" value={shiftNotes} onChange={setShiftNotes} placeholder="Section, training or handoff note" /><div className="flex justify-end gap-2 pt-2"><button type="button" onClick={() => { setShiftEditorOpen(false); setOpenShiftBeingAssignedId(null); }} className="rounded-xl border border-slate-200 px-4 py-3 font-bold text-slate-700">Cancel</button><button type="submit" className="rounded-xl bg-[#F5C10E] px-4 py-3 font-black text-[#0B1220]">{openShiftBeingAssignedId ? 'Assign shift' : 'Add tagged shift'}</button></div></form></DialogContent></Dialog>
      <Dialog open={openShiftEditorOpen} onOpenChange={setOpenShiftEditorOpen}><DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md"><DialogHeader><DialogTitle>Add an open shift</DialogTitle><DialogDescription>Create an unassigned house shift that a manager can fill later.</DialogDescription></DialogHeader><form onSubmit={submitOpenShift} className="space-y-4"><FormSelect label="Position" value={openShiftRole} onChange={setOpenShiftRole} options={(positions.length > 0 ? positions : ['Support']).map(position => ({ value: position, label: position }))} /><FormInput label="Date" type="date" value={openShiftDate} onChange={setOpenShiftDate} /><div className="grid grid-cols-2 gap-3"><FormInput label="Starts" type="time" value={openShiftStart} onChange={setOpenShiftStart} /><FormInput label="Ends" type="time" value={openShiftEnd} onChange={setOpenShiftEnd} /></div><FormInput label="Shift tag" value={openShiftTag} onChange={setOpenShiftTag} list="shift-tags" /><div className="flex justify-end gap-2"><button type="button" onClick={() => setOpenShiftEditorOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2.5 font-bold">Cancel</button><button type="submit" className="rounded-xl bg-[#F5C10E] px-4 py-2.5 font-black text-[#0B1220]">Add open shift</button></div></form></DialogContent></Dialog>
    </div>
  );
}

function ToolbarButton({ icon: Icon, label, active = false, onClick }: { icon: typeof CalendarDays; label: string; active?: boolean; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border px-3 text-xs font-black ${active ? 'border-[#F5C10E] bg-amber-50 text-[#7A5D00]' : 'border-slate-200 bg-white text-slate-700'}`}><Icon className="h-4 w-4" />{label}</button>;
}

function OptionToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700"><span>{label}</span><input type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} className="h-4 w-4 accent-[#F5C10E]" /></label>;
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

function ReportMetric({ label, value, detail, warning = false }: { label: string; value: string; detail: string; warning?: boolean }) {
  return <div className={`rounded-2xl border p-4 ${warning ? 'border-red-100 bg-red-50' : 'border-slate-100 bg-white'}`}><p className="text-[10px] font-black uppercase tracking-wider text-slate-500">{label}</p><p className={`mt-2 text-2xl font-black tabular-nums ${warning ? 'text-red-700' : 'text-slate-900'}`}>{value}</p><p className="mt-1 text-xs font-semibold text-slate-500">{detail}</p></div>;
}

function ReportTable({ title, rows, salesAvailable }: { title: string; rows: Array<{ label: string; amount: number; hours: number; percent: number; scheduled: number; actual: number }>; salesAvailable: boolean }) {
  return <section className="overflow-hidden rounded-2xl border border-slate-100"><div className="border-b border-slate-100 bg-slate-50 px-4 py-3"><h3 className="font-black text-slate-900">{title}</h3></div><div className="overflow-x-auto"><table className="w-full min-w-[520px] text-left text-sm"><thead className="border-b border-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-500"><tr><th className="px-4 py-3">Category</th><th className="px-4 py-3 text-right">Scheduled</th><th className="px-4 py-3 text-right">Actual</th><th className="px-4 py-3 text-right">Labour cost</th><th className="px-4 py-3 text-right">Labour %</th></tr></thead><tbody className="divide-y divide-slate-100">{rows.map(row => <tr key={row.label}><td className="px-4 py-3 font-bold text-slate-900">{row.label}</td><td className="px-4 py-3 text-right tabular-nums text-slate-600">{row.scheduled.toFixed(1)}h</td><td className="px-4 py-3 text-right tabular-nums text-slate-600">{row.actual.toFixed(1)}h</td><td className="px-4 py-3 text-right font-black tabular-nums text-slate-900">{formatMoney(row.amount)}</td><td className="px-4 py-3 text-right font-black tabular-nums text-slate-900">{salesAvailable ? `${row.percent.toFixed(1)}%` : '—'}</td></tr>)}{rows.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">No labour has been recorded for this period.</td></tr>}</tbody></table></div></section>;
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
