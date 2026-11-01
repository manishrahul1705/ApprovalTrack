import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowRight, CalendarClock, ClipboardCheck, RefreshCw, ShieldCheck, Sparkles } from "lucide-react";
import { Badge, Card, DataTable } from "../components/ui/primitives";
import { useAppStore } from "../store/useAppStore";
import { caseWorkflowApi } from "../services/caseWorkflow";

const ACTIVE_FINAL_STATUSES = new Set(["ACTIVE", "ACTIVE_UNFROZEN", "FROZEN_WAITING_FOR_ASSIST"]);
const applicationTypeLabels = {
  new_institution: "New institution",
  new_course: "New course",
  increase_in_intake: "Increase in intake",
  extension_of_approval: "Extension of approval",
  conversion_diploma_to_degree: "Conversion of diploma to degree",
  collaboration_twinning: "Collaboration or twinning programme",
  restoration_of_intake: "Restoration of intake",
};

function isAssignedToBureauOfficer(stage, user) {
  const assignedUserId = stage?.assignedUserId;
  const userId = user?.id || user?._id;
  return !assignedUserId || String(assignedUserId) === String(userId);
}

function approvalRows(records, user) {
  return records.flatMap((record) => {
    const stage = record.allocatedStages?.[record.currentStageIndex];
    if (
      !stage
      || stage.key !== "final_approval"
      || !ACTIVE_FINAL_STATUSES.has(stage.status)
      || stage.assignedRole !== "BUREAU_OFFICER"
      || !isAssignedToBureauOfficer(stage, user)
    ) return [];

    return [{
      caseId: record._id,
      caseNo: record.caseNo,
      institution: record.institutionId?.name || "Institution",
      applicationType: applicationTypeLabels[record.applicationType] || record.applicationType,
      stageStatus: stage.status,
      dueAt: stage.stageDueAt,
      updatedAt: record.updatedAt,
    }];
  });
}

function formatDate(value) {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not set";
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export default function BureauApprovalQueuePage() {
  const user = useAppStore((state) => state.user);
  const [approvals, setApprovals] = useState(null);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    async function loadApprovals() {
      try {
        const records = [];
        for (let page = 1; ; page += 1) {
          const batch = await caseWorkflowApi.listCases({ page, pageSize: 100 });
          if (!Array.isArray(batch)) throw new Error("The approval queue returned an invalid response.");
          records.push(...batch);
          if (batch.length < 100) break;
        }
        if (active) setApprovals(approvalRows(records, user));
      } catch (loadError) {
        if (active) setError(loadError.message || "Could not load final approvals.");
      }
    }
    loadApprovals();
    return () => { active = false; };
  }, [reloadKey, user]);

  const summary = useMemo(() => {
    if (!approvals) return { total: 0, dueSoon: 0, frozen: 0 };
    const total = approvals.length;
    const dueSoon = approvals.filter((item) => item.dueAt && new Date(item.dueAt).getTime() - Date.now() < 1000 * 60 * 60 * 24 * 7).length;
    const frozen = approvals.filter((item) => item.stageStatus === "FROZEN_WAITING_FOR_ASSIST").length;
    return { total, dueSoon, frozen };
  }, [approvals]);

  const columns = useMemo(() => [
    {
      accessorKey: "caseNo",
      header: "Application",
      cell: ({ row }) => <Link className="mono text-link" to={`/case/${row.original.caseId}`}>{row.original.caseNo}</Link>,
    },
    { accessorKey: "institution", header: "Institution" },
    { accessorKey: "applicationType", header: "Application type" },
    {
      accessorKey: "stageStatus",
      header: "Stage status",
      cell: ({ row }) => <Badge variant={row.original.stageStatus === "FROZEN_WAITING_FOR_ASSIST" ? "warning" : "info"}>
        {row.original.stageStatus === "FROZEN_WAITING_FOR_ASSIST" ? "Frozen for assistance" : "Awaiting final approval"}
      </Badge>,
    },
    {
      accessorKey: "dueAt",
      header: "Due date",
      cell: ({ getValue }) => formatDate(getValue()),
    },
  ], []);

  if (approvals === null) {
    return <div className="bureau-approval-page shell-only">
      <style>{`
        .bureau-approval-page { width: 100%; min-width: 0; display: grid; gap: 18px; }
        .bureau-approval-page * { box-sizing: border-box; }
        .bureau-approval-page .page-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; flex-wrap: wrap; padding: 8px 0 2px; }
        .bureau-approval-page .eyebrow-label { margin: 0 0 8px; color: #6b7a8d; font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; }
        .bureau-approval-page .page-title { margin: 0; color: #101a33; font-size: clamp(2rem, 2.4vw, 2.8rem); line-height: 1.12; letter-spacing: -0.06em; }
        .bureau-approval-page .subtitle { margin: 10px 0 0; color: #5f6f85; font-size: 0.98rem; line-height: 1.6; max-width: 760px; }
        .bureau-approval-page .page-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .bureau-approval-page .page-button { display: inline-flex; align-items: center; gap: 8px; border: 1px solid #dfe7f2; background: white; color: #17233d; border-radius: 10px; padding: 9px 14px; font-weight: 600; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.03); }
        .bureau-approval-page .page-button.primary { background: #eef4ff; border-color: #d2e3ff; color: #1d5ecb; }
        .bureau-approval-page .summary-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
        .bureau-approval-page .summary-card { position: relative; display: flex; align-items: center; justify-content: space-between; min-height: 110px; padding: 18px 18px 14px; border-radius: 16px; border: 1px solid #e6edf8; background: white; box-shadow: 0 8px 18px rgba(16, 26, 53, 0.04); overflow: hidden; }
        .bureau-approval-page .summary-card.blue { background: linear-gradient(180deg, #f7fbff 0%, #eef6ff 100%); border-color: #d6e8ff; }
        .bureau-approval-page .summary-card.amber { background: linear-gradient(180deg, #fffaf2 0%, #fff4df 100%); border-color: #f4d8a1; }
        .bureau-approval-page .summary-card.green { background: linear-gradient(180deg, #f2fff9 0%, #eafaf3 100%); border-color: #cfeee0; }
        .bureau-approval-page .summary-card .summary-left { display: flex; align-items: center; gap: 14px; min-width: 0; }
        .bureau-approval-page .summary-card .summary-icon { display: grid; place-items: center; width: 44px; height: 44px; border-radius: 12px; flex-shrink: 0; }
        .bureau-approval-page .summary-card.blue .summary-icon { background: rgba(37, 99, 235, 0.1); color: #1d63d2; }
        .bureau-approval-page .summary-card.amber .summary-icon { background: rgba(245, 158, 11, 0.12); color: #b56a06; }
        .bureau-approval-page .summary-card.green .summary-icon { background: rgba(16, 185, 129, 0.12); color: #0d8f63; }
        .bureau-approval-page .summary-card .summary-label { margin: 0; color: #52657c; font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; }
        .bureau-approval-page .summary-card .summary-value { display: block; margin-top: 8px; color: #101a33; font-size: clamp(2rem, 2vw, 2.4rem); line-height: 1; font-weight: 800; letter-spacing: -0.06em; }
        .bureau-approval-page .summary-card .summary-copy { margin: 10px 0 0; color: #465a75; font-size: 0.92rem; }
        .bureau-approval-page .summary-card .summary-arrow { display: grid; place-items: center; width: 30px; height: 30px; border-radius: 9px; color: #1d63d2; background: rgba(255,255,255,0.5); border: 1px solid rgba(46, 82, 134, 0.09); }
        .bureau-approval-page .data-shell { border: 1px solid #e6edf8; border-radius: 18px; background: #ffffff; box-shadow: 0 10px 26px rgba(15, 23, 42, 0.04); overflow: hidden; }
        .bureau-approval-page .data-shell .card { border: none; box-shadow: none; margin: 0; }
        .bureau-approval-page .table-shell { padding: 0; }
        .bureau-approval-page .table-tools { display: flex; align-items: center; gap: 14px; padding: 16px 18px 12px; border-bottom: 1px solid #e6edf8; background: #f9fbff; }
        .bureau-approval-page .input-search { display: flex; align-items: center; gap: 8px; min-width: 0; flex: 1; max-width: 420px; background: white; border: 1px solid #dfe7f2; border-radius: 10px; padding: 0 12px; color: #72849a; }
        .bureau-approval-page .input-search input { flex: 1; border: none; background: transparent; min-height: 42px; font-size: 0.96rem; color: #1e2c3f; }
        .bureau-approval-page .tool-actions { display: flex; align-items: center; gap: 10px; margin-left: auto; }
        .bureau-approval-page .button.button-secondary { background: white; border: 1px solid #dfe7f2; border-radius: 10px; color: #1f2d3f; padding: 8px 12px; font-weight: 600; }
        .bureau-approval-page .density-select { display: inline-flex; align-items: center; gap: 8px; background: white; border: 1px solid #dfe7f2; border-radius: 10px; padding: 8px 10px; color: #1f2d3f; }
        .bureau-approval-page .density-select select { border: none; background: transparent; color: inherit; }
        .bureau-approval-page .table-wrap { overflow: auto; }
        .bureau-approval-page .data-table { width: 100%; min-width: 760px; border-collapse: separate; border-spacing: 0; }
        .bureau-approval-page .data-table thead th { background: #edf4ff; color: #2b476d; font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; font-weight: 800; text-align: left; padding: 14px 16px; border-bottom: 1px solid #e6edf8; }
        .bureau-approval-page .data-table tbody td { padding: 14px 16px; color: #22324a; border-bottom: 1px solid #edf1f6; background: #fff; }
        .bureau-approval-page .data-table tbody tr:hover td { background: #f9fbff; }
        .bureau-approval-page .table-pagination { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 16px 14px; background: #fff; color: #66798d; }
        .bureau-approval-page .table-pagination .button { padding: 8px 12px; }
        .bureau-approval-page .badge { display: inline-flex; align-items: center; gap: 6px; min-height: 28px; padding: 5px 10px; border-radius: 999px; font-size: 11px; font-weight: 700; }
        .bureau-approval-page .queue-empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 28px 16px 24px; color: #3f5067; }
        .bureau-approval-page .queue-empty-state .empty-icon { width: 52px; height: 52px; border-radius: 14px; display: grid; place-items: center; color: #1d63d2; background: #edf5ff; border: 1px solid #d7ebff; }
        .bureau-approval-page .queue-empty-title { color: #101a33; font-size: 1.35rem; font-weight: 700; }
        .bureau-approval-page .queue-empty-copy { max-width: 560px; text-align: center; color: #5f6f85; line-height: 1.5; }
        @media (max-width: 860px) { .bureau-approval-page .summary-grid { grid-template-columns: 1fr; } }
        @media (max-width: 640px) { .bureau-approval-page .page-header { flex-direction: column; } .bureau-approval-page .page-actions { width: 100%; justify-content: flex-start; } .bureau-approval-page .page-button { flex: 1; justify-content: center; } }
      `}</style>
      <header className="page-header">
        <div>
          <p className="eyebrow-label">Bureau Officer Workspace</p>
          <h1 className="page-title">Bureau Officer Final Approval Queue</h1>
          <p className="subtitle">Applications appear here after all earlier allocated stages have been approved and the final stage is assigned to your Bureau Officer account.</p>
        </div>
        <div className="page-actions">
          <button className="page-button primary" onClick={() => { setError(""); setApprovals(null); setReloadKey((key) => key + 1); }}><RefreshCw size={15} /> Refresh</button>
          <button className="page-button" onClick={() => document.querySelector(".input-search input")?.focus()}><ArrowRight size={15} /> Review queue</button>
        </div>
      </header>

      <div className="summary-grid">
        <div className="summary-card blue">
          <div className="summary-left">
            <span className="summary-icon"><ShieldCheck size={18} /></span>
            <div>
              <p className="summary-label">Pending</p>
              <strong className="summary-value">--</strong>
              <p className="summary-copy">Awaiting final approval</p>
            </div>
          </div>
          <span className="summary-arrow"><ArrowRight size={16} /></span>
        </div>
        <div className="summary-card amber">
          <div className="summary-left">
            <span className="summary-icon"><CalendarClock size={18} /></span>
            <div>
              <p className="summary-label">Due soon</p>
              <strong className="summary-value">--</strong>
              <p className="summary-copy">Within the next 7 days</p>
            </div>
          </div>
          <span className="summary-arrow"><ArrowRight size={16} /></span>
        </div>
        <div className="summary-card green">
          <div className="summary-left">
            <span className="summary-icon"><Sparkles size={18} /></span>
            <div>
              <p className="summary-label">Frozen</p>
              <strong className="summary-value">--</strong>
              <p className="summary-copy">Awaiting assistance</p>
            </div>
          </div>
          <span className="summary-arrow"><ArrowRight size={16} /></span>
        </div>
      </div>

      <div className="data-shell">
        <Card title="Bureau Officer final approval queue" description="Applications appear here after all earlier allocated stages have been approved and the final stage is assigned to your Bureau Officer account.">
          <div className="loading-state" aria-label="Loading final approvals"><i /><i /><i /></div>
        </Card>
      </div>
    </div>;
  }

  return <div className="bureau-approval-page">
    <style>{`
      .bureau-approval-page { width: 100%; min-width: 0; display: grid; gap: 18px; }
      .bureau-approval-page * { box-sizing: border-box; }
      .bureau-approval-page .page-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; flex-wrap: wrap; padding: 8px 0 2px; }
      .bureau-approval-page .eyebrow-label { margin: 0 0 8px; color: #6b7a8d; font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; }
      .bureau-approval-page .page-title { margin: 0; color: #101a33; font-size: clamp(2rem, 2.4vw, 2.8rem); line-height: 1.12; letter-spacing: -0.06em; }
      .bureau-approval-page .subtitle { margin: 10px 0 0; color: #5f6f85; font-size: 0.98rem; line-height: 1.6; max-width: 760px; }
      .bureau-approval-page .page-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
      .bureau-approval-page .page-button { display: inline-flex; align-items: center; gap: 8px; border: 1px solid #dfe7f2; background: white; color: #17233d; border-radius: 10px; padding: 9px 14px; font-weight: 600; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.03); }
      .bureau-approval-page .page-button.primary { background: #eef4ff; border-color: #d2e3ff; color: #1d5ecb; }
      .bureau-approval-page .summary-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
      .bureau-approval-page .summary-card { position: relative; display: flex; align-items: center; justify-content: space-between; min-height: 110px; padding: 18px 18px 14px; border-radius: 16px; border: 1px solid #e6edf8; background: white; box-shadow: 0 8px 18px rgba(16, 26, 53, 0.04); overflow: hidden; }
      .bureau-approval-page .summary-card.blue { background: linear-gradient(180deg, #f7fbff 0%, #eef6ff 100%); border-color: #d6e8ff; }
      .bureau-approval-page .summary-card.amber { background: linear-gradient(180deg, #fffaf2 0%, #fff4df 100%); border-color: #f4d8a1; }
      .bureau-approval-page .summary-card.green { background: linear-gradient(180deg, #f2fff9 0%, #eafaf3 100%); border-color: #cfeee0; }
      .bureau-approval-page .summary-card .summary-left { display: flex; align-items: center; gap: 14px; min-width: 0; }
      .bureau-approval-page .summary-card .summary-icon { display: grid; place-items: center; width: 44px; height: 44px; border-radius: 12px; flex-shrink: 0; }
      .bureau-approval-page .summary-card.blue .summary-icon { background: rgba(37, 99, 235, 0.1); color: #1d63d2; }
      .bureau-approval-page .summary-card.amber .summary-icon { background: rgba(245, 158, 11, 0.12); color: #b56a06; }
      .bureau-approval-page .summary-card.green .summary-icon { background: rgba(16, 185, 129, 0.12); color: #0d8f63; }
      .bureau-approval-page .summary-card .summary-label { margin: 0; color: #52657c; font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; }
      .bureau-approval-page .summary-card .summary-value { display: block; margin-top: 8px; color: #101a33; font-size: clamp(2rem, 2vw, 2.4rem); line-height: 1; font-weight: 800; letter-spacing: -0.06em; }
      .bureau-approval-page .summary-card .summary-copy { margin: 10px 0 0; color: #465a75; font-size: 0.92rem; }
      .bureau-approval-page .summary-card .summary-arrow { display: grid; place-items: center; width: 30px; height: 30px; border-radius: 9px; color: #1d63d2; background: rgba(255,255,255,0.5); border: 1px solid rgba(46, 82, 134, 0.09); }
      .bureau-approval-page .data-shell { border: 1px solid #e6edf8; border-radius: 18px; background: #ffffff; box-shadow: 0 10px 26px rgba(15, 23, 42, 0.04); overflow: hidden; }
      .bureau-approval-page .data-shell .card { border: none; box-shadow: none; margin: 0; }
      .bureau-approval-page .table-shell { padding: 0; }
      .bureau-approval-page .table-tools { display: flex; align-items: center; gap: 14px; padding: 16px 18px 12px; border-bottom: 1px solid #e6edf8; background: #f9fbff; }
      .bureau-approval-page .input-search { display: flex; align-items: center; gap: 8px; min-width: 0; flex: 1; max-width: 420px; background: white; border: 1px solid #dfe7f2; border-radius: 10px; padding: 0 12px; color: #72849a; }
      .bureau-approval-page .input-search input { flex: 1; border: none; background: transparent; min-height: 42px; font-size: 0.96rem; color: #1e2c3f; }
      .bureau-approval-page .tool-actions { display: flex; align-items: center; gap: 10px; margin-left: auto; }
      .bureau-approval-page .button.button-secondary { background: white; border: 1px solid #dfe7f2; border-radius: 10px; color: #1f2d3f; padding: 8px 12px; font-weight: 600; }
      .bureau-approval-page .density-select { display: inline-flex; align-items: center; gap: 8px; background: white; border: 1px solid #dfe7f2; border-radius: 10px; padding: 8px 10px; color: #1f2d3f; }
      .bureau-approval-page .density-select select { border: none; background: transparent; color: inherit; }
      .bureau-approval-page .table-wrap { overflow: auto; }
      .bureau-approval-page .data-table { width: 100%; min-width: 760px; border-collapse: separate; border-spacing: 0; }
      .bureau-approval-page .data-table thead th { background: #edf4ff; color: #2b476d; font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; font-weight: 800; text-align: left; padding: 14px 16px; border-bottom: 1px solid #e6edf8; }
      .bureau-approval-page .data-table tbody td { padding: 14px 16px; color: #22324a; border-bottom: 1px solid #edf1f6; background: #fff; }
      .bureau-approval-page .data-table tbody tr:hover td { background: #f9fbff; }
      .bureau-approval-page .table-pagination { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 16px 14px; background: #fff; color: #66798d; }
      .bureau-approval-page .table-pagination .button { padding: 8px 12px; }
      .bureau-approval-page .badge { display: inline-flex; align-items: center; gap: 6px; min-height: 28px; padding: 5px 10px; border-radius: 999px; font-size: 11px; font-weight: 700; }
      .bureau-approval-page .queue-empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 28px 16px 24px; color: #3f5067; }
      .bureau-approval-page .queue-empty-state .empty-icon { width: 52px; height: 52px; border-radius: 14px; display: grid; place-items: center; color: #1d63d2; background: #edf5ff; border: 1px solid #d7ebff; }
      .bureau-approval-page .queue-empty-title { color: #101a33; font-size: 1.35rem; font-weight: 700; }
      .bureau-approval-page .queue-empty-copy { max-width: 560px; text-align: center; color: #5f6f85; line-height: 1.5; }
      @media (max-width: 860px) { .bureau-approval-page .summary-grid { grid-template-columns: 1fr; } }
      @media (max-width: 640px) { .bureau-approval-page .page-header { flex-direction: column; } .bureau-approval-page .page-actions { width: 100%; justify-content: flex-start; } .bureau-approval-page .page-button { flex: 1; justify-content: center; } }
    `}</style>

    <header className="page-header">
      <div>
        <p className="eyebrow-label">Bureau Officer Workspace</p>
        <h1 className="page-title">Bureau Officer Final Approval Queue</h1>
        <p className="subtitle">Applications appear here after all earlier allocated stages have been approved and the final stage is assigned to your Bureau Officer account.</p>
      </div>
      <div className="page-actions">
        <button className="page-button primary" onClick={() => setReloadKey((key) => key + 1)}><RefreshCw size={15} /> Refresh</button>
        <button className="page-button" onClick={() => document.querySelector(".input-search input")?.focus()}><ArrowRight size={15} /> Review queue</button>
      </div>
    </header>

    <div className="summary-grid">
      <div className="summary-card blue">
        <div className="summary-left">
          <span className="summary-icon"><ShieldCheck size={18} /></span>
          <div>
            <p className="summary-label">Pending</p>
            <strong className="summary-value">{summary.total}</strong>
            <p className="summary-copy">Awaiting final approval</p>
          </div>
        </div>
        <span className="summary-arrow"><ArrowRight size={16} /></span>
      </div>
      <div className="summary-card amber">
        <div className="summary-left">
          <span className="summary-icon"><CalendarClock size={18} /></span>
          <div>
            <p className="summary-label">Due soon</p>
            <strong className="summary-value">{summary.dueSoon}</strong>
            <p className="summary-copy">Within the next 7 days</p>
          </div>
        </div>
        <span className="summary-arrow"><ArrowRight size={16} /></span>
      </div>
      <div className="summary-card green">
        <div className="summary-left">
          <span className="summary-icon"><Sparkles size={18} /></span>
          <div>
            <p className="summary-label">Frozen</p>
            <strong className="summary-value">{summary.frozen}</strong>
            <p className="summary-copy">Awaiting assistance</p>
          </div>
        </div>
        <span className="summary-arrow"><ArrowRight size={16} /></span>
      </div>
    </div>

    <div className="data-shell">
      <Card title="Bureau Officer final approval queue" description="Applications appear here after all earlier allocated stages have been approved and the final stage is assigned to your Bureau Officer account.">
        <DataTable
          data={approvals}
          columns={columns}
          emptyText={
            <div className="queue-empty-state">
              <div className="empty-icon"><ClipboardCheck size={24} /></div>
              <div className="queue-empty-title">No applications awaiting approval.</div>
              <div className="queue-empty-copy">All applications assigned to your Bureau Officer account will appear here once they complete the previous review stages.</div>
            </div>
          }
        />
      </Card>
    </div>
  </div>;
}
