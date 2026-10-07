import Link from "next/link";

export default function Home() {
  return (
    <main>
      <h1>Stagehold</h1>
      <p>
        A payment for one stage of a building is held until that stage is visible in a photo. A panel of independent
        validators, which neither the payer nor the builder chose, reads the photo. If they agree it shows the stage
        and the code written on the work, the builder is paid when the result is final, even if the payer is offline.
      </p>
      <div className="card">
        <h2>Who are you?</h2>
        <p className="muted">One person pays and one builds. Each has their own page.</p>
        <div className="row">
          <Link href="/payer"><button>I am paying</button></Link>
          <Link href="/builder"><button className="secondary">I am building</button></Link>
        </div>
      </div>
      <div className="card">
        <h2>What this does not do</h2>
        <p>
          It cannot prove a photo came from a live camera, who owns the land, what materials were used, or what is
          inside a wall. It releases the next payment without either person owning the decision. This web version is
          play money on a test network until attested capture ships.
        </p>
      </div>
    </main>
  );
}
