@echo off
cd /d "%~dp0"
if not exist .venv ( python -m venv .venv )
call .venv\Scripts\activate
pip install -q -r requirements.txt
if not exist .env ( echo Crie o arquivo .env a partir do .env.example e preencha DATABASE_URL & pause & exit /b )
python app.py
pause
