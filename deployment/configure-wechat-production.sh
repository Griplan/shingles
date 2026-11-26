#!/usr/bin/env bash
set -euo pipefail

APP_ID="wx951711e2fa1da5ff"
CONFIG_DIR="/srv/dermatome-mapper/config"
CONFIG_FILE="$CONFIG_DIR/wechat-production.env"
DROPIN_DIR="/etc/systemd/system/dermatome.service.d"
DROPIN_FILE="$DROPIN_DIR/wechat-production.conf"

if [[ "${EUID}" -ne 0 ]]; then
  echo "请使用 sudo 运行此脚本。" >&2
  exit 1
fi

if [[ -e "$CONFIG_FILE" ]]; then
  echo "$CONFIG_FILE 已存在；为避免覆盖有效密钥，本脚本停止。" >&2
  exit 1
fi

umask 077
read -rsp "微信 AppSecret（输入时不显示）: " WECHAT_SECRET
echo

if [[ ! "$WECHAT_SECRET" =~ ^[0-9A-Fa-f]{32}$ ]]; then
  unset WECHAT_SECRET
  echo "AppSecret 格式无效。预期为 32 位十六进制字符串。" >&2
  exit 1
fi

SIGNING_KEY="$(openssl rand -hex 32)"
TEMP_FILE="$(mktemp)"
cleanup() {
  rm -f "$TEMP_FILE"
  unset WECHAT_SECRET SIGNING_KEY
}
trap cleanup EXIT

printf '%s\n' \
  "DERMATOME_WECHAT_APP_ID=$APP_ID" \
  "DERMATOME_WECHAT_APP_SECRET=$WECHAT_SECRET" \
  "ENABLE_PRODUCTION_ACCESS=1" \
  "DERMATOME_PRODUCTION_SIGNING_KEY=$SIGNING_KEY" \
  > "$TEMP_FILE"

if [[ ! -d "$CONFIG_DIR" ]]; then
  install -d -o root -g root -m 0750 "$CONFIG_DIR"
fi
install -o root -g root -m 0600 "$TEMP_FILE" "$CONFIG_FILE"

install -d -o root -g root -m 0755 "$DROPIN_DIR"
cat > "$DROPIN_FILE" <<'EOF'
[Service]
EnvironmentFile=/srv/dermatome-mapper/config/wechat-production.env
EOF
chmod 0644 "$DROPIN_FILE"

systemctl daemon-reload
if ! systemctl restart dermatome.service; then
  rm -f "$DROPIN_FILE" "$CONFIG_FILE"
  systemctl daemon-reload
  systemctl restart dermatome.service || true
  echo "正式配置启动失败；已移除本次配置并尝试恢复原服务。" >&2
  exit 1
fi

ready=0
for _ in $(seq 1 30); do
  if curl -fsS --max-time 2 http://127.0.0.1:8001/api/v1/health >/dev/null; then
    ready=1
    break
  fi
  sleep 1
done
if [[ "$ready" != 1 ]]; then
  systemctl stop dermatome.service >/dev/null 2>&1 || true
  rm -f "$DROPIN_FILE" "$CONFIG_FILE"
  systemctl daemon-reload
  systemctl restart dermatome.service || true
  echo "正式配置健康检查失败；已移除本次配置并尝试恢复原服务。" >&2
  exit 1
fi

echo "正式微信访问配置已写入；仅 dermatome.service 已重启。"
echo "配置文件权限：$(stat -c '%a %U:%G' "$CONFIG_FILE")"
