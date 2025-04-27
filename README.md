# CanvasPal

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)  
[![ChatGPT-powered](https://img.shields.io/badge/AI–Powered–Perplexity-blue?logo=openai)]()

CanvasPal is a Next.js + TypeScript application that transforms your Canvas learning platform into an AI-driven study assistant. Leveraging Perplexity’s LLM and the Canvas API, CanvasPal can:

- **Discover** your courses, assignments, announcements, grades, and people.  
- **Plan** multi-step workflows in natural language.  
- **Execute** Canvas queries via serverless functions and a Python bridge.  
- **Summarize** results in clear, conversational prose.  
- **Theme** itself with light/dark modes powered by Tailwind CSS v4’s CSS-first configuration.  
- **Deploy** instantly on Vercel using Next.js App Router and Turbopack.

---

## 📋 Table of Contents

1. [Features](#✨-features)  
2. [Architecture Overview](#🏛️-architecture-overview)  
3. [Tech Stack](#🛠-tech-stack)  
4. [Getting Started](#🚀-getting-started)  
   - [Prerequisites](#prerequisites)  
   - [Installation](#installation)  
   - [Environment Variables](#environment-variables)  
   - [Running Locally](#running-locally)  
   - [Deployment](#deployment)  
5. [Project Structure](#📁-project-structure)  
6. [How It Works](#🔍-how-it-works)  
7. [Contributing](#🤝-contributing)  
8. [License](#📄-license)  

---

## ✨ Features

- **Natural-Language Planning**  
  Auto-generate step-by-step plans (e.g. “List my unsubmitted assignments in Systems I”) via an LLM prompt.

- **Tool-Driven Execution**  
  Execute Canvas API calls through a Python bridge (`tool_caller.py`), retrying until all IDs are discovered.

- **Live Streaming UI**  
  SSE (Server-Sent Events) in `route.ts` streams plan, status, steps, and final summary to the client.

- **Dark/Light Modes**  
  Seamlessly switch themes with CSS variables—no JavaScript config file needed.

- **Persistent Chat Context**  
  Stores conversation in `sessionStorage`, auto-scrolls, and supports cancellation.

- **Extensible**  
  Easily add new Canvas tools by updating the `TOOLS` mapping in `tool_caller.py`.

---

## 🏛️ Architecture Overview

```
User Browser
└─▶ Next.js App (Client)
├─ Chat UI (React + Framer Motion)
└─ API Route (POST /api/chat)
├─ getPlan() → LLM (Perplexity)
├─ execStep() → LLM → { tool? | result }
├─ runTool() → Python tool_caller.py → Canvas API
└─ Summary → LLM
```

---

## 🛠 Tech Stack

| Layer           | Technology                          |
| --------------- | ----------------------------------- |
| Framework       | Next.js 15 (App Router, Turbopack)  |
| Language        | TypeScript & Python                 |
| Styling         | Tailwind CSS v4 (CSS-first config)  |
| LLM Integration | Perplexity API (“sonar-pro” model)  |
| Canvas Bridge   | canvasapi Python library            |
| Deployment      | Vercel (serverless functions)       |

---

## 🚀 Getting Started

### Prerequisites

- Node.js 20+  
- Python 3.10+  
- Vercel account (for deployment)  
- Canvas API credentials  

### Installation

1. **Clone the repo**  
   ```bash
   git clone https://github.com/your-org/canvaspal.git
   cd canvaspal
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Python setup**
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   ```

### Environment Variables

Create a `.env.local` file in the project root:

```env
# Next.js / Perplexity
PERPLEXITY_API_KEY=your_perplexity_key

# Canvas API
CANVAS_API_URL=https://canvas.your.school/api/v1
CANVAS_API_KEY=your_canvas_key

# Optional debug
DEBUG=true
```

### Running Locally

```bash
# Start Next.js development server
npm run dev

# In a separate shell, run the Python bridge (optional)
.venv/bin/python tool_caller.py
```

Visit <http://localhost:3000> to try it out.

### Deployment

1. Push to GitHub.
2. Connect your repo to Vercel.
3. Add the same environment variables in Vercel’s dashboard.
4. Deploy – CanvasPal goes live!

---

## 🔍 How It Works

1. **Client** sends chat history + user query to `/api/chat`.
2. **Server** streams SSE events:
    - **plan**: JSON array of steps from the LLM.
    - **status**: current action.
    - **step**: each completed step.
    - **summary**: final conversational reply.
3. **Execution** of Canvas API calls happens via the Python bridge (`tool_caller.py`).

---

## 🤝 Contributing

1. Fork & create a branch:
   ```bash
   git checkout -b feature/my-new-tool
   ```
2. Implement your feature or fix.
3. Add tests/documentation if needed.
4. Open a pull request against `main`.

Please follow our [CODE_OF_CONDUCT](CODE_OF_CONDUCT.md).

---

## 📄 License

This project is released under the MIT License. See [LICENSE](LICENSE) for details.

---

*Happy studying with CanvasPal!* 🚀
