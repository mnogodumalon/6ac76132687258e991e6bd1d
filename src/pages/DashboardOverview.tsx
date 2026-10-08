import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { IconAlertTriangle, IconPlus, IconCalendarEvent, IconFileInvoice, IconPackage, IconFlame, IconHourglass } from '@tabler/icons-react';
import type { DashboardData } from '@/hooks/useDashboardData';
import { useEntityCrud } from '@/components/EntityCrud';
import { DashboardGrid } from '@/components/DashboardGrid';
import { WorkList } from '@/components/WorkList';
import { HeroBanner } from '@/components/HeroBanner';
import { StatStrip, StatStripItem } from '@/components/StatCard';
import { KanbanWidget, type KanbanCard, type KanbanColumn, type KanbanTone } from '@/components/widgets/KanbanWidget';
import { LOOKUP_OPTIONS, lookupOption } from '@/types/app';
import type { Reparaturauftraege } from '@/types/app';
import { LivingAppsService, extractRecordId } from '@/services/livingAppsService';
import { formatDate, lookupKey } from '@/lib/formatters';
import { gruss, namen, undoToast, useClock } from '@/lib/polish';
import { tx } from '@/i18n';

const NEXT_STATUS: Record<string, string> = {
  angemeldet: 'bestaetigt',
  bestaetigt: 'in_bearbeitung',
  in_bearbeitung: 'wartet_auf_freigabe',
  wartet_auf_freigabe: 'fertig',
  fertig: 'uebergeben',
};
const CLOSED = ['uebergeben', 'storniert'];
const LOW_STOCK = 3;

const COLUMN_TONE: Record<string, KanbanTone> = {
  wartet_auf_freigabe: 'warning',
  fertig: 'success',
  storniert: 'destructive',
};

type Filter = 'all' | 'dringend' | 'freigabe';

export default function DashboardOverview({ data }: { data: DashboardData }) {
  const { reparaturauftraege, kostenvoranschlaege, ersatzteile, setReparaturauftraege, setKostenvoranschlaege, fetchAll } = data;
  const clock = useClock();
  const [filter, setFilter] = useState<Filter>('all');

  // Writes -----------------------------------------------------------------
  const setStatus = (id: string, key: string) => {
    setReparaturauftraege(prev => prev.map(r => r.record_id === id
      ? { ...r, fields: { ...r.fields, status: lookupOption('reparaturauftraege', 'status', key) } }
      : r));
    return LivingAppsService.updateReparaturauftraegeEntry(id, { status: key });
  };

  const advance = (r: Reparaturauftraege) => {
    const cur = lookupKey(r.fields.status) ?? '';
    const next = NEXT_STATUS[cur];
    if (!next) return;
    const nextLabel = lookupOption('reparaturauftraege', 'status', next).label;
    setStatus(r.record_id, next).catch(() => fetchAll());
    undoToast(tx`Auftrag → ${nextLabel}`, () => {
      setStatus(r.record_id, cur).catch(() => fetchAll());
    });
  };

  const approveKv = (id: string) => {
    const patch = (key: string) => {
      setKostenvoranschlaege(prev => prev.map(k => k.record_id === id
        ? { ...k, fields: { ...k.fields, freigabe_status: lookupOption('kostenvoranschlaege', 'freigabe_status', key) } }
        : k));
      return LivingAppsService.updateKostenvoranschlaegeEntry(id, { freigabe_status: key });
    };
    const prevKey = lookupKey(kostenvoranschlaege.find(k => k.record_id === id)?.fields.freigabe_status) ?? 'offen';
    patch('freigegeben').catch(() => fetchAll());
    undoToast(tx`Kostenvoranschlag freigegeben`, () => { patch(prevKey).catch(() => fetchAll()); });
  };

  const crud = useEntityCrud(data, {
    footer: (top) => {
      if (top.type !== 'reparaturauftraege') return undefined;
      const raw = reparaturauftraege.find(r => r.record_id === top.record.record_id);
      const next = raw ? NEXT_STATUS[lookupKey(raw.fields.status) ?? ''] : undefined;
      if (!raw || !next) return undefined;
      return {
        label: tx`Weiter: ${lookupOption('reparaturauftraege', 'status', next).label}`,
        onClick: () => advance(raw),
      };
    },
  });
  const enrichedAuftraege = crud.enriched.reparaturauftraege;
  const enrichedKv = crud.enriched.kostenvoranschlaege;

  // Derived ----------------------------------------------------------------
  const today = format(clock, 'yyyy-MM-dd');
  const rawById = useMemo(() => new Map(reparaturauftraege.map(r => [r.record_id, r])), [reparaturauftraege]);

  const open = enrichedAuftraege.filter(r => !CLOSED.includes(lookupKey(r.fields.status) ?? ''));
  const dringend = open.filter(r => lookupKey(r.fields.prioritaet) === 'dringend');
  const openKv = enrichedKv.filter(k => (lookupKey(k.fields.freigabe_status) ?? 'offen') === 'offen');
  const openKvOrderIds = new Set(openKv.map(k => extractRecordId(k.fields.reparaturauftrag)).filter(Boolean) as string[]);
  const overdue = open
    .filter(r => r.fields.uebergabetermin && r.fields.uebergabetermin.slice(0, 10) < today)
    .sort((a, b) => (a.fields.uebergabetermin ?? '').localeCompare(b.fields.uebergabetermin ?? ''));
  const upcoming = open
    .filter(r => r.fields.uebergabetermin && r.fields.uebergabetermin.slice(0, 10) >= today)
    .sort((a, b) => (a.fields.uebergabetermin ?? '').localeCompare(b.fields.uebergabetermin ?? ''));
  const lowStock = ersatzteile
    .filter(e => (e.fields.lagerbestand ?? 0) < LOW_STOCK)
    .sort((a, b) => (a.fields.lagerbestand ?? 0) - (b.fields.lagerbestand ?? 0));

  const prioRank = (r: { fields: { prioritaet?: { key: string } } }) =>
    ({ dringend: 0, hoch: 1, normal: 2, niedrig: 3 } as Record<string, number>)[lookupKey(r.fields.prioritaet) ?? 'normal'] ?? 2;

  const columns: KanbanColumn[] = (LOOKUP_OPTIONS['reparaturauftraege']?.status ?? []).map(o => ({
    key: o.key, label: o.label, tone: COLUMN_TONE[o.key],
  }));

  const visible = enrichedAuftraege.filter(r => {
    if (filter === 'dringend') return lookupKey(r.fields.prioritaet) === 'dringend';
    if (filter === 'freigabe') return openKvOrderIds.has(r.record_id);
    return true;
  });
  const cards: KanbanCard[] = [...visible]
    .sort((a, b) => prioRank(a) - prioRank(b) || (a.fields.uebergabetermin ?? '9').localeCompare(b.fields.uebergabetermin ?? '9'))
    .map(r => {
      const prio = lookupKey(r.fields.prioritaet);
      return {
        id: `auftrag:${r.record_id}`,
        column: lookupKey(r.fields.status) ?? '',
        title: `${r.kundeName || '—'} · ${r.fahrradName || '—'}`,
        subtitle: [prio ? r.fields.prioritaet?.label : null, r.fields.uebergabetermin ? formatDate(r.fields.uebergabetermin) : null].filter(Boolean).join(' · '),
        tone: prio === 'dringend' ? 'destructive' : prio === 'hoch' ? 'warning' : 'default',
      };
    });

  const onCardMove = (cardId: string, newColumn: string) => {
    const id = cardId.split(':')[1];
    const rec = rawById.get(id);
    if (!rec) return;
    const prevKey = lookupKey(rec.fields.status) ?? '';
    if (prevKey === newColumn) return;
    const label = lookupOption('reparaturauftraege', 'status', newColumn).label;
    setStatus(id, newColumn).catch(() => fetchAll());
    undoToast(tx`Auftrag → ${label}`, () => { setStatus(id, prevKey).catch(() => fetchAll()); });
  };

  const openAuftrag = (id: string) => {
    const rec = rawById.get(id);
    if (rec) crud.reparaturauftraege.openDetail(rec);
  };

  const statusWord = (r: { fields: { status?: { label: string } } }) => r.fields.status?.label ?? '';
  const nextLabel = (r: Reparaturauftraege) => {
    const n = NEXT_STATUS[lookupKey(r.fields.status) ?? ''];
    return n ? lookupOption('reparaturauftraege', 'status', n).label : undefined;
  };
  const actionFor = (id: string) => {
    const rec = rawById.get(id);
    const label = rec ? nextLabel(rec) : undefined;
    return rec && label ? { label: `→ ${label}`, onClick: () => advance(rec) } : undefined;
  };

  // Context line -----------------------------------------------------------
  const todays = open.filter(r => r.fields.uebergabetermin?.slice(0, 10) === today).map(r => r.kundeName);
  const waiting = open.filter(r => lookupKey(r.fields.status) === 'wartet_auf_freigabe').map(r => r.kundeName);
  const context = todays.length > 0
    ? tx`Heute holen ${namen(todays)} ihr Rad ab.`
    : waiting.length > 0
      ? tx`${namen(waiting)} ${waiting.length === 1 ? 'wartet' : 'warten'} auf eine Freigabe.`
      : upcoming.length > 0
        ? tx`Nächste Übergabe: ${upcoming[0].kundeName} am ${formatDate(upcoming[0].fields.uebergabetermin)}.`
        : tx`Keine offenen Übergaben — die Werkstatt ist startklar.`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{gruss(clock)}</h1>
          <p className="text-sm text-muted-foreground">{context}</p>
        </div>
        {crud.reparaturauftraege.canWrite && (
          <button
            type="button"
            onClick={() => crud.reparaturauftraege.openCreate({ status: 'angemeldet', prioritaet: 'normal' })}
            className="inline-flex items-center gap-1.5 min-h-10 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <IconPlus size={16} className="shrink-0" />
            {tx('Neuer Auftrag')}
          </button>
        )}
      </div>

      <DashboardGrid
        variant="wide"
        hero={overdue.length > 0 && actionFor(overdue[0].record_id) ? (
          <HeroBanner
            icon={<IconAlertTriangle size={18} />}
            action={actionFor(overdue[0].record_id)!}
          >
            <b>{namen(overdue.map(r => r.kundeName))}</b>{' '}
            {tx`— Übergabe überfällig (seit ${formatDate(overdue[0].fields.uebergabetermin)}), Status: ${statusWord(overdue[0])}.`}
          </HeroBanner>
        ) : undefined}
        kpis={
          <StatStrip>
            <StatStripItem
              title={tx('Dringend offen')}
              value={dringend.length}
              icon={<IconFlame size={16} />}
              tone={dringend.length > 0 ? 'warning' : 'default'}
              onClick={() => setFilter(f => f === 'dringend' ? 'all' : 'dringend')}
              active={filter === 'dringend'}
            />
            <StatStripItem
              title={tx('Kostenvoranschlag wartet')}
              value={openKvOrderIds.size}
              icon={<IconHourglass size={16} />}
              tone="default"
              onClick={() => setFilter(f => f === 'freigabe' ? 'all' : 'freigabe')}
              active={filter === 'freigabe'}
            />
          </StatStrip>
        }
        primary={
          <KanbanWidget
            cards={cards}
            columns={columns}
            defaultCollapsed={['uebergeben', 'storniert']}
            onCardClick={card => openAuftrag(card.id.split(':')[1])}
            onCardMove={onCardMove}
            onAddCard={crud.reparaturauftraege.canWrite ? (col) => crud.reparaturauftraege.openCreate({ status: col }) : undefined}
          />
        }
        aside={
          <>
            <WorkList
              title={tx('Anstehende Übergaben')}
              icon={<IconCalendarEvent size={14} />}
              items={upcoming.map(r => ({
                id: r.record_id,
                title: `${r.kundeName || '—'} · ${r.fahrradName || '—'}`,
                secondLine: (
                  <>
                    <span className="font-medium">{formatDate(r.fields.uebergabetermin)}</span>
                    <span className="text-muted-foreground"> · {statusWord(r)}</span>
                  </>
                ),
                action: actionFor(r.record_id),
              }))}
              onItemClick={openAuftrag}
              empty={{ text: tx('Keine Übergabe geplant.'), action: crud.reparaturauftraege.canWrite ? { label: tx('Neuer Auftrag'), onClick: () => crud.reparaturauftraege.openCreate({ status: 'angemeldet' }) } : undefined }}
            />
            <WorkList
              title={tx('Freigabe offen')}
              icon={<IconFileInvoice size={14} />}
              items={openKv.map(k => ({
                id: k.record_id,
                title: k.reparaturauftragName || '—',
                secondLine: (
                  <>
                    <span className="font-medium text-amber-600">{tx('Offen')}</span>
                    <span className="text-muted-foreground"> · {k.fields.gesamtbetrag != null ? `${k.fields.gesamtbetrag.toFixed(2)} €` : '—'}</span>
                  </>
                ),
                action: { label: tx('✓ Freigeben'), onClick: () => approveKv(k.record_id) },
              }))}
              onItemClick={id => { const k = kostenvoranschlaege.find(x => x.record_id === id); if (k) crud.kostenvoranschlaege.openDetail(k); }}
              empty={{ text: tx('Alle Kostenvoranschläge sind entschieden.') }}
            />
            <WorkList
              title={tx('Ersatzteile knapp')}
              icon={<IconPackage size={14} />}
              items={lowStock.map(e => ({
                id: e.record_id,
                title: e.fields.bezeichnung ?? '—',
                secondLine: (
                  <>
                    <span className={`font-medium ${(e.fields.lagerbestand ?? 0) === 0 ? 'text-destructive' : 'text-amber-600'}`}>
                      {tx`Bestand ${e.fields.lagerbestand ?? 0}`}
                    </span>
                    <span className="text-muted-foreground"> · {e.fields.artikelnummer ?? ''}</span>
                  </>
                ),
              }))}
              onItemClick={id => { const e = ersatzteile.find(x => x.record_id === id); if (e) crud.ersatzteile.openDetail(e); }}
              empty={{ text: tx('Alle Ersatzteile ausreichend auf Lager.') }}
            />
          </>
        }
      />
      {crud.surfaces}
    </div>
  );
}
