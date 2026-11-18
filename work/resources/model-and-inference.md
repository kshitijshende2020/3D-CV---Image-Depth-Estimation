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

## Candidate evaluation metric: pairwise depth-order accuracy

Keep this as a candidate for the project evaluation; it is not finalized yet. For each valid pair of pixels in an RGB-D test image, use the sensor depth to identify which pixel is nearer. Count a pair as correct when the model predicts the same near/far order. Report correct pairs divided by all evaluated pairs, as a percentage. Skip pixels without valid sensor depth. This suits the selected model's relative-depth output better than comparing its raw values directly with distances in meters.

Related reference: [Analyzing Results of Depth Estimation Models With Monocular Criteria (CVPR Workshop 2023)](https://openaccess.thecvf.com/content/CVPR2023W/XAI4CV/html/Theiner_Analyzing_Results_of_Monocular_Depth_Estimation_With_Monocular_Criteria_CVPRW_2023_paper.html).

## Point-cloud visualization approach

The React branch includes an RGB point-cloud view derived from the image and the predicted relative-depth map. It samples up to roughly 8,000 pixels, keeps each pixel's RGB color, and projects it using a pinhole-camera formula with an assumed 60-degree horizontal field of view. Relative depth is mapped to arbitrary z values from 1 (near) to 4 (far). These coordinates are for visualization only; they are not calibrated distances or a complete reconstruction. The browser viewer allows rotation and zoom, and can export an ASCII PLY point cloud.
