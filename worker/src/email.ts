import { GuestResponse, RsvpSubmissionPayload } from "./types";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

const EMAIL_COPY = {
  en: {
    subject: "RSVP Confirmation — Lucas & Lianne's Wedding",
    title: "RSVP Confirmation — Lucas &amp; Lianne",
    acceptStatus: "✓ Joyfully Accepts",
    declineStatus: "✕ Regretfully Declines",
    dietaryLabel: "Dietary Restrictions or Requests",
    headerTitle: "Kindly Reply",
    headerSubtitle: "RSVP Confirmation",
    thankYouIntro: "Thank you for your response! We have received your RSVP for our wedding celebration.",
    partyResponseLabel: "Your Party's Response",
    celebrationDetailsLabel: "Celebration Details",
    weddingHeading: "Lucas &amp; Lianne's Wedding",
    weddingHeadingPlain: "LUCAS & LIANNE'S WEDDING",
    dateText: "Saturday, February 20, 2027",
    timeText: "At Five O'Clock in the Evening",
    detailsUrl: "https://lucasandlianne.com/details.html",
    viewDetailsBtn: "View Wedding Details",
    signature: "Love, Lianne &amp; Lucas 🥭",
    signaturePlain: "With love,\nLianne & Lucas 🥭",
    changesPrefix: "If you need to make any changes to your RSVP, please reply directly to this email or contact us at",
    changesPlain: "If you need to make any changes to your RSVP, please reply directly to this email or reach us at rsvp@lucasandlianne.com.",
  },
  es: {
    subject: "Confirmación de Asistencia — Casamiento de Lucas & Lianne",
    title: "Confirmación de Asistencia — Lucas &amp; Lianne",
    acceptStatus: "✓ Asistirá con alegría",
    declineStatus: "✕ No podrá asistir",
    dietaryLabel: "Restricciones Alimentarias o Pedidos Especiales",
    headerTitle: "Confirmación",
    headerSubtitle: "Confirmación de Asistencia",
    thankYouIntro: "¡Muchas gracias por responder! Recibimos tu confirmación para nuestro casamiento.",
    partyResponseLabel: "Respuesta de tu Grupo",
    celebrationDetailsLabel: "Detalles de la Celebración",
    weddingHeading: "Casamiento de Lucas &amp; Lianne",
    weddingHeadingPlain: "CASAMIENTO DE LUCAS & LIANNE",
    dateText: "Sábado 20 de febrero de 2027",
    timeText: "A las cinco de la tarde",
    detailsUrl: "https://lucasandlianne.com/es/details.html",
    viewDetailsBtn: "Ver Detalles del Casamiento",
    signature: "Con amor, Lianne &amp; Lucas 🥭",
    signaturePlain: "Con amor,\nLianne & Lucas 🥭",
    changesPrefix: "Si necesitás hacer algún cambio en tu confirmación, por favor respondé directamente a este mail o escribinos a",
    changesPlain: "Si necesitás hacer algún cambio en tu confirmación, por favor respondé directamente a este mail o escribinos a rsvp@lucasandlianne.com.",
  },
} as const;

export function getConfirmationEmailSubject(submission: RsvpSubmissionPayload): string {
  const locale = submission.lang === "es" ? "es" : "en";
  return EMAIL_COPY[locale].subject;
}

export function buildConfirmationEmailHtml(submission: RsvpSubmissionPayload): string {
  const locale = submission.lang === "es" ? "es" : "en";
  const copy = EMAIL_COPY[locale];

  const partyRowsHtml = submission.party
    .map((guest: GuestResponse) => {
      const isAttending = guest.attending;
      const statusText = isAttending ? copy.acceptStatus : copy.declineStatus;
      const statusBg = isAttending ? "#2E4A3D" : "#ECEBE9";
      const statusColor = isAttending ? "#FFFFFF" : "#6E6259";
      const statusBorder = isAttending ? "#2E4A3D" : "#D4CEC5";

      return `
        <tr>
          <td style="padding: 14px 0; border-bottom: 1px dashed rgba(46, 74, 61, 0.15); font-family: 'Playfair Display', Georgia, serif; font-size: 17px; color: #2E4A3D; font-weight: 600;">
            ${escapeHtml(guest.name)}
          </td>
          <td align="right" style="padding: 14px 0; border-bottom: 1px dashed rgba(46, 74, 61, 0.15);">
            <span style="display: inline-block; padding: 6px 14px; background-color: ${statusBg}; color: ${statusColor}; border: 1px solid ${statusBorder}; border-radius: 2px; font-family: 'Lato', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 13px; font-weight: 700; letter-spacing: 0.5px;">
              ${statusText}
            </span>
          </td>
        </tr>
      `;
    })
    .join("");

  const dietaryHtml = submission.dietary && submission.dietary.trim().length > 0
    ? `
      <div style="margin-top: 28px; padding: 18px 20px; background-color: #F4F2EC; border-left: 3px solid #2E4A3D; border-radius: 2px;">
        <span style="display: block; font-family: 'Playfair Display', Georgia, serif; font-size: 11px; text-transform: uppercase; letter-spacing: 2px; color: #8B5A2B; margin-bottom: 6px; font-weight: 600;">${copy.dietaryLabel}</span>
        <p style="margin: 0; font-family: 'Lato', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #2C3531; font-style: italic;">
          "${escapeHtml(submission.dietary.trim())}"
        </p>
      </div>
    `
    : "";

  return `<!DOCTYPE html>
<html lang="${locale}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${copy.title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #ECEBE9; font-family: 'Lato', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #2C3531; -webkit-font-smoothing: antialiased;">
  <!-- Outer Background Table -->
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #ECEBE9; padding: 40px 16px;">
    <tr>
      <td align="center">
        <!-- Main Outer Card Container -->
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #FBF9F5; border: 1px solid #2E4A3D; box-shadow: 0 4px 20px rgba(0,0,0,0.04);">
          <tr>
            <td style="padding: 12px;">
              <!-- Inner Double Fine-Line Border Table -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="border: 1px solid rgba(46, 74, 61, 0.18); background-color: #FBF9F5; padding: 40px 32px;">
                <tr>
                  <td>
                    
                    <!-- Stationery Header -->
                    <table width="100%" border="0" cellspacing="0" cellpadding="0">
                      <tr>
                        <td align="center">
                          <span style="display: block; font-family: 'Playfair Display', Georgia, serif; font-size: 12px; letter-spacing: 4px; text-transform: uppercase; color: #8B5A2B; margin-bottom: 8px;">Lucas &amp; Lianne</span>
                          <h1 style="margin: 0; font-family: 'Playfair Display', Georgia, serif; font-size: 30px; font-weight: normal; color: #2E4A3D; letter-spacing: 1px;">${copy.headerTitle}</h1>
                          <div style="width: 48px; height: 1px; background-color: #2E4A3D; margin: 18px auto 20px auto;"></div>
                          <span style="display: block; font-family: 'Playfair Display', Georgia, serif; font-size: 14px; letter-spacing: 2px; text-transform: uppercase; color: #2E4A3D; margin-bottom: 12px; font-weight: 600;">${copy.headerSubtitle}</span>
                          <p style="margin: 0 0 24px 0; font-family: 'Lato', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 15px; line-height: 1.6; color: #4A5650; max-width: 440px;">
                            ${copy.thankYouIntro}
                          </p>
                        </td>
                      </tr>
                    </table>

                    <!-- Divider -->
                    <div style="border-top: 1px solid rgba(46, 74, 61, 0.12); margin: 20px 0 28px 0;"></div>

                    <!-- Party Responses Table -->
                    <span style="display: block; font-family: 'Playfair Display', Georgia, serif; font-size: 12px; text-transform: uppercase; letter-spacing: 2px; color: #8B5A2B; margin-bottom: 12px; font-weight: 600;">${copy.partyResponseLabel}</span>
                    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
                      ${partyRowsHtml}
                    </table>

                    <!-- Dietary Section -->
                    ${dietaryHtml}

                    <!-- Wedding Celebration Details Box -->
                    <div style="margin-top: 36px; padding: 28px 24px; background-color: #F4F2EC; border: 1px solid rgba(46, 74, 61, 0.15); border-radius: 2px; text-align: center;">
                      <span style="display: block; font-family: 'Playfair Display', Georgia, serif; font-size: 11px; text-transform: uppercase; letter-spacing: 3px; color: #8B5A2B; margin-bottom: 8px; font-weight: 600;">${copy.celebrationDetailsLabel}</span>
                      <h3 style="margin: 0 0 16px 0; font-family: 'Playfair Display', Georgia, serif; font-size: 22px; font-weight: normal; color: #2E4A3D;">${copy.weddingHeading}</h3>
                      
                      <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-top: 12px;">
                        <tr>
                          <td style="padding: 8px 0; font-family: 'Lato', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 15px; color: #2C3531;">
                            <strong style="color: #2E4A3D; font-family: 'Playfair Display', Georgia, serif; font-size: 16px;">${copy.dateText}</strong><br>
                            <span style="color: #4A5650; font-size: 14px;">${copy.timeText}</span>
                          </td>
                        </tr>
                        <tr>
                          <td style="padding: 8px 0; font-family: 'Lato', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 15px; color: #2C3531;">
                            <strong style="color: #2E4A3D; font-family: 'Playfair Display', Georgia, serif; font-size: 16px;">Deering Estate</strong><br>
                            <span style="color: #4A5650; font-size: 14px;">16701 SW 72nd Ave, Miami, FL 33157</span>
                          </td>
                        </tr>
                      </table>

                      <div style="margin-top: 24px;">
                        <a href="${copy.detailsUrl}" target="_blank" style="display: inline-block; background-color: #2E4A3D; color: #FFFFFF; text-decoration: none; font-family: 'Lato', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 13px; font-weight: bold; letter-spacing: 1.5px; text-transform: uppercase; padding: 12px 28px; border-radius: 2px;">
                          ${copy.viewDetailsBtn}
                        </a>
                      </div>
                    </div>

                    <!-- Footer Signature -->
                    <div style="margin-top: 40px; text-align: center; border-top: 1px solid rgba(46, 74, 61, 0.12); padding-top: 28px;">
                      <p style="margin: 0 0 8px 0; font-family: 'Playfair Display', Georgia, serif; font-size: 18px; color: #8B5A2B; font-style: italic;">
                        ${copy.signature}
                      </p>
                      <p style="margin: 0; font-family: 'Lato', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 12px; color: #7A8680; line-height: 1.6;">
                        ${copy.changesPrefix} <a href="mailto:rsvp@lucasandlianne.com" style="color: #2E4A3D; text-decoration: underline;">rsvp@lucasandlianne.com</a>.<br>
                        <a href="https://lucasandlianne.com${locale === "es" ? "/es/" : ""}" target="_blank" style="color: #8B5A2B; text-decoration: none; font-weight: bold;">lucasandlianne.com</a>
                      </p>
                    </div>

                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function buildConfirmationEmailText(submission: RsvpSubmissionPayload): string {
  const locale = submission.lang === "es" ? "es" : "en";
  const copy = EMAIL_COPY[locale];

  const partyLines = submission.party
    .map((guest: GuestResponse) => `• ${guest.name}: ${guest.attending ? copy.acceptStatus : copy.declineStatus}`)
    .join("\n");

  const dietarySection = submission.dietary && submission.dietary.trim().length > 0
    ? `\n${copy.dietaryLabel.toUpperCase()}:\n${submission.dietary.trim()}\n`
    : "";

  return `${copy.headerSubtitle.toUpperCase()} — ${copy.weddingHeadingPlain}
==================================================

${copy.thankYouIntro}

${copy.partyResponseLabel.toUpperCase()}:
${partyLines}
${dietarySection}
${copy.celebrationDetailsLabel.toUpperCase()}:
• Date: ${copy.dateText} (${copy.timeText})
• Location: Deering Estate (16701 SW 72nd Ave, Miami, FL 33157)
• Wedding Details: ${copy.detailsUrl}

${copy.signaturePlain}

${copy.changesPlain}
`;
}

export function getHostNotificationEmailSubject(submission: RsvpSubmissionPayload): string {
  const guestNames = submission.party.map((g) => g.name).join(", ") || "Guest";
  const totalCount = submission.party.length;
  const acceptingCount = submission.party.filter((g) => g.attending).length;

  let attendingSummary: string;
  if (totalCount === 1) {
    attendingSummary = acceptingCount === 1 ? "Joyfully Accept" : "Regretfully Decline";
  } else if (acceptingCount === totalCount) {
    attendingSummary = `All ${totalCount} Joyfully Accept`;
  } else if (acceptingCount === 0) {
    attendingSummary = `All ${totalCount} Regretfully Decline`;
  } else {
    attendingSummary = `${acceptingCount} of ${totalCount} Accepting`;
  }

  return `New RSVP: ${guestNames} (${attendingSummary})`;
}

export function buildHostNotificationEmailHtml(submission: RsvpSubmissionPayload): string {
  const totalCount = submission.party.length;
  const acceptingCount = submission.party.filter((g) => g.attending).length;
  const decliningCount = totalCount - acceptingCount;

  const partyRowsHtml = submission.party
    .map((guest: GuestResponse) => {
      const isAttending = guest.attending;
      const statusText = isAttending ? "✓ Joyfully Accept" : "✕ Regretfully Decline";
      const statusBg = isAttending ? "#2E4A3D" : "#ECEBE9";
      const statusColor = isAttending ? "#FFFFFF" : "#6E6259";
      const statusBorder = isAttending ? "#2E4A3D" : "#D4CEC5";

      return `
        <tr>
          <td style="padding: 14px 0; border-bottom: 1px dashed rgba(46, 74, 61, 0.15); font-family: 'Playfair Display', Georgia, serif; font-size: 17px; color: #2E4A3D; font-weight: 600;">
            ${escapeHtml(guest.name)}
          </td>
          <td align="right" style="padding: 14px 0; border-bottom: 1px dashed rgba(46, 74, 61, 0.15);">
            <span style="display: inline-block; padding: 6px 14px; background-color: ${statusBg}; color: ${statusColor}; border: 1px solid ${statusBorder}; border-radius: 2px; font-family: 'Lato', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 13px; font-weight: 700; letter-spacing: 0.5px;">
              ${statusText}
            </span>
          </td>
        </tr>
      `;
    })
    .join("");

  const dietaryValue =
    submission.dietary && submission.dietary.trim().length > 0
      ? escapeHtml(submission.dietary.trim())
      : "None provided";

  const guestEmailHtml =
    submission.email && submission.email.trim().length > 0
      ? `<a href="mailto:${escapeHtml(submission.email.trim())}" style="color: #2E4A3D; text-decoration: underline;">${escapeHtml(submission.email.trim())}</a>`
      : `<span style="color: #7A8680; font-style: italic;">Not provided</span>`;

  const localeLabel = submission.lang === "es" ? "Español" : "English";
  const submittedAtText = escapeHtml(submission.submittedAt || new Date().toISOString());

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New RSVP Submission — Lucas &amp; Lianne</title>
</head>
<body style="margin: 0; padding: 0; background-color: #ECEBE9; font-family: 'Lato', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #2C3531; -webkit-font-smoothing: antialiased;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #ECEBE9; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #FBF9F5; border: 1px solid #2E4A3D; box-shadow: 0 4px 20px rgba(0,0,0,0.04);">
          <tr>
            <td style="padding: 12px;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="border: 1px solid rgba(46, 74, 61, 0.18); background-color: #FBF9F5; padding: 36px 32px;">
                <tr>
                  <td>
                    <table width="100%" border="0" cellspacing="0" cellpadding="0">
                      <tr>
                        <td align="center">
                          <span style="display: block; font-family: 'Playfair Display', Georgia, serif; font-size: 12px; letter-spacing: 4px; text-transform: uppercase; color: #8B5A2B; margin-bottom: 8px;">Lucas &amp; Lianne</span>
                          <h1 style="margin: 0; font-family: 'Playfair Display', Georgia, serif; font-size: 28px; font-weight: normal; color: #2E4A3D; letter-spacing: 1px;">New RSVP Received</h1>
                          <div style="width: 48px; height: 1px; background-color: #2E4A3D; margin: 16px auto 18px auto;"></div>
                          <p style="margin: 0 0 20px 0; font-family: 'Lato', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14px; color: #4A5650;">
                            <strong>${acceptingCount}</strong> accepting &bull; <strong>${decliningCount}</strong> declining (Total party: ${totalCount})
                          </p>
                        </td>
                      </tr>
                    </table>

                    <div style="border-top: 1px solid rgba(46, 74, 61, 0.12); margin: 16px 0 24px 0;"></div>

                    <span style="display: block; font-family: 'Playfair Display', Georgia, serif; font-size: 12px; text-transform: uppercase; letter-spacing: 2px; color: #8B5A2B; margin-bottom: 12px; font-weight: 600;">Party Members &amp; Status</span>
                    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
                      ${partyRowsHtml}
                    </table>

                    <div style="margin-top: 24px; padding: 18px 20px; background-color: #F4F2EC; border-left: 3px solid #2E4A3D; border-radius: 2px;">
                      <span style="display: block; font-family: 'Playfair Display', Georgia, serif; font-size: 11px; text-transform: uppercase; letter-spacing: 2px; color: #8B5A2B; margin-bottom: 6px; font-weight: 600;">Dietary Restrictions / Notes</span>
                      <p style="margin: 0; font-family: 'Lato', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #2C3531;">
                        ${dietaryValue}
                      </p>
                    </div>

                    <div style="margin-top: 24px; padding: 18px 20px; background-color: #F4F2EC; border: 1px solid rgba(46, 74, 61, 0.15); border-radius: 2px;">
                      <span style="display: block; font-family: 'Playfair Display', Georgia, serif; font-size: 11px; text-transform: uppercase; letter-spacing: 2px; color: #8B5A2B; margin-bottom: 10px; font-weight: 600;">Submission Metadata</span>
                      <table width="100%" border="0" cellspacing="0" cellpadding="0" style="font-family: 'Lato', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14px; color: #2C3531;">
                        <tr>
                          <td style="padding: 4px 0; color: #4A5650; width: 140px;"><strong>Guest Email:</strong></td>
                          <td style="padding: 4px 0;">${guestEmailHtml}</td>
                        </tr>
                        <tr>
                          <td style="padding: 4px 0; color: #4A5650;"><strong>Locale:</strong></td>
                          <td style="padding: 4px 0;">${localeLabel}</td>
                        </tr>
                        <tr>
                          <td style="padding: 4px 0; color: #4A5650;"><strong>Submitted At:</strong></td>
                          <td style="padding: 4px 0;">${submittedAtText}</td>
                        </tr>
                      </table>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function buildHostNotificationEmailText(submission: RsvpSubmissionPayload): string {
  const partyLines = submission.party
    .map((guest: GuestResponse) => {
      const statusText = guest.attending ? "✓ Joyfully Accept" : "✕ Regretfully Decline";
      return `• ${guest.name}: ${statusText}`;
    })
    .join("\n");

  const dietaryText =
    submission.dietary && submission.dietary.trim().length > 0
      ? submission.dietary.trim()
      : "None provided";

  const emailText =
    submission.email && submission.email.trim().length > 0
      ? submission.email.trim()
      : "Not provided";

  const localeLabel = submission.lang === "es" ? "Español" : "English";
  const submittedAtText = submission.submittedAt || new Date().toISOString();

  return `NEW RSVP SUBMISSION — LUCAS & LIANNE'S WEDDING
==================================================

PARTY MEMBERS & STATUS:
${partyLines}

DIETARY RESTRICTIONS / NOTES:
${dietaryText}

SUBMISSION DETAILS:
• Guest Email: ${emailText}
• Locale: ${localeLabel}
• Submitted At: ${submittedAtText}
`;
}
