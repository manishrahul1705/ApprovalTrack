import { useEffect, useMemo, useState } from "react";
import { AlertCircle, AlertTriangle, BellRing, Check, CheckCheck, CheckCircle, CircleDashed, Info, RefreshCw, Search, ShieldCheck } from "lucide-react";
import { Badge, Card } from "../components/ui/primitives";
import { caseWorkflowApi } from "../services/caseWorkflow";

const ESCALATION_TYPES = new Set([
  "STAGE_DELAY_ESCALATED",
  "CANCELLATION_PERMISSION_REQUEST",
  "LEASE_EXPIRED",
]);

function severityMeta(level) {
  const normalized = String(level || "INFO").toUpperCase();
  if (normalized === "CRITICAL") {
    return { label: "CRITICAL", mode: "critical", icon: AlertTriangle };
  }
  if (normalized === "WARNING") {
    return { label: "WARNING", mode: "warning", icon: AlertTriangle };
  }
  return { label: "INFO", mode: "info", icon: Info };
}

export default function EscalationsPage() {
  const [escalations, setEscalations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");

  const open = escalations.filter((item) => !item.acknowledged);

  const filteredEscalations = useMemo(() => {
    const query = search.trim().toLowerCase();
    return escalations.filter((item) => {
      const level = String(item.level || "INFO").toUpperCase();
      const status = item.acknowledged ? "Acknowledged" : "Open";
      const matchesSearch = !query || [item.obligation, item.body, item.type, item.caseId || item.case_id || "", item.id].some((value) => String(value || "").toLowerCase().includes(query));
      const matchesSeverity = severityFilter === "All" || level === severityFilter.toUpperCase();
      const matchesStatus = statusFilter === "All" || status === statusFilter;
      return matchesSearch && matchesSeverity && matchesStatus;
    });
  }, [escalations, search, severityFilter, statusFilter]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const alerts = await caseWorkflowApi.listAlerts();
      setEscalations(alerts.filter((item) => ESCALATION_TYPES.has(item.type)).map((item) => ({
        ...item,
        id: item._id,
        obligation: item.title,
        level: item.severity,
        acknowledged: item.status !== "OPEN",
        caseId: item.case_id || item.caseId || item.caseId || "—",
      })));
    } catch (loadError) {
      setError(loadError.message || "Escalations could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function acknowledge(item) {
    setBusyId(item.id);
    setError("");
    try {
      const updated = await caseWorkflowApi.updateAlertStatus(item.id, "ACKNOWLEDGED");
      setEscalations((current) => current.map((alert) => alert.id === item.id
        ? { ...alert, ...updated, acknowledged: true }
        : alert));
    } catch (updateError) {
      setError(updateError.message || "The escalation could not be acknowledged.");
    } finally {
      setBusyId("");
    }
  }

  return <div className="escalations-page">
    <div className="escalations-header">
      <div className="escalations-header-copy">
        <p className="eyebrow">REGIONAL OVERSIGHT</p>
        <h1>Escalation Management</h1>
        <p>Monitor critical alerts, review pending escalations and acknowledge important institutional issues.</p>
      </div>
      <div className="escalations-header-actions">
        <button className="button button-secondary escalations-refresh-button" type="button" disabled={loading} onClick={load}><RefreshCw size={15} /> Refresh</button>
      </div>
    </div>

    <div className="escalation-stat-grid">
      <div className="escalation-stat-card escalation-stat-warning">
        <div className="escalation-stat-icon"><AlertTriangle size={20} /></div>
        <div className="escalation-stat-content">
          <div className="escalation-stat-label">Total Escalations</div>
          <div className="escalation-stat-value">{escalations.length}</div>
          <div className="escalation-stat-note">All escalation records assigned to your account</div>
        </div>
      </div>
      <div className="escalation-stat-card escalation-stat-danger">
        <div className="escalation-stat-icon"><BellRing size={20} /></div>
        <div className="escalation-stat-content">
          <div className="escalation-stat-label">Open Escalations</div>
          <div className="escalation-stat-value">{open.length}</div>
          <div className="escalation-stat-note">Escalations pending acknowledgement</div>
        </div>
      </div>
    </div>

    <Card className="escalations-card" title="Escalations Assigned to You" description="Review alerts assigned to your authenticated account. Acknowledging an alert does not decide or resolve the underlying case.">
      <div className="escalations-toolbar">
        <label className="escalations-search">
          <Search size={15} />
          <input type="text" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search escalations (e.g., case ID, title, description…)" aria-label="Search escalations" />
        </label>
        <div className="escalations-filters">
          <label className="escalations-filter-group">
            <span>Severity:</span>
            <select value={severityFilter} onChange={(event) => setSeverityFilter(event.target.value)} aria-label="Filter by severity">
              <option>All</option>
              <option>Critical</option>
              <option>Warning</option>
              <option>Info</option>
            </select>
          </label>
          <label className="escalations-filter-group">
            <span>Status:</span>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter by status">
              <option>All</option>
              <option>Open</option>
              <option>Acknowledged</option>
            </select>
          </label>
        </div>
        <div className="escalation-record-total">{filteredEscalations.length} records</div>
      </div>

      {error && <div className="note warning-note" role="alert">{error}</div>}

      {loading ? (
        <div className="loading-state" aria-label="Loading escalations"><i /><i /><i /></div>
      ) : escalations.length === 0 ? (
        <div className="escalation-empty-state">
          <div className="escalation-empty-icon"><ShieldCheck size={30} /></div>
          <h3>All Clear!</h3>
          <p>There are currently no escalation records assigned to your account.</p>
        </div>
      ) : filteredEscalations.length === 0 ? (
        <div className="escalation-empty-state compact-empty">
          <div className="escalation-empty-icon"><CircleDashed size={26} /></div>
          <h3>No escalations match your filters.</h3>
        </div>
      ) : (
        <div className="escalation-list">
          {filteredEscalations.map((item) => {
            const meta = severityMeta(item.level);
            const statusText = item.acknowledged ? "Acknowledged" : "Open";
            const Icon = meta.icon;
            return <article className={`escalation-item escalation-${meta.mode}`} key={item.id}>
              <div className="escalation-item-left">
                <div className="escalation-severity-icon"><Icon size={20} /></div>
                <div className="escalation-badge-wrap"><Badge variant={meta.mode === "critical" ? "danger" : meta.mode === "warning" ? "warning" : "info"}>{meta.label}</Badge></div>
              </div>

              <div className="escalation-item-main">
                <h3>{item.obligation}</h3>
                <p>{item.body}</p>
                <div className="escalation-meta-row">
                  <span className="escalation-meta-pill"><CheckCircle size={14} /> {item.caseId || item.case_id || "Case ID unavailable"}</span>
                  <span className="escalation-meta-pill"><AlertCircle size={14} /> {String(item.type || "Alert").replaceAll("_", " ")}</span>
                  <span className={`escalation-status-pill ${item.acknowledged ? "status-acknowledged" : "status-open"}`}>
                    {item.acknowledged ? <CheckCheck size={14} /> : <AlertCircle size={14} />}
                    {statusText}
                  </span>
                </div>
              </div>

              <div className="escalation-item-actions">
                {item.acknowledged ? (
                  <span className="escalation-acknowledged-badge"><Check size={14} /> Acknowledged</span>
                ) : (
                  <button type="button" className="button button-secondary escalation-ack-button" disabled={busyId === item.id} onClick={() => acknowledge(item)}>
                    {busyId === item.id ? "Saving…" : "Acknowledge"}
                  </button>
                )}
              </div>
            </article>;
          })}
        </div>
      )}
    </Card>
  </div>;
}
