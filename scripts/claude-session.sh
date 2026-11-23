#!/usr/bin/env bash
# Ouvre la discussion Claude Code portant ce nom (reprise si elle existe sur
# cette machine, sinon nouvelle discussion créée avec ce nom).
# Lancé par les tâches (une par discussion) de .vscode/tasks.json à l'ouverture du dossier.
# Usage : scripts/claude-session.sh "Jukebox"
set -u
name="${1:?nom de discussion attendu}"

cd "$(dirname "$0")/.." || exit 1
# Dossier où Claude Code range les discussions de ce projet (/ remplacés par -)
dir="$HOME/.claude/projects/$(pwd | tr '/' '-')"

# Titre d'une discussion : dernier nom donné (/rename), sinon titre automatique.
title_of() {
  local t
  t=$(grep -o '"customTitle":"[^"]*"' "$1" | tail -n1 | cut -d'"' -f4)
  [ -n "$t" ] || t=$(grep -o '"aiTitle":"[^"]*"' "$1" | tail -n1 | cut -d'"' -f4)
  printf '%s' "$t"
}

# Discussion la plus récente qui porte ce nom
id=""
if [ -d "$dir" ]; then
  for f in $(ls -t "$dir"/*.jsonl 2>/dev/null); do
    if [ "$(title_of "$f")" = "$name" ]; then
      id=$(basename "$f" .jsonl)
      break
    fi
  done
fi

if [ -n "$id" ]; then
  exec claude --resume "$id"
else
  exec claude -n "$name"
fi
