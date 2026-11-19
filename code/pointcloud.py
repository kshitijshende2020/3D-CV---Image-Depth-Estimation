"""Build a colored, approximate point cloud from one RGB image and relative depth."""

from __future__ import annotations

import math

import numpy as np
from PIL import Image

from code.depth_estimator import normalize_depth


def make_point_cloud(
    image: Image.Image,
    depth: np.ndarray,
    max_points: int = 8000,
    horizontal_fov_degrees: float = 60.0,
) -> list[list[float | int]]:
    """Return sampled ``[x, y, z, r, g, b]`` points in approximate camera space.

    The depth model is relative, so z is deliberately mapped to arbitrary scene
    units. Camera intrinsics are approximated from a 60-degree horizontal field
    of view; the resulting cloud is for visualization, not measurement.
    """
    rgb_image = image.convert("RGB")
    width, height = rgb_image.size
    if width < 1 or height < 1:
        return []

    if depth.shape != (height, width):
        depth_image = Image.fromarray(np.asarray(depth, dtype=np.float32), mode="F")
        depth = np.asarray(
            depth_image.resize((width, height), Image.Resampling.BILINEAR),
            dtype=np.float32,
        )

    relative = normalize_depth(depth)
    stride = max(1, math.ceil(math.sqrt((width * height) / max(1, max_points))))
    rows = np.arange(0, height, stride)
    cols = np.arange(0, width, stride)
    u, v = np.meshgrid(cols, rows)
    z_score = relative[v, u]

    # Larger model scores mean nearer. Map them to a compact arbitrary z range.
    z = 4.0 - 3.0 * z_score
    focal = width / (2.0 * math.tan(math.radians(horizontal_fov_degrees) / 2.0))
    cx, cy = (width - 1) / 2.0, (height - 1) / 2.0
    x = (u - cx) * z / focal
    y = -(v - cy) * z / focal

    colors = np.asarray(rgb_image, dtype=np.uint8)[v, u]
    coordinates = np.stack((x, y, z), axis=-1).reshape(-1, 3)
    sampled_colors = colors.reshape(-1, 3)
    valid = np.isfinite(coordinates).all(axis=1)
    coordinates = coordinates[valid]
    sampled_colors = sampled_colors[valid]

    points: list[list[float | int]] = []
    for xyz, color in zip(coordinates, sampled_colors):
        points.append(
            [
                round(float(xyz[0]), 5),
                round(float(xyz[1]), 5),
                round(float(xyz[2]), 5),
                int(color[0]),
                int(color[1]),
                int(color[2]),
            ]
        )
    return points
