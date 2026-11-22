import { headLabels } from './tummy-observations.ts';
import type { CareEvent } from './care.ts';

export const movementKinds = ['tummy', 'exercise'] as const;
export type MovementKind = typeof movementKinds[number];
export function isMovement(kind: string): kind is MovementKind {
  return kind === 'tummy' || kind === 'exercise';
}

export const tummyPositions = [
  { id: 'chest', label: 'Chest' },
  { id: 'lap', label: 'Lap' },
  { id: 'mat', label: 'Mat' },
] as const;

export const exercises = [
  { id: 'faces', label: 'Face-to-face play', hint: 'Smile, talk, or copy expressions.' },
  { id: 'track', label: 'Follow a face', hint: 'Move slowly from side to side. Pause when baby looks away.' },
  { id: 'hands', label: 'Hands together', hint: 'Invite hands toward the middle.' },
  { id: 'cross', label: 'Cross hand to knee', hint: 'Bring opposite hand and knee toward each other gently.' },
  { id: 'reach', label: 'Arm reaches', hint: 'Invite a gentle reach without pulling the arms.' },
  { id: 'hugs', label: 'Cross hugs', hint: 'Bring hands softly toward the chest.' },
  { id: 'bike', label: 'Leg bicycles', hint: 'Slowly pedal relaxed legs, one at a time.', group: 'gas' },
  { id: 'roll', label: 'Supported side-to-side rolls', hint: 'Support head and trunk as you gently shift to each side.' },
  { id: 'sit', label: 'Supported reclined sitting', hint: 'Keep head, neck and trunk fully supported. Small position changes.' },
  { id: 'massage', label: 'Clockwise tummy massage', hint: 'Light, slow circles on a relaxed tummy, between feeds.', group: 'gas' },
  { id: 'knees', label: 'Gentle knee bends', hint: 'Softly bend relaxed knees toward the tummy, then release.', group: 'gas' },
  { id: 'burp', label: 'Upright burping break', hint: 'Support head and neck, with a gentle back rub.', group: 'gas' },
] as const;

export function exerciseIds(value: string) {
  const ids = value.split(',');
  return exercises.filter(item => ids.includes(item.id)).map(item => item.id);
}

export function movementSeconds(entry: Pick<CareEvent, 'startedAt' | 'endedAt'>, now = Date.now()) {
  return Math.max(0, Math.round(((entry.endedAt ? Date.parse(entry.endedAt) : now) - Date.parse(entry.startedAt)) / 1000));
}

export function shortDuration(seconds: number) {
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return [min && `${min}m`, sec && `${sec}s`].filter(Boolean).join(' ') || '0s';
}

export function movementSummary(items: CareEvent[]) {
  const tummy = items.filter(item => item.kind === 'tummy' && item.endedAt);
  const exercise = items.filter(item => item.kind === 'exercise' && item.endedAt);
  return {
    tummy,
    exercise,
    tummySeconds: tummy.reduce((sum, item) => sum + movementSeconds(item), 0),
    exerciseSeconds: exercise.reduce((sum, item) => sum + movementSeconds(item), 0),
    checked: exerciseIds(exercise.map(item => item.subtype).join(',')),
  };
}

export function movementDetail(entry: CareEvent) {
  if (!entry.endedAt) return 'Timer running';
  const seconds = movementSeconds(entry);
  if (entry.kind === 'tummy') {
    return [
      entry.tummyObservation ? null : shortDuration(seconds),
      entry.tummyObservation && entry.tummyObservation !== 'session' ? headLabels[entry.tummyObservation] : null,
      tummyPositions.find(position => position.id === entry.subtype)?.label,
      entry.amount === null ? null : `${entry.amount} head ${entry.amount === 1 ? 'lift' : 'lifts'}`,
      entry.tummyComfort === 'comfortable' ? 'Comfortable' : entry.tummyComfort === 'break' ? 'Needed a break' : null,
      entry.notes,
    ].filter(Boolean).join(' · ') || 'Session logged';
  }
  const ids = exerciseIds(entry.subtype);
  const activities = exercises.filter(item => ids.includes(item.id)).map(item => item.label);
  return [seconds ? shortDuration(seconds) : null, ...activities].filter(Boolean).join(' · ');
}
