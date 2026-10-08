import type { Kunden, Fahrraeder, Reparaturauftraege } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  RecordSection, RecordField, RecordRelation, RecordAttachments,
} from '@/components/widgets/RecordView';
import { t, appLabel, fieldLabel } from '@/i18n';
import { SatelliteSection } from '@/components/SatelliteSection';
import { usePermissions } from '@/lib/permissions';

export interface KundenDetailsProps {
  /** Der Record — enriched oder roh; alle Felder werden hier gerendert. */
  record: Kunden;
  /** 1:N „Fahrräder" (besitzer): VOLLE Liste — der Block filtert auf diesen Record. */
  fahrraederList: Fahrraeder[];
  /** Zeilen-Klick → overlay.push auf das Fahrraeder-Detail (nie der Edit-Dialog). */
  onOpenFahrraeder: (record: Fahrraeder) => void;
  /** Kontextuelles „+": öffnet den Fahrraeder-Dialog mit diesem Record vorgesetzt. */
  onAddFahrraeder?: () => void;
  /** 1:N „Reparaturaufträge" (kunde): VOLLE Liste — der Block filtert auf diesen Record. */
  reparaturauftraegeList: Reparaturauftraege[];
  /** Zeilen-Klick → overlay.push auf das Reparaturauftraege-Detail (nie der Edit-Dialog). */
  onOpenReparaturauftraege: (record: Reparaturauftraege) => void;
  /** Kontextuelles „+": öffnet den Reparaturauftraege-Dialog mit diesem Record vorgesetzt. */
  onAddReparaturauftraege?: () => void;
}

export function KundenDetails({
  record,
  fahrraederList,
  onOpenFahrraeder,
  onAddFahrraeder,
  reparaturauftraegeList,
  onOpenReparaturauftraege,
  onAddReparaturauftraege,
}: KundenDetailsProps) {
  // attachments are a write to this record — read-only without the platform right
  const perms = usePermissions();
  return (
    <>
      <RecordSection title={t('details')} cols={2}>
        <RecordField label={fieldLabel('kunden', 'kunde_vorname')} value={record.fields.kunde_vorname} format="text" />
        <RecordField label={fieldLabel('kunden', 'kunde_nachname')} value={record.fields.kunde_nachname} format="text" />
        <RecordField label={fieldLabel('kunden', 'email')} value={record.fields.email} format="email" />
        <RecordField label={fieldLabel('kunden', 'telefon')} value={record.fields.telefon} format="text" />
        <RecordField label={fieldLabel('kunden', 'strasse')} value={record.fields.strasse} format="text" />
        <RecordField label={fieldLabel('kunden', 'hausnummer')} value={record.fields.hausnummer} format="text" />
        <RecordField label={fieldLabel('kunden', 'plz')} value={record.fields.plz} format="text" />
        <RecordField label={fieldLabel('kunden', 'ort')} value={record.fields.ort} format="text" />
        <RecordField label={fieldLabel('kunden', 'bemerkung')} value={record.fields.bemerkung} format="longtext" className="md:col-span-2" />
      </RecordSection>

      <SatelliteSection
        title={appLabel('fahrraeder')}
        items={fahrraederList.filter(r => extractRecordId(r.fields.besitzer) === record.record_id)}
        map={r => ({ name: r.fields.marke ?? appLabel('fahrraeder'), meta: r.fields.kaufdatum })}
        onOpen={onOpenFahrraeder}
        onAdd={onAddFahrraeder}
        getKey={r => r.record_id}
      />

      <SatelliteSection
        title={appLabel('reparaturauftraege')}
        items={reparaturauftraegeList.filter(r => extractRecordId(r.fields.kunde) === record.record_id)}
        map={r => ({ name: appLabel('reparaturauftraege'), meta: r.fields.wunschtermin })}
        onOpen={onOpenReparaturauftraege}
        onAdd={onAddReparaturauftraege}
        getKey={r => r.record_id}
      />

      <RecordAttachments appId={APP_IDS.KUNDEN} recordId={record.record_id} readOnly={!perms.canWrite('kunden')} />
    </>
  );
}
