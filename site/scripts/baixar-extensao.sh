#!/usr/bin/env bash
# Baixa o zip da extensão da última release extensao-v* do monorepo e gera o versao.json (spec 57 §3.3.4: zip fora do git).
# Uso: GH_TOKEN=... bash site/scripts/baixar-extensao.sh   (roda na raiz do repositório)
set -euo pipefail
REPO="${GITHUB_REPOSITORY:-RangelTech/second-brain}"
TAG=$(gh release list --repo "$REPO" --limit 50 --json tagName,isDraft -q '[.[] | select((.tagName|startswith("extensao-v")) and (.isDraft|not))][0].tagName')
[ -n "$TAG" ] || { echo "nenhuma release extensao-v*"; exit 1; }
gh release download "$TAG" --repo "$REPO" --pattern segundo-cerebro-chrome.zip --dir site/public/extensao --clobber
printf '{"versao":"%s"}\n' "${TAG#extensao-v}" > site/public/extensao/versao.json
echo "extensão $TAG baixada para o site"
