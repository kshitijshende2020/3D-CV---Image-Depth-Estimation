"""Depth Anything V2 inference and color-map helpers."""

from functools import lru_cache

import numpy as np
from PIL import Image
from transformers import pipeline


MODEL_ID = "depth-anything/Depth-Anything-V2-Small-hf"


@lru_cache(maxsize=1)
def load_estimator():
    """Load the pretrained model once per app process."""
    return pipeline(task="depth-estimation", model=MODEL_ID, device=-1)


def estimate_depth(image: Image.Image) -> np.ndarray:
    """Return the model's relative-depth prediction as a 2D float array."""
    rgb_image = image.convert("RGB")
    result = load_estimator()(rgb_image)
    prediction = result["predicted_depth"]

    if hasattr(prediction, "detach"):
        prediction = prediction.detach().float().cpu().numpy()

    prediction = np.asarray(prediction, dtype=np.float32).squeeze()
    if prediction.ndim != 2:
        raise ValueError(f"Expected a 2D depth map; received shape {prediction.shape}.")

    # Match the original image dimensions for a pixel-aligned display.
    depth_image = Image.fromarray(prediction, mode="F")
    depth_image = depth_image.resize(rgb_image.size, Image.Resampling.BILINEAR)
    return np.asarray(depth_image, dtype=np.float32)


def normalize_depth(depth: np.ndarray, contrast: float = 1.0) -> np.ndarray:
    """Normalize each image robustly to [0, 1], with an adjustable contrast."""
    finite = np.nan_to_num(depth, nan=0.0, posinf=0.0, neginf=0.0)
    low, high = np.percentile(finite, (2, 98))
    if high - low < 1e-6:
        normalized = np.zeros_like(finite, dtype=np.float32)
    else:
        normalized = np.clip((finite - low) / (high - low), 0.0, 1.0)

    # The selected Depth Anything V2 relative-depth output uses larger values
    # for nearer regions. Contrast changes separation, not the depth ordering.
    normalized = np.clip((normalized - 0.5) * float(contrast) + 0.5, 0.0, 1.0)
    return normalized.astype(np.float32)


def colorize_depth(normalized: np.ndarray) -> Image.Image:
    """Map cool colors to far regions and warm colors to near regions."""
    stops = np.array(
        [
            [37, 52, 148],   # deep blue: farther
            [0, 166, 218],   # cyan
            [55, 177, 126],  # green
            [255, 209, 102], # yellow
            [247, 127, 0],   # orange
            [214, 40, 40],   # red: nearer
        ],
        dtype=np.float32,
    )
    positions = np.linspace(0.0, 1.0, len(stops))
    values = np.clip(normalized, 0.0, 1.0)
    channels = [np.interp(values, positions, stops[:, channel]) for channel in range(3)]
    rgb = np.stack(channels, axis=-1).round().astype(np.uint8)
    return Image.fromarray(rgb, mode="RGB")


def grayscale_depth(normalized: np.ndarray) -> Image.Image:
    """Return an 8-bit grayscale visualization, with nearer pixels brighter."""
    gray = (np.clip(normalized, 0.0, 1.0) * 255).round().astype(np.uint8)
    return Image.fromarray(gray, mode="L")
