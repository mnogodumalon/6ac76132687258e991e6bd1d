import type { Fahrraeder, Kunden, Reparaturauftraege } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  RecordSection, RecordField, RecordRelation, RecordAttachments,
} from '@/components/widgets/RecordView';
import { t, appLabel, fieldLabel } from '@/i18n';
import { SatelliteSection } from '@/components/SatelliteSection';
import { usePermissions } from '@/lib/permissions';

export interface FahrraederDetailsProps {
  /** Der Record — enriched oder roh; alle Felder werden hier gerendert. */
  record: Fahrraeder;
  /** N:1-Ziel „Kunden": volle Liste (Hook-Array) — der Block löst Name + Schlüsselfelder selbst auf. */
  kundenList: Kunden[];
  /** Klick auf die Kunden-Relation → overlay.push auf dessen Detail. */
  onOpenKunden?: (record: Kunden) => void;
  /** 1:N „Reparaturaufträge" (fahrrad): VOLLE Liste — der Block filtert auf diesen Record. */
  reparaturauftraegeList: Reparaturauftraege[];
  /** Zeilen-Klick → overlay.push auf das Reparaturauftraege-Detail (nie der Edit-Dialog). */
  onOpenReparaturauftraege: (record: Reparaturauftraege) => void;
  /** Kontextuelles „+": öffnet den Reparaturauftraege-Dialog mit diesem Record vorgesetzt. */
  onAddReparaturauftraege?: () => void;
}

export function FahrraederDetails({
  record,
  kundenList,
  onOpenKunden,
  reparaturauftraegeList,
  onOpenReparaturauftraege,
  onAddReparaturauftraege,
}: FahrraederDetailsProps) {
  // attachments are a write to this record — read-only without the platform right
  const perms = usePermissions();
  const besitzerTarget = kundenList.find(r => r.record_id === extractRecordId(record.fields.besitzer));
  return (
    <>
      <RecordSection title={t('details')} cols={2}>
        <RecordField label={fieldLabel('fahrraeder', 'marke')} value={record.fields.marke} format="text" />
        <RecordField label={fieldLabel('fahrraeder', 'modell')} value={record.fields.modell} format="text" />
        <RecordField label={fieldLabel('fahrraeder', 'fahrradtyp')} value={record.fields.fahrradtyp} format="pill" />
        <RecordField label={fieldLabel('fahrraeder', 'rahmengroesse')} value={record.fields.rahmengroesse} format="text" />
        <RecordField label={fieldLabel('fahrraeder', 'rahmennummer')} value={record.fields.rahmennummer} format="text" />
        <RecordField label={fieldLabel('fahrraeder', 'farbe')} value={record.fields.farbe} format="text" />
        <RecordField label={fieldLabel('fahrraeder', 'kaufdatum')} value={record.fields.kaufdatum} format="date" />
      </RecordSection>

      {/* N:1 — verknüpfte Records: IMMER klickbar, nie eine Text-Sackgasse. */}
      <RecordSection title={t('relations')} cols={1}>
        <RecordRelation
          label={fieldLabel('fahrraeder', 'besitzer')}
          name={besitzerTarget?.fields.kunde_vorname ?? '—'}
          meta={[besitzerTarget?.fields.email, besitzerTarget?.fields.telefon].filter(Boolean).join(' · ') || undefined}
          onClick={besitzerTarget && onOpenKunden ? () => onOpenKunden!(besitzerTarget!) : undefined}
        />
      </RecordSection>

      <SatelliteSection
        title={appLabel('reparaturauftraege')}
        items={reparaturauftraegeList.filter(r => extractRecordId(r.fields.fahrrad) === record.record_id)}
        map={r => ({ name: appLabel('reparaturauftraege'), meta: r.fields.wunschtermin })}
        onOpen={onOpenReparaturauftraege}
        onAdd={onAddReparaturauftraege}
        getKey={r => r.record_id}
      />

      <RecordAttachments appId={APP_IDS.FAHRRAEDER} recordId={record.record_id} readOnly={!perms.canWrite('fahrraeder')} />
    </>
  );
}
