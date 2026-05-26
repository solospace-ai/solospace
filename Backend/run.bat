@echo off
echo Starting Solospace Python Backend Setup...
cd /d "%~dp0"

if not exist venv (
    echo Creating virtual environment...
    python -m venv venv
)

echo Activating virtual environment...
call venv\Scripts\activate.bat

echo Installing dependencies...
python -m pip install --upgrade pip
pip install -r requirements.txt

echo Starting FastAPI server with Uvicorn...
uvicorn main:app --host 127.0.0.1 --port 8000 --reload
