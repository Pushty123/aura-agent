export function About({ onReplayIntro }: { onReplayIntro?: () => void } = {}) {
  return (
    <section className="stack-lg">
      <div className="card stack-sm">
        <h2>About AURA</h2>
        <p className="small muted">
          AURA turns your daily patterns (sleep, movement, screen time, food, and mood) into
          plain-language insights backed by transparent statistics—without sending your readable
          health data to third-party servers by default.
        </p>
        {onReplayIntro && (
          <button type="button" className="btn" onClick={onReplayIntro}>Watch the intro again</button>
        )}
      </div>

      <div className="grid-2">
        <article className="card stack-sm">
          <h3>Encrypted on your device</h3>
          <p className="small muted">
            Day records, food logs, goals, settings, and permission choices are encrypted locally
            using a key derived from your passphrase before being saved to IndexedDB. A small legacy
            source-consent record and the tamper-evident audit log remain unencrypted and contain no
            health values.
          </p>
        </article>

        <article className="card stack-sm">
          <h3>You control every data source</h3>
          <p className="small muted">
            In <strong>Settings → Permissions</strong>, you choose whether AURA can access usage,
            sleep, steps, heart rate, camera, microphone, notifications, health records, and sharing.
            Turning off a device-data permission removes the matching synced readings from your vault.
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
          <h3>Network features are opt-in</h3>
          <p className="small muted">
            Smart replies in <strong>Ask AURA</strong> require their separate opt-in. Voice input is processed
            on the device unless smart replies are enabled. A report can only be shared after enabling
            <strong> Family sharing</strong> in Permissions and then choosing the device share sheet.
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
