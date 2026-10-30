"""Fail the container build/start verification on absent dependencies or artifacts."""
import os
import shutil
import sys
from pathlib import Path

import cv2
import docx
import joblib
import pandas
import pymupdf
import pypdf
import pytesseract
import sklearn

root = Path(__file__).resolve().parents[1] / 'mlmodels'
for relative in ('Model1/m1_training', 'Model1/ocr', 'Model2', 'Model2/ocr', 'Model3/ocr'):
    sys.path.insert(0, str(root / relative))
for relative in ('Model1/m1_training/artifacts/m1_v1.joblib', 'Model2/m2_model.joblib', 'Model3/ocr/m3_model.joblib'):
    joblib.load(root / relative)
for executable in ('tesseract', 'soffice', 'node'):
    if not shutil.which(executable):
        raise SystemExit(f'Missing executable: {executable}')
if not {'eng', 'hin'}.issubset(pytesseract.get_languages()):
    raise SystemExit('Missing Tesseract language data')
if not Path('/app/backend/templates/email/notification.html').is_file():
    raise SystemExit('Missing email template')
if not os.access(os.environ['UPLOAD_DIR'], os.W_OK):
    raise SystemExit('Upload directory is not writable')
print('Runtime dependencies and model artifacts loaded successfully')
