# Seeing Depth: Monocular Relative Depth Estimation & Multimodal 3D Vision Studio

## 1. Project Description

**Seeing Depth** is an exploratory computer vision studio that infers continuous relative 3D depth from an ordinary 2D photograph using the **Depth Anything V2 Small** foundation model. It transforms a single monocular image into an interactive spatial environment, allowing users to inspect ordinal depth values, manipulate virtual optical depth-of-field, isolate spatial depth slices, and explore 2.5D geometric point clouds.



## 2. Project Team & Contributions

| S.No | Member Name      | Roll Number | Major Responsibilities & Contributions |
| :---: |:-----------------|:------------| :--- |
| **1** | *Bongu Ashish*   | *23bds014*  | *[e.g., Model integration, FastAPI backend, NYU Depth V2 benchmark evaluation]* |
| **2** | *Abhinav A*      | *23bec002*  | *[e.g., Frontend React architecture, Box Focus & Depth Isolator tools]* |
| **3** | *Kshitij Shende* | *23bcs075*  | *[e.g., 3D Point Cloud projection, Colormaps, UI styling & documentation]* |

---

## 3. Installation & How to Run on a Different Device

### Prerequisites
Ensure the target device has the following installed:
* **Python 3.10+** (with `pip`)
* **Node.js 18+** (with `npm`)
* **Git**
* Internet access during the first launch to download model weights from Hugging Face (~99 MB for Depth Anything V2 Small; ~990 MB if the optional BLIP depth-story feature is used).

---

### Step 1: Clone or Copy the Repository
```powershell
git clone <repository-url>
cd project-single-image-depth-estimation-build
```

---

### Step 2: Set Up & Run the Python Backend

Open a terminal in the project root directory:

**Windows (PowerShell):**
```powershell
# 1. Create a Python virtual environment
python -m venv .venv

# 2. Activate the virtual environment
.\.venv\Scripts\Activate.ps1

# 3. Upgrade pip and install backend dependencies
python -m pip install --upgrade pip
python -m pip install -r requirements.txt

# 4. Start the FastAPI server on port 8000
python -m uvicorn api:app --reload
```

**macOS / Linux:**
```bash
# 1. Create a Python virtual environment
python3 -m venv .venv

# 2. Activate the virtual environment
source .venv/bin/activate

# 3. Upgrade pip and install backend dependencies
pip install --upgrade pip
pip install -r requirements.txt

# 4. Start the FastAPI server on port 8000
python3 -m uvicorn api:app --reload
```

*(Leave this terminal running. The API will be active at `http://127.0.0.1:8000`)*.

---

### Step 3: Set Up & Run the React Frontend

Open a **second terminal** in the project root directory:

```powershell
# 1. Install frontend packages
npm install

# 2. Start the Vite development server
npm run dev
```

*(If PowerShell blocks npm execution on Windows, run `cmd.exe /c npm run dev` instead)*.

---

### Step 4: Open the Application
Open your web browser and navigate to:
```text
http://localhost:5173
```
* Upload any photograph (JPG, PNG, or WebP) or click any of the **5 sample cards** in the gallery to test depth estimation, 3D point cloud viewing, box focus, and depth slicing.

---

### Optional: Reproducing the NYU Depth V2 Benchmark
To run the automated relative depth evaluation against the ground-truth NYU Depth V2 validation dataset:

```powershell
# Ensure .venv is activated, then run:
python -m code.evaluate_depth --limit 100
```
* Use `--limit 0` to score all 654 images in the Eigen validation split.
* Evaluation results and comparison panels are saved under `outputs/evaluation/`.

---

## 4. References & Acknowledgments

1. **Depth Anything V2:**
   * Yang, L., Kang, B., Huang, Z., Xu, X., Feng, J., & Zhao, H. (2024). *Depth Anything V2: A Foundation Model for Monocular Depth Estimation*. [arXiv:2406.09414](https://arxiv.org/abs/2406.09414).
   * Checkpoint: [Hugging Face `depth-anything/Depth-Anything-V2-Small-hf`](https://huggingface.co/depth-anything/Depth-Anything-V2-Small-hf) (Apache-2.0 License).

2. **Salesforce BLIP (Bootstrapping Language-Image Pre-training):**
   * Li, J., Li, D., Xiong, C., & Hoi, S. (2022). *BLIP: Bootstrapping Language-Image Pre-training for Unified Vision-Language Understanding and Generation*. [arXiv:2201.12086](https://arxiv.org/abs/2201.12086).
   * Checkpoint: [Hugging Face `Salesforce/blip-image-captioning-base`](https://huggingface.co/Salesforce/blip-image-captioning-base) (BSD-3-Clause License).

3. **NYU Depth Dataset V2:**
   * Silberman, N., Hoiem, D., Kohli, P., & Fergus, R. (2012). *Indoor Segmentation and Support Inference from RGBD Images*. European Conference on Computer Vision (ECCV).

4. **Depth-Aware Computational Photography & Inpainting:**
   * Shih, M. L., Su, S. Y., Kopf, J., & Huang, J. B. (2020). *3D Photography using Context-aware Layered Depth Inpainting*. IEEE/CVF Conference on Computer Vision and Pattern Recognition (CVPR).

5. **Core Open-Source Libraries:**
   * [PyTorch](https://pytorch.org/) & [Hugging Face Transformers](https://huggingface.co/docs/transformers) (Deep learning inference)
   * [FastAPI](https://fastapi.tiangolo.com/) & [Uvicorn](https://www.uvicorn.org/) (Asynchronous HTTP API)
   * [React](https://react.dev/) & [Vite](https://vitejs.dev/) (Modern frontend framework & bundler)
   * [Lucide React](https://lucide.dev/) (UI iconography)
   * [NumPy](https://numpy.org/) & [Pillow](https://python-pillow.org/) (Array processing and image manipulation)
