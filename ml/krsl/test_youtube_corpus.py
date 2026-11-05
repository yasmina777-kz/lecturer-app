import json
from pathlib import Path
import tempfile
import unittest
from prepare_youtube_corpus import parse_vtt, prepare


class CorpusTests(unittest.TestCase):
    def test_caption_timing_markup_multiline_and_notes(self):
        text = 'WEBVTT\r\n\r\nNOTE ignored\r\ncomment\r\n\r\ncue-1\r\n00:01:02.125 --> 00:01:04.875 align:start\r\n<v signer>Привет &amp; пока</v>\r\nВторая строка\r\n\r\n'
        self.assertEqual(list(parse_vtt(text)), [dict(start=62.125, end=64.875,
                          translation='Привет & пока Вторая строка')])
        with self.assertRaises(ValueError):
            list(parse_vtt('WEBVTT\n\n00:02.000 --> 00:01.000\nПривет'))

    def test_only_original_captions_and_complete_media_become_review_candidates(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            metadata = root / 'metadata.csv'
            metadata.write_text('sample,rsl\nother,ase\n')
            info = dict(id='sample', duration=10, subtitles={}, automatic_captions={'ru': [{}]})
            (root / 'sample.info.json').write_text(json.dumps(info))
            (root / 'sample.ru.vtt').write_text('WEBVTT\n\n00:01.000 --> 00:03.000\nПривет\n')
            (root / 'sample.mp4').write_bytes(b'fixture')
            output = root / 'output'
            report = prepare(metadata, root, output)
            self.assertEqual(report['downloadedVideos'], 0)
            info['subtitles'] = {'ru': [{}]}
            (root / 'sample.info.json').write_text(json.dumps(info))
            report = prepare(metadata, root, output)
            self.assertEqual(report['candidateSegments'], 1)
            self.assertEqual(report['usableForTraining'], 0)
            sample = json.loads((output / 'review-segments.json').read_text())[0]
            self.assertEqual(sample['reviewStatus'], 'pending')
            self.assertIsNone(sample['glossTokens'])
            self.assertIsNone(sample['split'])
            (root / 'sample.mp4').rename(root / 'sample.mp4.part')
            self.assertEqual(prepare(metadata, root, output)['downloadedVideos'], 0)


if __name__ == '__main__':
    unittest.main()
