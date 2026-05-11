import { useEffect, useRef, useState } from 'react';
import { useModels, faceapi } from '../hooks/useModels.js';

const OPTS = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 });

const FILTERS = [
  { id: 'glasses', name: 'Shades'  },
  { id: 'heart',   name: 'Hearts'  },
  { id: 'crown',   name: 'Crown'   },
  { id: 'cat',     name: 'Cat'     },
  { id: 'beard',   name: 'Beard'   },
  { id: 'none',    name: 'None'    },
];

function drawFilter(ctx, id, pts, scaleX, scaleY) {
  const s = (p) => [p.x * scaleX, p.y * scaleY];

  if (id === 'glasses') {
    const rOuter = s(pts[36]), rInner = s(pts[39]);
    const lOuter = s(pts[42]), lInner = s(pts[45]);
    const ew = Math.hypot(rOuter[0] - rInner[0], rOuter[1] - rInner[1]);
    const rCx = (rOuter[0] + rInner[0]) / 2, rCy = (rOuter[1] + rInner[1]) / 2;
    const lCx = (lOuter[0] + lInner[0]) / 2, lCy = (lOuter[1] + lInner[1]) / 2;
    ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 3; ctx.fillStyle = 'rgba(0,0,0,0.35)';
    for (const [cx, cy] of [[rCx, rCy], [lCx, lCy]]) {
      ctx.beginPath(); ctx.ellipse(cx, cy, ew / 1.8, ew / 2.2, 0, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
    }
    ctx.beginPath(); ctx.moveTo(rCx + ew / 1.8, rCy); ctx.lineTo(lCx - ew / 1.8, lCy); ctx.stroke();
  }

  if (id === 'crown') {
    const foreheadMid = s(pts[27]);
    const lBrow = s(pts[17]), rBrow = s(pts[26]);
    const w = Math.abs(rBrow[0] - lBrow[0]) * 1.1;
    const h = w * 0.55;
    const x = foreheadMid[0] - w / 2;
    const y = foreheadMid[1] - h - 10;
    ctx.fillStyle = '#FFD700'; ctx.strokeStyle = '#B8860B'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, y + h); ctx.lineTo(x, y + h * 0.3); ctx.lineTo(x + w * 0.2, y + h * 0.6);
    ctx.lineTo(x + w * 0.5, y); ctx.lineTo(x + w * 0.8, y + h * 0.6);
    ctx.lineTo(x + w, y + h * 0.3); ctx.lineTo(x + w, y + h); ctx.closePath();
    ctx.fill(); ctx.stroke();
    for (let i = 0; i < 3; i++) {
      ctx.beginPath(); ctx.arc(x + w * (0.2 + i * 0.3), y + h * 0.7, 4, 0, Math.PI * 2);
      ctx.fillStyle = ['#FF4757', '#2ECC71', '#006FFF'][i]; ctx.fill();
    }
  }

  if (id === 'heart') {
    const rBrow = s(pts[19]), lBrow = s(pts[24]);
    for (const [hx, hy] of [[rBrow[0] - 15, rBrow[1] - 22], [lBrow[0] + 15, lBrow[1] - 22]]) {
      ctx.fillStyle = '#FF6B9D';
      ctx.beginPath();
      ctx.moveTo(hx, hy + 8);
      ctx.bezierCurveTo(hx, hy, hx - 12, hy, hx - 12, hy + 8);
      ctx.bezierCurveTo(hx - 12, hy + 16, hx, hy + 20, hx, hy + 24);
      ctx.bezierCurveTo(hx, hy + 20, hx + 12, hy + 16, hx + 12, hy + 8);
      ctx.bezierCurveTo(hx + 12, hy, hx, hy, hx, hy + 8);
      ctx.fill();
    }
  }

  if (id === 'cat') {
    const top = s(pts[27]), lBrow = s(pts[17]), rBrow = s(pts[26]);
    const w = Math.abs(rBrow[0] - lBrow[0]);
    ctx.fillStyle = '#FF9B54'; ctx.strokeStyle = '#E07040'; ctx.lineWidth = 1.5;
    for (const [ex, ey, flip] of [[lBrow[0] - w * 0.2, top[1] - 30, -1], [rBrow[0] + w * 0.2, top[1] - 30, 1]]) {
      ctx.beginPath(); ctx.moveTo(ex, ey + 30); ctx.lineTo(ex - 16 * flip, ey); ctx.lineTo(ex + 16 * flip, ey);
      ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    const nose = s(pts[33]);
    ctx.strokeStyle = '#333'; ctx.lineWidth = 1;
    for (const [x1, y1, x2, y2] of [
      [nose[0], nose[1], nose[0] - 55, nose[1] - 5], [nose[0], nose[1] + 6, nose[0] - 55, nose[1] + 8],
      [nose[0], nose[1], nose[0] + 55, nose[1] - 5], [nose[0], nose[1] + 6, nose[0] + 55, nose[1] + 8],
    ]) { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
  }

  if (id === 'beard') {
    const chin = s(pts[8]), mLeft = s(pts[3]), mRight = s(pts[13]);
    ctx.fillStyle = '#5C3317';
    ctx.beginPath();
    ctx.moveTo(mLeft[0], mLeft[1] + 10);
    ctx.quadraticCurveTo(chin[0], chin[1] + 45, mRight[0], mRight[1] + 10);
    ctx.lineTo(mRight[0], mRight[1] + 5);
    ctx.quadraticCurveTo(chin[0], chin[1] + 35, mLeft[0], mLeft[1] + 5);
    ctx.closePath(); ctx.fill();
  }
}

export default function FaceFilters({ videoRef, overlayCanvasRef, isRunning, isReady, onFpsTick }) {
  const modelsLoaded = useModels();
  const rafRef = useRef(null);
  const [activeFilter, setActiveFilter] = useState('glasses');
  const [detected, setDetected] = useState(false);
  const filterRef = useRef('glasses');

  useEffect(() => { filterRef.current = activeFilter; }, [activeFilter]);

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
        if (result && filterRef.current !== 'none') {
          const sx = canvas.clientWidth / (video.videoWidth || 1);
          const sy = canvas.clientHeight / (video.videoHeight || 1);
          // Mirror context to match mirrored webcam feed
          ctx.save();
          ctx.scale(-1, 1);
          ctx.translate(-canvas.width, 0);
          drawFilter(ctx, filterRef.current, result.landmarks.positions, sx, sy);
          ctx.restore();
        }
      }
      setDetected(!!result);
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

  useEffect(() => { if (!isRunning) setDetected(false); }, [isRunning]);

  return (
    <div className="space-y-6">
      {!modelsLoaded && (
        <div className="flex items-center gap-2 text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
          <span className="w-3 h-3 rounded-full border-2 border-[#006FFF] border-t-transparent animate-spin shrink-0" />
          Loading models…
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="grid grid-cols-3 gap-2 flex-1">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setActiveFilter(f.id)}
              className="py-2 px-3 rounded text-xs font-medium transition-all text-left"
              style={activeFilter === f.id
                ? { background: 'rgba(0,111,255,0.12)', border: '1px solid rgba(0,111,255,0.35)', color: '#fff' }
                : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.4)' }
              }
            >
              {f.name}
            </button>
          ))}
        </div>
      </div>

      {!isRunning ? (
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.15)' }}>Start and choose a filter</p>
      ) : (
        <div className="flex items-center gap-1.5">
          <div className={`w-1.5 h-1.5 rounded-full ${detected ? 'bg-green-400' : 'bg-white/20'}`} />
          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>
            {detected ? 'tracking' : 'no face'}
          </span>
        </div>
      )}
    </div>
  );
}
