import { Activity, AlertTriangle, FileText, ShieldAlert, TrendingUp, Users } from "lucide-react";
import { Badge, Card, DataTable, StatCard } from "../components/ui/primitives";

export default function RegionLive({ data }) {
  const casesByRegion = Object.values(data.cases.reduce((groups, item) => {
    const region = item.region || "Unassigned region";
    groups[region] ||= { region, cases: 0, inProgress: 0, returned: 0 };
    groups[region].cases += 1;
    if (item.status === "In progress") groups[region].inProgress += 1;
    if (item.status === "Action required") groups[region].returned += 1;
    return groups;
  }, {}));
  const openAlerts = data.notifications.filter((item) => !item.acknowledged);
  const columns = [
    { accessorKey: "region", header: "Region" },
    { accessorKey: "cases", header: "Cases in scope" },
    { accessorKey: "inProgress", header: "In progress" },
    { accessorKey: "returned", header: "Returned" },
  ];

  const stageCounts = Object.entries(data.cases.reduce((counts, item) => {
    counts[item.stage] = (counts[item.stage] || 0) + 1;
    return counts;
  }, {}));

  return (
    <div className="region-workspace">
      <div className="region-stat-grid">
        <div className="region-stat-item tone-blue"><StatCard label="Cases in scope" value={data.cases.length} icon={FileText} /></div>
        <div className="region-stat-item tone-amber"><StatCard label="In progress" value={data.cases.filter((item) => item.status === "In progress").length} icon={Activity} /></div>
        <div className="region-stat-item tone-green"><StatCard label="Returned" value={data.cases.filter((item) => item.status === "Action required").length} icon={AlertTriangle} /></div>
        <div className="region-stat-item tone-red"><StatCard label="Open alerts" value={openAlerts.length} icon={ShieldAlert} /></div>
      </div>

      <Card className="region-table-card" title="Cases by region" description="Counts are based on cases returned by your authorized backend scope.">
        <DataTable data={casesByRegion} columns={columns} emptyText="No regional cases are available in your scope." />
      </Card>

      <Card className="region-stage-card" title="Cases by stage">
        {data.cases.length
          ? <div className="region-stage-list">{stageCounts.map(([stage, count]) => (
              <div className="region-stage-item" key={stage}>
                <div className="region-stage-pill"><Badge variant="info">{stage}</Badge></div>
                <div className="region-stage-copy">
                  <strong>{count}</strong>
                  <small>cases</small>
                </div>
              </div>
            ))}</div>
          : <p className="muted">No case stages are available.</p>}
      </Card>
    </div>
  );
}
