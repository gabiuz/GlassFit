/**
 * My Requests Protected Customer Route (IMP-MS19)
 *
 * Traceability: PRD-F12, PRD-F17, SDD-C10, DSD-UI12, ERD-E2, QAD-TC32, BAN-RLS-07
 * Compliance: BAN-TYPE-05 (Zero any), BAN-PUNCT-01 (Zero em-dashes)
 */

import type { Metadata } from "next";
import { requireActiveCustomer } from "@/lib/auth/customer";
import { MyRequestsPage } from "@/features/my-requests";

export const metadata: Metadata = {
  title: "My Requests | GlassFit",
  description: "Track and review your consultation requests and quotations.",
};

export default async function MyRequestsRoute() {
  await requireActiveCustomer();
  return <MyRequestsPage />;
}
