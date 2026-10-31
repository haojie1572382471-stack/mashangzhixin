window.createPracticeCoach=function(api){
var prState=api.state,prQuestion=api.question,prBusy=api.busy,prRender=api.render,prLoad=api.load,learningUser=api.user;
/* Guided review uses the saved attempt; no client-side answer generation or grading. */
var coachState = {question: null, data: null, request: 0, failed: false, stopWaiting: null};
function resetCoach() {
  if(coachState.stopWaiting)coachState.stopWaiting();
  coachState.request++; coachState.question = null; coachState.data = null; coachState.failed=false;
  document.getElementById('pr-coach-panel').hidden = true;
  document.getElementById('pr-verify').hidden = true;
}
function renderCoach(q, result) {
  var button=document.getElementById('pr-coach');
  button.hidden=!result; button.disabled=!!prState.coaching;
  button.textContent=prState.coaching?'正在查阅资料并生成辅导……':(coachState.failed?'重新获取辅导':'查看针对性辅导');
  if(!q||q.id!==coachState.question){document.getElementById('pr-coach-panel').hidden=true;document.getElementById('pr-verify').hidden=true;}
}
document.getElementById('pr-coach').addEventListener('click',async function(){
  var q=prQuestion();if(!q||!prState.results[q.id]||prBusy())return;
  var request=++coachState.request,user=learningUser();
  coachState.question=q.id;coachState.data=null;coachState.failed=false;document.getElementById('pr-verify').hidden=true;prState.coaching=true;prRender();
  var panel=document.getElementById('pr-coach-panel');panel.hidden=false;panel.textContent='正在读取本次作答与课程资料……';
  var stopWaiting=MZX_AI.waiting(panel);coachState.stopWaiting=stopWaiting;
  try{
    var data=await MZX_AI.request(MZX_API+'/api/exercises/coach',{exercise_id:q.id});
    if(request!==coachState.request||user!==learningUser())return;
    stopWaiting();coachState.data=data;
    panel.innerHTML=MZX_AI.format((data.notice||'')+'\n\n'+data.answer+'\n\n参考资料：\n'+(data.sources||[]).map(s=>s.title+' / '+s.section+'（'+s.path+'）').join('\n'));
    document.getElementById('pr-verify').hidden=!data.verification_exercise_id;
  }catch(e){if(request===coachState.request){stopWaiting();coachState.failed=true;panel.textContent=MZX_AI.error(e)+' 可点击“重新获取辅导”，或先阅读标准解析。';}}
  finally{stopWaiting();if(request===coachState.request){prState.coaching=false;prRender();}}

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
