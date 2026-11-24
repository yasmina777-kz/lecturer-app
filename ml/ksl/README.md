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
ml/rsl/.venv/bin/python ml/ksl/train_ksl.py final 8 1.0   # 4 transfer folds + final model, DANN weight 1.0
node ml/ksl/check_parity.mjs                          # browser twin must match Python
```

QazSL is binary silhouettes, not video, so landmarks are drawn as silhouettes
(`silhouette.py` ↔ `frontend/src/sign/kslSilhouette.ts`). Letters seen only as
QazSL silhouettes transfer poorly to camera silhouettes (≈11 % top-1); camera
recordings of the 9 Kazakh letters are needed. The trainer's «Записать пример»
exports hand world landmarks as JSON for that.
