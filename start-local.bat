@echo off
chcp 65001 > nul
cd /d "%~dp0"
echo.
echo SD Prompt Studio をローカルネットワーク向けに起動します。
echo 起動後に表示される Network のURLを、同じLAN内の端末で開いてください。
echo.
call npm.cmd run dev
pause
