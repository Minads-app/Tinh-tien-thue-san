@echo off
chcp 65001 >nul
title Dong Bo Code Len GitHub & VPS - thuesanhbaq3.mindigi.vn
echo ============================================================
echo BUOC 1: DANG DAY MA NGUON TU MAY TINH LEN GITHUB...
echo ============================================================
echo.

git add .
git commit -m "Tu dong cap nhat tinh nang %date% %time%"
git push origin main

echo.
echo ============================================================
echo BUOC 2: DANG TU DONG DONG BO LEN VPS (103.200.22.218)...
echo ============================================================
echo.

ssh -i "%USERPROFILE%\.ssh\id_rsa_vps" -o StrictHostKeyChecking=no root@103.200.22.218 "cd /var/www/thuesanhbaq3 && echo '[1/2] Dang keo code moi tu GitHub...' && git pull origin main && echo '' && echo '[2/2] Dang khoi dong lai server Node.js...' && pm2 restart thuesanhbaq3"

echo.
echo ============================================================
echo HOAN TAT TOAN BO!
echo 1. Code moi da day len GitHub.
echo 2. VPS da cap nhat va khoi dong lai server thanh cong.
echo Web: http://thuesanhbaq3.mindigi.vn
echo ============================================================
pause
