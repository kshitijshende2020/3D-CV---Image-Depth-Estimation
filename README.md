# Seeing Depth

**A visual studio for exploring relative depth in an ordinary photograph.** Upload one image, run Depth Anything V2 Small, compare the original with its warm-near / cool-far depth map, and click any point to inspect its relative reading.

Use **Tell the depth story** to caption three depth bands and read them from foreground to background. This optional feature uses the BLIP image-captioning model on each region. Its first use downloads about 990 MB of additional model weights; normal depth estimation does not require that download. The captions are AI-generated and can misidentify objects, especially when a depth band contains several overlapping regions.

Depth is normalized independently for each photo. It is an estimate of which regions appear nearer or farther, not a physical distance in meters. Reflective surfaces, thin details, and low-texture areas can be difficult for the model.

## Run locally

Requirements: Python 3.10+, Node.js 18+, and internet access the first time the model weights are needed.

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m uvicorn api:app --reload
```

In another terminal:

```powershell
npm install
npm run dev
```

Open the local URL printed by Vite (usually http://localhost:5173). The first prediction downloads the pretrained checkpoint from Hugging Face (about 99 MB). CPU inference is supported; a compatible GPU can make it faster.

## Evaluate relative depth ordering

The repository does not include the NYU Depth V2 dataset. Download or use the locally extracted dataset, then check that the following folders exist:

```text
evaluation_data/nyu-depth-png/
├── images/val/
└── depth/val/
```

The `val` folder is the 654-image Eigen test split in this dataset package. The evaluation script defaults to a reproducible 100-image subset so a first run is manageable on CPU. Run it from the project root in the same Python environment used for the API:

```powershell
python -m code.evaluate_depth
```

For the complete test split, use `python -m code.evaluate_depth --limit 0`. Results are saved under `outputs/evaluation/`: `summary.json`, per-image scores in `per_image_results.csv`, and RGB / sensor / prediction comparison images. These files are generated locally and are not included in Git.

The primary score is **pairwise depth-order accuracy**. It samples valid pixel pairs whose sensor depths differ by at least 10 cm, then measures how often the model puts the nearer pixel in front of the farther one. The script also reports a simple baseline that assumes lower image rows are nearer. This is a relative-order evaluation; it does not claim the selected model predicts accurate distances in meters. Sensor depth is stored in millimeters and converted to meters when read. The downloaded dataset stays in the ignored `evaluation_data/` folder.

## What it includes

- React + Vite single-page interface with a responsive upload flow
- FastAPI endpoint calling the existing Depth Anything V2 inference helper
- Original and colorized depth map side by side
- Adjustable photo/depth overlay with a draggable comparison divider
- Rotatable, colored pseudo-3D point cloud with a downloadable PLY file
- Relative-depth histogram from farther to nearer regions
- Click-to-inspect relative depth at a selected point
- Optional captions for near, middle, and far regions, arranged as a short visual narrative
- Reproducible NYU Depth V2 evaluation with a vertical-position baseline and visual comparisons
- Clear warm-near / cool-far legend and model limitation note

## Model

Depth Anything V2 Small, relative-depth checkpoint through Hugging Face Transformers. The Small checkpoint is Apache-2.0 licensed.

- [Hugging Face model card](https://huggingface.co/depth-anything/Depth-Anything-V2-Small-hf)
- [Depth Anything V2 paper](https://arxiv.org/abs/2406.09414)
- [BLIP image-captioning model card](https://huggingface.co/Salesforce/blip-image-captioning-base) (BSD-3-Clause)
- [`code/depth_estimator.py`](code/depth_estimator.py): model loading, inference, normalization, and color mapping
- [`api.py`](api.py): HTTP interface
- [`src/App.jsx`](src/App.jsx): React interface
- [`src/PointCloudViewer.jsx`](src/PointCloudViewer.jsx): browser-based point-cloud viewer and PLY export
- [`code/pointcloud.py`](code/pointcloud.py): pixel-to-3D projection using estimated relative depth
