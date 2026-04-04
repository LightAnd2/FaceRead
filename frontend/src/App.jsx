import { useState, useCallback } from "react";
import WebcamFeed from "./components/WebcamFeed";
import EmotionOverlay from "./components/EmotionDisplay";

export default function App() {
  const [running, setRunning] = useState(false);
  const [faces, setFaces] = useState([]);
  const [selectedFace, setSelectedFace] = useState(0);

  const handleFaces = useCallback((newFaces) => {
    setFaces(newFaces);
    setSelectedFace((prev) => (prev >= newFaces.length ? 0 : prev));
  }, []);

  const toggle = () => {
    if (running) setFaces([]);
    setRunning((r) => !r);
  };

  return (
    <div className="app">
      <header>
        <h1>Emotion Recognizer</h1>
        <div className={`status-pill ${running ? "active" : ""}`}>
          <span className="dot" />
          {running ? "Live" : "Idle"}
        </div>
      </header>

      {/* Camera + overlay in one block */}
      <div className="camera-wrap">
        {running ? (
          <WebcamFeed running={running} onFaces={handleFaces} />
        ) : (
          <div className="cam-placeholder">
            <p>Press Start to begin</p>
          </div>
        )}

        {/* Emotion overlay pinned to bottom of camera */}
        {running && (
          <EmotionOverlay
            faces={faces}
            selectedFace={selectedFace}
            onSelectFace={setSelectedFace}
          />
        )}
      </div>

      <button className={`start-btn ${running ? "on" : "off"}`} onClick={toggle}>
        <span className="btn-dot" />
        {running ? "Stop" : "Start Camera"}
      </button>
    </div>
  );
}
