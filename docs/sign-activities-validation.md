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

## Guided dialogue refinement

Each turn now has explicit Watch → Reply → Feedback steps. The prompt remains
visible, vocabulary video playback has a labelled button, and users can skip
familiar vocabulary. Returning to videos preserves a selected reply. The result
shows the original mistaken reply and its explanation rather than only a score.
No free-sign recognition or new model training is implied by these UI changes.

Verified in the browser: launch video, return to video with a selected reply,
wrong reply and retry, water shopping branch, keyboard Space/Enter selection,
three-turn completion with 2/3 first-attempt score and first-error explanation.
Dark desktop and cream 320px mobile answer layouts checked; theme and viewport
restored. Production build and sign-activity logic checks passed.

## Card motion and visual refinement

The learning header now includes a small layered-card illustration. Course,
exercise, dictionary and activity cards reveal once on entering the viewport;
hover depth is limited to fine pointers, and touch receives a short press response.
Dialogue phase/result panels use the same entrance motion. The observer handles
lazy-rendered content and disconnects when routes change; removed cards are
unobserved. Content is visible without the observer or Web Animations support.
Reduced-motion preferences bypass JS entrances, cancel active animations when
changed and disable decorative CSS motion. No gesture, score or model logic changed.

Production build, TypeScript and existing activity checks passed. Visually checked
dark desktop and cream 390px mobile cards, completed reveal states and navigation
from the dialogue watch step to the answer step. Original viewport/theme restored.

## Task cards for text, phrases and camera practice (2026-11-01)

Replaced the dictionary's flat tab/form stack with illustrated action cards for
custom text, ready phrases and dictionary search. Ready phrases have their own
URL (`?tab=phrases`) and selectable tiles; the avatar result appears after a
selection. Existing dictionary/grammar URLs and text prefills remain supported.
Letter practice separates the avatar and camera into two explicit choices. The
camera starts only on user action, with three concise preparation steps; model
settings remain available in a disclosure below the main action. Camera sessions
unmount on return to the avatar, retaining their existing cleanup behavior.

Card entrances use the existing workspace observer. Selection, hover and a finite
camera illustration animation respect reduced-motion preferences. The illustration
is labeled camera-off and does not pretend to be live tracking. No trained model,
inference pipeline, motion asset or gesture semantics changed.

Validation: production build, sign-expansion and sign-activities checks passed.
Browser checks covered phrase playback, keyboard text submission, dictionary
search and playback, switching between avatar/camera, model selection and direct
`#sign-camera-check` navigation. Dark desktop and cream 390px cards were inspected;
320px text/player page had equal viewport and document widths (no horizontal
overflow). No browser console errors observed. Theme and viewport restored.
Live camera capture was not started for this interface-only verification.
