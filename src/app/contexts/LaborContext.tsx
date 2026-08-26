import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { apiRequest } from '../utils/api';
import { calculateLaborCostBreakdown } from '../utils/labor.js';
import { locationScopedStorageKey, readScopedJson } from '../utils/storageScope';

export interface LaborEmployee {
  id: string;
  name: string;
  role: string;
  department: string;
  phone?: string;
  clockInNumber?: string;
  payType: 'hourly' | 'salary';
  hourlyRate: number;
  annualSalary: number;
  active: boolean;
  email?: string;
  inviteStatus: 'not-invited' | 'pending' | 'active';
  invitedAt?: string;
}

export interface LaborShift {
  id: string;
  employeeId: string;
  date: string;
  start: string;
  end: string;
  breakMinutes: number;
  actualMinutes?: number;
  status: 'scheduled' | 'confirmed' | 'completed' | 'called-off';
  tag?: string;
  notes?: string;
}

export interface LaborScheduleTemplate {
  id: string;
  name: string;
  shifts: Array<Omit<LaborShift, 'id' | 'date'> & { dayOffset: number }>;
}

export interface LaborScheduleEvent {
  id: string;
  date: string;
  name: string;
  time: string;
}

export interface LaborOpenShift {
  id: string;
  date: string;
  role: string;
  start: string;
  end: string;
  breakMinutes: number;
  tag?: string;
  notes?: string;
}

export interface LaborData {
  employees: LaborEmployee[];
  shifts: LaborShift[];
  timeOffRequests: TimeOffRequest[];
  shiftSwapRequests: ShiftSwapRequest[];
  targetLaborPercent: number;
  scheduleTemplates: LaborScheduleTemplate[];
  scheduleEvents: LaborScheduleEvent[];
  publishedPositions: string[];
  openShifts: LaborOpenShift[];
}

export interface TimeOffRequest {
  id: string;
  employeeId: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: 'pending' | 'approved' | 'declined' | 'cancelled';
  createdAt: string;
}

export interface ShiftSwapRequest {
  id: string;
  shiftId: string;
  requesterEmployeeId: string;
  targetEmployeeId?: string;
  note: string;
  status: 'pending' | 'accepted' | 'approved' | 'declined' | 'cancelled';
  createdAt: string;
}

interface LaborContextValue extends LaborData {
  isLaborLoaded: boolean;
  addEmployee: (employee: Omit<LaborEmployee, 'id'>) => void;
  inviteEmployee: (employee: Omit<LaborEmployee, 'id' | 'inviteStatus' | 'invitedAt'>) => Promise<LaborEmployee>;
  updateEmployee: (id: string, updates: Partial<LaborEmployee>) => void;
  removeEmployee: (id: string) => void;
  addShift: (shift: Omit<LaborShift, 'id'>) => void;
  updateShift: (id: string, updates: Partial<LaborShift>) => void;
  removeShift: (id: string) => void;
  requestTimeOff: (request: Omit<TimeOffRequest, 'id' | 'status' | 'createdAt'>) => void;
  updateTimeOffRequest: (id: string, status: TimeOffRequest['status']) => void;
  requestShiftSwap: (request: Omit<ShiftSwapRequest, 'id' | 'status' | 'createdAt'>) => void;
  updateShiftSwapRequest: (id: string, status: ShiftSwapRequest['status']) => void;
  setTargetLaborPercent: (value: number) => void;
  updateSchedulerSettings: (updates: Partial<Pick<LaborData, 'scheduleTemplates' | 'scheduleEvents' | 'publishedPositions' | 'openShifts'>>) => void;
  scheduledCostForRange: (startDate: string, endDate: string) => number;
  scheduledHoursForRange: (startDate: string, endDate: string) => number;
  laborCostBreakdownForRange: (startDate: string, endDate: string) => { hourly: number; salaried: number; total: number };
}

const EMPTY_LABOR: LaborData = { employees: [], shifts: [], timeOffRequests: [], shiftSwapRequests: [], targetLaborPercent: 30, scheduleTemplates: [], scheduleEvents: [], publishedPositions: [], openShifts: [] };
const LaborContext = createContext<LaborContextValue | undefined>(undefined);

function shiftHours(shift: LaborShift) {
  const [startHour, startMinute] = shift.start.split(':').map(Number);
  const [endHour, endMinute] = shift.end.split(':').map(Number);
  let minutes = (endHour * 60 + endMinute) - (startHour * 60 + startMinute);
  if (minutes < 0) minutes += 24 * 60;
  return Math.max(0, minutes - (Number(shift.breakMinutes) || 0)) / 60;
}

function normalizeLaborData(value: Partial<LaborData> | null | undefined): LaborData {
  return {
    employees: Array.isArray(value?.employees) ? value.employees.map((employee, index) => ({
      ...employee,
      department: employee.department || 'Restaurant team',
      payType: employee.payType === 'salary' ? 'salary' : 'hourly',
      hourlyRate: Number(employee.hourlyRate) || 0,
      annualSalary: Number(employee.annualSalary) || 0,
      inviteStatus: employee.inviteStatus || (employee.email ? 'active' : 'not-invited'),
      clockInNumber: employee.clockInNumber || String(index + 1).padStart(4, '0'),
    })) : [],
    shifts: Array.isArray(value?.shifts) ? value.shifts : [],
    timeOffRequests: Array.isArray(value?.timeOffRequests) ? value.timeOffRequests : [],
    shiftSwapRequests: Array.isArray(value?.shiftSwapRequests) ? value.shiftSwapRequests : [],
    targetLaborPercent: Number(value?.targetLaborPercent) || 30,
    scheduleTemplates: Array.isArray(value?.scheduleTemplates) ? value.scheduleTemplates : [],
    scheduleEvents: Array.isArray(value?.scheduleEvents) ? value.scheduleEvents : [],
    publishedPositions: Array.isArray(value?.publishedPositions) ? value.publishedPositions : [],
    openShifts: Array.isArray(value?.openShifts) ? value.openShifts : [],
  };
}

function buildDemoLabor(): LaborData {
  const monday = new Date();
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const date = (offset: number) => {
    const value = new Date(monday);
    value.setDate(monday.getDate() + offset);
    return value.toISOString().slice(0, 10);
  };
  const employees: LaborEmployee[] = [
    { id: 'demo-labor-maya', name: 'Maya Chen', role: 'Chef de Cuisine', department: 'Back of house', payType: 'salary', hourlyRate: 0, annualSalary: 85000, active: true, email: 'maya@example.test', phone: '416-555-0141', clockInNumber: '1001', inviteStatus: 'active' },
    { id: 'demo-labor-luca', name: 'Luca Romano', role: 'Line Cook', department: 'Back of house', payType: 'hourly', hourlyRate: 24, annualSalary: 0, active: true, email: 'luca@example.test', phone: '416-555-0142', clockInNumber: '1002', inviteStatus: 'active' },
    { id: 'demo-labor-priya', name: 'Priya Shah', role: 'Server', department: 'Front of house', payType: 'hourly', hourlyRate: 18.5, annualSalary: 0, active: true, email: 'priya@example.test', phone: '416-555-0143', clockInNumber: '1003', inviteStatus: 'active' },
    { id: 'demo-labor-noah', name: 'Noah Williams', role: 'Bartender', department: 'Bar', payType: 'hourly', hourlyRate: 21, annualSalary: 0, active: true, email: 'noah@example.test', phone: '416-555-0144', clockInNumber: '1004', inviteStatus: 'active' },
    { id: 'demo-labor-sofia', name: 'Sofia Martin', role: 'Host', department: 'Front of house', payType: 'hourly', hourlyRate: 17.5, annualSalary: 0, active: true, email: 'sofia@example.test', phone: '416-555-0145', clockInNumber: '1005', inviteStatus: 'active' },
  ];
  const templates = [
    ['demo-labor-maya', '09:00', '17:00', 30, 'EXPO'], ['demo-labor-luca', '14:00', '22:30', 30, 'PREP'],
    ['demo-labor-priya', '16:00', '23:00', 30, 'DINNER'], ['demo-labor-noah', '16:00', '00:00', 30, 'BAR CLOSE'],
    ['demo-labor-sofia', '16:30', '22:00', 15, 'HOST'],
  ] as const;
  const shifts = Array.from({ length: 7 }, (_, day) => templates.map(([employeeId, start, end, breakMinutes, tag], index) => ({
    id: `demo-shift-${day}-${index}`, employeeId, date: date(day), start, end, breakMinutes,
    actualMinutes: day < ((new Date().getDay() + 6) % 7) ? Math.round(shiftHours({ id: '', employeeId, date: '', start, end, breakMinutes, status: 'completed' }) * 60) : undefined,
    status: (day < ((new Date().getDay() + 6) % 7) ? 'completed' : 'confirmed') as LaborShift['status'],
    tag,
  }))).flat();
  return {
    employees, shifts, targetLaborPercent: 30, scheduleTemplates: [], scheduleEvents: [], publishedPositions: [], openShifts: [],
    timeOffRequests: [{ id: 'demo-timeoff-1', employeeId: 'demo-labor-priya', startDate: date(10), endDate: date(11), reason: 'Family event', status: 'pending', createdAt: new Date().toISOString() }],
    shiftSwapRequests: [{ id: 'demo-swap-1', shiftId: 'demo-shift-5-3', requesterEmployeeId: 'demo-labor-noah', targetEmployeeId: 'demo-labor-priya', note: 'Can cover your next Friday shift in return.', status: 'pending', createdAt: new Date().toISOString() }],
  };
}

export function LaborProvider({ children }: { children: ReactNode }) {
  const { accountId, activeLocationId, token, user } = useAuth();
  const [data, setData] = useState<LaborData>(EMPTY_LABOR);
  const [isLaborLoaded, setIsLaborLoaded] = useState(false);
  const storageKey = accountId && activeLocationId ? locationScopedStorageKey(accountId, activeLocationId, 'labor-v1') : null;

  const persist = (next: LaborData) => {
    if (storageKey) localStorage.setItem(storageKey, JSON.stringify(next));
    if (!token || !accountId || !activeLocationId) return;
    void apiRequest(`/api/v1/accounts/${encodeURIComponent(accountId)}/locations/${encodeURIComponent(activeLocationId)}/labor`, {
      method: 'PUT', body: JSON.stringify(next),
    }).catch(error => console.error('Failed to sync labour data', error));
  };

  const commit = (updater: (current: LaborData) => LaborData) => {
    setData(current => {
      const next = updater(current);
      persist(next);
      return next;
    });
  };

  const saveLocalOnly = (updater: (current: LaborData) => LaborData) => {
    setData(current => {
      const next = updater(current);
      if (storageKey) localStorage.setItem(storageKey, JSON.stringify(next));
      return next;
    });
  };

  const postLaborRequest = (payload: Record<string, unknown>) => {
    if (!token || !accountId || !activeLocationId) return;
    void apiRequest(`/api/v1/accounts/${encodeURIComponent(accountId)}/locations/${encodeURIComponent(activeLocationId)}/labor/requests`, {
      method: 'POST', body: JSON.stringify(payload),
    }).catch(error => console.error('Failed to sync employee labour request', error));
  };

  const patchLaborRequest = (payload: Record<string, unknown>) => {
    if (!token || !accountId || !activeLocationId) return;
    void apiRequest(`/api/v1/accounts/${encodeURIComponent(accountId)}/locations/${encodeURIComponent(activeLocationId)}/labor/requests`, {
      method: 'PATCH', body: JSON.stringify(payload),
    }).catch(error => console.error('Failed to update employee labour request', error));
  };

  const inviteEmployee = async (employee: Omit<LaborEmployee, 'id' | 'inviteStatus' | 'invitedAt'>) => {
    if (token && accountId && activeLocationId) {
      const response = await apiRequest<{ labor: LaborData; employee: LaborEmployee }>(`/api/v1/accounts/${encodeURIComponent(accountId)}/locations/${encodeURIComponent(activeLocationId)}/labor/invite`, {
        method: 'POST', body: JSON.stringify({ employee }),
      });
      const next = normalizeLaborData(response.labor);
      setData(next);
      if (storageKey) localStorage.setItem(storageKey, JSON.stringify(next));
      return response.employee;
    }
    const invited: LaborEmployee = { ...employee, id: `employee-${Date.now()}`, inviteStatus: employee.email ? 'pending' : 'not-invited', invitedAt: employee.email ? new Date().toISOString() : undefined };
    commit(current => ({ ...current, employees: [...current.employees, invited] }));
    return invited;
  };

  useEffect(() => {
    if (!accountId || !activeLocationId) {
      setData(EMPTY_LABOR);
      setIsLaborLoaded(true);
      return;
    }
    setIsLaborLoaded(false);
    const local = normalizeLaborData(readScopedJson<LaborData>(storageKey, EMPTY_LABOR));
    const demo = user?.email === 'demo@zestiq.com' ? buildDemoLabor() : EMPTY_LABOR;
    if (!token) {
      setData(local.employees.length > 0 ? local : demo);
      setIsLaborLoaded(true);
      return;
    }
    void apiRequest<LaborData>(`/api/v1/accounts/${encodeURIComponent(accountId)}/locations/${encodeURIComponent(activeLocationId)}/labor`)
      .then(remote => {
        const normalizedRemote = normalizeLaborData(remote);
        const next = normalizedRemote.employees.length > 0 ? normalizedRemote : (local.employees.length > 0 ? local : demo);
        setData(next);
        if (storageKey) localStorage.setItem(storageKey, JSON.stringify(next));
        if (normalizedRemote.employees.length === 0 && next.employees.length > 0) persist(next);
      })
      .catch(() => setData(local.employees.length > 0 ? local : demo))
      .finally(() => setIsLaborLoaded(true));
  }, [accountId, activeLocationId, token, user?.email]);

  const value = useMemo<LaborContextValue>(() => ({
    ...data,
    isLaborLoaded,
    addEmployee: employee => commit(current => ({ ...current, employees: [...current.employees, { ...employee, id: `employee-${Date.now()}` }] })),
    inviteEmployee,
    updateEmployee: (id, updates) => commit(current => ({ ...current, employees: current.employees.map(employee => employee.id === id ? { ...employee, ...updates } : employee) })),
    removeEmployee: id => commit(current => ({ ...current, employees: current.employees.filter(employee => employee.id !== id), shifts: current.shifts.filter(shift => shift.employeeId !== id) })),
    addShift: shift => commit(current => ({ ...current, shifts: [...current.shifts, { ...shift, id: `shift-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` }] })),
    updateShift: (id, updates) => commit(current => ({ ...current, shifts: current.shifts.map(shift => shift.id === id ? { ...shift, ...updates } : shift) })),
    removeShift: id => commit(current => ({ ...current, shifts: current.shifts.filter(shift => shift.id !== id) })),
    requestTimeOff: request => {
      const item: TimeOffRequest = { ...request, id: `timeoff-${Date.now()}`, status: 'pending', createdAt: new Date().toISOString() };
      saveLocalOnly(current => ({ ...current, timeOffRequests: [item, ...current.timeOffRequests] }));
      postLaborRequest({ type: 'time-off', request: item });
    },
    updateTimeOffRequest: (id, status) => {
      saveLocalOnly(current => ({ ...current, timeOffRequests: current.timeOffRequests.map(request => request.id === id ? { ...request, status } : request) }));
      patchLaborRequest({ type: 'time-off', id, status });
    },
    requestShiftSwap: request => {
      const item: ShiftSwapRequest = { ...request, id: `swap-${Date.now()}`, status: 'pending', createdAt: new Date().toISOString() };
      saveLocalOnly(current => ({ ...current, shiftSwapRequests: [item, ...current.shiftSwapRequests] }));
      postLaborRequest({ type: 'shift-swap', request: item });
    },
    updateShiftSwapRequest: (id, status) => {
      saveLocalOnly(current => ({ ...current, shiftSwapRequests: current.shiftSwapRequests.map(request => request.id === id ? { ...request, status } : request) }));
      patchLaborRequest({ type: 'shift-swap', id, status });
    },
    setTargetLaborPercent: targetLaborPercent => commit(current => ({ ...current, targetLaborPercent: Math.min(100, Math.max(0, targetLaborPercent)) })),
    updateSchedulerSettings: updates => commit(current => ({ ...current, ...updates })),
    scheduledHoursForRange: (startDate, endDate) => data.shifts.filter(shift => shift.date >= startDate && shift.date <= endDate && shift.status !== 'called-off').reduce((sum, shift) => sum + shiftHours(shift), 0),
    scheduledCostForRange: (startDate, endDate) => calculateLaborCostBreakdown(data, startDate, endDate).total,
    laborCostBreakdownForRange: (startDate, endDate) => calculateLaborCostBreakdown(data, startDate, endDate),
  }), [data, isLaborLoaded, token, accountId, activeLocationId, storageKey]);

  return <LaborContext.Provider value={value}>{children}</LaborContext.Provider>;
}

export function useLabor() {
  const context = useContext(LaborContext);
  if (!context) throw new Error('useLabor must be used within LaborProvider');
  return context;
}
