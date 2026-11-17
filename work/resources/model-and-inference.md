# Model and inference resources

## Selected model

- **Model:** Depth Anything V2 Small, relative-depth checkpoint
- **Hugging Face model:** https://huggingface.co/depth-anything/Depth-Anything-V2-Small-hf
- **Official code and project notes:** https://github.com/DepthAnything/Depth-Anything-V2
- **Paper:** https://arxiv.org/abs/2406.09414
- **License:** Apache-2.0 for the Small model
- **Checkpoint size:** about 99 MB; keep it out of the submission ZIP and download it on first run.
- **Output meaning:** a relative depth estimate, not a distance in meters. Check the output direction before setting the app's warm-near/cool-far legend.

## Verification

On 17 November 2026, the official Depth Anything V2 Hugging Face demo successfully processed its built-in street-scene sample. The interface showed a color depth map next to the input and produced downloadable grayscale and 16-bit raw maps. The demo reported about 0.3 seconds for that sample. This verifies that the selected model can produce a depth map from one image through the published inference path; it does not measure local-machine speed.

The project `.venv` is now configured with Python 3.14.7, CPU PyTorch 2.15.0, Transformers 5.23.0, and Streamlit 1.67.0. Imports and the app's normalization/color-map helpers work. Local checkpoint loading is still unverified because the execution environment cannot resolve `huggingface.co` to download model files. Run the app from PyCharm on a network that can reach Hugging Face to complete local inference verification.

## Inference options

The Hugging Face Transformers pipeline is the shortest integration path:

```python
from transformers import pipeline

depth_estimator = pipeline(
    "depth-estimation",
    model="depth-anything/Depth-Anything-V2-Small-hf",
)
result = depth_estimator(image)
```

The returned result contains a predicted depth array and a displayable depth image. Use the array for numeric point inspection; use a normalized, colorized copy for the UI. Do not describe its values as meters.

## UI resources

- Streamlit upload widget: https://docs.streamlit.io/develop/api-reference/widgets/st.file_uploader
- Transformers depth estimation: https://huggingface.co/docs/transformers/main_classes/pipelines
- Depth Anything V2 Transformers documentation: https://huggingface.co/docs/transformers/model_doc/depth_anything_v2

## Sample photo

The official demo's built-in street image was used for the remote verification. A reusable local sample still needs to be added to `sample_data/`. A direct download attempt from the COCO image host was rejected because its TLS certificate name did not match; certificate checks were not bypassed. We can use an approved dataset/official repository sample or a user-provided photo for the local run.
