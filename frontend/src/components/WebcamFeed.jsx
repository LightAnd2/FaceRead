import { useRef, useEffect, useState } from "react";
import Webcam from "react-webcam";
import * as faceapi from "face-api.js";

const EMOTION_COLORS = {
  happy:     "#FFD93D",
  sad:       "#00B4D8",
  angry:     "#FF4757",
  surprised: "#FF6B35",
  neutral:   "#A0A0B0",
  fear:      "#C77DFF",
  disgust:   "#52D9A4",
};

const MATCH_THRESHOLD = 0.5;
const STORAGE_KEY = "faceread_people";
const BLINK_THRESHOLD = 0.21;   // EAR below this = eye closed
const BLINK_CONSEC    = 2;       // frames eye must be closed to count

// ── localStorage ──────────────────────────────────────────────────────────────
export function loadPeople() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return raw.map(({ name, descriptors }) => ({
      name,
      descriptors: descriptors.map((d) => new Float32Array(d)),
    }));
  } catch { return []; }
}

export function savePeople(people) {
  const raw = people.map(({ name, descriptors }) => ({
    name,
    descriptors: descriptors.map((d) => Array.from(d)),
  }));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(raw));
}

export function buildMatcher(people) {
  if (!people.length) return null;
  const labeled = people.map(
    ({ name, descriptors }) => new faceapi.LabeledFaceDescriptors(name, descriptors)
  );
  return new faceapi.FaceMatcher(labeled, MATCH_THRESHOLD);
}

// ── Eye Aspect Ratio (blink detection) ───────────────────────────────────────
function dist(a, b) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function eyeAspectRatio(pts) {
  // pts: 6 landmark points around one eye
  const vertical = (dist(pts[1], pts[5]) + dist(pts[2], pts[4])) / 2;
  const horizontal = dist(pts[0], pts[3]);
  return horizontal === 0 ? 1 : vertical / horizontal;
}

// ── Landmark drawing ─────────────────────────────────────────────────────────
function drawLandmarkGroup(ctx, pts, close = false, color = "rgba(255,255,255,0.55)") {
  if (!pts.length) return;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  if (close) ctx.closePath();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.2;
  ctx.stroke();
}

function drawDots(ctx, pts, color = "rgba(255,255,255,0.7)") {
  pts.forEach(({ x, y }) => {
    ctx.beginPath();
    ctx.arc(x, y, 1.5, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  });
}

// ── Canvas drawing ────────────────────────────────────────────────────────────
function drawDetections(canvas, detections, showLandmarks) {
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  detections.forEach(({ detection, expressions, gender, label, landmarks, blink }) => {
    const { x, y, width: w, height: h } = detection.box;
    const dominant = Object.entries(expressions).sort((a, b) => b[1] - a[1])[0][0];
    const color = EMOTION_COLORS[dominant] ?? "#fff";
    const nameText = label && label !== "unknown" ? label : null;
    const blinkText = blink ? " · blink" : "";
    const boxLabel = nameText
      ? `${nameText} · ${dominant}${blinkText}`
      : `${dominant} · ${gender}${blinkText}`;

    // Bounding box
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.strokeRect(x, y, w, h);

    // Label chip
    ctx.font = "600 12px Inter, system-ui, sans-serif";
    const tw = ctx.measureText(boxLabel).width + 14;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x, y - 26, tw, 22, 4);
    ctx.fill();
    ctx.fillStyle = "#000";
    ctx.fillText(boxLabel, x + 7, y - 9);

    // Landmarks
    if (showLandmarks && landmarks) {
      const pts = landmarks.positions;
      drawLandmarkGroup(ctx, pts.slice(0, 17));           // jaw
      drawLandmarkGroup(ctx, pts.slice(17, 22));          // left brow
      drawLandmarkGroup(ctx, pts.slice(22, 27));          // right brow
      drawLandmarkGroup(ctx, pts.slice(27, 36));          // nose bridge + tip
      drawLandmarkGroup(ctx, pts.slice(36, 42), true);    // left eye
      drawLandmarkGroup(ctx, pts.slice(42, 48), true);    // right eye
      drawLandmarkGroup(ctx, pts.slice(48, 60), true);    // outer mouth
      drawLandmarkGroup(ctx, pts.slice(60, 68), true);    // inner mouth
      drawDots(ctx, pts);
    }
  });
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function WebcamFeed({ running, onFaces, registerSignal, showLandmarks }) {
  const webcamRef   = useRef(null);
  const canvasRef   = useRef(null);
  const rafRef      = useRef(null);
  const peopleRef   = useRef(loadPeople());
  const matcherRef  = useRef(buildMatcher(peopleRef.current));
  const blinkState  = useRef({});   // per-face blink counters keyed by label/index
  const [modelsLoaded, setModelsLoaded]   = useState(false);
  const [registering, setRegistering]     = useState(false);

  // Load models
  useEffect(() => {
    Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
      faceapi.nets.faceExpressionNet.loadFromUri("/models"),
      faceapi.nets.ageGenderNet.loadFromUri("/models"),
      faceapi.nets.faceLandmark68TinyNet.loadFromUri("/models"),
      faceapi.nets.faceRecognitionNet.loadFromUri("/models"),
    ]).then(() => setModelsLoaded(true));
  }, []);

  // Registration
  useEffect(() => {
    if (!registerSignal || !modelsLoaded) return;
    const { name, onDone } = registerSignal;
    const video = webcamRef.current?.video;
    if (!video || video.readyState < 2) { onDone("Camera not ready"); return; }

    setRegistering(true);
    faceapi
      .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 320 }))
      .withFaceLandmarks(true)
      .withFaceDescriptor()
      .then((result) => {
        if (!result) { onDone("No face detected — try again"); return; }
        const existing = peopleRef.current.find((p) => p.name === name);
        if (existing) {
          existing.descriptors.push(result.descriptor);
        } else {
          peopleRef.current.push({ name, descriptors: [result.descriptor] });
        }
        savePeople(peopleRef.current);
        matcherRef.current = buildMatcher(peopleRef.current);
        onDone(null);
      })
      .catch(() => onDone("Detection failed"))
      .finally(() => setRegistering(false));
  }, [registerSignal, modelsLoaded]);

  // Detection loop
  useEffect(() => {
    if (!running || !modelsLoaded) return;

    const detect = async () => {
      const video  = webcamRef.current?.video;
      const canvas = canvasRef.current;
      if (!video || video.readyState < 2 || !canvas) {
        rafRef.current = requestAnimationFrame(detect);
        return;
      }
      canvas.width  = video.videoWidth;
      canvas.height = video.videoHeight;

      const results = await faceapi
        .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 }))
        .withFaceLandmarks(true)
        .withFaceDescriptors()
        .withFaceExpressions()
        .withAgeAndGender();

      const matcher = matcherRef.current;

      const detections = results.map((r, i) => {
        const match = matcher ? matcher.findBestMatch(r.descriptor) : null;
        const label = match && match.label !== "unknown" ? match.label : null;
        const key   = label || `face_${i}`;

        // Blink detection via Eye Aspect Ratio
        const pts = r.landmarks.positions;
        const leftEAR  = eyeAspectRatio(pts.slice(36, 42));
        const rightEAR = eyeAspectRatio(pts.slice(42, 48));
        const ear = (leftEAR + rightEAR) / 2;
        const bs  = blinkState.current[key] ?? { closed: 0, blink: false };

        if (ear < BLINK_THRESHOLD) {
          bs.closed++;
          bs.blink = false;
        } else {
          if (bs.closed >= BLINK_CONSEC) bs.blink = true;
          else bs.blink = false;
          bs.closed = 0;
        }
        blinkState.current[key] = bs;

        return { ...r, label, blink: bs.blink };
      });

      drawDetections(canvas, detections, showLandmarks);

      const faces = detections.map(({ detection, expressions, age, gender, genderProbability, label, blink }) => {
        const sorted = Object.entries(expressions).sort((a, b) => b[1] - a[1]);
        return {
          dominant_emotion: sorted[0][0],
          emotions: Object.fromEntries(sorted.map(([k, v]) => [k, Math.round(v * 100)])),
          age: Math.round(age),
          gender,
          genderProbability: Math.round(genderProbability * 100),
          label,
          blink,
          region: {
            x: Math.round(detection.box.x),
            y: Math.round(detection.box.y),
            w: Math.round(detection.box.width),
            h: Math.round(detection.box.height),
          },
        };
      });

      onFaces(faces);
      rafRef.current = requestAnimationFrame(detect);
    };

    rafRef.current = requestAnimationFrame(detect);
    return () => cancelAnimationFrame(rafRef.current);
  }, [running, modelsLoaded, onFaces, showLandmarks]);

  useEffect(() => {
    if (!running) {
      cancelAnimationFrame(rafRef.current);
      const ctx = canvasRef.current?.getContext("2d");
      if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      onFaces([]);
      blinkState.current = {};
    }
  }, [running, onFaces]);

  return (
    <div className="webcam-wrapper">
      {(!modelsLoaded || registering) && (
        <div className="cam-placeholder" style={{ position: "absolute", inset: 0, zIndex: 2, background: "rgba(0,0,0,0.5)" }}>
          <p style={{ color: "#fff" }}>{registering ? "Capturing face…" : "Loading models…"}</p>
        </div>
      )}
      <Webcam
        ref={webcamRef}
        screenshotFormat="image/jpeg"
        videoConstraints={{ facingMode: "user", width: 640, height: 480 }}
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
        mirrored
      />
      <canvas ref={canvasRef} className="overlay-canvas" />
    </div>
  );
}
