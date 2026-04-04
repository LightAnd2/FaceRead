# Emotion Recognizer

Real-time emotion detection and gender recognition straight from your webcam — no account, no cloud, runs entirely in your browser.

---

## What it does

Point your camera at a face and the app will:

- Detect the dominant emotion (happy, sad, angry, surprised, neutral, fear, disgust) with confidence scores for all seven
- Guess the gender and confidence
- Draw a labeled bounding box around each face
- Handle multiple faces at once

Everything runs client-side using [face-api.js](https://github.com/justadudewhohacks/face-api.js) — no data ever leaves your machine.

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | React + Vite |
| ML | face-api.js (TinyFaceDetector + FaceExpressionNet + AgeGenderNet) |
| Optional backend | Python + Flask + DeepFace (higher accuracy, not required) |

---

## Getting started

**You only need Node to run this.** The Python backend is optional.

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), hit **Start Camera**, and allow webcam access. Models load in a couple seconds on first run (they're cached after that).

---

## Optional: Python backend

The repo also includes a Flask + DeepFace backend that uses heavier models and tends to be more accurate, at the cost of ~300–500ms per frame instead of real-time.

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python app.py
```

Runs on port 5001. The frontend proxies `/analyze` there automatically when the Vite dev server is running — just swap `WebcamFeed.jsx` back to the fetch-based version if you want to use it.

Or use the convenience script to run both at once:

```bash
./start.sh
```

---

## Project structure

```
EmotionRecognizer/
├── frontend/
│   ├── public/models/        # face-api.js model weights (~1MB)
│   ├── src/
│   │   ├── App.jsx
│   │   ├── App.css
│   │   └── components/
│   │       ├── WebcamFeed.jsx     # camera + in-browser ML
│   │       └── EmotionDisplay.jsx # overlay UI
│   └── package.json
├── backend/
│   ├── app.py                # Flask + DeepFace (optional)
│   └── requirements.txt
└── start.sh                  # runs both frontend + backend
```

---

## Notes

- First camera start takes 1–2 seconds while the models initialize
- Works best with decent lighting and a reasonably frontal face
- Disgust is genuinely hard to trigger — that's the model, not you
