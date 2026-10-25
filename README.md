# RemindMeWhy 

> **Your temporary screenshot layer.** Turn fleeting screenshots into actionable reminders and organized temporary memory cards using Google Gemini AI.

---

## Overview

People frequently take screenshots as quick reminders — flight tickets, event flyers, Wi-Fi credentials, receipts, or addresses. Over time, camera rolls become cluttered with stale images that lose context.

**RemindMeWhy** acts as an intelligent temporary layer:
1. **Capture & Compress**: Pick or capture screenshots from your gallery.
2. **AI Semantic Extraction**: Send images to a FastAPI backend powered by **Google Gemini 1.5 Flash**.
3. **Structured Memory Cards**: The AI parses key details (category, title, summary, expiration time, actionable reminder time) and organizes them into sleek dark-mode cards.

---

## Features

- **Screenshot Scanning & Compression**: Compress images before network transfer to reduce latency and token usage.
- **Multimodal AI Analysis**: Uses Gemini 1.5 Flash with structured JSON system prompts to extract actionable data and filter out noise/memes.
- **Dynamic Categorization**: Automatic classification into categories like `flight`, `event`, `receipt`, `wifi`, `address`, `contact`, `payment`, and `other`.
- **Smart Reminders**: Automatically infers reminders and expiration timestamps relative to the capture time.
- **Dark Mode UI**: Clean, responsive mobile interface built with Expo, React Native, and Material Icons.

---

## Architecture & Tech Stack

- **Mobile App**: React Native, Expo SDK 58, TypeScript, `expo-image-picker`, `@expo/vector-icons`.
- **Backend Service**: FastAPI (Python 3.13), Uvicorn ASGI server, `python-multipart`.
- **AI Model**: Google Gemini (`gemini-1.5-flash`) via `google-generativeai`.

---

## Getting Started

### 1. Prerequisites

- [Node.js](https://nodejs.org/) (v20+)
- [Python](https://www.python.org/) (v3.10+)
- [Expo Go](https://expo.dev/go) app on your mobile device or an iOS/Android simulator.
- A [Google Gemini API Key](https://aistudio.google.com/).

### 2. Backend Setup

```bash
cd backend
python -m venv venv

# Windows
.\venv\Scripts\activate

# macOS / Linux
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment variables
cp .env.example .env
# Edit .env and paste your GEMINI_API_KEY
```

Run the backend server:
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 3. Mobile App Setup

In the root directory:
```bash
npm install
npx expo start
```

Update your computer's local IP address in the mobile app API endpoint to allow network communication between your physical device and the backend server.
