import { test, expect, type Page } from "@playwright/test";
test.beforeEach(async ({ page }) => { page.on("pageerror", e => console.log("PAGE ERROR", e.message)); });
const id = "playback-fixture";
const user = { id:"student",fullName:"Тест",email:"test@example.test",role:"Student",interfaceLanguage:"ru",teachingLanguage:"ru",avatarId:"classic-male",voiceGender:"male",avatarStyle:"sage",speechRate:1 };
const lecture = { id,title:"Проверка озвучки",description:"Тест",subject:"Обучение",level:"Начальный",isDemo:true,isPublished:true,ownerId:null,createdAt:new Date().toISOString(),language:"ru",avatarId:"classic-female",voiceGender:"female",avatarStyle:"sage",targetMinutes:5,estimatedMinutes:5,introduction:"Первое предложение. Второе предложение.",summary:"Конспект",exercisesJson:'{"quiz":[],"tasks":[]}',sourceName:"",progress:null,questions:[],slides:[{id:"s1",orderIndex:0,narrationText:"Текст первого слайда.",contentJson:'{"title":"Первый слайд","bullets":["Пример"]}'},{id:"s2",orderIndex:1,narrationText:"Текст второго слайда.",contentJson:'{"title":"Второй слайд","bullets":["Пример"]}'}] };
async function api(page: Page, signedIn = true, provider = "browser") {
  await page.route(url => url.pathname.startsWith("/api/"), async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/auth/me") return route.fulfill({ status: signedIn ? 200 : 401, json: signedIn ? user : {} });
    if (path === `/api/lectures/${id}`) return route.fulfill({ json: lecture });
    if (path === "/api/capabilities") return route.fulfill({ json: { aiConfigured: true, speech: provider, uploadFormats: [] } });
    if (path === "/api/lectures") return route.fulfill({ json: [] });
    if (path === "/api/speech") return route.fulfill({ contentType: "audio/mpeg", body: "mock audio" });
    if (path === "/api/questions/ask") return route.fulfill({ json: { questionText:"Почему?",answerText:"Вот объяснение." } });
    return route.fulfill({ status: 204 });
  });
}
async function browserSpeech(page: Page) {
  await page.addInitScript(() => {
    const w = window as any;
    w.speechTest = { calls: [], current: null, lastCancel: -1000, resumes: 0 };
    w.SpeechSynthesisUtterance = class { constructor(public text: string) {} };
    Object.defineProperty(w, "speechSynthesis", { value: {
      paused: false,
      getVoices: () => [{ name: "Milena", lang: "ru-RU" }],
      cancel() { w.speechTest.lastCancel = performance.now(); this.paused = true; },
      resume() { this.paused = false; w.speechTest.resumes++; },
      speak(u: any) {
        // Reproduce engines that drop commands while cancelling / still paused.
        if (this.paused || performance.now() - w.speechTest.lastCancel < 60) return;
        w.speechTest.current = u; w.speechTest.calls.push(u.text);
      },
    } });
  });
}
const avatar = (page: Page) => page.locator(".avatar-stage .avatar-scene");
async function calls(page: Page, n: number) { await expect.poll(() => page.evaluate(() => (window as any).speechTest.calls.length)).toBe(n); }

test("browser repeated pause/resume waits for sound and ignores old callbacks", async ({page}) => {
  await api(page); await browserSpeech(page); await page.goto(`/lectures/${id}`);
  await page.getByRole("button", {name:"Начать лекцию",exact:true}).click();
  await calls(page,1); await expect(avatar(page)).not.toHaveClass(/speaking/);
  await page.evaluate(() => (window as any).speechTest.current.onstart());
  await expect(avatar(page)).toHaveClass(/speaking/);
  for (let i=0;i<3;i++) {
    await page.evaluate(() => { (window as any).oldSpeech = (window as any).speechTest.current; });
    await page.getByRole("button",{name:"Пауза",exact:true}).click();
    await expect(avatar(page)).not.toHaveClass(/speaking/);
    await page.getByRole("button",{name:"Продолжить",exact:true}).click();
    await calls(page,i+2);
    await page.evaluate(() => { (window as any).oldSpeech.onstart(); (window as any).oldSpeech.onend(); });
    await expect(avatar(page)).not.toHaveClass(/speaking/);
    expect(await page.evaluate(() => (window as any).speechTest.current.text)).toBe("Первое предложение. ");
    await page.evaluate(() => (window as any).speechTest.current.onstart());
    await expect(avatar(page)).toHaveClass(/speaking/);
  }
  await page.evaluate(() => (window as any).speechTest.current.onerror({error:"interrupted"}));
  await expect(avatar(page)).not.toHaveClass(/speaking/);
  await expect(page.getByText(/Не удалось воспроизвести голос/)).toBeVisible();
  await expect(page.getByRole("button",{name:"Продолжить",exact:true})).toBeVisible();
});

test("silent engine offers retry and pending start can be paused", async ({page}) => {
  await api(page); await browserSpeech(page); await page.clock.install(); await page.goto(`/lectures/${id}`);
  await page.getByRole("button",{name:"Начать лекцию",exact:true}).click();
  await page.getByRole("button",{name:"Пауза",exact:true}).click();
  await page.clock.fastForward(9000);
  expect(await page.evaluate(() => (window as any).speechTest.calls.length)).toBe(0);
  await page.getByRole("button",{name:"Продолжить",exact:true}).click();
  await page.clock.fastForward(100); await expect(avatar(page)).not.toHaveClass(/speaking/);
  await page.clock.fastForward(8100);
  await expect(page.getByText(/Не удалось воспроизвести голос/)).toBeVisible();
  await expect(page.getByRole("button",{name:"Продолжить",exact:true})).toBeVisible();
});

test("Azure animation follows actual audio events across pause and replay", async ({page}) => {
  await api(page,true,"azure");
  await page.addInitScript(() => {
    const w=window as any; w.audioTest={players:[]};
    w.Audio=class {
      onplaying?:()=>void; onpause?:()=>void;
      constructor() { w.audioTest.players.push(this); }
      play() { return Promise.resolve(); }
      pause() { this.onpause?.(); }
      removeAttribute() {}
    };
  });
  await page.goto(`/lectures/${id}`); await page.getByRole("button",{name:"Начать лекцию",exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>(window as any).audioTest.players.length)).toBe(1);
  await expect(avatar(page)).not.toHaveClass(/speaking/);
  await page.evaluate(()=>(window as any).audioTest.players[0].onplaying());
  await expect(avatar(page)).toHaveClass(/speaking/);
  await page.getByRole("button",{name:"Пауза",exact:true}).click();
  await expect(avatar(page)).not.toHaveClass(/speaking/);
  await page.getByRole("button",{name:"Продолжить",exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>(window as any).audioTest.players.length)).toBe(2);
  await expect(avatar(page)).not.toHaveClass(/speaking/);
  await page.evaluate(()=>(window as any).audioTest.players[1].onplaying());
  await expect(avatar(page)).toHaveClass(/speaking/);
  await page.evaluate(()=>(window as any).audioTest.players[1].onwaiting());
  await expect(avatar(page)).not.toHaveClass(/speaking/);
});

test("light theme persists across routes/reload, languages and mobile", async ({page}) => {
  await api(page,false); await page.emulateMedia({reducedMotion:"reduce"}); await page.goto("/");
  await page.getByRole("button",{name:"Включить светлую тему"}).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme","light");
  await expect(page.locator(".mentor-site")).toHaveCSS("background-color","rgb(241, 241, 241)");
  await expect(page.locator(".mentor-site")).toHaveCSS("color","rgb(33, 38, 43)");
  await page.screenshot({path:"test-results/light-home-desktop.png",fullPage:true});
  await page.locator(".mentor-header").getByRole("link",{name:"Войти"}).click();
  await expect(page.getByRole("button",{name:"Включить тёмную тему"})).toBeVisible();
  await page.reload(); await expect(page.locator("html")).toHaveAttribute("data-theme","light");
  await page.getByRole("button",{name:"EN",exact:true}).click();
  await expect(page.getByRole("button",{name:"Switch to dark theme"})).toBeVisible();
  await page.getByRole("button",{name:"KZ",exact:true}).click();
  await expect(page.getByRole("button",{name:"Қараңғы тақырыпты қосу"})).toBeVisible();
  await page.getByRole("button",{name:"RU",exact:true}).click();
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:"test-results/light-auth-mobile.png",fullPage:true});
  await page.goto("/");
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:"test-results/light-home-mobile.png",fullPage:true});
  await page.getByRole("button",{name:"Включить тёмную тему"}).click();
  await expect(page.locator(".mentor-site")).toHaveCSS("background-color","rgb(33, 38, 43)");
});

test("light workspace sidebar and player fit small screens", async ({page}) => {
  await api(page); await page.emulateMedia({reducedMotion:"reduce"}); await page.goto(`/lectures/${id}`);
  await page.getByRole("button",{name:"Включить светлую тему"}).click();
  await expect(page.locator(".sidebar")).toHaveCSS("background-color","rgb(255, 255, 255)");
  await page.screenshot({path:"test-results/light-player-desktop.png",fullPage:true});
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await expect.poll(async () => {
    const box = await page.locator(".sidebar").boundingBox(); return !!box && box.x + box.width <= 0;
  }).toBe(true);
  await page.screenshot({path:"test-results/light-player-mobile.png",fullPage:true});
  await page.goto("/dashboard");
  await page.screenshot({path:"test-results/light-dashboard-mobile.png",fullPage:true});
});


test("question answer returns to paused slide, and navigation stops pending speech", async ({page}) => {
  await api(page); await browserSpeech(page); await page.goto(`/lectures/${id}`);
  await page.getByRole("button",{name:"Начать лекцию",exact:true}).click();
  await page.getByRole("button",{name:"Перейти к слайдам"}).click();
  await expect.poll(()=>page.evaluate(()=>(window as any).speechTest.current?.text)).toBe("Текст первого слайда.");
  await page.evaluate(()=>(window as any).speechTest.current.onstart());
  await page.getByRole("button",{name:"Задать вопрос",exact:true}).click();
  await page.getByLabel("Вопрос лектору").fill("Почему?");
  await page.getByRole("button",{name:"Отправить",exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>(window as any).speechTest.current?.text)).toBe("Вот объяснение.");
  await expect(avatar(page)).not.toHaveClass(/speaking/);
  await page.evaluate(()=>(window as any).speechTest.current.onstart());
  await expect(avatar(page)).toHaveClass(/speaking/);
  await page.evaluate(()=>(window as any).speechTest.current.onend());
  await expect.poll(()=>page.evaluate(()=>(window as any).speechTest.current?.text)).toBe("Текст первого слайда.");
  await page.getByRole("button",{name:"Пауза",exact:true}).click();
  await page.getByRole("button",{name:"Продолжить",exact:true}).click();
  await page.locator(".sidebar").getByRole("link",{name:"Мои лекции",exact:true}).click();
  const before = await page.evaluate(()=>(window as any).speechTest.calls.length);
  await expect(page.getByRole("heading",{name:"Мои лекции",exact:true})).toBeVisible();
  await page.clock.install(); await page.clock.fastForward(9000);
  expect(await page.evaluate(()=>(window as any).speechTest.calls.length)).toBe(before);
});

test("landing stays readable when reveal observation is unavailable", async ({page}) => {
  await api(page, false);
  await page.addInitScript(() => { delete (window as any).IntersectionObserver; });
  await page.goto("/");
  await page.getByRole("button", {name:"Включить светлую тему"}).click();
  for (const section of await page.locator("[data-reveal]").all()) {
    await expect(section).toHaveCSS("opacity", "1");
  }
  await page.locator("#possibilities").scrollIntoViewIfNeeded();
  await expect(page.locator(".mini-slide")).toBeVisible();
  await page.screenshot({path:"test-results/light-features.png"});
  await page.getByRole("button", {name:"Включить тёмную тему"}).click();
  await page.getByRole("button", {name:"Включить светлую тему"}).click();
  await page.getByRole("button", {name:"Остановить анимацию"}).click();
  await expect(page.locator(".mentor-site")).toHaveClass(/motion-paused/);
  await expect(page.locator(".mentor-portrait")).toHaveCSS("animation-play-state", "paused");
  await page.getByRole("button", {name:"Включить анимацию"}).click();
  await expect(page.locator(".mentor-portrait")).toHaveCSS("animation-play-state", "running");
});
