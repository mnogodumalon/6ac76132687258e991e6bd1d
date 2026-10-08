/**
 * useKostenvoranschlagErstellenFlow — the plumbing of the flow « Kostenvoranschlag erstellen », generated from the plan.
 *
 * Writes `kostenvoranschlaege`: asks `bemerkung`, `positionen`, `ersatzteile`, `reparaturauftrag`; sets `datum`, `freigabe_status` itself.
Changes `reparaturauftraege`: the record to change is picked (`flow.pick('reparaturauftraege')`), the form is prefilled with its values; ; sets `status` itself.
 * The hook OWNS: the form(s) with exactly these fields and the plan's required
 * ingredients, one record search per picked field (columns and filter from
 * the plan), and the submit plan with its fixed and derived values. A page
 * that only calls `flow.submit.run()` cannot write a field the plan does not
 * know — there is no way to spell it.
 *
 * YOU decide what a person notices, through the options:
 *   steps     which wizard step asks which field (default: one step per pick,
 *             then one for the typed fields, then "Prüfen" = step 5)
 *   items     how a search hit is displayed per pick (title, subtitle, status …)
 *   initial   prefills for typed fields
 *   messages  the sentence for an empty required field, per field
 *   compute   REQUIRED — the plan says these values are computed in the flow
 *             but leaves the rule to you: `gesamtbetrag` (derived:computed:Summe der Preise der gewählten Ersatzteile) *
 *   const flow = useKostenvoranschlagErstellenFlow({
 *     steps: { reparaturauftraege: 1, ersatzteile: 2, reparaturauftrag: 3, bemerkung: 4, positionen: 4 },
 *     items: { ersatzteile: r => ({ id: r.id, title: fieldText(r, 'bezeichnung') }) },
 *     compute: { gesamtbetrag: forms => null },
 *   });
 *   <IntentWizardShell forms={flow.forms} draftKey={flow.draftKey} …>
 *     <EntitySelectStep {...flow.picks.ersatzteile.select} {...flow.pickMany('ersatzteile')} />
 *     <EntitySelectStep {...flow.picks.reparaturauftrag.select} {...flow.pick('reparaturauftrag')} />
 *     // the record this flow changes: <EntitySelectStep {...flow.picks.reparaturauftraege.select} {...flow.pick('reparaturauftraege')} />
 *     <Bound form={flow.forms.kostenvoranschlaege} name="bemerkung" />
 *     <Bound form={flow.forms.kostenvoranschlaege} name="positionen" />
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
  type StepForm, type JourneyRecord, type RefContext, type SelectItemLike, type FormValues, type PlanStep, type SummaryItem,} from '@/lib/journey';
import { servicePort } from '@/services/journeyPort';
import { pickHint, whereSentence, type PickWhere } from '@/lib/journey/policy';
import { labelOf, optionsOf, type EntityKey } from '@/lib/journey/rules';
import { entityLabel } from '@/lib/journey/rules';
export type KostenvoranschlagErstellenFieldKey = 'bemerkung' | 'ersatzteile' | 'positionen' | 'reparaturauftraege' | 'reparaturauftrag';

export interface KostenvoranschlagErstellenForms {
  kostenvoranschlaege: StepForm<'kostenvoranschlaege'>;
  reparaturauftraege: StepForm<'reparaturauftraege'>;
}

// Alias so the option generics stay readable.
type Key = KostenvoranschlagErstellenFieldKey;

export interface KostenvoranschlagErstellenFlowOptions {
  /** field → wizard step that asks it; drives „Ändern“ links and answer chips. */
  steps?: Partial<Record<Key, number>>;
  initial?: Partial<Record<Key, unknown>>;
  messages?: Partial<Record<Key, string>>;
  /** How a search hit reads — the card's title/subtitle/status per pick. */
  items?: {
    ersatzteile?: (record: JourneyRecord, ctx: RefContext) => SelectItemLike;
    reparaturauftrag?: (record: JourneyRecord, ctx: RefContext) => SelectItemLike;
    reparaturauftraege?: (record: JourneyRecord, ctx: RefContext) => SelectItemLike;
  };
  /** The plan computes these in the flow but leaves the rule to the page. */
  compute: {
    gesamtbetrag: (forms: KostenvoranschlagErstellenForms) => unknown;   // derived:computed:Summe der Preise der gewählten Ersatzteile
  };
}

const DEFAULT_STEPS: Record<string, number> = {"bemerkung": 4, "ersatzteile": 2, "positionen": 4, "reparaturauftraege": 1, "reparaturauftrag": 3};
export const KOSTENVORANSCHLAGERSTELLEN_REVIEW_STEP = 5;

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

export function useKostenvoranschlagErstellenFlow(options: KostenvoranschlagErstellenFlowOptions) {
  const steps = { ...DEFAULT_STEPS, ...(options.steps ?? {}) } as Record<string, number>;
  const [reparaturauftraegeTargetId, setReparaturauftraegeTargetId] = useState<string | null>(null);
  const kostenvoranschlaege = useStepForm('kostenvoranschlaege', {
    fields: ["bemerkung", "positionen", "ersatzteile", "reparaturauftrag"],
    steps: only(steps, ["bemerkung", "positionen", "ersatzteile", "reparaturauftrag"]) as Record<string, number>,
    // the plan builds a value from these — required here, whatever the app's base view says
    required: { ersatzteile: true },
    initial: only(options.initial as FormValues | undefined, ["bemerkung", "positionen", "ersatzteile", "reparaturauftrag"]),
    messages: only(options.messages as Record<string, string> | undefined, ["bemerkung", "positionen", "ersatzteile", "reparaturauftrag"]),
  });
  const reparaturauftraege = useStepForm('reparaturauftraege', {
    fields: [],
    steps: only(steps, []) as Record<string, number>,
    initial: only(options.initial as FormValues | undefined, []),
    messages: only(options.messages as Record<string, string> | undefined, []),
  });
  const forms: KostenvoranschlagErstellenForms = { kostenvoranschlaege, reparaturauftraege };
  const formList: StepForm[] = [kostenvoranschlaege, reparaturauftraege];

  // The owner's rules after the build (intent-policies.json): a fixed value
  // for a field this flow sets itself, a narrower or wider pick — read at
  // render time, so a change works on the running application.
  usePolicyVersion();
  const searches = {
    ersatzteile: useRecordSearch(servicePort, 'ersatzteile', withPickPolicy('ersatzteile', {
      searchFields: ["bezeichnung", "artikelnummer"] as never,
      toItem: options.items?.ersatzteile as never,
    })),
    reparaturauftrag: useRecordSearch(servicePort, 'reparaturauftraege', withPickPolicy('reparaturauftrag', {
      searchFields: ["problembeschreibung"] as never,
      filter: "r.v_status in ['bestaetigt', 'in_bearbeitung']",
      where: (r: JourneyRecord) => ["bestaetigt", "in_bearbeitung"].includes(fieldLookup(r, "status")?.key ?? ''),
      toItem: options.items?.reparaturauftrag as never,
    })),
    reparaturauftraege: useRecordSearch(servicePort, 'reparaturauftraege', withPickPolicy('reparaturauftraege', {
      searchFields: ["problembeschreibung"] as never,
      filter: "r.v_status in ['bestaetigt', 'in_bearbeitung']",
      where: (r: JourneyRecord) => ["bestaetigt", "in_bearbeitung"].includes(fieldLookup(r, "status")?.key ?? ''),
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
    `#/verwaltung/anwendung?line=intent:kostenvoranschlag-erstellen:read:${entity}`);
  // a fixed value the flow sets itself, as a review row with the link that changes it
  const setting = (entity: EntityKey, field: string, value: unknown): SummaryItem => ({
    key: `setting:${entity}.${field}`, label: labelOf(entity, field),
    value: optionsOf(entity, field).find(o => o.key === String(value))?.label ?? String(value ?? ''),
    href: `#/verwaltung/anwendung?line=intent:kostenvoranschlag-erstellen:write:${entity}.${field}`,
  });
  const picks = {
    ersatzteile: { ...searches.ersatzteile, select: { ...searches.ersatzteile.select, create: false as boolean, hint: hintFor('ersatzteile', 'ersatzteile', null as PickWhere | null) } },
    reparaturauftrag: { ...searches.reparaturauftrag, select: { ...searches.reparaturauftrag.select, create: false as boolean, hint: hintFor('reparaturauftrag', 'reparaturauftraege', {"conditions": [{"field": "status", "op": "in", "value": ["bestaetigt", "in_bearbeitung"]}], "mode": "all"} as PickWhere | null) } },
    reparaturauftraege: { ...searches.reparaturauftraege, select: { ...searches.reparaturauftraege.select, create: false as boolean, hint: hintFor('reparaturauftraege', 'reparaturauftraege', {"conditions": [{"field": "status", "op": "in", "value": ["bestaetigt", "in_bearbeitung"]}], "mode": "all"} as PickWhere | null) } },
  };

  const plan: PlanStep[] = [
    {
      key: 'kostenvoranschlaege', entity: 'kostenvoranschlaege', form: kostenvoranschlaege, primary: true,
      values: (): FormValues => ({
        datum: policyFixedValue('kostenvoranschlaege', 'datum') ?? todayIso(),
        freigabe_status: policyFixedValue('kostenvoranschlaege', 'freigabe_status') ?? "offen",
        gesamtbetrag: options.compute.gesamtbetrag(forms),
      }),

      // the review shows what this step sets itself — changeable on „Deine Anwendung“, not here
      settings: () => [setting('kostenvoranschlaege', 'freigabe_status', policyFixedValue('kostenvoranschlaege', 'freigabe_status') ?? "offen")],
    },
    {
      key: 'reparaturauftraege', entity: 'reparaturauftraege', form: reparaturauftraege,
      updates: () => reparaturauftraegeTargetId ?? undefined,
      // the review names the record this step changes; "Ändern" leads back to its pick
      target: () => reparaturauftraegeTargetId
        ? { key: 'target:reparaturauftraege', label: entityLabel('reparaturauftraege'), value: picks.reparaturauftraege.labelOf(reparaturauftraegeTargetId) ?? reparaturauftraegeTargetId, step: steps.reparaturauftraege }
        : undefined,
      values: (): FormValues => ({
        status: policyFixedValue('reparaturauftraege', 'status') ?? "wartet_auf_freigabe",
      }),

      // the review shows what this step sets itself — changeable on „Deine Anwendung“, not here
      settings: () => [setting('reparaturauftraege', 'status', policyFixedValue('reparaturauftraege', 'status') ?? "wartet_auf_freigabe")],
    },
  ];

  const submit = useJourneySubmit(servicePort, plan, { draftKey: 'kostenvoranschlag-erstellen' });

  /** The record(s) this flow CHANGES: picked through {...flow.picks.<entity>.select} {...flow.pick('<entity>')};
   *  picking prefills the form with the record's current values, and the plan step updates that record. */
  const targets = {
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
  const pick = (field: KostenvoranschlagErstellenFieldKey) => {
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
  const pickMany = (field: KostenvoranschlagErstellenFieldKey) => {
    const owner = formList.find(f => f.keys.includes(field)) ?? formList[0];
    const search = (picks as Record<string, { labelOf(id: string): string | undefined }>)[field];
    return owner.records(field, id => search?.labelOf(id));
  };
  /** Validate every field the wizard asks in step `n` — for StepNav.onNext. */
  const validateStep = (n: number): boolean =>
    formList.every(f => f.validate(f.keys.filter(k => steps[k] === n)))    && Object.entries(targets).every(([k, t]) => steps[k] !== n || !!t.selectedId);
  const reset = () => { submit.reset(); formList.forEach(f => f.reset()); setReparaturauftraegeTargetId(null); };

  return {
    slug: 'kostenvoranschlag-erstellen' as const,
    draftKey: 'kostenvoranschlag-erstellen' as const,
    entity: 'kostenvoranschlaege' as const,
    form: kostenvoranschlaege,
    forms, formList, picks, submit, steps, targets,    reviewStep: KOSTENVORANSCHLAGERSTELLEN_REVIEW_STEP,
    pick, pickMany, validateStep, reset,
    // the door the hook reads through — for what it does not own: availability
    // (useOccupancy(flow.port, …)), a count (useRecordCount(flow.port, …)). A page
    // importing servicePort next to the hook fails gate 3 (fewo 05.10.2026: the
    // gate taught useOccupancy(servicePort, …) and forbade servicePort at once)
    port: servicePort,
  };
}

export type KostenvoranschlagErstellenFlow = ReturnType<typeof useKostenvoranschlagErstellenFlow>;
