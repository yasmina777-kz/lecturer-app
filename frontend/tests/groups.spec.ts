import {test,expect,request as requests,type APIRequestContext} from '@playwright/test';
test('groups: teacher isolation, private assignments, student privacy, knowledge history and responsive UI',async({page,baseURL})=>{
 const password='Groups-Test-123';const unique=()=>`group-${Date.now()}-${Math.random().toString(36).slice(2)}@test.local`;
 const admin=await requests.newContext({baseURL});await admin.post('/api/auth/login',{data:{email:'admin@test.local',password:'Test-Only-Password-123'}});
 async function account(api:APIRequestContext,name:string,teacher=false){const email=unique();const r=await api.post('/api/auth/register',{data:{email,password,fullName:name}});expect(r.status()).toBe(200);const u=await r.json();if(teacher){expect((await admin.patch(`/api/admin/users/${u.id}`,{data:{role:'Lecturer',isDisabled:false}})).status()).toBe(204);await api.post('/api/auth/login',{data:{email,password}})}return {...u,email}}
 const teacher=await requests.newContext({baseURL});const other=await requests.newContext({baseURL});const outsider=await requests.newContext({baseURL});
 try{
 const teacherUser=await account(teacher,'Преподаватель группы',true);await account(other,'Другой преподаватель',true);await account(outsider,'Другой студент');const student=await account(page.request,'Студент группы');
 expect((await page.request.post('/api/groups',{data:{name:'Нельзя'}})).status()).toBe(403);
 const create=await teacher.post('/api/groups',{data:{name:'Биология · 10 А'}});expect(create.status()).toBe(200);const gid=(await create.json()).id;
 let detail=await(await teacher.get(`/api/groups/${gid}`)).json();const code=detail.joinCode;
 expect((await other.get(`/api/groups/${gid}`)).status()).toBe(404);
 expect((await other.post(`/api/groups/${gid}/code`)).status()).toBe(404);
 expect((await outsider.get(`/api/groups/${gid}`)).status()).toBe(404);
 const lectureResponse=await teacher.post('/api/lectures',{multipart:{topic:'Биология клетки',level:'Начальный',durationMinutes:'5'}});expect(lectureResponse.status(),await lectureResponse.text()).toBe(201);const lid=(await lectureResponse.json()).id;
 expect((await page.request.get(`/api/lectures/${lid}`)).status()).toBe(404);
 expect((await teacher.post(`/api/groups/${gid}/assignments`,{data:{lectureId:lid,dueAt:'2026-12-01T18:00:00Z'}})).status()).toBe(204);
 expect((await page.request.post('/api/groups/join',{data:{code}})).status()).toBe(200);
 expect((await page.request.post('/api/groups/join',{data:{code}})).status()).toBe(200);
 detail=await(await page.request.get(`/api/groups/${gid}`)).json();expect(detail.memberCount).toBe(1);expect(detail.members).toBeNull();expect(detail.joinCode).toBeNull();expect(detail.assignments[0].averageScore).toBeNull();
 expect((await page.request.post(`/api/groups/${gid}/assignments`,{data:{lectureId:lid}})).status()).toBe(403);
 expect((await page.request.get('/api/lectures')).status()).toBe(200);
 let lesson=await(await page.request.get(`/api/lectures/${lid}`)).json();expect(lesson.title).toBeTruthy();const quiz=JSON.parse(lesson.exercisesJson).quiz;const correct=quiz.map((q:any)=>q.correctIndex);
 expect((await page.request.post(`/api/lectures/${lid}/quiz`,{data:{answers:correct}})).status()).toBe(200);
 expect((await page.request.post(`/api/lectures/${lid}/quiz`,{data:{answers:correct.map((n:number)=>(n+1)%4)}})).status()).toBe(200);
 expect((await page.request.put(`/api/lectures/${lid}/progress`,{data:{slideIndex:lesson.slides.length-1,completed:true,notes:'PRIVATE NOTE'}})).status()).toBe(200);
 const question=await page.request.post('/api/questions/ask',{multipart:{lectureId:lid,slideId:lesson.slides[0].id,text:'Объясни подробнее'}});expect(question.status()).toBe(200);
 const knowledge=await(await page.request.get('/api/knowledge')).json();expect(knowledge.history.map((h:any)=>h.score)).toEqual([100,0]);expect(knowledge.topics.find((x:any)=>x.id===lid)).toMatchObject({score:0,completed:true});expect((await(await outsider.get('/api/knowledge')).json()).history).toHaveLength(0);
 detail=await(await teacher.get(`/api/groups/${gid}`)).json();expect(detail.assignments[0]).toMatchObject({completedCount:1,testedCount:1,averageScore:0});expect(JSON.stringify(detail)).not.toContain('PRIVATE NOTE');expect(detail.members[0].averageScore).toBe(0);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/knowledge');await expect(page.getByRole('heading',{name:'Карта знаний',exact:true})).toBeVisible();await expect(page.getByRole('img',{name:'Последние результаты тестов'})).toBeVisible();await expect(page.locator('.history-picks button')).toHaveCount(2);await page.locator('.history-picks button').first().click();await expect(page.locator('.history-caption')).toContainText('100%');
 await page.screenshot({path:'test-results/knowledge-desktop.png',fullPage:true});
 await page.goto('/groups');await expect(page.getByRole('heading',{name:'Биология · 10 А',exact:true})).toBeVisible();await expect(page.getByRole('heading',{name:'Прогресс участников'})).toHaveCount(0);
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'test-results/groups-student-mobile.png',fullPage:true});
 await page.request.post('/api/auth/login',{data:{email:teacherUser.email,password}});await page.goto('/groups');await expect(page.getByRole('heading',{name:'Кабинет преподавателя'})).toBeVisible();await expect(page.getByRole('heading',{name:'Прогресс участников'})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth), JSON.stringify(await page.evaluate(()=>Array.from(document.querySelectorAll('main *')).filter(e=>e.getBoundingClientRect().right>innerWidth+1).map(e=>({tag:e.tagName,cls:e.className,width:e.getBoundingClientRect().width}))))).toBe(true);await page.screenshot({path:'test-results/groups-teacher-mobile.png',fullPage:true});
 await page.setViewportSize({width:1440,height:1100});await page.screenshot({path:'test-results/groups-teacher-desktop.png',fullPage:true});
 for(const [language,heading] of [['EN','Teacher workspace'],['KZ','Оқытушы кабинеті'],['RU','Кабинет преподавателя']]){await page.locator('header').getByRole('button',{name:language,exact:true}).click();await expect(page.getByRole('heading',{name:heading,exact:true})).toBeVisible()}
 expect(errors).toEqual([]);
 await teacher.post(`/api/groups/${gid}/code`);expect((await outsider.post('/api/groups/join',{data:{code}})).status()).toBe(404);
 expect((await teacher.delete(`/api/groups/${gid}/assignments/${lid}`)).status()).toBe(204);
 await page.request.post('/api/auth/login',{data:{email:student.email,password}});expect((await page.request.get(`/api/lectures/${lid}`)).status()).toBe(404);
 await teacher.post(`/api/groups/${gid}/assignments`,{data:{lectureId:lid}});expect((await page.request.get(`/api/lectures/${lid}`)).status()).toBe(200);
 expect((await teacher.delete(`/api/groups/${gid}/members/${student.id}`)).status()).toBe(204);expect((await page.request.get(`/api/groups/${gid}`)).status()).toBe(404);expect((await page.request.get(`/api/lectures/${lid}`)).status()).toBe(404);
 }finally{await Promise.all([admin.dispose(),teacher.dispose(),other.dispose(),outsider.dispose()])}
});
