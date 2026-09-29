import { DashboardPage } from "@/features/admin";

export const metadata = {
  title: "Admin Dashboard | GlassFit",
  description: "GlassFit admin overview and quick actions",
};

export default function AdminDashboardRoute() {
  return <DashboardPage />;
}
