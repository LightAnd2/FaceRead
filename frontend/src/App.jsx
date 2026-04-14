import { useState, useCallback, useRef } from "react";
import WebcamFeed, { loadPeople, savePeople, buildMatcher } from "./components/WebcamFeed";
import EmotionOverlay from "./components/EmotionDisplay";

export default function App() {
  const [running, setRunning] = useState(false);
  const [faces, setFaces] = useState([]);
  const [selectedFace, setSelectedFace] = useState(0);
  const [people, setPeople] = useState(loadPeople);
  const [registerSignal, setRegisterSignal] = useState(null);
  const [nameInput, setNameInput] = useState("");
  const [showRegister, setShowRegister] = useState(false);
  const [showLandmarks, setShowLandmarks] = useState(true);
  const [feedback, setFeedback] = useState("");
  const inputRef = useRef(null);

  const handleFaces = useCallback((newFaces) => {
    setFaces(newFaces);
    setSelectedFace((prev) => (prev >= newFaces.length ? 0 : prev));
  }, []);

  const toggle = () => {
    if (running) setFaces([]);
    setRunning((r) => !r);
  };

  const openRegister = () => {
    setShowRegister(true);
    setFeedback("");
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const captureface = () => {
    if (!nameInput.trim()) { setFeedback("Enter a name first"); return; }
    setFeedback("");
    setRegisterSignal({
      name: nameInput.trim(),
      onDone: (err) => {
        setRegisterSignal(null);
        if (err) {
          setFeedback(err);
        } else {
          const updated = loadPeople();
          setPeople(updated);
          setFeedback(`✓ ${nameInput.trim()} saved`);
          setNameInput("");
        }
      },
    });
  };

  const deletePerson = (name) => {
    const updated = people.filter((p) => p.name !== name);
    savePeople(updated);
    setPeople(updated);
  };

  return (
    <div className="app">
      <header>
        <h1>FaceRead</h1>
        <div className="header-right">
          <button className="register-btn" onClick={() => setShowLandmarks(l => !l)}>
            {showLandmarks ? "Hide Mesh" : "Show Mesh"}
          </button>
          <button className="register-btn" onClick={openRegister}>+ Add Person</button>
          <div className={`status-pill ${running ? "active" : ""}`}>
            <span className="dot" />
            {running ? "Live" : "Idle"}
          </div>
        </div>
      </header>

      {/* Register panel */}
      {showRegister && (
        <div className="register-panel">
          <div className="register-header">
            <span className="card-label">Register a face</span>
            <button className="close-btn" onClick={() => setShowRegister(false)}>✕</button>
          </div>
          <p className="register-hint">Face the camera, type a name, then hit Capture.</p>
          <div className="register-row">
            <input
              ref={inputRef}
              className="name-input"
              placeholder="Name"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && captureface()}
            />
            <button className="capture-btn" onClick={captureface} disabled={!running}>
              Capture
            </button>
          </div>
          {feedback && <p className={`register-feedback ${feedback.startsWith("✓") ? "ok" : "err"}`}>{feedback}</p>}
          {!running && <p className="register-feedback err">Start the camera first</p>}

          {/* Saved people */}
          {people.length > 0 && (
            <div className="people-list">
              {people.map(({ name }) => (
                <div className="person-chip" key={name}>
                  <span>{name}</span>
                  <button onClick={() => deletePerson(name)}>✕</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Camera */}
      <div className="camera-wrap">
        {running ? (
          <WebcamFeed
            running={running}
            onFaces={handleFaces}
            registerSignal={registerSignal}
            showLandmarks={showLandmarks}
          />
        ) : (
          <div className="cam-placeholder">
            <p>Press Start to begin</p>
          </div>
        )}
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
