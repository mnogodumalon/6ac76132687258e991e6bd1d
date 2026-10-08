import { lookupLabel } from '@/i18n';

// AUTOMATICALLY GENERATED TYPES - DO NOT EDIT

export type LookupValue = { key: string; label: string };
/** A raw record URL (applookup reference). NEVER render this directly
 *  in JSX — it is a URL, not a display value. Show the enriched `*Name`
 *  field or resolve it via the entity map instead. Assignable to/from
 *  string everywhere; the `& {}` keeps the alias NAME visible in tsc
 *  error messages (a plain primitive alias gets normalized away). */
export type RecordUrl = string & {};
export type GeoLocation = { lat: number; long: number; info?: string };

export type AttachmentType = 'file' | 'note' | 'url' | 'json';
export interface Attachment {
  id: string;
  type: AttachmentType;
  label: string | null;
  value: string | null;
  active: boolean;
  createdat?: string | null;
  updatedat?: string | null;
}

export interface AttachmentInput {
  type: AttachmentType;
  label?: string;
  value: string;
  active?: boolean;
}

export interface Kunden {
  record_id: string;
  /** The API field. */
  created_at: string;
  updated_at: string | null;
  /** Alias of created_at, filled by the read helpers. The API sends
   *  snake_case only — reading `createdat` off a raw record yields
   *  undefined, which type-checks and then crashes at runtime. */
  createdat: string;
  updatedat: string | null;
  fields: {
    kunde_vorname?: string;
    kunde_nachname?: string;
    email?: string;
    telefon?: string;
    strasse?: string;
    hausnummer?: string;
    plz?: string;
    ort?: string;
    bemerkung?: string;
  };
}

export interface Fahrraeder {
  record_id: string;
  /** The API field. */
  created_at: string;
  updated_at: string | null;
  /** Alias of created_at, filled by the read helpers. The API sends
   *  snake_case only — reading `createdat` off a raw record yields
   *  undefined, which type-checks and then crashes at runtime. */
  createdat: string;
  updatedat: string | null;
  fields: {
    besitzer?: RecordUrl; // applookup -> URL zu 'Kunden' Record
    marke?: string;
    modell?: string;
    fahrradtyp?: LookupValue;
    rahmengroesse?: string;
    rahmennummer?: string;
    farbe?: string;
    kaufdatum?: string; // Format: YYYY-MM-DD oder ISO String
  };
}

export interface Reparaturauftraege {
  record_id: string;
  /** The API field. */
  created_at: string;
  updated_at: string | null;
  /** Alias of created_at, filled by the read helpers. The API sends
   *  snake_case only — reading `createdat` off a raw record yields
   *  undefined, which type-checks and then crashes at runtime. */
  createdat: string;
  updatedat: string | null;
  fields: {
    kunde?: RecordUrl; // applookup -> URL zu 'Kunden' Record
    fahrrad?: RecordUrl; // applookup -> URL zu 'Fahrraeder' Record
    problembeschreibung?: string;
    wunschtermin?: string; // Format: YYYY-MM-DD oder ISO String
    uebergabetermin?: string; // Format: YYYY-MM-DD oder ISO String
    prioritaet?: LookupValue;
    status?: LookupValue;
  };
}

export interface Ersatzteile {
  record_id: string;
  /** The API field. */
  created_at: string;
  updated_at: string | null;
  /** Alias of created_at, filled by the read helpers. The API sends
   *  snake_case only — reading `createdat` off a raw record yields
   *  undefined, which type-checks and then crashes at runtime. */
  createdat: string;
  updatedat: string | null;
  fields: {
    bezeichnung?: string;
    artikelnummer?: string;
    preis?: number;
    lagerbestand?: number;
  };
}

export interface Kostenvoranschlaege {
  record_id: string;
  /** The API field. */
  created_at: string;
  updated_at: string | null;
  /** Alias of created_at, filled by the read helpers. The API sends
   *  snake_case only — reading `createdat` off a raw record yields
   *  undefined, which type-checks and then crashes at runtime. */
  createdat: string;
  updatedat: string | null;
  fields: {
    reparaturauftrag?: RecordUrl; // applookup -> URL zu 'Reparaturauftraege' Record
    datum?: string; // Format: YYYY-MM-DD oder ISO String
    positionen?: string;
    ersatzteile?: RecordUrl[];
    gesamtbetrag?: number;
    freigabe_status?: LookupValue;
    bemerkung?: string;
  };
}

export const APP_IDS = {
  KUNDEN: '6ac7610c7aadf5593f5a2d43',
  FAHRRAEDER: '6ac761117b30cfa3a3a0c897',
  REPARATURAUFTRAEGE: '6ac761117855b006276c88b7',
  ERSATZTEILE: '6ac76112f096a99ee80f9aa1',
  KOSTENVORANSCHLAEGE: '6ac7611258656804dcaf2821',
} as const;


export const LOOKUP_OPTIONS: Record<string, Record<string, {key: string, label: string}[]>> = {
  'fahrraeder': {
    fahrradtyp: [{ key: "trekkingrad", get label() { return lookupLabel('fahrraeder', 'fahrradtyp', "trekkingrad") ?? "Trekkingrad"; } }, { key: "mountainbike", get label() { return lookupLabel('fahrraeder', 'fahrradtyp', "mountainbike") ?? "Mountainbike"; } }, { key: "rennrad", get label() { return lookupLabel('fahrraeder', 'fahrradtyp', "rennrad") ?? "Rennrad"; } }, { key: "ebike", get label() { return lookupLabel('fahrraeder', 'fahrradtyp', "ebike") ?? "E-Bike"; } }, { key: "kinderrad", get label() { return lookupLabel('fahrraeder', 'fahrradtyp', "kinderrad") ?? "Kinderrad"; } }, { key: "lastenrad", get label() { return lookupLabel('fahrraeder', 'fahrradtyp', "lastenrad") ?? "Lastenrad"; } }, { key: "sonstiges", get label() { return lookupLabel('fahrraeder', 'fahrradtyp', "sonstiges") ?? "Sonstiges"; } }, { key: "citybike", get label() { return lookupLabel('fahrraeder', 'fahrradtyp', "citybike") ?? "Citybike"; } }],
  },
  'reparaturauftraege': {
    prioritaet: [{ key: "niedrig", get label() { return lookupLabel('reparaturauftraege', 'prioritaet', "niedrig") ?? "Niedrig"; } }, { key: "normal", get label() { return lookupLabel('reparaturauftraege', 'prioritaet', "normal") ?? "Normal"; } }, { key: "hoch", get label() { return lookupLabel('reparaturauftraege', 'prioritaet', "hoch") ?? "Hoch"; } }, { key: "dringend", get label() { return lookupLabel('reparaturauftraege', 'prioritaet', "dringend") ?? "Dringend"; } }],
    status: [{ key: "angemeldet", get label() { return lookupLabel('reparaturauftraege', 'status', "angemeldet") ?? "Angemeldet"; } }, { key: "bestaetigt", get label() { return lookupLabel('reparaturauftraege', 'status', "bestaetigt") ?? "Bestätigt"; } }, { key: "in_bearbeitung", get label() { return lookupLabel('reparaturauftraege', 'status', "in_bearbeitung") ?? "In Bearbeitung"; } }, { key: "wartet_auf_freigabe", get label() { return lookupLabel('reparaturauftraege', 'status', "wartet_auf_freigabe") ?? "Wartet auf Freigabe"; } }, { key: "fertig", get label() { return lookupLabel('reparaturauftraege', 'status', "fertig") ?? "Fertig"; } }, { key: "uebergeben", get label() { return lookupLabel('reparaturauftraege', 'status', "uebergeben") ?? "Übergeben"; } }, { key: "storniert", get label() { return lookupLabel('reparaturauftraege', 'status', "storniert") ?? "Storniert"; } }],
  },
  'kostenvoranschlaege': {
    freigabe_status: [{ key: "freigegeben", get label() { return lookupLabel('kostenvoranschlaege', 'freigabe_status', "freigegeben") ?? "Freigegeben"; } }, { key: "abgelehnt", get label() { return lookupLabel('kostenvoranschlaege', 'freigabe_status', "abgelehnt") ?? "Abgelehnt"; } }, { key: "offen", get label() { return lookupLabel('kostenvoranschlaege', 'freigabe_status', "offen") ?? "Offen"; } }],
  },
};

// Optimistic LookupValue writes: never re-type a label — resolve the schema
// option instead (its label is a locale-aware getter; falls back to the key).
// WRONG: status: { key: 'offen', label: 'Offen' }   (frozen in one language)
// RIGHT: status: lookupOption('<appKey>', 'status', 'offen')
export function lookupOption(app: string, field: string, key: string): LookupValue {
  return LOOKUP_OPTIONS[app]?.[field]?.find(o => o.key === key) ?? { key, label: key };
}

export const FIELD_TYPES: Record<string, Record<string, string>> = {
  'kunden': {
    'kunde_vorname': 'string/text',
    'kunde_nachname': 'string/text',
    'email': 'string/email',
    'telefon': 'string/tel',
    'strasse': 'string/text',
    'hausnummer': 'string/text',
    'plz': 'string/text',
    'ort': 'string/text',
    'bemerkung': 'string/textarea',
  },
  'fahrraeder': {
    'besitzer': 'applookup/select',
    'marke': 'string/text',
    'modell': 'string/text',
    'fahrradtyp': 'lookup/select',
    'rahmengroesse': 'string/text',
    'rahmennummer': 'string/text',
    'farbe': 'string/text',
    'kaufdatum': 'date/date',
  },
  'reparaturauftraege': {
    'kunde': 'applookup/select',
    'fahrrad': 'applookup/select',
    'problembeschreibung': 'string/textarea',
    'wunschtermin': 'date/datetimeminute',
    'uebergabetermin': 'date/date',
    'prioritaet': 'lookup/radio',
    'status': 'lookup/select',
  },
  'ersatzteile': {
    'bezeichnung': 'string/text',
    'artikelnummer': 'string/text',
    'preis': 'number',
    'lagerbestand': 'number',
  },
  'kostenvoranschlaege': {
    'reparaturauftrag': 'applookup/select',
    'datum': 'date/date',
    'positionen': 'string/textarea',
    'ersatzteile': 'multipleapplookup/select',
    'gesamtbetrag': 'number',
    'freigabe_status': 'lookup/radio',
    'bemerkung': 'string/textarea',
  },
};

export const HUB_TOPOLOGY: Record<string, { field: string; entity: string }[]> = {
};

type StripLookup<T> = {
  [K in keyof T]: T[K] extends LookupValue | undefined ? string | LookupValue | undefined
    : T[K] extends LookupValue[] | undefined ? string[] | LookupValue[] | undefined
    : T[K];
};

// Helper Types for creating new records (lookup fields as plain strings for API)
export type CreateKunden = StripLookup<Kunden['fields']>;
export type CreateFahrraeder = StripLookup<Fahrraeder['fields']>;
export type CreateReparaturauftraege = StripLookup<Reparaturauftraege['fields']>;
export type CreateErsatzteile = StripLookup<Ersatzteile['fields']>;
export type CreateKostenvoranschlaege = StripLookup<Kostenvoranschlaege['fields']>;