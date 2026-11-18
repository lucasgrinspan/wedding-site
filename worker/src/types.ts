export type AttendanceStatus = "Joyfully Accept" | "Regretfully Decline";

export interface GuestResponse {
  name: string;
  status: AttendanceStatus;
  attending: boolean;
}

export type LocalizedNote = string | { en?: string; es?: string };

export interface DelightConfigEntry {
  rsvpNote?: LocalizedNote;
  thanksNote?: LocalizedNote;
  emailNote?: LocalizedNote;
  effect?: string | string[];
  effects?: string[];
  onlyWhenAttending?: boolean;
}

export interface GuestDelightPayload {
  rsvpNote?: { en?: string; es?: string };
  thanksNote?: { en?: string; es?: string };
  emailNote?: { en?: string; es?: string };
  effects?: string[];
  onlyWhenAttending?: boolean;
}

export interface RsvpSubmissionPayload {
  id?: string;
  partyKey?: string;
  party: GuestResponse[];
  submittedBy?: string;
  dietary?: string;
  email?: string;
  emailValid?: boolean;
  lang?: "en" | "es";
  personalNote?: string;
  submittedAt?: string;
  extras?: Record<string, string>;
  isTest?: boolean;
}

export interface StoredRsvpRecord {
  id: string;
  partyKey: string;
  revisionCount: number;
  submission: RsvpSubmissionPayload;
  isTest: boolean;
  notificationSent: boolean;
  notificationError?: string;
  notificationAttempts: number;
  confirmationSent?: boolean;
  confirmationError?: string;
  userAgent?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SubmitResult {
  success: boolean;
  submissionId?: string;
  persisted?: boolean;
  message: string;
  party: GuestResponse[];
  emailSent?: boolean;
  emailError?: string;
  notificationSent?: boolean;
  notificationError?: string;
}

export interface ResendEmailPayload {
  from: string;
  to: string[];
  reply_to?: string | string[];
  subject: string;
  html: string;
  text: string;
}

declare global {
  interface Env {
    ADMIN_API_TOKEN?: string;
    RSVP_DB?: D1Database;
  }
  namespace Cloudflare {
    interface Env {
      ADMIN_API_TOKEN?: string;
      RSVP_DB?: D1Database;
    }
  }
}
