export interface StaffEmailChangeApprovalTemplateInput {
    staffName: string;
    previousEmail: string;
    proposedEmail: string;
    requestedAt: string;
    expiresAt: string;
    reviewUrl: string;
}

function escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, (character) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    })[character] ?? character);
}

export function renderStaffEmailChangeApprovalHtml(input: StaffEmailChangeApprovalTemplateInput): string {
    const staffName = escapeHtml(input.staffName);
    const previousEmail = escapeHtml(input.previousEmail);
    const proposedEmail = escapeHtml(input.proposedEmail);
    const requestedAt = escapeHtml(input.requestedAt);
    const expiresAt = escapeHtml(input.expiresAt);
    const reviewUrl = escapeHtml(input.reviewUrl);
    return `<!doctype html><html lang="en"><body style="margin:0;background:#f4f6f8;font-family:Arial,sans-serif;color:#0f1422"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px"><tr><td align="center"><table role="presentation" width="100%" style="max-width:580px;background:#fff;border:1px solid #e2e8f0;border-radius:16px"><tr><td style="background:#045e6d;color:#fff;padding:28px 32px"><h1 style="margin:0;font-size:24px">GlassFit</h1></td></tr><tr><td style="padding:32px"><h2 style="margin-top:0">Staff email change review</h2><p>${staffName} requested an administrator email change.</p><p><strong>Current:</strong> ${previousEmail}<br><strong>Proposed:</strong> ${proposedEmail}<br><strong>Requested:</strong> ${requestedAt}<br><strong>Expires:</strong> ${expiresAt}</p><p>This link opens a protected review page. Opening it does not approve the request.</p><p><a href="${reviewUrl}" style="display:inline-block;background:#07b6d3;color:#fff;text-decoration:none;padding:12px 24px;border-radius:20px">Review request</a></p></td></tr></table></td></tr></table></body></html>`;
}
