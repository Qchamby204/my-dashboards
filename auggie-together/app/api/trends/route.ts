import { getDb } from '@/db';
import { events } from '@/db/schema';
import { and, eq, gte, lt, or, isNull } from 'drizzle-orm';
import { dayBounds, dayKey, shiftDay, type CareEvent } from '@/lib/care';
import { buildTrendDays, completedTrendEnd } from '@/lib/trends';
import { identity, json, failure, ApiError } from '@/lib/server';

export const dynamic = 'force-dynamic';
export async function GET(req: Request) {
  try {
    await identity();
    const selected = new URL(req.url).searchParams.get('day') || dayKey();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(selected) || !Number.isFinite(Date.parse(selected)) ||
        new Date(selected+'T12:00:00Z').toISOString().slice(0,10) !== selected) throw new ApiError('Choose a valid date.');
    const endDay = completedTrendEnd(selected);
    const [start] = dayBounds(shiftDay(endDay, -65));
    const [, end] = dayBounds(endDay);
    const items = await getDb().select().from(events).where(and(
      eq(events.deleted, 0),
      or(and(gte(events.startedAt, start), lt(events.startedAt, end)),
        and(eq(events.kind, 'sleep'), lt(events.startedAt, end), or(gte(events.endedAt, start), isNull(events.endedAt))))
    ));
    return json({ days: buildTrendDays(items as CareEvent[], endDay), endDay });
  } catch (error) {
    return failure(error);
  }
}
