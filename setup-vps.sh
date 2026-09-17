#!/bin/bash
# ============================================================
# SCRIPT TU DONG CAI DAT DU AN QUAN LY THUE SAN
# Domain: thuesanhbaq3.mindigi.vn
# VPS: 103.200.22.218
# ============================================================
set -e

echo ""
echo "============================================"
echo "  DANG CAI DAT DU AN QUAN LY THUE SAN..."
echo "  Vui long doi khoang 3-5 phut"
echo "============================================"
echo ""

# 1. CAP NHAT HE THONG
echo "[1/8] Cap nhat he thong..."
apt-get update -y -qq

# 2. CAI DAT NODE.JS 20 BANG NVM
echo "[2/8] Cai dat Node.js 20..."
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm install 20
nvm use 20
nvm alias default 20

# Tao symlink de PM2 va system deu thay Node
NODE_PATH=$(which node)
NPM_PATH=$(which npm)
ln -sf "$NODE_PATH" /usr/local/bin/node
ln -sf "$NPM_PATH" /usr/local/bin/npm
ln -sf "$(dirname $NODE_PATH)/npx" /usr/local/bin/npx

echo "  Node: $(node -v)"
echo "  NPM:  $(npm -v)"

# 3. CAI DAT PM2
echo "[3/8] Cai dat PM2..."
npm install -g pm2
ln -sf $(which pm2) /usr/local/bin/pm2
echo "  PM2:  $(pm2 -v)"

# 4. CAI DAT NGINX
echo "[4/8] Cai dat Nginx..."
apt-get install -y -qq nginx
systemctl enable nginx
systemctl start nginx
echo "  Nginx da cai xong"

# 5. CLONE DU AN TU GITHUB
echo "[5/8] Clone du an tu GitHub..."
mkdir -p /var/www/thuesanhbaq3
cd /var/www/thuesanhbaq3
if [ -d ".git" ]; then
    echo "  Thu muc da co, dang cap nhat..."
    git pull origin main
else
    git clone https://github.com/Minads-app/Tinh-tien-thue-san.git .
fi
echo "  Clone thanh cong!"

# 6. CAI THU VIEN NPM
echo "[6/8] Cai thu vien npm..."
cd /var/www/thuesanhbaq3
npm install
echo "  npm install xong"

# 7. CAU HINH NGINX
echo "[7/8] Cau hinh Nginx reverse proxy..."
mkdir -p /etc/nginx/sites-available /etc/nginx/sites-enabled

# Dam bao nginx.conf include sites-enabled
if ! grep -q "sites-enabled" /etc/nginx/nginx.conf 2>/dev/null; then
    sed -i '/http {/a \    include /etc/nginx/sites-enabled/*.conf;' /etc/nginx/nginx.conf 2>/dev/null || true
fi

cat > /etc/nginx/sites-available/thuesanhbaq3.conf << 'NGINXEOF'
server {
    listen 80;
    server_name thuesanhbaq3.mindigi.vn;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
NGINXEOF

ln -sf /etc/nginx/sites-available/thuesanhbaq3.conf /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
echo "  Nginx da cau hinh xong"

# 8. BAT SSH PASSWORD + CAI CERTBOT
echo "[8/8] Bat SSH password va cai Certbot..."
sed -i 's/PasswordAuthentication no/PasswordAuthentication yes/g' /etc/ssh/sshd_config
systemctl restart sshd
apt-get install -y -qq certbot python3-certbot-nginx 2>/dev/null || true

echo ""
echo "============================================"
echo "  CAI DAT XONG! CON 2 BUOC NUA:"
echo "============================================"
echo ""
echo "  BUOC A: Tao file .env"
echo "    Vao aaPanel -> File Manager"
echo "    Mo thu muc /var/www/thuesanhbaq3/"
echo "    Tao file moi ten '.env' va dan noi dung vao"
echo ""
echo "  BUOC B: Khoi dong server"
echo "    cd /var/www/thuesanhbaq3"
echo "    pm2 start server.js --name thuesanhbaq3"
echo "    pm2 save"
echo ""
echo "============================================"