/**
 * Kostenvoranschlag erstellen — 4-Schritt-Wizard.
 * Steps: 1) Reparaturauftrag wählen → 2) Ersatzteile wählen → 3) Positionen beschreiben → 4) Prüfen & speichern.
 * Reads: reparaturauftraege, ersatzteile. Writes: kostenvoranschlaege (neu), reparaturauftraege (Status → wartet auf Freigabe).
 * Composes: IntentWizardShell, EntitySelectStep, Field, Bound, StepNav, SummaryStep, SuccessStep.
 */
import { useRef, useState } from 'react';
import { IntentWizardShell, WizardStep } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { Bound } from '@/components/blocks/Bound';
import { Field } from '@/components/blocks/Field';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { fieldText, fieldNumber } from '@/lib/journey';
import type { JourneyRecord } from '@/lib/journey';
import { useKostenvoranschlagErstellenFlow } from '@/lib/journey/flows/KostenvoranschlagErstellen';
import { formatCurrency } from '@/lib/formatters';
import { tx } from '@/i18n';

function sumPrices(ids: string[], recordOf: ((id: string) => JourneyRecord | undefined) | null): number {
  return ids.reduce((sum, id) => {
    const rec = recordOf?.(id);
    return sum + (rec ? fieldNumber(rec, 'preis') ?? 0 : 0);
  }, 0);
}

export default function KostenvoranschlagErstellenPage() {
  const [step, setStep] = useState(1);
  const recordOfRef = useRef<((id: string) => JourneyRecord | undefined) | null>(null);

  const flow = useKostenvoranschlagErstellenFlow({
    steps: { reparaturauftraege: 1, reparaturauftrag: 1, ersatzteile: 2, positionen: 3, bemerkung: 3 },
    items: {
      reparaturauftraege: (r, ctx) => ({
        id: r.id,
        title: fieldText(r, 'problembeschreibung') || tx('Ohne Beschreibung'),
        subtitle: [ctx.ref('kunde'), ctx.ref('fahrrad')].filter(Boolean).join(' · '),
      }),
      ersatzteile: e => {
        const preis = fieldNumber(e, 'preis');
        const lager = fieldNumber(e, 'lagerbestand');
        return {
          id: e.id,
          title: fieldText(e, 'bezeichnung'),
          subtitle: fieldText(e, 'artikelnummer'),
          stats: [
            { label: tx('Preis'), value: preis == null ? '—' : formatCurrency(preis) },
            { label: tx('Lager'), value: lager == null ? '—' : lager },
          ],
        };
      },
    },
    compute: {
      gesamtbetrag: forms => {
        const ids = (forms.kostenvoranschlaege.get('ersatzteile') as string[] | undefined) ?? [];
        return sumPrices(ids, recordOfRef.current);
      },
    },
  });
  recordOfRef.current = flow.picks.ersatzteile.recordOf;

  const kv = flow.forms.kostenvoranschlaege;
  const teile = (kv.get('ersatzteile') as string[] | undefined) ?? [];
  const total = sumPrices(teile, flow.picks.ersatzteile.recordOf);
  const auftragPick = flow.pick('reparaturauftraege');
  const lowStock = teile.filter(id => {
    const rec = flow.picks.ersatzteile.recordOf(id);
    const lager = rec ? fieldNumber(rec, 'lagerbestand') : null;
    return lager != null && lager <= 0;
  });

  return (
    <IntentWizardShell
      title={tx('Kostenvoranschlag erstellen')}
      currentStep={step}
      onStepChange={setStep}
      forms={flow.formList}
      draftKey={flow.draftKey}
      intro={{
        description: tx('Ersatzteile zum Auftrag wählen und den Kostenvoranschlag zur Freigabe anlegen.'),
        needs: [tx('Bestätigter Reparaturauftrag'), tx('Benötigte Ersatzteile')],
      }}
    >
      <WizardStep label={tx('Auftrag')} description={tx('Für welchen Reparaturauftrag ist der Kostenvoranschlag?')}>
        <EntitySelectStep
          {...flow.picks.reparaturauftraege.select}
          selectedId={auftragPick.selectedId}
          onSelect={id => {
            auftragPick.onSelect(id);
            kv.set('reparaturauftrag', id, flow.picks.reparaturauftraege.labelOf(id));
          }}
          searchPlaceholder={tx('Problembeschreibung suchen …')}
        />
      </WizardStep>

      <WizardStep label={tx('Ersatzteile')} description={tx('Wähle alle Teile, die für die Reparatur gebraucht werden.')} needs={['reparaturauftrag']}>
        <div className="space-y-4">
          <Field form={kv} name="ersatzteile">
            <EntitySelectStep {...flow.picks.ersatzteile.select} {...flow.pickMany('ersatzteile')} avatar="none" searchPlaceholder={tx('Bezeichnung oder Artikelnummer …')} />
          </Field>
          <div className="rounded-2xl bg-secondary p-4 flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm text-muted-foreground">{tx`${teile.length} Teile gewählt`}</span>
            <span className="text-lg font-semibold">{formatCurrency(total)}</span>
          </div>
          {lowStock.length > 0 && (
            <p className="text-xs text-destructive">{tx`${lowStock.length} gewählte Teile sind laut Lagerbestand nicht vorrätig.`}</p>
          )}
          <StepNav onBack={() => setStep(1)} onNext={() => flow.validateStep(2)} nextStepLabel={tx('Positionen')} />
        </div>
      </WizardStep>

      <WizardStep label={tx('Positionen')} description={tx('Beschreibe die Positionen und notiere Besonderheiten.')} needs={['ersatzteile']}>
        <div className="space-y-4">
          <Bound form={kv} name="positionen" rows={4} />
          <Bound form={kv} name="bemerkung" rows={3} />
          <StepNav onBack={() => setStep(2)} onNext={() => flow.validateStep(3)} nextStepLabel={tx('Prüfen')} />
        </div>
      </WizardStep>

      <WizardStep label={tx('Prüfen')}>
        {!flow.submit.done && (
          <SummaryStep
            forms={flow.formList}
            submit={flow.submit}
            items={[{ key: 'gesamtbetrag', label: tx('Gesamtbetrag'), value: formatCurrency(total) }]}
            whatHappensNext={tx('Der Auftrag wartet danach auf die Freigabe des Kunden.')}
          />
        )}
      </WizardStep>

      {flow.submit.result && (
        <SuccessStep
          result={flow.submit.result}
          forms={flow.formList}
          submit={flow.submit}
          whatHappensNext={tx('Halte als Nächstes die Entscheidung des Kunden fest.')}
          next={[
            { label: tx('Freigabe erfassen'), href: '#/intents/freigabe-erfassen' },
            { label: tx('Zum Dashboard'), href: '#/' },
          ]}
        />
      )}
    </IntentWizardShell>
  );
}
