import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Plus, Trash2, AlarmClock, Bell, BellOff } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { locationScopedStorageKey, readScopedJson } from '../utils/storageScope';

interface OrderAlarm {
  id: string;
  name: string;
  time: string; // HH:MM 24h
  days: string[];
  enabled: boolean;
  lastFired?: string; // YYYY-MM-DD
}

const ALL_DAYS = [
  { key: 'mon', label: 'M', full: 'Monday' },
  { key: 'tue', label: 'T', full: 'Tuesday' },
  { key: 'wed', label: 'W', full: 'Wednesday' },
  { key: 'thu', label: 'T', full: 'Thursday' },
  { key: 'fri', label: 'F', full: 'Friday' },
  { key: 'sat', label: 'S', full: 'Saturday' },
  { key: 'sun', label: 'S', full: 'Sunday' },
];

const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri'];

const DEFAULT_ALARMS: OrderAlarm[] = [
  {
    id: 'alarm-meat',
    name: 'Order Meat',
    time: '16:00',
    days: WEEKDAYS,
    enabled: true,
  },
  {
    id: 'alarm-cheese',
    name: 'Order Cheese',
    time: '17:00',
    days: WEEKDAYS,
    enabled: true,
  },
];

function loadAlarms(accountId?: string | null, locationId?: string | null): OrderAlarm[] {
  if (!accountId || !locationId) return [];
  const scopedKey = locationScopedStorageKey(accountId, locationId, 'orderAlarms');
  return readScopedJson<OrderAlarm[]>(scopedKey, DEFAULT_ALARMS);
}

function saveAlarms(accountId: string, locationId: string, alarms: OrderAlarm[]) {
  localStorage.setItem(locationScopedStorageKey(accountId, locationId, 'orderAlarms'), JSON.stringify(alarms));
}

function formatTime12h(time24: string): string {
  const [h, m] = time24.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${m.toString().padStart(2, '0')} ${period}`;
}

function dayLabel(days: string[]): string {
  if (days.length === 7) return 'Every day';
  if (JSON.stringify([...days].sort()) === JSON.stringify([...WEEKDAYS].sort())) return 'Weekdays';
  if (days.length === 2 && days.includes('sat') && days.includes('sun')) return 'Weekends';
  return days.map(d => d.charAt(0).toUpperCase() + d.slice(1, 3)).join(', ');
}

export function OrderAlarms() {
  const { accountId, activeLocationId } = useAuth();
  const [alarms, setAlarms] = useState<OrderAlarm[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAlarm, setEditingAlarm] = useState<OrderAlarm | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formTime, setFormTime] = useState('09:00');
  const [formDays, setFormDays] = useState<string[]>(WEEKDAYS);

  useEffect(() => {
    setAlarms(loadAlarms(accountId, activeLocationId));
  }, [accountId, activeLocationId]);

  const persist = useCallback((updated: OrderAlarm[]) => {
    if (!accountId || !activeLocationId) return;
    setAlarms(updated);
    saveAlarms(accountId, activeLocationId, updated);
  }, [accountId, activeLocationId]);

  // Check alarms every 30 seconds
  useEffect(() => {
    const check = () => {
      const now = new Date();
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      const today = now.toISOString().split('T')[0];
      const dayKey = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][now.getDay()];

      setAlarms(prev => {
        let changed = false;
        const updated = prev.map(alarm => {
          if (
            alarm.enabled &&
            alarm.time === currentTime &&
            alarm.days.includes(dayKey) &&
            alarm.lastFired !== today
          ) {
            toast.warning(`⏰ ${alarm.name}`, {
              description: "Time to place your order!",
              duration: 15000,
            });
            changed = true;
            return { ...alarm, lastFired: today };
          }
          return alarm;
        });
        if (changed && accountId && activeLocationId) saveAlarms(accountId, activeLocationId, updated);
        return updated;
      });
    };

    check();
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, [accountId, activeLocationId]);

  const openAdd = () => {
    setEditingAlarm(null);
    setFormName('');
    setFormTime('09:00');
    setFormDays(WEEKDAYS);
    setDialogOpen(true);
  };

  const openEdit = (alarm: OrderAlarm) => {
    setEditingAlarm(alarm);
    setFormName(alarm.name);
    setFormTime(alarm.time);
    setFormDays([...alarm.days]);
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!formName.trim() || formDays.length === 0) {
      toast.error('Please fill in all fields and select at least one day');
      return;
    }
    if (editingAlarm) {
      persist(alarms.map(a =>
        a.id === editingAlarm.id
          ? { ...a, name: formName.trim(), time: formTime, days: formDays }
          : a
      ));
      toast.success('Alarm updated');
    } else {
      const newAlarm: OrderAlarm = {
        id: `alarm-${Date.now()}`,
        name: formName.trim(),
        time: formTime,
        days: formDays,
        enabled: true,
      };
      persist([...alarms, newAlarm]);
      toast.success('Alarm created');
    }
    setDialogOpen(false);
  };

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Delete "${name}"?`)) {
      persist(alarms.filter(a => a.id !== id));
      toast.success('Alarm deleted');
    }
  };

  const toggleEnabled = (id: string) => {
    persist(alarms.map(a => a.id === id ? { ...a, enabled: !a.enabled } : a));
  };

  const toggleDay = (day: string) => {
    setFormDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const activeCount = alarms.filter(a => a.enabled).length;

  // Now let's figure out the current time to show "firing soon" indicators
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">Order Alarms</h2>
          <p className="text-xs text-gray-400 mt-0.5 font-semibold uppercase tracking-wider">
            {activeCount} active alarm{activeCount !== 1 ? 's' : ''}
          </p>
        </div>
        <Button
          className="bg-[#0F172A] hover:bg-[#1E293B] text-white"
          onClick={openAdd}
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Add Alarm
        </Button>
      </div>

      {/* How it works banner */}
      <div className="bg-[#FEFCE8] border border-[#F5C10E]/20 rounded-xl px-4 py-3 flex items-start gap-3">
        <Bell className="w-4 h-4 text-[#2563EB] mt-0.5 shrink-0" />
        <p className="text-xs text-[#1D4ED8] font-medium leading-relaxed">
          Alarms fire as in-app notifications while this app is open. Keep the app running to receive alerts. Alarms check every 30 seconds.
        </p>
      </div>

      {/* Alarms Table */}
      {alarms.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-12 flex flex-col items-center gap-3">
            <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center">
              <AlarmClock className="w-7 h-7 text-gray-400" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-gray-700">No order alarms yet</p>
              <p className="text-sm text-gray-400 mt-1">Add your first alarm to get reminders</p>
            </div>
            <Button className="bg-[#0F172A] hover:bg-[#1E293B] text-white mt-2" onClick={openAdd}>
              <Plus className="w-4 h-4 mr-1.5" />
              Add First Alarm
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {alarms.map(alarm => {
            const [h, m] = alarm.time.split(':').map(Number);
            const alarmMinutes = h * 60 + m;
            const minutesUntil = alarmMinutes - currentMinutes;
            const firingToday = alarm.days.includes(['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][now.getDay()]);
            const isSoon = minutesUntil > 0 && minutesUntil <= 30 && firingToday;
            const firedToday = alarm.lastFired === now.toISOString().split('T')[0];

            return (
              <Card
                key={alarm.id}
                className={`border-0 shadow-sm overflow-hidden transition-all ${
                  !alarm.enabled ? 'opacity-50' : ''
                }`}
              >
                {/* Top accent stripe */}
                <div className={`h-[3px] ${alarm.enabled ? (isSoon ? 'bg-amber-400' : 'bg-[#0F172A]') : 'bg-gray-200'}`} />
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    {/* Time display */}
                    <button
                      onClick={() => openEdit(alarm)}
                      className="flex-1 flex items-center gap-3 text-left"
                    >
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                        alarm.enabled ? 'bg-[#0F172A]' : 'bg-gray-200'
                      }`}>
                        <AlarmClock className={`w-5 h-5 ${alarm.enabled ? 'text-white' : 'text-gray-400'}`} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-gray-900 text-sm truncate">{alarm.name}</p>
                          {isSoon && (
                            <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full shrink-0">
                              {minutesUntil}m
                            </span>
                          )}
                          {firedToday && alarm.enabled && (
                            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full shrink-0">
                              Sent ✓
                            </span>
                          )}
                        </div>
                        <p className="text-lg font-black text-gray-900" style={{ fontFamily: 'var(--font-mono)' }}>
                          {formatTime12h(alarm.time)}
                        </p>
                        <p className="text-[10px] text-gray-400 font-semibold mt-0.5">
                          {dayLabel(alarm.days)}
                        </p>
                      </div>
                    </button>

                    {/* Controls */}
                    <div className="flex items-center gap-2 shrink-0">
                      {/* Enable toggle */}
                      <button
                        onClick={() => toggleEnabled(alarm.id)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          alarm.enabled ? 'bg-[#0F172A]' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            alarm.enabled ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                      <button
                        onClick={() => handleDelete(alarm.id, alarm.name)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Quick presets */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Quick Presets</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { name: 'Order Produce', time: '06:00' },
              { name: 'Order Seafood', time: '14:00' },
              { name: 'Order Dairy', time: '15:00' },
              { name: 'Order Dry Goods', time: '10:00' },
            ].map(preset => (
              <button
                key={preset.name}
                onClick={() => {
                  setEditingAlarm(null);
                  setFormName(preset.name);
                  setFormTime(preset.time);
                  setFormDays(WEEKDAYS);
                  setDialogOpen(true);
                }}
                className="text-left p-3 rounded-xl border border-gray-100 hover:border-[#F5C10E]/30 hover:bg-[#FEFCE8] transition-all group"
              >
                <p className="text-xs font-bold text-gray-700 group-hover:text-[#0F172A]">{preset.name}</p>
                <p className="text-[10px] text-gray-400 font-mono mt-0.5">{formatTime12h(preset.time)}</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-[calc(100vw-2rem)]">
          <DialogHeader>
            <DialogTitle>{editingAlarm ? 'Edit Alarm' : 'New Order Alarm'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div>
              <Label htmlFor="alarm-name">Alarm Name</Label>
              <Input
                id="alarm-name"
                placeholder="e.g. Order Meat"
                value={formName}
                onChange={e => setFormName(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="alarm-time">Time</Label>
              <Input
                id="alarm-time"
                type="time"
                value={formTime}
                onChange={e => setFormTime(e.target.value)}
                className="mt-1"
              />
              {formTime && (
                <p className="text-xs text-gray-500 mt-1">
                  Fires at <span className="font-bold text-[#0F172A]">{formatTime12h(formTime)}</span>
                </p>
              )}
            </div>

            <div>
              <Label>Repeat on days</Label>
              <div className="flex gap-1.5 mt-2">
                {ALL_DAYS.map(day => (
                  <button
                    key={day.key}
                    type="button"
                    onClick={() => toggleDay(day.key)}
                    className={`w-9 h-9 rounded-full text-xs font-bold transition-all ${
                      formDays.includes(day.key)
                        ? 'bg-[#0F172A] text-white'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                    title={day.full}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
              <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  className="text-[10px] font-bold text-[#1D4ED8] underline"
                  onClick={() => setFormDays(WEEKDAYS)}
                >
                  Weekdays
                </button>
                <button
                  type="button"
                  className="text-[10px] font-bold text-[#1D4ED8] underline"
                  onClick={() => setFormDays(ALL_DAYS.map(d => d.key))}
                >
                  Every day
                </button>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="flex-1 bg-[#0F172A] hover:bg-[#1E293B] text-white"
                onClick={handleSave}
              >
                {editingAlarm ? 'Save Changes' : 'Create Alarm'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
