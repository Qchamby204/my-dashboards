import { dayKey, type CareEvent } from './care.ts';

export const tummyComfortOptions = ['comfortable', 'break'] as const;
export type TummyComfort = typeof tummyComfortOptions[number];

const cues = [30, 45, 60, 90, 120, 150, 180];
export const comfortableSessionsNeeded = 3;
export const practiceDaysNeeded = 2;

type RatedSession = Pick<CareEvent, 'startedAt' | 'endedAt' | 'tummyCueSeconds' | 'tummyComfort'>;

// Session cues are a pacing aid. Only explicit caregiver observations count.
export function tummyProgress(sessions: RatedSession[]) {
  let level = 0;
  let comfortable = 0;
  const days = new Set<string>();
  const rated = sessions.filter(session => session.endedAt && session.tummyCueSeconds && session.tummyComfort)
    .sort((a, b) => Date.parse(a.endedAt!) - Date.parse(b.endedAt!));

  for (const session of rated) {
    if (level === cues.length - 1) break;
    if (session.tummyComfort === 'break') {
      comfortable = 0;
      days.clear();
      continue;
    }
    if (session.tummyCueSeconds !== cues[level] ||
        Date.parse(session.endedAt!) - Date.parse(session.startedAt) < cues[level] * 1000) continue;
    comfortable++;
    days.add(dayKey(session.startedAt));
    if (comfortable >= comfortableSessionsNeeded && days.size >= practiceDaysNeeded) {
      level++;
      comfortable = 0;
      days.clear();
    }
  }

  return {
    cue: cues[level],
    shorterCue: cues[level - 1] ?? 15,
    nextCue: cues[level + 1] ?? null,
    comfortable: Math.min(comfortable, comfortableSessionsNeeded),
    days: days.size,
  };
}
