import { useState } from 'react';
import { useInventory } from '../contexts/InventoryContext';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import {
  Plus, ChevronRight, ShoppingCart, Truck, CheckCircle2,
  Clock, Package, SlidersHorizontal,
} from 'lucide-react';
import { toast } from 'sonner';

const Y = '#F5C10E';
const D = '#0F172A';

type OrderStatus = 'pending' | 'ordered' | 'received' | 'cancelled';

const STATUS_CFG: Record<OrderStatus, { label: string; bg: string; color: string }> = {
  pending:   { label: 'Open',       bg: `${Y}25`,  color: '#7A5E00' },
  ordered:   { label: 'In Transit', bg: '#DBEAFE', color: '#1E40AF' },
  received:  { label: 'Received',   bg: '#DCFCE7', color: '#166534' },
  cancelled: { label: 'Cancelled',  bg: '#F3F4F6', color: '#6B7280' },
};

const AVATAR_COLORS = [
  { bg: '#EFF6FF', text: '#1D4ED8' },
  { bg: '#F0FDF4', text: '#15803D' },
  { bg: '#FEF9C3', text: '#854D0E' },
  { bg: '#FDF4FF', text: '#7E22CE' },
  { bg: '#FFF7ED', text: '#C2410C' },
];

function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function initials(name: string) {
  return name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtMoney(v: number) {
  return `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function Orders() {
  const { orders, inventory, updateOrderStatus } = useInventory();
  const [activeTab, setActiveTab] = useState<'all' | OrderStatus>('all');
  const [detailId, setDetailId]   = useState<string | null>(null);

  const open      = orders.filter(o => o.status === 'pending');
  const inTransit = orders.filter(o => o.status === 'ordered');
  const received  = orders.filter(o => o.status === 'received');
  const cancelled = orders.filter(o => o.status === 'cancelled');

  const sorted   = [...orders].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const filtered = activeTab === 'all' ? sorted : sorted.filter(o => o.status === activeTab);

  const detailOrder = orders.find(o => o.id === detailId);

  const handleStatus = (id: string, status: OrderStatus) => {
    updateOrderStatus(id, status as any);
    toast.success(`Order marked as ${STATUS_CFG[status].label}`);
  };

  const TABS = [
    { key: 'all',       label: 'All Orders', count: orders.length },
    { key: 'pending',   label: 'Open',       count: open.length },
    { key: 'ordered',   label: 'In Transit', count: inTransit.length },
    { key: 'received',  label: 'Received',   count: received.length },
    { key: 'cancelled', label: 'Cancelled',  count: cancelled.length },
  ] as const;

  return (
    <div className="-mx-4 bg-white min-h-screen">

      {/* Header */}
      <div className="px-4 pt-2 pb-5">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-[26px] font-extrabold tracking-tight" style={{ color: D }}>Orders</h1>
            <p className="text-sm text-gray-400 mt-0.5">Manage purchase orders and track deliveries.</p>
          </div>
          <button
            className="flex items-center gap-1.5 h-10 px-4 rounded-xl text-sm font-bold shrink-0 mt-1"
            style={{ background: Y, color: D }}
          >
            <Plus className="w-4 h-4" />
            New Order
          </button>
        </div>

        {/* Stat strip */}
        <div className="grid grid-cols-4 gap-2 mt-5">
          {[
            { label: 'Open Orders',      count: open.length,      val: open.reduce((s,o)=>s+o.totalCost,0),      dotBg: `${Y}30`,  dotColor: '#7A5E00' },
            { label: 'In Transit',       count: inTransit.length, val: inTransit.reduce((s,o)=>s+o.totalCost,0), dotBg: '#DBEAFE', dotColor: '#1E40AF' },
            { label: 'Received',         count: received.length,  val: received.reduce((s,o)=>s+o.totalCost,0),  dotBg: '#DCFCE7', dotColor: '#166534' },
            { label: 'Pending Approval', count: cancelled.length, val: cancelled.reduce((s,o)=>s+o.totalCost,0), dotBg: '#F3F4F6', dotColor: '#6B7280' },
          ].map(({ label, count, val, dotBg, dotColor }) => (
            <div key={label} className="flex flex-col items-center text-center">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center mb-2 text-base font-black"
                style={{ background: dotBg, color: dotColor, fontFamily: 'var(--font-mono)' }}
              >
                {count}
              </div>
              <p className="text-[11px] font-black tabular-nums" style={{ color: D, fontFamily: 'var(--font-mono)' }}>
                {val >= 1000 ? `$${(val/1000).toFixed(1)}k` : fmtMoney(val)}
              </p>
              <p className="text-[9px] text-gray-400 font-semibold mt-1 uppercase tracking-wide leading-tight text-center">
                {label}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Tab bar */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100">
        <div className="flex px-4 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {TABS.map(tab => {
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className="relative flex items-center gap-1.5 py-3 px-3 text-[12px] font-bold whitespace-nowrap shrink-0 transition-colors"
                style={{ color: active ? D : '#9CA3AF' }}
              >
                {tab.label}
                {tab.count > 0 && (
                  <span
                    className="text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center"
                    style={{ background: active ? Y : '#F3F4F6', color: active ? D : '#9CA3AF' }}
                  >
                    {tab.count}
                  </span>
                )}
                {active && (
                  <span className="absolute bottom-0 left-3 right-3 h-[2.5px] rounded-full" style={{ background: Y }} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Sort row */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-50">
        <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-widest">
          {filtered.length} order{filtered.length !== 1 ? 's' : ''}
        </p>
        <button className="flex items-center gap-1 text-[11px] font-bold text-gray-500">
          <SlidersHorizontal className="w-3 h-3" />
          Sort: Newest
        </button>
      </div>

      {/* Order rows */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center py-16 gap-3 text-center px-4">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center">
            <ShoppingCart className="w-7 h-7 text-gray-300" />
          </div>
          <p className="font-bold text-gray-500 text-sm">No orders yet</p>
          <p className="text-xs text-gray-400">Create a forecast to generate your first order list</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-50">
          {filtered.map(order => {
            // Primary supplier
            const supCounts: Record<string, number> = {};
            order.items.forEach(oi => {
              const item = inventory.find(i => i.id === oi.itemId);
              if (item) supCounts[item.supplier] = (supCounts[item.supplier] || 0) + 1;
            });
            const primarySup = Object.entries(supCounts).sort((a,b)=>b[1]-a[1])[0]?.[0] || 'Supplier';
            const cfg = STATUS_CFG[order.status as OrderStatus] ?? STATUS_CFG.pending;
            const av  = avatarColor(primarySup);

            const delivery = new Date(order.date);
            delivery.setDate(delivery.getDate() + 3);

            return (
              <button
                key={order.id}
                onClick={() => setDetailId(order.id)}
                className="w-full flex items-center gap-3 px-4 py-4 bg-white active:bg-gray-50 transition-colors text-left"
              >
                {/* Supplier avatar */}
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 text-sm font-black"
                  style={{ background: av.bg, color: av.text }}
                >
                  {initials(primarySup)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[13px] font-bold text-gray-900 truncate">
                      Order #{order.id.slice(0, 8).toUpperCase()}
                    </p>
                    <span
                      className="text-[9px] font-black px-2 py-1 rounded-full shrink-0"
                      style={{ background: cfg.bg, color: cfg.color }}
                    >
                      {cfg.label}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-400 font-medium mt-0.5">{primarySup}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    {fmtDate(order.date)} · Delivery: {fmtDate(delivery.toISOString())}
                  </p>
                  <div className="flex items-center justify-between mt-1.5">
                    <p className="text-[15px] font-black" style={{ color: D, fontFamily: 'var(--font-mono)' }}>
                      {fmtMoney(order.totalCost)}
                    </p>
                    <p className="text-[10px] text-gray-400 font-medium">{order.items.length} items</p>
                  </div>
                </div>

                <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
              </button>
            );
          })}
        </div>
      )}

      {/* Detail dialog */}
      <Dialog open={!!detailId} onOpenChange={open => !open && setDetailId(null)}>
        <DialogContent className="max-w-[calc(100vw-2rem)] max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {detailOrder ? `Order #${detailOrder.id.slice(0,8).toUpperCase()}` : 'Order Details'}
            </DialogTitle>
          </DialogHeader>

          {detailOrder && (() => {
            const cfg = STATUS_CFG[detailOrder.status as OrderStatus] ?? STATUS_CFG.pending;
            const groups: Record<string, typeof detailOrder.items> = {};
            detailOrder.items.forEach(oi => {
              const sup = inventory.find(i => i.id === oi.itemId)?.supplier || 'Unknown';
              if (!groups[sup]) groups[sup] = [];
              groups[sup].push(oi);
            });

            return (
              <div className="flex-1 overflow-y-auto space-y-4 pb-2">
                <div className="flex items-center justify-between p-4 rounded-2xl" style={{ background: cfg.bg }}>
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: cfg.color }}>Status</p>
                    <p className="text-base font-black mt-0.5" style={{ color: cfg.color }}>{cfg.label}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Total</p>
                    <p className="text-xl font-black" style={{ color: D, fontFamily: 'var(--font-mono)' }}>
                      {fmtMoney(detailOrder.totalCost)}
                    </p>
                  </div>
                </div>

                {Object.entries(groups).map(([sup, items]) => {
                  const av  = avatarColor(sup);
                  const tot = items.reduce((s, oi) => s + oi.cost, 0);
                  return (
                    <div key={sup}>
                      <div className="flex items-center gap-2 mb-2 px-1">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black" style={{ background: av.bg, color: av.text }}>
                          {initials(sup)}
                        </div>
                        <p className="text-xs font-bold text-gray-700 flex-1">{sup}</p>
                        <p className="text-xs font-bold" style={{ color: D }}>{fmtMoney(tot)}</p>
                      </div>
                      <div className="space-y-1.5">
                        {items.map(oi => {
                          const item = inventory.find(i => i.id === oi.itemId);
                          if (!item) return null;
                          return (
                            <div key={oi.itemId} className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2.5">
                              <div className="min-w-0">
                                <p className="text-sm font-bold text-gray-900 truncate">{item.name}</p>
                                <p className="text-[10px] text-gray-400">{oi.quantity} {item.unit} · ${item.unitCost.toFixed(2)}/{item.unit}</p>
                              </div>
                              <p className="text-sm font-bold ml-3 shrink-0" style={{ color: D }}>{fmtMoney(oi.cost)}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                <div className="flex gap-2 pt-2">
                  {detailOrder.status === 'pending' && (
                    <Button className="flex-1 font-bold" style={{ background: D, color: '#fff' }}
                      onClick={() => { handleStatus(detailOrder.id, 'ordered'); setDetailId(null); }}>
                      <Truck className="w-4 h-4 mr-1.5" /> Mark In Transit
                    </Button>
                  )}
                  {detailOrder.status === 'ordered' && (
                    <Button className="flex-1 font-bold" style={{ background: '#166534', color: '#fff' }}
                      onClick={() => { handleStatus(detailOrder.id, 'received'); setDetailId(null); }}>
                      <CheckCircle2 className="w-4 h-4 mr-1.5" /> Mark Received
                    </Button>
                  )}
                  {detailOrder.status === 'received' && (
                    <div className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-green-700 font-bold text-sm bg-green-50">
                      <CheckCircle2 className="w-4 h-4" /> Order Complete
                    </div>
                  )}
                  <Button variant="outline" className="flex-1" onClick={() => setDetailId(null)}>Close</Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
