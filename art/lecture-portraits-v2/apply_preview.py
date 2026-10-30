from pathlib import Path
import json
ROOT=Path(__file__).resolve().parent
PROJECT=ROOT.parents[1]
assert json.loads((ROOT/'media-validation.json').read_text())['maleUnchanged']
p=PROJECT/'frontend/src/components/LectureAvatarDemo.tsx'
s=p.read_text()
s=s.replace('{ id: "female", name:', '{ id: "female", video: "female-kim-v2.mp4", name:')
s=s.replace('{ id: "male", name:', '{ id: "male", video: "male-demo.mp4", name:')
s=s.replace('${avatar.id}-demo.mp4','${avatar.video}')
s=s.replace('<p>{at("Пример озвучки на русском", "Russian voice sample", "Орыс тіліндегі дауыс үлгісі")}</p>', '<p>{avatar.id === "female" ? at("Ваша запись «ким» · 45 секунд", "Your Kim recording · 45 seconds", "Сіздің «ким» жазбаңыз · 45 секунд") : at("Пример озвучки на русском", "Russian voice sample", "Орыс тіліндегі дауыс үлгісі")}</p>')
p.write_text(s)
p=PROJECT/'frontend/public/avatars/lecture-demo/index.html';s=p.read_text()
s=s.replace('src="female-demo.mp4"','src="female-kim-v2.mp4"')
s=s.replace('Женский голос · русский язык','Ваша запись «ким» · 45 секунд')
s=s.replace('<div class="eyebrow">Текст демонстрации</div>','<div class="eyebrow">Что звучит в примерах</div><p>Преподавательница произносит вашу запись «ким» полностью. Мужской пример остался прежним.</p><div class="eyebrow">Текст мужского примера</div>')
s=s.replace('Предпросмотр аватаров · RU','Предпросмотр аватаров')
p.write_text(s)
print('Preview now uses the Kim recording')
