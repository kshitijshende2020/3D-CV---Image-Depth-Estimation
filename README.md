# Seeing Depth

A single-image monocular depth-estimation demo. Upload one RGB photo to see the original next to a colorized **relative** depth map. Warm colors indicate nearer regions; cool colors indicate farther regions.

The map is an estimate of relative depth, not physical distance in meters. Colors are normalized per image, so colors should not be compared as absolute distances across different photos.

## Requirements

- Python 3.10 or newer
- Internet access on first run so Transformers can download the pretrained model weights
- CPU works; a compatible GPU can make inference faster

## Setup and run

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
streamlit run app.py
```

In PyCharm, open this folder and select the `.venv` interpreter. The first prediction downloads the Depth Anything V2 Small checkpoint from Hugging Face (about 99 MB); the checkpoint is intentionally not stored in this project.

## Project files

- `app.py`: Streamlit interface and image upload flow
- `code/depth_estimator.py`: model loading, inference, normalization, and color mapping
- `sample_data/`: small example images will be added here
- `work/resources/model-and-inference.md`: model source, verification notes, and references

## Model

Depth Anything V2 Small, relative-depth model, through Hugging Face Transformers:

- Model card: <https://huggingface.co/depth-anything/Depth-Anything-V2-Small-hf>
- Paper: <https://arxiv.org/abs/2406.09414>
- License: Apache-2.0 for the Small checkpoint
