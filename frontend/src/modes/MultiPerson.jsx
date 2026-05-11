import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useModels, faceapi } from '../hooks/useModels.js';

const EMOTION_COLORS = {
  happy: '#FFD93D', sad: '#00B4D8', angry: '#FF4757',
  surprised: '#FF6B35', neutral: '#A0A0B0', fearful: '#C77DFF', disgusted: '#52D9A4',
};
const PLAYER_COLORS = ['#006FFF', '#FF4757', '#2ECC71', '#F39C12'];
const OPTS = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 });

export default function MultiPerson({ videoRef, overlayCanvasRef, isRunning, isReady, onFpsTick }) {
  const modelsLoaded = useModels();
  const rafRef = useRef(null);
  const [faces, setFaces] = useState([]);

  useEffect(() => {
    if (!isRunning || !modelsLoaded || !isReady) return;

    let cancelled = false;
    const detect = async () => {
      if (cancelled) return;
      const video = videoRef.current?.video;
      if (!video || video.readyState < 2) { rafRef.current = requestAnimationFrame(detect); return; }

      const results = await faceapi
        .detectAllFaces(video, OPTS)
        .withFaceLandmarks(true)
        .withFaceExpressions()
        .withAgeAndGender();

      if (cancelled) return;
      const canvas = overlayCanvasRef.current;
      if (canvas) {
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const sx = canvas.clientWidth / (video.videoWidth || 1);
        const sy = canvas.clientHeight / (video.videoHeight || 1);

        results.forEach((r, i) => {
          const color = PLAYER_COLORS[i % PLAYER_COLORS.length];
          const box = r.detection.box;
          const rawX = box.x * sx, y = box.y * sy, w = box.width * sx, h = box.height * sy;
          const x = canvas.clientWidth - rawX - w; // mirror to match webcam
          ctx.strokeStyle = color;
          ctx.lineWidth = 2;
          ctx.strokeRect(x, y, w, h);
          ctx.globalAlpha = 0.08;
          ctx.fillStyle = color;
          ctx.fillRect(x, y, w, h);
          ctx.globalAlpha = 1;
          ctx.fillStyle = color;
          ctx.font = 'bold 13px Inter, sans-serif';
          ctx.fillText(`P${i + 1}`, x + 4, y - 6);
        });
      }

      const faceData = results.map((r, i) => {
        const sorted = Object.entries(r.expressions).sort((a, b) => b[1] - a[1]);
        const engagement = Math.round((r.expressions.happy + r.expressions.surprised) * 100);
        return {
          id: i,
          dominant: sorted[0][0],
          emotions: Object.fromEntries(sorted.map(([k, v]) => [k, Math.round(v * 100)])),
          age: Math.round(r.age),
          gender: r.gender,
          engagement,
          color: PLAYER_COLORS[i % PLAYER_COLORS.length],
        };
      });

      setFaces(faceData);
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

  useEffect(() => { if (!isRunning) setFaces([]); }, [isRunning]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        {faces.length > 0 && (
          <span className="text-xs font-mono" style={{ color: 'rgba(255,255,255,0.25)' }}>
            {faces.length} {faces.length === 1 ? 'face' : 'faces'}
          </span>
        )}
      </div>

      {!modelsLoaded && (
        <div className="flex items-center gap-2 text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
          <span className="w-3 h-3 rounded-full border-2 border-[#006FFF] border-t-transparent animate-spin shrink-0" />
          Loading models…
        </div>
      )}

      {!isRunning ? (
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.15)' }}>Start to begin</p>
      ) : faces.length === 0 && (
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.18)' }}>Point camera at multiple people</p>
      )}

      <AnimatePresence>
        {faces.map((face) => (
          <motion.div
            key={face.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-l-2 pl-3"
            style={{ borderColor: face.color }}
          >
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-xs font-semibold" style={{ color: face.color }}>Person {face.id + 1}</span>
              <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.28)' }}>
                {face.gender} · ~{face.age}
              </span>
            </div>
            <div className="text-2xl font-black capitalize leading-none mb-2"
              style={{ color: EMOTION_COLORS[face.dominant] || '#fff' }}>
              {face.dominant}
            </div>
            <div className="space-y-1.5">
              {Object.entries(face.emotions).slice(0, 3).map(([e, v]) => (
                <div key={e} className="flex items-center gap-2">
                  <span className="text-[10px] w-14 text-right capitalize"
                    style={{ color: 'rgba(255,255,255,0.3)' }}>{e}</span>
                  <div className="flex-1 h-1 rounded-full overflow-hidden"
                    style={{ background: 'rgba(255,255,255,0.07)' }}>
                    <div className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${v}%`, background: EMOTION_COLORS[e] || '#fff' }} />
                  </div>
                  <span className="text-[10px] font-mono w-7"
                    style={{ color: 'rgba(255,255,255,0.25)' }}>{v}%</span>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between mt-2 pt-2"
              style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
              <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.28)' }}>Engagement</span>
              <span className="text-[11px] font-semibold" style={{ color: face.color }}>{face.engagement}%</span>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {faces.length >= 2 && (
        <div className="mt-5">
          <div className="flex gap-3">
            {faces.slice(0, 2).map((f) => (
              <div key={f.id} className="flex-1 text-center">
                <div className="text-xs font-bold mb-1" style={{ color: f.color }}>P{f.id + 1}</div>
                <div className="text-2xl font-black" style={{ color: EMOTION_COLORS[f.dominant] || '#fff' }}>
                  {f.engagement}%
                </div>
                <div className="text-[10px]" style={{ color: 'rgba(255,255,255,0.28)' }}>engaged</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
