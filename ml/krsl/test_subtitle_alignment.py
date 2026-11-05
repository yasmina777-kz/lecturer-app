import unittest
import numpy as np

from audit_subtitle_alignment import assess, validate_reviewed
from serve_subtitle_review import parse_range


class AlignmentTests(unittest.TestCase):
    def test_video_seek_ranges_are_bounded(self):
        self.assertEqual(parse_range('bytes=20-39',100),(20,39))
        self.assertEqual(parse_range('bytes=20-',100),(20,99))
        self.assertEqual(parse_range('bytes=-10',100),(90,99))
        self.assertEqual(parse_range('bytes=80-1000',100),(80,99))
        for value in ['bytes=100-', 'bytes=20-10', 'bytes=-0', 'bytes=0-1,5-6', 'bytes=-']:
            with self.assertRaises(ValueError):
                parse_range(value,100)

    def test_cutaway_without_landmarks_is_quarantined(self):
        result = assess(np.zeros((50,180), dtype=np.float32), np.arange(50)*.08, dict(start=0,end=4))
        self.assertFalse(result['technicalEligible'])
        self.assertIn('hands_missing', result['reasons'])
        self.assertIn('long_gap_without_hands', result['reasons'])

    def test_good_tracking_is_not_semantic_approval(self):
        rows = np.full((50,180), .4, dtype=np.float32)
        rows[:,126:129] = [.3,.5,.1]; rows[:,129:132] = [.7,.5,.1]
        result = assess(rows, np.arange(50)*.08, dict(start=0,end=4))
        self.assertTrue(result['technicalEligible'])
        self.assertNotIn('meaningConfirmed', result)
        self.assertIn('little_observed_hand_motion', result['warnings'])

    def test_incomplete_review_cannot_be_approved(self):
        row = dict(video_id='a', reviewStatus='approved', meaningConfirmed=False, timingConfirmed=True)
        with self.assertRaisesRegex(ValueError, 'Meaning and timing'):
            validate_reviewed([row], {'a'})

    def test_signer_and_recording_split_leakage_rejected(self):
        row = dict(video_id='a', sourceDuration=10, reviewStatus='approved', meaningConfirmed=True,
                   timingConfirmed=True, signLanguage='rsl', reviewer='reviewer-1', signerGroup='person-1',
                   recordingGroup='recording-1', correctedStart=1, correctedEnd=4,
                   correctedText='пример', split='train')
        self.assertEqual(len(validate_reviewed([row], {'a'})),1)
        other = dict(row, video_id='b', split='test', recordingGroup='recording-2')
        with self.assertRaisesRegex(ValueError, 'leakage'):
            validate_reviewed([row,other], {'a','b'})
        other.update(signerGroup='person-2', recordingGroup='recording-1')
        with self.assertRaisesRegex(ValueError, 'leakage'):
            validate_reviewed([row,other], {'a','b'})

    def test_unknown_source_and_invalid_boundaries_rejected(self):
        with self.assertRaisesRegex(ValueError, 'Unknown source'):
            validate_reviewed([dict(video_id='bad', reviewStatus='approved')], {'a'})


if __name__ == '__main__':
    unittest.main()
