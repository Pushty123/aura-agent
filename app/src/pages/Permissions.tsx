import { useEffect, useState } from 'react';
import { loadLimits } from '../apps/appUsage';
import { clearAuraNotifications, pushAppLimits, setPhoneStepsEnabled } from '../native/bridge';
import { getPermissions, PERMISSIONS, setPermission, type Permissions, type PermissionKey } from '../lib/permissions';
import { applyReminders, loadReminders } from '../reminders/reminders';

export function PermissionsPage({ onChanged }: { onChanged: () => Promise<void> }) {
  const [permissions, setPermissions] = useState<Permissions | null>(null);
  const [busy, setBusy] = useState<PermissionKey | null>(null);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const saved = await getPermissions();
        setPermissions(saved);
        if (!saved.notifications) await clearAuraNotifications();
        await setPhoneStepsEnabled(saved.steps);
        await pushAppLimits(saved.usage && saved.notifications ? await loadLimits() : []);
      } catch (error) {
        setStatus({ ok: false, text: error instanceof Error ? error.message : 'Could not load saved permissions.' });
      }
    })();
  }, []);

  async function change(permission: PermissionKey, enabled: boolean) {
    setBusy(permission);
    setStatus(null);
    try {
      await setPermission(permission, enabled);
      const saved = await getPermissions();
      setPermissions(saved);
      await onChanged();
      if (permission === 'notifications') {
        if (enabled) await applyReminders(await loadReminders());
        else await clearAuraNotifications();
      }
      if (permission === 'steps') await setPhoneStepsEnabled(enabled);
      if (permission === 'usage')
        await pushAppLimits(enabled && saved.notifications ? await loadLimits() : []);
      setStatus({ ok: true, text: `${PERMISSIONS.find((item) => item.id === permission)?.label} ${enabled ? 'enabled' : 'disabled'}.` });
    } catch (error) {
      try {
        setPermissions(await getPermissions());
        await onChanged();
      } catch (refreshError) {
        const detail = refreshError instanceof Error ? refreshError.message : 'Could not refresh the saved permission state.';
        setStatus({ ok: false, text: `${error instanceof Error ? error.message : 'Could not save this permission.'} ${detail}` });
        return;
      }
      setStatus({ ok: false, text: error instanceof Error ? error.message : 'Could not save this permission.' });
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="stack-lg">
      <article className="card stack-sm">
        <h2 style={{ margin: 0 }}>Permissions</h2>
        <p className="small muted" style={{ margin: 0 }}>
          These AURA controls are saved encrypted in your vault. They are separate from Android&apos;s own permission prompts.
          Turning a control off stops AURA from using that source.
        </p>
      </article>

      <div className="card stack-sm">
        {permissions ? PERMISSIONS.map(({ id, label, description }) => (
          <label key={id} className="toggle-row">
            <input
              type="checkbox"
              checked={permissions[id]}
              disabled={busy !== null}
              onChange={(event) => void change(id, event.target.checked)}
            />
            <span>
                <strong className="small">{label}</strong>
              <br />
              <span className="xs muted">{description}</span>
            </span>
          </label>
        )) : <p className="small muted">Loading permissions…</p>}
      </div>

      {status && <div className={`status-banner ${status.ok ? 'ok' : 'error'}`} role={status.ok ? 'status' : 'alert'}>{status.text}</div>}
      <p className="xs muted">
        Enabling an AURA control does not bypass Android&apos;s permission dialog. Location and family sharing are not accessed automatically.
      </p>
    </section>
  );
}
