"""Configuration tests use dummy values and temporary files only."""
import json
from pathlib import Path
import sys
import tempfile
import unittest
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from settings import load_environment, read_dotenv

class SettingsTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
    def tearDown(self):
        self.temp.cleanup()
    def write(self, text):
        (self.root / '.env').write_text(text)
    def test_literals_are_never_executed_or_expanded(self):
        self.write('OPENAI_API_KEY="$(echo must-not-run)${HOME}`id`"\n')
        self.assertEqual(load_environment(self.root, {})['OPENAI_API_KEY'], '$(echo must-not-run)${HOME}`id`')
    def test_precedence_and_empty_values(self):
        self.write('OPENAI_API_KEY=dotenv\nAZURE_SPEECH_KEY=\nAI__Model=from-env-file\n')
        (self.root / 'local.config.json').write_text(json.dumps({'OPENAI_API_KEY':'wizard','AI__Model':'wizard-model'}))
        result=load_environment(self.root, {'OPENAI_API_KEY':'process'})
        self.assertEqual(result['OPENAI_API_KEY'],'process')
        self.assertEqual(result['AI__Model'],'wizard-model')
        self.assertNotIn('AZURE_SPEECH_KEY', result)
    def test_quotes_comments_bom_and_export(self):
        self.write('\ufeff# comment\nexport AZURE_SPEECH_REGION=westeurope # region\nOPENAI_API_KEY="dummy # value"\nAI__Model=demo\n')
        self.assertEqual(read_dotenv(self.root/'.env')['OPENAI_API_KEY'],'dummy # value')
        self.assertEqual(read_dotenv(self.root/'.env')['AZURE_SPEECH_REGION'],'westeurope')
    def test_only_server_keys_are_imported(self):
        self.write('PATH=bad\nVITE_SECRET=bad\nPOSTGRES_PASSWORD=docker-only\nAI__InputUsdPerMillion=0.15\n')
        self.assertEqual(load_environment(self.root, {}),{'AI__InputUsdPerMillion':'0.15'})
    def test_invalid_lines_never_echo_secrets(self):
        for value in ('dummy-secret-without-equals', 'OPENAI_API_KEY="dummy-secret'):
            self.write(value)
            with self.assertRaises(ValueError) as error:read_dotenv(self.root/'.env')
            self.assertNotIn('dummy-secret',str(error.exception))
    def test_missing_files(self):
        self.assertEqual(load_environment(self.root, {'PATH':'original'}),{'PATH':'original'})
    def test_invalid_config(self):
        (self.root/'local.config.json').write_text('["dummy-secret"]')
        with self.assertRaises(ValueError):load_environment(self.root,{})
if __name__=='__main__':unittest.main()
