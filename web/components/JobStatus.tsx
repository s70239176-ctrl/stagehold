import { EXPLORER_URL, STAGES, stageLabel, when } from "../lib/config.ts";
import { formatGen, sumWei } from "../lib/gen.ts";
import type { Snapshot, StageView } from "../lib/types.ts";
import { Check, Clock, External, Spinner, STAGE_ICON } from "./icons.tsx";
import { CopyButton, Stat, short } from "./ui.tsx";

const STATUS_BADGE: Record<Snapshot["status"], { text: string; cls: string }> = {
  CREATED: { text: "Awaiting funding", cls: "badge" },
  ACTIVE: { text: "Active", cls: "badge badge-ok" },
  DONE: { text: "Completed", cls: "badge badge-ok" },
  CANCELLED: { text: "Cancelled", cls: "badge badge-warn" },
  EXPIRED: { text: "Expired", cls: "badge badge-warn" },
};

export function JobHeader({ contract, snapshot }: { contract: string; snapshot: Snapshot }) {
  const s = STATUS_BADGE[snapshot.status];
  const held = sumWei(Object.values(snapshot.stages).filter((st) => st.status !== "PAID").map((st) => st.funded));
  return (
    <div className="card">
      <div className="card-head">
        <div className="row" style={{ gap: 10 }}>
          <h2>Job</h2>
          <span className={s.cls}>{s.text}</span>
          {snapshot.settling ? <span className="badge badge-warn"><Spinner size={12} /> Payment settling</span> : null}
        </div>
        <div className="row" style={{ gap: 6 }}>
          <CopyButton value={contract} label={short(contract)} />
          <a className="btn btn-ghost btn-sm" href={`${EXPLORER_URL}/address/${contract}`} target="_blank" rel="noreferrer" aria-label="Open in explorer">
            <External size={14} /> Explorer
          </a>
        </div>
      </div>
      <div className="card-body stack">
        <div className="grid-2">
          <Stat k="Held in escrow" v={formatGen(held)} unit="GEN" />
          <Stat k="Attempt fee" v={formatGen(snapshot.fee)} unit="GEN" />
          <Stat k="Builder credits" v={formatGen(snapshot.builder_credits)} unit="GEN" />
          <Stat k="Expires" v={<span style={{ fontSize: "1rem" }}>{when(snapshot.expires_at)}</span>} />
        </div>
        <div className="row">
          {!snapshot.capture_attested ? <span className="badge badge-warn" title="The contract cannot verify that a photograph came from a live camera">Capture not verified</span> : <span className="badge badge-ok">Capture attested</span>}
          {snapshot.dev_mode ? <span className="badge badge-info">Test timing</span> : null}
          <span className="badge">{snapshot.alignment_enforced ? "Site check on" : "Site check off"}</span>
        </div>
      </div>
    </div>
  );
}

function stageSub(st: StageView | undefined): string {
  if (!st) return "Not funded";
  if (st.status === "PAID") return "Paid to the builder";
  if (st.status === "SETTLING") return "Accepted. Payment releases when the result is final";
  const attempts = `${st.attempts} attempt${st.attempts === 1 ? "" : "s"}`;
  if (st.code && st.code_deadline * 1000 > Date.now()) return `Code "${st.code}" valid until ${when(st.code_deadline)} · ${attempts}`;
  if (st.request_at) return `Code requested ${when(st.request_at)} · ${attempts}`;
  return `Waiting for a code · ${attempts}`;
}

export function StageList({ snapshot, onPick, picked }: { snapshot: Snapshot; onPick?: (id: string) => void; picked?: string }) {
  return (
    <div className="card">
      <div className="card-head">
        <h2>Stages</h2>
        <span className="muted small">{Object.keys(snapshot.stages).length} funded</span>
      </div>
      <div>
        {STAGES.map((s) => {
          const st = snapshot.stages[s.id];
          const Icon = STAGE_ICON[s.id]!;
          const cls = st ? st.status.toLowerCase() : "";
          const clickable = !!onPick && !!st && st.status === "OPEN";
          return (
            <div
              className="stage"
              key={s.id}
              style={{ cursor: clickable ? "pointer" : undefined, background: picked === s.id ? "rgba(110,231,183,0.05)" : undefined }}
              onClick={clickable ? () => onPick!(s.id) : undefined}
            >
              <div className={`stage-ico ${cls}`}>{st?.status === "PAID" ? <Check size={18} /> : st?.status === "SETTLING" ? <Clock size={18} /> : <Icon size={18} />}</div>
              <div>
                <div className="stage-name">{stageLabel(s.id)}</div>
                <div className="stage-sub">{stageSub(st)}</div>
              </div>
              <div className="stage-amt">
                {st ? (st.status === "PAID" ? <span className="badge badge-ok">Paid</span> : <>{formatGen(st.funded)} <span className="muted small">GEN</span><small>held</small></>) : <span className="muted small">—</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
