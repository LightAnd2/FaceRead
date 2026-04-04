import { useEffect, useRef, useState } from "react";

const EMOTION_META = {
  happy:     { color: "#FFD93D" },
  sad:       { color: "#00B4D8" },
  angry:     { color: "#FF4757" },
  surprised: { color: "#FF6B35" },
  neutral:   { color: "#A0A0B0" },
  fear:      { color: "#C77DFF" },
  disgust:   { color: "#52D9A4" },
};

export default function EmotionOverlay({ faces, selectedFace, onSelectFace }) {
  const [showNoFace, setShowNoFace] = useState(false);
  const timerRef = useRef(null);
  const hasFace = faces && faces.length > 0;

  useEffect(() => {
    if (hasFace) {
      clearTimeout(timerRef.current);
      setShowNoFace(false);
    } else {
      timerRef.current = setTimeout(() => setShowNoFace(true), 1200);
    }
    return () => clearTimeout(timerRef.current);
  }, [hasFace]);

  if (!hasFace) {
    return showNoFace ? (
      <div className="emotion-overlay">
        <span className="no-face-label">No face detected</span>
      </div>
    ) : null;
  }

  const face = faces[Math.min(selectedFace, faces.length - 1)];
  const { dominant_emotion, emotions, age, gender, genderProbability } = face;
  const color = EMOTION_META[dominant_emotion]?.color ?? "#fff";
  const sorted = Object.entries(emotions).sort((a, b) => b[1] - a[1]);

  return (
    <div className="emotion-overlay">
      <div className="overlay-inner">

        {/* Left: dominant emotion + age/gender */}
        <div className="overlay-left">
          {faces.length > 1 && (
            <div className="face-tabs">
              {faces.map((_, i) => (
                <button key={i} className={`face-tab ${i === selectedFace ? "active" : ""}`}
                  onClick={() => onSelectFace(i)}>{i + 1}</button>
              ))}
            </div>
          )}
          <div className="overlay-emotion" style={{ color }}>{dominant_emotion}</div>
          <div className="overlay-conf">{emotions[dominant_emotion]?.toFixed(1)}%</div>

          {/* Gender */}
          {gender && (
            <div className="overlay-meta">
              <span className="meta-chip">
                {gender} {genderProbability != null ? `${genderProbability}%` : ""}
              </span>
            </div>
          )}
        </div>

        {/* Right: emotion bars */}
        <div className="overlay-bars">
          {sorted.map(([emotion, score]) => {
            const c = EMOTION_META[emotion]?.color ?? "#fff";
            return (
              <div className="ov-bar-row" key={emotion}>
                <span className="ov-bar-label">{emotion}</span>
                <div className="ov-bar-track">
                  <div className="ov-bar-fill" style={{ width: `${score}%`, background: c }} />
                </div>
                <span className="ov-bar-pct">{score.toFixed(1)}%</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
