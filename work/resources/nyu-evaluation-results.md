# NYU Depth V2 evaluation notes

Run date: 18 November 2026

## Protocol

- Dataset: NYU Depth V2 Eigen test split, packaged as `images/val` and `depth/val` (654 aligned RGB/depth pairs).
- Model: pretrained Depth Anything V2 Small relative-depth checkpoint used by the app.
- Metric: pairwise depth-order accuracy. For each photo, compare 20,000 sampled valid pixel pairs against sensor depth. Exclude pairs whose ground-truth depths differ by less than 0.10 m. The sensor says smaller distance is nearer; the model convention in the app says larger prediction is nearer.
- Baseline: for the same point pairs, assume the pixel lower in the image is nearer.
- Reproducibility: random seed 42. Results are averaged per image. No depth-in-meters accuracy is claimed.

## Results

| Evaluation set | Images | Model mean | Model standard deviation | Vertical baseline mean | Baseline standard deviation |
|---|---:|---:|---:|---:|---:|
| Initial subset | 100 | 93.46% | 5.64 percentage points | 69.75% | 9.69 percentage points |
| Full Eigen test split | 654 | 93.48% | 5.08 percentage points | 70.51% | 10.07 percentage points |

The full run evaluated 13,080,000 pixel pairs. The model's median per-image score was 94.73%; the baseline median was 72.47%. The model scored below the baseline on 8 of 654 images.

## Failure case

The lowest-scoring image was `nyu_0649.jpg`: 38.37% model pairwise accuracy versus 52.96% for the vertical baseline. Its RGB / sensor / prediction comparison is generated under `outputs/evaluation/worst_case/visual_comparisons/nyu_0649_comparison.png`. The image shows a bathroom scene with a curtain/door region and sink; the model and sensor map disagree strongly about the depth ordering across large regions. The cause should be described as a scene-specific failure rather than assigned to one object without further investigation.

## Interpretation and limits

The close match between the 100-image and 654-image means supports the preliminary subset result on this indoor benchmark. Pairwise accuracy measures ordering of sampled point pairs, not the fraction of all pixels with correct values, absolute distance accuracy, outdoor performance, or 3D reconstruction quality. The per-image failures should be included in the discussion.

The large dataset and generated outputs are local-only and remain excluded from Git. To reproduce the full run:

```powershell
python -m code.evaluate_depth --limit 0 --output-dir outputs\evaluation\full_test
```
