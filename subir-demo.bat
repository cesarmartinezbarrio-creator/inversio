@echo off
chcp 65001 >nul
cd /d "C:\Personal\inversio-despliegue\inversio"

echo ===============================================
echo   Subiendo la demo a GitHub
echo ===============================================
echo.

echo [1/4] Que ha cambiado:
git status --short
echo.

echo [2/4] Anadiendo los dos ficheros...
git add frontend/index.html supabase/cuenta-demo.sql
if errorlevel 1 goto error

echo [3/4] Commit...
git commit -m "Demo de 12 meses y cuenta de demostracion bloqueada"
if errorlevel 1 (
  echo.
  echo AVISO: el commit no ha hecho nada.
  echo Lo normal es que ya estuviera commiteado. Sigo con el push.
  echo.
)

echo [4/4] Push...
git push
if errorlevel 1 goto error

echo.
echo ===============================================
echo   HECHO. Subido a GitHub.
echo.
echo   RECUERDA: esto NO despliega el frontend.
echo   index.html hay que subirlo a mano a Hostinger
echo   (gestor de archivos - public_html) o el enlace
echo   ?demo seguira ensenando un solo mes.
echo ===============================================
echo.
pause
exit /b 0

:error
echo.
echo ===============================================
echo   ALGO HA FALLADO. Lee el mensaje de arriba y
echo   copiamelo al chat.
echo ===============================================
echo.
pause
exit /b 1
