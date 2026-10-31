"""Package the actual letter-classifier training inputs without private project files."""
from pathlib import Path
import hashlib
import json
import sys
import zipfile

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / 'ml/rsl/data/alphabet'
PUBLIC = ROOT / 'frontend/public'
output = Path(sys.argv[1]).expanduser().resolve()
manifest = json.loads((DATA / 'manifest.json').read_text())
refs = json.loads((PUBLIC / 'research/rsl/alphabet/sources.json').read_text())
files = {}
def add(relative):
    file = ROOT / relative
    assert file.is_file(), relative
    files[relative] = file
for name in ['train_alphabet.py', 'extract_alphabet.py', 'prepare_alphabet.py', 'prepare_data.py', 'requirements.txt', 'requirements-lock.txt']:
    add('ml/rsl/' + name)
add('ml/rsl/data/annotations.tsv')
add('ml/rsl/data/alphabet/manifest.json')
for row in manifest:
    add('ml/rsl/data/alphabet/features-v1/' + row['attachment_id'] + '.json')
# train_alphabet.py also exports 33 example videos after fitting the classifier.
for row in refs:
    add('ml/rsl/data/alphabet/' + row['attachment_id'] + '.mp4')
for name in ['hand_landmarker.task', 'alphabet-classifier.json', 'alphabet-report.json', 'alphabet-provenance.json', 'alphabet-fixtures.json']:
    add('frontend/public/models/rsl/' + name)
for name in ['ATTRIBUTION.txt', 'bukva-license.pdf', 'alphabet/sources.json']:
    add('frontend/public/research/rsl/' + name)
for name in ['recognition.ts', 'temporal.ts']:
    add('frontend/src/sign/' + name)
readme = '''AI Mentor — обучение распознаванию букв РЖЯ

Главный файл: ml/rsl/train_alphabet.py
Готовая модель: frontend/public/models/rsl/alphabet-classifier.json
Результаты: frontend/public/models/rsl/alphabet-report.json

Это обученный логистический классификатор 33 отдельных букв и «нет жеста».
Он получает координаты кисти от готовой модели Google MediaPipe, которую мы
не обучали. Вход: 16 кадров, 474 числовых признака. API-ключи не нужны.
Слова, фразы, грамматику, лицо и тело эта модель НЕ распознаёт.

В архиве реальные признаки из 2 142 видео Bukva: 1 530 для обучения,
612 для теста. Люди в тесте не пересекаются с людьми в обучении.
manifest.json содержит метки и идентификаторы видео; features-v1 — извлечённые
координаты. Также включены 33 видеообразца, нужные скрипту при экспорте.
Все исходные видео (около 1,8 ГБ) не включены; их загрузит prepare_alphabet.py.
Публичные данные и производные материалы сохраняют лицензию и атрибуцию Bukva:
frontend/public/research/rsl/bukva-license.pdf и ATTRIBUTION.txt.
MediaPipe: https://github.com/google-ai-edge/mediapipe (Apache 2.0).

Повторить обучение на готовых признаках (из корня распакованного архива):
python3.11 -m venv ml/rsl/.venv
ml/rsl/.venv/bin/pip install -r ml/rsl/requirements-lock.txt
ml/rsl/.venv/bin/python ml/rsl/train_alphabet.py

Чтобы заново извлечь признаки из видео, сначала запустите prepare_alphabet.py,
затем переместите старую папку features-v1 в резервную копию и запустите
extract_alphabet.py, после него train_alphabet.py.

Сохранённая точность на тестовых видео — 76,47%; это не точность вашей камеры.
Модель может ошибаться или отказаться от ответа. Число после распознавания
не является подтверждением правильности жеста преподавателем РЖЯ.
CHECKSUMS.json позволяет проверить, что включены именно файлы проекта.
'''
output.parent.mkdir(parents=True, exist_ok=True)
with zipfile.ZipFile(output, 'w', compression=zipfile.ZIP_DEFLATED) as archive:
    hashes = {}
    for relative, file in sorted(files.items()):
        archive.write(file, 'AI-Mentor-training/' + relative)
        hashes[relative] = hashlib.sha256(file.read_bytes()).hexdigest()
    archive.writestr('AI-Mentor-training/README.txt', readme)
    archive.writestr('AI-Mentor-training/CHECKSUMS.json', json.dumps(hashes, indent=2))
with zipfile.ZipFile(output) as archive:
    assert archive.testzip() is None
print(f'{output}: {len(manifest)} feature sequences, {len(refs)} reference videos, {output.stat().st_size / 1024**2:.1f} MB')
