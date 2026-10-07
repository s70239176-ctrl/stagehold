import { stageLabel } from "../lib/config.ts";
import type { Snapshot } from "../lib/types.ts";

const when = (unix: number): string => new Date(unix * 1000).toLocaleString();

export function JobStatus({ snapshot }: { snapshot: Snapshot }) {
  const stages = Object.entries(snapshot.stages);
  return (
    <div className="card">
      <h2>Job status</h2>
      <p>
        <span className="pill">{snapshot.status}</span>{" "}
        {snapshot.settling ? <span className="pill">payment settling</span> : null}{" "}
        {!snapshot.capture_attested ? <span className="pill no">capture not authenticated</span> : null}{" "}
        {snapshot.dev_mode ? <span className="pill no">test job: short windows</span> : null}
      </p>
      <p className="muted">
        Expires {when(snapshot.expires_at)}. Attempt fee {snapshot.fee} (burned). Builder credits {snapshot.builder_credits}.
        Site alignment {snapshot.alignment_enforced ? "enforced" : "not enforced yet"}.
      </p>
      {stages.length === 0 ? <p className="muted">No stages funded yet.</p> : null}
      {stages.map(([id, st]) => (
        <div className="stage" key={id}>
          <div>
            <strong>{stageLabel(id)}</strong>
            <div className="muted">
              {st.status} · {st.attempts} attempt{st.attempts === 1 ? "" : "s"}
              {st.code ? ` · code "${st.code}" until ${when(st.code_deadline)}` : ""}
              {st.request_at ? ` · code requested ${when(st.request_at)}` : ""}
            </div>
          </div>
          <div>{st.status === "PAID" ? "paid" : `${st.funded} held`}</div>
        </div>
      ))}
    </div>
  );
}
