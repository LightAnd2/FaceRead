import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useModels, faceapi } from '../hooks/useModels.js';

const OPTS = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 });

// Live aging preview effects (shown while idle before capture)
function drawAgingEffects(ctx, pts, mx, my, x, y, w, h, intensity) {
  if (intensity === 0) return;
  ctx.save();
  ctx.lineCap = 'round';

  ctx.globalAlpha = 0.14 * intensity;
  ctx.fillStyle = `rgb(${Math.round(110 * intensity)},${Math.round(65 * intensity)},0)`;
  ctx.fillRect(x, y, w, h);
  ctx.globalAlpha = 1;

  const lineAlpha = 0.25 + intensity * 0.35;
  ctx.strokeStyle = `rgba(55,30,10,${lineAlpha})`;

  if (intensity > 0.1) {
    for (let i = 0; i < 3; i++) {
      const lineY = my(pts[27]) - 18 - i * 9 * (0.5 + intensity * 0.5);
      ctx.lineWidth = 0.8 + intensity * 0.8;
      ctx.globalAlpha = (0.25 + intensity * 0.3) * (1 - i * 0.22);
      ctx.beginPath();
      ctx.moveTo(mx(pts[18]) + 5, lineY + (i % 2 === 0 ? 3 : -3) * intensity);
      ctx.quadraticCurveTo(
        (mx(pts[19]) + mx(pts[24])) / 2, lineY - 4 * intensity,
        mx(pts[25]) - 5, lineY + (i % 2 === 0 ? 3 : -3) * intensity
      );
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  if (intensity > 0.2) {
    ctx.lineWidth = 1 + intensity * 0.6;
    ctx.globalAlpha = 0.3 * intensity;
    for (const xOff of [-5, 5]) {
      ctx.beginPath();
      ctx.moveTo(mx(pts[27]) + xOff, my(pts[21]));
      ctx.quadraticCurveTo(
        mx(pts[27]) + xOff * 0.6, (my(pts[21]) + my(pts[27])) / 2,
        mx(pts[27]) + xOff * 0.3, my(pts[27])
      );
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  if (intensity > 0.25) {
    ctx.lineWidth = 0.9;
    ctx.globalAlpha = 0.28 * intensity;
    for (const [eyePt, dir] of [[pts[36], 1], [pts[45], -1]]) {
      const ex = mx(eyePt), ey = my(eyePt);
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(ex, ey);
        ctx.lineTo(ex + dir * (10 + i * 4) * intensity, ey + (i - 1.5) * 5 * intensity);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  if (intensity > 0.3) {
    ctx.lineWidth = 1.2 + intensity;
    ctx.globalAlpha = 0.28 * intensity;
    for (const [nosePt, mouthPt, dir] of [[pts[31], pts[48], -1], [pts[35], pts[54], 1]]) {
      ctx.beginPath();
      ctx.moveTo(mx(nosePt), my(nosePt));
      ctx.quadraticCurveTo(
        mx(nosePt) + dir * 4 * intensity,
        (my(nosePt) + my(mouthPt)) / 2,
        mx(mouthPt) + dir * 3 * intensity,
        my(mouthPt)
      );
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  if (intensity > 0.2) {
    const hairTop = my(pts[19]) - 40 * intensity;
    const hairBot = my(pts[19]);
    const grad = ctx.createLinearGradient(x, hairTop, x, hairBot);
    grad.addColorStop(0, `rgba(195,195,195,${0.5 * intensity})`);
    grad.addColorStop(1, 'rgba(195,195,195,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(x, hairTop, w, hairBot - hairTop);
  }

  ctx.restore();
}

export default function AgeProgression({ videoRef, overlayCanvasRef, isRunning, isReady, onFpsTick }) {
  const modelsLoaded = useModels();
  const rafRef    = useRef(null);
  const animRef   = useRef(null);
  const offsetRef = useRef(0);

  const [phase,        setPhase]        = useState('idle');   // idle | processing | result | error
  const [detectedAge,  setDetectedAge]  = useState(null);
  const [offset,       setOffset]       = useState(0);
  const [errorMsg,     setErrorMsg]     = useState('');

  // Detection loop — only runs in idle phase
  useEffect(() => {
    if (!isRunning || !modelsLoaded || !isReady || phase !== 'idle') return;

    let cancelled = false;
    const detect = async () => {
      if (cancelled) return;
      const video = videoRef.current?.video;
      if (!video || video.readyState < 2) { rafRef.current = requestAnimationFrame(detect); return; }

      const result = await faceapi
        .detectSingleFace(video, OPTS)
        .withFaceLandmarks(true)
        .withAgeAndGender();

      if (cancelled) return;
      const canvas = overlayCanvasRef.current;
      if (canvas) {
        canvas.width  = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (result) {
          const sx  = canvas.clientWidth  / (video.videoWidth  || 1);
          const sy  = canvas.clientHeight / (video.videoHeight || 1);
          const box = result.detection.box;
          const age = Math.round(result.age);
          setDetectedAge(age);

          const rawX = box.x * sx;
          const w = box.width * sx, h = box.height * sy;
          const x = canvas.width - rawX - w;
          const y = box.y * sy;

          const pts = result.landmarks.positions;
          const mx  = (p) => canvas.width - p.x * sx;
          const my  = (p) => p.y * sy;
          const intensity = Math.min(1, offsetRef.current / 40);

          drawAgingEffects(ctx, pts, mx, my, x, y, w, h, intensity);

          // Box color shifts blue → amber with intensity
          const r = Math.round(intensity * 255);
          const g = Math.round(111 + intensity * 54);
          const b = Math.round(255 - intensity * 255);
          ctx.strokeStyle = `rgb(${r},${g},${b})`;
          ctx.lineWidth = 2;
          ctx.strokeRect(x, y, w, h);

          const label = `~${age + offsetRef.current} yrs`;
          ctx.font = 'bold 11px Inter, sans-serif';
          const tw = ctx.measureText(label).width + 14;
          ctx.fillStyle = `rgb(${r},${g},${b})`;
          ctx.beginPath();
          if (ctx.roundRect) ctx.roundRect(x, y - 24, tw, 20, 3);
          else ctx.rect(x, y - 24, tw, 20);
          ctx.fill();
          ctx.fillStyle = '#000';
          ctx.fillText(label, x + 7, y - 9);
        }
      }

      onFpsTick?.();
      rafRef.current = requestAnimationFrame(detect);
    };

    rafRef.current = requestAnimationFrame(detect);
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
    };
  }, [isRunning, modelsLoaded, isReady, videoRef, overlayCanvasRef, onFpsTick, phase]);

  // Auto-animate aging preview: 0 → 40y over 8s, hold 2s, loop
  useEffect(() => {
    if (!isRunning || phase !== 'idle') { offsetRef.current = 0; setOffset(0); return; }

    let start = null;
    const RAMP = 8000, HOLD = 2000, TOTAL = RAMP + HOLD;

    const tick = (ts) => {
      if (!start) start = ts;
      const elapsed = (ts - start) % TOTAL;
      const v = elapsed < RAMP ? Math.round((elapsed / RAMP) * 40) : 40;
      offsetRef.current = v;
      setOffset(v);
      animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, [isRunning, phase]);

  // Reset when stopped
  useEffect(() => {
    if (!isRunning) {
      setPhase('idle');
      setDetectedAge(null);
      setOffset(0);
      offsetRef.current = 0;
      const c = overlayCanvasRef.current;
      if (c) c.getContext('2d').clearRect(0, 0, c.width, c.height);
    }
  }, [isRunning, overlayCanvasRef]);

  const captureAndAge = async () => {
    const video = videoRef.current?.video;
    if (!video || video.readyState < 2) return;

    // Capture current frame
    const cap = document.createElement('canvas');
    cap.width  = video.videoWidth;
    cap.height = video.videoHeight;
    // Draw mirrored (to match what user sees)
    const capCtx = cap.getContext('2d');
    capCtx.translate(cap.width, 0);
    capCtx.scale(-1, 1);
    capCtx.drawImage(video, 0, 0);
    const base64 = cap.toDataURL('image/jpeg', 0.92);

    setPhase('processing');
    setErrorMsg('');

    try {
      const res = await fetch('/age-face', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64 }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Request failed');

      // Draw aged image onto overlay canvas
      const img = new Image();
      img.src = data.image;
      img.onload = () => {
        const canvas = overlayCanvasRef.current;
        if (!canvas) return;
        canvas.width  = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
        const ctx = canvas.getContext('2d');
        // Cover-fit the image
        const scale = Math.max(canvas.width / img.width, canvas.height / img.height);
        const dx = (canvas.width  - img.width  * scale) / 2;
        const dy = (canvas.height - img.height * scale) / 2;
        ctx.drawImage(img, dx, dy, img.width * scale, img.height * scale);
      };

      setPhase('result');
    } catch (e) {
      setErrorMsg(e.message || 'Something went wrong');
      setPhase('error');
    }
  };

  const retake = () => {
    setPhase('idle');
    setErrorMsg('');
    const c = overlayCanvasRef.current;
    if (c) c.getContext('2d').clearRect(0, 0, c.width, c.height);
  };

  return (
    <div className="space-y-4">
      {!modelsLoaded && (
        <div className="flex items-center gap-2 text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
          <span className="w-3 h-3 rounded-full border-2 border-[#006FFF] border-t-transparent animate-spin shrink-0" />
          Loading models…
        </div>
      )}

      {!isRunning && (
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.15)' }}>Start to begin</p>
      )}

      <AnimatePresence mode="wait">
        {isRunning && phase === 'idle' && (
          <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="space-y-3">
            {detectedAge === null ? (
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.15)' }}>No face detected</p>
            ) : (
              <div className="flex items-center gap-3">
                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  Detected ~{detectedAge}
                </span>
                <div className="flex-1 h-0.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                  <div className="h-full rounded-full" style={{
                    width: `${(offset / 40) * 100}%`,
                    background: `rgb(${Math.round((offset/40)*255)},${Math.round(111+(offset/40)*54)},${Math.round(255-(offset/40)*255)})`,
                    transition: 'none',
                  }} />
                </div>
                <span className="text-[11px] font-mono shrink-0" style={{ color: 'rgba(255,255,255,0.22)' }}>
                  +{offset}y
                </span>
              </div>
            )}
            <button
              onClick={captureAndAge}
              disabled={!detectedAge}
              className="text-xs font-semibold transition-opacity"
              style={{ color: '#006FFF', opacity: detectedAge ? 1 : 0.3 }}
            >
              Age me →
            </button>
          </motion.div>
        )}

        {isRunning && phase === 'processing' && (
          <motion.div key="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full border-2 border-[#006FFF] border-t-transparent animate-spin shrink-0" />
            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>Aging…</span>
          </motion.div>
        )}

        {isRunning && phase === 'result' && (
          <motion.div key="result" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex items-center gap-3">
            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
              +40 years
            </span>
            <button
              onClick={retake}
              className="text-xs font-semibold transition-opacity hover:opacity-60"
              style={{ color: '#006FFF' }}
            >
              Retake
            </button>
          </motion.div>
        )}

        {isRunning && phase === 'error' && (
          <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="space-y-2">
            <p className="text-xs" style={{ color: '#FF4757' }}>{errorMsg}</p>
            <button onClick={retake} className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
              Try again
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
