import { Link } from "react-router-dom";
import { Activity, ArrowRight, ClipboardCheck, Clock3, FileText, ShieldCheck } from "lucide-react";

export default function QueueLive({ data }) {
  const cases = Array.isArray(data?.cases) ? data.cases : [];
  const inProgress = cases.filter((item) => item.status === "In progress");
  const returned = cases.filter((item) => item.status === "Action required");
  const institutionHeld = cases.filter((item) => item.holder === "Institution");

  const getStatusClass = (status) => {
    if (status === "In progress") return "queue-status queue-status-info";
    if (status === "Action required") return "queue-status queue-status-warning";
    if (status === "Submitted") return "queue-status queue-status-info";
    if (status === "Approved" || status === "Resolved") return "queue-status queue-status-success";
    return "queue-status queue-status-neutral";
  };

  return <div className="queue-workspace">
    <div className="queue-header-block">
      <p className="queue-eyebrow">OFFICER WORKSPACE</p>
      <h1>My queue</h1>
      <p>Officer-held work, ordered by urgency and service window.</p>
    </div>

    <div className="queue-summary-grid">
      <article className="queue-summary-card queue-summary-blue">
        <div className="queue-summary-icon"><FileText size={18} /></div>
        <div className="queue-summary-copy"><span>Cases in scope</span><strong>{cases.length}</strong></div>
        <span className="queue-summary-arrow"><ArrowRight size={16} /></span>
      </article>
      <article className="queue-summary-card queue-summary-green">
        <div className="queue-summary-icon"><Activity size={18} /></div>
        <div className="queue-summary-copy"><span>In progress</span><strong>{inProgress.length}</strong></div>
        <span className="queue-summary-arrow"><ArrowRight size={16} /></span>
      </article>
      <article className="queue-summary-card queue-summary-amber">
        <div className="queue-summary-icon"><ClipboardCheck size={18} /></div>
        <div className="queue-summary-copy"><span>Returned</span><strong>{returned.length}</strong></div>
        <span className="queue-summary-arrow"><ArrowRight size={16} /></span>
      </article>
      <article className="queue-summary-card queue-summary-purple">
        <div className="queue-summary-icon"><Clock3 size={18} /></div>
        <div className="queue-summary-copy"><span>Institution-held</span><strong>{institutionHeld.length}</strong></div>
        <span className="queue-summary-arrow"><ArrowRight size={16} /></span>
      </article>
    </div>

    <section className="queue-table-card">
      <div className="queue-table-header">
        <div className="queue-table-title-wrap">
          <div className="queue-table-icon"><ShieldCheck size={18} /></div>
          <div>
            <h2>Cases in your authorized scope</h2>
            <p>Queue content is loaded from the authenticated case service.</p>
          </div>
        </div>
      </div>

      {cases.length === 0
        ? <p className="muted">No cases are currently available in your scope.</p>
        : <div className="queue-table-wrap">
            <table className="queue-data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Application / Institution</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {cases.map((item, index) => <tr key={item.caseId || item.id || index}>
                  <td className="queue-index">{index + 1}</td>
                  <td className="queue-application-cell">
                    <div className="queue-case-row">
                      <div className="queue-case-icon"><FileText size={15} /></div>
                      <div className="queue-case-copy">
                        <strong>{item.id}</strong>
                        <span>{item.institution}</span>
                        <small>{item.type} · {item.stage} · {item.holder}</small>
                      </div>
                    </div>
                  </td>
                  <td><span className={getStatusClass(item.status)}>{item.status}</span></td>
                  <td className="queue-action-cell"><Link className="queue-open-button" to={`/case/${item.caseId}`}>Open</Link></td>
                </tr>)}
              </tbody>
            </table>
          </div>}
    </section>
  </div>;
}
