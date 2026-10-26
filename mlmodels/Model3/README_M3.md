# ApprovalTrack M3 - lease reader (package)

Demo data only. AI-suggested values are not verified; a person confirms; the software never replaces the competent authority.

## Contents
- ocr/m3_lease.py - deterministic lease_status / reconcile_lease / lease_end_date (tested)
- ocr/m3_common.py - the shared candidate finder (dates + terms), used by training AND inference
- ocr/m3_extract.py - OCR wrapper using the checked-in m3_predict.py and m3_model.joblib, prints JSON schema m3-output-1
- dataset/ - generator, validator, sample maker, and recorded reports for the 8,000-deed dataset; generated CSV/JSONL files are excluded from Git
- samples/ - 8 PDFs + 1 scanned PNG + expected_outputs.json
- tests/ - candidate, lease, extraction, and predictor tests; prompts/M3_TRAINING_PROMPT.md - training specification

## Run
From `mlmodels/Model3`, install the shared dependencies and test helpers
(the Tesseract executable is installed separately):

    python -m pip install -r ../Model1/ocr/requirements.txt -r ../Model1/m1_training/requirements.txt
    python -m pip install pytest reportlab python-docx pypdf
    python -m pytest tests -q
    python ocr/m3_extract.py samples/03_all_three_consistent.pdf --doc-type lease
    # Regenerate the dataset only for training/evaluation.
    python dataset/generate_m3_dataset.py --out dataset --docs-per-layout 500 --seed 2026
    python dataset/validate_m3_dataset.py dataset

## Notes
- Non-target candidates are labelled `other` (not "none") so no label looks like a null. NONE means "not present / blank".
- m3_extract tries the shared ocr_extract.py module when it is on PYTHONPATH, and falls back to a built-in reader (PyMuPDF, Tesseract for scans only, DOCX).
- m3_common.py is self-contained (does not import m2_common.py); it uses the same date formats and the same ambiguity rule.
- Known limitation: a term/date split across a page break by a page header is not matched (such deeds were dropped from the dataset, not repaired).
