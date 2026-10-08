// Auto-generated. Per-entity form-enhancements config for "Reparaturaufträge".
// Written by the backend form polish (app/services/form_polish.py) from the
// generator's manifest; scripts/parse-formulas.mjs expands the formula strings.
// Schema: see ./types.ts.

import type { FormEnhancements } from './types';

export const formEnhancements: FormEnhancements = {
  fieldOrder: [{"row": ["kunde", "fahrrad"], "cols": "1fr 1fr"}, {"row": ["status", "prioritaet"], "cols": "1fr 1fr"}, {"row": ["wunschtermin", "uebergabetermin"], "cols": "1fr 1fr"}, "problembeschreibung"],
  defaults: {
    'wunschtermin': { kind: 'today', withTime: true },
    'prioritaet': { kind: 'lookup', key: 'normal', label: 'Normal' },
    'status': { kind: 'lookup', key: 'angemeldet', label: 'Angemeldet' },
  },
  computed: {},
};

export const computedDeps: Record<string, string[]> = {};
export const computedApplookupRefs: Record<string, {lookupKey: string}[]> = {};
