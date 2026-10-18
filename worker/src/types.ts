export type AttendanceStatus = "Joyfully Accept" | "Regretfully Decline";

export interface GuestResponse {
  name: string;
  status: AttendanceStatus;
  attending: boolean;
}

export interface RsvpSubmissionPayload {
  party: GuestResponse[];
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
}

export interface ResendEmailPayload {
  from: string;
  to: string[];
  subject: string;
  html: string;
  text: string;
}
