import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
const source = await readFile(
  new URL("../src/sign/textPlan.ts", import.meta.url),
  "utf8",
);
const js = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2020,
  },
}).outputText;
const { planText } = await import(
  "data:text/javascript;base64," + Buffer.from(js).toString("base64")
);
for (const text of [
  "Как тебя зовут?",
  "  КАК   ТЕБЯ\nЗОВУТ!  ",
  "как тебя зовут",
  "Как тебя зовут...",
]) {
  assert.deepEqual(planText(text), {
    ok: true,
    phrase: "Как тебя зовут?",
    animation: "name-demo",
  });
}
for (const text of [
  "Привет",
  "Как тебя зовут? Меня зовут Амина.",
  "не показывай как тебя зовут",
  "Как вас зовут?",
  "What is your name?",
  "<script>Как тебя зовут?</script>",
]) {
  assert.deepEqual(
    planText(text),
    { ok: false, reason: "unsupported" },
    `Must not silently translate: ${text}`,
  );
}
assert.deepEqual(planText("  \n "), { ok: false, reason: "empty" });
assert.deepEqual(planText("а".repeat(501)), { ok: false, reason: "too-long" });
console.log(
  "12 prepared-phrase checks passed: matching, normalization, empty, length and unsupported text.",
);
const { preparedSigns } = await import(
  "data:text/javascript;base64," + Buffer.from(js).toString("base64")
);
for (const sign of preparedSigns) {
  assert.deepEqual(
    planText("  " + sign.phrase.toLocaleLowerCase("ru") + "! "),
    { ok: true, phrase: sign.phrase, animation: sign.animation },
  );
}
for (const text of [
  "Спасибо, здравствуйте",
  "Б",
  "A",
  "Расскажи спасибо",
  "А В",
]) {
  assert.equal(
    planText(text).ok,
    false,
    `Do not substitute unsupported text: ${text}`,
  );
}
const playbackSource = await readFile(
  new URL("../src/sign/playback.ts", import.meta.url),
  "utf8",
);
const playbackJs = ts.transpileModule(playbackSource, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2020,
  },
}).outputText;
const { animationTime, playbackDuration } = await import(
  "data:text/javascript;base64," + Buffer.from(playbackJs).toString("base64")
);
for (const letter of [true, false]) {
  const duration = playbackDuration(letter);
  assert.equal(animationTime(0, letter), 0);
  assert.equal(animationTime(duration, letter), 8);
  assert.equal(animationTime(-1, letter), 0);
  assert.equal(animationTime(duration + 1, letter), 8);
  let previous = 0;
  for (let t = 0; t <= duration; t += 0.01) {
    const now = animationTime(t, letter);
    assert.ok(Number.isFinite(now) && now >= previous && now <= 8);
    assert.ok(
      now - previous < 0.03,
      "No jump between adjacent playback frames",
    );
    previous = now;
  }
}
console.log(
  "Expanded vocabulary, unsupported combinations and continuous playback timing passed.",
);
