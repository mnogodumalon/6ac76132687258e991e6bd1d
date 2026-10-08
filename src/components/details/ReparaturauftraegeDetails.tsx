import type { Reparaturauftraege, Kunden, Fahrraeder, Kostenvoranschlaege } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  RecordSection, RecordField, RecordRelation, RecordAttachments,
} from '@/components/widgets/RecordView';
import { t, appLabel, fieldLabel } from '@/i18n';
import { SatelliteSection } from '@/components/SatelliteSection';
import { usePermissions } from '@/lib/permissions';

export interface ReparaturauftraegeDetailsProps {
  /** Der Record — enriched oder roh; alle Felder werden hier gerendert. */
  record: Reparaturauftraege;
  /** N:1-Ziel „Kunden": volle Liste (Hook-Array) — der Block löst Name + Schlüsselfelder selbst auf. */
  kundenList: Kunden[];
  /** Klick auf die Kunden-Relation → overlay.push auf dessen Detail. */
  onOpenKunden?: (record: Kunden) => void;
  /** N:1-Ziel „Fahrraeder": volle Liste (Hook-Array) — der Block löst Name + Schlüsselfelder selbst auf. */
  fahrraederList: Fahrraeder[];
  /** Klick auf die Fahrraeder-Relation → overlay.push auf dessen Detail. */
  onOpenFahrraeder?: (record: Fahrraeder) => void;
  /** 1:N „Kostenvoranschläge" (reparaturauftrag): VOLLE Liste — der Block filtert auf diesen Record. */
  kostenvoranschlaegeList: Kostenvoranschlaege[];
  /** Zeilen-Klick → overlay.push auf das Kostenvoranschlaege-Detail (nie der Edit-Dialog). */
  onOpenKostenvoranschlaege: (record: Kostenvoranschlaege) => void;
  /** Kontextuelles „+": öffnet den Kostenvoranschlaege-Dialog mit diesem Record vorgesetzt. */
  onAddKostenvoranschlaege?: () => void;
}

export function ReparaturauftraegeDetails({
  record,
  kundenList,
  onOpenKunden,
  fahrraederList,
  onOpenFahrraeder,
  kostenvoranschlaegeList,
  onOpenKostenvoranschlaege,
  onAddKostenvoranschlaege,
}: ReparaturauftraegeDetailsProps) {
  // attachments are a write to this record — read-only without the platform right
  const perms = usePermissions();
  const kundeTarget = kundenList.find(r => r.record_id === extractRecordId(record.fields.kunde));
  const fahrradTarget = fahrraederList.find(r => r.record_id === extractRecordId(record.fields.fahrrad));
  return (
    <>
      <RecordSection title={t('details')} cols={2}>
        <RecordField label={fieldLabel('reparaturauftraege', 'problembeschreibung')} value={record.fields.problembeschreibung} format="longtext" className="md:col-span-2" />
        <RecordField label={fieldLabel('reparaturauftraege', 'wunschtermin')} value={record.fields.wunschtermin} format="date" />
        <RecordField label={fieldLabel('reparaturauftraege', 'uebergabetermin')} value={record.fields.uebergabetermin} format="date" />
        <RecordField label={fieldLabel('reparaturauftraege', 'prioritaet')} value={record.fields.prioritaet} format="pill" />
        <RecordField label={fieldLabel('reparaturauftraege', 'status')} value={record.fields.status} format="pill" />
      </RecordSection>

      {/* N:1 — verknüpfte Records: IMMER klickbar, nie eine Text-Sackgasse. */}
      <RecordSection title={t('relations')} cols={2}>
        <RecordRelation
          label={fieldLabel('reparaturauftraege', 'kunde')}
          name={kundeTarget?.fields.kunde_vorname ?? '—'}
          meta={[kundeTarget?.fields.email, kundeTarget?.fields.telefon].filter(Boolean).join(' · ') || undefined}
          onClick={kundeTarget && onOpenKunden ? () => onOpenKunden!(kundeTarget!) : undefined}
        />
        <RecordRelation
          label={fieldLabel('reparaturauftraege', 'fahrrad')}
          name={fahrradTarget?.fields.marke ?? '—'}
          meta={[fahrradTarget?.fields.modell, fahrradTarget?.fields.rahmengroesse].filter(Boolean).join(' · ') || undefined}
          onClick={fahrradTarget && onOpenFahrraeder ? () => onOpenFahrraeder!(fahrradTarget!) : undefined}
        />
      </RecordSection>

      <SatelliteSection
        title={appLabel('kostenvoranschlaege')}
        items={kostenvoranschlaegeList.filter(r => extractRecordId(r.fields.reparaturauftrag) === record.record_id)}
        map={r => ({ name: appLabel('kostenvoranschlaege'), meta: r.fields.datum })}
        onOpen={onOpenKostenvoranschlaege}
        onAdd={onAddKostenvoranschlaege}
        getKey={r => r.record_id}
      />

      <RecordAttachments appId={APP_IDS.REPARATURAUFTRAEGE} recordId={record.record_id} readOnly={!perms.canWrite('reparaturauftraege')} />
    </>
  );
}
