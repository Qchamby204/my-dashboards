export const tummyObservations = ['session', 'rested', 'turned', 'lifted', 'held'] as const;
export type TummyObservation = typeof tummyObservations[number];

// "session" is an untimed check-in with no head movement selected.
// A null value belongs to the existing timer and measured-session workflow.
export const headLabels = {
  rested: 'Rested his head',
  turned: 'Turned his head',
  lifted: 'Lifted his head briefly',
  held: 'Held his head up',
} satisfies Record<Exclude<TummyObservation, 'session'>, string>;

export const headMovements = tummyObservations.filter(value => value !== 'session');

export function countHeadMovements(sessions: {tummyObservation?: TummyObservation | null}[]) {
  const counts = { rested: 0, turned: 0, lifted: 0, held: 0 };
  for (const {tummyObservation} of sessions) {
    if (tummyObservation && tummyObservation !== 'session') counts[tummyObservation]++;
  }
  return counts;
}
