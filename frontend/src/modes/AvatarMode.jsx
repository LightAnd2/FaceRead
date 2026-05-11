import { useEffect, useRef, useState } from 'react';
import { useModels, faceapi } from '../hooks/useModels.js';

const OPTS = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 });

function drawAvatar(ctx, landmarks, expressions, W, H, sx, sy) {
  const pts = landmarks.positions;
  const s = (p) => [p.x * sx, p.y * sy];

  const happy = expressions?.happy ?? 0;
  const surprised = expressions?.surprised ?? 0;
  const angry = expressions?.angry ?? 0;

  // Face oval
  const faceTop = s(pts[27]);
  const faceBot = s(pts[8]);
  const faceL = s(pts[0]);
  const faceR = s(pts[16]);
  const cx = (faceL[0] + faceR[0]) / 2;
  const cy = (faceTop[1] + faceBot[1]) / 2;
  const rx = (faceR[0] - faceL[0]) / 2;
  const ry = (faceBot[1] - faceTop[1]) / 2;

  // Skin color shifts with emotion
  const r = Math.round(230 + angry * 20);
  const g = Math.round(200 - angry * 30 + happy * 10);
  const b = Math.round(185 - surprised * 20);

  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.fill();
  ctx.strokeStyle = `rgba(${r - 30},${g - 30},${b - 30},0.6)`;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Eyes
  [[36, 41], [42, 47]].forEach(([start, end]) => {
    const eyePts = Array.from({ length: end - start + 1 }, (_, i) => s(pts[start + i]));
    const ecx = eyePts.reduce((a, p) => a + p[0], 0) / eyePts.length;
    const ecy = eyePts.reduce((a, p) => a + p[1], 0) / eyePts.length;
    const ew = Math.hypot(eyePts[0][0] - eyePts[3][0], eyePts[0][1] - eyePts[3][1]) / 2;

    // Eyeball
    ctx.beginPath();
    ctx.ellipse(ecx, ecy, ew * 0.8, ew * 0.55, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();

    // Iris (larger when surprised)
    const irisR = ew * (0.4 + surprised * 0.15);
    ctx.beginPath();
    ctx.arc(ecx, ecy + 2, irisR, 0, Math.PI * 2);
    ctx.fillStyle = '#2a4a8a';
    ctx.fill();

    // Pupil
    ctx.beginPath();
    ctx.arc(ecx, ecy + 2, irisR * 0.5, 0, Math.PI * 2);
    ctx.fillStyle = '#111';
    ctx.fill();

    // Shine
    ctx.beginPath();
    ctx.arc(ecx + irisR * 0.25, ecy - irisR * 0.3, irisR * 0.22, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fill();

    // Eyelid (brows raise with surprised)
    const browY = ecy - ew * (0.8 + surprised * 0.4 - angry * 0.2);
    ctx.beginPath();
    ctx.moveTo(ecx - ew, browY + (angry ? 4 : 0));
    ctx.quadraticCurveTo(ecx, browY, ecx + ew, browY + (angry ? 4 : 0));
    ctx.strokeStyle = '#6B4423';
    ctx.lineWidth = 2.5;
    ctx.stroke();
  });

  // Nose bridge
  ctx.beginPath();
  ctx.moveTo(s(pts[27])[0], s(pts[27])[1]);
  ctx.lineTo(s(pts[30])[0], s(pts[30])[1]);
  ctx.strokeStyle = 'rgba(0,0,0,0.15)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Nose tip
  ctx.beginPath();
  const noseTip = s(pts[33]);
  const noseW = Math.hypot(s(pts[31])[0] - s(pts[35])[0], s(pts[31])[1] - s(pts[35])[1]) / 2;
  ctx.ellipse(noseTip[0], noseTip[1], noseW, noseW * 0.6, 0, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(${r - 20},${g - 20},${b - 20},0.4)`;
  ctx.fill();

  // Mouth — smile driven by happy, open by surprised
  const mL = s(pts[48]);
  const mR = s(pts[54]);
  const mMid = s(pts[51]);
  const mBot = s(pts[57]);
  const smileAmt = happy * 0.4;
  const openAmt = (surprised + happy * 0.3) * 0.6;

  // Lips outer
  ctx.beginPath();
  ctx.moveTo(mL[0], mL[1]);
  ctx.bezierCurveTo(
    (mL[0] + mMid[0]) / 2, mL[1] - smileAmt * 12,
    (mR[0] + mMid[0]) / 2, mR[1] - smileAmt * 12,
    mR[0], mR[1]
  );
  ctx.bezierCurveTo(
    (mR[0] + mBot[0]) / 2, mBot[1] + openAmt * 10,
    (mL[0] + mBot[0]) / 2, mBot[1] + openAmt * 10,
    mL[0], mL[1]
  );
  ctx.fillStyle = `rgb(${Math.min(255, r - 40)}, ${Math.min(255, g - 60)}, ${Math.min(255, b - 60)})`;
  ctx.fill();

  // Teeth / mouth interior when open
  if (openAmt > 0.25) {
    ctx.beginPath();
    const teethY = mMid[1] + openAmt * 4;
    ctx.ellipse(
      (mL[0] + mR[0]) / 2, teethY,
      (mR[0] - mL[0]) / 2 * 0.7, openAmt * 8,
      0, 0, Math.PI * 2
    );
    ctx.fillStyle = '#f0f0f0';
    ctx.fill();
  }

  ctx.restore();
}

export default function AvatarMode({ videoRef, overlayCanvasRef, isRunning, isReady, onFpsTick }) {
  const modelsLoaded = useModels();
  const rafRef = useRef(null);
  const [detected, setDetected] = useState(false);
  const [expressions, setExpressions] = useState(null);

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
      if (!canvas) { rafRef.current = requestAnimationFrame(detect); return; }

      canvas.width = canvas.clientWidth;
      canvas.height = canvas.clientHeight;
      const ctx = canvas.getContext('2d');

      // Dark background for avatar
      ctx.fillStyle = '#0A0A0A';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      if (result) {
        const sx = canvas.clientWidth / (video.videoWidth || 1);
        const sy = canvas.clientHeight / (video.videoHeight || 1);
        // Mirror canvas to feel like a selfie (match webcam mirroring)
        ctx.save();
        ctx.scale(-1, 1);
        ctx.translate(-canvas.width, 0);
        drawAvatar(ctx, result.landmarks, result.expressions, canvas.width, canvas.height, sx, sy);
        ctx.restore();
        setDetected(true);
        setExpressions(result.expressions);
      } else {
        setDetected(false);
        // Draw placeholder
        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        ctx.font = '14px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('No face detected', canvas.width / 2, canvas.height / 2);
      }

      onFpsTick?.();
      rafRef.current = requestAnimationFrame(detect);
    };

    rafRef.current = requestAnimationFrame(detect);
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
    };
  }, [isRunning, modelsLoaded, isReady, videoRef, overlayCanvasRef, onFpsTick]);

  useEffect(() => {
    if (!isRunning) { setDetected(false); setExpressions(null); }
  }, [isRunning]);

  return (
    <div className="space-y-6">
      {!modelsLoaded && (
        <div className="flex items-center gap-2 text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
          <span className="w-3 h-3 rounded-full border-2 border-[#006FFF] border-t-transparent animate-spin shrink-0" />
          Loading models…
        </div>
      )}

      {!isRunning ? (
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.15)' }}>Start to see your live avatar</p>
      ) : (
        <>
          <div className="flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full ${detected ? 'bg-green-400' : 'bg-white/20'}`} />
            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>
              {detected ? 'tracking' : 'no face'}
            </span>
          </div>

          {expressions && (
            <div className="space-y-2">
              {Object.entries(expressions)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 4)
                .map(([e, v]) => (
                  <div key={e} className="flex items-center gap-2">
                    <span className="text-[11px] w-16 text-right capitalize" style={{ color: 'rgba(255,255,255,0.35)' }}>{e}</span>
                    <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
                      <div className="h-full rounded-full transition-all duration-200"
                        style={{ width: `${Math.round(v * 100)}%`, background: '#006FFF' }} />
                    </div>
                    <span className="text-[11px] font-mono w-7" style={{ color: 'rgba(255,255,255,0.25)' }}>
                      {Math.round(v * 100)}%
                    </span>
                  </div>
                ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
