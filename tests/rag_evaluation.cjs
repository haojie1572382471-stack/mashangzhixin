// Retrieval-only benchmark; expected source hits are not a measure of LLM factual accuracy.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..'),work=path.join(root,'build','rag-evaluation-'+Date.now()),base='http://127.0.0.1:8080';
(async()=>{
 try{await fetch(base+'/api/health',{signal:AbortSignal.timeout(500)});throw Error('Port 8080 occupied');}catch(e){if(e.message==='Port 8080 occupied')throw e;}
 fs.mkdirSync(path.join(work,'frontend'),{recursive:true});fs.writeFileSync(path.join(work,'frontend/index.html'),'benchmark');fs.cpSync(path.join(root,'knowledge_base'),path.join(work,'knowledge_base'),{recursive:true});fs.writeFileSync(path.join(work,'.env'),'LLM_API_KEY=\n');
 const server=spawn(path.join(root,'build/app/mashang_server.exe'),[],{cwd:work,env:{...process.env,LLM_API_KEY:'',DEEPSEEK_API_KEY:''},windowsHide:true,stdio:'ignore'});
 try{
 for(let i=0;i<80;i++){try{if((await fetch(base+'/api/health')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 const cases=JSON.parse(fs.readFileSync(path.join(__dirname,'rag_cases.json'),'utf8').replace(/^\uFEFF/,'')),results=[];
 for(const [course_id,question,expected] of cases){const started=performance.now();const response=await fetch(base+'/api/ask',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({course_id,question})});assert.equal(response.status,200);const data=await response.json();const sources=data.sources.map(s=>s.path);const hit=expected?sources.some(s=>s.endsWith(expected)):data.mode==='no_evidence'&&sources.length===0;assert(sources.every(s=>s.startsWith(course_id==='cpp'?'cpp/':'data_structure/')),'Cross-course leak');results.push({course_id,question,expected,sources,mode:data.mode,hit,latency_ms:Math.round(performance.now()-started)});}
 const positives=results.filter(r=>r.expected),negatives=results.filter(r=>!r.expected);const report={cases:results.length,source_hits:positives.filter(r=>r.hit).length,source_cases:positives.length,no_evidence_passed:negatives.filter(r=>r.hit).length,no_evidence_cases:negatives.length,results};
 fs.writeFileSync(path.join(work,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({cases:report.cases,source_hits:report.source_hits,source_cases:report.source_cases,no_evidence_passed:report.no_evidence_passed,no_evidence_cases:report.no_evidence_cases,report:path.join(work,'report.json')}));for(const r of results.filter(r=>!r.hit))console.log('MISS: '+r.question+' => '+r.sources.join(', '));
 }finally{const exited=new Promise(r=>server.once('exit',r));server.kill();await exited;}
})().catch(e=>{console.error(e);process.exit(1)});
