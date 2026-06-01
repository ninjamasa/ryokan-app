#!/bin/bash
# 旅館サイボーグ — セッション開始フック
# Claude Code (web/ローカル) のセッション開始時に依存をインストールし、
# テスト・Lint・ビルドがすぐ動く状態を保証する。冪等。
set -euo pipefail

cd "${CLAUDE_PROJECT_DIR:-.}"

# npm の出力は stderr へ(SessionStartのstdoutはコンテキストに取り込まれるため汚さない)
echo "[session-start] installing dependencies (npm install)…" 1>&2
npm install 1>&2
echo "[session-start] done." 1>&2
