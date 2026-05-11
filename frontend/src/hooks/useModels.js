import { useEffect, useState, useRef } from 'react';
import * as faceapi from 'face-api.js';

let loaded = false;
let loading = false;
const listeners = new Set();

async function loadAllModels() {
  if (loaded || loading) return;
  loading = true;
  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
    faceapi.nets.faceExpressionNet.loadFromUri('/models'),
    faceapi.nets.ageGenderNet.loadFromUri('/models'),
    faceapi.nets.faceLandmark68TinyNet.loadFromUri('/models'),
    faceapi.nets.faceRecognitionNet.loadFromUri('/models'),
  ]);
  loaded = true;
  loading = false;
  for (const cb of listeners) cb();
  listeners.clear();
}

export function useModels() {
  const [modelsLoaded, setModelsLoaded] = useState(loaded);

  useEffect(() => {
    if (loaded) { setModelsLoaded(true); return; }
    listeners.add(() => setModelsLoaded(true));
    loadAllModels();
  }, []);

  return modelsLoaded;
}

export { faceapi };
