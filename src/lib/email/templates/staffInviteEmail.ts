export type StaffInviteEmailParams = {
    to: string;
    activationUrl: string;
};

export function renderStaffInviteEmailHtml(activationUrl: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You're Invited to Join GlassFit as Staff</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f6f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f1422;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f4f6f8;padding:40px 16px;">
    <tr>
      <td align="center">
        <!-- Container Card -->
        <table role="presentation" width="100%" style="max-width:580px;background-color:#ffffff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;box-shadow:0 4px 20px rgba(4,94,109,0.08);">
          <!-- Header Banner -->
          <tr>
            <td style="background:linear-gradient(135deg, #045e6d 0%, #097283 100%);padding:36px 32px;text-align:center;">
              <h1 style="margin:0;font-size:26px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;text-transform:uppercase;">
                GlassFit
              </h1>
              <p style="margin:6px 0 0 0;font-size:13px;color:#a5f3fc;font-weight:400;letter-spacing:0.5px;text-transform:uppercase;">
                Administrative Consultation Platform
              </p>
            </td>
          </tr>
          <!-- Body Content -->
          <tr>
            <td style="padding:36px 32px;">
              <h2 style="margin:0 0 16px 0;font-size:20px;font-weight:600;color:#0f1422;line-height:1.3;">
                You have been invited to join the GlassFit Team
              </h2>
              <p style="margin:0 0 20px 0;font-size:15px;line-height:1.6;color:#475569;">
                An administrator has invited you to activate your Staff account on the GlassFit back-office workbench. As a staff member, you will assist in client consultation reviews, fenestration quotation adjustments, and booking confirmations.
              </p>
              
              <!-- Security Highlight Box -->
              <table role="presentation" width="100%" style="background-color:#f0fdfa;border-left:4px solid #07b6d3;border-radius:6px;margin-bottom:28px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0;font-size:14px;line-height:1.5;color:#0f766e;font-weight:500;">
                      <strong>Action Required:</strong> To complete account activation, you will need the <strong>6-digit verification code</strong> provided to you by your administrator, along with your contact number and password.
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Call To Action Button -->
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 auto 28px auto;">
                <tr>
                  <td align="center" style="border-radius:20px;background-color:#07b6d3;">
                    <a href="${activationUrl}" target="_blank" style="display:inline-block;padding:14px 36px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:20px;letter-spacing:-0.2px;">
                      Activate Staff Account
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 8px 0;font-size:13px;line-height:1.5;color:#64748b;text-align:center;">
                Or copy and paste this URL into your browser:
              </p>
              <p style="margin:0 0 28px 0;font-size:12px;line-height:1.4;color:#0891b2;text-align:center;word-break:break-all;">
                ${activationUrl}
              </p>

              <hr style="border:none;border-top:1px solid #e2e8f0;margin:0 0 24px 0;">

              <p style="margin:0;font-size:12px;line-height:1.5;color:#94a3b8;text-align:center;">
                This invitation link will expire in 48 hours.<br>
                If you were not expecting this invitation, you can safely ignore this email.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color:#f8fafc;padding:20px 32px;text-align:center;border-top:1px solid #f1f5f9;">
              <p style="margin:0;font-size:12px;color:#94a3b8;">
                GlassFit Architectural Glass &amp; Aluminum Solutions &bull; Manila, Philippines
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
