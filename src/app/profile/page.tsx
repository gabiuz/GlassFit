import type { Metadata } from "next";
import { ProfilePage } from "@/features/profile";

export const metadata: Metadata = {
  title: "My Profile | GlassFit",
  description: "View and update your personal information and account security settings.",
};

export default function ProfileRoute() {
  return <ProfilePage />;
}
