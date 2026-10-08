/**
 * useFreigabeErfassenFlow — the plumbing of the flow « Freigabe erfassen », generated from the plan.
 *
 * Changes `kostenvoranschlaege`: the record to change is picked (`flow.pick('kostenvoranschlaege')`), the form is prefilled with its values; asks `freigabe_status`.
Changes `reparaturauftraege`: the record to change is picked (`flow.pick('reparaturauftraege')`), the form is prefilled with its values; .
 * The hook OWNS: the form(s) with exactly these fields and the plan's required
 * ingredients, one record search per picked field (columns and filter from
 * the plan), and the submit plan with its fixed and derived values. A page
 * that only calls `flow.submit.run()` cannot write a field the plan does not
 * know — there is no way to spell it.
 *
 * YOU decide what a person notices, through the options:
 *   steps     which wizard step asks which field (default: one step per pick,
 *             then one for the typed fields, then "Prüfen" = step 4)
 *   items     how a search hit is displayed per pick (title, subtitle, status …)
 *   initial   prefills for typed fields
 *   messages  the sentence for an empty required field, per field
 *   compute   REQUIRED — the plan says these values are computed in the flow
 *             but leaves the rule to you: `status` (derived:computed:Bei Freigabe „In Bearbeitung“, bei Ablehnung „Storniert“) *
 *   const flow = useFreigabeErfassenFlow({
 *     steps: { kostenvoranschlaege: 1, reparaturauftraege: 2, freigabe_status: 3 },
 *     items: { kostenvoranschlaege: r => ({ id: r.id, title: fieldText(r, 'positionen') }) },
 *     compute: { status: forms => null },
 *   });
 *   <IntentWizardShell forms={flow.forms} draftKey={flow.draftKey} …>
 *     // the record this flow changes: <EntitySelectStep {...flow.picks.kostenvoranschlaege.select} {...flow.pick('kostenvoranschlaege')} />
 *     // the record this flow changes: <EntitySelectStep {...flow.picks.reparaturauftraege.select} {...flow.pick('reparaturauftraege')} />
 *     <Bound form={flow.forms.kostenvoranschlaege} name="freigabe_status" />
 *     <StepNav onNext={() => flow.validateStep(n)} />
 *     {!flow.submit.done && <SummaryStep forms={flow.formList} submit={flow.submit} />}
 *     {flow.submit.result && <SuccessStep result={flow.submit.result} forms={flow.formList} submit={flow.submit} />}
 *   </IntentWizardShell>
 */
import { useState } from 'react';
import {
  useStepForm, useJourneySubmit, useRecordSearch,
  fieldText, fieldLookup, fieldLookups, fieldNumber, fieldDate, fieldRef,
  todayIso, nowIso, isEmptyValue, policyFixedValue, withPickPolicy, usePolicyVersion,
  type StepForm, type JourneyRecord, type RefContext, type SelectItemLike, type FormValues, type PlanStep,} from '@/lib/journey';
import { servicePort } from '@/services/journeyPort';
import { pickHint, whereSentence, type PickWhere } from '@/lib/journey/policy';
import { labelOf, optionsOf, type EntityKey } from '@/lib/journey/rules';
import { entityLabel } from '@/lib/journey/rules';
export type FreigabeErfassenFieldKey = 'freigabe_status' | 'kostenvoranschlaege' | 'reparaturauftraege';

export interface FreigabeErfassenForms {
  kostenvoranschlaege: StepForm<'kostenvoranschlaege'>;
  reparaturauftraege: StepForm<'reparaturauftraege'>;
}

// Alias so the option generics stay readable.
type Key = FreigabeErfassenFieldKey;

export interface FreigabeErfassenFlowOptions {
  /** field → wizard step that asks it; drives „Ändern“ links and answer chips. */
  steps?: Partial<Record<Key, number>>;
  initial?: Partial<Record<Key, unknown>>;
  messages?: Partial<Record<Key, string>>;
  /** How a search hit reads — the card's title/subtitle/status per pick. */
  items?: {
    kostenvoranschlaege?: (record: JourneyRecord, ctx: RefContext) => SelectItemLike;
    reparaturauftraege?: (record: JourneyRecord, ctx: RefContext) => SelectItemLike;
  };
  /** The plan computes these in the flow but leaves the rule to the page. */
  compute: {
    status: (forms: FreigabeErfassenForms) => unknown;   // derived:computed:Bei Freigabe „In Bearbeitung“, bei Ablehnung „Storniert“
  };
}

const DEFAULT_STEPS: Record<string, number> = {"freigabe_status": 3, "kostenvoranschlaege": 1, "reparaturauftraege": 2};
export const FREIGABEERFASSEN_REVIEW_STEP = 4;

function fromPick<T>(pick: { recordOf(id: string): JourneyRecord | undefined }, form: StepForm, field: string, read: (r: JourneyRecord) => T): T | undefined {
  const id = form.get(field);
  const rec = typeof id === 'string' && id ? pick.recordOf(id) : undefined;
  return rec ? read(rec) : undefined;
}
function isoDaysFromToday(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// Returns T, not Partial<T>: a Record's index signature is already "maybe
// absent", and Partial<Record<string, string>> does not assign to the
// Record<string, string> useStepForm wants (tsc, live 23.09.2026 — eight
// errors, one per hook, caught only in the sandbox build).
function only<T extends Record<string, unknown>>(obj: T | undefined, keys: string[]): T | undefined {
  if (!obj) return undefined;
  const out: Record<string, unknown> = {};
  for (const k of keys) if (k in obj) out[k] = obj[k];
  return out as T;
}

function hasValues(form: StepForm): boolean {
  return form.keys.some(k => !isEmptyValue(form.values[k]));
}

export function useFreigabeErfassenFlow(options: FreigabeErfassenFlowOptions) {
  const steps = { ...DEFAULT_STEPS, ...(options.steps ?? {}) } as Record<string, number>;
  const [kostenvoranschlaegeTargetId, setKostenvoranschlaegeTargetId] = useState<string | null>(null);
  const [reparaturauftraegeTargetId, setReparaturauftraegeTargetId] = useState<string | null>(null);
  const kostenvoranschlaege = useStepForm('kostenvoranschlaege', {
    fields: ["freigabe_status"],
    steps: only(steps, ["freigabe_status"]) as Record<string, number>,
    initial: only(options.initial as FormValues | undefined, ["freigabe_status"]),
    messages: only(options.messages as Record<string, string> | undefined, ["freigabe_status"]),
  });
  const reparaturauftraege = useStepForm('reparaturauftraege', {
    fields: [],
    steps: only(steps, []) as Record<string, number>,
    initial: only(options.initial as FormValues | undefined, []),
    messages: only(options.messages as Record<string, string> | undefined, []),
  });
  const forms: FreigabeErfassenForms = { kostenvoranschlaege, reparaturauftraege };
  const formList: StepForm[] = [kostenvoranschlaege, reparaturauftraege];

  // The owner's rules after the build (intent-policies.json): a fixed value
  // for a field this flow sets itself, a narrower or wider pick — read at
  // render time, so a change works on the running application.
  usePolicyVersion();
  const searches = {
    kostenvoranschlaege: useRecordSearch(servicePort, 'kostenvoranschlaege', withPickPolicy('kostenvoranschlaege', {
      searchFields: ["positionen"] as never,
      filter: "r.v_freigabe_status == 'offen'",
      where: (r: JourneyRecord) => (fieldLookup(r, "freigabe_status")?.key ?? null) === "offen",
      toItem: options.items?.kostenvoranschlaege as never,
    })),
    reparaturauftraege: useRecordSearch(servicePort, 'reparaturauftraege', withPickPolicy('reparaturauftraege', {
      searchFields: ["problembeschreibung"] as never,
      toItem: options.items?.reparaturauftraege as never,
    })),
  };
  // Whether a pick offers „Neu anlegen“ is the plan's call: off for the record
  // this flow changes, for multi picks, for a catalogue entity and for an
  // entity with its own flow. The page spreads `.select` and writes no `create=`.
  // what the person sees under the search field: the rule that narrows the
  // pick (the owner's, else the plan's) — and the link that changes it
  const hintFor = (key: string, entity: EntityKey, planned: PickWhere | null) => pickHint(key, planned,
    w => whereSentence(w, f => labelOf(entity, f), (f, v) => optionsOf(entity, f).find(o => o.key === String(v))?.label ?? String(v)),
    `#/verwaltung/anwendung?line=intent:freigabe-erfassen:read:${entity}`);
  const picks = {
    kostenvoranschlaege: { ...searches.kostenvoranschlaege, select: { ...searches.kostenvoranschlaege.select, create: false as boolean, hint: hintFor('kostenvoranschlaege', 'kostenvoranschlaege', {"conditions": [{"field": "freigabe_status", "op": "eq", "value": "offen"}], "mode": "all"} as PickWhere | null) } },
    reparaturauftraege: { ...searches.reparaturauftraege, select: { ...searches.reparaturauftraege.select, create: false as boolean, hint: hintFor('reparaturauftraege', 'reparaturauftraege', null as PickWhere | null) } },
  };

  const plan: PlanStep[] = [
    {
      key: 'kostenvoranschlaege', entity: 'kostenvoranschlaege', form: kostenvoranschlaege,
      updates: () => kostenvoranschlaegeTargetId ?? undefined,
      // the review names the record this step changes; "Ändern" leads back to its pick
      target: () => kostenvoranschlaegeTargetId
        ? { key: 'target:kostenvoranschlaege', label: entityLabel('kostenvoranschlaege'), value: picks.kostenvoranschlaege.labelOf(kostenvoranschlaegeTargetId) ?? kostenvoranschlaegeTargetId, step: steps.kostenvoranschlaege }
        : undefined,    },
    {
      key: 'reparaturauftraege', entity: 'reparaturauftraege', form: reparaturauftraege, primary: true,
      updates: () => reparaturauftraegeTargetId ?? undefined,
      // the review names the record this step changes; "Ändern" leads back to its pick
      target: () => reparaturauftraegeTargetId
        ? { key: 'target:reparaturauftraege', label: entityLabel('reparaturauftraege'), value: picks.reparaturauftraege.labelOf(reparaturauftraegeTargetId) ?? reparaturauftraegeTargetId, step: steps.reparaturauftraege }
        : undefined,
      values: (): FormValues => ({
        status: options.compute.status(forms),
      }),
    },
  ];

  const submit = useJourneySubmit(servicePort, plan, { draftKey: 'freigabe-erfassen' });

  /** The record(s) this flow CHANGES: picked through {...flow.picks.<entity>.select} {...flow.pick('<entity>')};
   *  picking prefills the form with the record's current values, and the plan step updates that record. */
  const targets = {
    kostenvoranschlaege: {
      selectedId: kostenvoranschlaegeTargetId,
      onSelect: (id: string) => {
        setKostenvoranschlaegeTargetId(id);
        const rec = picks.kostenvoranschlaege.recordOf(id);
        if (rec) kostenvoranschlaege.reset({ freigabe_status: fieldLookup(rec, "freigabe_status")?.key, });
      },
      get record(): JourneyRecord | undefined { return kostenvoranschlaegeTargetId ? picks.kostenvoranschlaege.recordOf(kostenvoranschlaegeTargetId) : undefined; },
    },
    reparaturauftraege: {
      selectedId: reparaturauftraegeTargetId,
      onSelect: (id: string) => {
        setReparaturauftraegeTargetId(id);
        const rec = picks.reparaturauftraege.recordOf(id);
        if (rec) reparaturauftraege.reset({ });
      },
      get record(): JourneyRecord | undefined { return reparaturauftraegeTargetId ? picks.reparaturauftraege.recordOf(reparaturauftraegeTargetId) : undefined; },
    },
  };
  /** Props for a single-record pick step: {...flow.picks.x.select} {...flow.pick('x')} */
  const pick = (field: FreigabeErfassenFieldKey) => {
    if (field in targets) {
      const t = targets[field as keyof typeof targets];
      return { selectedId: t.selectedId, onSelect: t.onSelect };
    }
    const owner = formList.find(f => f.keys.includes(field)) ?? formList[0];
    const search = (picks as Record<string, { labelOf(id: string): string | undefined }>)[field];
    return {
      selectedId: (typeof owner.get(field) === 'string' ? (owner.get(field) as string) : null) || null,
      // `field as never` collapsed the conditional SetArgs<E, never> to never and
      // no argument was assignable any more (tsc, live 23.09.2026); widen `set`
      // itself instead — the label stays a required third argument.
      onSelect: (id: string) => (owner.set as (k: string, v: unknown, l?: string) => void)(field, id, search?.labelOf(id)),
    };
  };
  /** Props for a multi-record pick step: {...flow.picks.x.select} {...flow.pickMany('x')} */
  const pickMany = (field: FreigabeErfassenFieldKey) => {
    const owner = formList.find(f => f.keys.includes(field)) ?? formList[0];
    const search = (picks as Record<string, { labelOf(id: string): string | undefined }>)[field];
    return owner.records(field, id => search?.labelOf(id));
  };
  /** Validate every field the wizard asks in step `n` — for StepNav.onNext. */
  const validateStep = (n: number): boolean =>
    formList.every(f => f.validate(f.keys.filter(k => steps[k] === n)))    && Object.entries(targets).every(([k, t]) => steps[k] !== n || !!t.selectedId);
  const reset = () => { submit.reset(); formList.forEach(f => f.reset()); setKostenvoranschlaegeTargetId(null); setReparaturauftraegeTargetId(null); };

  return {
    slug: 'freigabe-erfassen' as const,
    draftKey: 'freigabe-erfassen' as const,
    entity: 'reparaturauftraege' as const,
    form: reparaturauftraege,
    forms, formList, picks, submit, steps, targets,    reviewStep: FREIGABEERFASSEN_REVIEW_STEP,
    pick, pickMany, validateStep, reset,
    // the door the hook reads through — for what it does not own: availability
    // (useOccupancy(flow.port, …)), a count (useRecordCount(flow.port, …)). A page
    // importing servicePort next to the hook fails gate 3 (fewo 05.10.2026: the
    // gate taught useOccupancy(servicePort, …) and forbade servicePort at once)
    port: servicePort,
  };
}

export type FreigabeErfassenFlow = ReturnType<typeof useFreigabeErfassenFlow>;
