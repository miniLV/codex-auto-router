import { digest } from "./canonical.js";

export interface ArtifactSnapshot { entries: Record<string, unknown>; digest: string }
export interface VerificationCommand {
  id: string; argv: string[]; cwd: string; expected_exit: number;
  dependency_paths: string[]; dependency_coverage: "complete" | "unknown";
}
export interface CommandResult {
  command_id: string; command_digest: string; input_digest: string;
  exit_code: number; output_digest: string; observed_by: "root"; reused: boolean;
}
declare const verifiedBrand: unique symbol;
export interface VerifiedCandidate {
  readonly [verifiedBrand]: true;
  candidate_digest: string; dependency_digest: string; complete_diff_digest: string;
  acceptance_ids: string[]; commands: CommandResult[];
}
const verified = new WeakMap<object, string>();
export const isVerifiedCandidate = (v: VerifiedCandidate, candidate: string, dependencies: string): boolean =>
  verified.get(v) === digest({ ...v }) && v.candidate_digest === candidate && v.dependency_digest === dependencies;

export function changedPaths(before: ArtifactSnapshot, after: ArtifactSnapshot): string[] {
  return [...new Set([...Object.keys(before.entries), ...Object.keys(after.entries)])].sort()
    .filter(p => digest(before.entries[p] ?? null) !== digest(after.entries[p] ?? null));
}

export async function verifyCandidate(input: {
  baseline: ArtifactSnapshot; snapshot: () => Promise<ArtifactSnapshot>;
  dependency_digest: () => Promise<string>; owned_paths: string[]; acceptance_ids: string[];
  commands: VerificationCommand[]; previous_results: CommandResult[];
  read_complete_diff: (before: ArtifactSnapshot, after: ArtifactSnapshot) => Promise<void>;
  run: (command: VerificationCommand) => Promise<{ exit_code: number; output_digest: string }>;
  assess_acceptance: (candidate: ArtifactSnapshot, results: CommandResult[]) => Promise<string[]>;
}): Promise<{ ok: true; candidate: VerifiedCandidate } | { ok: false; reason: string; commands: CommandResult[] }> {
  const commands: CommandResult[] = [];
  const fail = (reason: string) => ({ ok: false as const, reason, commands });
  try {
    const current = await input.snapshot();
    if (current.digest !== digest(current.entries) || input.baseline.digest !== digest(input.baseline.entries)) return fail("INVALID_MANIFEST");
    const changed = changedPaths(input.baseline, current);
    if (changed.some(p => !input.owned_paths.includes(p))) return fail("OUT_OF_SCOPE_CHANGE");
    await input.read_complete_diff(input.baseline, current);
    const dependencies = await input.dependency_digest();
    if (input.commands.length === 0 || new Set(input.commands.map(c => c.id)).size !== input.commands.length) return fail("VERIFICATION_MISSING");
    for (const command of input.commands) {
      if (!command.id || command.argv.length === 0 || !command.argv.every(x => typeof x === "string" && !x.includes("\0"))) return fail("INVALID_COMMAND");
      const command_digest = digest(command);
      const input_digest = digest(command.dependency_paths.map(p => [p, current.entries[p] ?? null]));
      const prior = command.dependency_coverage === "complete" ? input.previous_results.find(r => r.command_id === command.id &&
        r.command_digest === command_digest && r.input_digest === input_digest && r.observed_by === "root") : undefined;
      const observed = prior ?? await input.run(command);
      const result: CommandResult = { command_id: command.id, command_digest, input_digest, exit_code: observed.exit_code,
        output_digest: observed.output_digest, observed_by: "root", reused: Boolean(prior) };
      commands.push(result);
      if (!Number.isSafeInteger(result.exit_code) || result.exit_code !== command.expected_exit || !result.output_digest) return fail("COMMAND_FAILED");
    }
    const accepted = await input.assess_acceptance(current, commands);
    if (input.acceptance_ids.length === 0 || !input.acceptance_ids.every(id => accepted.includes(id))) return fail("ACCEPTANCE_UNMET");
    const after = await input.snapshot();
    if (after.digest !== digest(after.entries) || after.digest !== current.digest || await input.dependency_digest() !== dependencies)
      return fail("CANDIDATE_CHANGED_DURING_VERIFICATION");
    const candidate = { candidate_digest: current.digest, dependency_digest: dependencies,
      complete_diff_digest: digest({ before: input.baseline.digest, after: current.digest, changed }),
      acceptance_ids: [...input.acceptance_ids], commands } as VerifiedCandidate;
    verified.set(candidate, digest({ ...candidate }));
    return { ok: true, candidate };
  } catch { return fail("VERIFICATION_UNAVAILABLE"); }
}
