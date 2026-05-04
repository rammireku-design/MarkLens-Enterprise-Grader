# MarkLens Enterprise Grader

A full-stack, AI-powered Optical Character Recognition (OCR) grading system built for educational institutions. This platform allows educators to upload handwritten student scripts, automatically extract text, and grade them against strict logical marking schemes using Google Gemini's multimodal AI.

## 🚀 Key Features

* **Intelligent OCR Extraction:** Leverages Google Gemini Vision to accurately transcribe handwritten student responses.
* **Automated Semantic Grading:** Grades transcribed text against predefined marking scheme logic, rather than simple keyword matching.
* **Offline-First Resiliency:** Utilizes IndexedDB to queue and cache grading tasks if the network connection drops, automatically syncing to the cloud when reconnected.
* **Intelligent Retry Loop Engine:** Implements exponential backoff to handle AI API rate limits and network timeouts without disrupting the user experience.
* **Secure API Proxy:** Routes all AI traffic through Supabase Edge Functions to securely hide proprietary API keys from the client browser.
* **Dynamic Data Export:** Generates downloadable, fully justified PDF and CSV grading reports.

## 🛠️ Tech Stack & Architecture

* **Frontend Core:** React (Vite), JavaScript (ES6+), React Context API
* **Styling & UI:** Custom CSS (Glassmorphism, Dark Mode), Lucide React
* **Backend & Database:** Supabase (PostgreSQL), Supabase Edge Functions (Deno)
* **AI Engine:** Google Gemini (1.5 Flash / 2.0 Flash)
* **Local Data Management:** IndexedDB (`idb`) for offline sync queues.

## 🔐 Security & Data Integrity

1. **Zero-Trust Client:** No API keys are exposed in the frontend. All AI calls are strictly authenticated and proxied through serverless edge functions.
2. **Atomic Database Updates:** Prevents database bloat and duplication by dynamically identifying and overwriting partial-error historical records during retry workflows.
