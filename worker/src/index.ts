import rsvpLookupData from "../data/rsvp_lookup.json";
import {
  buildConfirmationEmailHtml,
  buildConfirmationEmailText,
  getConfirmationEmailSubject,
} from "./email";
import {
  GuestResponse,
  RsvpSubmissionPayload,
  SubmitResult,
} from "./types";

const lookupRecord = rsvpLookupData as Record<string, string[]>;

/**
 * Normalizes a name string by removing diacritics/accents, lowercasing,
 * and stripping non-alphanumeric characters to match keys in rsvp_lookup.json.
 */
export function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export function getLookupKey(first: string, last: string): string {
  return normalizeName(`${first}${last}`);
}

/**
 * Generates CORS headers allowing requests from lucasandlianne.com and localhost.
 */
export function getCorsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("Origin");
  // Reflect origin if provided (standard pattern for full CORS with credentials/fetch), or fallback to "*"
  const allowOrigin = origin ? origin : "*";

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
    "Access-Control-Max-Age": "86400",
  };
}

/**
 * Handles guest party lookup queries:
 * GET /?first=...&last=... or GET /lookup?first=...&last=...
 */
export function handleLookup(url: URL, corsHeaders: Record<string, string>): Response {
  const first = url.searchParams.get("first")?.trim();
  const last = url.searchParams.get("last")?.trim();

  if (!first || !last) {
    return new Response(JSON.stringify({ error: "Missing name query parameters" }), {
      status: 400,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  }

  const key = getLookupKey(first, last);
  const party = lookupRecord[key];

  if (!party) {
    return new Response(JSON.stringify({ error: "Guest not found" }), {
      status: 404,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  }

  return new Response(JSON.stringify(party), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders,
    },
  });
}

function parseAttendingValue(val: unknown): boolean {
  if (typeof val === "boolean") return val;
  if (!val) return true; // Default to accepting if attending field omitted
  const str = String(val).toLowerCase().trim();
  if (
    str.includes("decline") ||
    str.includes("regret") ||
    str === "false" ||
    str === "0" ||
    str === "no"
  ) {
    return false;
  }
  return true;
}

/**
 * Extracts and normalizes party members, attendance statuses, dietary notes,
 * and guest email from either JSON or URL-encoded/FormData submissions.
 */
export function extractSubmissionPayload(raw: Record<string, unknown>): RsvpSubmissionPayload {
  const dietary = (
    raw.dietary ||
    raw.message ||
    raw.notes ||
    raw.dietary_restrictions ||
    raw.dietaryRestrictions ||
    ""
  ) as string;

  const email = (
    raw.email ||
    raw.guest_email ||
    raw.guestEmail ||
    ""
  ) as string;

  const partyList: GuestResponse[] = [];

  // Case 1: raw.party is an array of objects or strings
  if (Array.isArray(raw.party)) {
    for (const item of raw.party) {
      if (typeof item === "string") {
        const trimmed = item.trim();
        if (trimmed) {
          partyList.push({
            name: trimmed,
            status: "Joyfully Accept",
            attending: true,
          });
        }
      } else if (item && typeof item === "object") {
        const obj = item as Record<string, unknown>;
        const name = String(obj.name || obj.guest || "").trim();
        if (name) {
          const val = obj.status !== undefined ? obj.status : obj.attending;
          const attending = parseAttendingValue(val);
          partyList.push({
            name,
            status: attending ? "Joyfully Accept" : "Regretfully Decline",
            attending,
          });
        }
      }
    }
  }

  // Case 2: raw.responses is a map: { "Guest Name": "Joyfully Accept" }
  if (raw.responses && typeof raw.responses === "object" && !Array.isArray(raw.responses)) {
    for (const [name, val] of Object.entries(raw.responses as Record<string, unknown>)) {
      const trimmedName = name.trim();
      if (trimmedName && !partyList.some(p => p.name === trimmedName)) {
        const attending = parseAttendingValue(val);
        partyList.push({
          name: trimmedName,
          status: attending ? "Joyfully Accept" : "Regretfully Decline",
          attending,
        });
      }
    }
  }

  // Case 3: raw.party_members is provided (comma-separated string e.g. "Doris Anaya, Oscar Anaya")
  if (typeof raw.party_members === "string" && raw.party_members.trim().length > 0) {
    const names = raw.party_members.split(",").map(n => n.trim()).filter(Boolean);
    for (const name of names) {
      if (!partyList.some(p => p.name === name)) {
        const sanitized = name.replace(/[^a-zA-Z0-9]/g, "_");
        const val = raw[`attending_${sanitized}`] !== undefined
          ? raw[`attending_${sanitized}`]
          : raw[`attending_${name}`];
        const attending = parseAttendingValue(val);
        partyList.push({
          name,
          status: attending ? "Joyfully Accept" : "Regretfully Decline",
          attending,
        });
      }
    }
  }

  // Case 4: scan attending_* keys in raw
  for (const [k, val] of Object.entries(raw)) {
    if (k.startsWith("attending_")) {
      const rawGuest = k.slice("attending_".length);
      const guestName = rawGuest.replace(/_/g, " ");
      if (!partyList.some(p => p.name.replace(/[^a-zA-Z0-9]/g, "_") === rawGuest || p.name === guestName)) {
        const attending = parseAttendingValue(val);
        partyList.push({
          name: guestName,
          status: attending ? "Joyfully Accept" : "Regretfully Decline",
          attending,
        });
      }
    }
  }

  const rawLang = typeof raw.lang === "string" ? raw.lang.trim().toLowerCase() : "";
  const lang: "en" | "es" = rawLang === "es" ? "es" : "en";

  return {
    party: partyList,
    dietary: typeof dietary === "string" && dietary.trim().length > 0 ? dietary.trim() : undefined,
    email: typeof email === "string" && email.trim().length > 0 ? email.trim() : undefined,
    lang,
    submittedAt: new Date().toISOString(),
  };
}

async function parseRsvpBody(request: Request): Promise<RsvpSubmissionPayload> {
  const contentType = request.headers.get("content-type") || "";
  let raw: Record<string, unknown> = {};

  if (contentType.includes("application/json")) {
    try {
      raw = (await request.json()) as Record<string, unknown>;
    } catch {
      throw new Error("Invalid JSON body");
    }
  } else if (
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data")
  ) {
    const formData = await request.formData();
    for (const [key, val] of formData.entries()) {
      if (typeof val === "string") {
        raw[key] = val;
      }
    }
  } else {
    try {
      raw = (await request.json()) as Record<string, unknown>;
    } catch {
      throw new Error("Unsupported Content-Type. Please send JSON or Form Data.");
    }
  }

  return extractSubmissionPayload(raw);
}

/**
 * Sends a confirmation email to the guest via Resend API
 */
async function sendConfirmationEmail(
  submission: RsvpSubmissionPayload,
  apiKey: string
): Promise<{ success: boolean; error?: string }> {
  if (!submission.email) {
    return { success: false, error: "No recipient email provided" };
  }

  const html = buildConfirmationEmailHtml(submission);
  const text = buildConfirmationEmailText(submission);
  const subject = getConfirmationEmailSubject(submission);

  const payload = {
    from: "Lucas & Lianne <rsvp@send.lucasandlianne.com>",
    reply_to: "Lucas & Lianne <rsvp@lucasandlianne.com>",
    to: [submission.email],
    subject,
    html,
    text,
  };

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(JSON.stringify({
        event: "resend_api_error",
        status: response.status,
        body: errText,
        to: submission.email,
      }));
      return { success: false, error: `Resend error (${response.status}): ${errText}` };
    }

    const data = await response.json();
    console.log(JSON.stringify({
      event: "resend_email_sent",
      to: submission.email,
      resendId: (data as Record<string, unknown>)?.id,
    }));
    return { success: true };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(JSON.stringify({
      event: "resend_fetch_exception",
      error: errorMsg,
      to: submission.email,
    }));
    return { success: false, error: errorMsg };
  }
}

/**
 * Handles RSVP submission:
 * POST /submit (or POST /rsvp)
 */
export async function handleRsvpSubmit(
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  let submission: RsvpSubmissionPayload;
  try {
    submission = await parseRsvpBody(request);
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Invalid RSVP submission" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }

  if (submission.party.length === 0) {
    return new Response(
      JSON.stringify({ error: "Missing RSVP party responses" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }

  // Structured logging for Cloudflare Workers Observability
  console.log(JSON.stringify({
    event: "rsvp_submission_received",
    partyCount: submission.party.length,
    party: submission.party,
    hasDietary: Boolean(submission.dietary),
    hasEmail: Boolean(submission.email),
    submittedAt: submission.submittedAt,
  }));

  let emailSent: boolean | undefined;
  let emailError: string | undefined;

  if (submission.email) {
    const apiKey = env.RESEND_API_KEY;
    if (apiKey) {
      const result = await sendConfirmationEmail(submission, apiKey);
      emailSent = result.success;
      if (!result.success) {
        emailError = result.error;
      }
    } else {
      console.warn(JSON.stringify({
        event: "resend_api_key_missing",
        message: "RESEND_API_KEY secret is not configured; email skipped",
        to: submission.email,
      }));
      emailSent = false;
      emailError = "RESEND_API_KEY not configured in worker environment";
    }
  }

  const responsePayload: SubmitResult = {
    success: true,
    message: "RSVP received successfully",
    party: submission.party,
    ...(submission.email ? { emailSent, emailError } : {}),
  };

  return new Response(JSON.stringify(responsePayload), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders,
    },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const corsHeaders = getCorsHeaders(request);

    // Preflight OPTIONS requests
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    const url = new URL(request.url);
    const pathname = url.pathname.replace(/\/+$/, "") || "/";

    try {
      if (request.method === "GET") {
        if (pathname === "/" || pathname === "/lookup" || pathname === "/api/lookup") {
          return handleLookup(url, corsHeaders);
        }
        if (pathname === "/health" || pathname === "/ping") {
          return new Response(JSON.stringify({ status: "ok" }), {
            status: 200,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          });
        }
      }

      if (request.method === "POST") {
        if (
          pathname === "/submit" ||
          pathname === "/api/submit" ||
          pathname === "/rsvp" ||
          pathname === "/"
        ) {
          return await handleRsvpSubmit(request, env, corsHeaders);
        }
      }

      return new Response(JSON.stringify({ error: "Not Found" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    } catch (err) {
      console.error(JSON.stringify({
        event: "unhandled_error",
        error: err instanceof Error ? err.stack || err.message : String(err),
      }));
      return new Response(JSON.stringify({ error: "Internal Server Error" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
  },
} satisfies ExportedHandler<Env>;
