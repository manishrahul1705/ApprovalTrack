# ApprovalTrack M2 package

Contents:

- `ocr/m2_common.py` - shared candidate finder (dates, numbers, issuer lines). Training and inference both use it.
- `ocr/m2_extract.py` - calls the existing `ocr_extract.py` and prints the M2 JSON. Node.js spawns it like the M1 script.
- `m2_train.py`, `m2_modeling.py`, `ocr/m2_predict.py` - local training, shared preprocessing, calibrated inference.
- `m2_evaluate.py`, `metrics.json`, `MODEL_CARD.md` - final test metrics, stress checks, and model limitations.
- `tests/test_m2_predict.py` - predictor schema, safeguards, determinism, and extractor failure tests.
- `ocr/tests/` - candidate-finder and extraction tests: `python -m pytest ocr/tests`.
- `generate_m2_dataset.py` - rebuilds or enlarges the dataset: `python generate_m2_dataset.py --out dataset --per-class 2500 --seed 2026`.
- `make_sample_pdfs.py` - renders test-split documents as PDFs and a scanned PNG for trying the pipeline.
- `dataset/` - dataset card and recorded generation report. Generated CSV/JSONL files are excluded from Git; regenerate them for training.
- `M2_training_prompt.md` - the prompt to give to an AI to train M2.

Install the shared dependencies from `../Model1/ocr/requirements.txt` and
`../Model1/m1_training/requirements.txt`; tests also need `pytest`.
The checked-in `m2_model.joblib` supports inference without training. See the
CLI command below for the required module paths.

## Train and evaluate M2

From this `Model2` directory, run:

```powershell
# Only needed for retraining; the recorded dataset used 1,500 documents per class.
python generate_m2_dataset.py --out dataset --per-class 1500 --seed 2026
python m2_train.py
python -m pytest tests\test_m2_predict.py ocr\tests\test_m2_common.py -q
python m2_evaluate.py
```

Training reconstructs candidates using the shared `find_candidates()` helper. It uses train layouts to fit,
validation layouts to compare models and fit probability calibration, and only then evaluates on the held-out
test layouts. The resulting local artifact is `m2_model.joblib`; evaluation writes `metrics.json` and
`MODEL_CARD.md`.

In this workspace, the read-only M1 OCR module is in `..\Model1\ocr`, rather than beside the M2 extractor.
For a direct CLI run from this directory, add both OCR locations to `PYTHONPATH`:

```powershell
$env:PYTHONPATH = "..\Model1\ocr;.\ocr;."
python .\ocr\m2_extract.py .\samples\sample_fire.pdf --doc-type fire
```
