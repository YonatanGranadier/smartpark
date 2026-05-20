"""
SmartPark – Roboflow Plate Recognition Module
==============================================
Accepts raw JPEG bytes as sent by the ESP32-CAM and returns the
detected license plate text using the Roboflow serverless workflow.
"""

import os
import cv2
import numpy as np
from dotenv import load_dotenv
from inference_sdk import InferenceHTTPClient

load_dotenv()

_client = None


def _get_client() -> InferenceHTTPClient:
    global _client
    if _client is None:
        _client = InferenceHTTPClient(
            api_url="https://serverless.roboflow.com",
            api_key=os.getenv('ROBOFLOW_API_KEY', '')
        )
    return _client


def recognize_plate(image_bytes: bytes) -> str:
    """
    Accept raw JPEG bytes from the ESP32-CAM and return the license
    plate text (e.g. 'ABC1234'), or '' if no plate was detected.
    """
    if not image_bytes:
        return ''

    # Decode JPEG bytes → numpy BGR array (what cv2 / Roboflow expect)
    arr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        return ''

    result = _get_client().run_workflow(
        workspace_name="yonatans-workspace-pcw8o",
        workflow_id="general-segmentation-api-5",
        images={"image": img},
        parameters={"classes": "0, 1, 10"},
        use_cache=True,
    )

    return _parse_plate(result)


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