"""
Run with:
  python test_plate.py <image_path> <expected_plate>
Example:
  python test_plate.py test_plate.jpg 7654321
"""
import sys, os, json
os.environ.setdefault('ROBOFLOW_API_KEY', os.getenv('ROBOFLOW_API_KEY', ''))

def main():
    img_path  = sys.argv[1] if len(sys.argv) > 1 else 'test_plate.jpg'
    expected  = sys.argv[2].upper().replace('-','').replace(' ','') if len(sys.argv) > 2 else ''

    with open(img_path, 'rb') as f:
        image_bytes = f.read()
    print(f'Image: {img_path}  ({len(image_bytes):,} bytes)')
    if expected:
        print(f'Expected plate: {expected}')
    print()

    # ── Roboflow raw output ───────────────────────────────────────────
    api_key = os.getenv('ROBOFLOW_API_KEY', '')
    if api_key:
        import cv2, numpy as np
        from inference_sdk import InferenceHTTPClient
        arr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        client = InferenceHTTPClient(api_url="https://serverless.roboflow.com", api_key=api_key)
        print('=== Roboflow raw result ===')
        try:
            result = client.run_workflow(
                workspace_name="yonatans-workspace-pcw8o",
                workflow_id="general-segmentation-api-5",
                images={"image": img},
                parameters={"classes": "0, 1, 10"},
                use_cache=False,
            )
            print(json.dumps(result, indent=2, default=str))
        except Exception as e:
            print(f'Roboflow error: {e}')
        print()
    else:
        print('(No ROBOFLOW_API_KEY set – skipping Roboflow)\n')

    # ── EasyOCR raw output ────────────────────────────────────────────
    import cv2, numpy as np, easyocr
    arr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    print('=== EasyOCR raw result ===')
    reader = easyocr.Reader(['en'], gpu=False, verbose=False)
    results = reader.readtext(img, detail=1, paragraph=False)
    for (bbox, text, conf) in results:
        cleaned = text.upper().replace('-','').replace(' ','')
        print(f'  text="{text}"  cleaned="{cleaned}"  conf={conf:.3f}')
    print()

    # ── What model.py currently returns ──────────────────────────────
    from model import recognize_plate
    print('=== model.recognize_plate() result ===')
    plate = recognize_plate(image_bytes)
    print(f'  returned: "{plate}"')
    if expected:
        match = plate == expected
        print(f'  expected: "{expected}"  → {"✅ MATCH" if match else "❌ MISMATCH"}')

if __name__ == '__main__':
    main()
