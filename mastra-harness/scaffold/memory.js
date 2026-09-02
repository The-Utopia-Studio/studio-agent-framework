// Deterministic working-memory write.
//
// Why this exists: leaving the write to the model does not work. Reproduced A/B on one agent,
// same instructions, same model, varying only which recall channels were available:
//
//   lastMessages: 0 + semanticRecall: false   -> updateWorkingMemory offered AND called
//   lastMessages: 6 + semanticRecall on       -> offered, NOT called, memory frozen
//
// The recall channels compete. Once semantic recall can answer "what have I already covered?",
// the model has no felt need to persist anything -- so memory maintenance DECAYS AS THE CORPUS
// GROWS, which is exactly backwards for a long-horizon agent. Nine cycles reported `ok` while
// nothing was written, and the agent's own replies said "Updating memory."
//
// So: ask the model for the memory CONTENT as ordinary output, then write it yourself through
// the vendor API. The model still does the synthesis; it just doesn't get to skip the write.
//
// NEVER write mastra_resources.workingMemory directly over raw HTTP. A raw write leaves Mastra
// no longer OFFERING updateWorkingMemory to the model at all. Raw READS are fine and necessary.

/**
 * @param memory   a @mastra/memory Memory instance
 * @param resource the resource id -- working memory is per RESOURCE, not per thread
 * @param next     the new working-memory body the model just produced
 */
export async function writeWorkingMemory(memory, resource, next) {
  const body = String(next ?? '').trim();
  if (!body) return { written: false, reason: 'model produced no memory body' };

  const before = await memory.getWorkingMemory({ resourceId: resource }).catch(() => null);

  // The vendor API, not the table. This is the whole point.
  await memory.updateWorkingMemory({ resourceId: resource, workingMemory: body });

  // Read back and prove it changed. A write you don't verify is a write you're guessing about --
  // and this exact class of unverified success is what hid the failure for nine hours.
  const after = await memory.getWorkingMemory({ resourceId: resource });
  const changed = String(after ?? '') !== String(before ?? '');
  if (!changed) {
    throw new Error('working memory did not change after updateWorkingMemory — treat as a failure, not a no-op');
  }
  return { written: true, chars: String(after).length, grew: String(after).length - String(before ?? '').length };
}

// Bounded template. Give working memory a SHAPE or it grows without a ceiling: a template is
// what makes an agent merge and retire instead of append. Sections + a hint per section.
export const WORKING_MEMORY_TEMPLATE = `
## What I have covered
## Open threads
## Decisions made, and why
`.trim();
