import { useEffect, useRef, useState } from 'react';
import { useModels, faceapi } from '../hooks/useModels.js';

const OPTS = new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.5 });

export default function FaceSwap({ videoRef, overlayCanvasRef, isRunning, isReady, onFpsTick }) {
  const modelsLoaded = useModels();
  const rafRef = useRef(null);
  const offscreenRef = useRef(null);
  const [faceCount, setFaceCount] = useState(0);
  const [swapping, setSwapping] = useState(false);

  useEffect(() => {
    if (!isRunning || !modelsLoaded || !isReady) return;

    let cancelled = false;
    const detect = async () => {
      if (cancelled) return;
      const video = videoRef.current?.video;
      if (!video || video.readyState < 2) { rafRef.current = requestAnimationFrame(detect); return; }

      const results = await faceapi.detectAllFaces(video, OPTS).withFaceLandmarks(true);
      if (cancelled) return;
      const canvas = overlayCanvasRef.current;
      if (!canvas) { rafRef.current = requestAnimationFrame(detect); return; }

      canvas.width = canvas.clientWidth;
      canvas.height = canvas.clientHeight;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setFaceCount(results.length);

      if (results.length >= 2 && swapping) {
        const sx = canvas.clientWidth / (video.videoWidth || 1);
        const sy = canvas.clientHeight / (video.videoHeight || 1);
        const vw = video.videoWidth, vh = video.videoHeight;

        if (!offscreenRef.current) offscreenRef.current = document.createElement('canvas');
        const oc = offscreenRef.current;
        oc.width = vw; oc.height = vh;
        oc.getContext('2d').drawImage(video, 0, 0, vw, vh);

        const boxes = results.map((r) => {
          const b = r.detection.box;
          const pad = 0.15;
          return {
            sx: Math.max(0, b.x - b.width * pad),
            sy: Math.max(0, b.y - b.height * pad),
            sw: Math.min(vw, b.width * (1 + 2 * pad)),
            sh: Math.min(vh, b.height * (1 + 2 * pad)),
          };
        });

        const [f0, f1] = boxes;
        ctx.save();
        ctx.beginPath();
        ctx.ellipse((f1.sx + f1.sw / 2) * sx, (f1.sy + f1.sh / 2) * sy, (f1.sw / 2) * sx, (f1.sh / 2) * sy, 0, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(oc, f0.sx, f0.sy, f0.sw, f0.sh, f1.sx * sx, f1.sy * sy, f1.sw * sx, f1.sh * sy);
        ctx.restore();

        ctx.save();
        ctx.beginPath();
        ctx.ellipse((f0.sx + f0.sw / 2) * sx, (f0.sy + f0.sh / 2) * sy, (f0.sw / 2) * sx, (f0.sh / 2) * sy, 0, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(oc, f1.sx, f1.sy, f1.sw, f1.sh, f0.sx * sx, f0.sy * sy, f0.sw * sx, f0.sh * sy);
        ctx.restore();
      } else {
        const sx = canvas.clientWidth / (video.videoWidth || 1);
        const sy = canvas.clientHeight / (video.videoHeight || 1);
        results.forEach((r, i) => {
          const box = r.detection.box;
          const w = box.width * sx, h = box.height * sy;
          const x = canvas.clientWidth - box.x * sx - w; // mirror
          const y = box.y * sy;
          ctx.strokeStyle = i === 0 ? '#006FFF' : '#FF4757';
          ctx.lineWidth = 2;
          ctx.strokeRect(x, y, w, h);
          ctx.fillStyle = i === 0 ? '#006FFF' : '#FF4757';
          ctx.font = 'bold 12px Inter, sans-serif';
          ctx.fillText(`Face ${i + 1}`, x + 4, y - 6);
        });
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
  }, [isRunning, modelsLoaded, isReady, videoRef, overlayCanvasRef, onFpsTick, swapping]);

  useEffect(() => { if (!isRunning) { setFaceCount(0); setSwapping(false); } }, [isRunning]);

  return (
    <div className="space-y-6">
      {!modelsLoaded && (
        <div className="flex items-center gap-2 text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
          <span className="w-3 h-3 rounded-full border-2 border-[#006FFF] border-t-transparent animate-spin shrink-0" />
          Loading models…
        </div>
      )}

      {!isRunning ? (
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.15)' }}>Start with two people in frame</p>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full ${faceCount >= 2 ? 'bg-green-400' : 'bg-white/20'}`} />
            <span className="text-sm" style={{ color: faceCount >= 2 ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.3)' }}>
              {faceCount === 0 ? 'No faces detected' : faceCount === 1 ? '1 face — need 2' : `${faceCount} faces ready`}
            </span>
          </div>

          {faceCount >= 2 && (
            <button
              onClick={() => setSwapping((v) => !v)}
              className="w-full py-2.5 rounded text-sm font-semibold transition-all"
              style={swapping
                ? { background: 'rgba(255,71,87,0.1)', border: '1px solid rgba(255,71,87,0.35)', color: '#FF4757' }
                : { background: 'rgba(0,111,255,0.12)', border: '1px solid rgba(0,111,255,0.35)', color: '#006FFF' }
              }
            >
              {swapping ? 'Stop swap' : 'Swap faces'}
            </button>
          )}

          <div className="flex gap-3">
            {[{ label: 'Face 1', color: '#006FFF', active: faceCount >= 1 }, { label: 'Face 2', color: '#FF4757', active: faceCount >= 2 }].map(({ label, color, active }) => (
              <div key={label} className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: active ? color : 'rgba(255,255,255,0.15)' }} />
                <span className="text-xs" style={{ color: active ? color : 'rgba(255,255,255,0.25)' }}>{label}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
