import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from types import SimpleNamespace
import numpy as np
import torch
from model import decode_ctc
from runtime import Engine, vector, POSE, FACE
from train import distance, read_manifest, evaluate, dataset_summary, run_training


class PipelineTests(unittest.TestCase):
    def test_invalid_model_outputs_cannot_become_a_draft(self):
        engine = Engine.__new__(Engine)
        engine.vocab = {'0': '<BLANK>', '1': '<UNK>', '2': 'дом'}
        rows = np.zeros((6, 180), dtype=np.float32)
        engine.model = lambda *_: torch.full((1, 6, 3), float('nan'))
        with self.assertRaisesRegex(ValueError, 'некорректный результат'):
            engine.predict_features(rows)
        engine.model = lambda *_: torch.zeros((1, 6, 4))
        with self.assertRaises(ValueError): engine.predict_features(rows)
        engine.model = lambda *_: torch.tensor([[[0., 0., 8.]] * 6])
        self.assertEqual(engine.predict_features(rows)[0], ['дом'])
        for invalid in [np.zeros((6, 179)), np.full((6, 180), np.inf), np.zeros((0, 180))]:
            with self.assertRaises(ValueError): engine.predict_features(invalid)

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

    def test_negative_clips_require_review_and_cannot_replace_labeled_splits(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            rows = []
            for i, split in enumerate(['train', 'val', 'test', 'train']):
                (root / f'{i}.mp4').write_bytes(bytes([i]))
                rows.append(dict(video=f'{i}.mp4', tokens=['дом', 'дом'], group=str(i), split=split))
            rows[-1].update(tokens=[])
            path = root / 'manifest.json'
            path.write_text(json.dumps(rows))
            with self.assertRaisesRegex(ValueError, 'explicit negative'):
                read_manifest(path, {'дом': 2})
            rows[-1]['negative'] = True
            path.write_text(json.dumps(rows))
            checked = read_manifest(path, {'дом': 2})
            self.assertEqual(dataset_summary(checked)['train']['negativeClips'], 1)
            self.assertEqual(dataset_summary(checked)['train']['phraseClips'], 1)
            rows[-1]['tokens'] = ['дом']
            path.write_text(json.dumps(rows))
            with self.assertRaisesRegex(ValueError, 'Negative clips'):
                read_manifest(path, {'дом': 2})
            rows[-1]['tokens'] = []
            rows[1].update(tokens=[], negative=True)
            path.write_text(json.dumps(rows))
            with self.assertRaisesRegex(ValueError, 'labeled signing'):
                read_manifest(path, {'дом': 2})

    def test_no_sign_false_positives_are_separate_from_phrase_wer(self):
        class AlwaysHouse(torch.nn.Module):
            def forward(self, x, lengths):
                logits = torch.zeros((1, x.shape[1], 3))
                logits[:, :, 2] = 10
                return logits
        rows = [dict(features=np.zeros((6, 180), dtype=np.float32), tokens=tokens, sha256=str(i))
                for i, tokens in enumerate([['дом'], [], ['дом', 'дом']])]
        report = evaluate(AlwaysHouse(), rows, {'0': '<BLANK>', '1': '<UNK>', '2': 'дом'})
        self.assertAlmostEqual(report['wer'], 1 / 3)
        self.assertEqual(report['exactPhraseRate'], .5)
        self.assertEqual(report['negativeFalsePositiveRate'], 1.)
        self.assertIsNone(evaluate(AlwaysHouse(), rows[:1], {'2': 'дом'})['negativeFalsePositiveRate'])

    def test_ctc_negative_clip_has_finite_loss_and_gradient(self):
        logits = torch.zeros((6, 1, 3), requires_grad=True)
        loss = torch.nn.CTCLoss(blank=0)(logits.log_softmax(-1), torch.tensor([], dtype=torch.long),
                                       torch.tensor([6]), torch.tensor([0]))
        self.assertTrue(torch.isfinite(loss))
        loss.backward()
        self.assertTrue(torch.isfinite(logits.grad).all())
        self.assertTrue((logits.grad[:, :, 0] < 0).all())

    def test_training_stops_and_does_not_reuse_old_candidates(self):
        # Synthetic tensors test the training machinery, not sign-recognition accuracy.
        class TinyModel(torch.nn.Module):
            def __init__(self):
                super().__init__()
                self.head = torch.nn.Linear(180, 3)
                with torch.no_grad():
                    self.head.weight.zero_()
                    self.head.bias.copy_(torch.tensor([0., 0., 10.]))

            def forward(self, x, lengths):
                return self.head(x)

        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'checkpoint.pt').write_bytes(b'not modified by training')
            (root / 'manifest.json').write_text('[]')
            rows = [dict(split=split, tokens=['дом'], group=str(i), sha256=str(i), video=str(i))
                    for i, split in enumerate(['train', 'val', 'test'])]
            engine = SimpleNamespace(model=TinyModel(), vocab={'0': '<BLANK>', '1': '<UNK>', '2': 'дом'},
                                     extract=lambda _: (np.zeros((6, 180), dtype=np.float32), 1.))
            args = SimpleNamespace(manifest=root / 'manifest.json', learning_rate=1e-5,
                                   epochs=5, patience=2, evaluate_only=False)
            with patch('train.DATA', root), patch('train.feature_cache_version', return_value='test-extractor'):
                run_training(args, rows, {'token2idx': {'дом': 2}}, dataset_summary(rows), engine)
                run_training(args, rows, {'token2idx': {'дом': 2}}, dataset_summary(rows), engine)
            reports = list(root.glob('training/*/evaluation.json'))
            self.assertEqual(len(reports), 2)
            for path in reports:
                report = json.loads(path.read_text())
                self.assertEqual(len(report['epochs']), 2)
                self.assertFalse(report['improvedValidation'])
                self.assertFalse((path.parent / 'candidate.pt').exists())
            self.assertEqual((root / 'checkpoint.pt').read_bytes(), b'not modified by training')


if __name__ == '__main__': unittest.main()
