# FaceRead

Real-time emotion detection and gender recognition straight from your webcam — no account, no cloud, runs entirely in your browser.

---

## What it does

Point your camera at a face and it will:

- Detect the dominant emotion (happy, sad, angry, surprised, neutral, fear, disgust) with confidence scores for all seven
- Predict gender with a confidence percentage
- Draw a labeled bounding box around each detected face
- Handle multiple faces at once

Everything runs client-side — no data ever leaves your machine.

---

## How it's built

The frontend is **React + Vite**. When you hit Start Camera, it accesses your webcam via the browser's `getUserMedia` API and feeds each frame into **face-api.js**, a JavaScript ML library that runs three neural networks directly in the browser using WebGL:

- **TinyFaceDetector** — finds faces in the frame
- **FaceExpressionNet** — classifies the expression into 7 emotions
- **AgeGenderNet** — estimates gender and age

Because everything runs in-browser, there's no server involved and no latency from network round-trips. Detection runs at roughly 15–30fps depending on your hardware.

The repo also includes an optional **Python + Flask + DeepFace** backend that uses heavier models for higher accuracy at the cost of ~300–500ms per frame. The frontend proxies `/analyze` to it automatically if you have it running.

---

## Run the app

You just need Node installed.

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), hit **Start Camera**, and allow webcam access. The models (~1MB) load in a couple seconds on first run and are cached after that.

---

## Optional: Python backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python app.py
```

---

## Notes

- Works best with decent lighting and a reasonably frontal face
- Disgust is genuinely hard to trigger — that's the model, not you
- First start takes 1–2 seconds while models initialize
