"""Precompute Russian dictionary forms; this is morphology, not RSL grammar."""
from pathlib import Path
import json,pymorphy3
ROOT=Path(__file__).resolve().parents[2];dest=ROOT/'frontend/public/research/rsl/words';entries=json.loads((dest/'catalog.json').read_text());morph=pymorphy3.MorphAnalyzer();forms={}
for e in entries:
 word=e['label'].lower()
 if ' ' in word or '?' in word:continue
 parsed=morph.parse(word)[0]
 for form in parsed.lexeme:
  forms.setdefault(form.word,set()).add(e['id'])
# Ambiguities stay explicit (the client will not silently choose a meaning),
# except two principled cases: the form IS a dictionary headword («мой» → МОЙ,
# not the imperative of «мыть»), or one reading is at least twice as probable
# as every other candidate by pymorphy's frequency scores («моя» → МОЙ).
label = {e['id']: e['label'].lower().rstrip('!?') for e in entries}
for form, ids in forms.items():
 if len(ids) < 2: continue
 exact = [i for i in ids if label[i] == form]
 if len(exact) == 1:
  forms[form] = {exact[0]}; continue
 score = {}
 for p in morph.parse(form):
  score[p.normal_form] = score.get(p.normal_form, 0) + p.score
 ranked = sorted(((score.get(label[i], 0), i) for i in ids), reverse=True)
 if ranked[0][0] > 0 and ranked[0][0] >= 2 * ranked[1][0]:
  forms[form] = {ranked[0][1]}
# Everyday words whose sign is a headword under another name (same sign in RSL):
# «мама» is signed МАТЬ, «спасибо» is БЛАГОДАРНОСТЬ. Only fills forms that have
# no sign of their own.
SYNONYMS={'мама':'мать','папа':'отец','спасибо':'благодарность','благодарю':'благодарность'}
by_label={e['label'].lower().rstrip('!?'):e['id'] for e in entries}
for word,target in SYNONYMS.items():
 if target not in by_label:continue
 for form in {f.word for f in morph.parse(word)[0].lexeme}|{word}:
  if form not in forms:forms[form]={by_label[target]}
(dest/'forms.json').write_text(json.dumps({f:sorted(ids) for f,ids in forms.items()},ensure_ascii=False))
print(len(entries),'entries',len(forms),'forms')

notice='Russian inflection lookup: pymorphy3 (MIT), OpenCorpora morphological dictionaries (CC BY-SA 3.0). https://github.com/no-plagiarism/pymorphy3 https://opencorpora.org/\n'
credits=dest/'ATTRIBUTION.txt'
existing=credits.read_text() if credits.exists() else ''
if notice.strip() not in existing:credits.write_text(existing+'\n'+notice)
