/**
 * EntityCrud — pre-generated CRUD + overlay plumbing for the dashboard.
 * Compose it; NEVER re-roll dialog state, submit handlers, an overlay stack
 * or a RecordOverlayHost in the page — this file owns all of it.
 *
 * API at a glance:
 *   const data = useDashboardData();
 *   const crud = useEntityCrud(data, {
 *     // optional — the ONE semantic slot on the overlay: the record's next
 *     // workflow step. Return undefined for types without one.
 *     footer: (top) => top.type === 'kunden'
 *       ? { label: …, onClick: () => … }
 *       : undefined,
 *   });
 *
 *   `top.type` is the SAME camelCase key as `crud.<entity>` — one spelling
 *   per entity, everywhere in this API.
 *   …
 *   crud.kunden.openCreate({ …defaults })   // create dialog, prefilled — defaults are
 *                                       // shape-tolerant: bare lookup keys / record ids are fine
 *   crud.kunden.openEdit(record)            // edit dialog (recordId + defaults wired)
 *   crud.kunden.openDetail(record)          // record overlay — pass the RAW record,
 *                                       // enrichment is resolved inside
 *   crud.overlay                         // RecordOverlayStack<OverlayItem> for drills:
 *                                       // push / pop / replace / close
 *   crud.enriched.kunden              // the display-ready array for EVERY entity —
 *                                       // Enriched* where relations exist, the raw array
 *                                       // otherwise. Reuse these; never call enrich*()
 *                                       // in the page, and never guess which entity has
 *                                       // one: they all do.
 *   {crud.surfaces}                      // render ONCE at the end of the page JSX:
 *                                       // all entity dialogs + the overlay host
 *
 * Built in (do NOT re-implement): optimistic update + Rückgängig counter-write
 * on edit, fetchAll-on-error, edit-from-overlay, and per-entity overlay bodies
 * (RecordHeader + <{Entity}Details> with every relation reachable and the
 * contextual "+" prefilled; list-field back-references additionally get a
 * "choose existing" picker that links an EXISTING record — built in, do not
 * re-roll). Drag writes (onEventDrop/onCardMove) stay YOURS:
 * optimistic setter first, PATCH in background, undoToast with counter-write.
 *
 * Overlay content per entity (the host renders these — you never compose
 * Details blocks yourself):
 *   kunden: kunde_vorname, kunde_nachname, email, telefon, strasse, hausnummer, plz, ort, …  ·  ← fahrraeder (list + contextual +) · ← reparaturauftraege (list + contextual +)
 *   fahrraeder: besitzer, marke, modell, fahrradtyp, rahmengroesse, rahmennummer, farbe, kaufdatum  ·  → kunden · ← reparaturauftraege (list + contextual +)
 *   reparaturauftraege: kunde, fahrrad, problembeschreibung, wunschtermin, uebergabetermin, prioritaet, status  ·  → kunden · → fahrraeder · ← kostenvoranschlaege (list + contextual +)
 *   ersatzteile: bezeichnung, artikelnummer, preis, lagerbestand, lieferant  ·  ← kostenvoranschlaege (list + contextual + + choose existing)
 *   kostenvoranschlaege: reparaturauftrag, datum, positionen, ersatzteile, gesamtbetrag, freigabe_status, bemerkung  ·  → reparaturauftraege · → ersatzteile
 */
import { useState, useMemo, type ReactNode } from 'react';
import type { Kunden, Fahrraeder, Reparaturauftraege, Ersatzteile, Kostenvoranschlaege } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { LivingAppsService, createRecordUrl, extractRecordIds } from '@/services/livingAppsService';
import { enrichFahrraeder, enrichReparaturauftraege, enrichKostenvoranschlaege } from '@/lib/enrich';
import type { EnrichedFahrraeder, EnrichedReparaturauftraege, EnrichedKostenvoranschlaege } from '@/types/enriched';
import { useDashboardData } from '@/hooks/useDashboardData';
import {
  useRecordOverlayStack, RecordOverlayHost, RecordHeader,
  type RecordOverlayStack,
} from '@/components/widgets/RecordView';
import { KundenDialog, type KundenDialogDefaults } from '@/components/dialogs/KundenDialog';
import { KundenDetails } from '@/components/details/KundenDetails';
import { FahrraederDialog, type FahrraederDialogDefaults } from '@/components/dialogs/FahrraederDialog';
import { FahrraederDetails } from '@/components/details/FahrraederDetails';
import { ReparaturauftraegeDialog, type ReparaturauftraegeDialogDefaults } from '@/components/dialogs/ReparaturauftraegeDialog';
import { ReparaturauftraegeDetails } from '@/components/details/ReparaturauftraegeDetails';
import { ErsatzteileDialog, type ErsatzteileDialogDefaults } from '@/components/dialogs/ErsatzteileDialog';
import { ErsatzteileDetails } from '@/components/details/ErsatzteileDetails';
import { KostenvoranschlaegeDialog, type KostenvoranschlaegeDialogDefaults } from '@/components/dialogs/KostenvoranschlaegeDialog';
import { KostenvoranschlaegeDetails } from '@/components/details/KostenvoranschlaegeDetails';
import { PickExistingDialog } from '@/components/PickExistingDialog';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import { t, appLabel } from '@/i18n';
import { undoToast } from '@/lib/polish';
import { usePermissions } from '@/lib/permissions';
import { toast } from 'sonner';
import { formatDate } from '@/lib/formatters';

// The overlay union — one branch per entity, `record` typed the way the data
// flows: Enriched* where enrichment exists, the raw record type otherwise.
// The host resolves enrichment itself; pages pass raw records everywhere.
export type OverlayItem =
  | { type: 'kunden'; record: Kunden }
  | { type: 'fahrraeder'; record: EnrichedFahrraeder }
  | { type: 'reparaturauftraege'; record: EnrichedReparaturauftraege }
  | { type: 'ersatzteile'; record: Ersatzteile }
  | { type: 'kostenvoranschlaege'; record: EnrichedKostenvoranschlaege };

/** The useDashboardData() return — pass it in, never re-fetch inside. */
export type EntityCrudData = ReturnType<typeof useDashboardData>;

export interface EntityCrudOptions {
  /** Per-type overlay footer — the record's next workflow step. */
  footer?: (top: OverlayItem) => ReactNode | { label: ReactNode; onClick: () => void } | undefined;
  placement?: 'side' | 'center';
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export interface EntityCrudApi<TRecord, TDefaults> {
  /** Open the create dialog, optionally prefilled (shape-tolerant defaults). */
  openCreate: (defaults?: TDefaults) => void;
  /** Open the edit dialog for a record (recordId + defaults are wired). */
  openEdit: (record: TRecord) => void;
  /** Open the record overlay (raw record is fine — enrichment resolved inside). */
  openDetail: (record: TRecord) => void;
  /** May the signed-in user create/change records of this list? (the
   *  platform's rights — show a „+ Neu“ only when true; openCreate/openEdit
   *  refuse with a notice otherwise). */
  canWrite: boolean;
}

export interface EntityCrud {
  /** The overlay stack for drills: push / pop / replace / close. */
  overlay: RecordOverlayStack<OverlayItem>;
  /** Render ONCE at the end of the page JSX — all dialogs + the overlay host. */
  surfaces: ReactNode;
  kunden: EntityCrudApi<Kunden, KundenDialogDefaults>;
  fahrraeder: EntityCrudApi<Fahrraeder, FahrraederDialogDefaults>;
  reparaturauftraege: EntityCrudApi<Reparaturauftraege, ReparaturauftraegeDialogDefaults>;
  ersatzteile: EntityCrudApi<Ersatzteile, ErsatzteileDialogDefaults>;
  kostenvoranschlaege: EntityCrudApi<Kostenvoranschlaege, KostenvoranschlaegeDialogDefaults>;
  /** The display-ready array per entity: Enriched* where an enrich function
   *  exists, the raw array otherwise. One key per entity so no page has to
   *  know which is which. Reuse these; never re-enrich in the page. */
  enriched: { kunden: Kunden[]; fahrraeder: EnrichedFahrraeder[]; reparaturauftraege: EnrichedReparaturauftraege[]; ersatzteile: Ersatzteile[]; kostenvoranschlaege: EnrichedKostenvoranschlaege[] };
}

export function useEntityCrud(data: EntityCrudData, options?: EntityCrudOptions): EntityCrud {
  const overlay = useRecordOverlayStack<OverlayItem>();
  // the platform's rights of the signed-in user (lib/permissions.ts) — unknown = allowed
  const perms = usePermissions();
  const refuse = () => { toast.error(t('perm_denied_title'), { description: t('perm_denied_desc') }); };
  const [kundenDialog, setKundenDialog] = useState<{ defaults?: KundenDialogDefaults; editing?: Kunden } | null>(null);
  const [fahrraederDialog, setFahrraederDialog] = useState<{ defaults?: FahrraederDialogDefaults; editing?: Fahrraeder } | null>(null);
  const [reparaturauftraegeDialog, setReparaturauftraegeDialog] = useState<{ defaults?: ReparaturauftraegeDialogDefaults; editing?: Reparaturauftraege } | null>(null);
  const [ersatzteileDialog, setErsatzteileDialog] = useState<{ defaults?: ErsatzteileDialogDefaults; editing?: Ersatzteile } | null>(null);
  const [kostenvoranschlaegeDialog, setKostenvoranschlaegeDialog] = useState<{ defaults?: KostenvoranschlaegeDialogDefaults; editing?: Kostenvoranschlaege } | null>(null);
  // „Vorhandene wählen" für den Listenfeld-Rückbezug kostenvoranschlaege.ersatzteile → ersatzteile: hält die Hub-record_id.
  const [pickErsatzteileKostenvoranschlaege, setPickErsatzteileKostenvoranschlaege] = useState<string | null>(null);
  const enrichedFahrraeder = useMemo(() => enrichFahrraeder(data.fahrraeder, { kundenMap: data.kundenMap }), [data.fahrraeder, data.kundenMap]);
  const enrichedReparaturauftraege = useMemo(() => enrichReparaturauftraege(data.reparaturauftraege, { kundenMap: data.kundenMap, fahrraederMap: data.fahrraederMap }), [data.reparaturauftraege, data.kundenMap, data.fahrraederMap]);
  const enrichedKostenvoranschlaege = useMemo(() => enrichKostenvoranschlaege(data.kostenvoranschlaege, { reparaturauftraegeMap: data.reparaturauftraegeMap, ersatzteileMap: data.ersatzteileMap }), [data.kostenvoranschlaege, data.reparaturauftraegeMap, data.ersatzteileMap]);

  function detailKunden(record: Kunden, push = false) {
    const item: OverlayItem = { type: 'kunden', record };
    if (push) overlay.push(item); else overlay.replace(item);
  }

  async function submitKunden(fields: Kunden['fields']) {
    const editing = kundenDialog?.editing;
    if (editing) {
      const prev = editing;
      data.setKunden(list => list.map(r => (r.record_id === editing.record_id ? { ...r, fields } : r)));
      try {
        await LivingAppsService.updateKundenEntry(editing.record_id, fields);
      } catch (err) {
        data.fetchAll();
        throw err;
      }
      undoToast(`${appLabel('kunden')} — ${t('crud_updated')}`, async () => {
        data.setKunden(list => list.map(r => (r.record_id === prev.record_id ? prev : r)));
        try { await LivingAppsService.updateKundenEntry(prev.record_id, prev.fields); } catch { data.fetchAll(); }
      });
    } else {
      await LivingAppsService.createKundenEntry(fields);
      undoToast(`${appLabel('kunden')} — ${t('crud_created')}`);
      data.fetchAll();
    }
  }

  function detailFahrraeder(record: Fahrraeder, push = false) {
    const rec = enrichedFahrraeder.find(r => r.record_id === record.record_id);
    if (!rec) return;
    const item: OverlayItem = { type: 'fahrraeder', record: rec };
    if (push) overlay.push(item); else overlay.replace(item);
  }

  async function submitFahrraeder(fields: Fahrraeder['fields']) {
    const editing = fahrraederDialog?.editing;
    if (editing) {
      const prev = editing;
      data.setFahrraeder(list => list.map(r => (r.record_id === editing.record_id ? { ...r, fields } : r)));
      try {
        await LivingAppsService.updateFahrraederEntry(editing.record_id, fields);
      } catch (err) {
        data.fetchAll();
        throw err;
      }
      undoToast(`${appLabel('fahrraeder')} — ${t('crud_updated')}`, async () => {
        data.setFahrraeder(list => list.map(r => (r.record_id === prev.record_id ? prev : r)));
        try { await LivingAppsService.updateFahrraederEntry(prev.record_id, prev.fields); } catch { data.fetchAll(); }
      });
    } else {
      await LivingAppsService.createFahrraederEntry(fields);
      undoToast(`${appLabel('fahrraeder')} — ${t('crud_created')}`);
      data.fetchAll();
    }
  }

  function detailReparaturauftraege(record: Reparaturauftraege, push = false) {
    const rec = enrichedReparaturauftraege.find(r => r.record_id === record.record_id);
    if (!rec) return;
    const item: OverlayItem = { type: 'reparaturauftraege', record: rec };
    if (push) overlay.push(item); else overlay.replace(item);
  }

  async function submitReparaturauftraege(fields: Reparaturauftraege['fields']) {
    const editing = reparaturauftraegeDialog?.editing;
    if (editing) {
      const prev = editing;
      data.setReparaturauftraege(list => list.map(r => (r.record_id === editing.record_id ? { ...r, fields } : r)));
      try {
        await LivingAppsService.updateReparaturauftraegeEntry(editing.record_id, fields);
      } catch (err) {
        data.fetchAll();
        throw err;
      }
      undoToast(`${appLabel('reparaturauftraege')} — ${t('crud_updated')}`, async () => {
        data.setReparaturauftraege(list => list.map(r => (r.record_id === prev.record_id ? prev : r)));
        try { await LivingAppsService.updateReparaturauftraegeEntry(prev.record_id, prev.fields); } catch { data.fetchAll(); }
      });
    } else {
      await LivingAppsService.createReparaturauftraegeEntry(fields);
      undoToast(`${appLabel('reparaturauftraege')} — ${t('crud_created')}`);
      data.fetchAll();
    }
  }

  function detailErsatzteile(record: Ersatzteile, push = false) {
    const item: OverlayItem = { type: 'ersatzteile', record };
    if (push) overlay.push(item); else overlay.replace(item);
  }

  async function submitErsatzteile(fields: Ersatzteile['fields']) {
    const editing = ersatzteileDialog?.editing;
    if (editing) {
      const prev = editing;
      data.setErsatzteile(list => list.map(r => (r.record_id === editing.record_id ? { ...r, fields } : r)));
      try {
        await LivingAppsService.updateErsatzteileEntry(editing.record_id, fields);
      } catch (err) {
        data.fetchAll();
        throw err;
      }
      undoToast(`${appLabel('ersatzteile')} — ${t('crud_updated')}`, async () => {
        data.setErsatzteile(list => list.map(r => (r.record_id === prev.record_id ? prev : r)));
        try { await LivingAppsService.updateErsatzteileEntry(prev.record_id, prev.fields); } catch { data.fetchAll(); }
      });
    } else {
      await LivingAppsService.createErsatzteileEntry(fields);
      undoToast(`${appLabel('ersatzteile')} — ${t('crud_created')}`);
      data.fetchAll();
    }
  }

  // Link an EXISTING Kostenvoranschlaege to the Ersatzteile hub: append the hub URL to the
  // source's list field. Optimistic setter first, PATCH, undoToast counter-write.
  async function linkErsatzteileKostenvoranschlaege(sourceId: string) {
    const hub = pickErsatzteileKostenvoranschlaege;
    const src = data.kostenvoranschlaege.find(r => r.record_id === sourceId);
    if (!hub || !src) return;
    const ids = extractRecordIds(src.fields.ersatzteile);
    if (ids.includes(hub)) return;
    const next = [...ids, hub].map(id => createRecordUrl(APP_IDS.ERSATZTEILE, id));
    data.setKostenvoranschlaege(list => list.map(r => (r.record_id === sourceId ? { ...r, fields: { ...r.fields, ersatzteile: next } } : r)));
    try {
      await LivingAppsService.updateKostenvoranschlaegeEntry(sourceId, { ersatzteile: next });
    } catch (err) {
      data.fetchAll();
      throw err;
    }
    undoToast(`${appLabel('kostenvoranschlaege')} — ${t('pick_linked')}`, async () => {
      data.setKostenvoranschlaege(list => list.map(r => (r.record_id === sourceId ? src : r)));
      try { await LivingAppsService.updateKostenvoranschlaegeEntry(sourceId, { ersatzteile: src.fields.ersatzteile }); } catch { data.fetchAll(); }
    });
  }

  function detailKostenvoranschlaege(record: Kostenvoranschlaege, push = false) {
    const rec = enrichedKostenvoranschlaege.find(r => r.record_id === record.record_id);
    if (!rec) return;
    const item: OverlayItem = { type: 'kostenvoranschlaege', record: rec };
    if (push) overlay.push(item); else overlay.replace(item);
  }

  async function submitKostenvoranschlaege(fields: Kostenvoranschlaege['fields']) {
    const editing = kostenvoranschlaegeDialog?.editing;
    if (editing) {
      const prev = editing;
      data.setKostenvoranschlaege(list => list.map(r => (r.record_id === editing.record_id ? { ...r, fields } : r)));
      try {
        await LivingAppsService.updateKostenvoranschlaegeEntry(editing.record_id, fields);
      } catch (err) {
        data.fetchAll();
        throw err;
      }
      undoToast(`${appLabel('kostenvoranschlaege')} — ${t('crud_updated')}`, async () => {
        data.setKostenvoranschlaege(list => list.map(r => (r.record_id === prev.record_id ? prev : r)));
        try { await LivingAppsService.updateKostenvoranschlaegeEntry(prev.record_id, prev.fields); } catch { data.fetchAll(); }
      });
    } else {
      await LivingAppsService.createKostenvoranschlaegeEntry(fields);
      undoToast(`${appLabel('kostenvoranschlaege')} — ${t('crud_created')}`);
      data.fetchAll();
    }
  }

  const surfaces = (
    <>
      <KundenDialog
        open={kundenDialog !== null}
        onClose={() => setKundenDialog(null)}
        onSubmit={submitKunden}
        defaultValues={kundenDialog?.defaults}
        recordId={kundenDialog?.editing?.record_id}
        enablePhotoScan={AI_PHOTO_SCAN['Kunden']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Kunden']}
      />
      <FahrraederDialog
        open={fahrraederDialog !== null}
        onClose={() => setFahrraederDialog(null)}
        onSubmit={submitFahrraeder}
        defaultValues={fahrraederDialog?.defaults}
        recordId={fahrraederDialog?.editing?.record_id}
        kundenList={data.kunden}
        enablePhotoScan={AI_PHOTO_SCAN['Fahrraeder']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Fahrraeder']}
      />
      <ReparaturauftraegeDialog
        open={reparaturauftraegeDialog !== null}
        onClose={() => setReparaturauftraegeDialog(null)}
        onSubmit={submitReparaturauftraege}
        defaultValues={reparaturauftraegeDialog?.defaults}
        recordId={reparaturauftraegeDialog?.editing?.record_id}
        kundenList={data.kunden}
        fahrraederList={data.fahrraeder}
        enablePhotoScan={AI_PHOTO_SCAN['Reparaturauftraege']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Reparaturauftraege']}
      />
      <ErsatzteileDialog
        open={ersatzteileDialog !== null}
        onClose={() => setErsatzteileDialog(null)}
        onSubmit={submitErsatzteile}
        defaultValues={ersatzteileDialog?.defaults}
        recordId={ersatzteileDialog?.editing?.record_id}
        enablePhotoScan={AI_PHOTO_SCAN['Ersatzteile']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Ersatzteile']}
      />
      <KostenvoranschlaegeDialog
        open={kostenvoranschlaegeDialog !== null}
        onClose={() => setKostenvoranschlaegeDialog(null)}
        onSubmit={submitKostenvoranschlaege}
        defaultValues={kostenvoranschlaegeDialog?.defaults}
        recordId={kostenvoranschlaegeDialog?.editing?.record_id}
        reparaturauftraegeList={data.reparaturauftraege}
        ersatzteileList={data.ersatzteile}
        enablePhotoScan={AI_PHOTO_SCAN['Kostenvoranschlaege']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Kostenvoranschlaege']}
      />
      <PickExistingDialog
        open={pickErsatzteileKostenvoranschlaege !== null}
        onClose={() => setPickErsatzteileKostenvoranschlaege(null)}
        title={t('pick_title', { title: appLabel('kostenvoranschlaege') })}
        items={data.kostenvoranschlaege
          .filter(r => !extractRecordIds(r.fields.ersatzteile).includes(pickErsatzteileKostenvoranschlaege ?? ''))
          .map(r => ({ id: r.record_id, label: String(appLabel('kostenvoranschlaege')), hint: r.fields.datum ? String(r.fields.datum) : undefined }))}
        onPick={linkErsatzteileKostenvoranschlaege}
      />
      <RecordOverlayHost
        overlay={overlay}
        placement={options?.placement}
        size={options?.size}
        footer={options?.footer}
        render={(top) => {
          if (top.type === 'kunden') {
            return (
              <>
                <RecordHeader title={top.record.fields.kunde_vorname ?? appLabel('kunden')} subtitle={undefined} />
                <KundenDetails
                  record={top.record}
                  fahrraederList={data.fahrraeder}
                  onOpenFahrraeder={(r) => detailFahrraeder(r, true)}
                  onAddFahrraeder={perms.canWrite('fahrraeder') ? () => setFahrraederDialog({ defaults: { besitzer: createRecordUrl(APP_IDS.KUNDEN, top.record.record_id) } }) : undefined}
                  reparaturauftraegeList={data.reparaturauftraege}
                  onOpenReparaturauftraege={(r) => detailReparaturauftraege(r, true)}
                  onAddReparaturauftraege={perms.canWrite('reparaturauftraege') ? () => setReparaturauftraegeDialog({ defaults: { kunde: createRecordUrl(APP_IDS.KUNDEN, top.record.record_id) } }) : undefined}
                />
              </>
            );
          }
          if (top.type === 'fahrraeder') {
            return (
              <>
                <RecordHeader title={top.record.fields.marke ?? appLabel('fahrraeder')} subtitle={top.record.fields.kaufdatum ? formatDate(top.record.fields.kaufdatum) : undefined} />
                <FahrraederDetails
                  record={top.record}
                  kundenList={data.kunden}
                  onOpenKunden={(r) => detailKunden(r, true)}
                  reparaturauftraegeList={data.reparaturauftraege}
                  onOpenReparaturauftraege={(r) => detailReparaturauftraege(r, true)}
                  onAddReparaturauftraege={perms.canWrite('reparaturauftraege') ? () => setReparaturauftraegeDialog({ defaults: { fahrrad: createRecordUrl(APP_IDS.FAHRRAEDER, top.record.record_id) } }) : undefined}
                />
              </>
            );
          }
          if (top.type === 'reparaturauftraege') {
            return (
              <>
                <RecordHeader title={appLabel('reparaturauftraege')} subtitle={top.record.fields.wunschtermin ? formatDate(top.record.fields.wunschtermin) : undefined} />
                <ReparaturauftraegeDetails
                  record={top.record}
                  kundenList={data.kunden}
                  onOpenKunden={(r) => detailKunden(r, true)}
                  fahrraederList={data.fahrraeder}
                  onOpenFahrraeder={(r) => detailFahrraeder(r, true)}
                  kostenvoranschlaegeList={data.kostenvoranschlaege}
                  onOpenKostenvoranschlaege={(r) => detailKostenvoranschlaege(r, true)}
                  onAddKostenvoranschlaege={perms.canWrite('kostenvoranschlaege') ? () => setKostenvoranschlaegeDialog({ defaults: { reparaturauftrag: createRecordUrl(APP_IDS.REPARATURAUFTRAEGE, top.record.record_id) } }) : undefined}
                />
              </>
            );
          }
          if (top.type === 'ersatzteile') {
            return (
              <>
                <RecordHeader title={top.record.fields.bezeichnung ?? appLabel('ersatzteile')} subtitle={undefined} />
                <ErsatzteileDetails
                  record={top.record}
                  kostenvoranschlaegeList={data.kostenvoranschlaege}
                  onOpenKostenvoranschlaege={(r) => detailKostenvoranschlaege(r, true)}
                  onAddKostenvoranschlaege={perms.canWrite('kostenvoranschlaege') ? () => setKostenvoranschlaegeDialog({ defaults: { ersatzteile: [createRecordUrl(APP_IDS.ERSATZTEILE, top.record.record_id)] } }) : undefined}
                  onPickKostenvoranschlaege={perms.canWrite('kostenvoranschlaege') ? () => setPickErsatzteileKostenvoranschlaege(top.record.record_id) : undefined}
                />
              </>
            );
          }
          if (top.type === 'kostenvoranschlaege') {
            return (
              <>
                <RecordHeader title={appLabel('kostenvoranschlaege')} subtitle={top.record.fields.datum ? formatDate(top.record.fields.datum) : undefined} />
                <KostenvoranschlaegeDetails
                  record={top.record}
                  reparaturauftraegeList={data.reparaturauftraege}
                  onOpenReparaturauftraege={(r) => detailReparaturauftraege(r, true)}
                  ersatzteileList={data.ersatzteile}
                />
              </>
            );
          }
          return null;
        }}
        canEdit={(top) => {
          if (top.type === 'kunden') return perms.canWrite('kunden');
          if (top.type === 'fahrraeder') return perms.canWrite('fahrraeder');
          if (top.type === 'reparaturauftraege') return perms.canWrite('reparaturauftraege');
          if (top.type === 'ersatzteile') return perms.canWrite('ersatzteile');
          if (top.type === 'kostenvoranschlaege') return perms.canWrite('kostenvoranschlaege');
          return true;
        }}
        onEdit={(top) => {
          overlay.close();
          if (top.type === 'kunden') setKundenDialog({ editing: top.record, defaults: top.record.fields });
          if (top.type === 'fahrraeder') setFahrraederDialog({ editing: top.record, defaults: top.record.fields });
          if (top.type === 'reparaturauftraege') setReparaturauftraegeDialog({ editing: top.record, defaults: top.record.fields });
          if (top.type === 'ersatzteile') setErsatzteileDialog({ editing: top.record, defaults: top.record.fields });
          if (top.type === 'kostenvoranschlaege') setKostenvoranschlaegeDialog({ editing: top.record, defaults: top.record.fields });
        }}
      />
    </>
  );

  return {
    overlay,
    surfaces,
    kunden: {
      openCreate: (defaults?: KundenDialogDefaults) => (perms.canWrite('kunden') ? setKundenDialog({ defaults }) : refuse()),
      openEdit: (record: Kunden) => (perms.canWrite('kunden') ? setKundenDialog({ editing: record, defaults: record.fields }) : refuse()),
      openDetail: (record: Kunden) => detailKunden(record, false),
      canWrite: perms.canWrite('kunden'),
    },
    fahrraeder: {
      openCreate: (defaults?: FahrraederDialogDefaults) => (perms.canWrite('fahrraeder') ? setFahrraederDialog({ defaults }) : refuse()),
      openEdit: (record: Fahrraeder) => (perms.canWrite('fahrraeder') ? setFahrraederDialog({ editing: record, defaults: record.fields }) : refuse()),
      openDetail: (record: Fahrraeder) => detailFahrraeder(record, false),
      canWrite: perms.canWrite('fahrraeder'),
    },
    reparaturauftraege: {
      openCreate: (defaults?: ReparaturauftraegeDialogDefaults) => (perms.canWrite('reparaturauftraege') ? setReparaturauftraegeDialog({ defaults }) : refuse()),
      openEdit: (record: Reparaturauftraege) => (perms.canWrite('reparaturauftraege') ? setReparaturauftraegeDialog({ editing: record, defaults: record.fields }) : refuse()),
      openDetail: (record: Reparaturauftraege) => detailReparaturauftraege(record, false),
      canWrite: perms.canWrite('reparaturauftraege'),
    },
    ersatzteile: {
      openCreate: (defaults?: ErsatzteileDialogDefaults) => (perms.canWrite('ersatzteile') ? setErsatzteileDialog({ defaults }) : refuse()),
      openEdit: (record: Ersatzteile) => (perms.canWrite('ersatzteile') ? setErsatzteileDialog({ editing: record, defaults: record.fields }) : refuse()),
      openDetail: (record: Ersatzteile) => detailErsatzteile(record, false),
      canWrite: perms.canWrite('ersatzteile'),
    },
    kostenvoranschlaege: {
      openCreate: (defaults?: KostenvoranschlaegeDialogDefaults) => (perms.canWrite('kostenvoranschlaege') ? setKostenvoranschlaegeDialog({ defaults }) : refuse()),
      openEdit: (record: Kostenvoranschlaege) => (perms.canWrite('kostenvoranschlaege') ? setKostenvoranschlaegeDialog({ editing: record, defaults: record.fields }) : refuse()),
      openDetail: (record: Kostenvoranschlaege) => detailKostenvoranschlaege(record, false),
      canWrite: perms.canWrite('kostenvoranschlaege'),
    },
    enriched: { kunden: data.kunden, fahrraeder: enrichedFahrraeder, reparaturauftraege: enrichedReparaturauftraege, ersatzteile: data.ersatzteile, kostenvoranschlaege: enrichedKostenvoranschlaege },
  };
}
