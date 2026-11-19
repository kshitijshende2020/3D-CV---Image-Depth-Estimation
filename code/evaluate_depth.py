"""Evaluate relative depth ordering on the NYU Depth V2 Eigen test split.

The model produces relative depth (larger values mean nearer in this project),
while NYU ground-truth depth is metric depth (smaller values mean nearer).
This script compares pairwise ordering instead of comparing unlike scales.
"""

from __future__ import annotations

import argparse
import csv
import json
import random
import statistics
import time
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

from code.depth_estimator import colorize_depth, estimate_depth, normalize_depth


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DATA_ROOT = PROJECT_ROOT / "evaluation_data" / "nyu-depth-png"
DEFAULT_OUTPUT_DIR = PROJECT_ROOT / "outputs" / "evaluation"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Score relative depth ordering on paired NYU RGB/depth images."
    )
    parser.add_argument("--data-root", type=Path, default=DEFAULT_DATA_ROOT)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    parser.add_argument(
        "--limit",
        type=int,
        default=100,
        help="Number of validation images to evaluate; use 0 for all 654.",
    )
    parser.add_argument("--pairs-per-image", type=int, default=20000)
    parser.add_argument("--min-depth-gap-m", type=float, default=0.10)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument(
        "--save-examples",
        type=int,
        default=6,
        help="Save this many RGB / sensor / prediction comparison panels.",
    )
    parser.add_argument(
        "--image",
        type=str,
        help="Evaluate one named validation photo, for example nyu_0655.jpg.",
    )
    return parser.parse_args()


def read_ground_truth(path: Path) -> np.ndarray:
    """Read a 16-bit NYU depth PNG encoded in millimeters."""
    with Image.open(path) as image:
        depth_mm = np.asarray(image, dtype=np.float32)
    if depth_mm.ndim != 2:
        raise ValueError(f"Expected a single-channel depth map: {path}")
    return depth_mm / 1000.0


def pairwise_scores(
    prediction: np.ndarray,
    ground_truth_m: np.ndarray,
    *,
    pairs_needed: int,
    min_depth_gap_m: float,
    rng: np.random.Generator,
) -> tuple[float, float, int, int]:
    """Return model and vertical-prior accuracy on sampled non-ambiguous pairs."""
    valid = np.isfinite(ground_truth_m) & (ground_truth_m > 0)
    valid_indices = np.flatnonzero(valid)
    if len(valid_indices) < 2:
        raise ValueError("Ground-truth map has fewer than two valid depth pixels.")

    flat_gt = ground_truth_m.ravel()
    flat_prediction = prediction.ravel()
    width = ground_truth_m.shape[1]
    correct_model = 0
    correct_baseline = 0
    evaluated = 0
    attempts = 0
    max_attempts = 20
    batch_size = max(pairs_needed * 2, 1000)

    while evaluated < pairs_needed and attempts < max_attempts:
        attempts += 1
        left = rng.choice(valid_indices, size=batch_size, replace=True)
        right = rng.choice(valid_indices, size=batch_size, replace=True)
        depth_left = flat_gt[left]
        depth_right = flat_gt[right]
        distinct = left != right
        clear_order = np.abs(depth_left - depth_right) >= min_depth_gap_m
        selected = np.flatnonzero(distinct & clear_order)
        if not len(selected):
            continue
        selected = selected[: pairs_needed - evaluated]
        left, right = left[selected], right[selected]

        # In metric depth, smaller means nearer. The model convention here is
        # larger means nearer; ties are counted as incorrect for the model.
        gt_left_nearer = flat_gt[left] < flat_gt[right]
        model_left_nearer = flat_prediction[left] > flat_prediction[right]
        baseline_left_nearer = (left // width) > (right // width)
        correct_model += int(np.count_nonzero(gt_left_nearer == model_left_nearer))
        correct_baseline += int(np.count_nonzero(gt_left_nearer == baseline_left_nearer))
        evaluated += len(left)

    if evaluated == 0:
        raise ValueError(
            "Could not sample any valid depth pairs. Check the depth PNG files."
        )
    return correct_model / evaluated, correct_baseline / evaluated, evaluated, len(valid_indices)


def make_comparison_panel(
    rgb: Image.Image,
    ground_truth_m: np.ndarray,
    predicted_depth: np.ndarray,
    image_name: str,
    score: float,
    size: tuple[int, int] = (320, 240),
) -> Image.Image:
    """Create a compact RGB / sensor depth / model depth visual comparison."""
    ground_truth_values = ground_truth_m[np.isfinite(ground_truth_m) & (ground_truth_m > 0)]
    if len(ground_truth_values):
        low, high = np.percentile(ground_truth_values, (2, 98))
        gt_near_bright = np.clip((high - ground_truth_m) / max(high - low, 1e-6), 0, 1)
    else:
        gt_near_bright = np.zeros_like(ground_truth_m)
    gt_near_bright = np.nan_to_num(gt_near_bright, nan=0.0, posinf=0.0, neginf=0.0)

    rgb_tile = rgb.resize(size, Image.Resampling.LANCZOS)
    gt_tile = colorize_depth(gt_near_bright).resize(size, Image.Resampling.NEAREST)
    pred_tile = colorize_depth(normalize_depth(predicted_depth)).resize(
        size, Image.Resampling.NEAREST
    )

    header_height = 44
    gap = 12
    panel = Image.new("RGB", (size[0] * 3 + gap * 4, size[1] + header_height + gap * 2), "#101827")
    draw = ImageDraw.Draw(panel)
    labels = ["Input RGB", "Sensor depth", "Model estimate"]
    for index, tile in enumerate((rgb_tile, gt_tile, pred_tile)):
        x = gap + index * (size[0] + gap)
        draw.text((x, 8), labels[index], fill="white", font=ImageFont.load_default())
        panel.paste(tile, (x, header_height))
    draw.text(
        (gap, header_height + size[1] + 5),
        f"{image_name} | pairwise ordering: {score:.1%}",
        fill="#cbd5e1",
        font=ImageFont.load_default(),
    )
    return panel


def main() -> None:
    args = parse_args()
    image_dir = args.data_root / "images" / "val"
    depth_dir = args.data_root / "depth" / "val"
    if not image_dir.is_dir() or not depth_dir.is_dir():
        raise SystemExit(
            "NYU validation folders were not found. Expected images/val and depth/val "
            f"under: {args.data_root}"
        )

    image_paths = sorted(image_dir.glob("*.jpg"))
    if not image_paths:
        raise SystemExit(f"No JPG images found under {image_dir}")
    if args.image:
        image_paths = [path for path in image_paths if path.name == args.image]
        if not image_paths:
            raise SystemExit(f"Could not find {args.image} in {image_dir}")
    else:
        random.Random(args.seed).shuffle(image_paths)
        if args.limit > 0:
            image_paths = image_paths[: args.limit]

    args.output_dir.mkdir(parents=True, exist_ok=True)
    examples_dir = args.output_dir / "visual_comparisons"
    if args.save_examples > 0:
        examples_dir.mkdir(parents=True, exist_ok=True)

    rng = np.random.default_rng(args.seed)
    rows: list[dict[str, object]] = []
    started = time.perf_counter()
    print(f"Evaluating {len(image_paths)} images from {image_dir}")
    print("The first image may take longer while the pretrained model loads.")

    for index, image_path in enumerate(image_paths, start=1):
        depth_path = depth_dir / f"{image_path.stem}.png"
        if not depth_path.is_file():
            print(f"Skipping {image_path.name}: matching depth map is missing.")
            continue

        with Image.open(image_path) as opened:
            rgb = opened.convert("RGB")
        ground_truth_m = read_ground_truth(depth_path)
        if ground_truth_m.shape != (rgb.height, rgb.width):
            raise ValueError(
                f"RGB/depth sizes differ for {image_path.name}: "
                f"RGB {(rgb.height, rgb.width)}, depth {ground_truth_m.shape}"
            )

        inference_start = time.perf_counter()
        prediction = estimate_depth(rgb)
        inference_ms = (time.perf_counter() - inference_start) * 1000
        model_score, baseline_score, pair_count, valid_count = pairwise_scores(
            prediction,
            ground_truth_m,
            pairs_needed=args.pairs_per_image,
            min_depth_gap_m=args.min_depth_gap_m,
            rng=rng,
        )
        rows.append(
            {
                "image": image_path.name,
                "model_pairwise_accuracy": model_score,
                "vertical_baseline_accuracy": baseline_score,
                "evaluated_pairs": pair_count,
                "valid_depth_pixels": valid_count,
                "inference_ms": round(inference_ms),
            }
        )

        if index <= args.save_examples:
            panel = make_comparison_panel(
                rgb, ground_truth_m, prediction, image_path.name, model_score
            )
            panel.save(examples_dir / f"{image_path.stem}_comparison.png")

        if index == 1 or index % 10 == 0 or index == len(image_paths):
            print(
                f"[{index}/{len(image_paths)}] {image_path.name}: "
                f"model {model_score:.1%}, vertical baseline {baseline_score:.1%}"
            )

    if not rows:
        raise SystemExit("No image/depth pairs were evaluated.")

    csv_path = args.output_dir / "per_image_results.csv"
    with csv_path.open("w", newline="", encoding="utf-8") as csv_file:
        writer = csv.DictWriter(csv_file, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)

    model_scores = [float(row["model_pairwise_accuracy"]) for row in rows]
    baseline_scores = [float(row["vertical_baseline_accuracy"]) for row in rows]
    summary = {
        "dataset": "NYU Depth V2 Eigen test split (validation folder)",
        "images_evaluated": len(rows),
        "seed": args.seed,
        "pairs_per_image_requested": args.pairs_per_image,
        "minimum_ground_truth_depth_gap_m": args.min_depth_gap_m,
        "model_pairwise_accuracy_mean": statistics.mean(model_scores),
        "model_pairwise_accuracy_std": statistics.pstdev(model_scores),
        "vertical_baseline_accuracy_mean": statistics.mean(baseline_scores),
        "vertical_baseline_accuracy_std": statistics.pstdev(baseline_scores),
        "total_sampled_pairs": sum(int(row["evaluated_pairs"]) for row in rows),
        "elapsed_seconds": round(time.perf_counter() - started, 1),
        "metric_note": (
            "Pair correctness means the model and sensor agree on which sampled pixel "
            "is nearer. Sensor pairs less than the configured depth gap apart are excluded."
        ),
    }
    summary_path = args.output_dir / "summary.json"
    summary_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")

    print("\nEvaluation complete")
    print(f"Model mean pairwise accuracy: {summary['model_pairwise_accuracy_mean']:.1%}")
    print(
        "Vertical baseline mean pairwise accuracy: "
        f"{summary['vertical_baseline_accuracy_mean']:.1%}"
    )
    print(f"Per-image results: {csv_path}")
    print(f"Summary: {summary_path}")
    if args.save_examples > 0:
        print(f"Visual comparisons: {examples_dir}")


if __name__ == "__main__":
    main()
