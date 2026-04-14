import { useRef, useEffect, useState } from "react";
import Webcam from "react-webcam";
import * as faceapi from "face-api.js";

const MATCH_THRESHOLD = 0.5;
const STORAGE_KEY = "faceread_people";

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

// ── Component ─────────────────────────────────────────────────────────────────
export default function WebcamFeed({ running, onFaces, registerSignal }) {
  const webcamRef  = useRef(null);
  const rafRef     = useRef(null);
  const peopleRef  = useRef(loadPeople());
  const matcherRef = useRef(buildMatcher(peopleRef.current));
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [registering, setRegistering]   = useState(false);

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
      const video = webcamRef.current?.video;
      if (!video || video.readyState < 2) {
        rafRef.current = requestAnimationFrame(detect);
        return;
      }

      const results = await faceapi
        .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 }))
        .withFaceLandmarks(true)
        .withFaceDescriptors()
        .withFaceExpressions()
        .withAgeAndGender();

      const matcher = matcherRef.current;

      const faces = results.map((r, i) => {
        const match = matcher ? matcher.findBestMatch(r.descriptor) : null;
        const label = match && match.label !== "unknown" ? match.label : null;
        const sorted = Object.entries(r.expressions).sort((a, b) => b[1] - a[1]);
        return {
          dominant_emotion: sorted[0][0],
          emotions: Object.fromEntries(sorted.map(([k, v]) => [k, Math.round(v * 100)])),
          age: Math.round(r.age),
          gender: r.gender,
          genderProbability: Math.round(r.genderProbability * 100),
          label,
        };
      });

      onFaces(faces);
      rafRef.current = requestAnimationFrame(detect);
    };

    rafRef.current = requestAnimationFrame(detect);
    return () => cancelAnimationFrame(rafRef.current);
  }, [running, modelsLoaded, onFaces]);

  useEffect(() => {
    if (!running) {
      cancelAnimationFrame(rafRef.current);
      onFaces([]);
    }
  }, [running, onFaces]);

  return (
    <>
      {(!modelsLoaded || registering) && (
        <div className="cam-placeholder" style={{ position: "absolute", inset: 0, zIndex: 10, background: "rgba(0,0,0,0.5)" }}>
          <p style={{ color: "#fff" }}>{registering ? "Capturing face…" : "Loading models…"}</p>
        </div>
      )}
      <Webcam
        ref={webcamRef}
        screenshotFormat="image/jpeg"
        videoConstraints={{ facingMode: "user", width: 640, height: 480 }}
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        mirrored
      />
    </>
  );
}
