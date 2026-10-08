/**
 * useAuftragAnnehmenFlow — the plumbing of the flow « Reparaturauftrag annehmen », generated from the plan.
 *
 * Writes `kunden` (only when the person fills it): asks `kunde_vorname`, `kunde_nachname`, `email`, `telefon`.
Writes `fahrraeder` (only when the person fills it): asks `besitzer`, `marke`, `modell`, `fahrradtyp`, `rahmengroesse`, `rahmennummer`, `kaufdatum`; links `besitzer` ← the created `kunden`.
Writes `reparaturauftraege`: asks `kunde`, `fahrrad`, `problembeschreibung`, `prioritaet`, `wunschtermin`; sets `status` itself; links `kunde` ← the created `kunden`, `fahrrad` ← the created `fahrraeder`.
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
 *
 *   const flow = useAuftragAnnehmenFlow({
 *     steps: { besitzer: 1, kunde: 2, fahrrad: 3, kunde_vorname: 4, kunde_nachname: 4, email: 4, telefon: 4, marke: 4, modell: 4, fahrradtyp: 4, rahmengroesse: 4, rahmennummer: 4, kaufdatum: 4, problembeschreibung: 4, prioritaet: 4, wunschtermin: 4 },
 *     items: { besitzer: r => ({ id: r.id, title: fieldText(r, 'kunde_vorname') }) },
 *   });
 *   <IntentWizardShell forms={flow.forms} draftKey={flow.draftKey} …>
 *     <EntitySelectStep {...flow.picks.besitzer.select} {...flow.pick('besitzer')} />
 *     <EntitySelectStep {...flow.picks.kunde.select} {...flow.pick('kunde')} />
 *     <EntitySelectStep {...flow.picks.fahrrad.select} {...flow.pick('fahrrad')} />
 *     <Bound form={flow.forms.kunden} name="kunde_vorname" />
 *     <Bound form={flow.forms.kunden} name="kunde_nachname" />
 *     <Bound form={flow.forms.kunden} name="email" />
 *     <Bound form={flow.forms.kunden} name="telefon" />
 *     <Bound form={flow.forms.fahrraeder} name="marke" />
 *     <Bound form={flow.forms.fahrraeder} name="modell" />
 *     <Bound form={flow.forms.fahrraeder} name="fahrradtyp" />
 *     <Bound form={flow.forms.fahrraeder} name="rahmengroesse" />
 *     <Bound form={flow.forms.fahrraeder} name="rahmennummer" />
 *     <Bound form={flow.forms.fahrraeder} name="kaufdatum" />
 *     <Bound form={flow.forms.reparaturauftraege} name="problembeschreibung" />
 *     <Bound form={flow.forms.reparaturauftraege} name="prioritaet" />
 *     <Bound form={flow.forms.reparaturauftraege} name="wunschtermin" />
 *     <StepNav onNext={() => flow.validateStep(n)} />
 *     {!flow.submit.done && <SummaryStep forms={flow.formList} submit={flow.submit} />}
 *     {flow.submit.result && <SuccessStep result={flow.submit.result} forms={flow.formList} submit={flow.submit} />}
 *   </IntentWizardShell>
 */
import {
  useStepForm, useJourneySubmit, useRecordSearch,
  fieldText, fieldLookup, fieldLookups, fieldNumber, fieldDate, fieldRef,
  todayIso, nowIso, isEmptyValue, policyFixedValue, withPickPolicy, usePolicyVersion,
  type StepForm, type JourneyRecord, type RefContext, type SelectItemLike, type FormValues, type PlanStep, type SummaryItem,} from '@/lib/journey';
import { servicePort } from '@/services/journeyPort';
import { pickHint, whereSentence, type PickWhere } from '@/lib/journey/policy';
import { labelOf, optionsOf, type EntityKey } from '@/lib/journey/rules';
export type AuftragAnnehmenFieldKey = 'besitzer' | 'email' | 'fahrrad' | 'fahrradtyp' | 'kaufdatum' | 'kunde' | 'kunde_nachname' | 'kunde_vorname' | 'marke' | 'modell' | 'prioritaet' | 'problembeschreibung' | 'rahmengroesse' | 'rahmennummer' | 'telefon' | 'wunschtermin';

export interface AuftragAnnehmenForms {
  kunden: StepForm<'kunden'>;
  fahrraeder: StepForm<'fahrraeder'>;
  reparaturauftraege: StepForm<'reparaturauftraege'>;
}

// Alias so the option generics stay readable.
type Key = AuftragAnnehmenFieldKey;

export interface AuftragAnnehmenFlowOptions {
  /** field → wizard step that asks it; drives „Ändern“ links and answer chips. */
  steps?: Partial<Record<Key, number>>;
  initial?: Partial<Record<Key, unknown>>;
  messages?: Partial<Record<Key, string>>;
  /** How a search hit reads — the card's title/subtitle/status per pick. */
  items?: {
    besitzer?: (record: JourneyRecord, ctx: RefContext) => SelectItemLike;
    kunde?: (record: JourneyRecord, ctx: RefContext) => SelectItemLike;
    fahrrad?: (record: JourneyRecord, ctx: RefContext) => SelectItemLike;
  };
}

const DEFAULT_STEPS: Record<string, number> = {"besitzer": 1, "email": 4, "fahrrad": 3, "fahrradtyp": 4, "kaufdatum": 4, "kunde": 2, "kunde_nachname": 4, "kunde_vorname": 4, "marke": 4, "modell": 4, "prioritaet": 4, "problembeschreibung": 4, "rahmengroesse": 4, "rahmennummer": 4, "telefon": 4, "wunschtermin": 4};
export const AUFTRAGANNEHMEN_REVIEW_STEP = 5;

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

export function useAuftragAnnehmenFlow(options: AuftragAnnehmenFlowOptions = {}) {
  const steps = { ...DEFAULT_STEPS, ...(options.steps ?? {}) } as Record<string, number>;
  const kunden = useStepForm('kunden', {
    fields: ["kunde_vorname", "kunde_nachname", "email", "telefon"],
    steps: only(steps, ["kunde_vorname", "kunde_nachname", "email", "telefon"]) as Record<string, number>,
    initial: only(options.initial as FormValues | undefined, ["kunde_vorname", "kunde_nachname", "email", "telefon"]),
    messages: only(options.messages as Record<string, string> | undefined, ["kunde_vorname", "kunde_nachname", "email", "telefon"]),
  });
  const fahrraeder = useStepForm('fahrraeder', {
    fields: ["besitzer", "marke", "modell", "fahrradtyp", "rahmengroesse", "rahmennummer", "kaufdatum"],
    steps: only(steps, ["besitzer", "marke", "modell", "fahrradtyp", "rahmengroesse", "rahmennummer", "kaufdatum"]) as Record<string, number>,
    initial: only(options.initial as FormValues | undefined, ["besitzer", "marke", "modell", "fahrradtyp", "rahmengroesse", "rahmennummer", "kaufdatum"]),
    messages: only(options.messages as Record<string, string> | undefined, ["besitzer", "marke", "modell", "fahrradtyp", "rahmengroesse", "rahmennummer", "kaufdatum"]),
  });
  const reparaturauftraege = useStepForm('reparaturauftraege', {
    fields: ["kunde", "fahrrad", "problembeschreibung", "prioritaet", "wunschtermin"],
    steps: only(steps, ["kunde", "fahrrad", "problembeschreibung", "prioritaet", "wunschtermin"]) as Record<string, number>,
    // the plan builds a value from these — required here, whatever the app's base view says
    required: { wunschtermin: true },
    initial: only(options.initial as FormValues | undefined, ["kunde", "fahrrad", "problembeschreibung", "prioritaet", "wunschtermin"]),
    messages: only(options.messages as Record<string, string> | undefined, ["kunde", "fahrrad", "problembeschreibung", "prioritaet", "wunschtermin"]),
  });
  const forms: AuftragAnnehmenForms = { kunden, fahrraeder, reparaturauftraege };
  const formList: StepForm[] = [kunden, fahrraeder, reparaturauftraege];

  // The owner's rules after the build (intent-policies.json): a fixed value
  // for a field this flow sets itself, a narrower or wider pick — read at
  // render time, so a change works on the running application.
  usePolicyVersion();
  const searches = {
    besitzer: useRecordSearch(servicePort, 'kunden', withPickPolicy('besitzer', {
      searchFields: ["kunde_vorname", "kunde_nachname", "email"] as never,
      toItem: options.items?.besitzer as never,
    })),
    kunde: useRecordSearch(servicePort, 'kunden', withPickPolicy('kunde', {
      searchFields: ["kunde_vorname", "kunde_nachname", "email"] as never,
      toItem: options.items?.kunde as never,
    })),
    fahrrad: useRecordSearch(servicePort, 'fahrraeder', withPickPolicy('fahrrad', {
      searchFields: ["marke", "modell", "rahmennummer"] as never,
      toItem: options.items?.fahrrad as never,
    })),
  };
  // Whether a pick offers „Neu anlegen“ is the plan's call: off for the record
  // this flow changes, for multi picks, for a catalogue entity and for an
  // entity with its own flow. The page spreads `.select` and writes no `create=`.
  // what the person sees under the search field: the rule that narrows the
  // pick (the owner's, else the plan's) — and the link that changes it
  const hintFor = (key: string, entity: EntityKey, planned: PickWhere | null) => pickHint(key, planned,
    w => whereSentence(w, f => labelOf(entity, f), (f, v) => optionsOf(entity, f).find(o => o.key === String(v))?.label ?? String(v)),
    `#/verwaltung/anwendung?line=intent:auftrag-annehmen:read:${entity}`);
  // a fixed value the flow sets itself, as a review row with the link that changes it
  const setting = (entity: EntityKey, field: string, value: unknown): SummaryItem => ({
    key: `setting:${entity}.${field}`, label: labelOf(entity, field),
    value: optionsOf(entity, field).find(o => o.key === String(value))?.label ?? String(value ?? ''),
    href: `#/verwaltung/anwendung?line=intent:auftrag-annehmen:write:${entity}.${field}`,
  });
  const picks = {
    besitzer: { ...searches.besitzer, select: { ...searches.besitzer.select, create: false as boolean, hint: hintFor('besitzer', 'kunden', null as PickWhere | null) } },
    kunde: { ...searches.kunde, select: { ...searches.kunde.select, create: false as boolean, hint: hintFor('kunde', 'kunden', null as PickWhere | null) } },
    fahrrad: { ...searches.fahrrad, select: { ...searches.fahrrad.select, create: false as boolean, hint: hintFor('fahrrad', 'fahrraeder', null as PickWhere | null) } },
  };

  const kundenFilled = hasValues(kunden);
  const fahrraederFilled = hasValues(fahrraeder);
  const plan: PlanStep[] = [
    ...(kundenFilled ? [{
      key: 'kunden', entity: 'kunden', form: kunden,    } as PlanStep] : []),
    ...(fahrraederFilled ? [{
      key: 'fahrraeder', entity: 'fahrraeder', form: fahrraeder,      needs: [kundenFilled ? 'kunden' : null].filter((x): x is string => !!x),
      link: { ...(kundenFilled ? { besitzer: 'kunden' } : {}) },
    } as PlanStep] : []),
    {
      key: 'reparaturauftraege', entity: 'reparaturauftraege', form: reparaturauftraege, primary: true,      needs: [kundenFilled ? 'kunden' : null, fahrraederFilled ? 'fahrraeder' : null].filter((x): x is string => !!x),
      link: { ...(kundenFilled ? { kunde: 'kunden' } : {}), ...(fahrraederFilled ? { fahrrad: 'fahrraeder' } : {}) },

      values: (): FormValues => ({
        status: policyFixedValue('reparaturauftraege', 'status') ?? "bestaetigt",
      }),

      // the review shows what this step sets itself — changeable on „Deine Anwendung“, not here
      settings: () => [setting('reparaturauftraege', 'status', policyFixedValue('reparaturauftraege', 'status') ?? "bestaetigt")],

      // the planner's assumptions that first act here — shown once with „Passt“ / „ändern“
      notices: () => [{"assumed": "Best\u00e4tigt", "id": "startstatus-annahme", "question": "Mit welchem Status startet ein in der Werkstatt angenommener Auftrag?"}, {"assumed": "Aus dem Wunschtermin \u00fcbernommen", "id": "uebergabetermin-vorschlag", "question": "Soll der Wunschtermin als \u00dcbergabetermin \u00fcbernommen werden?"}],
    },
  ];

  const submit = useJourneySubmit(servicePort, plan, { draftKey: 'auftrag-annehmen' });

  /** Props for a single-record pick step: {...flow.picks.x.select} {...flow.pick('x')} */
  const pick = (field: AuftragAnnehmenFieldKey) => {
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
  const pickMany = (field: AuftragAnnehmenFieldKey) => {
    const owner = formList.find(f => f.keys.includes(field)) ?? formList[0];
    const search = (picks as Record<string, { labelOf(id: string): string | undefined }>)[field];
    return owner.records(field, id => search?.labelOf(id));
  };
  /** Validate every field the wizard asks in step `n` — for StepNav.onNext. */
  const validateStep = (n: number): boolean =>
    formList.every(f => f.validate(f.keys.filter(k => steps[k] === n)));
  const reset = () => { submit.reset(); formList.forEach(f => f.reset()); };

  return {
    slug: 'auftrag-annehmen' as const,
    draftKey: 'auftrag-annehmen' as const,
    entity: 'reparaturauftraege' as const,
    form: reparaturauftraege,
    forms, formList, picks, submit, steps,    reviewStep: AUFTRAGANNEHMEN_REVIEW_STEP,
    pick, pickMany, validateStep, reset,
    // the door the hook reads through — for what it does not own: availability
    // (useOccupancy(flow.port, …)), a count (useRecordCount(flow.port, …)). A page
    // importing servicePort next to the hook fails gate 3 (fewo 05.10.2026: the
    // gate taught useOccupancy(servicePort, …) and forbade servicePort at once)
    port: servicePort,
  };
}

export type AuftragAnnehmenFlow = ReturnType<typeof useAuftragAnnehmenFlow>;
