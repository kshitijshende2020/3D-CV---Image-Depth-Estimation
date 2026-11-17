from io import BytesIO
import hashlib

import streamlit as st
from PIL import Image, ImageOps

from code.depth_estimator import colorize_depth, estimate_depth, grayscale_depth, normalize_depth


st.set_page_config(
    page_title="Seeing Depth",
    page_icon="◉",
    layout="wide",
    initial_sidebar_state="collapsed",
)

st.markdown(
    """
    <style>
      .stApp { background: #0b1020; color: #edf2ff; }
      [data-testid="stHeader"] { background: rgba(11,16,32,0.9); }
      .block-container { max-width: 1220px; padding-top: 2.2rem; padding-bottom: 3rem; }
      .hero { padding: 1rem 0 1.1rem; }
      .eyebrow { color: #79d5d0; text-transform: uppercase; letter-spacing: .16em;
                 font-size: .76rem; font-weight: 700; }
      .hero h1 { color: #f6f7fb; font-size: clamp(2.2rem, 5vw, 3.4rem);
                 letter-spacing: -.04em; margin: .25rem 0 .4rem; }
      .hero p { color: #9eaac5; font-size: 1.05rem; max-width: 700px; }
      .panel-title { color: #e9efff; font-size: 1.08rem; font-weight: 650;
                     margin: .4rem 0 .65rem; }
      .depth-legend { height: 12px; border-radius: 999px; margin: .35rem 0 .25rem;
        background: linear-gradient(90deg,#253494,#00a6da,#37b17e,#ffd166,#f77f00,#d62828); }
      .legend-labels { display: flex; justify-content: space-between; color: #9eaac5;
                       font-size: .78rem; }
      .note { background: #141c31; border: 1px solid #26324f; border-radius: 14px;
              padding: .9rem 1rem; color: #b6c1d8; margin-top: 1rem; }
      div[data-testid="stFileUploader"] { background: #111a2e; border: 1px dashed #526283;
                                           border-radius: 16px; padding: .5rem; }
      div[data-testid="stDownloadButton"] button { border-radius: 10px; }
    </style>
    """,
    unsafe_allow_html=True,
)

st.markdown(
    """
    <div class="hero">
      <div class="eyebrow">Monocular depth estimation</div>
      <h1>Seeing Depth</h1>
      <p>Turn one ordinary photo into a visual estimate of which regions appear nearer or farther.</p>
    </div>
    """,
    unsafe_allow_html=True,
)

uploaded_file = st.file_uploader(
    "Choose a photo",
    type=["jpg", "jpeg", "png", "webp"],
    help="One RGB image at a time. The first prediction downloads the pretrained model weights.",
)

if uploaded_file is None:
    st.info("Upload a JPG, PNG, or WebP photo to create its depth map.")
    st.markdown(
        '<div class="note">The map shows relative depth only. Its colors are normalized for each image and do not represent meters.</div>',
        unsafe_allow_html=True,
    )
else:
    try:
        uploaded_bytes = uploaded_file.getvalue()
        upload_id = hashlib.sha256(uploaded_bytes).hexdigest()
        if st.session_state.get("upload_id") != upload_id:
            st.session_state["upload_id"] = upload_id
            st.session_state.pop("depth_result", None)
            st.session_state.pop("source_image", None)

        original = ImageOps.exif_transpose(Image.open(BytesIO(uploaded_bytes))).convert("RGB")
        max_side = 1600
        if max(original.size) > max_side:
            original.thumbnail((max_side, max_side), Image.Resampling.LANCZOS)

        predict = st.button("Estimate depth", type="primary", use_container_width=True)
        if predict:
            with st.spinner("Loading the model and estimating depth…"):
                st.session_state["depth_result"] = estimate_depth(original)
                st.session_state["source_image"] = original

        depth_result = st.session_state.get("depth_result")
        saved_original = st.session_state.get("source_image")
        if depth_result is not None and saved_original is not None:
            contrast = st.slider(
                "Depth-map contrast",
                min_value=0.6,
                max_value=1.8,
                value=1.0,
                step=0.1,
                help="Adjusts how strongly depth differences appear in the visualization.",
            )
            normalized = normalize_depth(depth_result, contrast)
            colored_map = colorize_depth(normalized)

            photo_col, map_col = st.columns(2, gap="large")
            with photo_col:
                st.markdown('<div class="panel-title">Original photo</div>', unsafe_allow_html=True)
                st.image(saved_original, use_container_width=True)
            with map_col:
                st.markdown('<div class="panel-title">Estimated relative depth</div>', unsafe_allow_html=True)
                st.image(colored_map, use_container_width=True)
                st.markdown(
                    '<div class="depth-legend"></div><div class="legend-labels"><span>Farther</span><span>Nearer</span></div>',
                    unsafe_allow_html=True,
                )

            st.markdown(
                '<div class="note">This is a relative estimate, not a measurement in meters. Reflective surfaces, thin objects, and low-texture regions can be difficult for monocular depth models.</div>',
                unsafe_allow_html=True,
            )

    except Exception as error:
        st.error(f"Could not process this image: {error}")
        st.caption("Check that model access is available and that this project environment has its dependencies installed.")
