// PRD-F# (Settings): Thin server-component shell for the settings page.
// The protected layout's requireAdmin() already runs above this in the hierarchy;
// AdminSessionProvider distributes the context to SettingsContent via useAdminSession().

import { SettingsContent } from "./SettingsContent";

export function SettingsPage() {
    return <SettingsContent />;
}
