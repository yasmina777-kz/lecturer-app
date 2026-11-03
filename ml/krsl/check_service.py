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
    path = Path(directory) / 'blank.mp4'
    out = cv2.VideoWriter(str(path), cv2.VideoWriter_fourcc(*'mp4v'), 24, (320,240))
    for _ in range(48): out.write(np.zeros((240,320,3),dtype=np.uint8))
    out.release()
    reply = requests.post(URL + '/recognize', headers=headers, data=path.read_bytes(), timeout=60)
    assert reply.status_code == 200, reply.text
    body = reply.json()
    assert body['status'] == 'no_tracking' and not body['text'], body
print('PASS: loaded model, header guard, empty/corrupt input, no-hand refusal over real HTTP')
