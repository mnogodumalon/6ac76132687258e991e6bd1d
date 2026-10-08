import { useEffect, useMemo, useState } from 'react';
import { PublicShell } from '@/components/PublicShell';
import {
  loadPublicPagesConfig,
  type PublicPagesConfig,
  type PublicPageConfig,
} from '@/lib/publicClient';
import { createPublicPort } from '@/lib/journey/publicPort';
import { useStepForm, useJourneySubmit, ENTITIES } from '@/lib/journey';
import { IntentWizardShell, type WizardStep } from '@/components/blocks/IntentWizardShell';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { Bound } from '@/components/blocks/Bound';
import { tx } from '@/i18n';

const SLUG = 'reparaturtermin-anmelden';

export default function ReparaturterminAnmelden() {
  const [cfg, setCfg] = useState<PublicPagesConfig | null>(null);
  const [page, setPage] = useState<PublicPageConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPublicPagesConfig(SLUG)
      .then(c => {
        setCfg(c);
        setPage(c?.pages[SLUG] ?? null);
      })
      .catch(() => {
        setCfg(null);
        setPage(null);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading || !cfg || !page) {
    return <PublicShell loading={loading} unavailable={!loading} />;
  }
  return <Wizard cfg={cfg} page={page} />;
}

function Wizard({ cfg, page }: { cfg: PublicPagesConfig; page: PublicPageConfig }) {
  const [step, setStep] = useState(1);
  const port = useMemo(() => createPublicPort(cfg, page), [cfg, page]);

  const kunde = useStepForm('kunden', {
    fields: ['kunde_vorname', 'kunde_nachname', 'email', 'telefon', 'strasse', 'hausnummer', 'plz', 'ort'],
    steps: { kunde_vorname: 1, kunde_nachname: 1, email: 1, telefon: 1, strasse: 1, hausnummer: 1, plz: 1, ort: 1 },
    autoComplete: true,
  });
  const fahrrad = useStepForm('fahrraeder', {
    fields: ['marke', 'modell', 'fahrradtyp', 'rahmengroesse', 'farbe', 'kaufdatum'],
    steps: { marke: 2, modell: 2, fahrradtyp: 2, rahmengroesse: 2, farbe: 2, kaufdatum: 2 },
    autoComplete: true,
  });
  const auftrag = useStepForm('reparaturauftraege', {
    fields: ['problembeschreibung', 'wunschtermin'],
    steps: { problembeschreibung: 3, wunschtermin: 3 },
    autoComplete: true,
  });

  const submit = useJourneySubmit(
    port,
    [
      { key: 'kunde', entity: 'kunden', form: kunde },
      { key: 'fahrrad', entity: 'fahrraeder', form: fahrrad, needs: ['kunde'],
        values: ctx => ({ besitzer: ctx.port.ref(ENTITIES.kunden.appId, ctx.done.kunde.id) }),
      },
      {
        key: 'auftrag',
        entity: 'reparaturauftraege',
        form: auftrag,
        primary: true,
        needs: ['kunde', 'fahrrad'],
        values: ctx => ({
          kunde: ctx.port.ref(ENTITIES.kunden.appId, ctx.done.kunde.id),
          fahrrad: ctx.port.ref(ENTITIES.fahrraeder.appId, ctx.done.fahrrad.id),
        }),
      },
    ],
    { draftKey: SLUG },
  );

  const steps: WizardStep[] = [
    { label: tx('Kontakt'), heading: tx('Deine Kontaktdaten'), description: tx('Damit wir dich erreichen können.') },
    { label: tx('Fahrrad'), heading: tx('Dein Fahrrad'), description: tx('Welches Rad soll repariert werden?') },
    { label: tx('Problem'), heading: tx('Was ist kaputt?'), description: tx('Beschreibe das Problem und nenne uns einen Wunschtermin.') },
    { label: tx('Prüfen'), heading: tx('Prüfen und absenden') },
  ];

  const restart = () => {
    submit.reset();
    kunde.reset();
    fahrrad.reset();
    auftrag.reset();
    setStep(1);
  };

  return (
    <PublicShell title={page.title} description={page.description}>
      <IntentWizardShell
        steps={steps}
        currentStep={step}
        onStepChange={setStep}
        back={false}
        forms={[kunde, fahrrad, auftrag]}
        draftKey={SLUG}
      >
        {step === 1 && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Bound form={kunde} name="kunde_vorname" />
              <Bound form={kunde} name="kunde_nachname" />
            </div>
            <Bound form={kunde} name="email" />
            <Bound form={kunde} name="telefon" />
            <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
              <Bound form={kunde} name="strasse" />
              <Bound form={kunde} name="hausnummer" />
            </div>
            <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
              <Bound form={kunde} name="plz" />
              <Bound form={kunde} name="ort" />
            </div>
            <StepNav
              hideBack
              onNext={() => kunde.validate()}
              nextStepLabel={tx('Fahrrad')}
            />
          </div>
        )}
        {step === 2 && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Bound form={fahrrad} name="marke" />
              <Bound form={fahrrad} name="modell" />
            </div>
            <Bound form={fahrrad} name="fahrradtyp" allowClear />
            <div className="grid gap-4 sm:grid-cols-2">
              <Bound form={fahrrad} name="rahmengroesse" />
              <Bound form={fahrrad} name="farbe" />
            </div>
            <Bound form={fahrrad} name="kaufdatum" />
            <StepNav
              onBack={() => setStep(1)}
              onNext={() => fahrrad.validate()}
              nextStepLabel={tx('Problem')}
            />
          </div>
        )}
        {step === 3 && (
          <div className="space-y-4">
            <Bound form={auftrag} name="problembeschreibung" rows={5} />
            <Bound form={auftrag} name="wunschtermin" />
            <StepNav
              onBack={() => setStep(2)}
              onNext={() => auftrag.validate()}
              nextStepLabel={tx('Prüfen')}
            />
          </div>
        )}
        {step === 4 && !submit.done && (
          <SummaryStep
            forms={[kunde, fahrrad, auftrag]}
            submit={submit}
            whatHappensNext={tx('Wir prüfen deine Anmeldung und melden uns bei dir zur Terminbestätigung.')}
          />
        )}
        {submit.result && (
          <SuccessStep
            result={submit.result}
            forms={[kunde, fahrrad, auftrag]}
            title={tx('Reparaturtermin angemeldet')}
            whatHappensNext={tx('Wir prüfen deine Anmeldung und melden uns bei dir.')}
            next={[{ label: tx('Weiteres Fahrrad anmelden'), onClick: restart }]}
          />
        )}
      </IntentWizardShell>
    </PublicShell>
  );
}
