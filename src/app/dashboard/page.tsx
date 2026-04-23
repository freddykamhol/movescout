import DashboardPageClient from "./dashboard-page-client";

import { getDashboardData } from "@/lib/dashboard-data";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const dashboardData = await getDashboardData();

  return <DashboardPageClient initialData={dashboardData} />;
}
