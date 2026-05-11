import base64
import os
import time
import numpy as np
from dotenv import load_dotenv
load_dotenv()
import cv2
from io import BytesIO
from PIL import Image
from flask import Flask, request, jsonify
from flask_cors import CORS
from deepface import DeepFace
from huggingface_hub import InferenceClient

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


@app.route("/age-face", methods=["POST"])
def age_face():
    HF_TOKEN = os.getenv("HF_TOKEN")
    if not HF_TOKEN:
        return jsonify({"error": "Add HF_TOKEN to your .env file (free at huggingface.co)"}), 500

    data = request.get_json(force=True) or {}
    frame_data = data.get("image", "")
    if not frame_data:
        return jsonify({"error": "No image provided"}), 400

    # Decode base64 image
    if "," in frame_data:
        frame_data = frame_data.split(",", 1)[1]
    img_bytes = base64.b64decode(frame_data)

    # Resize to 512px max (model sweet spot, faster inference)
    img = Image.open(BytesIO(img_bytes)).convert("RGB")
    img.thumbnail((512, 512), Image.LANCZOS)

    try:
        client = InferenceClient(token=HF_TOKEN)
        result = client.image_to_image(
            image=img,
            prompt=(
                "make this person look 40 years older, photorealistic aging, "
                "deep wrinkles, forehead lines, crow's feet, gray hair, age spots, "
                "sagging skin, realistic skin texture, same person"
            ),
            negative_prompt="young, smooth skin, cartoon, painting, unrealistic",
            model="timbrooks/instruct-pix2pix",
            guidance_scale=7.5,
            image_guidance_scale=1.5,
            num_inference_steps=25,
        )

        buf = BytesIO()
        result.save(buf, format="JPEG", quality=92)
        aged_b64 = base64.b64encode(buf.getvalue()).decode()
        return jsonify({"image": f"data:image/jpeg;base64,{aged_b64}"})

    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(debug=False, port=5001, use_reloader=False)
