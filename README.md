# FaceRead

**[Live Demo](https://face-read.vercel.app)**

Real-time emotion detection and face recognition straight from your webcam — no account, no cloud, runs entirely in your browser.

---

## What it does

Point your camera at a face and it will:

- Detect the dominant emotion (happy, sad, angry, surprised, neutral, fear, disgust) with confidence scores for all seven
- Predict gender with a confidence percentage
- Recognize registered people by name using face descriptors stored locally
- Handle multiple faces at once with per-face tab switching

Everything runs client-side — no data ever leaves your machine.

---

## How it's built

The frontend is **React + Vite**. When you hit Start Camera, it accesses your webcam via the browser's `getUserMedia` API and feeds each frame into **face-api.js**, a JavaScript ML library that runs five neural networks directly in the browser using WebGL:

- **TinyFaceDetector** — finds faces in the frame
- **FaceExpressionNet** — classifies the expression into 7 emotions
- **AgeGenderNet** — estimates gender and age
- **FaceLandmark68TinyNet** — maps 68 facial landmarks used for recognition
- **FaceRecognitionNet** — generates face descriptors for identifying registered people

Because everything runs in-browser, there's no server involved and no latency from network round-trips. Detection runs at roughly 15–30fps depending on your hardware. Registered faces are saved to localStorage so they persist across sessions.

---

## Run the app

You just need Node installed.

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), hit **Start Camera**, and allow webcam access. The models load in a couple seconds on first run and are cached after that.

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
- Register your face with **+ Add Person** to have your name displayed when detected
