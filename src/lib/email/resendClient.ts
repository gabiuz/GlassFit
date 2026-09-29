import { renderStaffInviteEmailHtml } from "./templates/staffInviteEmail";

export type SendEmailParams = {
    to: string;
    subject: string;
    html: string;
};

export type SendEmailResult =
    | { success: true; id?: string }
    | { success: false; error: string };

/**
 * Sends an email using the Resend REST API.
 */
export async function sendEmail({ to, subject, html }: SendEmailParams): Promise<SendEmailResult> {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM_EMAIL ?? "GlassFit Back-Office <onboarding@resend.dev>";

    if (!apiKey) {
        console.warn("[resendClient] RESEND_API_KEY is not set. Email dispatch will be simulated in development.");
        // In local development or testing without key, simulate successful dispatch
        return { success: true, id: "simulated-msg-id" };
    }

    try {
        const response = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                from,
                to: [to],
                subject,
                html,
            }),
        });

        const data = (await response.json()) as { id?: string; message?: string; name?: string; statusCode?: number };

        if (!response.ok) {
            console.error("[resendClient] Resend API error:", data);
            return {
                success: false,
                error: data.message ?? "Failed to deliver invitation email via Resend.",
            };
        }

        return { success: true, id: data.id };
    } catch (err) {
        console.error("[resendClient] Network error dispatching email:", err);
        return {
            success: false,
            error: err instanceof Error ? err.message : "Network error during email dispatch.",
        };
    }
}

/**
 * Dispatches a branded staff invitation email.
 */
export async function sendStaffInviteEmail({
    to,
    activationUrl,
}: {
    to: string;
    activationUrl: string;
}): Promise<SendEmailResult> {
    const html = renderStaffInviteEmailHtml(activationUrl);
    return sendEmail({
        to,
        subject: "You're Invited to Join GlassFit as Staff",
        html,
    });
}
