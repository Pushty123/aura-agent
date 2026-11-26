/** About / Privacy: explains in plain words how AURA protects your data. */
export function About() {
  return (
    <section>
      <h2>About and privacy</h2>

      <div className="card">
        <h3>Your data is encrypted on your device</h3>
        <p>
          Everything AURA stores is locked with your passphrase. Only you hold the key.
          If you forget it, nobody can recover it, and that is what keeps your data private.
        </p>
      </div>

      <div className="card">
        <h3>You choose what AURA uses</h3>
        <p>
          Each data source (sleep, steps, screen time, food, mood) has its own switch.
          Turn one off and AURA stops using it.
        </p>
      </div>

      <div className="card">
        <h3>You can see what leaves your device</h3>
        <p>
          AURA shows you every network request it makes, so nothing is sent without
          you being able to see it.
        </p>
      </div>

      <div className="card">
        <h3>Delete everything</h3>
        <p>
          You can wipe all your AURA data from this device at any time. This cannot be undone.
        </p>
      </div>

      <div className="card">
        <h3>Optional backup</h3>
        <p>
          If you choose to back up, the backup server only receives encrypted data.
          It cannot read it. AURA works fine without the backup.
        </p>
      </div>

      <div className="card">
        <h3>Demo data</h3>
        <p>
          Sample data used to show how AURA works is always labelled DEMO.
          It is never your real data.
        </p>
      </div>

      <div className="card">
        <h3>Good to know</h3>
        <p className="muted small">
          AURA is a wellness tool, not medical advice. Calorie values are approximate.
          Insights are patterns in your own data, not diagnoses.
        </p>
      </div>
    </section>
  );
}