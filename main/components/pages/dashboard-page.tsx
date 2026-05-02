import { SiteShell } from "@/components/site-shell";
import { DashboardView } from "@/components/dashboard-view";
import { getDashboardData } from "@/lib/placementiq-api";

export async function DashboardPage() {
  const data = await getDashboardData();

  return (
    <SiteShell>
      <DashboardView data={data} />
    </SiteShell>
  );
}

export default DashboardPage;
