#!/usr/bin/env bash
# Proxy do navegador na VM (spec 31): as VMs saem por IP de datacenter fora do Brasil e o Instagram e afins barram.
# Busca no servidor (com a chave da própria VM) o proxy da conta e configura:
#   1) Squid LOCAL só em 127.0.0.1:3129, que repassa para o proxy da conta com a senha (se o proxy cair, sai direto: o cliente nunca fica sem a rede);
#   2) /etc/segundo-cerebro/navegador.pac: só as redes sociais vão pelo 127.0.0.1:3129, o resto sai direto;
#   3) o app sobe com --proxy-pac-url apontando para esse arquivo (vale para qualquer versão do app).
# Sem proxy cadastrado no servidor, desfaz tudo (saída direta). Idempotente; roda na instalação e no atualizador diário.
# Uso (root): /usr/local/bin/segundo-cerebro-proxy   (lê SB_CONTA_CHAVE de /etc/segundo-cerebro/env)
set -euo pipefail
ENV=/etc/segundo-cerebro/env
[ -f "$ENV" ] && set -a && . "$ENV" && set +a
BASE="${SB_UNLIMITED_BASE:-https://qwen.rangeltech.net/v1}"
PAC=/etc/segundo-cerebro/navegador.pac
DROPIN=/etc/systemd/system/segundo-cerebro.service.d/proxy-navegador.conf
CONF=/etc/squid/squid.conf
log() { echo "[proxy-vm] $*"; }

if [ -z "${SB_CONTA_CHAVE:-}" ]; then log "sem chave da conta: nada a fazer"; exit 0; fi
JSON=$(curl -fsS -m 20 -H "Authorization: Bearer $SB_CONTA_CHAVE" "$BASE/app/proxy-navegador" 2>/dev/null || true)
if [ -z "$JSON" ]; then log "servidor sem resposta: mantém como está"; exit 0; fi
URL=$(printf '%s' "$JSON" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("proxy") or "")')
DOMINIOS=$(printf '%s' "$JSON" | python3 -c 'import json,sys; print(" ".join(json.load(sys.stdin).get("dominios") or []))')

mudou=0
if [ -z "$URL" ]; then
  # sem proxy para esta conta: tira o parâmetro do app (o Squid local pode ficar parado)
  if [ -f "$DROPIN" ]; then rm -f "$DROPIN" "$PAC"; mudou=1; log "proxy desligado"; fi
  systemctl disable --now squid >/dev/null 2>&1 || true
else
  read -r ESQ USU SEN HOST PORTA < <(printf '%s' "$URL" | python3 -c '
import sys, urllib.parse as u
p = u.urlsplit(sys.stdin.read().strip())
print(p.scheme, u.unquote(p.username or ""), u.unquote(p.password or ""), p.hostname, p.port)')
  command -v squid >/dev/null || (DEBIAN_FRONTEND=noninteractive apt-get install -y -qq squid >/dev/null)
  NOVO=$(mktemp)
  {
    echo "# gerado por segundo-cerebro-proxy (não editar)"
    echo "http_port 127.0.0.1:3129"
    echo "acl local src 127.0.0.1/32 ::1"
    echo "http_access allow local"
    echo "http_access deny all"
    echo "cache_peer $HOST parent $PORTA 0 no-query default login=$USU:$SEN name=conta"
    echo "cache_peer_access conta allow all"
    echo "prefer_direct off"
    echo "nonhierarchical_direct off"
    echo "forwarded_for delete"
    echo "via off"
    echo "cache deny all"
    echo "access_log none"
    echo "cache_log /var/log/squid/cache.log"
  } > "$NOVO"
  if ! cmp -s "$NOVO" "$CONF"; then install -m 640 -o root -g proxy "$NOVO" "$CONF"; systemctl enable squid >/dev/null 2>&1; systemctl restart squid; log "squid local atualizado"; fi
  rm -f "$NOVO"
  systemctl is-active --quiet squid || systemctl restart squid
  # PAC: só as redes sociais pelo squid local
  NOVO=$(mktemp)
  {
    echo "function FindProxyForURL(url, host) {"
    echo "  host = host.toLowerCase();"
    echo -n "  var d = ["; for x in $DOMINIOS; do echo -n "\"$x\","; done; echo "];"
    echo "  for (var i = 0; i < d.length; i++) { if (host === d[i] || dnsDomainIs(host, '.' + d[i])) return 'PROXY 127.0.0.1:3129; DIRECT'; }"
    echo "  return 'DIRECT';"
    echo "}"
  } > "$NOVO"
  if ! cmp -s "$NOVO" "$PAC"; then install -m 644 "$NOVO" "$PAC"; mudou=1; fi
  rm -f "$NOVO"
  # parâmetro do app: o ExecStart original + --proxy-pac-url (drop-in, o serviço original fica intacto)
  ORIG=$(systemctl cat segundo-cerebro.service 2>/dev/null | grep -m1 '^ExecStart=' | sed 's/^ExecStart=//')
  if [ -n "$ORIG" ] && ! grep -q "proxy-pac-url" "$DROPIN" 2>/dev/null; then
    mkdir -p "$(dirname "$DROPIN")"
    CMD=$(printf '%s' "$ORIG" | sed "s#--servidor#--servidor --proxy-pac-url=file://$PAC#")
    printf '[Service]\nExecStart=\nExecStart=%s\n' "$CMD" > "$DROPIN"
    mudou=1
    log "app passa a usar a regra do proxy"
  fi
fi
if [ "$mudou" = 1 ]; then systemctl daemon-reload; systemctl restart segundo-cerebro; log "app reiniciado"; else log "nada mudou"; fi
