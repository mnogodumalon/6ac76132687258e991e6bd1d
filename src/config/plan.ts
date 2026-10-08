// The orchestrator's plan, as far as the running app needs it
// (docs/orchestrator/SPEC.md). Generated — do not edit; regenerated on every
// build and update from the stored plan. Without a plan every map is empty.
//
//   SYSTEM_ASSIGNED entity → fields a tool fills when a record is CREATED — the
//                   value does not exist before; dialogs hide these on create and
//                   the form-polish sets no default on them. A scheduled or
//                   update-triggered tool owns its field but is NOT in here.
//   PLAN_SENTENCES  slug → the plan in the owner's words (flows' field page)
//
// The runtime write guard (FLOW_WRITES/OWNERSHIP, planGuard.ts) left on
// 23.09.2026: a flow page composes against its generated hook, whose submit
// plan IS the Schreibliste — there is no way to spell a write outside it.

export const SYSTEM_ASSIGNED: Record<string, string[]> = {
  "reparaturauftraege": [
    "uebergabetermin"
  ]
};

export const PLAN_SENTENCES: Record<string, string[]> = {
  "auftrag-annehmen": [
    "Legt an: fahrraeder, kunden, reparaturauftraege",
    "Automatisch: status (fester Wert „bestaetigt“)"
  ],
  "kostenvoranschlag-erstellen": [
    "Legt an: kostenvoranschlaege",
    "Ändert: reparaturauftraege",
    "Automatisch: datum (heutiges Datum, automatisch), gesamtbetrag (Summe der Preise der gewählten Ersatzteile), freigabe_status (fester Wert „offen“), status (fester Wert „wartet_auf_freigabe“)"
  ],
  "freigabe-erfassen": [
    "Ändert: kostenvoranschlaege, reparaturauftraege",
    "Automatisch: status (Bei Freigabe „In Bearbeitung“, bei Ablehnung „Storniert“)"
  ],
  "auftrag-abschliessen": [
    "Ändert: reparaturauftraege"
  ]
};

export const PLAN_SUMMARY = "Eine Anwendung für eine kleine Fahrradwerkstatt: Sie verwaltet Kunden, deren Fahrräder und die Reparaturaufträge mit Übergabetermin, Priorität und Status. Zu jedem Auftrag gibt es Kostenvoranschläge mit den verwendeten Ersatzteilen. Kunden können sich online für einen Reparaturtermin anmelden.";

/** slug → the lists a flow writes (the plan's Schreibliste). The nav leaves a
 *  flow out for a user who may not write one of them (lib/permissions.ts). */
export const FLOW_ENTITIES: Record<string, string[]> = {
  "auftrag-annehmen": [
    "fahrraeder",
    "kunden",
    "reparaturauftraege"
  ],
  "kostenvoranschlag-erstellen": [
    "kostenvoranschlaege",
    "reparaturauftraege"
  ],
  "freigabe-erfassen": [
    "kostenvoranschlaege",
    "reparaturauftraege"
  ],
  "auftrag-abschliessen": [
    "reparaturauftraege"
  ]
};
