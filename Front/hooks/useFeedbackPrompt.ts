import { useCallback, useEffect, useState } from 'react';
import { prefGet, prefSet } from '@/services/appStorage';

// In-app satisfaction survey trigger.
//
// We record each DISTINCT calendar day the app is opened. Once the user reaches
// USAGE_DAYS_THRESHOLD distinct days, the feedback modal opens automatically
// (once). If the user taps "Later", we push the threshold forward by
// SNOOZE_DAYS distinct days so it reappears later; after being submitted (or
// snoozed too many times) it never shows again.

const DAYS_KEY = 'feedback_v1_days';        // JSON array of 'YYYY-MM-DD'
const DONE_KEY = 'feedback_v1_done';        // '1' once submitted / permanently dismissed
const THRESHOLD_KEY = 'feedback_v1_threshold'; // number of distinct days required

const USAGE_DAYS_THRESHOLD = 5;
const SNOOZE_DAYS = 3;
const MAX_THRESHOLD = 20; // safety cap so snoozing can't push it forever

function todayKey(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD (local-ish, day granularity)
}

async function readDays(): Promise<string[]> {
  const raw = await prefGet(DAYS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function useFeedbackPrompt() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const done = await prefGet(DONE_KEY);
      if (done === '1') return;

      // Record today as a distinct usage day.
      const days = await readDays();
      const today = todayKey();
      if (!days.includes(today)) {
        days.push(today);
        await prefSet(DAYS_KEY, JSON.stringify(days));
      }

      const thresholdRaw = await prefGet(THRESHOLD_KEY);
      const threshold = thresholdRaw ? parseInt(thresholdRaw, 10) : USAGE_DAYS_THRESHOLD;

      if (!cancelled && days.length >= threshold && threshold <= MAX_THRESHOLD) {
        setVisible(true);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, []);

  // User submitted feedback (or explicitly declined for good): never show again.
  const markDone = useCallback(async () => {
    setVisible(false);
    await prefSet(DONE_KEY, '1');
  }, []);

  // User tapped "Later": push the threshold forward so it reappears after a few
  // more usage days.
  const snooze = useCallback(async () => {
    setVisible(false);
    const days = await readDays();
    const next = Math.min(days.length + SNOOZE_DAYS, MAX_THRESHOLD + 1);
    await prefSet(THRESHOLD_KEY, String(next));
  }, []);

  return { visible, markDone, snooze };
}
