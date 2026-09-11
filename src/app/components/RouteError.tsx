import { AlertTriangle, ArrowLeft, RefreshCw } from 'lucide-react';

export function RouteError() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#F7F8FA] px-5 py-12 text-[#303A43]">
      <section className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-sm sm:p-8">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-amber-100 text-amber-800">
          <AlertTriangle className="h-7 w-7" aria-hidden="true" />
        </div>
        <h1 className="mt-5 text-2xl font-black tracking-tight">We couldn’t open this page</h1>
        <p className="mt-2 text-base leading-7 text-slate-600">Your information is still safe. Try the page again, or return to inventory and continue working.</p>
        <div className="mt-6 grid gap-2 sm:grid-cols-2">
          <button type="button" onClick={() => window.location.assign('/app/inventory')} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 hover:bg-slate-50">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to inventory
          </button>
          <button type="button" onClick={() => window.location.reload()} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#303A43] px-4 text-sm font-bold text-white hover:bg-[#1E293B]">
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Try again
          </button>
        </div>
      </section>
    </main>
  );
}
