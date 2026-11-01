#!/usr/bin/env bash
#
# DevToolbox 一键部署到阿里云 ECS
#
# 用法：
#   ./deploy.sh --host 47.98.xx.xx --user root
#   ./deploy.sh --host 47.98.xx.xx --user deploy --key ~/.ssh/aliyun.pem --domain tools.example.com
#
# 全部参数：
#   --host    HOST   ECS 公网 IP 或域名（必填）
#   --user    USER   SSH 用户，默认 root
#   --ssh-port PORT  SSH 端口，默认 22
#   --key     PATH   SSH 私钥路径，默认使用 ssh-agent / 默认密钥
#   --dir     PATH   远端部署目录，默认 /var/www/devtoolbox
#   --port    PORT   对外服务端口，默认 3100
#   --domain  NAME   server_name（可选，默认 _）
#   --no-nginx       只上传文件，不修改 Nginx
#   --dry-run        只打印将执行的命令，不做任何改动
#
set -euo pipefail

# ------------------------------------------------------------------ 默认值
HOST=""
SSH_USER="root"
SSH_PORT="22"
SSH_KEY=""
APP_DIR="/var/www/devtoolbox"
APP_PORT="3100"
SERVER_NAME="_"
DO_NGINX=1
DRY_RUN=0

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
STAGE_DIR="$PROJECT_DIR/.deploy-stage"

# ------------------------------------------------------------------ 输出
if [ -t 1 ]; then
  C_RESET=$'\033[0m'; C_DIM=$'\033[2m'; C_OK=$'\033[32m'
  C_ERR=$'\033[31m'; C_INFO=$'\033[36m'; C_BOLD=$'\033[1m'
else
  C_RESET=""; C_DIM=""; C_OK=""; C_ERR=""; C_INFO=""; C_BOLD=""
fi

step() { printf '\n%s==>%s %s%s%s\n' "$C_INFO" "$C_RESET" "$C_BOLD" "$*" "$C_RESET"; }
info() { printf '    %s\n' "$*"; }
ok()   { printf '    %s✓%s %s\n' "$C_OK" "$C_RESET" "$*"; }
warn() { printf '    %s!%s %s\n' "$C_ERR" "$C_RESET" "$*"; }
die()  { printf '\n%s✗ %s%s\n\n' "$C_ERR" "$*" "$C_RESET" >&2; exit 1; }

run() {
  if [ "$DRY_RUN" -eq 1 ]; then
    printf '    %s$ %s%s\n' "$C_DIM" "$*" "$C_RESET"
    return 0
  fi
  "$@"
}

# ------------------------------------------------------------------ 参数
while [ $# -gt 0 ]; do
  case "$1" in
    --host)     HOST="${2:-}"; shift 2 ;;
    --user)     SSH_USER="${2:-}"; shift 2 ;;
    --ssh-port) SSH_PORT="${2:-}"; shift 2 ;;
    --key)      SSH_KEY="${2:-}"; shift 2 ;;
    --dir)      APP_DIR="${2:-}"; shift 2 ;;
    --port)     APP_PORT="${2:-}"; shift 2 ;;
    --domain)   SERVER_NAME="${2:-}"; shift 2 ;;
    --no-nginx) DO_NGINX=0; shift ;;
    --dry-run)  DRY_RUN=1; shift ;;
    -h|--help)  sed -n '3,19p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *)          die "未知参数：$1（用 --help 查看用法）" ;;
  esac
done

[ -n "$HOST" ] || die "缺少 --host（ECS 公网 IP）。用 --help 查看用法。"

case "$APP_PORT" in
  ''|*[!0-9]*) die "--port 必须是数字" ;;
esac
[ "$APP_PORT" -ge 1 ] && [ "$APP_PORT" -le 65535 ] || die "--port 需在 1-65535 之间"

# SSH 基础参数
SSH_OPTS=(-p "$SSH_PORT" -o ConnectTimeout=15 -o StrictHostKeyChecking=accept-new)
SCP_OPTS=(-P "$SSH_PORT" -o ConnectTimeout=15 -o StrictHostKeyChecking=accept-new)
if [ -n "$SSH_KEY" ]; then
  [ -f "$SSH_KEY" ] || die "私钥不存在：$SSH_KEY"
  SSH_OPTS+=(-i "$SSH_KEY")
  SCP_OPTS+=(-i "$SSH_KEY")
fi

ssh_run() { ssh "${SSH_OPTS[@]}" "$SSH_USER@$HOST" "$@"; }

printf '%s╭──────────────────────────────────────────╮%s\n' "$C_BOLD" "$C_RESET"
printf '%s│  DevToolbox  →  阿里云 ECS 部署          │%s\n' "$C_BOLD" "$C_RESET"
printf '%s╰──────────────────────────────────────────╯%s\n' "$C_BOLD" "$C_RESET"
info "目标主机    $SSH_USER@$HOST:$SSH_PORT"
info "部署目录    $APP_DIR"
info "服务端口    $APP_PORT"
info "域名        $SERVER_NAME"
[ "$DRY_RUN" -eq 1 ] && warn "DRY-RUN 模式，不会做任何实际改动"

# ------------------------------------------------------------------ 1. 本地检查
step "检查本地文件"
for f in index.html css/style.css js/app.js js/lib.js server.js; do
  [ -f "$PROJECT_DIR/$f" ] || die "缺少文件：$f"
done
ok "站点文件完整"
for f in "$PROJECT_DIR"/js/*.js "$PROJECT_DIR/server.js"; do
  command -v node >/dev/null 2>&1 && node --check "$f" || true
done
ok "JS 语法检查通过"

# ------------------------------------------------------------------ 2. 连通性
step "测试 SSH 连接"
if [ "$DRY_RUN" -eq 1 ]; then
  info "$ ssh ${SSH_OPTS[*]} $SSH_USER@$HOST 'echo ok'"
else
  ssh_run 'echo ok' >/dev/null 2>&1 || die "SSH 连接失败。请检查：1) IP 是否正确  2) 安全组是否放行 $SSH_PORT  3) 用户名/密钥是否匹配"
fi
ok "连接正常"

REMOTE_OS="$( [ "$DRY_RUN" -eq 1 ] && echo "Linux" || ssh_run 'uname -s 2>/dev/null || echo Linux' )"
info "远端系统  $REMOTE_OS"

# ------------------------------------------------------------------ 3. 打包
step "打包站点文件"
rm -rf "$STAGE_DIR"
mkdir -p "$STAGE_DIR/devtoolbox"

copy_file() { cp -f "$PROJECT_DIR/$1" "$STAGE_DIR/devtoolbox/$1"; }

copy_file index.html
copy_file 404.html
copy_file server.js
copy_file README.md
copy_file robots.txt
copy_file sitemap.xml
copy_file og-cover.png
mkdir -p "$STAGE_DIR/devtoolbox/css" "$STAGE_DIR/devtoolbox/js" "$STAGE_DIR/devtoolbox/vendor"
cp -f "$PROJECT_DIR"/css/*.css        "$STAGE_DIR/devtoolbox/css/"
cp -f "$PROJECT_DIR"/js/*.js          "$STAGE_DIR/devtoolbox/js/"
cp -f "$PROJECT_DIR"/vendor/*.js      "$STAGE_DIR/devtoolbox/vendor/"

# 把 SEO 文件里的占位域名替换成真实域名
PLACEHOLDER_DOMAIN="tools.example.com"
if [ -n "$SERVER_NAME" ] && [ "$SERVER_NAME" != "_" ]; then
  SITE_URL="https://$SERVER_NAME"
  for f in index.html robots.txt sitemap.xml; do
    if grep -q "$PLACEHOLDER_DOMAIN" "$STAGE_DIR/devtoolbox/$f" 2>/dev/null; then
      sed -i.bak "s|https://$PLACEHOLDER_DOMAIN|$SITE_URL|g" "$STAGE_DIR/devtoolbox/$f"
      rm -f "$STAGE_DIR/devtoolbox/$f.bak"
    fi
  done
  ok "SEO 域名已替换为 $SITE_URL"
else
  warn "未指定 --domain，robots.txt / sitemap.xml / canonical 仍是占位域名 $PLACEHOLDER_DOMAIN"
  info "上线后请执行：sed -i 's|tools.example.com|你的域名|g' index.html robots.txt sitemap.xml"
fi

# 生成版本标记，便于确认线上是哪个版本
GIT_REV="$( git -C "$PROJECT_DIR" rev-parse --short HEAD 2>/dev/null || echo "nogit" )"
BUILD_TIME="$( date -u +%Y-%m-%dT%H:%M:%SZ )"
cat > "$STAGE_DIR/devtoolbox/version.json" <<EOF
{
  "name": "DevToolbox",
  "port": $APP_PORT,
  "revision": "$GIT_REV",
  "builtAt": "$BUILD_TIME",
  "tools": 16
}
EOF

TARBALL="$STAGE_DIR/devtoolbox.tar.gz"
( cd "$STAGE_DIR" && tar -czf "$TARBALL" devtoolbox )
SIZE="$( du -h "$TARBALL" | cut -f1 )"
ok "打包完成（$SIZE）"

# ------------------------------------------------------------------ 4. 上传
step "上传到服务器"
REMOTE_TMP="/tmp/devtoolbox-$(date +%s).tar.gz"
run scp "${SCP_OPTS[@]}" "$TARBALL" "$SSH_USER@$HOST:$REMOTE_TMP" >/dev/null
ok "已上传 $SIZE"

# ------------------------------------------------------------------ 5. 远端部署
step "部署文件到 $APP_DIR"

REMOTE_SCRIPT=$(cat <<REMOTE
set -e

APP_DIR="$APP_DIR"
PORT="$APP_PORT"
TARBALL="$REMOTE_TMP"
STAMP=\$(date +%Y%m%d-%H%M%S)

sudo mkdir -p "\$APP_DIR"

# 备份旧版本（保留最近 5 份）
if [ -f "\$APP_DIR/index.html" ]; then
  sudo tar -czf "/tmp/devtoolbox-backup-\$STAMP.tar.gz" -C "\$APP_DIR" . 2>/dev/null || true
  echo "  · 已备份旧版本 /tmp/devtoolbox-backup-\$STAMP.tar.gz"
  ls -1t /tmp/devtoolbox-backup-*.tar.gz 2>/dev/null | tail -n +6 | xargs -r sudo rm -f
fi

# 解压覆盖
sudo rm -rf "\$APP_DIR.new"
sudo mkdir -p "\$APP_DIR.new"
sudo tar -xzf "\$TARBALL" -C "\$APP_DIR.new" --strip-components=1
sudo rm -rf "\$APP_DIR"/*
sudo cp -a "\$APP_DIR.new/." "\$APP_DIR/"
sudo rm -rf "\$APP_DIR.new" "\$TARBALL"

# 权限：Nginx 以 www-data / nginx 运行
OWNER="www-data"
id -u www-data >/dev/null 2>&1 || OWNER="nginx"
sudo chown -R "\$OWNER":"\$OWNER" "\$APP_DIR" 2>/dev/null || true
sudo find "\$APP_DIR" -type d -exec chmod 755 {} \;
sudo find "\$APP_DIR" -type f -exec chmod 644 {} \;

echo "  · 文件已就位 \$(find "\$APP_DIR" -type f | wc -l) 个"
REMOTE
)

if [ "$DRY_RUN" -eq 1 ]; then
  printf '    %s$ ssh ... <<REMOTE (部署脚本 %s 行)%s\n' "$C_DIM" "$(printf '%s' "$REMOTE_SCRIPT" | wc -l)" "$C_RESET"
else
  ssh_run "bash -s" <<< "$REMOTE_SCRIPT"
fi
ok "文件部署完成"

# ------------------------------------------------------------------ 6. Nginx
if [ "$DO_NGINX" -eq 1 ]; then
  step "配置 Nginx（监听 $APP_PORT）"

  # 先检查 Nginx 是否存在
  HAS_NGINX="$( [ "$DRY_RUN" -eq 1 ] && echo 1 || ssh_run 'command -v nginx >/dev/null 2>&1 && echo 1 || echo 0' )"
  if [ "$HAS_NGINX" != "1" ]; then
    warn "远端未安装 Nginx"
    info "安装：sudo yum install -y nginx   （CentOS/Alibaba Cloud Linux）"
    info "     sudo apt install -y nginx   （Ubuntu/Debian）"
    info "或加 --no-nginx 只上传文件。"
    exit 1
  fi

  CONF_TMP="/tmp/devtoolbox.nginx.conf"
  sed -e "s|root /var/www/devtoolbox;|root $APP_DIR;|" \
      -e "s|listen 3100;|listen $APP_PORT;|" \
      -e "s|listen \[::\]:3100;|listen [::]:$APP_PORT;|" \
      -e "s|server_name _;|server_name $SERVER_NAME;|" \
      "$SCRIPT_DIR/nginx-devtoolbox.conf" > "$STAGE_DIR/devtoolbox.nginx.conf"

  run scp "${SCP_OPTS[@]}" "$STAGE_DIR/devtoolbox.nginx.conf" "$SSH_USER@$HOST:$CONF_TMP" >/dev/null

  NGINX_SCRIPT=$(cat <<NGINX
set -e

CONF_SRC="$CONF_TMP"
CONF_DST="/etc/nginx/conf.d/devtoolbox.conf"

# 端口冲突检查
if sudo ss -lntp 2>/dev/null | grep -q ":$APP_PORT "; then
  echo "  ! 警告：$APP_PORT 已被占用"
  sudo ss -lntp 2>/dev/null | grep ":$APP_PORT " || true
fi

sudo cp "\$CONF_SRC" "\$CONF_DST"
sudo rm -f "\$CONF_SRC"

if sudo nginx -t 2>&1; then
  if command -v systemctl >/dev/null 2>&1; then
    sudo systemctl reload nginx 2>/dev/null || sudo systemctl restart nginx
  else
    sudo nginx -s reload
  fi
  echo "  · Nginx 已重新加载"
else
  echo "  ✗ Nginx 配置有误，已回滚"
  sudo rm -f "\$CONF_DST"
  exit 1
fi
NGINX
)

  if [ "$DRY_RUN" -eq 1 ]; then
    info "$ ssh ... '写入 /etc/nginx/conf.d/devtoolbox.conf 并 reload'"
  else
    ssh_run "bash -s" <<< "$NGINX_SCRIPT"
  fi
  ok "Nginx 配置完成"
fi

# ------------------------------------------------------------------ 7. 验证
step "验证服务"
if [ "$DRY_RUN" -eq 0 ]; then
  CODE="$( ssh_run "curl -s -o /dev/null -w '%{http_code}' -m 8 http://127.0.0.1:$APP_PORT/ || echo 000" )"
  if [ "$CODE" = "200" ]; then
    ok "本机自检 HTTP 200"
  else
    warn "本机自检返回 $CODE，请检查 Nginx 日志：sudo tail -30 /var/log/nginx/devtoolbox.error.log"
  fi

  # 安全组提示
  if ssh_run "command -v firewall-cmd >/dev/null 2>&1"; then
    info "远端启用了 firewalld，放行端口："
    info "  sudo firewall-cmd --permanent --add-port=$APP_PORT/tcp && sudo firewall-cmd --reload"
  fi
fi

rm -rf "$STAGE_DIR"

# ------------------------------------------------------------------ 完成
printf '\n%s╭──────────────────────────────────────────╮%s\n' "$C_OK" "$C_RESET"
printf '%s│  部署完成                                │%s\n' "$C_OK" "$C_RESET"
printf '%s╰──────────────────────────────────────────╯%s\n' "$C_OK" "$C_RESET"
info "访问地址  http://$HOST:$APP_PORT/"
printf '\n%s别忘了：%s阿里云控制台 → 安全组 → 入方向 → 放行 TCP %s（授权对象 0.0.0.0/0）\n\n' "$C_BOLD" "$C_RESET" "$APP_PORT"
