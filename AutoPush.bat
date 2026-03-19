@echo off
chcp 65001 >nul
echo ------------------------------------------------------------
echo DANG TU DONG DONG BO MA NGUON LEN GITHUB VA NETLIFY...
echo ------------------------------------------------------------
echo.

git add .
git commit -m "Tu dong cap nhat tinh nang Firebase %date% %time%"
git push origin main

echo.
echo ------------------------------------------------------------
echo HOAN TAT! 
echo Code moi da duoc day len GitHub thanh cong.
echo He thong Netlify se tu dong cap nhat website sau ~10 giay.
echo ------------------------------------------------------------
pause
