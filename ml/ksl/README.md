# Kazakh fingerspelling (ksl-v1)

42 letters: 33 shared with Russian fingerspelling + Ә Ғ Қ Ң Ө Ұ Ү Һ І.
UI: `/kazakh` (`frontend/src/pages/KazakhSign.tsx`). Report and honest
limits: `docs/kazakh-sign-language.md`, `docs/ksl-v1-report.json`.

```sh
# QazSL (CC BY 4.0) → ml/rsl/data/qazsl/raw (git-ignored)
curl -L -o ml/rsl/data/qazsl/ksl_dataset_png.zip https://zenodo.org/api/records/22830162/files/ksl_dataset_png.zip/content
unzip -q ml/rsl/data/qazsl/ksl_dataset_png.zip -d ml/rsl/data/qazsl/raw
ml/rsl/.venv/bin/python ml/ksl/build_data.py          # needs Bukva features-v5 (ml/rsl)
ml/rsl/.venv/bin/python ml/ksl/train_ksl.py probe     # optional: silhouette style check
ml/rsl/.venv/bin/yt-dlp -a ml/rsl/data/sausaq/urls.txt -f 'bv*[height<=480][ext=mp4]' -o 'ml/rsl/data/sausaq/raw/%(id)s.%(ext)s'  # local only, ml/ksl/sausaq-ids.tsv maps id→letter (copy to ml/rsl/data/sausaq/ids.tsv)
ml/rsl/.venv/bin/python ml/ksl/extract_sausaq.py        # ✓-marked still frames → landmarks
ml/rsl/.venv/bin/python ml/ksl/train_ksl.py sausaq 8 1.0 4 final   # 4 transfer folds + ksl-v2
node ml/ksl/check_parity.mjs                          # browser twin must match Python
```

QazSL is binary silhouettes, not video, so landmarks are drawn as silhouettes
(`silhouette.py` ↔ `frontend/src/sign/kslSilhouette.ts`). Letters seen only as
QazSL silhouettes transfer poorly to camera silhouettes (≈11 % top-1, v1).
v2 adds hand landmarks of one teacher from the «Саусақтар сөйлейді» YouTube
lessons (8 of 9 Kazakh letters): transfer to unseen signers 36 % top-1.
Videos are standard-licence and stay local; the site embeds the YouTube player.
The trainer's «Записать пример» exports hand world landmarks for more signers.
