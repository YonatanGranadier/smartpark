"""
SmartPark – Plate Recognition Module
=====================================
Tries Roboflow first (requires ROBOFLOW_API_KEY in .env).
Falls back to EasyOCR directly on the image if Roboflow is
unavailable or the API key is missing.
"""

import os
import re
import cv2
import numpy as np
from dotenv import load_dotenv

load_dotenv()

_client     = None
_ocr_reader = None


def _get_client():
    global _client
    api_key = os.getenv('ROBOFLOW_API_KEY', '')
    if not api_key:
        return None
    if _client is None:
        from inference_sdk import InferenceHTTPClient
        _client = InferenceHTTPClient(
            api_url="https://serverless.roboflow.com",
            api_key=api_key,
        )
    return _client


def _get_ocr():
    global _ocr_reader
    if _ocr_reader is None:
        import easyocr
        print('  [model] loading EasyOCR...')
        _ocr_reader = easyocr.Reader(['en'], gpu=False, verbose=False)
        print('  [model] EasyOCR ready')
    return _ocr_reader


# ─── plate string validator ────────────────────────────────────────────

_PLATE_RE = re.compile(r'^[A-Z0-9]{5,10}$')

# Strip ALL common delimiters (dashes, spaces, dots, slashes)
def _clean(text: str) -> str:
    return re.sub(r'[\-\. /]', '', text.upper())

def _looks_like_plate(text: str) -> bool:
    return bool(_PLATE_RE.match(_clean(text)))

def _plate_score(cleaned: str, conf: float) -> float:
    """Higher = more likely to be a real plate. Prefer 7-digit Israeli format."""
    length_bonus = 2.0 if len(cleaned) == 7 and cleaned.isdigit() else \
                   1.0 if 6 <= len(cleaned) <= 8 else 0.0
    return conf + length_bonus


# ─── EasyOCR fallback ─────────────────────────────────────────────────

def _ocr_fallback(img) -> str:
    """Run EasyOCR on the full image and return the best plate candidate."""
    reader = _get_ocr()
    results = reader.readtext(img, detail=1, paragraph=False)
    print(f'  [model] EasyOCR found {len(results)} text regions')
    candidates = []
    for (_, text, conf) in results:
        cleaned = _clean(text)
        print(f'    "{text}" → "{cleaned}" (conf={conf:.2f})')
        if _looks_like_plate(cleaned):
            score = _plate_score(cleaned, conf)
            candidates.append((score, cleaned))
    if not candidates:
        return ''
    candidates.sort(reverse=True)
    return candidates[0][1]


# ─── public entry point ───────────────────────────────────────────────

def recognize_plate(image_bytes: bytes) -> str:
    """
    Accept raw JPEG bytes from the ESP32-CAM and return the license
    plate text (e.g. '7654321'), or '' if no plate was detected.
    """
    if not image_bytes:
        return ''

    arr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        return ''

    print(f'  [model] image decoded: {img.shape[1]}x{img.shape[0]} px')

    client = _get_client()
    if client is not None:
        print(f'  [model] calling Roboflow...')
        try:
            result = client.run_workflow(
                workspace_name="yonatans-workspace-pcw8o",
                workflow_id="general-segmentation-api-5",
                images={"image": img},
                parameters={"classes": "0, 1, 10"},
                use_cache=True,
            )
            print(f'  [model] raw result: {result}')
            plate = _parse_plate(result)
            if plate:
                print(f'  [model] Roboflow plate: "{plate}"')
                return plate
            print(f'  [model] Roboflow returned nothing, trying EasyOCR fallback...')
        except Exception as e:
            print(f'  [model] ❌ Roboflow error: {e} — falling back to EasyOCR')
    else:
        print(f'  [model] No ROBOFLOW_API_KEY — using EasyOCR')

    plate = _ocr_fallback(img)
    print(f'  [model] EasyOCR plate: "{plate}"')
    return plate


# ─── Result parsing ────────────────────────────────────────────────────

def _parse_plate(result) -> str:
    """Extract the plate string from the Roboflow workflow output."""
    if not result:
        return ''
    output = result[0] if isinstance(result, list) else result
    if not isinstance(output, dict):
        return ''
    return _search_for_plate(output)


def _search_for_plate(obj) -> str:
    """
    Recursively walk the workflow output dict/list and return the first
    string that looks like a license plate (4-10 alphanumeric chars).
    Explicit OCR keys are checked first so common formats are preferred.
    """
    if isinstance(obj, str):
        cleaned = obj.upper().replace(' ', '').replace('-', '')
        if 4 <= len(cleaned) <= 10 and cleaned.isalnum():
            return cleaned
        return ''

    if isinstance(obj, dict):
        # Prefer well-known OCR output keys
        for key in ('ocr_text', 'text', 'plate_text', 'license_plate', 'plate'):
            val = obj.get(key, '')
            if isinstance(val, str):
                cleaned = val.upper().replace(' ', '').replace('-', '')
                if 4 <= len(cleaned) <= 10 and cleaned.isalnum():
                    return cleaned
        # Fall back to recursing all values (highest-confidence first if available)
        predictions = obj.get('predictions')
        if isinstance(predictions, list):
            predictions_sorted = sorted(
                predictions,
                key=lambda p: p.get('confidence', 0) if isinstance(p, dict) else 0,
                reverse=True,
            )
            for pred in predictions_sorted:
                found = _search_for_plate(pred)
                if found:
                    return found
        for val in obj.values():
            found = _search_for_plate(val)
            if found:
                return found

    if isinstance(obj, list):
        for item in obj:
            found = _search_for_plate(item)
            if found:
                return found

    return ''