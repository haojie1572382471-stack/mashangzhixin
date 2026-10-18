window.createPracticeCoach=function(api){
var prState=api.state,prQuestion=api.question,prBusy=api.busy,prRender=api.render,prLoad=api.load,learningUser=api.user;
/* Guided review uses the saved attempt; no client-side answer generation or grading. */
var coachState = {question: null, data: null, request: 0};
function resetCoach() {
  coachState.request++; coachState.question = null; coachState.data = null;
  document.getElementById('pr-coach-panel').hidden = true;
  document.getElementById('pr-verify').hidden = true;
}
function renderCoach(q, result) {
  var button=document.getElementById('pr-coach');
  button.hidden=!result; button.disabled=!!prState.coaching;
  button.textContent=prState.coaching?'正在查阅资料并生成辅导……':'查看针对性辅导';
  if(!q||q.id!==coachState.question){document.getElementById('pr-coach-panel').hidden=true;document.getElementById('pr-verify').hidden=true;}
}
document.getElementById('pr-coach').addEventListener('click',async function(){
  var q=prQuestion();if(!q||!prState.results[q.id]||prBusy())return;
  var request=++coachState.request,user=learningUser();
  coachState.question=q.id;prState.coaching=true;prRender();
  var panel=document.getElementById('pr-coach-panel');panel.hidden=false;panel.textContent='正在读取本次作答与课程资料……';
  var controller=new AbortController(),timer=setTimeout(()=>controller.abort(),50000);
  try{
    var response=await fetch(MZX_API+'/api/exercises/coach',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({exercise_id:q.id}),signal:controller.signal});
    if(!response.ok)throw Error('HTTP '+response.status);var data=await response.json();
    if(request!==coachState.request||user!==learningUser())return;
    coachState.data=data;panel.textContent=data.notice+'\n\n'+data.answer+'\n\n参考资料：\n'+data.sources.map(s=>s.title+' / '+s.section+'（'+s.path+'）').join('\n');
    document.getElementById('pr-verify').hidden=!data.verification_exercise_id;
  }catch(e){if(request===coachState.request)panel.textContent='辅导暂不可用，可先阅读上方标准解析，再尝试同类题。';}
  finally{clearTimeout(timer);if(request===coachState.request){prState.coaching=false;prRender();}}
});
document.getElementById('pr-verify').addEventListener('click',async function(){
  var q=prQuestion(),data=coachState.data,user=learningUser();if(!q||!data||prBusy())return;
  var next=data.verification_exercise_id;
  await prLoad(q.course_id,q.knowledge_point);
  if(user!==learningUser())return;
  // Exclude the just-explained question so the exercise tests transfer, not recall.
  prState.items=prState.items.filter(item=>item.id!==q.id);
  var index=prState.items.findIndex(item=>item.id===next);prState.currentIndex=Math.max(0,index);prRender();
});

return {reset:resetCoach,render:renderCoach};
};
