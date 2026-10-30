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
# Keep ambiguities explicit; the client will not silently choose one meaning.
(dest/'forms.json').write_text(json.dumps({f:sorted(ids) for f,ids in forms.items()},ensure_ascii=False))
print(len(entries),'entries',len(forms),'forms')

notice='Russian inflection lookup: pymorphy3 (MIT), OpenCorpora morphological dictionaries (CC BY-SA 3.0). https://github.com/no-plagiarism/pymorphy3 https://opencorpora.org/\n'
credits=dest/'ATTRIBUTION.txt'
existing=credits.read_text() if credits.exists() else ''
if notice.strip() not in existing:credits.write_text(existing+'\n'+notice)
