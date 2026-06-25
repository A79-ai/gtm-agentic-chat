// Free-trial "free taste": let a self-serve (free-trial-org) visitor send a
// capped number of operator-funded chat messages per day before the BYOK gate
// kicks in. The cap is enforced server-side in the chat route (app/api/chat),
// counted from the visitor's OWN persisted conversation history — never a
// client-asserted number. The Vercel AI Gateway spend cap is the hard cost
// backstop; this cap shapes the funnel and bounds typical operator spend.

export const DEFAULT_FREE_TASTE_DAILY_CAP = 10;

// Operator-funded messages a free-trial visitor may send per UTC day before the
// BYOK gate. 0 disables the free taste (back to BYOK-only). Override with
// FREE_TRIAL_DAILY_CHAT_CAP.
export function freeTasteDailyCap(): number {
  const raw = process.env.FREE_TRIAL_DAILY_CHAT_CAP;
  if (raw == null || raw === "") {
    return DEFAULT_FREE_TASTE_DAILY_CAP;
  }
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_FREE_TASTE_DAILY_CAP;
}

type ConversationRow = {
  extra_metadata?: unknown;
  updated_at?: unknown;
};

function parseMeta(s: unknown): Record<string, unknown> {
  if (typeof s !== "string" || !s) {
    return {};
  }
  try {
    return JSON.parse(s) as Record<string, unknown>;
  } catch {
    return {};
  }
}

// Count the visitor's *user* chat messages since UTC midnight, across every
// conversation touched today. Mirrors the backend's UTC-day boundary
// (get_user_daily_message_count). Deliberately conservative: a conversation that
// straddles midnight counts all of its user turns (over-count), and only the most
// recent page of conversations is inspected — both err toward capping sooner,
// which is the cost-safe direction. The Gateway spend cap remains the hard limit.
export function countTodaysUserMessages(rows: ConversationRow[], nowMs: number): number {
  const startOfDay = new Date(nowMs);
  startOfDay.setUTCHours(0, 0, 0, 0);
  const since = startOfDay.getTime();
  let count = 0;
  for (const row of rows) {
    const updated = typeof row.updated_at === "string" ? Date.parse(row.updated_at) : Number.NaN;
    if (!Number.isFinite(updated) || updated < since) {
      continue;
    }
    const meta = parseMeta(row.extra_metadata);
    const transcript = Array.isArray(meta.transcript)
      ? (meta.transcript as { role?: string }[])
      : [];
    for (const m of transcript) {
      if (m?.role === "user") {
        count++;
      }
    }
  }
  return count;
}
