import { GuestResponse, RsvpSubmissionPayload } from "./types";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function buildConfirmationEmailHtml(submission: RsvpSubmissionPayload): string {
  const partyRowsHtml = submission.party
    .map((guest: GuestResponse) => {
      const isAttending = guest.attending;
      const statusText = isAttending ? "✓ Joyfully Accepts" : "✕ Regretfully Declines";
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
        <span style="display: block; font-family: 'Playfair Display', Georgia, serif; font-size: 11px; text-transform: uppercase; letter-spacing: 2px; color: #8B5A2B; margin-bottom: 6px; font-weight: 600;">Dietary Restrictions or Requests</span>
        <p style="margin: 0; font-family: 'Lato', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #2C3531; font-style: italic;">
          "${escapeHtml(submission.dietary.trim())}"
        </p>
      </div>
    `
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>RSVP Confirmation — Lucas &amp; Lianne</title>
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
                          <h1 style="margin: 0; font-family: 'Playfair Display', Georgia, serif; font-size: 30px; font-weight: normal; color: #2E4A3D; letter-spacing: 1px;">Kindly Reply</h1>
                          <div style="width: 48px; height: 1px; background-color: #2E4A3D; margin: 18px auto 20px auto;"></div>
                          <span style="display: block; font-family: 'Playfair Display', Georgia, serif; font-size: 14px; letter-spacing: 2px; text-transform: uppercase; color: #2E4A3D; margin-bottom: 12px; font-weight: 600;">RSVP Confirmation</span>
                          <p style="margin: 0 0 24px 0; font-family: 'Lato', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 15px; line-height: 1.6; color: #4A5650; max-width: 440px;">
                            Thank you for your response! We have received your RSVP for our wedding celebration.
                          </p>
                        </td>
                      </tr>
                    </table>

                    <!-- Divider -->
                    <div style="border-top: 1px solid rgba(46, 74, 61, 0.12); margin: 20px 0 28px 0;"></div>

                    <!-- Party Responses Table -->
                    <span style="display: block; font-family: 'Playfair Display', Georgia, serif; font-size: 12px; text-transform: uppercase; letter-spacing: 2px; color: #8B5A2B; margin-bottom: 12px; font-weight: 600;">Your Party's Response</span>
                    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
                      ${partyRowsHtml}
                    </table>

                    <!-- Dietary Section -->
                    ${dietaryHtml}

                    <!-- Wedding Celebration Details Box -->
                    <div style="margin-top: 36px; padding: 28px 24px; background-color: #F4F2EC; border: 1px solid rgba(46, 74, 61, 0.15); border-radius: 2px; text-align: center;">
                      <span style="display: block; font-family: 'Playfair Display', Georgia, serif; font-size: 11px; text-transform: uppercase; letter-spacing: 3px; color: #8B5A2B; margin-bottom: 8px; font-weight: 600;">Celebration Details</span>
                      <h3 style="margin: 0 0 16px 0; font-family: 'Playfair Display', Georgia, serif; font-size: 22px; font-weight: normal; color: #2E4A3D;">Lucas &amp; Lianne's Wedding</h3>
                      
                      <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-top: 12px;">
                        <tr>
                          <td style="padding: 8px 0; font-family: 'Lato', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 15px; color: #2C3531;">
                            <strong style="color: #2E4A3D; font-family: 'Playfair Display', Georgia, serif; font-size: 16px;">Saturday, February 20, 2027</strong><br>
                            <span style="color: #4A5650; font-size: 14px;">At Five O'Clock in the Evening</span>
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
                        <a href="https://lucasandlianne.com/details.html" target="_blank" style="display: inline-block; background-color: #2E4A3D; color: #FFFFFF; text-decoration: none; font-family: 'Lato', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 13px; font-weight: bold; letter-spacing: 1.5px; text-transform: uppercase; padding: 12px 28px; border-radius: 2px;">
                          View Wedding Details
                        </a>
                      </div>
                    </div>

                    <!-- Footer Signature -->
                    <div style="margin-top: 40px; text-align: center; border-top: 1px solid rgba(46, 74, 61, 0.12); padding-top: 28px;">
                      <p style="margin: 0 0 8px 0; font-family: 'Playfair Display', Georgia, serif; font-size: 18px; color: #8B5A2B; font-style: italic;">
                        Love, Lianne &amp; Lucas 🥭
                      </p>
                      <p style="margin: 0; font-family: 'Lato', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 12px; color: #7A8680; line-height: 1.6;">
                        If you need to make any changes to your RSVP, please reply directly to this email or contact us at <a href="mailto:rsvp@lucasandlianne.com" style="color: #2E4A3D; text-decoration: underline;">rsvp@lucasandlianne.com</a>.<br>
                        <a href="https://lucasandlianne.com" target="_blank" style="color: #8B5A2B; text-decoration: none; font-weight: bold;">lucasandlianne.com</a>
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
  const partyLines = submission.party
    .map((guest: GuestResponse) => `• ${guest.name}: ${guest.status}`)
    .join("\n");

  const dietarySection = submission.dietary && submission.dietary.trim().length > 0
    ? `\nDIETARY RESTRICTIONS OR NOTES:\n${submission.dietary.trim()}\n`
    : "";

  return `RSVP CONFIRMATION — LUCAS & LIANNE'S WEDDING
==================================================

Thank you for your response! We have received your RSVP for our wedding celebration.

YOUR PARTY'S RSVP:
${partyLines}
${dietarySection}
CELEBRATION DETAILS:
• Date: Saturday, February 20, 2027 at Five O'Clock in the Evening (5:00 PM)
• Location: Deering Estate (16701 SW 72nd Ave, Miami, FL 33157)
• Wedding Details: https://lucasandlianne.com/details.html

With love,
Lianne & Lucas 🥭

If you need to make any changes to your RSVP, please reply directly to this email or reach us at rsvp@lucasandlianne.com.
`;
}
