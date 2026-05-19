import base64
import numpy as np
import cv2
import joblib
import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from deepface import DeepFace

app = Flask(__name__)
CORS(app)

# Load ASL model
_asl_model = None
try:
    _model_path = os.path.join(os.path.dirname(__file__), 'asl_fingerspelling_model.pkl')
    _asl_model = joblib.load(_model_path)
    print("ASL model loaded.", flush=True)
except Exception as e:
    print(f"ASL model load failed: {e}", flush=True)

print("Loading models...", flush=True)
try:
    _dummy = np.zeros((100, 100, 3), dtype=np.uint8)
    DeepFace.analyze(_dummy, actions=["emotion"], enforce_detection=False,
                     detector_backend="retinaface", silent=True)
    print("Models ready.", flush=True)
except Exception as e:
    print(f"Pre-warm: {e}", flush=True)


def decode_frame(frame_data: str):
    """Decode base64 frame, downscale for speed, return (img, scale_x, scale_y)."""
    if "," in frame_data:
        frame_data = frame_data.split(",", 1)[1]
    img_bytes = base64.b64decode(frame_data)
    img = cv2.imdecode(np.frombuffer(img_bytes, dtype=np.uint8), cv2.IMREAD_COLOR)
    if img is None:
        return None, 1.0, 1.0
    h, w = img.shape[:2]
    max_w = 480
    if w > max_w:
        scale = max_w / w
        img = cv2.resize(img, (max_w, int(h * scale)), interpolation=cv2.INTER_AREA)
        return img, 1.0 / scale, 1.0 / scale
    return img, 1.0, 1.0


@app.route("/analyze", methods=["POST"])
def analyze():
    try:
        data = request.get_json(force=True) or {}
    except Exception:
        return jsonify({"faces": [], "face_count": 0}), 400

    frame_data = data.get("frame", "")
    if not frame_data:
        return jsonify({"faces": [], "face_count": 0}), 400

    img, sx, sy = decode_frame(frame_data)
    if img is None:
        return jsonify({"faces": [], "face_count": 0}), 400

    for backend in ["retinaface", "mtcnn", "opencv"]:
        try:
            results = DeepFace.analyze(
                img,
                actions=["emotion"],
                enforce_detection=True,
                detector_backend=backend,
                silent=True,
            )
            if not isinstance(results, list):
                results = [results]

            faces = []
            for r in results:
                reg = r.get("region", {})
                def sc(k, s): return int((reg[k][0] if isinstance(reg[k], (list,tuple)) else reg[k]) * s)
                faces.append({
                    "dominant_emotion": r["dominant_emotion"],
                    "emotions": {k: round(float(v), 2) for k, v in r["emotion"].items()},
                    "region": {"x": sc("x", sx), "y": sc("y", sy),
                               "w": sc("w", sx), "h": sc("h", sy)},
                })
            return jsonify({"faces": faces, "face_count": len(faces)})

        except ValueError:
            continue
        except Exception:
            continue

    return jsonify({"faces": [], "face_count": 0})


@app.route("/classify-asl", methods=["POST"])
def classify_asl():
    if _asl_model is None:
        return jsonify({"error": "Model not loaded"}), 503
    try:
        data = request.get_json(force=True) or {}
        landmarks = data.get("landmarks", [])  # flat list of 63 floats [x0,y0,z0, x1,y1,z1, ...]
        if len(landmarks) != 63:
            return jsonify({"letter": None, "confidence": 0}), 400

        X = np.array(landmarks).reshape(1, -1)
        letter = _asl_model.predict(X)[0]

        # Get confidence via decision function if available
        confidence = 0
        if hasattr(_asl_model, 'predict_proba'):
            proba = _asl_model.predict_proba(X)[0]
            confidence = round(float(np.max(proba)) * 100, 1)
        elif hasattr(_asl_model, 'decision_function'):
            scores = _asl_model.decision_function(X)[0]
            exp_scores = np.exp(scores - np.max(scores))
            proba = exp_scores / exp_scores.sum()
            confidence = round(float(np.max(proba)) * 100, 1)

        return jsonify({"letter": letter, "confidence": confidence})
    except Exception:
        return jsonify({"error": "Prediction failed"}), 500


if __name__ == "__main__":
    app.run(debug=False, port=5001, use_reloader=False)
