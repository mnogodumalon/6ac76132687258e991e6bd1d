import type { Kostenvoranschlaege, Reparaturauftraege, Ersatzteile } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  RecordSection, RecordField, RecordRelation, RecordAttachments,
} from '@/components/widgets/RecordView';
import { usePermissions } from '@/lib/permissions';
import { t, appLabel, fieldLabel } from '@/i18n';

export interface KostenvoranschlaegeDetailsProps {
  /** Der Record — enriched oder roh; alle Felder werden hier gerendert. */
  record: Kostenvoranschlaege;
  /** N:1-Ziel „Reparaturauftraege": volle Liste (Hook-Array) — der Block löst Name + Schlüsselfelder selbst auf. */
  reparaturauftraegeList: Reparaturauftraege[];
  /** Klick auf die Reparaturauftraege-Relation → overlay.push auf dessen Detail. */
  onOpenReparaturauftraege?: (record: Reparaturauftraege) => void;
  /** N:1-Ziel „Ersatzteile": volle Liste (Hook-Array) — der Block löst Name + Schlüsselfelder selbst auf. */
  ersatzteileList: Ersatzteile[];
  /** Reserviert — Ersatzteile ist hier nur über ein Mehrfach-Feld verknüpft (Text-Join, keine Einzel-Relation); Übergabe erlaubt, aber ohne Wirkung. */
  onOpenErsatzteile?: (record: Ersatzteile) => void;
}

export function KostenvoranschlaegeDetails({
  record,
  reparaturauftraegeList,
  onOpenReparaturauftraege,
  ersatzteileList,
}: KostenvoranschlaegeDetailsProps) {
  // attachments are a write to this record — read-only without the platform right
  const perms = usePermissions();
  const reparaturauftragTarget = reparaturauftraegeList.find(r => r.record_id === extractRecordId(record.fields.reparaturauftrag));
  return (
    <>
      <RecordSection title={t('details')} cols={2}>
        <RecordField label={fieldLabel('kostenvoranschlaege', 'datum')} value={record.fields.datum} format="date" />
        <RecordField label={fieldLabel('kostenvoranschlaege', 'positionen')} value={record.fields.positionen} format="longtext" className="md:col-span-2" />
        <RecordField label={fieldLabel('kostenvoranschlaege', 'ersatzteile')} value={Array.isArray(record.fields.ersatzteile) ? record.fields.ersatzteile.map((u: unknown) => ersatzteileList.find(t => t.record_id === extractRecordId(u))?.fields.bezeichnung ?? '—').join(', ') : null} format="text" />
        <RecordField label={fieldLabel('kostenvoranschlaege', 'gesamtbetrag')} value={record.fields.gesamtbetrag} format="text" />
        <RecordField label={fieldLabel('kostenvoranschlaege', 'freigabe_status')} value={record.fields.freigabe_status} format="pill" />
        <RecordField label={fieldLabel('kostenvoranschlaege', 'bemerkung')} value={record.fields.bemerkung} format="longtext" className="md:col-span-2" />
      </RecordSection>

      {/* N:1 — verknüpfte Records: IMMER klickbar, nie eine Text-Sackgasse. */}
      <RecordSection title={t('relations')} cols={1}>
        <RecordRelation
          label={fieldLabel('kostenvoranschlaege', 'reparaturauftrag')}
          name={reparaturauftragTarget?.fields.problembeschreibung ?? '—'}
          meta={undefined}
          onClick={reparaturauftragTarget && onOpenReparaturauftraege ? () => onOpenReparaturauftraege!(reparaturauftragTarget!) : undefined}
        />
      </RecordSection>

      <RecordAttachments appId={APP_IDS.KOSTENVORANSCHLAEGE} recordId={record.record_id} readOnly={!perms.canWrite('kostenvoranschlaege')} />
    </>
  );
}
