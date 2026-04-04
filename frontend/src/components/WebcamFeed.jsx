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

async function loadModels() {
  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
    faceapi.nets.faceExpressionNet.loadFromUri("/models"),
    faceapi.nets.ageGenderNet.loadFromUri("/models"),
  ]);
}

function drawBoxes(canvas, detections) {
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  detections.forEach(({ detection, expressions, age, gender }) => {
    const { x, y, width: w, height: h } = detection.box;
    const dominant = Object.entries(expressions).sort((a, b) => b[1] - a[1])[0][0];
    const color = EMOTION_COLORS[dominant] ?? "#fff";

    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.strokeRect(x, y, w, h);

    const label = `${dominant}  ${gender}`;
    ctx.font = "600 12px Inter, system-ui, sans-serif";
    const tw = ctx.measureText(label).width + 14;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x, y - 26, tw, 22, 4);
    ctx.fill();
    ctx.fillStyle = "#000";
    ctx.fillText(label, x + 7, y - 9);
  });
}

export default function WebcamFeed({ running, onFaces }) {
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);

  // Load models once
  useEffect(() => {
    loadModels().then(() => setModelsLoaded(true));
  }, []);

  // Detection loop
  useEffect(() => {
    if (!running || !modelsLoaded) return;

    const detect = async () => {
      const video = webcamRef.current?.video;
      const canvas = canvasRef.current;
      if (!video || video.readyState < 2 || !canvas) {
        rafRef.current = requestAnimationFrame(detect);
        return;
      }

      // Match canvas to video dimensions
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const detections = await faceapi
        .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 }))
        .withFaceExpressions()
        .withAgeAndGender();

      drawBoxes(canvas, detections);

      // Convert to app face format
      const faces = detections.map(({ detection, expressions, age, gender, genderProbability }) => {
        const sorted = Object.entries(expressions).sort((a, b) => b[1] - a[1]);
        return {
          dominant_emotion: sorted[0][0],
          emotions: Object.fromEntries(sorted.map(([k, v]) => [k, Math.round(v * 100)])),
          age: Math.round(age),
          gender,
          genderProbability: Math.round(genderProbability * 100),
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
  }, [running, modelsLoaded, onFaces]);

  // Clear canvas + faces on stop
  useEffect(() => {
    if (!running) {
      const ctx = canvasRef.current?.getContext("2d");
      if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      onFaces([]);
    }
  }, [running, onFaces]);

  return (
    <div className="webcam-wrapper">
      {!modelsLoaded && (
        <div className="cam-placeholder" style={{ position: "absolute", inset: 0, zIndex: 2 }}>
          <p>Loading models…</p>
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
