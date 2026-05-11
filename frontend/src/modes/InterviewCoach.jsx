import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { useModels, faceapi } from '../hooks/useModels.js';

const OPTS = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 });

function eyeContact(landmarks) {
  const pts = landmarks.positions;
  const nose = pts[30];
  const rEye = pts[39];
  const lEye = pts[42];
  const eyeMidX = (rEye.x + lEye.x) / 2;
  const eyeMidY = (rEye.y + lEye.y) / 2;
  const dx = Math.abs(nose.x - eyeMidX) / 60;
  const dy = Math.abs(nose.y - eyeMidY) / 40;
  return Math.max(0, Math.min(100, Math.round((1 - Math.sqrt(dx * dx + dy * dy)) * 100)));
}

function ScoreRow({ label, value, color }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>{label}</span>
        <span className="text-xs font-bold" style={{ color }}>{value}%</span>
      </div>
      <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
        <motion.div
          className="h-full rounded-full"
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          style={{ background: color }}
        />
      </div>
    </div>
  );
}

export default function InterviewCoach({ videoRef, overlayCanvasRef, isRunning, isReady, onFpsTick }) {
  const modelsLoaded = useModels();
  const rafRef = useRef(null);
  const [metrics, setMetrics] = useState({ eyeContact: 0, smile: 0, confidence: 0 });
  const [feedback, setFeedback] = useState([]);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    if (!isRunning || !modelsLoaded || !isReady) return;

    let cancelled = false;
    const detect = async () => {
      if (cancelled) return;
      const video = videoRef.current?.video;
      if (!video || video.readyState < 2) { rafRef.current = requestAnimationFrame(detect); return; }

      const result = await faceapi
        .detectSingleFace(video, OPTS)
        .withFaceLandmarks(true)
        .withFaceExpressions();

      if (cancelled) return;
      const canvas = overlayCanvasRef.current;
      if (canvas) {
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
        canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
      }

      if (result) {
        const ec = eyeContact(result.landmarks);
        const smile = Math.round((result.expressions.happy ?? 0) * 100);
        const confidence = Math.round(Math.max(0, 100 - (result.expressions.angry ?? 0) * 100 - (result.expressions.fearful ?? 0) * 80));

        setMetrics({ eyeContact: ec, smile, confidence });
        setHistory((h) => [...h.slice(-59), { ec, smile, confidence }]);

        const tips = [];
        if (ec < 40) tips.push('Look more directly at the camera');
        else if (ec > 75) tips.push('Good eye contact');
        if (smile < 15) tips.push('Try to smile more');
        if (confidence < 50) tips.push('Take a breath — you\'ve got this');
        else if (confidence > 80) tips.push('Great confidence');
        setFeedback(tips.slice(0, 2));

        if (canvas) {
          const ctx = canvas.getContext('2d');
          const sx = canvas.clientWidth / (video.videoWidth || 1);
          const sy = canvas.clientHeight / (video.videoHeight || 1);
          const box = result.detection.box;
          const w = box.width * sx, h = box.height * sy;
          const x = canvas.clientWidth - box.x * sx - w; // mirror
          const y = box.y * sy;
          const color = ec > 60 ? '#2ECC71' : ec > 35 ? '#F39C12' : '#FF4757';
          ctx.strokeStyle = color;
          ctx.lineWidth = 2;
          ctx.strokeRect(x, y, w, h);
        }
      }

      onFpsTick?.();
      rafRef.current = requestAnimationFrame(detect);
    };

    rafRef.current = requestAnimationFrame(detect);
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
      const c = overlayCanvasRef.current;
      if (c) c.getContext('2d').clearRect(0, 0, c.width, c.height);
    };
  }, [isRunning, modelsLoaded, isReady, videoRef, overlayCanvasRef, onFpsTick]);

  useEffect(() => {
    if (!isRunning) { setMetrics({ eyeContact: 0, smile: 0, confidence: 0 }); setHistory([]); setFeedback([]); }
  }, [isRunning]);

  const overall = Math.round(metrics.eyeContact * 0.4 + metrics.smile * 0.3 + metrics.confidence * 0.3);

  return (
    <div className="space-y-6">
      {!modelsLoaded && (
        <div className="flex items-center gap-2 text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
          <span className="w-3 h-3 rounded-full border-2 border-[#006FFF] border-t-transparent animate-spin shrink-0" />
          Loading models…
        </div>
      )}

      {!isRunning ? (
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.15)' }}>Start to begin coaching</p>
      ) : (
        <>
          <div>
            <div className="text-[10px] mb-1" style={{ color: 'rgba(255,255,255,0.28)' }}>Overall</div>
            <div className="text-6xl font-black leading-none" style={{ color: '#006FFF' }}>{overall}</div>
          </div>

          <div className="space-y-4">
            <ScoreRow label="Eye contact"   value={metrics.eyeContact}  color="#006FFF" />
            <ScoreRow label="Warmth"        value={metrics.smile}       color="#FFD93D" />
            <ScoreRow label="Confidence"    value={metrics.confidence}  color="#2ECC71" />
          </div>

          {history.length > 5 && (
            <div style={{ height: 70 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={history}>
                  <Line type="monotone" dataKey="ec"         stroke="#006FFF" strokeWidth={1.5} dot={false} />
                  <Line type="monotone" dataKey="smile"      stroke="#FFD93D" strokeWidth={1.5} dot={false} />
                  <Line type="monotone" dataKey="confidence" stroke="#2ECC71" strokeWidth={1.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {feedback.length > 0 && (
            <div className="space-y-1.5">
              {feedback.map((tip, i) => (
                <div key={i} className="flex items-start gap-2 text-xs"
                  style={{ color: 'rgba(255,255,255,0.45)' }}>
                  <span style={{ color: '#006FFF' }}>›</span>
                  {tip}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
