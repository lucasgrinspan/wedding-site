import { GuestResponse, RsvpSubmissionPayload, StoredRsvpRecord } from "./types";

const KV_SUBMISSION_PREFIX = "rsvp:sub:";
const KV_PARTY_LATEST_PREFIX = "rsvp:party:";
const KV_PENDING_NOTIFY_PREFIX = "rsvp:pending_notify:";
const KV_LOOKUP_MISS_PREFIX = "rsvp:miss:";

let d1SchemaInitialized = false;

async function ensureD1Schema(db: D1Database): Promise<void> {
  if (d1SchemaInitialized) return;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS rsvp_submissions (
      id TEXT PRIMARY KEY,
      party_key TEXT NOT NULL,
      submitted_by TEXT,
      party_json TEXT NOT NULL,
      accepting_count INTEGER NOT NULL DEFAULT 0,
      declining_count INTEGER NOT NULL DEFAULT 0,
      dietary TEXT,
      email TEXT,
      email_valid INTEGER NOT NULL DEFAULT 0,
      lang TEXT NOT NULL DEFAULT 'en',
      extras_json TEXT,
      is_test INTEGER NOT NULL DEFAULT 0,
      notification_sent INTEGER NOT NULL DEFAULT 0,
      notification_error TEXT,
      notification_attempts INTEGER NOT NULL DEFAULT 0,
      confirmation_sent INTEGER,
      confirmation_error TEXT,
      user_agent TEXT,
      created_at TEXT NOT NULL
    )`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_rsvp_submissions_party_key ON rsvp_submissions(party_key, created_at DESC)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_rsvp_submissions_pending_notify ON rsvp_submissions(notification_sent, is_test, notification_attempts)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS party_rsvp_latest (
      party_key TEXT PRIMARY KEY,
      latest_submission_id TEXT NOT NULL,
      revision_count INTEGER NOT NULL DEFAULT 1,
      submitted_by TEXT,
      party_json TEXT NOT NULL,
      accepting_count INTEGER NOT NULL DEFAULT 0,
      declining_count INTEGER NOT NULL DEFAULT 0,
      dietary TEXT,
      email TEXT,
      lang TEXT NOT NULL DEFAULT 'en',
      extras_json TEXT,
      is_test INTEGER NOT NULL DEFAULT 0,
      first_submitted_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS lookup_misses (
      id TEXT PRIMARY KEY,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`),
  ]);
  d1SchemaInitialized = true;
}

export function computePartyKey(party: GuestResponse[]): string {
  return party
    .map((g) =>
      g.name
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "")
    )
    .filter(Boolean)
    .sort()
    .join("|");
}

export interface PersistOutcome {
  persisted: boolean;
  d1Saved: boolean;
  kvSaved: boolean;
  record: StoredRsvpRecord;
}

/**
 * Write-ahead persistence for RSVP submissions across Cloudflare D1 and/or KV.
 * Every submission is written to an append-only key/row AND updates the party's latest state.
 */
export async function persistRsvpSubmission(
  env: Env,
  submission: RsvpSubmissionPayload,
  options: { isTest: boolean; userAgent?: string }
): Promise<PersistOutcome> {
  const now = submission.submittedAt || new Date().toISOString();
  const id = submission.id || crypto.randomUUID();
  const partyKey = submission.partyKey || computePartyKey(submission.party) || id;
  const acceptingCount = submission.party.filter((g) => g.attending).length;
  const decliningCount = submission.party.length - acceptingCount;
  const partyJson = JSON.stringify(submission.party);
  const extrasJson =
    submission.extras && Object.keys(submission.extras).length > 0
      ? JSON.stringify(submission.extras)
      : null;

  let revisionCount = 1;
  let d1Saved = false;
  let kvSaved = false;

  const record: StoredRsvpRecord = {
    id,
    partyKey,
    revisionCount: 1,
    submission: {
      ...submission,
      id,
      partyKey,
      submittedAt: now,
    },
    isTest: options.isTest,
    notificationSent: false,
    notificationAttempts: 0,
    userAgent: options.userAgent,
    createdAt: now,
    updatedAt: now,
  };

  // 1. Primary relational store (D1) if configured
  if (env.RSVP_DB) {
    try {
      await ensureD1Schema(env.RSVP_DB);
      await env.RSVP_DB.batch([
        env.RSVP_DB.prepare(
          `INSERT INTO rsvp_submissions (
            id, party_key, submitted_by, party_json, accepting_count, declining_count,
            dietary, email, email_valid, lang, extras_json, is_test,
            notification_sent, notification_attempts, user_agent, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?)`
        ).bind(
          id,
          partyKey,
          submission.submittedBy ?? null,
          partyJson,
          acceptingCount,
          decliningCount,
          submission.dietary ?? null,
          submission.email ?? null,
          submission.emailValid ? 1 : 0,
          submission.lang ?? "en",
          extrasJson,
          options.isTest ? 1 : 0,
          options.userAgent ?? null,
          now
        ),
        env.RSVP_DB.prepare(
          `INSERT INTO party_rsvp_latest (
            party_key, latest_submission_id, revision_count, submitted_by, party_json,
            accepting_count, declining_count, dietary, email, lang, extras_json,
            is_test, first_submitted_at, updated_at
          ) VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(party_key) DO UPDATE SET
            latest_submission_id = excluded.latest_submission_id,
            revision_count = party_rsvp_latest.revision_count + 1,
            submitted_by = excluded.submitted_by,
            party_json = excluded.party_json,
            accepting_count = excluded.accepting_count,
            declining_count = excluded.declining_count,
            dietary = excluded.dietary,
            email = excluded.email,
            lang = excluded.lang,
            extras_json = excluded.extras_json,
            is_test = excluded.is_test,
            updated_at = excluded.updated_at`
        ).bind(
          partyKey,
          id,
          submission.submittedBy ?? null,
          partyJson,
          acceptingCount,
          decliningCount,
          submission.dietary ?? null,
          submission.email ?? null,
          submission.lang ?? "en",
          extrasJson,
          options.isTest ? 1 : 0,
          now,
          now
        ),
      ]);
      d1Saved = true;
    } catch (err) {
      console.error(
        JSON.stringify({
          event: "d1_persist_error",
          submissionId: id,
          error: err instanceof Error ? err.message : String(err),
        })
      );
    }
  }

  // 2. Redundant KV store (RSVP_KV) if configured
  if (env.RSVP_KV) {
    try {
      const existingPartyRaw = await env.RSVP_KV.get(`${KV_PARTY_LATEST_PREFIX}${partyKey}`);
      if (existingPartyRaw) {
        try {
          const prev = JSON.parse(existingPartyRaw) as Partial<StoredRsvpRecord>;
          if (typeof prev.revisionCount === "number") {
            revisionCount = prev.revisionCount + 1;
          }
        } catch {
          // Ignore malformed prior state
        }
      }
      record.revisionCount = revisionCount;
      const serialized = JSON.stringify(record);
      const sortableTs = now.replace(/[^0-9T:.Z-]/g, "");

      await Promise.all([
        // Immutable append-only submission log
        env.RSVP_KV.put(`${KV_SUBMISSION_PREFIX}${sortableTs}:${id}`, serialized),
        // Latest state per party
        env.RSVP_KV.put(`${KV_PARTY_LATEST_PREFIX}${partyKey}`, serialized),
        // Outbox marker for non-test submissions until host notification is confirmed sent
        ...(options.isTest
          ? []
          : [env.RSVP_KV.put(`${KV_PENDING_NOTIFY_PREFIX}${id}`, serialized)]),
      ]);
      kvSaved = true;
    } catch (err) {
      console.error(
        JSON.stringify({
          event: "kv_persist_error",
          submissionId: id,
          error: err instanceof Error ? err.message : String(err),
        })
      );
    }
  }

  return {
    persisted: d1Saved || kvSaved,
    d1Saved,
    kvSaved,
    record,
  };
}

/**
 * Updates email delivery status after Resend calls complete, clearing the pending outbox flag if notified.
 */
export async function updateDeliveryStatus(
  env: Env,
  record: StoredRsvpRecord,
  status: {
    notificationSent: boolean;
    notificationError?: string;
    notificationAttempts?: number;
    confirmationSent?: boolean;
    confirmationError?: string;
  }
): Promise<void> {
  const now = new Date().toISOString();
  const attempts = status.notificationAttempts ?? record.notificationAttempts + 1;
  const updated: StoredRsvpRecord = {
    ...record,
    notificationSent: status.notificationSent,
    notificationError: status.notificationError,
    notificationAttempts: attempts,
    ...(status.confirmationSent !== undefined
      ? { confirmationSent: status.confirmationSent }
      : {}),
    ...(status.confirmationError !== undefined
      ? { confirmationError: status.confirmationError }
      : {}),
    updatedAt: now,
  };

  if (env.RSVP_DB) {
    try {
      await ensureD1Schema(env.RSVP_DB);
      await env.RSVP_DB.prepare(
        `UPDATE rsvp_submissions
         SET notification_sent = ?,
             notification_error = ?,
             notification_attempts = ?,
             confirmation_sent = COALESCE(?, confirmation_sent),
             confirmation_error = COALESCE(?, confirmation_error)
         WHERE id = ?`
      )
        .bind(
          status.notificationSent ? 1 : 0,
          status.notificationError ?? null,
          attempts,
          status.confirmationSent === undefined ? null : status.confirmationSent ? 1 : 0,
          status.confirmationError ?? null,
          record.id
        )
        .run();
    } catch (err) {
      console.error(
        JSON.stringify({
          event: "d1_delivery_status_update_error",
          submissionId: record.id,
          error: err instanceof Error ? err.message : String(err),
        })
      );
    }
  }

  if (env.RSVP_KV) {
    try {
      const sortableTs = record.createdAt.replace(/[^0-9T:.Z-]/g, "");
      const serialized = JSON.stringify(updated);
      const ops: Array<Promise<unknown>> = [
        env.RSVP_KV.put(`${KV_SUBMISSION_PREFIX}${sortableTs}:${record.id}`, serialized),
        env.RSVP_KV.put(`${KV_PARTY_LATEST_PREFIX}${record.partyKey}`, serialized),
      ];
      if (status.notificationSent || record.isTest || attempts >= 12) {
        ops.push(env.RSVP_KV.delete(`${KV_PENDING_NOTIFY_PREFIX}${record.id}`));
      } else {
        ops.push(env.RSVP_KV.put(`${KV_PENDING_NOTIFY_PREFIX}${record.id}`, serialized));
      }
      await Promise.all(ops);
    } catch (err) {
      console.error(
        JSON.stringify({
          event: "kv_delivery_status_update_error",
          submissionId: record.id,
          error: err instanceof Error ? err.message : String(err),
        })
      );
    }
  }
}

/**
 * Fetches pending submissions whose host notification email failed so the Cron Trigger can retry them.
 */
export async function listPendingHostNotifications(
  env: Env,
  limit = 15
): Promise<StoredRsvpRecord[]> {
  if (env.RSVP_KV) {
    try {
      const list = await env.RSVP_KV.list({ prefix: KV_PENDING_NOTIFY_PREFIX, limit });
      const records: StoredRsvpRecord[] = [];
      for (const key of list.keys) {
        const raw = await env.RSVP_KV.get(key.name);
        if (!raw) continue;
        try {
          const parsed = JSON.parse(raw) as StoredRsvpRecord;
          if (!parsed.notificationSent && !parsed.isTest && parsed.notificationAttempts < 12) {
            records.push(parsed);
          }
        } catch {
          // Ignore malformed entry
        }
      }
      return records;
    } catch (err) {
      console.error(
        JSON.stringify({
          event: "kv_list_pending_error",
          error: err instanceof Error ? err.message : String(err),
        })
      );
    }
  }

  if (env.RSVP_DB) {
    try {
      await ensureD1Schema(env.RSVP_DB);
      const { results } = await env.RSVP_DB.prepare(
        `SELECT id, party_key, submitted_by, party_json, dietary, email, email_valid,
                lang, extras_json, is_test, notification_sent, notification_error,
                notification_attempts, user_agent, created_at
         FROM rsvp_submissions
         WHERE notification_sent = 0 AND is_test = 0 AND notification_attempts < 12
         ORDER BY created_at ASC
         LIMIT ?`
      )
        .bind(limit)
        .all<Record<string, unknown>>();

      return (results || []).map((row) => ({
        id: String(row.id),
        partyKey: String(row.party_key),
        revisionCount: 1,
        submission: {
          id: String(row.id),
          partyKey: String(row.party_key),
          party: JSON.parse(String(row.party_json || "[]")) as GuestResponse[],
          submittedBy: row.submitted_by ? String(row.submitted_by) : undefined,
          dietary: row.dietary ? String(row.dietary) : undefined,
          email: row.email ? String(row.email) : undefined,
          emailValid: Boolean(row.email_valid),
          lang: row.lang === "es" ? "es" : "en",
          extras: row.extras_json
            ? (JSON.parse(String(row.extras_json)) as Record<string, string>)
            : undefined,
          submittedAt: String(row.created_at),
        },
        isTest: Boolean(row.is_test),
        notificationSent: Boolean(row.notification_sent),
        notificationError: row.notification_error ? String(row.notification_error) : undefined,
        notificationAttempts: Number(row.notification_attempts || 0),
        userAgent: row.user_agent ? String(row.user_agent) : undefined,
        createdAt: String(row.created_at),
        updatedAt: String(row.created_at),
      }));
    } catch (err) {
      console.error(
        JSON.stringify({
          event: "d1_list_pending_error",
          error: err instanceof Error ? err.message : String(err),
        })
      );
    }
  }

  return [];
}

/**
 * Records a 404 lookup miss asynchronously so hosts can inspect if any guest got stuck on lookup.
 */
export async function recordLookupMiss(
  env: Env,
  first: string,
  last: string
): Promise<void> {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  if (env.RSVP_DB) {
    try {
      await ensureD1Schema(env.RSVP_DB);
      await env.RSVP_DB.prepare(
        `INSERT INTO lookup_misses (id, first_name, last_name, created_at) VALUES (?, ?, ?, ?)`
      )
        .bind(id, first.slice(0, 120), last.slice(0, 120), now)
        .run();
    } catch {
      // Non-critical diagnostic log
    }
  }

  if (env.RSVP_KV) {
    try {
      const sortableTs = now.replace(/[^0-9T:.Z-]/g, "");
      await env.RSVP_KV.put(
        `${KV_LOOKUP_MISS_PREFIX}${sortableTs}:${id}`,
        JSON.stringify({ id, first: first.slice(0, 120), last: last.slice(0, 120), createdAt: now }),
        { expirationTtl: 60 * 60 * 24 * 120 } // Keep lookup miss diagnostics for 120 days
      );
    } catch {
      // Non-critical diagnostic log
    }
  }
}

/**
 * Exports all latest party RSVPs and full submission history from KV or D1 for `/admin/rsvps`.
 */
export async function exportAllRsvps(env: Env): Promise<{
  latestByParty: StoredRsvpRecord[];
  allSubmissions: StoredRsvpRecord[];
}> {
  const latestByParty: StoredRsvpRecord[] = [];
  const allSubmissions: StoredRsvpRecord[] = [];

  if (env.RSVP_KV) {
    let cursor: string | undefined;
    do {
      const page = await env.RSVP_KV.list({ prefix: KV_PARTY_LATEST_PREFIX, cursor });
      for (const k of page.keys) {
        const raw = await env.RSVP_KV.get(k.name);
        if (raw) {
          try {
            latestByParty.push(JSON.parse(raw) as StoredRsvpRecord);
          } catch {
            // Skip malformed
          }
        }
      }
      cursor = page.list_complete ? undefined : page.cursor;
    } while (cursor);

    let subCursor: string | undefined;
    do {
      const page = await env.RSVP_KV.list({ prefix: KV_SUBMISSION_PREFIX, cursor: subCursor });
      for (const k of page.keys) {
        const raw = await env.RSVP_KV.get(k.name);
        if (raw) {
          try {
            allSubmissions.push(JSON.parse(raw) as StoredRsvpRecord);
          } catch {
            // Skip malformed
          }
        }
      }
      subCursor = page.list_complete ? undefined : page.cursor;
    } while (subCursor);

    return { latestByParty, allSubmissions };
  }

  if (env.RSVP_DB) {
    await ensureD1Schema(env.RSVP_DB);
    const { results } = await env.RSVP_DB.prepare(
      `SELECT id, party_key, submitted_by, party_json, dietary, email, email_valid,
              lang, extras_json, is_test, notification_sent, notification_error,
              notification_attempts, confirmation_sent, confirmation_error, created_at
       FROM rsvp_submissions
       ORDER BY created_at DESC`
    ).all<Record<string, unknown>>();

    const seenParties = new Set<string>();
    for (const row of results || []) {
      const rec: StoredRsvpRecord = {
        id: String(row.id),
        partyKey: String(row.party_key),
        revisionCount: 1,
        submission: {
          id: String(row.id),
          partyKey: String(row.party_key),
          party: JSON.parse(String(row.party_json || "[]")) as GuestResponse[],
          submittedBy: row.submitted_by ? String(row.submitted_by) : undefined,
          dietary: row.dietary ? String(row.dietary) : undefined,
          email: row.email ? String(row.email) : undefined,
          emailValid: Boolean(row.email_valid),
          lang: row.lang === "es" ? "es" : "en",
          extras: row.extras_json
            ? (JSON.parse(String(row.extras_json)) as Record<string, string>)
            : undefined,
          submittedAt: String(row.created_at),
        },
        isTest: Boolean(row.is_test),
        notificationSent: Boolean(row.notification_sent),
        notificationError: row.notification_error ? String(row.notification_error) : undefined,
        notificationAttempts: Number(row.notification_attempts || 0),
        confirmationSent:
          row.confirmation_sent === null || row.confirmation_sent === undefined
            ? undefined
            : Boolean(row.confirmation_sent),
        confirmationError: row.confirmation_error ? String(row.confirmation_error) : undefined,
        createdAt: String(row.created_at),
        updatedAt: String(row.created_at),
      };
      allSubmissions.push(rec);
      if (!seenParties.has(rec.partyKey)) {
        seenParties.add(rec.partyKey);
        latestByParty.push(rec);
      }
    }
  }

  return { latestByParty, allSubmissions };
}

function escapeCsvCell(val: string): string {
  const safe = /^[=+\-@\t\r]/.test(val) ? `'${val}` : val;
  if (/[",\r\n]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

export function formatRsvpsAsCsv(records: StoredRsvpRecord[]): string {
  const headers = [
    "Guest Name",
    "Attending",
    "Status",
    "Party Key",
    "Submitted By",
    "Guest Email",
    "Dietary / Song Notes",
    "Extras",
    "Locale",
    "Revision Count",
    "Host Notified",
    "Is Test",
    "Updated At",
    "Submission ID",
  ];
  const rows = [headers.join(",")];

  for (const rec of records) {
    const extrasStr = rec.submission.extras
      ? Object.entries(rec.submission.extras)
          .map(([k, v]) => `${k}: ${v}`)
          .join("; ")
      : "";
    for (const guest of rec.submission.party) {
      rows.push(
        [
          escapeCsvCell(guest.name),
          guest.attending ? "Yes" : "No",
          escapeCsvCell(guest.status),
          escapeCsvCell(rec.partyKey),
          escapeCsvCell(rec.submission.submittedBy ?? ""),
          escapeCsvCell(rec.submission.email ?? ""),
          escapeCsvCell(rec.submission.dietary ?? ""),
          escapeCsvCell(extrasStr),
          escapeCsvCell(rec.submission.lang ?? "en"),
          String(rec.revisionCount ?? 1),
          rec.notificationSent ? "Yes" : "No",
          rec.isTest ? "Yes" : "No",
          escapeCsvCell(rec.updatedAt),
          escapeCsvCell(rec.id),
        ].join(",")
      );
    }
  }

  return rows.join("\r\n") + "\r\n";
}
