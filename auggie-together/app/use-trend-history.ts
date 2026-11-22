'use client';

import {useEffect, useState} from 'react';
import {completedTrendEnd, type TrendDay} from '@/lib/trends';

const emptyDays: TrendDay[] = [];

export function useTrendHistory(day: string, today: string, revision: number) {
  const completedEnd = completedTrendEnd(day, today);
  const [history, setHistory] = useState<{day: string; end: string; rows: TrendDay[]} | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let fetching = false;
    async function refresh() {
      if (fetching) return;
      fetching = true;
      try {
        const response = await fetch('/api/trends?day=' + day, {cache: 'no-store', signal: controller.signal});
        if (!response.ok) throw new Error('History unavailable');
        const data = await response.json() as {endDay: string; days: TrendDay[]};
        if (!controller.signal.aborted) {
          setHistory({day, end: data.endDay, rows: data.days});
          setFailed(false);
        }
      } catch {
        if (!controller.signal.aborted) setFailed(true);
      } finally {
        fetching = false;
      }
    }
    void refresh();
    const timer = setInterval(() => { if (document.visibilityState === 'visible') void refresh(); }, 30000);
    return () => { controller.abort(); clearInterval(timer); };
  }, [day, completedEnd, revision, attempt]);

  const recent = history?.day === day && history.end === completedEnd ? history.rows : emptyDays;
  return {recent, completedEnd, failed, retry: () => setAttempt(value => value + 1)};
}
