@echo off
chcp 65001 >nul
title Cap Nhat Code Len VPS - thuesanhbaq3.mindigi.vn
echo ============================================================
echo   DANG KET NOI VA CAP NHAT CODE MOI NHAT LEN VPS...
echo ============================================================
echo.
echo VPS: 103.200.22.218 (thuesanhbaq3.mindigi.vn)
echo Thu muc: /var/www/thuesanhbaq3
echo.

ssh -i "%USERPROFILE%\.ssh\id_rsa_vps" -o StrictHostKeyChecking=no root@103.200.22.218 "cd /var/www/thuesanhbaq3 && echo '[1/2] Dang keo code moi tu GitHub...' && git pull origin main && echo '' && echo '[2/2] Dang khoi dong lai Node.js...' && pm2 restart thuesanhbaq3"

echo.
echo ============================================================
echo   HOAN TAT! Website tren VPS da duoc cap nhat thanh cong.
echo   Dia chi web: http://thuesanhbaq3.mindigi.vn
echo ============================================================
echo.
pause
