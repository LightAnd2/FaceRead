import base64
import numpy as np
import cv2
from flask import Flask, request, jsonify
from flask_cors import CORS
from deepface import DeepFace

app = Flask(__name__)
CORS(app)

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
                # Scale coordinates back to original (pre-downscale) image space
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


if __name__ == "__main__":
    app.run(debug=False, port=5001, use_reloader=False)
