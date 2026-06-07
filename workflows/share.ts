/**
 * Durable blob store for a public, read-only shared chat transcript.
 *
 * The template has no database, but a durable workflow run IS a durable,
 * addressable store: starting `shareWorkflow(json)` returns a runId we hand out
 * as the public share id, and `getRun(id).returnValue` reads the JSON back from
 * any later (stateless) serverless request. The run completes immediately — it
 * only exists to hold the redacted transcript.
 */
export async function shareWorkflow(transcript: string): Promise<string> {
  "use workflow";
  return transcript;
}
