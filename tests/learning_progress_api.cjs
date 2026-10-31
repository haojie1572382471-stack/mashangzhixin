// Run after scripts/build.ps1, with port 8080 free: node tests/learning_progress_api.cjs
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..'),work=path.join(root,'build','learning-test-'+Date.now());
const base='http://127.0.0.1:8080';let server;
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const sessions=new Map(),registered=new Set();
async function cookieFor(user){
 if(user==='guest')return '';
 if(sessions.has(user))return await sessions.get(user);
 const promise=(async()=>{const action=registered.has(user)?'login':'register';const r=await fetch(base+'/api/auth/'+action,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:user,password:'test12345'})});assert.equal(r.status,200,await r.clone().text());registered.add(user);return r.headers.get('set-cookie').split(';')[0];})();
 sessions.set(user,promise);return await promise;
}
async function api(url,body,status=200){const declared=body?.user_id??new URL(base+url).searchParams.get('user_id')??'guest';const user=typeof declared==='string'&&declared?declared:'guest';const cookie=await cookieFor(user);const r=await fetch(base+url,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',Cookie:cookie},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000)});assert.equal(r.status,status,url+' '+await r.clone().text());return r.json();}
function progress(user='guest',course='cpp'){return api('/api/progress?course_id='+course+'&user_id='+encodeURIComponent(user));}
function submit(user,answer='B',extra={}){return api('/api/exercises/submit',{user_id:user,exercise_id:201,answer,...extra});}
async function stop(){if(server&&server.exitCode===null){const exit=new Promise(r=>server.once('exit',r));server.kill();await exit;}server=null;}
async function start(expectFailure=false){
 sessions.clear();
 const env={...process.env};for(const key of ['LLM_API_KEY','DEEPSEEK_API_KEY'])delete env[key];
 server=spawn(path.join(root,'build/app/mashang_server.exe'),[],{cwd:work,env,windowsHide:true,stdio:['ignore','pipe','pipe']});let logs='';server.stdout.on('data',d=>logs+=d);server.stderr.on('data',d=>logs+=d);
 for(let i=0;i<80;i++){if(server.exitCode!==null){if(expectFailure)return;throw Error(logs);}try{await api('/api/health');if(expectFailure)throw Error('Corrupt data was silently accepted');return;}catch(e){if(e.message==='Corrupt data was silently accepted')throw e;}await pause(50);}throw Error('Server startup timed out: '+logs);
}
(async()=>{
 try{await fetch(base+'/api/health',{signal:AbortSignal.timeout(500)});throw Error('Port 8080 is occupied; stop the backend first.');}catch(e){if(e.message.startsWith('Port'))throw e;}
 fs.mkdirSync(path.join(work,'frontend'),{recursive:true});fs.writeFileSync(path.join(work,'frontend/index.html'),'test');fs.cpSync(path.join(root,'knowledge_base'),path.join(work,'knowledge_base'),{recursive:true});fs.writeFileSync(path.join(work,'.env'),'LLM_API_KEY=\n');
 try{
 await start();const fresh=await progress();assert.equal(fresh.total_attempts,0);assert.equal(fresh.knowledge_points.length,10);assert(fresh.knowledge_points.every(p=>p.level==='未学习'));
 const user='学习者甲';await submit(user);let p=await progress(user);assert.equal(p.total_attempts,1);assert.equal(p.correct_attempts,1);assert.equal(p.knowledge_points.find(k=>k.knowledge_point==='指针与引用').mastery,100);
 await submit(user,'A');p=await progress(user);assert.equal(p.total_attempts,2);assert.equal(p.accuracy,50);assert.equal(p.knowledge_points.find(k=>k.knowledge_point==='指针与引用').mastery,0);assert.deepEqual(p.weak_knowledge_points,['指针与引用']);
 for(let i=0;i<5;i++){const r=await api('/api/recommendations?course_id=cpp&user_id='+encodeURIComponent(user));assert.equal(r.count,10);assert(r.items.slice(0,3).every(q=>q.knowledge_point==='指针与引用'));assert.equal(new Set(r.items.map(q=>q.id)).size,10);}
 await submit(user,'B',{exercise_id:101});assert.equal((await progress(user,'data-structure')).total_attempts,1);assert.equal((await progress(user)).total_attempts,2);assert.equal((await progress('学习者乙')).total_attempts,0);assert.equal((await progress()).total_attempts,0);
 await api('/api/exercises/submit',{exercise_id:201,answer:'B'});assert.equal((await progress()).total_attempts,1);
 const first=await submit(user,'A',{submission_id:'retry-token'});const retry=await submit(user,'A',{submission_id:'retry-token'});assert.equal(first.attempt_id,retry.attempt_id);assert.equal((await progress(user)).total_attempts,3);
 await api('/api/exercises/submit',{user_id:user,exercise_id:201,answer:'B',submission_id:'retry-token'},409);
 await submit(user,'A');assert.equal((await progress(user)).total_attempts,4);
 for(const answer of ['', 'AB','Z'])await api('/api/exercises/submit',{user_id:user,exercise_id:201,answer},400);
 await api('/api/exercises/submit',{user_id:'',exercise_id:201,answer:'B'},400);
 await api('/api/exercises/submit',{user_id:42,exercise_id:201,answer:'B'},400);
 await api('/api/exercises/submit',{user_id:user,exercise_id:999,answer:'B'},404);
 await api('/api/progress?course_id=invalid',null,400);
 await Promise.all(Array.from({length:12},(_,i)=>submit('parallel','B',{submission_id:'parallel-'+i})));assert.equal((await progress('parallel')).total_attempts,12);
 await Promise.all(Array.from({length:4},()=>submit('parallel','B',{submission_id:'same-token'})));assert.equal((await progress('parallel')).total_attempts,13);
 for(let i=0;i<3;i++)await submit('mastery');let stats=(await progress('mastery')).knowledge_points.find(k=>k.knowledge_point==='指针与引用');assert.equal(stats.level,'学习中');assert.equal(stats.unique_exercises,1);await submit('mastery','A');assert.equal((await progress('mastery')).knowledge_points.find(k=>k.knowledge_point==='指针与引用').mastery,0);
 await submit('window','A');for(let i=0;i<20;i++)await submit('window');assert.equal((await progress('window')).knowledge_points.find(k=>k.knowledge_point==='指针与引用').mastery,100);
 const before=await progress(user);const dataPath=path.join(work,'data/learning_attempts.json');const saved=JSON.parse(fs.readFileSync(dataPath,'utf8'));assert(saved.items.every(a=>/^\d{4}-\d{2}-\d{2}T.*Z$/.test(a.attempted_at)));assert(saved.items.every(a=>a.course_id&&a.knowledge_point&&a.user_id));
 fs.mkdirSync(dataPath+'.tmp');await api('/api/exercises/submit',{user_id:user,exercise_id:201,answer:'B'},500);fs.rmdirSync(dataPath+'.tmp');assert.deepEqual(await progress(user),before);
 await stop();await start();assert.deepEqual(await progress(user),before);
 await stop();const backup=fs.readFileSync(dataPath+'.bak','utf8');fs.writeFileSync(dataPath,'corrupted');await start();assert.equal(JSON.parse(fs.readFileSync(dataPath,'utf8')).items.length,JSON.parse(backup).items.length);
 await stop();fs.writeFileSync(dataPath,'corrupted');fs.writeFileSync(dataPath+'.bak','corrupted');await start(true);
 console.log('PASS: user/course isolation, guest, correct/wrong/repeated attempts, retry idempotency, concurrent writes, mastery rules, weak priorities, invalid inputs, write rollback, restart persistence, backup recovery and corrupt-data refusal');
 }finally{await stop();const resolved=path.resolve(work);assert(resolved.startsWith(path.join(root,'build','learning-test-')));fs.rmSync(work,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exit(1)});