(function(){
'use strict';
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function inline(s){return s.split(/(`[^`]+`)/g).map(part=>part.startsWith('`')?'<code>'+esc(part.slice(1,-1))+'</code>':esc(part).replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>')).join('');}
function format(raw){
 const lines=String(raw==null?'':raw).replace(/\r\n/g,'\n').split('\n');let out=[],code=null,lang='';
 function flush(){out.push('<div class="ai-code"><div class="ai-code-bar"><span>'+esc(lang||'代码')+'</span><button type="button" class="ai-copy">复制代码</button></div><pre><code>'+esc(code.join('\n'))+'</code></pre></div>');code=null;}
 for(const line of lines){const fence=line.match(/^\s*```(.*)$/);if(fence){if(code!==null)flush();else{code=[];lang=fence[1].trim();}continue;}if(code!==null){code.push(line);continue;}if(!line.trim())continue;const h=line.match(/^#{1,6}\s+(.+)$/);out.push(h?'<h4>'+inline(h[1])+'</h4>':'<p>'+inline(line)+'</p>');}
 if(code!==null)flush();return out.join('')||'<p>未收到回答内容，请重试。</p>';
}
function error(e){if(e.name==='AbortError')return '等待超时，请稍后重试。';if(/401/.test(e.message))return '登录已过期，请重新登录后重试。';if(/429/.test(e.message))return '请求较多，请稍候再重试。';if(e instanceof TypeError)return '无法连接后端，请确认后端已启动并检查网络。';return '回答暂不可用，请稍后重试。';}
async function request(url,body){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),60000);try{const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:controller.signal});if(!r.ok)throw Error('HTTP '+r.status);const d=await r.json();if(!d||typeof d.answer!=='string'||!d.answer.trim())throw Error('Invalid answer');return d;}finally{clearTimeout(timer);}}
function waiting(el){const start=Date.now();el.setAttribute('role','status');el.setAttribute('aria-live','polite');el.setAttribute('aria-busy','true');function update(){const n=Math.floor((Date.now()-start)/1000);el.textContent=(n<15?'正在等待回答，请稍候':'回答仍在处理中，请耐心等待')+' · 已等待 '+n+' 秒';}update();const timer=setInterval(update,1000);return ()=>{clearInterval(timer);el.setAttribute('aria-busy','false');};}
document.addEventListener('click',async function(e){const b=e.target.closest('.ai-copy');if(!b)return;const text=b.closest('.ai-code').querySelector('code').textContent;try{await navigator.clipboard.writeText(text);b.textContent='已复制';}catch(err){b.textContent='复制失败，请选中代码复制';}setTimeout(()=>b.textContent='复制代码',2000);});
window.MZX_AI={format:format,error:error,request:request,waiting:waiting};
})();
