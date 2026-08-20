import { useState, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router';
import { useToast, type PosImportPayload } from '../contexts/ToastContext';
import { useInventory } from '../contexts/InventoryContext';
import { useAuth } from '../contexts/AuthContext';
import { POS_PROVIDERS, getPosProvider } from '../data/posProviders';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '../components/ui/dropdown-menu';
import { CheckCircle, ChevronDown, Database, ExternalLink, FileSpreadsheet, LogOut, Mail, MapPin, Phone, PlugZap, ShieldCheck, Upload, Wifi, XCircle } from 'lucide-react';
import { toast as showToast } from 'sonner';

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"' && quoted && text[index + 1] === '"') { value += '"'; index += 1; }
    else if (character === '"') quoted = !quoted;
    else if (character === ',' && !quoted) { row.push(value.trim()); value = ''; }
    else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && text[index + 1] === '\n') index += 1;
      row.push(value.trim()); value = '';
      if (row.some(cell => cell !== '')) rows.push(row);
      row = [];
    } else value += character;
  }
  row.push(value.trim());
  if (row.some(cell => cell !== '')) rows.push(row);
  const [headers = [], ...body] = rows;
  return body.map(values => Object.fromEntries(headers.map((header, index) => [header.replace(/^\uFEFF/, '').trim(), values[index] ?? ''])));
}

export function Integrations() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { isConnected, provider, connectionMode, disconnectToast, importSalesData, selectPosProvider, lastSync, salesData, menuItems } = useToast();
  const { suppliers } = useInventory();
  const [pendingPayload, setPendingPayload] = useState<PosImportPayload | null>(null);
  const [fileName, setFileName] = useState('');
  const [jsonPayload, setJsonPayload] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const selected = getPosProvider(provider);

  const prepareFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = file.name.toLowerCase().endsWith('.json') ? JSON.parse(text) : { rows: parseCsv(text) };
      setPendingPayload({ ...parsed, provider });
      setFileName(file.name);
      showToast.success(`${file.name} is ready to import`);
    } catch {
      setPendingPayload(null); setFileName('');
      showToast.error('That file could not be read. Use a CSV or JSON export.');
    }
  };

  const handleImport = async () => {
    let payload = pendingPayload;
    if (!payload && jsonPayload.trim()) {
      try { payload = JSON.parse(jsonPayload) as PosImportPayload; }
      catch { showToast.error('The pasted JSON is not valid'); return; }
    }
    if (!payload) { showToast.error('Choose a CSV/JSON export or paste JSON first'); return; }
    setIsImporting(true);
    try {
      await importSalesData({ ...payload, provider });
      setPendingPayload(null); setFileName(''); setJsonPayload('');
      showToast.success(`${selected.name} sales imported successfully`);
    } catch (error) {
      showToast.error(error instanceof Error ? error.message : 'Sales import failed');
    } finally { setIsImporting(false); }
  };

  const handleDisconnect = () => {
    disconnectToast();
    showToast.success('POS sales data disconnected from this location');
  };

  const handleLogout = () => {
    logout(); showToast.success('Logged out successfully'); navigate('/login');
  };

  const formatDate = (value: string | null) => value ? new Date(value).toLocaleString('en-CA', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Never';
  const requestUrl = `mailto:demo@zestiq.ca?subject=${encodeURIComponent(`Activate ${selected.name} direct POS sync`)}&body=${encodeURIComponent(`I would like to connect ${selected.name} to my ZestIQ location.`)}`;

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <section className="overflow-hidden rounded-[30px] bg-[#0B1220] p-6 text-white sm:p-8">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div><p className="text-xs font-black uppercase tracking-[0.2em] text-[#F5C10E]">Sales integrations</p><h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Connect the POS you already use.</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-white/60">Bring sales and menu mix into forecasting, recipe costing and ordering. Choose a Canadian restaurant POS below, then import an export now or request a direct API connection.</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3"><p className="text-[10px] font-black uppercase tracking-wider text-white/40">Current provider</p><p className="mt-1 font-black">{selected.name}</p></div>
        </div>
      </section>

      <Card>
        <CardHeader><CardTitle className="text-lg">Canadian POS connector hub</CardTitle><CardDescription>Popular cloud and legacy restaurant systems used across Canada. Other systems can use the universal importer.</CardDescription></CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {POS_PROVIDERS.map(item => {
              const active = item.id === provider;
              return <button key={item.id} type="button" onClick={() => { selectPosProvider(item.id); setPendingPayload(null); setFileName(''); }} className={`rounded-2xl border p-4 text-left transition ${active ? 'border-[#F5C10E] bg-[#FEFCE8] ring-2 ring-[#F5C10E]/20' : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'}`}>
                <div className="flex items-start justify-between gap-3"><span className="flex h-10 min-w-10 items-center justify-center rounded-xl px-2 text-xs font-black text-white" style={{ backgroundColor: item.colour }}>{item.mark}</span>{active && <CheckCircle className="h-5 w-5 text-emerald-600" />}</div>
                <p className="mt-3 font-black text-slate-900">{item.name}</p><p className="mt-1 min-h-10 text-xs leading-5 text-slate-500">{item.description}</p><span className="mt-3 inline-flex rounded-full bg-slate-100 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-slate-500">{item.connection}</span>
              </button>;
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-slate-100"><div className="flex items-start justify-between gap-3"><div><CardTitle className="flex items-center gap-2 text-lg"><FileSpreadsheet className="h-5 w-5 text-[#B58B00]" />Import sales now</CardTitle><CardDescription className="mt-1">Upload a {selected.name} CSV or JSON export. ZestIQ recognizes common item, quantity, revenue, category, date and cover headers.</CardDescription></div><Badge className="bg-emerald-100 text-emerald-800">Ready</Badge></div></CardHeader>
          <CardContent className="space-y-4 pt-5">
            <label htmlFor="pos-file" className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center transition hover:border-[#F5C10E] hover:bg-[#FEFCE8]">
              <Upload className="h-7 w-7 text-slate-400" /><span className="mt-3 font-black text-slate-800">{fileName || 'Choose a sales export'}</span><span className="mt-1 text-xs text-slate-500">CSV or JSON · one day or many days</span>
              <input id="pos-file" type="file" accept=".csv,.json,text/csv,application/json" onChange={prepareFile} className="sr-only" />
            </label>
            <div className="rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-500"><strong className="text-slate-700">Best columns:</strong> Business Date, Menu Item, Quantity Sold, Net Sales, Category, Price and Covers. Common alternate headings are matched automatically.</div>
            <details><summary className="cursor-pointer text-xs font-bold text-slate-500">Advanced: paste JSON instead</summary><div className="mt-3"><Label htmlFor="pos-json">POS sales payload</Label><Textarea id="pos-json" value={jsonPayload} onChange={event => setJsonPayload(event.target.value)} placeholder='{"salesData":[{"date":"2026-08-20","revenue":2480,"covers":74,"topItems":[...]}]}' className="mt-1 min-h-28 font-mono text-xs" /></div></details>
            <Button onClick={handleImport} disabled={isImporting || (!pendingPayload && !jsonPayload.trim())} className="w-full bg-[#0F172A] text-white hover:bg-[#1E293B]">{isImporting ? 'Importing sales…' : `Import ${selected.name} sales`}</Button>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="border-b border-slate-100"><div className="flex items-start justify-between gap-3"><div><CardTitle className="flex items-center gap-2 text-lg"><PlugZap className="h-5 w-5 text-[#B58B00]" />Direct sync</CardTitle><CardDescription className="mt-1">Automatic daily sales and menu updates.</CardDescription></div><Badge variant="outline">Activation required</Badge></div></CardHeader>
          <CardContent className="space-y-4 pt-5">
            <div className="rounded-2xl bg-[#FEFCE8] p-4"><p className="font-black text-slate-900">{selected.name}</p><p className="mt-2 text-xs leading-5 text-slate-600">Direct connections use provider-approved OAuth or server-held credentials. ZestIQ does not ask you to paste secret API keys into this screen.</p></div>
            <div className="space-y-3 text-sm"><Feature icon={ShieldCheck} text="Credentials remain server-side" /><Feature icon={Database} text="Sales stays separated by company and location" /><Feature icon={Wifi} text="Connection health and last sync are visible" /></div>
            <a href={requestUrl} className="flex h-10 w-full items-center justify-center rounded-md bg-[#F5C10E] px-4 text-sm font-black text-[#0F172A] hover:bg-[#E5B60D]">Request direct activation</a>
            <a href={selected.website} target={selected.website.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer" className="flex items-center justify-center gap-1 text-xs font-bold text-[#2563EB] hover:underline">View provider information<ExternalLink className="h-3.5 w-3.5" /></a>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><CardTitle className="text-lg">Sales connection status</CardTitle><CardDescription>{isConnected ? `${selected.name} data is available to ZestIQ.` : 'No real sales data has been connected for this location yet.'}</CardDescription></div><Badge className={isConnected ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'}>{isConnected ? <><CheckCircle className="mr-1 h-3 w-3" />Data active</> : <><XCircle className="mr-1 h-3 w-3" />Not connected</>}</Badge></div></CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-4"><Stat label="Provider" value={selected.name} /><Stat label="Method" value={connectionMode === 'direct' ? 'Direct API' : 'Secure import'} /><Stat label="Sales days" value={String(salesData.length)} /><Stat label="Menu items" value={String(menuItems.length)} /></div>
          <p className="mt-3 text-xs text-slate-500">Last data update: {formatDate(lastSync)}</p>
          {isConnected && <div className="mt-4 flex flex-col gap-2 sm:flex-row"><Button variant="outline" onClick={handleDisconnect}>Disconnect sales data</Button></div>}
        </CardContent>
      </Card>

      {isConnected && salesData.length > 0 && <Card><CardHeader><CardTitle className="text-lg">Recent imported sales</CardTitle><CardDescription>These records now power dashboard trends and forecasting.</CardDescription></CardHeader><CardContent><div className="grid gap-3 md:grid-cols-3">{salesData.slice(-3).reverse().map(day => <div key={day.date} className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-bold text-slate-500">{new Date(`${day.date}T12:00:00`).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}</p><p className="mt-2 text-2xl font-black text-slate-900">${day.revenue.toLocaleString('en-CA', { maximumFractionDigits: 0 })}</p><p className="mt-1 text-xs text-slate-500">{day.covers} covers · {day.topItems.length} selling items</p></div>)}</div></CardContent></Card>}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3"><div><CardTitle className="text-base">Supplier contacts</CardTitle><CardDescription>Quick access to supplier emails and phone numbers.</CardDescription></div><DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" className="gap-2">View suppliers<ChevronDown className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent className="w-80"><DropdownMenuLabel>Supplier contacts</DropdownMenuLabel><DropdownMenuSeparator />{suppliers.length ? suppliers.map(supplier => <div key={supplier.id} className="space-y-2 px-2 py-3"><div className="flex items-center justify-between gap-2"><span className="font-semibold text-slate-900">{supplier.name}</span><span className="text-[11px] text-slate-500">{supplier.category}</span></div><div className="flex flex-col gap-1 text-xs text-slate-600"><a href={`mailto:${supplier.email}`} className="inline-flex items-center gap-1 hover:text-slate-950"><Mail className="h-3.5 w-3.5" />{supplier.email}</a><a href={`tel:${supplier.phone}`} className="inline-flex items-center gap-1 hover:text-slate-950"><Phone className="h-3.5 w-3.5" />{supplier.phone}</a>{supplier.address && <span className="inline-flex items-start gap-1 text-slate-500"><MapPin className="mt-0.5 h-3.5 w-3.5" />{supplier.address}</span>}</div></div>) : <p className="p-3 text-sm text-slate-500">No suppliers added yet.</p>}</DropdownMenuContent></DropdownMenu></CardHeader>
      </Card>

      <Button variant="outline" onClick={handleLogout} className="text-red-600 hover:text-red-700"><LogOut className="mr-2 h-4 w-4" />Log out</Button>
    </div>
  );
}

function Feature({ icon: Icon, text }: { icon: typeof ShieldCheck; text: string }) { return <div className="flex items-center gap-2"><Icon className="h-4 w-4 text-emerald-600" /><span>{text}</span></div>; }
function Stat({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl bg-slate-50 p-4"><p className="text-[9px] font-black uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 break-words font-black text-slate-900">{value}</p></div>; }
