@echo off
echo =================================================================
echo  INICIANDO GERENCIADOR DE FRASES RADIOLOGICAS
echo =================================================================

REM Define o diretorio do script
set SCRIPT_DIR=%~dp0

REM Navega para a pasta do backend
cd /d "%SCRIPT_DIR%backend"

echo.
echo Verificando dependencias do Python...

REM Verifica se o pip esta instalado
python -m pip --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Python ou pip nao encontrado no PATH. Por favor, instale Python e adicione ao PATH.
    pause
    exit /b
)

REM Instala as dependencias a partir do requirements.txt (se existir) ou diretamente
pip install flask flask-cors >nul

echo.
echo Iniciando o servidor Flask...
echo (Esta janela do terminal precisa permanecer aberta)
echo.

REM Inicia o servidor Flask em uma nova janela e abre o navegador
start "Servidor Flask" cmd /c "python app.py"

echo Aguardando o servidor iniciar...
timeout /t 3 /nobreak >nul

echo.
echo Abrindo a aplicacao no Google Chrome...
start chrome "http://127.0.0.1:5000"

echo.
echo =================================================================
echo  Tudo pronto! A aplicacao esta rodando.
echo =================================================================
