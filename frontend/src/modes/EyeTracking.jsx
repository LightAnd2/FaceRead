import { useEffect, useRef, useState } from 'react';
import { useModels, faceapi } from '../hooks/useModels.js';

const OPTS = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 });

function estimateGaze(landmarks) {
  const lp = landmarks.positions;
  const re = lp.slice(36, 42);
  const le = lp.slice(42, 48);
  const eyeCenter = (pts) => ({
    x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
    y: pts.reduce((s, p) => s + p.y, 0) / pts.length,
  });
  const rCenter = eyeCenter(re);
  const lCenter = eyeCenter(le);
  const faceCenter = { x: (rCenter.x + lCenter.x) / 2, y: (rCenter.y + lCenter.y) / 2 };
  const nose = lp[30];
  const dx = (nose.x - faceCenter.x) / 60;
  const dy = (nose.y - faceCenter.y) / 40;
  return { x: Math.max(-1, Math.min(1, dx)), y: Math.max(-1, Math.min(1, dy)) };
}

export default function EyeTracking({ videoRef, overlayCanvasRef, isRunning, isReady, onFpsTick }) {
  const modelsLoaded = useModels();
  const rafRef = useRef(null);
  const heatmapRef = useRef(null);
  const heatCtxRef = useRef(null);
  const [gaze, setGaze] = useState(null);
  const [blinkCount, setBlinkCount] = useState(0);
  const prevEarRef = useRef(null);
  const blinkRef = useRef(false);

  useEffect(() => {
    const canvas = heatmapRef.current;
    if (canvas) {
      canvas.width = 200; canvas.height = 120;
      heatCtxRef.current = canvas.getContext('2d');
    }
  }, []);

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

        if (result) {
          const sx = canvas.clientWidth / (video.videoWidth || 1);
          const sy = canvas.clientHeight / (video.videoHeight || 1);
          const pts = result.landmarks.positions;

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
            ctx.strokeStyle = '#006FFF';
            ctx.lineWidth = 1.5;
            ctx.stroke();
            ctx.fillStyle = 'rgba(0,111,255,0.1)';
            ctx.fill();
          });

          const gazeDir = estimateGaze(result.landmarks);
          setGaze(gazeDir);

          const eyeAR = (pts) => {
            const v1 = Math.hypot(pts[1].x - pts[5].x, pts[1].y - pts[5].y);
            const v2 = Math.hypot(pts[2].x - pts[4].x, pts[2].y - pts[4].y);
            const h = Math.hypot(pts[0].x - pts[3].x, pts[0].y - pts[3].y);
            return (v1 + v2) / (2 * h);
          };
          const ear = (eyeAR(pts.slice(36, 42)) + eyeAR(pts.slice(42, 48))) / 2;
          if (prevEarRef.current !== null) {
            if (ear < 0.2 && !blinkRef.current) {
              blinkRef.current = true;
              setBlinkCount((c) => c + 1);
            } else if (ear > 0.25) {
              blinkRef.current = false;
            }
          }
          prevEarRef.current = ear;

          const faceCx = canvas.clientWidth * 0.5;
          const faceCy = canvas.clientHeight * 0.4;
          ctx.beginPath();
          ctx.moveTo(faceCx, faceCy);
          ctx.lineTo(faceCx + gazeDir.x * 60, faceCy + gazeDir.y * 60);
          ctx.strokeStyle = '#00E5FF';
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.restore();

          const hCtx = heatCtxRef.current;
          if (hCtx) {
            const hx = (gazeDir.x + 1) / 2 * 200;
            const hy = (gazeDir.y + 1) / 2 * 120;
            const grad = hCtx.createRadialGradient(hx, hy, 0, hx, hy, 18);
            grad.addColorStop(0, 'rgba(0,111,255,0.3)');
            grad.addColorStop(1, 'rgba(0,111,255,0)');
            hCtx.fillStyle = grad;
            hCtx.fillRect(0, 0, 200, 120);
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
      setGaze(null); setBlinkCount(0); prevEarRef.current = null;
      const hCtx = heatCtxRef.current;
      if (hCtx) hCtx.clearRect(0, 0, 200, 120);
    }
  }, [isRunning]);

  const gazeLabel = gaze
    ? `${gaze.x < -0.2 ? 'Left' : gaze.x > 0.2 ? 'Right' : 'Center'}${gaze.y < -0.2 ? ' up' : gaze.y > 0.2 ? ' down' : ''}`
    : '—';

  return (
    <div className="space-y-6">
      {!modelsLoaded && (
        <div className="flex items-center gap-2 text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
          <span className="w-3 h-3 rounded-full border-2 border-[#006FFF] border-t-transparent animate-spin shrink-0" />
          Loading models…
        </div>
      )}

      {!isRunning ? (
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.15)' }}>Start to begin eye tracking</p>
      ) : (
        <>
          <div className="flex gap-4">
            <div>
              <div className="text-[10px] mb-1" style={{ color: 'rgba(255,255,255,0.28)' }}>Gaze</div>
              <div className="text-2xl font-black leading-none" style={{ color: gaze ? '#fff' : 'rgba(255,255,255,0.18)' }}>
                {gazeLabel}
              </div>
              {gaze && (
                <div className="text-[10px] font-mono mt-1" style={{ color: 'rgba(255,255,255,0.28)' }}>
                  {gaze.x.toFixed(2)}, {gaze.y.toFixed(2)}
                </div>
              )}
            </div>
            <div className="border-l pl-4" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
              <div className="text-[10px] mb-1" style={{ color: 'rgba(255,255,255,0.28)' }}>Blinks</div>
              <div className="text-2xl font-black" style={{ color: '#006FFF' }}>{blinkCount}</div>
            </div>
          </div>

          <div className="relative w-full rounded-lg overflow-hidden flex items-center justify-center"
            style={{ aspectRatio: '5/3', background: '#050708' }}>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-px h-full" style={{ background: 'rgba(255,255,255,0.07)' }} />
            </div>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="h-px w-full" style={{ background: 'rgba(255,255,255,0.07)' }} />
            </div>
            {gaze ? (
              <div
                className="w-3 h-3 rounded-full transition-all duration-150"
                style={{
                  position: 'absolute',
                  left: `${((gaze.x + 1) / 2) * 100}%`,
                  top: `${((gaze.y + 1) / 2) * 100}%`,
                  transform: 'translate(-50%, -50%)',
                  background: '#006FFF',
                  boxShadow: '0 0 10px rgba(0,111,255,0.7)',
                }}
              />
            ) : (
              <span className="text-xs" style={{ color: 'rgba(255,255,255,0.15)' }}>No face</span>
            )}
          </div>

          <div>
            <span className="text-xs mb-2 block" style={{ color: 'rgba(255,255,255,0.25)' }}>Attention heatmap</span>
            <canvas
              ref={heatmapRef}
              className="w-full rounded-lg"
              style={{ imageRendering: 'pixelated', aspectRatio: '200/120', background: '#050708' }}
            />
          </div>
        </>
      )}
    </div>
  );
}
