@echo off
chcp 65001 > nul
title Cloudflare Tunnel - Mo link HTTPS Public cho Ollama AI Vision (BaSa3D)
echo ========================================================
echo        DANG KHOI TAO DUONG TRUYEN PUBLIC HTTPS
echo             CHO OLLAMA AI VISION (RTX 4060)
echo ========================================================
echo.
echo Hay chu y dong co chu:
echo   https://xxxxxxxx.trycloudflare.com
echo.
echo Link HTTPS nay se dan thang vao GPU RTX 4060 tren may cua ban!
echo Khi deploy len Web Netlify/Vercel, ban co the dien link nay vao bien
echo moi truong OLLAMA_HOST de web goi truc tiep ve GPU nha ban
echo (0 dong token, hoan toan mien phi va rieng tu).
echo ========================================================
echo.
if exist "..\BaSaTTS\cloudflared.exe" (
  ..\BaSaTTS\cloudflared.exe tunnel --url http://localhost:11434
) else if exist "cloudflared.exe" (
  cloudflared.exe tunnel --url http://localhost:11434
) else (
  cloudflared tunnel --url http://localhost:11434
)
pause
