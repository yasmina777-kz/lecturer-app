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
for name in ['train_alphabet.py', 'train_alphabet_v3.py', 'render_model_comparison.py', 'extract_alphabet.py', 'prepare_alphabet.py', 'prepare_data.py', 'requirements.txt', 'requirements-lock.txt']:
    add('ml/rsl/' + name)
add('ml/rsl/data/annotations.tsv')
add('ml/rsl/data/alphabet/manifest.json')
add('ml/rsl/data/alphabet/baseline-manifest.json')
for row in manifest:
    add('ml/rsl/data/alphabet/features-v1/' + row['attachment_id'] + '.json')
# train_alphabet.py also exports 33 example videos after fitting the classifier.
for row in refs:
    add('ml/rsl/data/alphabet/' + row['attachment_id'] + '.mp4')
for name in ['hand_landmarker.task', 'alphabet-classifier.json', 'alphabet-report.json', 'alphabet-provenance.json', 'alphabet-fixtures.json', 'alphabet-cautious-classifier.json', 'alphabet-cautious-report.json', 'alphabet-cautious-fixtures.json', 'alphabet-cautious-provenance.json']:
    add('frontend/public/models/rsl/' + name)
for name in ['ATTRIBUTION.txt', 'bukva-license.pdf', 'alphabet/sources.json']:
    add('frontend/public/research/rsl/' + name)
for name in ['recognition.ts', 'temporal.ts']:
    add('frontend/src/sign/' + name)
readme = """AI Mentor — два режима распознавания 33 букв РЖЯ

Файл нового обучения: ml/rsl/train_alphabet_v3.py
Новая модель: frontend/public/models/rsl/alphabet-cautious-classifier.json
Отчёт: frontend/public/models/rsl/alphabet-cautious-report.json
Обычный режим сохранён в alphabet-classifier.json.

Новая небольшая нейросеть получает координаты от готовой Google MediaPipe.
Мы обучили классификатор, а не MediaPipe. 16 кадров, 474 признака,
96 ReLU-нейронов, 34 выхода: 33 буквы и «нет жеста». API-ключи не нужны.
Не распознаёт слова, свободные фразы, грамматику, лицо и корпус.
Не обучает движения аватара.

В архиве признаки 3 625 видео Bukva: 3 013 для обучения, 612 для теста.
Тестовые люди не пересекаются с обучающими. Для выбора параметров выделено
615 видео других людей внутри обучающей части; после выбора обучение
повторено на всех 3 013 обучающих примерах. Тест тот же, что у старой модели.
manifest.json — новая выборка; baseline-manifest.json — прежняя выборка.

Общая точность новой модели: 75,33% (старой: 76,47%). Рост не подтверждён.
Новая модель выдала 233 ответа из 612; все 233 верны на этой выборке.
Это НЕ гарантия 100% точности на камере. Она чаще отказывается, поэтому
доступна как дополнительный осторожный режим, а прежняя остаётся основной.
Порог 0,70, отрыв 0,20, рука видна минимум в 8/16 кадров.

Повторить новое обучение из корня архива:
python3.11 -m venv ml/rsl/.venv
ml/rsl/.venv/bin/pip install -r ml/rsl/requirements-lock.txt
ml/rsl/.venv/bin/python ml/rsl/train_alphabet_v3.py

Чтобы заново извлечь признаки, скачайте видео:
ml/rsl/.venv/bin/python ml/rsl/prepare_alphabet.py --train-per-class 90
Затем сохраните старую features-v1 отдельно и запустите extract_alphabet.py.
Сами исходные 3 625 видео в архив не включены. Включены 33 видеообразца.
Для воспроизведения старого обучения замените manifest.json копией
baseline-manifest.json и запустите train_alphabet.py; восстановите новый
manifest.json перед новым обучением.

Лицензии и атрибуция: frontend/public/research/rsl/ATTRIBUTION.txt
и bukva-license.pdf. MediaPipe: https://github.com/google-ai-edge/mediapipe
CHECKSUMS.json содержит SHA-256 каждого включённого файла проекта.
"""
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
