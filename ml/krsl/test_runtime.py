import json
from pathlib import Path
import tempfile
import unittest
from types import SimpleNamespace
import numpy as np
import torch
from model import decode_ctc
from runtime import vector, POSE, FACE
from train import distance, read_manifest


class PipelineTests(unittest.TestCase):
    def test_ctc_repeated_sign_after_blank(self):
        logits = torch.full((6, 3), -10.)
        for frame, token in enumerate([1, 1, 0, 1, 2, 2]): logits[frame, token] = 10
        self.assertEqual(decode_ctc(logits, {'0':'<BLANK>','1':'дом','2':'мама'}), ['дом','дом','мама'])

    def test_exact_training_feature_layout(self):
        landmarks = [SimpleNamespace(x=float(i), y=float(i + 1), z=-float(i)) for i in range(478)]
        result = SimpleNamespace(left_hand_landmarks=landmarks[:21], right_hand_landmarks=[],
                                 pose_landmarks=landmarks[:33], face_landmarks=landmarks)
        features = vector(result)
        self.assertEqual(features.shape, (180,))
        self.assertTrue(np.all(features[63:126] == 0))
        self.assertEqual(features[126], POSE[0])
        self.assertEqual(features[144], FACE[0])
        self.assertEqual(features[177], FACE[-1])

    def test_wer_edits(self):
        self.assertEqual(distance(['я','хотеть','книга'], ['я','книга']), 1)
        self.assertEqual(distance(['книга'], ['мама','там']), 2)

    def test_manifest_blocks_signer_leakage(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            rows = []
            for i, split in enumerate(['train','val','test']):
                (root/f'{i}.mp4').write_bytes(bytes([i]))
                rows.append(dict(video=f'{i}.mp4', tokens=['дом'], group='same-person', split=split))
            path = root/'manifest.json';path.write_text(json.dumps(rows))
            with self.assertRaisesRegex(ValueError, 'leakage'): read_manifest(path, {'дом':2})
            for i, row in enumerate(rows): row['group'] = str(i)
            path.write_text(json.dumps(rows)); self.assertEqual(len(read_manifest(path, {'дом':2})),3)
            rows[0]['tokens']=['несуществующая'];path.write_text(json.dumps(rows))
            with self.assertRaisesRegex(ValueError,'Unknown'):read_manifest(path, {'дом':2})


if __name__ == '__main__': unittest.main()
