import { ArrowUpRight, BarChart3, Building2, Download, FileText, TrendingUp, Users } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge, Card, DataTable, StatCard } from "../components/ui/primitives";

function monthLabel(value) {
  const month = Number(value.month);
  const date = new Date(Number(value.year), month - 1, 1);
  return Number.isNaN(date.getTime()) ? `${value.year}-${value.month}` : date.toLocaleString(undefined, { month: "short", year: "numeric" });
}

export default function ReportsLive({ data }) {
  const analytics = data?.analytics;
  const monthlyRows = (analytics?.applicationVolume || []).map((item) => ({
    month: monthLabel(item._id),
    applications: item.count,
  }));
  const columns = [
    { accessorKey: "month", header: "Month" },
    { accessorKey: "applications", header: "Applications" },
  ];

  if (!analytics) {
    return <Card title="Reports"><p className="muted">Analytics are not available for this account.</p></Card>;
  }

  const totalApplications = monthlyRows.reduce((sum, row) => sum + Number(row.applications || 0), 0);
  const peakMonth = monthlyRows.reduce((top, row) => {
    if (!top || Number(row.applications || 0) > Number(top.applications || 0)) return row;
    return top;
  }, null) || { month: "—", applications: 0 };

  return (
    <div className="reports-workspace">
      <div className="stat-grid reports-stat-grid">
        <div className="reports-stat-item reports-stat-blue">
          <StatCard label="Institutions" value={analytics.institutions} icon={Building2} />
        </div>
        <div className="reports-stat-item reports-stat-amber">
          <StatCard label="Active students" value={analytics.activeStudents} icon={Users} />
        </div>
        <div className="reports-stat-item reports-stat-green">
          <StatCard label="Active faculty" value={analytics.activeFaculty} icon={Users} />
        </div>
        <div className="reports-stat-item reports-stat-violet">
          <StatCard label="Application periods" value={monthlyRows.length} icon={BarChart3} />
        </div>
      </div>

      <div className="reports-grid">
        <Card className="reports-card reports-volume-card" title="Application Volume" description="Monthly application submissions based on analytics data.">
          <div className="report-summary-row">
            <div className="report-summary-item">
              <span>Total Applications</span>
              <strong>{totalApplications}</strong>
            </div>
            <div className="report-summary-item">
              <span>Peak Month</span>
              <strong>{peakMonth.month}</strong>
            </div>
            <div className="report-summary-item">
              <span>Reporting Span</span>
              <strong>{monthlyRows.length ? `${monthlyRows.length} months` : "Current period"}</strong>
            </div>
          </div>

          {monthlyRows.length > 0 && (
            <div className="reports-chart-wrap">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={monthlyRows} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="#dfeaf5" vertical={false} strokeDasharray="4 4" />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: "#64748B", fontSize: 11 }} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: "#64748B", fontSize: 11 }} />
                  <Tooltip cursor={{ fill: "rgba(30, 64, 175, 0.04)" }} contentStyle={{ borderRadius: 10, border: "1px solid #dfeaf5", fontSize: 12 }} />
                  <Bar dataKey="applications" fill="#2E7FD9" radius={[8, 8, 0, 0]} maxBarSize={32} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="reports-table-tools">
            <label className="reports-search-field"><span className="search-icon"><TrendingUp size={14} /></span><input type="text" placeholder="Search records…" aria-label="Search records" /></label>
            <div className="reports-toolbar-right">
              <button className="button button-secondary button-small" type="button"><Download size={14} /> Export CSV</button>
              <label className="density-select"><span>Density</span><select aria-label="Table density"><option>Comfortable</option><option>Compact</option></select></label>
            </div>
          </div>

          <DataTable data={monthlyRows} columns={columns} emptyText="No application volume has been recorded for the current period." />
        </Card>

        <Card className="reports-card reports-side-card" title="Report Exports" description="Access and download generated analytical reports.">
          <div className="report-export-state">
            <div className="report-export-icon"><Download size={24} /></div>
            <h3>No saved report exports</h3>
            <p>Analytics are refreshed from the backend, but no generated report files are currently stored for download.</p>
            <Badge variant="neutral">No saved report exports</Badge>
          </div>
        </Card>
      </div>
    </div>
  );
}
