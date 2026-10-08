import type { EnrichedFahrraeder, EnrichedKostenvoranschlaege, EnrichedReparaturauftraege } from '@/types/enriched';
import type { Ersatzteile, Fahrraeder, Kostenvoranschlaege, Kunden, Reparaturauftraege } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolveDisplay(url: unknown, map: Map<string, any>, ...fields: string[]): string {
  if (!url) return '';
  const id = extractRecordId(url);
  if (!id) return '';
  const r = map.get(id);
  if (!r) return '';
  return fields.map(f => String(r.fields[f] ?? '')).join(' ').trim();
}

interface FahrraederMaps {
  kundenMap: Map<string, Kunden>;
}

export function enrichFahrraeder(
  fahrraeder: Fahrraeder[],
  maps: FahrraederMaps
): EnrichedFahrraeder[] {
  return fahrraeder.map(r => ({
    ...r,
    besitzerName: resolveDisplay(r.fields.besitzer, maps.kundenMap, 'kunde_vorname'),
  }));
}

interface ReparaturauftraegeMaps {
  kundenMap: Map<string, Kunden>;
  fahrraederMap: Map<string, Fahrraeder>;
}

export function enrichReparaturauftraege(
  reparaturauftraege: Reparaturauftraege[],
  maps: ReparaturauftraegeMaps
): EnrichedReparaturauftraege[] {
  return reparaturauftraege.map(r => ({
    ...r,
    kundeName: resolveDisplay(r.fields.kunde, maps.kundenMap, 'kunde_vorname'),
    fahrradName: resolveDisplay(r.fields.fahrrad, maps.fahrraederMap, 'marke'),
  }));
}

interface KostenvoranschlaegeMaps {
  reparaturauftraegeMap: Map<string, Reparaturauftraege>;
  ersatzteileMap: Map<string, Ersatzteile>;
}

export function enrichKostenvoranschlaege(
  kostenvoranschlaege: Kostenvoranschlaege[],
  maps: KostenvoranschlaegeMaps
): EnrichedKostenvoranschlaege[] {
  return kostenvoranschlaege.map(r => ({
    ...r,
    reparaturauftragName: resolveDisplay(r.fields.reparaturauftrag, maps.reparaturauftraegeMap, 'problembeschreibung'),
    ersatzteileName: resolveDisplay(r.fields.ersatzteile, maps.ersatzteileMap, 'bezeichnung'),
  }));
}
