"""Small HTTP API for the React depth-estimation interface."""

from base64 import b64encode
from base64 import b64decode
from io import BytesIO
from functools import lru_cache
import re
import time

import numpy as np
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image, ImageOps, UnidentifiedImageError

from code.depth_estimator import colorize_depth, normalize_depth
from code.depth_estimator import estimate_depth as run_estimator

app = FastAPI(title="Seeing Depth API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


def png_data(image: Image.Image) -> str:
    buffer = BytesIO()
    image.save(buffer, format="PNG", optimize=True)
    return b64encode(buffer.getvalue()).decode("ascii")


@lru_cache(maxsize=1)
def load_captioner():
    """Load BLIP only when a user asks for a depth-aware story."""
    # Use BLIP's concrete classes: AutoModelForMultimodalLM is only exported by
    # newer Transformers releases and is absent in many existing Conda installs.
    from transformers import BlipForConditionalGeneration, BlipProcessor

    model_id = "Salesforce/blip-image-captioning-base"
    processor = BlipProcessor.from_pretrained(model_id)
    model = BlipForConditionalGeneration.from_pretrained(model_id)
    model.eval()
    return processor, model


def caption_region(image: Image.Image, mask: np.ndarray) -> str:
    ys, xs = np.where(mask)
    if len(xs) == 0:
        return "No distinct region was found at this depth."

    height, width = mask.shape
    margin_x, margin_y = max(8, width // 30), max(8, height // 30)
    left, right = max(0, int(xs.min()) - margin_x), min(width, int(xs.max()) + margin_x + 1)
    top, bottom = max(0, int(ys.min()) - margin_y), min(height, int(ys.max()) + margin_y + 1)

    # Keep the chosen depth layer crisp while softly de-emphasizing other layers.
    from PIL import ImageFilter

    blurred = image.filter(ImageFilter.GaussianBlur(radius=8))
    region_mask = Image.fromarray((mask * 255).astype(np.uint8), mode="L")
    focused = Image.composite(image, blurred, region_mask).crop((left, top, right, bottom))
    processor, model = load_captioner()
    inputs = processor(images=focused, return_tensors="pt")
    import torch

    with torch.inference_mode():
        output = model.generate(**inputs, max_new_tokens=28, num_beams=2)
    return processor.decode(output[0], skip_special_tokens=True).strip().rstrip(".")


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/estimate")
async def estimate(file: UploadFile = File(...)):
    if file.content_type not in {"image/jpeg", "image/png", "image/webp"}:
        raise HTTPException(status_code=415, detail="Choose a JPG, PNG, or WebP image.")
    contents = await file.read()
    if len(contents) > 15 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Images must be smaller than 15 MB.")

    try:
        image = ImageOps.exif_transpose(Image.open(BytesIO(contents))).convert("RGB")
    except (UnidentifiedImageError, OSError):
        raise HTTPException(status_code=400, detail="That file could not be read as an image.")

    image.thumbnail((1600, 1600), Image.Resampling.LANCZOS)
    start = time.perf_counter()
    try:
        depth = run_estimator(image)
    except Exception as error:
        raise HTTPException(status_code=503, detail=f"Depth estimation failed: {error}")
    elapsed_ms = round((time.perf_counter() - start) * 1000)

    normalized = normalize_depth(depth)
    grayscale = Image.fromarray((normalized * 255).round().astype(np.uint8), mode="L")
    color = colorize_depth(normalized)
    return {
        "depth": png_data(grayscale),
        "color": png_data(color),
        "width": image.width,
        "height": image.height,
        "inferenceMs": elapsed_ms,
        "model": "Depth Anything V2 Small",
    }


@app.post("/api/story")
async def tell_story(file: UploadFile = File(...), depth: str = Form(...)):
    if file.content_type not in {"image/jpeg", "image/png", "image/webp"}:
        raise HTTPException(status_code=415, detail="Choose a JPG, PNG, or WebP image.")
    contents = await file.read()
    if len(contents) > 15 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Images must be smaller than 15 MB.")

    try:
        image = ImageOps.exif_transpose(Image.open(BytesIO(contents))).convert("RGB")
        image.thumbnail((1600, 1600), Image.Resampling.LANCZOS)
        if len(depth) > 8_000_000 or not re.fullmatch(r"[A-Za-z0-9+/=]+", depth):
            raise ValueError("Invalid depth image data.")
        depth_image = Image.open(BytesIO(b64decode(depth, validate=True))).convert("L")
        depth_image = depth_image.resize(image.size, Image.Resampling.BILINEAR)
        values = np.asarray(depth_image, dtype=np.float32) / 255.0
    except (UnidentifiedImageError, OSError, ValueError):
        raise HTTPException(status_code=400, detail="Could not read the uploaded photo or depth map.")

    layers = [
        ("near", "Up close", "Foreground", values >= (2 / 3)),
        ("middle", "A little farther", "Middle distance", (values >= (1 / 3)) & (values < (2 / 3))),
        ("far", "In the distance", "Background", values < (1 / 3)),
    ]
    started = time.perf_counter()
    try:
        output = []
        for key, title, distance, mask in layers:
            share = float(mask.mean())
            caption = caption_region(image, mask) if share >= 0.015 else "A small or indistinct area in this photo."
            output.append({"key": key, "title": title, "distance": distance, "share": round(share * 100), "caption": caption})
    except Exception as error:
        raise HTTPException(status_code=503, detail=f"Could not build the story: {error}")

    return {"layers": output, "elapsedMs": round((time.perf_counter() - started) * 1000)}
