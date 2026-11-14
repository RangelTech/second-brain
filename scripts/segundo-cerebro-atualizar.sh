#!/usr/bin/env bash
# Atualizador do Cérebro Pro (servidor/VM). NÃO depende da API do GitHub (que dá 504 e limita 60 consultas por hora por IP):
#  1) versão pelo redirecionamento de https://github.com/<repo>/releases/latest (página normal, segue de pé quando a API cai)
#  2) plano B: o endpoint do nosso servidor (guarda a última versão boa), 3) plano C: a API.
# Se nenhuma responder, sai com sucesso e tenta de novo no próximo ciclo (a VM nunca fica "com erro" por causa do GitHub).
set -uo pipefail
REPO="RangelTech/second-brain"
NOSSO="${SB_VERSAO_URL:-https://qwen.rangeltech.net/v1/app/latest}"
ATUAL="${SB_ATUAL_FORCADA:-$(dpkg-query -W -f='${Version}' second-brain 2>/dev/null || echo 0)}"

versao_nova() {
  local u v
  u="$(curl -fsSIL --retry 3 --retry-all-errors --max-time 30 -o /dev/null -w '%{url_effective}' "https://github.com/$REPO/releases/latest" 2>/dev/null)" || u=""
  if [[ "$u" =~ /tag/v?([0-9][0-9A-Za-z.\-]*)$ ]]; then echo "${BASH_REMATCH[1]}"; return 0; fi
  v="$(curl -fsSL --retry 2 --max-time 30 "$NOSSO" 2>/dev/null | python3 -c 'import sys,json;print(json.load(sys.stdin)["version"])' 2>/dev/null)" || v=""
  if [ -n "$v" ]; then echo "$v"; return 0; fi
  curl -fsSL --retry 2 --max-time 30 "https://api.github.com/repos/$REPO/releases/latest" 2>/dev/null | python3 -c 'import sys,json;print(json.load(sys.stdin)["tag_name"].lstrip("v"))' 2>/dev/null
}

NOVA="$(versao_nova || true)"
if [ -z "$NOVA" ]; then echo "não consegui descobrir a versão agora (GitHub fora do ar?); tento de novo no próximo ciclo"; exit 0; fi
if [ "$NOVA" = "$ATUAL" ]; then echo "já está na versão $ATUAL"; exit 0; fi
echo "atualizando $ATUAL -> $NOVA"
DEB="$(mktemp --suffix=.deb)"; trap 'rm -f "$DEB"' EXIT
# download direto de github.com (não é a API), com retomada e várias tentativas
if ! curl -fL --retry 6 --retry-all-errors --retry-delay 5 -C - --max-time 900 -o "$DEB" "https://github.com/$REPO/releases/download/v$NOVA/Segundo-Cerebro-Linux.deb"; then
  echo "download falhou agora; tento de novo no próximo ciclo"; exit 0
fi
# só instala se o pacote está íntegro e é mesmo da versão esperada
if [ "$(dpkg-deb -f "$DEB" Version 2>/dev/null)" != "$NOVA" ]; then echo "pacote baixado não confere com a versão $NOVA; ignorado"; exit 0; fi
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq "$DEB" >/dev/null
systemctl restart segundo-cerebro.service
echo "atualizado para $NOVA"
