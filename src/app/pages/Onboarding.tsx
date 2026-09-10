import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { ArrowRight, Building2, Check, MapPin, Rocket, Sparkles, Store } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth, type OnboardingStepId } from '../contexts/AuthContext';

const STEPS: Array<{ id: OnboardingStepId; label: string; description: string; icon: typeof Store }> = [
  { id: 'restaurant', label: 'Restaurant', description: 'Confirm the business this workspace belongs to.', icon: Building2 },
  { id: 'location', label: 'First location', description: 'Name the kitchen your team will count and order for.', icon: MapPin },
];

function FieldLabel({ htmlFor, children }: { htmlFor: string; children: ReactNode }) {
  return <label htmlFor={htmlFor} className="mb-1.5 block text-xs font-black uppercase tracking-[0.16em] text-slate-500">{children}</label>;
}

function SetupProgress({ currentStep, completedSteps }: { currentStep: OnboardingStepId; completedSteps: OnboardingStepId[] }) {
  const currentIndex = STEPS.findIndex(step => step.id === currentStep);
  return (
    <aside className="rounded-[28px] bg-[#303A43] p-5 text-white lg:sticky lg:top-28 lg:self-start">
      <div className="flex min-w-0 items-center gap-3 border-b border-white/10 pb-5">
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[#F5D62E] text-[#303A43]"><Rocket className="h-5 w-5" /></div>
        <div className="min-w-0"><p className="text-xs font-black uppercase tracking-[0.18em] text-white/45">Workspace launch</p><p className="mt-1 break-words font-black leading-tight">Get useful data in</p></div>
      </div>
      <ol className="mt-5 grid grid-cols-2 gap-2 lg:grid-cols-1">
        {STEPS.map((step, index) => {
          const complete = completedSteps.includes(step.id);
          const active = step.id === currentStep;
          const Icon = step.icon;
          return (
            <li key={step.id} aria-current={active ? 'step' : undefined} className={`flex min-w-0 items-center gap-2.5 rounded-2xl p-2.5 ${active ? 'bg-white text-[#303A43]' : 'text-white/60'}`}>
              <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl ${complete ? 'bg-emerald-500 text-white' : active ? 'bg-[#F5D62E] text-[#303A43]' : 'bg-white/10'}`}>{complete ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}</span>
              <span className="min-w-0"><span className="block text-[9px] font-black uppercase tracking-[0.12em] opacity-55 lg:text-[10px] lg:tracking-[0.16em]">Step {index + 1}</span><span className="block break-words text-xs font-bold leading-tight lg:text-sm">{step.label}</span></span>
            </li>
          );
        })}
      </ol>
      <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-[#F5D62E]" style={{ width: `${Math.max(8, ((currentIndex + 1) / STEPS.length) * 100)}%` }} /></div>
      <p className="mt-2 text-xs text-white/45">Progress saves to this company account.</p>
    </aside>
  );
}

function StepHeading({ step }: { step: (typeof STEPS)[number] }) {
  return <div><p className="text-xs font-black uppercase tracking-[0.2em] text-[#9A7600]">Step {STEPS.findIndex(item => item.id === step.id) + 1} of {STEPS.length}</p><h1 className="mt-2 text-3xl font-black tracking-[-0.03em] text-[#303A43] sm:text-4xl">{step.label}</h1><p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">{step.description}</p></div>;
}

export function Onboarding() {
  const navigate = useNavigate();
  const {
    user, accountName, onboarding, locations, activeLocationId,
    updateAccountProfile, updateLocation, updateOnboarding,
  } = useAuth();
  const [restaurantName, setRestaurantName] = useState(accountName);
  const [locationName, setLocationName] = useState(locations.find(location => location.id === activeLocationId)?.name || 'Main Location');
  const [saving, setSaving] = useState(false);

  const currentStep = STEPS.find(step => step.id === onboarding.currentStep) || STEPS[0];
  const completedSteps = onboarding.completedSteps || [];
  const stepIndex = STEPS.findIndex(step => step.id === currentStep.id);
  const canManage = user?.role === 'Owner' || user?.role === 'Admin';

  const moveToStep = async (nextStep: OnboardingStepId, completed?: OnboardingStepId) => {
    const nextCompleted = completed && !completedSteps.includes(completed) ? [...completedSteps, completed] : completedSteps;
    await updateOnboarding({
      status: 'in_progress',
      currentStep: nextStep,
      completedSteps: nextCompleted,
      startedAt: onboarding.startedAt || new Date().toISOString(),
    });
  };

  const next = async (completed = currentStep.id) => {
    const following = STEPS[Math.min(stepIndex + 1, STEPS.length - 1)];
    await moveToStep(following.id, completed);
  };

  const runStep = async (action: () => void | Promise<void>) => {
    setSaving(true);
    try {
      await action();
      await next();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Setup could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const saveAndExit = async () => {
    setSaving(true);
    try {
      await updateOnboarding({
        status: 'dismissed',
        currentStep: currentStep.id,
        startedAt: onboarding.startedAt || new Date().toISOString(),
      });
      navigate('/app');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Setup progress could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const saveRestaurant = (event: FormEvent) => {
    event.preventDefault();
    if (!restaurantName.trim()) return toast.error('Enter your restaurant name.');
    void runStep(() => updateAccountProfile(restaurantName));
  };

  const saveLocation = (event: FormEvent) => {
    event.preventDefault();
    if (!activeLocationId || !locationName.trim()) return toast.error('Enter a location name.');
    setSaving(true);
    void (async () => {
      try {
        await updateLocation(activeLocationId, locationName);
        await updateOnboarding({
          status: 'completed',
          currentStep: 'location',
          completedSteps: Array.from(new Set([...completedSteps, 'restaurant', 'location'])),
          completedAt: new Date().toISOString(),
          startedAt: onboarding.startedAt || new Date().toISOString(),
        });
        toast.success('Your workspace is ready. Finish the optional checklist whenever you like.');
        navigate('/app');
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'The location could not be saved.');
      } finally {
        setSaving(false);
      }
    })();
  };

  if (!canManage) {
    return (
      <div className="mx-auto max-w-xl rounded-3xl bg-white p-8 text-center shadow-sm">
        <Building2 className="mx-auto h-12 w-12 text-[#F5D62E]" />
        <h1 className="mt-4 text-2xl font-black text-[#303A43]">An owner or admin completes setup</h1>
        <p className="mt-2 text-slate-600">Your account is protected. Ask your company owner to finish the restaurant setup.</p>
        <Link to="/app" className="mt-6 inline-flex rounded-xl bg-[#303A43] px-5 py-3 font-bold text-white">Back to dashboard</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl py-3 sm:py-6">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div><p className="text-xs font-black uppercase tracking-[0.18em] text-[#9A7600]">Launch your workspace</p><p className="mt-1 text-sm text-slate-500">Connect the restaurant data that powers ZestIQ.</p></div>
        <button type="button" disabled={saving} onClick={() => void saveAndExit()} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-60">{saving ? 'Saving…' : 'Save & exit'}</button>
      </div>
      <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
        <SetupProgress currentStep={currentStep.id} completedSteps={completedSteps} />
        <section className="rounded-[30px] border border-slate-100 bg-white p-5 shadow-sm sm:p-8">
          <StepHeading step={currentStep} />
          <div className="mt-8">
            {currentStep.id === 'restaurant' && (
              <form onSubmit={saveRestaurant} className="space-y-5">
                <div><FieldLabel htmlFor="restaurant-name">Restaurant or company name</FieldLabel><input id="restaurant-name" value={restaurantName} onChange={event => setRestaurantName(event.target.value)} className="h-13 w-full rounded-2xl border border-slate-200 px-4 text-base font-semibold outline-none focus:border-[#F5D62E]" placeholder="e.g. North & Vine" /></div>
                <div className="rounded-2xl bg-amber-50 p-4 text-sm leading-6 text-amber-900"><Sparkles className="mr-2 inline h-4 w-4" />This name stays inside your company workspace and appears on reports.</div>
                <StepActions saving={saving} label="Continue" />
              </form>
            )}
            {currentStep.id === 'location' && (
              <form onSubmit={saveLocation} className="space-y-5">
                <div><FieldLabel htmlFor="location-name">Location name</FieldLabel><input id="location-name" value={locationName} onChange={event => setLocationName(event.target.value)} className="h-13 w-full rounded-2xl border border-slate-200 px-4 font-semibold outline-none focus:border-[#F5D62E]" placeholder="e.g. King Street" /></div>
                <p className="rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">Inventory, counts, invoices, recipes, labour and schedules are isolated by location. Additional locations can be added to your plan later.</p>
                <StepActions saving={saving} label="Open dashboard" />
              </form>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function StepActions({ saving, label }: { saving: boolean; label: string }) {
  return (
    <div className="flex justify-end border-t border-slate-100 pt-5">
      <button type="submit" disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#F5D62E] px-5 py-3 font-black text-[#303A43] disabled:opacity-50">{saving ? 'Saving…' : label}<ArrowRight className="h-4 w-4" /></button>
    </div>
  );
}
