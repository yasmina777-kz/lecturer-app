# Situational practice and cautious alphabet model — 2026-11-01

The learning page and sidebar now lead to `/dialogues` and `/understanding`.
Three guided situations cover meeting someone, a class and shopping. Shopping
branches according to the chosen purchase. Incorrect replies explain the mismatch;
retries do not overwrite the first-attempt result. Individual source videos and an
optional experimental avatar are available; neither represents automatic grammatical
RSL translation of a free conversation.

Comprehension uses the existing 170 Slovo reference videos across eight topics.
Each session offers up to eight videos without a label/poster, four unique same-topic
choices, replay, speed, an optional topic hint and an explicit “I don't know” option.
Mistakes and assisted responses enter a per-account browser-local review queue.
An unassisted correct response clears that word. Video load failures cannot be graded.
These exercise rules are not misrepresented as trained AI.

The additional classifier was actually trained on 3,013 Bukva videos and evaluated
on the unchanged 612-video test. Overall accuracy did not improve. The baseline is
therefore still default; the new model is an opt-in cautious mode with lower answer
coverage. See `/research/rsl/alphabet-comparison.html` for all metrics and limitations.

Validation:
- Production TypeScript/Vite build passes (existing large-chunk warning remains).
- `test:sign-activities`: scenario reachability, three-turn paths, branch targets,
  real media labels, unique same-topic quiz choices, review/assistance/recovery.
- `test:sign-expansion`: 34-class cautious Python/JS parity within 1e-7, baseline
  parity, empty/no-hand rejection and existing dictionary/media checks.
- `test:rsl`: original small-model parity and rejection checks remain passing.
- Browser: wrong shopping answer → retry → water branch → two bottles → decline
  help → correct 2/3 first-answer score.
- Browser: “I don't know” → review queue → correct unassisted repeat → 1/1 result
  → review queue cleared after reload.
- Optional avatar opens a loaded playable clip in the meeting scenario.
- Standard/cautious selector changes model report. Two actual local-video inference
  checks for the cautious model are stored in `cautious-browser-checks.json`.
- Dark desktop and cream mobile layouts checked at 930px and 390px; viewport and
  original dark theme restored. Personal webcam was not accessed.

Training archive: `AI-Mentor-training.zip`, 3,625 cached feature sequences, both
models, training scripts, reports, baseline/expanded manifests, reference examples,
licenses and per-file checksums. Raw full dataset videos are not included.
