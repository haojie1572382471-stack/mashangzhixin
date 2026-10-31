// Isolated Windows acceptance: server auth, ownership, coaching, persistence and actual UI.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..'),work=path.join(root,'build','hardening-'+Date.now()),base='http://127.0.0.1:8080';let server;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function call(url,body,cookie='',status=200,method){const r=await fetch(base+url,{method:method||(body?'POST':'GET'),headers:{'Content-Type':'application/json',Cookie:cookie},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000)});assert.equal(r.status,status,url+' '+await r.clone().text());return {body:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0],headers:r.headers};}
async function stop(){if(server&&server.exitCode===null){const exited=new Promise(r=>server.once('exit',r));server.kill();await exited;}server=null;}
async function start(){const env={...process.env,LLM_API_KEY:'',DEEPSEEK_API_KEY:''};server=spawn(path.join(root,'build/app/mashang_server.exe'),[],{cwd:work,env,windowsHide:true,stdio:['ignore','pipe','pipe']});let logs='';server.stdout.on('data',x=>logs+=x);server.stderr.on('data',x=>logs+=x);for(let i=0;i<80;i++){if(server.exitCode!==null)throw Error(logs);try{await call('/api/health');return;}catch{}await sleep(100);}throw Error(logs);}
(async()=>{
 try{await fetch(base+'/api/health',{signal:AbortSignal.timeout(500)});throw Error('Port 8080 occupied');}catch(e){if(e.message==='Port 8080 occupied')throw e;}
 fs.mkdirSync(work,{recursive:true});for(const name of ['frontend','knowledge_base'])fs.cpSync(path.join(root,name),path.join(work,name),{recursive:true});fs.writeFileSync(path.join(work,'.env'),'LLM_API_KEY=\n');
 try{
 await start();const userA={username:'验收甲',password:'Testing123!'},userB={username:'验收乙',password:'Testing456!'};
 fs.mkdirSync(path.join(work,'data/accounts.json.tmp'),{recursive:true});
 await call('/api/auth/register',{username:'写入失败用户',password:'Testing123!'},'',500);
 fs.rmdirSync(path.join(work,'data/accounts.json.tmp'));
 await call('/api/auth/login',{username:'写入失败用户',password:'Testing123!'},'',401);
 const a=await call('/api/auth/register',userA),b=await call('/api/auth/register',userB);assert(a.headers.get('set-cookie').includes('HttpOnly'));assert(a.headers.get('set-cookie').includes('SameSite=Strict'));
 await call('/api/auth/login',{...userA,password:'incorrect123'},'',401);await call('/api/auth/register',userA,'',409);await call('/api/auth/register',{username:'guest',password:'Testing123!'},'',400);
 await call('/api/progress?course_id=cpp&user_id='+encodeURIComponent(userA.username),null,'',403);
 await call('/api/progress?course_id=cpp&user_id='+encodeURIComponent(userA.username),null,b.cookie,403);
 const wrong={course_id:'cpp',question:'验收题',answer:'验收解析',knowledge_point:'指针与引用'};
 const saved=await call('/api/wrong-questions',wrong,a.cookie,201);assert.equal((await call('/api/wrong-questions',null,a.cookie)).body.items.length,1);assert.equal((await call('/api/wrong-questions',null,b.cookie)).body.items.length,0);assert.equal((await call('/api/wrong-questions')).body.items.length,0);
 await call('/api/wrong-questions/'+saved.body.id+'/status',{status:'已掌握'},b.cookie,404,'PUT');
 await call('/api/wrong-questions/'+saved.body.id+'/status',{status:'已掌握'},a.cookie,200,'PUT');
 await call('/api/exercises/coach',{exercise_id:201},a.cookie,404);
 await call('/api/exercises/submit',{exercise_id:201,answer:'A',submission_id:'first'},a.cookie);
 const duplicate=await call('/api/exercises/submit',{exercise_id:201,answer:'A',submission_id:'first'},a.cookie);assert.equal(duplicate.body.reused,true);assert.equal(duplicate.body.recorded,false);
 const coach=await call('/api/exercises/coach',{exercise_id:201},a.cookie);assert.equal(coach.body.mode,'retrieval');assert(coach.body.sources.length);assert(coach.body.answer.includes('正确答案：B'));assert.notEqual(coach.body.verification_exercise_id,201);
 await call('/api/exercises/coach',{exercise_id:201},b.cookie,404);
 const before=(await call('/api/progress?course_id=cpp',null,a.cookie)).body;assert.equal(before.total_attempts,1);
 const accountFile=fs.readFileSync(path.join(work,'data/accounts.json'),'utf8');assert(!accountFile.includes(userA.password));assert(!accountFile.includes(a.cookie));assert(JSON.parse(accountFile).items.every(a=>a.hash.length===64&&a.salt.length===32));
 const csrf=await fetch(base+'/api/exercises/submit',{method:'POST',headers:{Origin:'https://example.com','Content-Type':'application/json'},body:JSON.stringify({exercise_id:201,answer:'B'})});assert.equal(csrf.status,403);
 await call('/api/auth/logout',{},a.cookie);await call('/api/progress?course_id=cpp',null,a.cookie,401);
 await stop();await start();const again=await call('/api/auth/login',userA);assert.deepEqual((await call('/api/progress?course_id=cpp',null,again.cookie)).body,before);assert.equal((await call('/api/wrong-questions',null,again.cookie)).body.items.length,1);
 // Run UI in a separate browser profile: register, grade, coach, verify and switch users.
 const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();page.setDefaultTimeout(15000);const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.error('PAGE ERROR',e.message);});page.on('response',r=>{if(r.url().includes('/api/')&&r.status()>=400)console.error('HTTP',r.status(),r.url());});await page.route('https://fonts.googleapis.com/**',r=>r.abort());
 await page.goto(base+'/#mine');await page.locator('[data-mode="register"]').click();await page.locator('#auth-user').fill('界面验收');await page.locator('#auth-pass').fill('Testing123!');await page.locator('#auth-pass2').fill('Testing123!');await page.locator('#auth-submit').click();await page.locator('#profile-box').waitFor({state:'visible'});
 await page.evaluate(()=>location.hash='progress');await page.locator('#lp-content').waitFor({state:'visible'});await page.locator('.lp-topic').filter({hasText:'指针与引用'}).locator('button').click();await page.locator('#pr-question-panel').waitFor({state:'visible'});await page.locator('#pr-options [data-key="A"]').click();await page.locator('#pr-submit').click();await page.locator('#pr-coach').waitFor({state:'visible'});await page.locator('#pr-coach').click();await page.locator('#pr-verify').waitFor({state:'visible'});const firstQuestion=await page.locator('#pr-question').textContent();await page.locator('#pr-verify').click();await page.waitForFunction(q=>document.getElementById('pr-question').textContent!==q,firstQuestion);assert.equal(await page.locator('#pr-options button').count(),4);
 await page.evaluate(()=>location.hash='progress');await page.locator('#lp-content').waitFor({state:'visible'});await page.waitForFunction(()=>document.getElementById('lp-user').textContent.includes('界面验收'));await page.reload();await page.waitForFunction(()=>document.getElementById('lp-user').textContent.includes('界面验收'));await page.locator('#lp-content').waitFor({state:'visible'});
 assert(!await page.evaluate(()=>document.cookie.includes('mzx_session')));assert(!await page.evaluate(()=>localStorage.getItem('mzx_users').includes('Testing123!')));
 await page.setViewportSize({width:390,height:844});assert(await page.locator('#learning-progress').evaluate(e=>e.scrollWidth<=e.clientWidth+1));await page.screenshot({path:path.join(work,'progress-mobile.png')});
 await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:path.join(work,'progress-desktop.png')});
 await page.evaluate(()=>location.hash='mine');await page.locator('#btn-logout').click();await page.locator('#logout-ok').click();await page.locator('#auth-box').waitFor({state:'visible'});await page.evaluate(()=>location.hash='mistakes');await page.waitForTimeout(300);assert.equal(await page.locator('#mk-list [data-rev]').count(),0);
 assert.deepEqual(errors,[]);await context.close();
 }finally{await browser.close();}
 console.log('PASS: server sessions, hashed passwords, forbidden spoofing, wrong-question ownership, CSRF origin rejection, idempotency, coaching fallback, different verification exercise, restart persistence and browser/mobile flows');
 console.log('Evidence: '+work);
 }finally{await stop();}
})().catch(e=>{console.error(e);process.exit(1)});
