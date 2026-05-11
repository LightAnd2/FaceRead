import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useModels, faceapi } from '../hooks/useModels.js';

const OPTS = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 });
const EAR_THRESH = 0.21;
const HEAD_DROP_THRESH = 15;

function eyeAR(pts) {
  const v1 = Math.hypot(pts[1].x - pts[5].x, pts[1].y - pts[5].y);
  const v2 = Math.hypot(pts[2].x - pts[4].x, pts[2].y - pts[4].y);
  const h = Math.hypot(pts[0].x - pts[3].x, pts[0].y - pts[3].y);
  return (v1 + v2) / (2 * h + 1e-6);
}

export default function FatigueDetection({ videoRef, overlayCanvasRef, isRunning, isReady, onFpsTick }) {
  const modelsLoaded = useModels();
  const rafRef = useRef(null);
  const [score, setScore] = useState(100);
  const [alerting, setAlerting] = useState(false);
  const [blinks, setBlinks] = useState(0);
  const [status, setStatus] = useState('Alert');
  const blinkRef = useRef(false);
  const baselineNoseY = useRef(null);
  const earHistory = useRef([]);

  useEffect(() => {
    if (!isRunning || !modelsLoaded || !isReady) return;

    let cancelled = false;
    const detect = async () => {
      if (cancelled) return;
      const video = videoRef.current?.video;
      if (!video || video.readyState < 2) { rafRef.current = requestAnimationFrame(detect); return; }

      const result = await faceapi.detectSingleFace(video, OPTS).withFaceLandmarks(true);
      if (cancelled) return;
      const canvas = overlayCanvasRef.current;
      if (canvas) {
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }

      if (result) {
        const pts = result.landmarks.positions;
        const re = pts.slice(36, 42);
        const le = pts.slice(42, 48);
        const ear = (eyeAR(re) + eyeAR(le)) / 2;

        earHistory.current.push(ear);
        if (earHistory.current.length > 30) earHistory.current.shift();
        const avgEar = earHistory.current.reduce((a, b) => a + b, 0) / earHistory.current.length;

        if (ear < EAR_THRESH && !blinkRef.current) {
          blinkRef.current = true;
          setBlinks((b) => b + 1);
        } else if (ear > EAR_THRESH + 0.04) {
          blinkRef.current = false;
        }

        const noseY = pts[30].y;
        if (!baselineNoseY.current) baselineNoseY.current = noseY;
        const headDrop = noseY - baselineNoseY.current;

        let fatigue = 0;
        if (avgEar < EAR_THRESH) fatigue += 50;
        else fatigue += Math.max(0, (EAR_THRESH - avgEar + 0.1) / 0.1 * 30);
        if (headDrop > HEAD_DROP_THRESH) fatigue += Math.min(50, (headDrop - HEAD_DROP_THRESH) * 2);

        const newScore = Math.max(0, Math.min(100, Math.round(100 - fatigue)));
        setScore(newScore);
        setAlerting(newScore < 40);
        setStatus(newScore > 70 ? 'Alert' : newScore > 45 ? 'Drowsy' : 'Very Drowsy');

        if (canvas) {
          const ctx = canvas.getContext('2d');
          const sx = canvas.clientWidth / (video.videoWidth || 1);
          const sy = canvas.clientHeight / (video.videoHeight || 1);

          // Mirror context to match mirrored webcam
          ctx.save();
          ctx.scale(-1, 1);
          ctx.translate(-canvas.width, 0);

          [[36, 41], [42, 47]].forEach(([start, end]) => {
            ctx.beginPath();
            for (let i = start; i <= end; i++) {
              const p = pts[i];
              if (i === start) ctx.moveTo(p.x * sx, p.y * sy);
              else ctx.lineTo(p.x * sx, p.y * sy);
            }
            ctx.closePath();
            ctx.strokeStyle = newScore < 40 ? '#FF4757' : ear < EAR_THRESH ? '#F39C12' : '#2ECC71';
            ctx.lineWidth = 2;
            ctx.stroke();
          });

          ctx.restore();

          if (newScore < 40) {
            ctx.fillStyle = 'rgba(255,71,87,0.07)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
          }
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
    if (!isRunning) {
      setScore(100); setAlerting(false); setBlinks(0); setStatus('Alert');
      baselineNoseY.current = null; earHistory.current = [];
    }
  }, [isRunning]);

  const scoreColor = score > 70 ? '#2ECC71' : score > 45 ? '#F39C12' : '#FF4757';
  const circumference = 2 * Math.PI * 42;

  return (
    <div className="space-y-6">
      {!modelsLoaded && (
        <div className="flex items-center gap-2 text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
          <span className="w-3 h-3 rounded-full border-2 border-[#006FFF] border-t-transparent animate-spin shrink-0" />
          Loading models…
        </div>
      )}

      {!isRunning ? (
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.15)' }}>
          Start to begin fatigue monitoring
        </p>
      ) : (
        <>
          {alerting && (
            <span className="text-xs font-bold" style={{ color: '#FF4757' }}>⚠ DROWSY ALERT</span>
          )}

          <div className="flex items-center gap-5">
            <div className="relative w-24 h-24 shrink-0">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                <circle cx="50" cy="50" r="42" fill="none"
                  stroke="rgba(255,255,255,0.06)" strokeWidth="9" />
                <circle cx="50" cy="50" r="42" fill="none"
                  stroke={scoreColor} strokeWidth="9"
                  strokeDasharray={circumference}
                  strokeDashoffset={circumference * (1 - score / 100)}
                  strokeLinecap="round"
                  style={{ transition: 'stroke-dashoffset 0.5s ease, stroke 0.5s ease' }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-black" style={{ color: scoreColor }}>{score}</span>
                <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.25)' }}>/100</span>
              </div>
            </div>
            <div>
              <div className="text-2xl font-black leading-none mb-1" style={{ color: scoreColor }}>{status}</div>
              <div className="text-xs mb-3" style={{ color: 'rgba(255,255,255,0.28)' }}>Attention score</div>
              <div className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
                {blinks} blinks
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {[
              { label: 'Eye openness', value: score > 70 ? 'Open' : score > 45 ? 'Heavy' : 'Closing', color: scoreColor },
              { label: 'Blink count',  value: `${blinks}`, color: 'rgba(255,255,255,0.6)' },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>{label}</span>
                <span className="text-xs font-semibold" style={{ color }}>{value}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
