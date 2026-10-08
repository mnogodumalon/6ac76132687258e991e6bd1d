/**
 * Reparaturauftrag annehmen — 4-Schritt-Wizard.
 * Steps: 1) Kunden auswählen oder neu anlegen → 2) Fahrrad auswählen oder neu anlegen
 *        → 3) Problem, Priorität und Übergabetermin erfassen → 4) Prüfen & Auftrag speichern.
 * Reads: kunden, fahrraeder. Writes: kunden (nur bei neuem Kunden), fahrraeder (nur bei neuem Fahrrad),
 * reparaturauftraege (Status fix „bestätigt“) — alles über useAuftragAnnehmenFlow.
 * Composes: IntentWizardShell, EntitySelectStep, Bound, StepNav, SummaryStep, SuccessStep.
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { IntentWizardShell, WizardStep } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { Bound } from '@/components/blocks/Bound';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { fieldText, fieldRef } from '@/lib/journey';
import { useAuftragAnnehmenFlow } from '@/lib/journey/flows/AuftragAnnehmen';
import { tx } from '@/i18n';

type Mode = 'pick' | 'new';

export default function AuftragAnnehmenPage() {
  const [step, setStep] = useState(1);
  const [customerMode, setCustomerMode] = useState<Mode>('pick');
  const [bikeMode, setBikeMode] = useState<Mode>('pick');

  const flow = useAuftragAnnehmenFlow({
    steps: {
      kunde: 1, kunde_vorname: 1, kunde_nachname: 1, email: 1, telefon: 1,
      besitzer: 2, fahrrad: 2, marke: 2, modell: 2, fahrradtyp: 2, rahmengroesse: 2, rahmennummer: 2, kaufdatum: 2,
      problembeschreibung: 3, prioritaet: 3, wunschtermin: 3,
    },
    initial: { prioritaet: 'normal' },
    items: {
      kunde: r => ({
        id: r.id,
        title: `${fieldText(r, 'kunde_vorname')} ${fieldText(r, 'kunde_nachname')}`.trim(),
        subtitle: fieldText(r, 'email'),
      }),
      fahrrad: (r, ctx) => ({
        id: r.id,
        title: `${fieldText(r, 'marke')} ${fieldText(r, 'modell')}`.trim(),
        subtitle: [ctx.ref('besitzer'), fieldText(r, 'rahmennummer')].filter(Boolean).join(' · '),
      }),
    },
  });

  const { kunden, fahrraeder, reparaturauftraege } = flow.forms;
  const setValue = (form: { set: unknown }, key: string, value: unknown) =>
    (form.set as (k: string, v: unknown, l?: string) => void)(key, value);
  const pickedCustomer = typeof reparaturauftraege.get('kunde') === 'string' ? (reparaturauftraege.get('kunde') as string) : '';

  const chooseCustomerMode = (m: Mode) => {
    if (m === customerMode) return;
    setCustomerMode(m);
    kunden.reset();
    setValue(reparaturauftraege, 'kunde', null);
    // a new customer has no bikes yet — and the bike form starts clean either way
    fahrraeder.reset();
    setValue(reparaturauftraege, 'fahrrad', null);
    setBikeMode(m === 'new' ? 'new' : 'pick');
  };
  const chooseBikeMode = (m: Mode) => {
    if (m === bikeMode) return;
    setBikeMode(m);
    fahrraeder.reset();
    setValue(reparaturauftraege, 'fahrrad', null);
  };

  const nextFromCustomer = (): boolean | string => {
    if (customerMode === 'new') return kunden.validate(['kunde_vorname', 'kunde_nachname', 'email', 'telefon']);
    if (!pickedCustomer) return tx('Wähle einen Kunden aus der Liste oder erfasse einen neuen Kunden.');
    return true;
  };

  const nextFromBike = (): boolean | string => {
    if (customerMode === 'pick' && !pickedCustomer) return tx('Dieser Schritt braucht zuerst einen Kunden aus Schritt 1.');
    if (bikeMode === 'new') {
      if (customerMode === 'pick') setValue(fahrraeder, 'besitzer', pickedCustomer);
      return fahrraeder.validate(['marke', 'modell', 'fahrradtyp', 'rahmengroesse', 'rahmennummer', 'kaufdatum']);
    }
    const bikeId = reparaturauftraege.get('fahrrad');
    if (typeof bikeId !== 'string' || !bikeId) return tx('Wähle ein Fahrrad aus der Liste oder erfasse ein neues Fahrrad.');
    const rec = flow.picks.fahrrad.recordOf(bikeId);
    const owner = rec ? fieldRef(rec, 'besitzer') : null;
    if (owner && owner !== pickedCustomer) return tx('Dieses Fahrrad gehört einem anderen Kunden. Wähle ein anderes oder erfasse ein neues Fahrrad.');
    return true;
  };

  const modeToggle = (mode: Mode, onChange: (m: Mode) => void, pickLabel: string, newLabel: string, newDisabled = false) => (
    <div className="flex flex-wrap gap-2" role="group">
      <Button type="button" variant={mode === 'pick' ? 'default' : 'outline'} onClick={() => onChange('pick')} disabled={newDisabled}>
        {pickLabel}
      </Button>
      <Button type="button" variant={mode === 'new' ? 'default' : 'outline'} onClick={() => onChange('new')}>
        {newLabel}
      </Button>
    </div>
  );

  return (
    <IntentWizardShell
      title={tx('Reparaturauftrag annehmen')}
      currentStep={step}
      onStepChange={setStep}
      forms={flow.formList}
      draftKey={flow.draftKey}
      intro={{
        description: tx('Kunde und Fahrrad wählen, Problem erfassen und den Auftrag anlegen.'),
        needs: [tx('Name und E-Mail des Kunden'), tx('Marke des Fahrrads'), tx('Problembeschreibung'), tx('Wunschtermin')],
      }}
    >
      <WizardStep label={tx('Kunde')} description={tx('Wähle einen bestehenden Kunden oder erfasse einen neuen.')}>
        <div className="space-y-4">
          {modeToggle(customerMode, chooseCustomerMode, tx('Bestehender Kunde'), tx('Neuer Kunde'))}
          {customerMode === 'pick' ? (
            <EntitySelectStep
              {...flow.picks.kunde.select}
              {...flow.pick('kunde')}
              avatar="initials"
              searchPlaceholder={tx('Name oder E-Mail suchen …')}
            />
          ) : (
            <div className="space-y-4">
              <Bound form={kunden} name="kunde_vorname" />
              <Bound form={kunden} name="kunde_nachname" />
              <Bound form={kunden} name="email" />
              <Bound form={kunden} name="telefon" />
            </div>
          )}
          <StepNav onNext={nextFromCustomer} nextStepLabel={tx('Fahrrad')} />
        </div>
      </WizardStep>

      <WizardStep label={tx('Fahrrad')} description={tx('Welches Fahrrad kommt in die Werkstatt?')}>
        <div className="space-y-4">
          {modeToggle(bikeMode, chooseBikeMode, tx('Bestehendes Fahrrad'), tx('Neues Fahrrad'), customerMode === 'new')}
          {bikeMode === 'pick' ? (
            <EntitySelectStep
              {...flow.picks.fahrrad.select}
              {...flow.pick('fahrrad')}
              avatar="none"
              searchPlaceholder={tx('Marke, Modell oder Rahmennummer …')}
            />
          ) : (
            <div className="space-y-4">
              <Bound form={fahrraeder} name="marke" />
              <Bound form={fahrraeder} name="modell" />
              <Bound form={fahrraeder} name="fahrradtyp" />
              <Bound form={fahrraeder} name="rahmengroesse" />
              <Bound form={fahrraeder} name="rahmennummer" />
              <Bound form={fahrraeder} name="kaufdatum" />
            </div>
          )}
          <StepNav onBack={() => setStep(1)} onNext={nextFromBike} nextStepLabel={tx('Auftragsdetails')} />
        </div>
      </WizardStep>

      <WizardStep label={tx('Auftrag')} description={tx('Beschreibe das Problem und lege Priorität und Termin fest.')}>
        <div className="space-y-4">
          <Bound form={reparaturauftraege} name="problembeschreibung" rows={4} />
          <Bound form={reparaturauftraege} name="prioritaet" />
          <Bound form={reparaturauftraege} name="wunschtermin" hint={tx('Wann soll das Fahrrad abgegeben bzw. übergeben werden?')} />
          <StepNav onBack={() => setStep(2)} onNext={() => flow.validateStep(3)} nextStepLabel={tx('Prüfen')} />
        </div>
      </WizardStep>

      <WizardStep label={tx('Prüfen')}>
        {!flow.submit.done && (
          <SummaryStep
            forms={flow.formList}
            submit={flow.submit}
            whatHappensNext={tx('Der Auftrag wird mit dem Status „Bestätigt“ angelegt. Danach kannst du den Kostenvoranschlag erstellen.')}
          />
        )}
      </WizardStep>

      {flow.submit.result && (
        <SuccessStep
          result={flow.submit.result}
          forms={flow.formList}
          submit={flow.submit}
          next={[
            { label: tx('Kostenvoranschlag erstellen'), href: '#/intents/kostenvoranschlag-erstellen' },
            { label: tx('Zum Dashboard'), href: '#/' },
          ]}
          whatHappensNext={tx('Der Auftrag ist in der Werkstatt eingeplant.')}
        />
      )}
    </IntentWizardShell>
  );
}
