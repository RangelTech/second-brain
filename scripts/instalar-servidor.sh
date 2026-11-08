#!/usr/bin/env bash
# Instala o Segundo Cérebro em modo SERVIDOR (sem tela) numa máquina Linux (Debian/Ubuntu), para ser usado só pelo site
# de acesso web (https://remoto.rangeltech.net). Roda como serviço, reinicia sozinho e se atualiza por reinstalação.
#
# Uso (como root):
#   curl -fsSL https://raw.githubusercontent.com/RangelTech/second-brain/main/scripts/instalar-servidor.sh | \
#     SB_CONTA_EMAIL="voce@empresa.com" SB_CONTA_CHAVE="sk-..." bash
#
# Variáveis:
#   SB_CONTA_EMAIL, SB_CONTA_CHAVE   conta e chave da máquina (a automação da VM preenche; a chave é de uso exclusivo deste servidor)
#   SB_VERSAO                        versão a instalar (padrão: a última publicada)
#   SB_DEB                           caminho de um .deb local (pula o download; usado em testes)
#   SB_SEM_SYSTEMD=1                 não cria o serviço (container de teste): só instala e imprime o comando
set -euo pipefail

REPO="RangelTech/second-brain"
USUARIO="segundocerebro"
DADOS="/var/lib/segundo-cerebro"
CONF="/etc/segundo-cerebro"
LOG() { printf '\033[1;33m[segundo-cerebro]\033[0m %s\n' "$*"; }
FALHA() { printf '\033[1;31m[segundo-cerebro] erro:\033[0m %s\n' "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || FALHA "rode como root (sudo)."
command -v apt-get >/dev/null || FALHA "este instalador suporta Debian/Ubuntu (apt)."
[ -n "${SB_CONTA_EMAIL:-}" ] && [ -n "${SB_CONTA_CHAVE:-}" ] || FALHA "defina SB_CONTA_EMAIL e SB_CONTA_CHAVE."

export DEBIAN_FRONTEND=noninteractive
LOG "Atualizando a lista de pacotes e instalando dependências…"
apt-get update -qq
apt-get install -y -qq ca-certificates curl xvfb xauth >/dev/null
# bibliotecas que o Electron precisa e que uma Ubuntu/Debian mínima não traz (no Ubuntu 24.04 alguns nomes ganham o sufixo t64)
LISTA=""
for pacote in libatomic1 git build-essential libasound2 libgtk-3-0 libnss3 libgbm1 libxss1 libxtst6 libatk-bridge2.0-0 libatk1.0-0 libcups2 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxrandr2 libxfixes3 libpango-1.0-0 libcairo2 libx11-xcb1 libxcb-dri3-0 fonts-liberation fonts-noto-core fonts-noto-color-emoji fonts-noto-cjk; do
  if apt-cache show "${pacote}t64" >/dev/null 2>&1; then LISTA="$LISTA ${pacote}t64"; else LISTA="$LISTA $pacote"; fi
done
# uma só chamada do apt (muito mais rápido que um por pacote)
# shellcheck disable=SC2086
apt-get install -y -qq $LISTA >/dev/null || FALHA "não consegui instalar as dependências do sistema."

DEB="${SB_DEB:-}"
if [ -z "$DEB" ]; then
  DEB="$(mktemp --suffix=.deb)"
  trap 'rm -f "$DEB"' EXIT
  if [ -n "${SB_VERSAO:-}" ]; then BASE="https://github.com/$REPO/releases/download/${SB_VERSAO}"; else BASE="https://github.com/$REPO/releases/latest/download"; fi
  LOG "Baixando o Segundo Cérebro (${SB_VERSAO:-última versão})…"
  curl -fL --retry 3 --retry-delay 3 -o "$DEB" "$BASE/Segundo-Cerebro-Linux.deb" || FALHA "não consegui baixar o pacote."
fi
LOG "Instalando o pacote…"
apt-get install -y -qq "$DEB" >/dev/null

# acha o executável pelo atalho que o pacote cria (o nome tem acento e espaço)
DESKTOP="$(grep -l -m1 -E '^Exec=' /usr/share/applications/*.desktop 2>/dev/null | xargs -r grep -l -i -E 'seg.*c.rebro|second-brain' | head -1 || true)"
EXEC_LINHA="$(grep -m1 '^Exec=' "$DESKTOP" 2>/dev/null | sed -E 's/^Exec=//; s/ +%[A-Za-z]//g' || true)"
[ -n "$EXEC_LINHA" ] || FALHA "não encontrei o executável instalado."
LOG "Executável: $EXEC_LINHA"

id "$USUARIO" >/dev/null 2>&1 || useradd --system --create-home --home-dir "$DADOS" --shell /usr/sbin/nologin "$USUARIO"
mkdir -p "$CONF" "$DADOS"
umask 077
printf 'SB_CONTA_EMAIL=%s\nSB_CONTA_CHAVE=%s\n' "$SB_CONTA_EMAIL" "$SB_CONTA_CHAVE" > "$CONF/env"
chown root:"$USUARIO" "$CONF/env"
chmod 640 "$CONF/env"
chown -R "$USUARIO:$USUARIO" "$DADOS"
# o chrome-sandbox do Electron precisa de dono root e modo 4755 (o .deb já faz isso); sem user namespaces cai para --no-sandbox
CMD="xvfb-run -a $EXEC_LINHA --servidor --no-sandbox --disable-gpu"

if [ "${SB_SEM_SYSTEMD:-0}" = "1" ]; then
  LOG "Instalado (sem serviço). Para iniciar:"
  echo "  su -s /bin/bash $USUARIO -c 'set -a; . $CONF/env; set +a; SB_DATA_DIR=$DADOS SB_SERVIDOR=1 $CMD'"
  exit 0
fi

cat > /etc/systemd/system/segundo-cerebro.service <<UNIT
[Unit]
Description=Segundo Cérebro (servidor)
After=network-online.target
Wants=network-online.target

[Service]
User=$USUARIO
EnvironmentFile=$CONF/env
Environment=SB_DATA_DIR=$DADOS SB_SERVIDOR=1 HOME=$DADOS
ExecStart=/usr/bin/env bash -c '$CMD'
Restart=always
RestartSec=5
# a VM é do cliente: o agente roda como o dono dela (sudo, Docker, instalar pacotes). Só o próprio Segundo Cérebro é protegido (build/liberdade-vm.sh).

[Install]
WantedBy=multi-user.target
UNIT
# atualizador diário: se houver versão nova publicada, baixa o .deb, instala e reinicia o serviço (a VM do cliente nunca fica para trás)
cat > /usr/local/bin/segundo-cerebro-atualizar <<'ATU'
#!/usr/bin/env bash
# Atualizador do Segundo Cérebro (servidor/VM). NÃO depende da API do GitHub (que dá 504 e limita 60 consultas por hora por IP):
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
ATU
chmod 755 /usr/local/bin/segundo-cerebro-atualizar
cat > /etc/systemd/system/segundo-cerebro-atualizar.service <<UNIT2
[Unit]
Description=Atualiza o Segundo Cérebro (servidor)
[Service]
Type=oneshot
ExecStart=/usr/local/bin/segundo-cerebro-atualizar
UNIT2
cat > /etc/systemd/system/segundo-cerebro-atualizar.timer <<UNIT3
[Unit]
Description=Procura versão nova do Segundo Cérebro todo dia
[Timer]
OnCalendar=*-*-* 00,06,12,18:00:00
RandomizedDelaySec=1h
Persistent=true
[Install]
WantedBy=timers.target
UNIT3
systemctl daemon-reload
# liberdade do dono da VM + protecao do proprio Segundo Cerebro (sudo sem senha, Docker, vigia); o script vem dentro do pacote
LIB="$(dpkg -L second-brain 2>/dev/null | grep 'resources/liberdade-vm.sh$' | head -1 || true)"
if [ -n "$LIB" ]; then bash "$LIB" || LOG "aviso: a configuracao de liberdade nao terminou (o vigia tenta de novo em 5 min)."; fi
systemctl enable --now segundo-cerebro.service
systemctl enable --now segundo-cerebro-atualizar.timer
sleep 6
if systemctl is-active --quiet segundo-cerebro.service; then
  LOG "Pronto. O servidor está rodando e aparece em https://remoto.rangeltech.net (entre com a sua conta)."
  LOG "Logs: journalctl -u segundo-cerebro -f"
else
  journalctl -u segundo-cerebro -n 30 --no-pager || true
  FALHA "o serviço não iniciou (veja o log acima)."
fi
