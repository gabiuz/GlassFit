import { SettingsPage } from "@/features/admin/settings/SettingsPage";

export const metadata = {
    title: "Settings | GlassFit Admin",
    description: "Manage administrator account profile, security, and system preferences.",
};

export default function SettingsRoute() {
    return <SettingsPage />;
}
