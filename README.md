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

## What it includes

- React + Vite single-page interface with a responsive upload flow
- FastAPI endpoint calling the existing Depth Anything V2 inference helper
- Original and colorized depth map side by side
- Adjustable photo/depth overlay with a draggable comparison divider
- Relative-depth histogram from farther to nearer regions
- Click-to-inspect relative depth at a selected point
- Optional captions for near, middle, and far regions, arranged as a short visual narrative
- Clear warm-near / cool-far legend and model limitation note

## Model

Depth Anything V2 Small, relative-depth checkpoint through Hugging Face Transformers. The Small checkpoint is Apache-2.0 licensed.

- [Hugging Face model card](https://huggingface.co/depth-anything/Depth-Anything-V2-Small-hf)
- [Depth Anything V2 paper](https://arxiv.org/abs/2406.09414)
- [BLIP image-captioning model card](https://huggingface.co/Salesforce/blip-image-captioning-base) (BSD-3-Clause)
- [`code/depth_estimator.py`](code/depth_estimator.py): model loading, inference, normalization, and color mapping
- [`api.py`](api.py): HTTP interface
- [`src/App.jsx`](src/App.jsx): React interface
