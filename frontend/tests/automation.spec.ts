import {test,expect,request as requests,type APIRequestContext} from '@playwright/test';
test.beforeEach(async({page})=>{await page.emulateMedia({reducedMotion:'reduce'});});
const password='Automation-Test-123';
async function loginAdmin(baseURL?:string){const api=await requests.newContext({baseURL});expect((await api.post('/api/auth/login',{data:{email:'admin@test.local',password:'Test-Only-Password-123'}})).status()).toBe(200);return api;}
async function account(api:APIRequestContext,admin:APIRequestContext,name:string,teacher=false){const email=`automation-${Date.now()}-${Math.random().toString(36).slice(2)}@test.local`;const res=await api.post('/api/auth/register',{data:{email,password,fullName:name}});expect(res.status()).toBe(200);const u=await res.json();if(teacher){await admin.patch(`/api/admin/users/${u.id}`,{data:{role:'Lecturer',isDisabled:false}});await api.post('/api/auth/login',{data:{email,password}});}return {...u,email};}

test('course automation: multi-file plan, partial recovery, private assignment, mistakes, reports, publication and role boundaries',async({page,baseURL})=>{
 const admin=await loginAdmin(baseURL);const teacher=await requests.newContext({baseURL});const other=await requests.newContext({baseURL});const student=await requests.newContext({baseURL});
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 try {
  const u=await account(teacher,admin,'Преподаватель автоматизации',true);await account(other,admin,'Другой преподаватель',true);const learner=await account(student,admin,'Студент автоматизации');
  expect((await student.get('/api/reports/weekly')).status()).toBe(403);expect((await student.get('/api/admin/automation')).status()).toBe(403);expect((await teacher.put('/api/admin/automation',{data:{monthlyTokens:0,monthlyRequests:0,monthlySpeechCharacters:0}})).status()).toBe(403);
  expect((await student.post('/api/courses',{multipart:{Goal:'Нельзя создавать',ModuleCount:'2'}})).status()).toBe(403);
  await page.request.post('/api/auth/login',{data:{email:u.email,password}});await page.goto('/courses');
  await page.getByRole('button',{name:'Создать курс',exact:true}).click();await page.getByLabel('Чему научить студента?').fill('RETRY_ONCE Понять как работает память');await page.getByLabel('Модулей', {exact:true}).fill('2');await page.getByLabel('Минут на модуль').selectOption('5');
  await page.getByLabel('Материалы курса').setInputFiles([{name:'memory.txt',mimeType:'text/plain',buffer:Buffer.from('Память позволяет сохранять и воспроизводить знания. Практика помогает закрепить материал и проверить понимание.')},{name:'practice.txt',mimeType:'text/plain',buffer:Buffer.from('При изучении темы полезно чередовать объяснение, самостоятельное воспроизведение и повторную проверку знаний.')}]);
  await page.getByRole('button',{name:'Составить программу с AI'}).click();await expect(page.getByRole('button',{name:'Создать все лекции'})).toBeVisible();const cid=new URL(page.url()).searchParams.get('course')!;
  expect((await other.get(`/api/courses/${cid}`)).status()).toBe(404);expect((await student.get(`/api/courses/${cid}`)).status()).toBe(404);
  const before=await(await teacher.get(`/api/courses/${cid}`)).json();expect(before.modules).toHaveLength(2);expect(before.sourceNames).toContain('practice.txt');expect(before.modules[0].dueAt<before.modules[1].dueAt).toBe(true);
  await page.getByRole('button',{name:'Создать все лекции'}).click();await expect(page.getByRole('button',{name:'Создать все лекции'})).toBeEnabled();
  let course=await(await teacher.get(`/api/courses/${cid}`)).json();expect(course.modules[0].lectureId).toBeTruthy();expect(course.modules[1].lectureId).toBeNull();expect(course.modules[1].error).toBeTruthy();const first=course.modules[0].lectureId;
  await page.getByRole('button',{name:'Создать все лекции'}).click();await expect(page.getByRole('link',{name:'Открыть лекцию'})).toHaveCount(2);course=await(await teacher.get(`/api/courses/${cid}`)).json();expect(course.modules[0].lectureId).toBe(first);expect(course.modules[0].quality.find((c:any)=>c.code==='source_quotes').status).toBe('pass');expect(course.modules[0].quality.find((c:any)=>c.code==='source_alignment').status).toBe('pass');
  const usageBefore=await(await admin.get('/api/admin/usage')).json();await teacher.post(`/api/courses/${cid}/modules/${course.modules[0].id}/generate`);expect((await(await admin.get('/api/admin/usage')).json()).total).toBe(usageBefore.total);
  expect((await teacher.post(`/api/courses/${cid}/publish`,{data:{reviewed:false}})).status()).toBe(409);expect((await student.post(`/api/courses/${cid}/publish`,{data:{reviewed:true}})).status()).toBe(403);
  const gid=(await(await teacher.post('/api/groups',{data:{name:'Группа курса'}})).json()).id;const group=await(await teacher.get(`/api/groups/${gid}`)).json();await student.post('/api/groups/join',{data:{code:group.joinCode}});
  expect((await teacher.post(`/api/courses/${cid}/assign`,{data:{groupId:gid,reviewed:true}})).status()).toBe(204);const studentCourse=await(await student.get(`/api/courses/${cid}`)).json();expect(studentCourse.sourceNames).toBeNull();expect(studentCourse.modules[0].quality).toBeNull();expect(studentCourse.canManage).toBe(false);
  const assigned=await(await teacher.get(`/api/groups/${gid}`)).json();expect(assigned.assignments).toHaveLength(2);expect(assigned.assignments.find((a:any)=>a.lectureId===first).dueAt).toBe(course.modules[0].dueAt);
  const quiz=await student.post(`/api/lectures/${first}/quiz`,{data:{answers:[0]}});expect(quiz.status()).toBe(200);expect((await quiz.json()).score).toBe(0);
  const report=await(await teacher.get('/api/reports/weekly')).json();expect(report.groups.find((g:any)=>g.id===gid).topics.find((t:any)=>t.lectureId===first)).toMatchObject({averageScore:0,needsReview:1,tested:1});expect((await(await other.get('/api/reports/weekly')).json()).groups).toHaveLength(0);
  await student.put(`/api/lectures/${first}/progress`,{data:{slideIndex:0,completed:false,notes:'PRIVATE-STUDENT-NOTE'}});expect(JSON.stringify(report)).not.toContain('PRIVATE-STUDENT-NOTE');
  const remediate=await student.post(`/api/lectures/${first}/remediation/0`);expect(remediate.status(),await remediate.text()).toBe(200);const review=await remediate.json();expect(review.generated).toBe(true);expect(review.correctIndex).toBeUndefined();expect((await teacher.post(`/api/lectures/${first}/remediation/${review.id}/answer`,{data:{answer:0}})).status()).toBe(404);
  expect((await(await student.post(`/api/lectures/${first}/remediation/${review.id}/answer`,{data:{answer:1}})).json()).correct).toBe(false);expect((await(await student.post(`/api/lectures/${first}/remediation/${review.id}/answer`,{data:{answer:0}})).json()).correct).toBe(true);
  expect((await(await student.get(`/api/lectures/${first}`)).json()).progress.quizScore).toBe(0);expect((await(await student.get(`/api/lectures/${first}/remediation`)).json())[0].resolvedAt).toBeTruthy();
  await page.screenshot({path:'test-results/courses-desktop.png',fullPage:true});await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'test-results/courses-mobile.png',fullPage:true});
  await page.goto('/reports');await expect(page.getByRole('heading',{name:'Недельный отчёт',exact:true})).toBeVisible();await expect(page.getByRole('img',{name:'Число попыток тестов по дням недели'})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'test-results/report-mobile.png',fullPage:true});
  await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:'test-results/report-desktop.png',fullPage:true});
  for(const [lang,title] of [['EN','Weekly report'],['KZ','Апталық есеп'],['RU','Недельный отчёт']]){await page.locator('header').getByRole('button',{name:lang,exact:true}).click();await expect(page.getByRole('heading',{name:title,exact:true})).toBeVisible();}
  await page.request.post('/api/auth/login',{data:{email:learner.email,password}});await page.goto(`/lectures/${first}`);await page.getByRole('button',{name:'Практика',exact:true}).click();await expect(page.getByRole('heading',{name:'Работа над ошибками'})).toBeVisible();await expect(page.getByText('Ошибка разобрана',{exact:false})).toBeVisible();await page.getByRole('button',{name:'Вернуться к слайду 1'}).click();await expect(page.locator('.slide-viewer')).toBeVisible();
  await page.getByRole('button',{name:'Практика',exact:true}).click();await page.locator('.quiz-question input').first().check();await page.getByRole('button',{name:'Проверить ответы',exact:true}).click();await expect(page.locator('.remediation-card')).toHaveCount(1);await expect(page.locator('.remediation-card').getByRole('button',{name:'Проверить себя'})).toBeVisible();
  await teacher.delete(`/api/groups/${gid}/members/${learner.id}`);expect((await student.get(`/api/courses/${cid}`)).status()).toBe(404);expect((await student.get(`/api/lectures/${first}/remediation`)).status()).toBe(404);
  expect((await teacher.post(`/api/courses/${cid}/publish`,{data:{reviewed:true}})).status()).toBe(204);expect((await student.get(`/api/courses/${cid}`)).status()).toBe(200);expect((await student.get(`/api/lectures/${first}`)).status()).toBe(200);
  expect(errors).toEqual([]);
 } finally {await Promise.all([admin.dispose(),teacher.dispose(),student.dispose(),other.dispose()]);}
});

test('admin budget blocks AI, counts failures and enforces concurrent reservations',async({page,baseURL})=>{
 const admin=await loginAdmin(baseURL);
 try{
  await page.request.post('/api/auth/login',{data:{email:'admin@test.local',password:'Test-Only-Password-123'}});
  const current=await(await admin.get('/api/admin/automation')).json();
  expect((await admin.put('/api/admin/automation',{data:{monthlyTokens:0,monthlyRequests:2000,monthlySpeechCharacters:500000}})).status()).toBe(204);
  expect((await admin.post('/api/lectures',{multipart:{topic:'Budget blocked',level:'Начальный',durationMinutes:'5'}})).status()).toBe(429);
  const before=await(await admin.get('/api/admin/automation')).json();expect(before.usage.tokens).toBe(current.usage.tokens);expect(before.usage.requests).toBe(current.usage.requests);
  await admin.put('/api/admin/automation',{data:{monthlyTokens:1000000,monthlyRequests:before.usage.requests+1,monthlySpeechCharacters:500000}});
  const calls=await Promise.all([1,2].map(i=>admin.post('/api/lectures',{multipart:{topic:`Race ${i}`,level:'Начальный',durationMinutes:'5'}})));expect(calls.every(r=>r.status()===429)).toBe(true);const after=await(await admin.get('/api/admin/automation')).json();expect(after.usage.requests).toBe(before.usage.requests+1);
  await admin.put('/api/admin/automation',{data:{monthlyTokens:1000000,monthlyRequests:2000,monthlySpeechCharacters:500000}});
  await page.goto('/admin');await page.getByRole('button',{name:'Автоматизация',exact:true}).click();await expect(page.getByRole('heading',{name:'Лимиты и контроль расходов'})).toBeVisible();await page.getByLabel('Запросов в месяц').fill('1800');await page.getByRole('button',{name:'Сохранить лимиты'}).click();await expect(page.getByRole('button',{name:'Сохранено',exact:true})).toBeVisible();expect((await(await admin.get('/api/admin/automation')).json()).settings.monthlyRequests).toBe(1800);
  await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'test-results/automation-admin-mobile.png',fullPage:true});
 }finally{await admin.put('/api/admin/automation',{data:{monthlyTokens:1000000,monthlyRequests:2000,monthlySpeechCharacters:500000}});await admin.dispose();}
});

test('offline remediation uses stored explanations without claiming AI generation',async({page,baseURL})=>{
 test.skip(process.env.TEST_WITHOUT_AI!=='1','Run with TEST_WITHOUT_AI=1');
 const admin=await loginAdmin(baseURL);
 try {
  await account(page.request,admin,'Студент без AI');
  const lectures=await(await page.request.get('/api/lectures')).json();const id=lectures[0].id;
  const l=await(await page.request.get(`/api/lectures/${id}`)).json();const quiz=JSON.parse(l.exercisesJson).quiz;
  await page.request.post(`/api/lectures/${id}/quiz`,{data:{answers:quiz.map((q:any)=>(q.correctIndex+1)%4)}});
  const r=await page.request.post(`/api/lectures/${id}/remediation/0`);expect(r.status(),await r.text()).toBe(200);const review=await r.json();expect(review.generated).toBe(false);expect(review.question).toBe(quiz[0].question);expect(review.explanation).toBe(quiz[0].explanation);
  expect((await(await admin.get('/api/admin/usage')).json()).total).toBe(0);
  await page.goto(`/lectures/${id}`);await page.getByRole('button',{name:'Практика',exact:true}).click();await expect(page.getByText('Повторение исходного вопроса · без AI')).toBeVisible();
 } finally {await admin.dispose();}
});
