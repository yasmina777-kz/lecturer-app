"""HTTP/lifecycle regression checks with a fake engine, no camera or model downloads."""
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient
import server


class ServiceTests(unittest.TestCase):
    def setUp(self):
        self.engine = MagicMock(vocab={'0': '<BLANK>', '1': '<UNK>', '2': 'дом'}, epoch=1, metrics={})
        self.engine.recognize.return_value = {'status': 'uncertain', 'text': '', 'tokens': [], 'message': 'Повторите'}
        self.patch = patch('server.Engine', return_value=self.engine)
        self.patch.start()
        self.client = TestClient(server.app).__enter__()

    def tearDown(self):
        self.client.__exit__(None, None, None)
        self.patch.stop()
        self.assertIsNone(server.engine)
        self.engine.close.assert_called_once()

    def post(self, body=b'video', mime='video/mp4', client='platform'):
        return self.client.post('/api/krsl/recognize', content=body,
                                headers={'content-type': mime, 'x-krsl-client': client})

    def test_status_and_request_validation(self):
        self.assertTrue(self.client.get('/api/krsl/status').json()['ready'])
        self.assertEqual(self.post(client='other').status_code, 403)
        self.assertEqual(self.post(mime='text/plain').status_code, 415)
        self.assertEqual(self.post(body=b'').status_code, 400)
        with patch('server.MAX_BYTES', 3):
            self.assertEqual(self.post(body=b'four').status_code, 413)
        self.engine.recognize.assert_not_called()

    def test_temporary_video_removed_after_success_and_failure(self):
        paths = []
        def infer(path):
            self.assertEqual(path.read_bytes(), b'video')
            paths.append(Path(path))
            return self.engine.recognize.return_value
        self.engine.recognize.side_effect = infer
        self.assertEqual(self.post().status_code, 200)
        self.assertTrue(all(not path.exists() for path in paths))
        def invalid(path):
            paths.append(Path(path))
            raise ValueError('Видео слишком короткое')
        self.engine.recognize.side_effect = invalid
        response = self.post()
        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.json()['detail'], 'Видео слишком короткое')
        self.assertTrue(all(not path.exists() for path in paths))


if __name__ == '__main__':
    unittest.main()
