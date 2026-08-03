# ccusage integration decision

Status: implemented on 2026-08-03 with exact-pinned `ccusage@20.0.19`.

## Decision

Invoke the project-local `ccusage` CLI with `--offline`; do not import its
launcher internals or maintain a second Codex JSONL parser. The package exposes
a CLI, not a supported parser API ([package metadata](https://github.com/ccusage/ccusage/blob/main/apps/ccusage/package.json)), while its maintained Codex adapter already handles archived sessions, cumulative-token deltas, replay suppression, model fallback, and deduplication ([adapter notes](https://github.com/ccusage/ccusage/tree/main/rust/adapters/codex)).

The verified output contract is:

```text
sessions[].models[model].totalTokens
```

Missing binaries, unsupported platforms, timeouts, non-zero exits, malformed
JSON, and unknown shapes remain unavailable diagnostics; they must never become
zero-usage success.

## Upgrade rule

Keep the dependency exact-pinned. Any upgrade must rerun the local
`ccusage codex session --json --offline` command, update its fixture if the
shape changed, and pass the repository tests. Adopt a direct parser only if the
native bundle becomes unacceptable and the project is prepared to own replay,
deduplication, archive precedence, and schema-drift tests.
