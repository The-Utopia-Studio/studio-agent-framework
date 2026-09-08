import { createHash } from 'node:crypto';

const hash = (value) => createHash('sha256').update(value).digest('hex');

export function createAgent({ store = new Map() } = {}) {
  return {
    async run(input, { context = {} } = {}) {
      const tenant = String(input?.tenant_id || context.tenant_id || '');
      if (!tenant) throw new Error('tenant_id is required');
      const key = `${tenant}:${String(input?.resource || 'default')}`;
      const events = [
        { step_index: 0, step_name: 'precondition_checked', duration_ms: 0, blocked: 0 },
        { step_index: 1, step_name: 'workflow_started', duration_ms: 0, blocked: 0 },
      ];
      if (input?.workflow === 'resume') {
        const value = store.get(key);
        events.push({ step_index: 2, step_name: 'memory_read', duration_ms: 0, blocked: 0 });
        events.push({ step_index: 3, step_name: 'workflow_resumed', duration_ms: 0, blocked: 0 });
        events.push({ step_index: 4, step_name: 'terminal', blocked: 0 });
        return { output: value ? `Remembered: ${value}` : 'Nothing remembered.', memory_scope: tenant, events };
      }
      const note = String(input?.note || '').trim();
      if (!note) throw new Error('note is required');
      store.set(key, note);
      events.push({ step_index: 2, step_name: 'memory_write', duration_ms: 0, blocked: 0 });
      events.push({ step_index: 3, step_name: 'workflow_completed', duration_ms: 0, blocked: 0 });
      events.push({ step_index: 4, step_name: 'terminal', blocked: 0 });
      return { output: `Saved: ${note}`, memory_scope: tenant, note_hash: hash(note), events };
    },
  };
}
