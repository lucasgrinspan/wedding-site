export type AttendanceStatus = "Joyfully Accept" | "Regretfully Decline";

export interface GuestResponse {
  name: string;
  status: AttendanceStatus;
  attending: boolean;
}

export interface RsvpSubmissionPayload {
  party: GuestResponse[];
  submittedBy?: string;
  dietary?: string;
  email?: string;
  lang?: "en" | "es";
  submittedAt?: string;
}

export interface SubmitResult {
  success: boolean;
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
  subject: string;
  html: string;
  text: string;
}

declare global {
  interface Env {
    NOTIFICATION_EMAIL?: string;
  }
  namespace Cloudflare {
    interface Env {
      NOTIFICATION_EMAIL?: string;
    }
  }
}
