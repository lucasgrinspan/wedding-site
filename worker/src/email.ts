import { resolveEmailNoteForSubmission } from "./delights";
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
    subject: "RSVP Confirmation — Lianne & Lucas's Wedding",
    title: "RSVP Confirmation — Lianne &amp; Lucas",
    acceptStatus: "✓ Joyfully Accepts",
    declineStatus: "✕ Regretfully Declines",
    personalNoteLabel: "A Personal Note from Lianne & Lucas",
    dietaryLabel: "Dietary Restrictions or Requests",
    headerTitle: "Kindly Reply",
    headerSubtitle: "RSVP Confirmation",
    thankYouIntro: "Thank you for your response! We have received your RSVP for our wedding celebration.",
    partyResponseLabel: "Your Party's Response",
    celebrationDetailsLabel: "Celebration Details",
    weddingHeading: "Lianne &amp; Lucas's Wedding",
    weddingHeadingPlain: "LUCAS & LIANNE'S WEDDING",
    dateText: "Saturday, February 20, 2027",
    timeText: "Ceremony begins at 5:30 PM",
    scheduleLabel: "Timeline",
    scheduleItems: [
      { time: "5:30 PM", event: "Ceremony" },
      { time: "6:00 PM", event: "Cocktail Hour" },
      { time: "7:15 PM", event: "Dinner" },
    ],
    detailsUrl: "https://lucasandlianne.com/#details",
    viewDetailsBtn: "View Wedding Details",
    signature: "Love, Lianne &amp; Lucas 🥭",
    signaturePlain: "With love,\nLianne & Lucas 🥭",
    rsvpUrl: "https://lucasandlianne.com/rsvp.html",
    rsvpLinkText: "RSVP page",
    changesPrefix: "Need to update anyone in your party's response or make a change? Simply revisit our",
    changesSuffix: "by December 31, 2026 to submit an updated response.",
    changesPlain: "Need to update anyone in your party's response or make a change? Simply revisit our RSVP page at https://lucasandlianne.com/rsvp.html by December 31, 2026 to submit an updated response.",
  },
  es: {
    subject: "Confirmación de Asistencia — Casamiento de Lianne & Lucas",
    title: "Confirmación de Asistencia — Lianne &amp; Lucas",
    acceptStatus: "✓ Asistirá con alegría",
    declineStatus: "✕ No podrá asistir",
    personalNoteLabel: "Una Nota Personal de Lianne y Lucas",
    dietaryLabel: "Restricciones Alimentarias o Pedidos Especiales",
    headerTitle: "Confirmación",
    headerSubtitle: "Confirmación de Asistencia",
    thankYouIntro: "¡Muchas gracias por responder! Recibimos tu confirmación para nuestro casamiento.",
    partyResponseLabel: "Respuesta de tu Grupo",
    celebrationDetailsLabel: "Detalles de la Celebración",
    weddingHeading: "Casamiento de Lianne &amp; Lucas",
    weddingHeadingPlain: "CASAMIENTO DE LUCAS & LIANNE",
    dateText: "Sábado 20 de febrero de 2027",
    timeText: "Ceremonia a las 5:30 PM",
    scheduleLabel: "Cronograma",
    scheduleItems: [
      { time: "5:30 PM", event: "Ceremonia" },
      { time: "6:00 PM", event: "Cóctel" },
      { time: "7:15 PM", event: "Cena" },
    ],
    detailsUrl: "https://lucasandlianne.com/es/#details",
    viewDetailsBtn: "Ver Detalles del Casamiento",
    signature: "Con amor, Lianne &amp; Lucas 🥭",
    signaturePlain: "Con amor,\nLianne & Lucas 🥭",
    rsvpUrl: "https://lucasandlianne.com/es/rsvp.html",
    rsvpLinkText: "página de confirmación",
    changesPrefix: "¿Necesitás actualizar la respuesta de alguien de tu grupo o hacer algún cambio? Podés volver a visitar nuestra",
    changesSuffix: "hasta el 31 de diciembre de 2026 para enviar una respuesta actualizada.",
    changesPlain: "¿Necesitás actualizar la respuesta de alguien de tu grupo o hacer algún cambio? Podés volver a visitar nuestra página de confirmación en https://lucasandlianne.com/es/rsvp.html hasta el 31 de diciembre de 2026 para enviar una respuesta actualizada.",
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

  const personalNote = resolveEmailNoteForSubmission(submission);
  const personalNoteHtml = personalNote
    ? `
      <div style="margin: 0 0 28px 0; padding: 20px 22px; background-color: #F4F2EC; border: 1px solid rgba(139, 90, 43, 0.25); border-left: 3px solid #8B5A2B; border-radius: 2px;">
        <span style="display: block; font-family: 'Playfair Display', Georgia, serif; font-size: 11px; text-transform: uppercase; letter-spacing: 2px; color: #8B5A2B; margin-bottom: 8px; font-weight: 600;">${escapeHtml(copy.personalNoteLabel)}</span>
        <p style="margin: 0; font-family: 'Playfair Display', Georgia, serif; font-size: 15px; line-height: 1.65; color: #2C3531; font-style: italic;">
          &ldquo;${escapeHtml(personalNote)}&rdquo;
        </p>
      </div>
    `
    : "";

  const scheduleRowsHtml = copy.scheduleItems
    .map(
      (item) => `
        <td align="center" width="33%" style="padding: 8px 6px; vertical-align: top;">
          <span style="display: block; font-family: 'Playfair Display', Georgia, serif; font-size: 15px; font-weight: 600; color: #8B5A2B; margin-bottom: 2px;">${item.time}</span>
          <span style="display: block; font-family: 'Lato', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 13px; color: #2C3531;">${item.event}</span>
        </td>
      `
    )
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
                          <span style="display: block; font-family: 'Playfair Display', Georgia, serif; font-size: 12px; letter-spacing: 4px; text-transform: uppercase; color: #8B5A2B; margin-bottom: 8px;">Lianne &amp; Lucas</span>
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

                    <!-- Personal Note Section (if configured for this guest/party) -->
                    ${personalNoteHtml}

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

                      <div style="margin-top: 16px; padding-top: 14px; border-top: 1px dashed rgba(46, 74, 61, 0.18);">
                        <span style="display: block; font-family: 'Playfair Display', Georgia, serif; font-size: 11px; text-transform: uppercase; letter-spacing: 2px; color: #8B5A2B; margin-bottom: 6px; font-weight: 600;">${copy.scheduleLabel}</span>
                        <table width="100%" border="0" cellspacing="0" cellpadding="0">
                          <tr>
                            ${scheduleRowsHtml}
                          </tr>
                        </table>
                      </div>

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
                        ${copy.changesPrefix} <a href="${copy.rsvpUrl}" target="_blank" style="color: #2E4A3D; text-decoration: underline;">${copy.rsvpLinkText}</a> ${copy.changesSuffix}<br>
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

  const personalNote = resolveEmailNoteForSubmission(submission);
  const personalNoteSection = personalNote
    ? `\n${copy.personalNoteLabel.toUpperCase()}:\n"${personalNote}"\n`
    : "";

  const dietarySection = submission.dietary && submission.dietary.trim().length > 0
    ? `\n${copy.dietaryLabel.toUpperCase()}:\n${submission.dietary.trim()}\n`
    : "";

  const scheduleText = copy.scheduleItems
    .map((item) => `  - ${item.time}: ${item.event}`)
    .join("\n");

  const dateFieldLabel = locale === "es" ? "Fecha" : "Date";
  const locationFieldLabel = locale === "es" ? "Lugar" : "Location";
  const detailsFieldLabel = locale === "es" ? "Detalles" : "Wedding Details";

  return `${copy.headerSubtitle.toUpperCase()} — ${copy.weddingHeadingPlain}
==================================================

${copy.thankYouIntro}
${personalNoteSection}
${copy.partyResponseLabel.toUpperCase()}:
${partyLines}
${dietarySection}
${copy.celebrationDetailsLabel.toUpperCase()}:
• ${dateFieldLabel}: ${copy.dateText} (${copy.timeText})
• ${locationFieldLabel}: Deering Estate (16701 SW 72nd Ave, Miami, FL 33157)
• ${copy.scheduleLabel}:
${scheduleText}
• ${detailsFieldLabel}: ${copy.detailsUrl}

${copy.signaturePlain}

${copy.changesPlain}
`;
}

export function getHostNotificationEmailSubject(submission: RsvpSubmissionPayload): string {
  const guestNames =
    submission.party
      .map((g) => g.name.replace(/[\r\n]+/g, " ").trim())
      .filter(Boolean)
      .join(", ") || "Guest";
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

function formatExtraKey(key: string): string {
  const stripped = key.replace(/^extra[_-]/i, "");
  const words = stripped.replace(/[_-]/g, " ").trim();
  if (!words) return key;
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function buildHostNotificationEmailHtml(submission: RsvpSubmissionPayload): string {
  const totalCount = submission.party.length;
  const acceptingCount = submission.party.filter((g) => g.attending).length;
  const decliningCount = totalCount - acceptingCount;
  const submittedByNormalized = submission.submittedBy?.trim().toLowerCase();

  const partyRowsHtml = submission.party
    .map((guest: GuestResponse) => {
      const isAttending = guest.attending;
      const statusText = isAttending ? "✓ Joyfully Accept" : "✕ Regretfully Decline";
      const statusBg = isAttending ? "#2E4A3D" : "#ECEBE9";
      const statusColor = isAttending ? "#FFFFFF" : "#6E6259";
      const statusBorder = isAttending ? "#2E4A3D" : "#D4CEC5";
      const isSubmitter =
        Boolean(submittedByNormalized) &&
        guest.name.trim().toLowerCase() === submittedByNormalized;
      const submitterBadgeHtml = isSubmitter
        ? ` <span style="display: inline-block; margin-left: 8px; padding: 2px 8px; background-color: #F4F2EC; color: #8B5A2B; border: 1px solid rgba(139, 90, 43, 0.3); border-radius: 2px; font-family: 'Lato', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; vertical-align: middle;">Filled Out RSVP</span>`
        : "";

      return `
        <tr>
          <td style="padding: 14px 0; border-bottom: 1px dashed rgba(46, 74, 61, 0.15); font-family: 'Playfair Display', Georgia, serif; font-size: 17px; color: #2E4A3D; font-weight: 600;">
            ${escapeHtml(guest.name)}${submitterBadgeHtml}
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

  const submittedByHtml =
    submission.submittedBy && submission.submittedBy.trim().length > 0
      ? `<strong style="color: #2E4A3D;">${escapeHtml(submission.submittedBy.trim())}</strong>`
      : `<span style="color: #7A8680; font-style: italic;">Not provided</span>`;

  const guestEmailNote =
    submission.email && submission.email.trim().length > 0 && submission.emailValid === false
      ? ` <span style="color: #8B2635; font-size: 12px;">(invalid format — confirmation skipped)</span>`
      : "";

  const guestEmailHtml =
    submission.email && submission.email.trim().length > 0
      ? submission.emailValid === false
        ? `<span>${escapeHtml(submission.email.trim())}</span>${guestEmailNote}`
        : `<a href="mailto:${escapeHtml(submission.email.trim())}" style="color: #2E4A3D; text-decoration: underline;">${escapeHtml(submission.email.trim())}</a>`
      : `<span style="color: #7A8680; font-style: italic;">Not provided</span>`;

  const localeLabel = submission.lang === "es" ? "Español" : "English";
  const submittedAtText = escapeHtml(submission.submittedAt || new Date().toISOString());

  const hasExtras = Boolean(submission.extras && Object.keys(submission.extras).length > 0);
  const extrasRowsHtml = hasExtras
    ? Object.entries(submission.extras!)
        .map(
          ([k, v]) => `
            <tr>
              <td style="padding: 5px 0; color: #4A5650; width: 50%;"><strong>${escapeHtml(formatExtraKey(k))}:</strong></td>
              <td style="padding: 5px 0; color: #2E4A3D; font-weight: 600;">${escapeHtml(v)}</td>
            </tr>
          `
        )
        .join("")
    : "";

  const extrasBlockHtml = hasExtras
    ? `
      <div style="margin-top: 24px; padding: 18px 20px; background-color: #F4F2EC; border-left: 3px solid #8B5A2B; border-radius: 2px;">
        <span style="display: block; font-family: 'Playfair Display', Georgia, serif; font-size: 11px; text-transform: uppercase; letter-spacing: 2px; color: #8B5A2B; margin-bottom: 8px; font-weight: 600;">Easter Egg / Extra Responses</span>
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="font-family: 'Lato', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14px; color: #2C3531;">
          ${extrasRowsHtml}
        </table>
      </div>
    `
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New RSVP Submission — Lianne &amp; Lucas</title>
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
                          <span style="display: block; font-family: 'Playfair Display', Georgia, serif; font-size: 12px; letter-spacing: 4px; text-transform: uppercase; color: #8B5A2B; margin-bottom: 8px;">Lianne &amp; Lucas</span>
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
                    ${extrasBlockHtml}
                    <div style="margin-top: 24px; padding: 18px 20px; background-color: #F4F2EC; border: 1px solid rgba(46, 74, 61, 0.15); border-radius: 2px;">
                      <span style="display: block; font-family: 'Playfair Display', Georgia, serif; font-size: 11px; text-transform: uppercase; letter-spacing: 2px; color: #8B5A2B; margin-bottom: 10px; font-weight: 600;">Submission Metadata</span>
                      <table width="100%" border="0" cellspacing="0" cellpadding="0" style="font-family: 'Lato', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14px; color: #2C3531;">
                        <tr>
                          <td style="padding: 4px 0; color: #4A5650; width: 140px;"><strong>Submitted By:</strong></td>
                          <td style="padding: 4px 0;">${submittedByHtml}</td>
                        </tr>
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

  const extrasText =
    submission.extras && Object.keys(submission.extras).length > 0
      ? `\nEASTER EGG / EXTRA RESPONSES:\n${Object.entries(submission.extras)
          .map(([k, v]) => `• ${formatExtraKey(k)}: ${v}`)
          .join("\n")}\n`
      : "";

  const submittedByText =
    submission.submittedBy && submission.submittedBy.trim().length > 0
      ? submission.submittedBy.trim()
      : "Not provided";

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
${extrasText}
SUBMISSION DETAILS:
• Submitted By: ${submittedByText}
• Guest Email: ${emailText}
• Locale: ${localeLabel}
• Submitted At: ${submittedAtText}
`;
}
