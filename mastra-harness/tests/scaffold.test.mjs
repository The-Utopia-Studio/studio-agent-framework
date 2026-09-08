import test from 'node:test';
import assert from 'node:assert/strict';
import { writeWorkingMemory, withinCeiling } from '../scaffold/memory.js';
import { enforceBudget } from '../scaffold/budget.js';
import { doctor } from '../scaffold/doctor.js';
test('memory rejects a wrong nonempty read-back', async () => {
  const store = { getWorkingMemory: async () => 'old', updateWorkingMemory: async () => {} };
  await assert.rejects(writeWorkingMemory(store, 'scoped-resource', 'new'), /does not match/);
});
test('identical valid writes succeed and oversized writes do not execute', async () => {
  let writes = 0;
  const store = {
    getWorkingMemory: async () => 'same',
    updateWorkingMemory: async () => {
      writes++;
    },
  };
  const result = await writeWorkingMemory(store, 'resource', 'same');
  assert.equal(result.written, true);
  assert.equal(result.changed, false);
  assert.equal((await writeWorkingMemory(store, 'resource', 'x'.repeat(4001))).written, false);
  assert.equal(writes, 1);
  assert.equal(withinCeiling('x'.repeat(4001)).ok, false);
});
test('budget reports stop failures rather than claiming it stopped', async () => {
  const result = await enforceBudget({
    spentUsd: 2,
    budgetUsd: 1,
    stop: async () => {
      throw new Error('scheduler unavailable');
    },
  });
  assert.equal(result.ok, false);
  assert.equal(result.stopped, false);
});
test('doctor with no observed checks is not release-ready', async () => {
  const result = await doctor();
  assert.equal(result.ready, false);
});
