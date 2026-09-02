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
//
// ---------------------------------------------------------------------------------------------
// THE PART THAT IS NOT OPTIONAL: Mastra's working memory is ALL-OR-NOTHING.
//
// You cannot keep `workingMemory: { enabled: true }` and own the write. With the feature on,
// Mastra appends its own guidance to the system prompt AFTER your instructions:
//
//   "REMEMBER: the way you update your working memory is by calling the updateWorkingMemory
//    tool with the entire Markdown content."
//   "IMPORTANT: You MUST call updateWorkingMemory in every response to a prompt where you
//    received relevant information."
//
// That contradicts "emit the memory as output, there is no tool", it lands ~1,700 chars later,
// and it is marked IMPORTANT. The model resolves the conflict by doing NEITHER -- it writes
// "Updating memory." and moves on. Strengthening your own instruction does not help; the
// instruction was never the problem. Verified by intercepting the provider request.
//
// So the working pattern is TWO Memory instances:
//
//   const agentMemory = new Memory({ storage, vector, embedder, options: {
//     workingMemory: false,                    // <- no injected guidance, no tool, no conflict
//     semanticRecall: { topK: 4 }, lastMessages: 6,
//   }});
//
//   // never passed to an Agent, so it never contributes to a system prompt
//   const memoryStore = new Memory({ storage, options: {
//     workingMemory: { enabled: true, template: TEMPLATE },   // <- only for get/update
//   }});
//
// Two instances because get/updateWorkingMemory throw "Working memory is not enabled for this
// memory instance" unless the feature is on -- but turning it on is what injects the
// contradiction. The feature couples a storage API to a prompt behaviour; this decouples them.
//
// With workingMemory off on the agent, Mastra no longer injects the stored memory either, so
// READING becomes your job too: fetch it and put it in the prompt. That is a feature, not a
// cost -- the memory is now visible in the prompt you wrote, rather than appended by the
// framework somewhere you cannot see, which is how the contradiction went unnoticed.
// ---------------------------------------------------------------------------------------------

/**
 * @param memory   the STORAGE-ONLY Memory instance (workingMemory enabled, never attached to
 *                 an Agent) -- see the note above on why it must be a separate instance
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
  const afterStr = String(after ?? '');
  // An empty read-back after a successful write IS a failure -- but identical content is not.
  if (!afterStr) {
    throw new Error('working memory read back empty immediately after updateWorkingMemory — a failure, not a no-op');
  }
  // Do NOT throw on unchanged content. Unchanged memory is CORRECT when the input was already
  // covered -- an earlier version of this file threw here, which is the same mistake as an eval
  // clause reading "memory must change": it fails a well-behaved agent. Report it instead.
  //
  // Mastra bumps updatedAt on every write regardless of whether the content differs, so
  // FRESHNESS still moves even on an unchanged cycle. That is what makes freshness the right
  // signal: it measures whether the write path ran, not whether the content happened to change.
  return {
    written: true,
    changed: afterStr.trim() !== String(before ?? '').trim(),
    chars: afterStr.length,
    grew: afterStr.length - String(before ?? '').length,
  };
}

// Bounded template. Give working memory a SHAPE or it grows without a ceiling: a template is
// what makes an agent merge and retire instead of append. Sections + a hint per section.
export const WORKING_MEMORY_TEMPLATE = `
## What I have covered
## Open threads
## Decisions made, and why
`.trim();
