import type { Ersatzteile, Kostenvoranschlaege } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  RecordSection, RecordField, RecordRelation, RecordAttachments,
} from '@/components/widgets/RecordView';
import { t, appLabel, fieldLabel } from '@/i18n';
import { SatelliteSection } from '@/components/SatelliteSection';
import { usePermissions } from '@/lib/permissions';

export interface ErsatzteileDetailsProps {
  /** Der Record — enriched oder roh; alle Felder werden hier gerendert. */
  record: Ersatzteile;
  /** 1:N „Kostenvoranschläge" (ersatzteile): VOLLE Liste — der Block filtert auf diesen Record. */
  kostenvoranschlaegeList: Kostenvoranschlaege[];
  /** Zeilen-Klick → overlay.push auf das Kostenvoranschlaege-Detail (nie der Edit-Dialog). */
  onOpenKostenvoranschlaege: (record: Kostenvoranschlaege) => void;
  /** Kontextuelles „+": öffnet den Kostenvoranschlaege-Dialog mit diesem Record vorgesetzt. */
  onAddKostenvoranschlaege?: () => void;
  /** „Vorhandene wählen": Listenfeld-Rückbezug — hängt diesen Record an einen bestehenden Kostenvoranschlaege-Datensatz. */
  onPickKostenvoranschlaege?: () => void;
}

export function ErsatzteileDetails({
  record,
  kostenvoranschlaegeList,
  onOpenKostenvoranschlaege,
  onAddKostenvoranschlaege,
  onPickKostenvoranschlaege,
}: ErsatzteileDetailsProps) {
  // attachments are a write to this record — read-only without the platform right
  const perms = usePermissions();
  return (
    <>
      <RecordSection title={t('details')} cols={2}>
        <RecordField label={fieldLabel('ersatzteile', 'bezeichnung')} value={record.fields.bezeichnung} format="text" />
        <RecordField label={fieldLabel('ersatzteile', 'artikelnummer')} value={record.fields.artikelnummer} format="text" />
        <RecordField label={fieldLabel('ersatzteile', 'preis')} value={record.fields.preis} format="text" />
        <RecordField label={fieldLabel('ersatzteile', 'lagerbestand')} value={record.fields.lagerbestand} format="text" />
      </RecordSection>

      <SatelliteSection
        title={appLabel('kostenvoranschlaege')}
        items={kostenvoranschlaegeList.filter(r => Array.isArray(r.fields.ersatzteile) && r.fields.ersatzteile.some((u: unknown) => extractRecordId(u) === record.record_id))}
        map={r => ({ name: appLabel('kostenvoranschlaege'), meta: r.fields.datum })}
        onOpen={onOpenKostenvoranschlaege}
        onAdd={onAddKostenvoranschlaege}
        onPick={onPickKostenvoranschlaege}
        getKey={r => r.record_id}
      />

      <RecordAttachments appId={APP_IDS.ERSATZTEILE} recordId={record.record_id} readOnly={!perms.canWrite('ersatzteile')} />
    </>
  );
}
