#!/bin/sh
# Optional hardening step: place the bundled reviewer profile in a Codex
# custom-agent directory, or verify it is already there unchanged.

set -eu

print_usage() {
  cat <<'EOF'
Usage: install-reviewer-agent.sh [--target-dir PATH] [--check]

Copies the bundled reviewer TOML into a Codex custom-agent directory. With no
--target-dir, that directory is "$CODEX_HOME/agents" if CODEX_HOME is set,
otherwise "$HOME/.codex/agents".

  --target-dir PATH  Use this directory instead of the default.
  --check            Read-only: exit 0 only if the destination already
                      matches the bundled profile byte for byte.
  --help              Show this message.
EOF
}

die() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

exists_or_linked() {
  [ -e "$1" ] || [ -L "$1" ]
}

this_dir=$(CDPATH= cd "$(dirname "$0")" && pwd) || exit 1
bundled_profile=$this_dir/../agents/codex-auto-router-astra-reviewer.toml
profile_filename=codex-auto-router-astra-reviewer.toml
verify_only=0

if [ -n "${CODEX_HOME-}" ]; then
  target_dir=$CODEX_HOME/agents
else
  [ -n "${HOME-}" ] || die "HOME is unset; pass --target-dir explicitly."
  target_dir=$HOME/.codex/agents
fi

while [ "$#" -gt 0 ]; do
  case "$1" in
    --target-dir)
      [ "$#" -ge 2 ] && [ -n "$2" ] || die "--target-dir needs a non-empty path."
      target_dir=$2
      shift 2
      ;;
    --check)
      verify_only=1
      shift
      ;;
    --help|-h)
      print_usage
      exit 0
      ;;
    *)
      die "unrecognized argument: $1"
      ;;
  esac
done

case "$target_dir" in
  /*) ;;
  *) target_dir=$(pwd -P)/$target_dir ;;
esac
case "$target_dir" in
  /|//) die "the filesystem root cannot be a target directory." ;;
esac

[ -f "$bundled_profile" ] && [ ! -L "$bundled_profile" ] ||
  die "bundled profile is missing or is a symlink: $bundled_profile"

destination=$target_dir/$profile_filename

if exists_or_linked "$target_dir" && { [ -L "$target_dir" ] || [ ! -d "$target_dir" ]; }; then
  die "target is not a plain directory: $target_dir"
fi
if exists_or_linked "$destination" && { [ -L "$destination" ] || [ ! -f "$destination" ]; }; then
  die "destination is not a plain file: $destination"
fi

if [ "$verify_only" -eq 1 ]; then
  [ -f "$destination" ] && cmp -s "$bundled_profile" "$destination" ||
    die "$destination is missing or does not match the bundled profile."
  printf '%s\n' "MATCH: $destination is byte-identical to the bundled profile."
  exit 0
fi

if [ -f "$destination" ]; then
  cmp -s "$bundled_profile" "$destination" ||
    die "$destination already exists with different content; refusing to overwrite it."
  printf '%s\n' "UNCHANGED: $destination already matches the bundled profile."
  exit 0
fi

mkdir -p "$target_dir" || die "could not create $target_dir"
[ -d "$target_dir" ] && [ ! -L "$target_dir" ] ||
  die "$target_dir changed underneath this script; aborting."

pending=$(mktemp "$target_dir/.codex-auto-router-reviewer.XXXXXX") ||
  die "could not create a temporary file next to the destination."
trap 'rm -f "$pending"' 0 HUP INT TERM
cp "$bundled_profile" "$pending" || die "could not copy the bundled profile."
ln "$pending" "$destination" || die "$destination appeared while installing; aborting."
rm -f "$pending"
trap - 0 HUP INT TERM

cmp -s "$bundled_profile" "$destination" || die "post-install verification failed."
printf '%s\n' "INSTALLED: $destination matches the bundled profile."
