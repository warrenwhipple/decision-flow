#!/usr/bin/env bash

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
skills_dir="$repo_root/skills"
timestamp="$(date +%Y%m%d-%H%M%S)"
targets=("$HOME/.agents/skills" "$HOME/.claude/skills")

backup_existing() {
  local target="$1"
  local backup="${target}.backup-${timestamp}"
  local suffix=1

  while [[ -e "$backup" || -L "$backup" ]]; do
    backup="${target}.backup-${timestamp}-${suffix}"
    suffix=$((suffix + 1))
  done

  mv "$target" "$backup"
  printf 'Backed up %s -> %s\n' "$target" "$backup"
}

for target_dir in "${targets[@]}"; do
  mkdir -p "$target_dir"

  for skill_dir in "$skills_dir"/*/; do
    [[ -d "$skill_dir" ]] || continue

    skill_name="$(basename "${skill_dir%/}")"
    target="$target_dir/$skill_name"

    if [[ -e "$target" && ! -L "$target" ]]; then
      backup_existing "$target"
    fi

    ln -sfn "${skill_dir%/}" "$target"
    printf 'Linked %s -> %s\n' "$target" "${skill_dir%/}"
  done
done
