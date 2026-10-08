/**
 * Freigabe erfassen — 3-Schritt-Wizard.
 * Steps: 1) Offenen Kostenvoranschlag wählen → 2) Freigegeben oder abgelehnt → 3) Prüfen (Auftragsstatus wird angepasst).
 * Reads: kostenvoranschlaege, reparaturauftraege. Writes: kostenvoranschlaege (freigabe_status), reparaturauftraege (status, abgeleitet).
 * Composes: IntentWizardShell, EntitySelectStep, Field, ChoiceGroup, StepNav, SummaryStep, SuccessStep.
 */
import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { IntentWizardShell, WizardStep } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { Field } from '@/components/blocks/Field';
import { ChoiceGroup } from '@/components/blocks/ChoiceGroup';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { fieldDate, fieldNumber, fieldRef, fieldText } from '@/lib/journey';
import { useFreigabeErfassenFlow } from '@/lib/journey/flows/FreigabeErfassen';
import { tx } from '@/i18n';

function euro(n: number | null): string {
  return n == null ? '—' : new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n);
}

export default function FreigabeErfassenPage() {
  const [step, setStep] = useState(1);
  const flow = useFreigabeErfassenFlow({
    steps: { kostenvoranschlaege: 1, reparaturauftraege: 1, freigabe_status: 2 },
    items: {
      kostenvoranschlaege: (k, ctx) => {
        const datum = fieldDate(k, 'datum');
        return {
          id: k.id,
          title: ctx.ref('reparaturauftrag') ?? tx('Kostenvoranschlag'),
          subtitle: `${datum ? format(parseISO(datum), 'dd.MM.yyyy') : ''}${datum ? ' · ' : ''}${euro(fieldNumber(k, 'gesamtbetrag'))}`,
        };
      },
    },
    compute: {
      status: forms => {
        const d = forms.kostenvoranschlaege.get('freigabe_status');
        if (d === 'freigegeben') return 'in_bearbeitung';
        if (d === 'abgelehnt') return 'storniert';
        return null;
      },
    },
  });

  const kvForm = flow.forms.kostenvoranschlaege;
  const kvPick = flow.pick('kostenvoranschlaege');
  const auftragPick = flow.pick('reparaturauftraege');
  const kvId = kvPick.selectedId;
  const kv = kvId ? flow.picks.kostenvoranschlaege.recordOf(kvId) : undefined;
  const decision = kvForm.get('freigabe_status');
  const newStatus = decision === 'freigegeben' ? tx('In Bearbeitung') : decision === 'abgelehnt' ? tx('Storniert') : '—';

  const onPickKv = (id: string) => {
    kvPick.onSelect(id);
    const rec = flow.picks.kostenvoranschlaege.recordOf(id);
    const auftragId = rec ? fieldRef(rec, 'reparaturauftrag') : null;
    if (auftragId && flow.picks.reparaturauftraege.recordOf(auftragId)) auftragPick.onSelect(auftragId);
  };

  return (
    <IntentWizardShell
      title={tx('Freigabe erfassen')}
      currentStep={step}
      onStepChange={setStep}
      forms={flow.formList}
      draftKey={flow.draftKey}
      intro={{
        description: tx('Die Entscheidung des Kunden festhalten und den Auftrag anpassen.'),
        needs: [tx('Offener Kostenvoranschlag'), tx('Entscheidung des Kunden')],
      }}
    >
      <WizardStep label={tx('Kostenvoranschlag')} description={tx('Welcher offene Kostenvoranschlag wurde entschieden?')}>
        <EntitySelectStep
          {...flow.picks.kostenvoranschlaege.select}
          selectedId={kvId}
          onSelect={onPickKv}
          searchPlaceholder={tx('Auftrag suchen …')}
          emptyText={tx('Es gibt keinen offenen Kostenvoranschlag.')}
        />
      </WizardStep>
      <WizardStep label={tx('Entscheidung')} description={tx('Hat der Kunde freigegeben oder abgelehnt?')} needs={['kostenvoranschlaege']}>
        <div className="space-y-4">
          {kv && (
            <div className="rounded-2xl border bg-card p-4 text-sm">
              <p className="font-medium">{flow.picks.kostenvoranschlaege.refLabel(kv, 'reparaturauftrag') ?? tx('Kostenvoranschlag')}</p>
              <p className="text-muted-foreground">{euro(fieldNumber(kv, 'gesamtbetrag'))}</p>
              {fieldText(kv, 'positionen') && <p className="mt-1 text-muted-foreground line-clamp-3">{fieldText(kv, 'positionen')}</p>}
            </div>
          )}
          {!auftragPick.selectedId && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">{tx('Zu diesem Kostenvoranschlag wurde kein Auftrag gefunden — wähle den Auftrag.')}</p>
              <EntitySelectStep {...flow.picks.reparaturauftraege.select} {...auftragPick} create={false} />
            </div>
          )}
          <Field form={kvForm} name="freigabe_status">
            <ChoiceGroup {...kvForm.choice('freigabe_status')} />
          </Field>
          <p className="text-sm text-muted-foreground">
            {tx('Neuer Auftragsstatus')}: <b>{newStatus}</b>
          </p>
          <StepNav
            onBack={() => setStep(1)}
            onNext={() => (auftragPick.selectedId ? flow.validateStep(2) : tx('Bitte zuerst den Auftrag wählen.'))}
            nextStepLabel={tx('Prüfen')}
          />
        </div>
      </WizardStep>
      <WizardStep label={tx('Prüfen')} description={tx('Der Auftragsstatus wird passend zur Entscheidung angepasst.')}>
        {!flow.submit.done && (
          <SummaryStep
            forms={flow.formList}
            submit={flow.submit}
            items={[{ key: 'auftragsstatus', label: tx('Neuer Auftragsstatus'), value: String(newStatus) }]}
            whatHappensNext={tx('Bei Freigabe geht der Auftrag in Bearbeitung, bei Ablehnung wird er storniert.')}
          />
        )}
      </WizardStep>
      {flow.submit.result && (
        <SuccessStep
          result={flow.submit.result}
          forms={flow.formList}
          submit={flow.submit}
          next={[
            { label: tx('Auftrag abschließen'), href: '#/intents/auftrag-abschliessen' },
            { label: tx('Zum Dashboard'), href: '#/' },
          ]}
        />
      )}
    </IntentWizardShell>
  );
}
