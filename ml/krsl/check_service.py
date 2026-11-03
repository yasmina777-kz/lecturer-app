"""Actual local HTTP smoke tests, including blank video and invalid input."""
import tempfile
from pathlib import Path
import cv2
import numpy as np
import requests

URL = 'http://127.0.0.1:5070/api/krsl'
assert requests.get(URL + '/status', timeout=5).json()['ready']
assert requests.post(URL + '/recognize', data=b'bad', timeout=5).status_code == 403
headers = {'X-KRSL-Client': 'platform', 'Content-Type': 'video/mp4'}
assert requests.post(URL + '/recognize', headers=headers, data=b'', timeout=5).status_code == 400
assert requests.post(URL + '/recognize', headers=headers, data=b'invalid video', timeout=5).status_code == 422
with tempfile.TemporaryDirectory() as directory:
    # Exercise the production failure: portrait upload -> landscape webcam ->
    # another resolution. A poisoned graph used to fail every later request.
    for width,height in [(320,240),(240,426),(640,480),(320,240)]:
        path = Path(directory) / 'blank.mp4'
        out = cv2.VideoWriter(str(path), cv2.VideoWriter_fourcc(*'mp4v'), 24, (width,height))
        for _ in range(48): out.write(np.zeros((height,width,3),dtype=np.uint8))
        out.release()
        reply = requests.post(URL + '/recognize', headers=headers, data=path.read_bytes(), timeout=60)
        assert reply.status_code == 200, reply.text
        body = reply.json()
        assert body['status'] == 'no_tracking' and not body['text'], body
        print(f'{width}x{height}: {body["status"]}, {body["seconds"]}s',flush=True)
print('PASS: loaded model, header guard, empty/corrupt input, mixed video sizes and no-hand refusal over real HTTP')
