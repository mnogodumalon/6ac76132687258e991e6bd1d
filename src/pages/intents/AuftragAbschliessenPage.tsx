/**
 * Auftrag abschließen und übergeben — 3-Schritt-Wizard.
 * Steps: 1) Auftrag auswählen → 2) Als fertig oder übergeben markieren → 3) Prüfen & speichern.
 * Reads: reparaturauftraege. Writes: reparaturauftraege.status (update).
 * Composes: IntentWizardShell, EntitySelectStep, Field, ChoiceGroup, StepNav, SummaryStep, SuccessStep.
 */
import { useState } from 'react';
import { IntentWizardShell, WizardStep } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { Field } from '@/components/blocks/Field';
import { ChoiceGroup } from '@/components/blocks/ChoiceGroup';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { fieldText, fieldLookup, fieldDate } from '@/lib/journey';
import { useAuftragAbschliessenFlow } from '@/lib/journey/flows/AuftragAbschliessen';
import { tx } from '@/i18n';

const OFFERED = ['fertig', 'uebergeben'];

export default function AuftragAbschliessenPage() {
  const [step, setStep] = useState(1);
  const flow = useAuftragAbschliessenFlow({
    steps: { reparaturauftraege: 1, status: 2 },
    items: {
      reparaturauftraege: (r, ctx) => {
        const status = fieldLookup(r, 'status');
        const termin = fieldDate(r, 'uebergabetermin');
        return {
          id: r.id,
          title: fieldText(r, 'problembeschreibung') || tx('Ohne Beschreibung'),
          subtitle: [ctx.ref('kunde'), ctx.ref('fahrrad'), termin].filter(Boolean).join(' · '),
          status: status ?? undefined,
        };
      },
    },
  });

  const form = flow.forms.reparaturauftraege;
  const choice = form.choice('status');
  const options = choice.options.filter(o => OFFERED.includes(o.key));
  const current = choice.value;

  return (
    <IntentWizardShell
      title={tx('Auftrag abschließen')}
      currentStep={step}
      onStepChange={setStep}
      forms={flow.formList}
      draftKey={flow.draftKey}
      intro={{
        description: tx('Fertige Aufträge melden und bei Abholung übergeben.'),
        needs: [tx('Auftrag in Bearbeitung oder fertig')],
      }}
    >
      <WizardStep label={tx('Auftrag')} description={tx('Welcher Auftrag ist fertig oder wird abgeholt?')}>
        <EntitySelectStep
          {...flow.picks.reparaturauftraege.select}
          {...flow.pick('reparaturauftraege')}
          searchPlaceholder={tx('Problembeschreibung suchen …')}
        />
      </WizardStep>
      <WizardStep
        label={tx('Status')}
        description={tx('Fertig gemeldet oder dem Kunden übergeben?')}
        needs={['reparaturauftraege']}
      >
        <Field form={form} name="status">
          <ChoiceGroup {...choice} options={options} />
        </Field>
        <StepNav
          onBack={() => setStep(1)}
          onNext={() =>
            current && OFFERED.includes(current)
              ? flow.validateStep(2)
              : tx('Bitte „Fertig“ oder „Übergeben“ wählen.')
          }
          nextStepLabel={tx('Prüfen')}
        />
      </WizardStep>
      <WizardStep label={tx('Prüfen')}>
        {!flow.submit.done && (
          <SummaryStep
            forms={flow.formList}
            submit={flow.submit}
            whatHappensNext={tx('Der Status des Auftrags wird sofort aktualisiert.')}
          />
        )}
      </WizardStep>
      {flow.submit.result && (
        <SuccessStep
          result={flow.submit.result}
          forms={flow.formList}
          submit={flow.submit}
          next={[
            { label: tx('Reparaturauftrag annehmen'), href: '#/intents/auftrag-annehmen' },
            { label: tx('Zum Dashboard'), href: '#/' },
          ]}
        />
      )}
    </IntentWizardShell>
  );
}
