import type { Fahrraeder, Kostenvoranschlaege, Reparaturauftraege } from './app';

export type EnrichedFahrraeder = Fahrraeder & {
  besitzerName: string;
};

export type EnrichedReparaturauftraege = Reparaturauftraege & {
  kundeName: string;
  fahrradName: string;
};

export type EnrichedKostenvoranschlaege = Kostenvoranschlaege & {
  reparaturauftragName: string;
  ersatzteileName: string;
};
