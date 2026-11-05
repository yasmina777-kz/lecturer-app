"""Protocol/causality checks; these are NOT recognition accuracy measurements."""
import unittest

import numpy as np
import torch

from subtitle_model import SubtitleTranslator, normalize_landmarks
from train_subtitle_translation import decode, metrics, validate_splits


class SubtitleTrainingTests(unittest.TestCase):
    def test_related_recordings_cannot_cross_splits(self):
        sources = [dict(video_id=str(i), videoSha256=str(i)) for i in range(3)]
        mapping = {str(i): dict(split=s, recordingGroup='same' if i < 2 else 'other')
                   for i, s in enumerate(['train', 'val', 'test'])}
        with self.assertRaisesRegex(ValueError, 'Related recordings'):
            validate_splits(sources, mapping)

    def test_duplicate_source_rejected(self):
        sources = [dict(video_id=str(i), videoSha256='duplicate') for i in range(3)]
        mapping = {str(i): dict(split=s, recordingGroup=str(i))
                   for i, s in enumerate(['train', 'val', 'test'])}
        with self.assertRaisesRegex(ValueError, 'Duplicate'):
            validate_splits(sources, mapping)

    def test_normalization_preserves_missing_and_translation_scale_invariance(self):
        rng = np.random.default_rng(42)
        points = rng.uniform(.2, .8, (3, 60, 3)).astype(np.float32)
        points[:, 42, :2] = [.3, .5]; points[:, 43, :2] = [.7, .5]
        points[:, :21] = 0  # missing left hand
        translated = points.copy()
        translated[:, 21:, :2] = translated[:, 21:, :2] * .6 + .1
        translated[:, 21:, 2] *= .6
        a = normalize_landmarks(points.reshape(3, 180))
        b = normalize_landmarks(translated.reshape(3, 180))
        np.testing.assert_allclose(a, b, atol=1e-6)
        self.assertTrue((a[:, :63] == 0).all())
        self.assertTrue((normalize_landmarks(np.zeros((2,180))) == 0).all())

    def test_decoder_cannot_read_future_characters(self):
        torch.manual_seed(4); torch.set_num_threads(2)
        model = SubtitleTranslator(12, d_model=32, layers=1, dropout=0).eval()
        x = torch.randn(2, 8, 180); lengths = torch.tensor([8, 5])
        tokens = torch.tensor([[1,4,5,6], [1,7,8,9]])
        with torch.no_grad():
            a = model(x, lengths, tokens)
            tokens[:, 2:] = 10
            b = model(x, lengths, tokens)
        torch.testing.assert_close(a[:, :2], b[:, :2])

    def test_wer_counts_insertions_and_eos_stops_output(self):
        result = metrics([dict(reference='привет', predicted='очень много неверных слов')])
        self.assertEqual(result['wer'], 4.)  # WER is not bounded by 100%.
        self.assertEqual(result['exactPhrases'], 0)
        self.assertEqual(decode([4, 5, 2, 4], ['а', 'б']), 'аб')


if __name__ == '__main__':
    unittest.main()
