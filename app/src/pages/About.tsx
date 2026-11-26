export function About() {
  return (
    <section className="stack-lg">
      <div className="card stack-sm">
        <h2>About AURA &amp; Privacy</h2>
        <p className="small muted">
          AURA turns your daily patterns (sleep, movement, screen time, food, and mood) into
          plain-language insights backed by transparent statistics—without sending your readable
          health data to third-party servers.
        </p>
      </div>

      <div className="grid-2">
        <article className="card stack-sm">
          <h3>Encrypted on your device</h3>
          <p className="small muted">
            All day records, food logs, goals, and settings are encrypted locally using a key
            derived from your passphrase before being saved to IndexedDB. Only consent flags and the
            tamper-evident audit log are stored unencrypted, and neither contains health values.
          </p>
        </article>

        <article className="card stack-sm">
          <h3>You control every data source</h3>
          <p className="small muted">
            In <strong>My Data</strong>, you decide which sources are enabled (Phone data, Check-ins,
            CSV imports, or Demo data). Switching off a non-manual source removes its stored day
            records from your vault.
          </p>
        </article>

        <article className="card stack-sm">
          <h3>Optional encrypted backup</h3>
          <p className="small muted">
            AURA works completely without a backup server. If you choose to press{' '}
            <strong>Back up encrypted copy to relay</strong>, the server receives only encrypted
            ciphertext blobs and your salt—never your passphrase, key, or readable health records.
          </p>
        </article>

        <article className="card stack-sm">
          <h3>Network ledger &amp; audit log</h3>
          <p className="small muted">
            Every outgoing network request made by AURA&apos;s own code is counted in{' '}
            <strong>What left this device</strong>. Vault actions (creation, unlocks, exports,
            consent changes, and backups) are recorded in a SHA-256 hash-chained audit log.
          </p>
        </article>
      </div>

      <div className="card stack-sm">
        <h3>Delete everything &amp; honest limits</h3>
        <p className="small muted">
          You can export your data as JSON or use <strong>Delete everything</strong> in My Data to
          permanently wipe your encryption salt and all stored rows on this device.
        </p>
        <p className="xs muted">
          AURA is a personal wellness tool, not medical advice. Food calorie and protein values are
          approximate. Demo data is always labelled <code>DEMO</code>.
        </p>
      </div>
    </section>
  );
}
