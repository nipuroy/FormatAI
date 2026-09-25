# FormatAI

FormatAI is an AI-powered academic document formatting application. It transforms raw, unformatted AI-generated content (from ChatGPT, Gemini, NotebookLM, Claude, Copilot, Perplexity, etc.) into professionally structured, publication-grade academic documents with editable DOCX export.

## Architecture

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS
- **Backend**: Python 3.10+, FastAPI, Pydantic, Uvicorn
- **Document Processing Engine**: Python-based (`python-docx`, Pandoc integration)
- **AI Engine**: Provider-independent architecture with initial Google Gemini integration

## Repository Structure

```
FormatAI/
├── backend/
│   ├── __init__.py
│   ├── main.py
│   └── requirements.txt
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── src/
│   │   ├── App.tsx
│   │   ├── index.css
│   │   └── main.tsx
│   ├── tsconfig.json
│   └── vite.config.ts
├── tests/
│   ├── __init__.py
│   └── test_health.py
├── .env.example
├── .gitignore
└── README.md
```

## Getting Started

### 1. Environment Configuration

Copy the example environment file and configure your variables:

```bash
cp .env.example .env
```

### 2. Backend (Python + FastAPI)

#### Prerequisites
- Python 3.10+
- `pip` or `venv`

#### Installation & Execution

```bash
# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r backend/requirements.txt

# Run the FastAPI server
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```

Backend will be available at:
- **Root**: `http://localhost:8000/`
- **Health Check**: `http://localhost:8000/api/health`
- **Interactive OpenAPI Documentation**: `http://localhost:8000/docs`

### 3. Frontend (React + TypeScript + Vite)

#### Prerequisites
- Node.js 18+
- npm or bun

#### Installation & Execution

```bash
# Install frontend dependencies
npm install

# Start Vite development server
npm run dev
```

Frontend will be available at:
- `http://localhost:3000`

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | Confirms Python FastAPI backend is running |
| `GET` | `/api/health` | Health check returning status, service name, and backend language |
