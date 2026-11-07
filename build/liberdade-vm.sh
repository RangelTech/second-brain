#!/bin/bash
# Liberdade do dono da VM (modo servidor): o agente pode instalar pacotes, usar sudo sem senha e subir Docker; a UNICA coisa que não pode é
# quebrar o próprio Segundo Cérebro (desinstalar, parar, desativar, apagar). Idempotente: roda na instalação (instalar-servidor.sh) e a cada
# atualização do pacote (afterInstall do .deb), então as VMs que já existem passam a ter isso no próximo update diário.
# Sai em silêncio quando não é uma VM em modo servidor (desktop, container de teste).
# ATENÇÃO: roda dentro do postinst do dpkg, que segura a trava do dpkg: aqui NÃO pode chamar apt-get. O Docker é instalado pelo vigia (fora do dpkg).
set +e
USUARIO="segundocerebro"
UNIT="/etc/systemd/system/segundo-cerebro.service"
[ -d /run/systemd/system ] || exit 0
id "$USUARIO" >/dev/null 2>&1 || exit 0
[ -f "$UNIT" ] || exit 0

# arquivos protegidos: solta a trava só para mexer aqui
PROTEGIDOS=("$UNIT" /etc/systemd/system/segundo-cerebro-atualizar.service /etc/systemd/system/segundo-cerebro-atualizar.timer /etc/systemd/system/segundo-cerebro-guarda.service /etc/systemd/system/segundo-cerebro-guarda.timer /usr/local/bin/segundo-cerebro-atualizar /usr/local/bin/segundo-cerebro-guarda /etc/segundo-cerebro/env /etc/sudoers.d/segundocerebro)
destravar() { for f in "${PROTEGIDOS[@]}"; do [ -e "$f" ] && chattr -i "$f" 2>/dev/null; done; }
travar() { for f in "${PROTEGIDOS[@]}"; do [ -e "$f" ] && chattr +i "$f" 2>/dev/null; done; }
destravar

# 1) sudo sem senha para o usuário do serviço, EXCETO o que desligaria o próprio Segundo Cérebro
cat > /etc/sudoers.d/segundocerebro <<'SUDO'
# Rangel Tech: o agente do dono da VM tem sudo livre, menos para remover/parar o Segundo Cérebro.
Cmnd_Alias SC_PROTEGIDO = /usr/bin/apt-get remove *second-brain*, /usr/bin/apt-get purge *second-brain*, /usr/bin/apt-get autoremove *second-brain*, \
  /usr/bin/apt remove *second-brain*, /usr/bin/apt purge *second-brain*, /usr/bin/dpkg -r *second-brain*, /usr/bin/dpkg -P *second-brain*, \
  /usr/bin/dpkg --remove *second-brain*, /usr/bin/dpkg --purge *second-brain*, \
  /usr/bin/systemctl stop segundo-cerebro*, /usr/bin/systemctl disable segundo-cerebro*, /usr/bin/systemctl mask segundo-cerebro*, \
  /usr/bin/systemctl kill segundo-cerebro*, /usr/bin/systemctl restart segundo-cerebro.service, \
  /usr/bin/chattr * /etc/segundo-cerebro/*, /usr/bin/chattr * /etc/systemd/system/segundo-cerebro*, /usr/bin/chattr * /usr/local/bin/segundo-cerebro*, \
  /usr/bin/rm * /etc/segundo-cerebro*, /usr/bin/rm * /etc/systemd/system/segundo-cerebro*, /usr/bin/rm * /usr/local/bin/segundo-cerebro*, /usr/bin/rm * /opt/Segundo*
segundocerebro ALL=(ALL) NOPASSWD: ALL, !SC_PROTEGIDO
SUDO
chmod 440 /etc/sudoers.d/segundocerebro
if ! visudo -cf /etc/sudoers.d/segundocerebro >/dev/null 2>&1; then rm -f /etc/sudoers.d/segundocerebro; fi

# 2) o serviço não é mais confinado: o agente escreve onde o dono da VM escreveria e pode usar sudo
if grep -qE '^(ProtectSystem|ReadWritePaths|NoNewPrivileges)=' "$UNIT"; then
  sed -i -E '/^(ProtectSystem|ReadWritePaths|NoNewPrivileges)=/d' "$UNIT"
  systemctl daemon-reload
fi

# 3) vigia (roda como root, fora do dpkg): religa o serviço se alguém o derrubar e garante Docker + grupo docker
cat > /usr/local/bin/segundo-cerebro-guarda <<'G0'
#!/bin/bash
export DEBIAN_FRONTEND=noninteractive
systemctl is-enabled --quiet segundo-cerebro.service || systemctl enable segundo-cerebro.service
systemctl is-active --quiet segundo-cerebro.service || systemctl start segundo-cerebro.service
systemctl is-enabled --quiet segundo-cerebro-atualizar.timer || systemctl enable --now segundo-cerebro-atualizar.timer
# Docker para o agente do dono da VM (instala uma vez; o serviço reinicia uma vez para enxergar o grupo novo)
if ! command -v docker >/dev/null 2>&1; then
  apt-get update -qq >/dev/null 2>&1
  apt-get install -y -qq docker.io >/dev/null 2>&1
  apt-get install -y -qq docker-compose-v2 >/dev/null 2>&1 || apt-get install -y -qq docker-compose-plugin >/dev/null 2>&1
  systemctl enable --now docker >/dev/null 2>&1
fi
if command -v docker >/dev/null 2>&1 && ! id -nG segundocerebro | tr ' ' '\n' | grep -qx docker; then
  getent group docker >/dev/null 2>&1 && usermod -aG docker segundocerebro && systemctl restart segundo-cerebro.service
fi
exit 0
G0
chmod 755 /usr/local/bin/segundo-cerebro-guarda
cat > /etc/systemd/system/segundo-cerebro-guarda.service <<'G1'
[Unit]
Description=Garante que o Segundo Cérebro continue ligado e a VM tenha Docker
[Service]
Type=oneshot
ExecStart=/usr/local/bin/segundo-cerebro-guarda
G1
cat > /etc/systemd/system/segundo-cerebro-guarda.timer <<'G2'
[Unit]
Description=Vigia do Segundo Cérebro
[Timer]
OnBootSec=2min
OnUnitActiveSec=5min
[Install]
WantedBy=timers.target
G2
systemctl daemon-reload
systemctl enable --now segundo-cerebro-guarda.timer >/dev/null 2>&1
systemctl start --no-block segundo-cerebro-guarda.service >/dev/null 2>&1

# 4) trava os arquivos do serviço contra remoção/edição acidental (o root desta máquina ainda pode: chattr -i)
travar
exit 0
