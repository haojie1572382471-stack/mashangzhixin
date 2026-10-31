
(function(){
'use strict';

/* ================= 11 RING CHAPTERS ================= */
var ORDER=['preface','ch1','ch2','ch3','ch4','ch5','ch6','ch7','ch8','ch9','ch10'];
var DATA={
  preface:{no:'序',name:'码上知新',
    lines:'从第一行代码开始，数据结构陪你温故知新。<br>今天约定：每个知识点，都学会写出来、画出来、跑起来。'},
  ch1:{no:'壹',name:'绪论',
    lines:'逻辑结构、存储结构与运算，是数据结构的三要素——像极了喜欢：遇见、记住、回应。<br>时间复杂度的答案很简单，我找你的算法，永远是 O(1)。'},
  ch2:{no:'贰',name:'线性表',
    lines:'顺序表再拥挤，也有插不进的心事；链表靠指针相连，<br>哪怕内存里天各一方，next 永远指向你。'},
  ch3:{no:'叁',name:'栈与队列',
    lines:'栈是后进先出，最近的心动永远压在栈顶；<br>队列是先进先出，所有等待都排着队奔向你。'},
  ch4:{no:'肆',name:'串',
    lines:'串是一行行字符，模式匹配在文本里找你。<br>KMP 算得再快，也不如我一眼就认出你。'},
  ch5:{no:'伍',name:'数组和广义表',
    lines:'数组按下标相遇，广义表里还能套着自己——<br>原来喜欢一个人，也是递归定义的。'},
  ch6:{no:'陆',name:'树与二叉树',
    lines:'二叉树有三种遍历：先序、中序、后序。而我对你的遍历只有一种——<br>每逢遇见你，就输出一次喜欢。'},
  ch7:{no:'柒',name:'图',
    lines:'图有顶点与边，邻接矩阵里每个 1 都是一条通路。<br>最短路径算得出来，可通往你心里的那条，从来只有一步。'},
  ch8:{no:'捌',name:'查找',
    lines:'二分查找每次砍掉一半世界，哈希函数把缘分直接映射进桶里。<br>而我查找你的方式，叫命中。'},
  ch9:{no:'玖',name:'排序',
    lines:'冒泡把最大的心事浮上水面，快速排序把世界分成两半。<br>所有排序里，我只想把你排在第一。'},
  ch10:{no:'拾',name:'综合应用与课程设计',
    lines:'把学过的结构统统用上——栈、树、图、查找与排序，<br>最后写成一份课程设计，名字叫：和你。'}
};

/* ================= RING-RIPPLE SCENE ================= */
var Scene=(function(){
  var canvas=document.getElementById('scene');
  var ctx=canvas.getContext('2d');
  var reduced=false;
  try{ reduced=window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches; }catch(e){}
  var W=0,H=0,SCALE=1,waterY=0,waterH=0;
  var SZ={s:1,R:118,D:[212,336,452,562,668],RR:[60,48,40,34,29]};
  var treeSegs=[],treeTips=[],treeBase={x:0,y:0};
  var treeLayers=[],par={x:0,y:0},canBlur=false,glowGrad=null,vigGrad=null;
  try{ canBlur=('filter' in document.createElement('canvas').getContext('2d')); }catch(e){ canBlur=false; }
  var lastTree=0,nextTree=800;
  var rings=[],featured=null;
  var particles=[],ripples=[],eman=[];
  var t0=0,nowT=0,lastAmb=0,nextAmb=1600,lastRip=0,nextRip=1800,lastEman=0;
  var mouse={x:-999,y:-999,over:false};
  var sw={on:false,x:0,y:0,dx:0,dy:0};
  var ringClickHandler=null,swipeHandler=null;
  var motion=1;                    /* 0=关闭动效 1=标准 2=华丽（设置面板控制） */
  var ringProg={};                 /* 章节圆环 → 学习进度 0..1 */
  var TAU=6.2832;
  var FONT='"Noto Serif SC","Songti SC","SimSun",serif';
  var MONO='Consolas, ui-monospace, Menlo, monospace';

  function initRings(){
    rings=ORDER.map(function(id,i){
      var d=DATA[id];
      return {id:id,no:d.no,name:d.name,x:0,y:0,r:8,tx:0,ty:0,tr:8,alpha:0,phase:i*0.73};
    });
  }
  function computeSZ(){
    var s=Math.min(Math.max(Math.min(W/1440,H/900),0.55),1.15);
    SZ={s:s,R:118*s,
      D:[212,336,452,562,668].map(function(v){return v*s;}),
      RR:[60,48,40,34,29].map(function(v){return v*s;})};
  }
  function retarget(){
    if(featured===null||!rings.length) return;
    var yi=ORDER.indexOf(featured);
    var cy=waterY-SZ.R*0.32;
    for(var i=0;i<rings.length;i++){
      var off=i-yi, d=Math.abs(off), r=rings[i];
      if(d===0){ r.tx=W*0.5; r.ty=cy; r.tr=SZ.R; r.alpha=1; }
      else{
        var side=off>0?1:-1;
        var dd=Math.min(d,5)-1;
        r.tx=W*0.5+side*SZ.D[dd];
        r.ty=waterY-SZ.RR[dd]*0.32;
        r.tr=SZ.RR[dd];
        r.alpha=[0.95,0.8,0.62,0.48,0.36][dd];
      }
    }
  }
  function snap(){
    for(var i=0;i<rings.length;i++){
      var r=rings[i]; r.x=r.tx; r.y=r.ty; r.r=r.tr;
    }
  }
  /* ---- flowing code tree (training backdrop, small & side) ---- */
  function tBranch(x,y,ang,len,wd,depth){
    var nx=x+Math.cos(ang)*len, ny=y+Math.sin(ang)*len;
    treeSegs.push({x1:x,y1:y,x2:nx,y2:ny,w:wd,depth:depth});
    if(depth>=8||len<5){
      treeTips.push({x:nx,y:ny,ch:Math.random()<.5?'0':'1',size:10+Math.random()*5,depth:depth});
      return;
    }
    if(depth>3&&Math.random()<0.2){
      var t=.35+Math.random()*.3;
      treeTips.push({x:x+(nx-x)*t,y:y+(ny-y)*t,ch:Math.random()<.5?'0':'1',size:Math.max(8.5,wd*1.05),depth:depth});
    }
    var n=depth<2?3:(Math.random()<0.15?3:2);
    var sp=.36+Math.random()*.3;
    for(var i=0;i<n;i++){
      var f=n===2?(i===0?-1:1):(i-1);
      var a=ang+f*sp+(Math.random()*.14-0.07);
      tBranch(nx,ny,a,len*(.62+Math.random()*.16),Math.max(1,wd*.66),depth+1);
    }
  }
  function buildTree(){
    treeSegs.length=0; treeTips.length=0;
    treeBase={x:W*0.5,y:waterY+2};
    tBranch(treeBase.x,treeBase.y,-Math.PI/2-(Math.random()*0.03),H*0.175,10.5,0);
  }
  /* ---- 裸眼 3D：按深度分层渲染（远层虚化 / 中层过渡 / 近层锐利泛光） ---- */
  function renderTreeLayer(minD,maxD,cfg){
    var c=document.createElement('canvas');
    c.width=canvas.width; c.height=canvas.height;
    var g=c.getContext('2d');
    g.setTransform(SCALE,0,0,SCALE,0,0);
    var i,s,t;
    for(i=0;i<treeSegs.length;i++){
      s=treeSegs[i];
      if(s.depth<minD||s.depth>maxD) continue;
      var d=Math.min(1,s.depth/8);
      g.strokeStyle='hsla('+(224-d*34).toFixed(1)+',88%,'+(cfg.light+d*12).toFixed(1)+'%,'+cfg.alpha+')';
      g.lineWidth=s.w*(cfg.wmul||1); g.lineCap='round';
      if(cfg.glow){ g.shadowColor='hsla(190,96%,70%,'+cfg.glow+')'; g.shadowBlur=cfg.blurGlow||8; }
      g.beginPath(); g.moveTo(s.x1,s.y1); g.lineTo(s.x2,s.y2); g.stroke();
      g.shadowBlur=0;
    }
    for(i=0;i<treeTips.length;i++){
      t=treeTips[i];
      var td=(t.depth==null)?4:t.depth;
      if(td<minD||td>maxD) continue;
      g.font='700 '+(t.size*(cfg.wmul||1)).toFixed(1)+'px Consolas, ui-monospace, Menlo, monospace';
      g.textAlign='center'; g.textBaseline='middle';
      g.fillStyle='rgba(152,231,255,'+cfg.alpha+')';
      if(cfg.glow){ g.shadowColor='rgba(140,225,250,'+cfg.glow+')'; g.shadowBlur=(cfg.blurGlow||8)*0.7; }
      g.fillText(t.ch,t.x,t.y);
      g.shadowBlur=0;
    }
    return c;
  }
  function distSeg(px,py,s){
    var dx=s.x2-s.x1, dy=s.y2-s.y1;
    var L2=dx*dx+dy*dy;
    var t=L2?((px-s.x1)*dx+(py-s.y1)*dy)/L2:0;
    t=Math.max(0,Math.min(1,t));
    return Math.hypot(px-(s.x1+t*dx),py-(s.y1+t*dy));
  }
  function hitBranch(x,y){
    var best=1e9,hit=null,i,d;
    for(i=0;i<treeSegs.length;i++){
      d=distSeg(x,y,treeSegs[i]);
      if(d<Math.max(12,treeSegs[i].w+8)&&d<best){best=d;hit=treeSegs[i];}
    }
    if(!hit){
      for(i=0;i<treeTips.length;i++){
        d=Math.hypot(x-treeTips[i].x,y-treeTips[i].y);
        if(d<treeTips[i].size+10){hit=treeTips[i];break;}
      }
    }
    return hit;
  }
  function resize(){
    W=Math.max(1,window.innerWidth||document.documentElement.clientWidth);
    H=Math.max(1,window.innerHeight||document.documentElement.clientHeight);
    var dpr=Math.max(1,window.devicePixelRatio||1);
    SCALE=Math.min(2,dpr,Math.sqrt(3.4e6/(W*H)));
    canvas.width=Math.max(1,Math.round(W*SCALE));
    canvas.height=Math.max(1,Math.round(H*SCALE));
    ctx.setTransform(SCALE,0,0,SCALE,0,0);
    waterH=Math.max(56,H*0.11);
    waterY=H-waterH;
    computeSZ();
    retarget();
    snap();
    buildTree();
    treeLayers=[
      {canvas:renderTreeLayer(6,99,{alpha:.52,light:34,wmul:0.95,glow:.35,blurGlow:8}),
       k:0.45,alpha:.62,blur:2.6,chroma:0,bloom:0},
      {canvas:renderTreeLayer(3,5,{alpha:.8,light:30,wmul:1,glow:.5,blurGlow:10}),
       k:0.82,alpha:.82,blur:1.1,chroma:.35,bloom:.12},
      {canvas:renderTreeLayer(0,2,{alpha:1,light:28,wmul:1.12,glow:.7,blurGlow:14}),
       k:1.28,alpha:1,blur:0,chroma:.5,bloom:.2}
    ];
    glowGrad=ctx.createRadialGradient(W*.5,H*.34,0,W*.5,H*.34,Math.max(W,H)*.62);
    glowGrad.addColorStop(0,'rgba(18,62,128,.34)');
    glowGrad.addColorStop(1,'rgba(18,62,128,0)');
    vigGrad=ctx.createRadialGradient(W*.5,H*.42,0,W*.5,H*.42,Math.max(W,H)*.56);
    vigGrad.addColorStop(0,'rgba(3,13,28,.62)');
    vigGrad.addColorStop(1,'rgba(3,13,28,0)');
  }
  function waterRipple(x,amp){
    if(ripples.length>46) ripples.shift();
    ripples.push({x:x,amp:Math.min(3.2,amp||1),life:0,max:2.6,R:0});
  }
  function emanBurst(x,y,r0){
    if(reduced) return;
    eman.push({x:x,y:y,r0:r0,life:0,max:2.2});
  }
  function spawnBits(x,y,n){
    for(var i=0;i<n;i++){
      var z=0.55+Math.random()*0.75;
      particles.push({x:x+(Math.random()*36-18),y:y+(Math.random()*20-10),
        vy:(13+Math.random()*13)*(0.7+z*0.5),phase:Math.random()*TAU,
        size:(11+Math.random()*5)*z*1.15,z:z,
        life:0,max:2.6+Math.random()*1.6,ch:Math.random()<.5?'0':'1'});
    }
  }
  function hitRing(x,y){
    var best=-1,bd=1e9,i,d;
    for(i=0;i<rings.length;i++){
      d=Math.hypot(x-rings[i].x,y-rings[i].y);
      if(d<rings[i].r+16&&d<bd&&rings[i].alpha>0.25){bd=d;best=i;}
    }
    return best;
  }
  function drawRing(r){
    var a=r.alpha;
    if(a<=0.02) return;
    var breathe=1+0.012*Math.sin(r.phase*1.3+nowT*0.0012);
    var pr=r.r*breathe;
    ctx.strokeStyle='rgba(96,196,238,'+(0.5*a).toFixed(3)+')';
    ctx.lineWidth=Math.max(2,r.r*0.06);
    ctx.shadowColor='rgba(96,200,246,'+(0.75*a).toFixed(3)+')'; ctx.shadowBlur=13;
    ctx.beginPath(); ctx.arc(r.x,r.y,pr,0,TAU); ctx.stroke();
    ctx.shadowBlur=0;
    ctx.strokeStyle='rgba(140,226,255,'+(0.85*a).toFixed(3)+')';
    ctx.lineWidth=Math.max(1.2,r.r*0.03);
    ctx.beginPath(); ctx.arc(r.x,r.y,pr*0.85,0,TAU); ctx.stroke();
    ctx.strokeStyle='rgba(170,238,255,'+(0.32*a).toFixed(3)+')';
    ctx.lineWidth=Math.max(0.8,r.r*0.016);
    ctx.beginPath(); ctx.arc(r.x,r.y,pr*0.58,0,TAU); ctx.stroke();
    /* ---- 学习进度：已完成的弧度 + 100% 时的勾 ---- */
    var pv=ringProg[r.id];
    if(typeof pv==='number'&&pv>0.004){
      var done=pv>=0.999;
      var col=done?'123,224,162':'255,215,106';
      ctx.strokeStyle='rgba('+col+','+(0.92*a).toFixed(3)+')';
      ctx.lineWidth=Math.max(2.2,pr*0.075);
      ctx.shadowColor='rgba('+col+','+(0.8*a).toFixed(3)+')';
      ctx.shadowBlur=done?16:10;
      ctx.beginPath();
      ctx.arc(r.x,r.y,pr,-Math.PI/2,-Math.PI/2+TAU*Math.min(1,pv));
      ctx.stroke();
      ctx.shadowBlur=0;
      if(done){
        ctx.fillStyle='rgba(123,224,162,'+(0.10*a).toFixed(3)+')';
        ctx.beginPath(); ctx.arc(r.x,r.y,pr*0.93,0,TAU); ctx.fill();
        var cs=Math.max(9,pr*0.17);
        ctx.strokeStyle='rgba(196,255,220,'+(0.96*a).toFixed(3)+')';
        ctx.lineWidth=Math.max(1.6,cs*0.22); ctx.lineCap='round';
        ctx.beginPath();
        ctx.moveTo(r.x-cs*0.46,r.y-cs*0.04);
        ctx.lineTo(r.x-cs*0.12,r.y+cs*0.32);
        ctx.lineTo(r.x+cs*0.5,r.y-cs*0.42);
        ctx.stroke();
        ctx.lineCap='butt';
      }else if(r.id===featured){
        ctx.fillStyle='rgba(255,229,153,'+(0.96*a).toFixed(3)+')';
        ctx.font='600 '+(13*r.r/SZ.R).toFixed(1)+'px '+FONT;
        ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText(Math.round(pv*100)+'%',r.x,r.y+pr*0.42);
      }
    }
    /* label */
    var big=r.id===featured;
    var s=r.r/SZ.R;
    var ns,nys,nms,nmy;
    if(big){ ns=46*s; nys=-13*s; nms=19*s; nmy=24*s; }
    else if(r.r>48){ ns=15; nys=-6; nms=10; nmy=10; }
    else if(r.r>38){ ns=12; nys=0; nms=9; nmy=12; }
    else{ ns=10; nys=0; nms=0; nmy=0; }
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.shadowColor='rgba(160,232,255,.8)'; ctx.shadowBlur=8;
    if(big){
      ctx.fillStyle='rgba(228,251,255,'+(0.96*a).toFixed(3)+')';
      ctx.font='600 '+ns.toFixed(1)+'px '+FONT;
      ctx.fillText(r.no,r.x,r.y+nys);
      ctx.fillStyle='rgba(190,240,255,'+(0.9*a).toFixed(3)+')';
      ctx.font='500 '+nms.toFixed(1)+'px '+FONT;
      ctx.fillText(r.name,r.x,r.y+nmy);
    }else{
      ctx.fillStyle='rgba(200,244,255,'+(0.85*a).toFixed(3)+')';
      ctx.font='600 '+ns.toFixed(1)+'px '+FONT;
      ctx.fillText(r.no,r.x,r.y+nys);
      if(nms>0){
        ctx.font='400 '+nms.toFixed(1)+'px '+FONT;
        ctx.fillText(r.name,r.x,r.y+nmy);
      }
    }
    ctx.shadowBlur=0;
  }
  function surfY(x,t){
    var y=waterY;
    if(!reduced){
      y+=Math.sin(x*.012+t*.0007)*1.1+Math.sin(x*.031-t*.0005)*.7;
    }
    for(var i=0;i<ripples.length;i++){
      var r=ripples[i];
      var d=x-r.x, ad=Math.abs(d);
      if(ad<r.R+110){
        var env=Math.exp(-ad/(r.R*.5+70))*Math.exp(-r.life*1.05);
        y+=Math.sin(d*.05-r.life*7)*r.amp*3.4*env;
      }
    }
    return y;
  }
  function drawWater(t){
    var g=ctx;
    var grad=g.createLinearGradient(0,waterY,0,H);
    grad.addColorStop(0,'rgba(26,86,150,.32)');
    grad.addColorStop(.5,'rgba(10,40,90,.48)');
    grad.addColorStop(1,'rgba(4,18,45,.64)');
    g.fillStyle=grad;
    g.fillRect(0,waterY,W,H-waterY);
    var step=Math.max(4,W/220),x,y;
    g.beginPath();
    for(x=0;x<=W+step;x+=step){ y=surfY(x,t); if(x===0)g.moveTo(x,y); else g.lineTo(x,y); }
    g.strokeStyle='rgba(150,228,252,.16)'; g.lineWidth=7; g.stroke();
    g.strokeStyle='rgba(168,232,255,.55)'; g.lineWidth=1.8; g.stroke();
    var i,r,pr,a;
    for(i=0;i<ripples.length;i++){
      r=ripples[i]; pr=r.life/r.max;
      a=(1-pr)*.5*(r.amp/1.2+.35);
      if(a<=0) continue;
      g.strokeStyle='rgba(170,235,255,'+a.toFixed(3)+')';
      g.lineWidth=1.4;
      g.beginPath();
      g.ellipse(r.x,waterY,r.R,r.R*.17,0,0,TAU);
      g.stroke();
    }
  }
  function frame(ts){
    var dt=Math.min(.05,(ts-t0)/1000)||0.016;
    t0=ts; nowT=ts;
    ctx.clearRect(0,0,W,H);
    if(glowGrad){ ctx.fillStyle=glowGrad; ctx.fillRect(0,0,W,H); }
    if(treeLayers.length){
      var ptx=0,pty=0;
      if(!reduced){
        if(mouse.over){
          ptx=((mouse.x/W)-0.5)*2; pty=((mouse.y/H)-0.5)*2;
        }else{
          ptx=Math.sin(nowT*0.00017)*0.6; pty=Math.cos(nowT*0.00013)*0.4;
        }
        var pe=Math.min(1,dt*3);
        par.x+=(ptx-par.x)*pe; par.y+=(pty-par.y)*pe;
      }else{ par.x=0; par.y=0; }
      for(var li=0;li<treeLayers.length;li++){
        var L=treeLayers[li];
        var ox=par.x*15*L.k, oy=par.y*8.5*L.k;
        ctx.globalAlpha=L.alpha;
        if(L.blur&&canBlur&&!reduced) ctx.filter='blur('+L.blur.toFixed(1)+'px)';
        ctx.drawImage(L.canvas,ox,oy,W,H);
        ctx.filter='none';
        if(L.chroma&&!reduced){
          ctx.globalCompositeOperation='lighter';
          ctx.globalAlpha=L.alpha*L.chroma;
          ctx.drawImage(L.canvas,ox+2.4,oy+0.8,W,H);
          ctx.globalAlpha=L.alpha*L.chroma*0.6;
          ctx.drawImage(L.canvas,ox-2.4,oy-0.8,W,H);
          ctx.globalCompositeOperation='source-over';
        }
        if(L.bloom&&!reduced){
          var bw=W*0.01, bh=H*0.01;
          ctx.globalCompositeOperation='lighter';
          ctx.globalAlpha=L.alpha*L.bloom;
          ctx.drawImage(L.canvas,ox-bw/2,oy-bh/2,W+bw,H+bh);
          ctx.globalCompositeOperation='source-over';
        }
        ctx.globalAlpha=1;
      }
    }
    if(vigGrad){ ctx.fillStyle=vigGrad; ctx.fillRect(0,0,W,H); }
    /* rings */
    var i,r,k;
    k=reduced?1:(1-Math.exp(-dt*4.2));
    for(i=0;i<rings.length;i++){
      r=rings[i];
      r.x+=(r.tx-r.x)*k;
      r.y+=(r.ty-r.y)*k;
      r.r+=(r.tr-r.r)*k;
      r.alpha+=(targetAlpha(r)-r.alpha)*Math.min(1,dt*3);
      drawRing(r);
    }
    /* emanation ripples */
    for(i=eman.length-1;i>=0;i--){
      r=eman[i]; r.life+=dt;
      var pr=r.life/r.max;
      if(pr>=1){ eman.splice(i,1); continue; }
      var rad=r.r0+(r.r0*2.6)*pr;
      ctx.strokeStyle='rgba(150,228,255,'+((1-pr)*0.28).toFixed(3)+')';
      ctx.lineWidth=2;
      ctx.beginPath(); ctx.arc(r.x,r.y,rad,0,TAU); ctx.stroke();
    }
    /* water */
    drawWater(reduced?0:ts);
    for(i=ripples.length-1;i>=0;i--){
      r=ripples[i]; r.life+=dt; r.R+=(26+r.amp*14)*dt;
      if(r.life>=r.max) ripples.splice(i,1);
    }
    /* falling 0/1 */
    for(i=particles.length-1;i>=0;i--){
      var p=particles[i];
      p.life+=dt; p.phase+=dt*1.1;
      p.x+=Math.sin(p.phase)*7*dt;
      p.y+=p.vy*dt;
      var pa=(1-p.life/p.max)*0.85*(0.5+0.5*(p.z||1));
      if(p.y>=waterY-2){
        waterRipple(p.x,0.25+0.4*(p.z||1));
        particles.splice(i,1); continue;
      }
      if(pa<=0.02){ particles.splice(i,1); continue; }
      ctx.font='700 '+p.size.toFixed(1)+'px '+MONO;
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.shadowColor='rgba(140,225,250,.7)'; ctx.shadowBlur=6*(p.z||1);
      ctx.fillStyle='rgba(200,244,255,'+Math.min(0.95,pa).toFixed(3)+')';
      ctx.fillText(p.ch,p.x,p.y);
      ctx.shadowBlur=0;
    }
    /* ambient life */
    if(!reduced&&motion>0){
      if(nowT>lastTree+nextTree){
        if(treeSegs.length){
          var tsg=treeSegs[(Math.random()*treeSegs.length)|0];
          var ttf=Math.random();
          spawnBits(tsg.x1+(tsg.x2-tsg.x1)*ttf,tsg.y1+(tsg.y2-tsg.y1)*ttf,1);
        }
        lastTree=nowT; nextTree=900+Math.random()*1200;
      }
      if(nowT>lastAmb+nextAmb){
        var vis=rings.filter(function(rr){return rr.alpha>0.3;});
        var ambN=motion===2?3:1;
        for(var bi=0;bi<ambN;bi++){
          if(vis.length){ var rr=vis[(Math.random()*vis.length)|0]; spawnBits(rr.x,rr.y-rr.r*0.3,1); }
        }
        lastAmb=nowT; nextAmb=(motion===2?800:1500)+Math.random()*2000;
      }
      if(nowT>lastRip+nextRip){
        waterRipple(W*(.08+Math.random()*.84),.5+Math.random()*.6);
        lastRip=nowT; nextRip=(motion===2?900:1600)+Math.random()*2000;
      }
      if(nowT>lastEman+2600){
        var fi=ORDER.indexOf(featured);
        if(fi>=0) emanBurst(rings[fi].x,rings[fi].y,rings[fi].r);
        lastEman=nowT;
      }
    }
    if(mouse.over){
      canvas.style.cursor=hitRing(mouse.x,mouse.y)>=0?'pointer':'default';
    }
    requestAnimationFrame(frame);
  }
  function targetAlpha(r){
    if(featured===null) return 0;
    var yi=ORDER.indexOf(featured);
    var i=ORDER.indexOf(r.id);
    var d=Math.abs(i-yi);
    if(d===0) return 1;
    return [0.95,0.8,0.62,0.48,0.36][Math.min(d,5)-1];
  }
  function feature(id){
    if(ORDER.indexOf(id)<0) return;
    var first=!featured;
    featured=id;
    retarget();
    if(first||reduced) snap();
    var fi=ORDER.indexOf(id);
    emanBurst(rings[fi].x,rings[fi].y,rings[fi].r);
  }
  function tap(x,y){
    if(motion>0) spawnBits(x,y,(motion===2?16:9)+((Math.random()*5)|0));
    if(y>waterY-6){ waterRipple(x,1); return; }
    var ri=hitRing(x,y);
    if(ri>=0){
      var id=rings[ri].id;
      emanBurst(rings[ri].x,rings[ri].y,rings[ri].r);
      if(id!==featured&&ringClickHandler){
        ringClickHandler(id,rings[ri].x<W*0.5?'back':'fwd');
      }
      return;
    }
    if(hitBranch(x,y)){ waterRipple(x,0.8); }
  }
  function effectAt(x,y){
    if(motion>0) spawnBits(x,y,4+((Math.random()*3)|0));
    while(rings.length>28) rings.shift();
    rings.push({x:x,y:y,R:6,vr:34,life:0,max:1.7});
    rings.push({x:x,y:y,R:2,vr:48,life:0,max:1.4});
    if(y>waterY-6){ waterRipple(x,1); }
  }
  /* events */
  var copyDragEl=null;
  function dragFeedback(){
    if(reduced) return;
    if(!copyDragEl) copyDragEl=document.querySelector('.copy');
    if(Math.abs(sw.dx)>14&&Math.abs(sw.dx)>Math.abs(sw.dy)){
      copyDragEl.style.transform='translateY(var(--vshift)) translateX('+(sw.dx*0.5)+'px)';
      copyDragEl.style.opacity=String(Math.max(0.45,1-Math.abs(sw.dx)/700));
    }
  }
  function dragReset(smooth){
    if(!copyDragEl) return;
    if(smooth){
      copyDragEl.style.transition='transform .24s cubic-bezier(.22,1,.36,1), opacity .24s';
      copyDragEl.style.transform='';
      copyDragEl.style.opacity='';
      setTimeout(function(){ copyDragEl.style.transition=''; },260);
    }else{
      copyDragEl.style.transform='';
      copyDragEl.style.opacity='';
    }
  }
  function swipeEnd(x,y){
    sw.on=false;
    var isSwipe=Math.abs(sw.dx)>56&&Math.abs(sw.dx)>Math.abs(sw.dy)*1.4;
    dragReset(true);
    if(isSwipe){
      if(swipeHandler) swipeHandler(sw.dx<0?1:-1);
    }else{
      tap(x,y);
    }
  }
  initRings();
  resize();
  var rzT=null;
  window.addEventListener('resize',function(){ clearTimeout(rzT); rzT=setTimeout(resize,140); });
  window.addEventListener('orientationchange',function(){ setTimeout(resize,60); });
  if(window.PointerEvent){
    canvas.addEventListener('pointerdown',function(e){
      sw.on=true; sw.x=e.clientX; sw.y=e.clientY; sw.dx=0; sw.dy=0;
      try{ canvas.setPointerCapture(e.pointerId); }catch(_){}
    });
    canvas.addEventListener('pointermove',function(e){
      mouse.x=e.clientX; mouse.y=e.clientY; mouse.over=true;
      if(sw.on){ sw.dx=e.clientX-sw.x; sw.dy=e.clientY-sw.y; dragFeedback(); }
    });
    canvas.addEventListener('pointerup',function(e){
      if(sw.on) swipeEnd(e.clientX,e.clientY);
    });
    canvas.addEventListener('pointercancel',function(){
      if(sw.on){ sw.on=false; dragReset(true); }
    });
  }else{
    canvas.addEventListener('mousedown',function(e){
      sw.on=true; sw.x=e.clientX; sw.y=e.clientY; sw.dx=0; sw.dy=0;
    });
    window.addEventListener('mousemove',function(e){
      mouse.x=e.clientX; mouse.y=e.clientY; mouse.over=true;
      if(sw.on){ sw.dx=e.clientX-sw.x; sw.dy=e.clientY-sw.y; dragFeedback(); }
    });
    window.addEventListener('mouseup',function(e){
      if(sw.on) swipeEnd(e.clientX,e.clientY);
    });
  }
  canvas.addEventListener('pointerleave',function(){ mouse.over=false; canvas.style.cursor=''; });
  if(!reduced){
    var kk;
    for(kk=0;kk<4;kk++) waterRipple(W*(.2+Math.random()*.6),.5);
  }
  t0=0;
  requestAnimationFrame(function(ts){ t0=ts; frame(ts); });

  return {
    feature:feature,
    reduced:reduced,
    effectAt:effectAt,
    setRingClickHandler:function(fn){ ringClickHandler=fn; },
    setSwipeHandler:function(fn){ swipeHandler=fn; },
    /* 设置面板：0 关闭动效 / 1 标准 / 2 华丽 */
    setMotion:function(l){ motion=typeof l==='number'?l:1; },
    getMotion:function(){ return motion; },
    /* 章节圆环 ↔ 学习进度（{ch1:0.5, ...} 或 'total' 整体） */
    setProgress:function(map){ ringProg=map||{}; }
  };
})();

/* ================= CLICK TOUCH FX (毛玻璃 + 圆环水波涟漪) ================= */
var fxLayer=document.getElementById('fx-layer');
var FX_MAX=27;
function fxRipple(x,y){
  if(Scene.reduced) return;
  while(fxLayer.childElementCount>FX_MAX-3&&fxLayer.firstElementChild){
    fxLayer.removeChild(fxLayer.firstElementChild);
  }
  var g=document.createElement('span');
  g.className='fx fx-glass';
  g.style.left=x+'px'; g.style.top=y+'px';
  fxLayer.appendChild(g);
  var r=document.createElement('span');
  r.className='fx fx-ring';
  r.style.left=x+'px'; r.style.top=y+'px';
  r.style.animationDelay='0.05s';
  fxLayer.appendChild(r);
  var r2=document.createElement('span');
  r2.className='fx fx-ring r2';
  r2.style.left=x+'px'; r2.style.top=y+'px';
  r2.style.animationDelay='0.1s';
  fxLayer.appendChild(r2);
  g.addEventListener('animationend',function(){ if(g.parentNode) g.parentNode.removeChild(g); });
  r.addEventListener('animationend',function(){ if(r.parentNode) r.parentNode.removeChild(r); });
  r2.addEventListener('animationend',function(){ if(r2.parentNode) r2.parentNode.removeChild(r2); });
}
function bindTouchFx(viewEl){
  viewEl.addEventListener('click',function(e){
    fxRipple(e.clientX,e.clientY);
  });
}

/* ================= CHAPTER SWITCHER (slide L/R + 情话) ================= */
var featured=null;
var eyebrowLine=document.querySelector('.eyebrow .ent-line');
var ledeEl=document.querySelector('p.lede');
var copyEl=document.querySelector('.copy');
var btnL=document.querySelector('.label-l');
var btnR=document.querySelector('.label-r');
var tOut=null,tIn=null;

function slotLabels(){
  var i=ORDER.indexOf(featured);
  return {
    l:ORDER[(i+ORDER.length-1)%ORDER.length],
    r:ORDER[(i+1)%ORDER.length]
  };
}
function animOK(){
  return !Scene.reduced && !document.documentElement.classList.contains('anim');
}
function setLabel(btn,id,side){
  var d=DATA[id];
  btn.querySelector('.lno').textContent=d.no;
  btn.querySelector('.lnm').textContent=' '+d.name;
  btn.setAttribute('aria-label',(side==='l'?'上一章：':'下一章：')+d.name);
}
function applyInstant(next){
  var d=DATA[next];
  eyebrowLine.textContent=d.no+' · '+d.name;
  ledeEl.innerHTML=d.lines;
  var sp=slotLabels();
  setLabel(btnL,sp.l,'l');
  setLabel(btnR,sp.r,'r');
  Scene.feature(next);
}
function clearSwap(){
  if(tOut) clearTimeout(tOut);
  if(tIn) clearTimeout(tIn);
  tOut=tIn=null;
  copyEl.classList.remove('hold','swap-f','swap-b');
}
function show(next,dir){
  if(!DATA[next]) return;
  if(next===featured) return;
  var fIdx=ORDER.indexOf(featured), nIdx=ORDER.indexOf(next);
  var d=dir||(nIdx>fIdx?'fwd':'back');
  featured=next;
  if(!animOK()){ applyInstant(next); return; }
  clearSwap();
  copyEl.classList.add(d==='fwd'?'swap-f':'swap-b');
  tOut=setTimeout(function(){
    applyInstant(next);
    copyEl.classList.add('hold');
    tIn=setTimeout(function(){ copyEl.classList.remove('hold','swap-f','swap-b'); },330);
  },240);
}
function step(dir){
  var i=ORDER.indexOf(featured);
  show(ORDER[(i+dir+ORDER.length)%ORDER.length],dir>0?'fwd':'back');
}
btnL.addEventListener('click',function(){ step(-1); });
btnR.addEventListener('click',function(){ step(1); });
Scene.setRingClickHandler(function(id,dir){ show(id,dir); });
Scene.setSwipeHandler(function(dir){
  if(currentView!=='hero') return;      /* 只在训练页翻章，避免误触 */
  step(dir);
});
/* 手机：在非画布区域（标题 / 文案 / 按键上）也能左右滑动翻章 */
(function(){
  var st=document.querySelector('.stage');
  if(!st) return;
  var sx=0,sy=0,s0=0,tracking=false;
  st.addEventListener('touchstart',function(e){
    tracking=false;
    if(e.touches.length!==1||currentView!=='hero') return;
    if(e.target&&(e.target.id==='scene'||e.target.closest('.tabbar,.sheet,.modal'))) return;
    tracking=true; sx=e.touches[0].clientX; sy=e.touches[0].clientY; s0=Date.now();
  },{passive:true});
  st.addEventListener('touchend',function(e){
    if(!tracking) return;
    tracking=false;
    var t=e.changedTouches&&e.changedTouches[0];
    if(!t||Date.now()-s0>900) return;
    var dx=t.clientX-sx, dy=t.clientY-sy;
    if(Math.abs(dx)>56&&Math.abs(dx)>Math.abs(dy)*1.4) step(dx<0?1:-1);
  },{passive:true});
  st.addEventListener('touchcancel',function(){ tracking=false; },{passive:true});
})();
featured='preface';
applyInstant('preface');

/* ================= VIEWS & "我的" PANEL ================= */
var stageEl=document.querySelector('.stage');
var viewPractice=document.getElementById('view-practice');
var viewMine=document.getElementById('view-mine');
bindTouchFx(viewMine);
var currentView='hero';
var navAll=document.querySelectorAll('.links a');

function setView(v){
  currentView=v;
  var isMine=v==='mine', isProg=v==='progress', isSug=v==='suggest',
      isCharts=v==='charts', isMk=v==='mistakes', isQa=v==='qa', isPractice=v==='practice';
  stageEl.classList.toggle('is-mine',isMine);
  stageEl.classList.toggle('is-progress',isProg);
  stageEl.classList.toggle('is-suggest',isSug);
  stageEl.classList.toggle('is-charts',isCharts);
  stageEl.classList.toggle('is-mistakes',isMk);
  stageEl.classList.toggle('is-qa',isQa);
  stageEl.classList.toggle('is-practice',isPractice);
  viewPractice.classList.toggle('is-open',isPractice);
  viewPractice.setAttribute('aria-hidden',isPractice?'false':'true');
  viewMine.classList.toggle('is-open',isMine);
  viewMine.setAttribute('aria-hidden',isMine?'false':'true');
  viewProgress.classList.toggle('is-open',isProg);
  viewProgress.setAttribute('aria-hidden',isProg?'false':'true');
  viewSuggest.classList.toggle('is-open',isSug);
  viewSuggest.setAttribute('aria-hidden',isSug?'false':'true');
  viewCharts.classList.toggle('is-open',isCharts);
  viewCharts.setAttribute('aria-hidden',isCharts?'false':'true');
  viewMistakes.classList.toggle('is-open',isMk);
  viewMistakes.setAttribute('aria-hidden',isMk?'false':'true');
  viewQa.classList.toggle('is-open',isQa);
  viewQa.setAttribute('aria-hidden',isQa?'false':'true');
  if(isProg){ progRender(); lpLoad(); }
  if(isMine) renderMine();
  if(isSug){ sugRender(); dmnkStart(); }
  else{ dmnkStop(); }
  if(isCharts) chRender();
  if(isMk) mkLoadFromServer();
  if(isQa) qaInit();
  var openedView=isMine?viewMine:(isProg?viewProgress:(isSug?viewSuggest:
                  (isCharts?viewCharts:(isMk?viewMistakes:(isQa?viewQa:null)))));
  if(isPractice){ openedView=viewPractice; if(!prState.started) prLoad('cpp'); }
  if(openedView&&openedView.scrollTop) openedView.scrollTop=0;
  for(var i=0;i<navAll.length;i++){
    var l=navAll[i];
    if(l.getAttribute('data-view')===v) l.setAttribute('aria-current','page');
    else l.removeAttribute('aria-current');
  }
  if(typeof syncTabs==='function') syncTabs();
  if(typeof closeSheet==='function') closeSheet();
  try{ if(location.hash!=='#'+v) history.replaceState(null,'','#'+v); }catch(e){}
}
function handleNav(l){
  setNav(false);
  var v=l.getAttribute('data-view');
  if(v==='hero') setView('hero');
  else if(v==='mine') setView('mine');
  else if(v==='progress') setView('progress');
  else if(v==='suggest') setView('suggest');
  else if(v==='charts') setView('charts');
  else if(v==='mistakes') setView('mistakes');
  else if(v==='qa') setView('qa');
  else toast('「'+l.textContent.trim()+'」正在建设中，敬请期待');
}

/* ---- toast ---- */
var toastEl=document.getElementById('toast');
var toastT=null;
function toast(msg){
  toastEl.textContent=msg;
  toastEl.classList.add('is-on');
  clearTimeout(toastT);
  toastT=setTimeout(function(){ toastEl.classList.remove('is-on'); },2400);
}

/* ---- auth ---- */
var USERS_KEY='mzx_users', SESS_KEY='mzx_session';
var authMode='login', currentUser=null;
var DAYS={d2:2,d4:4,d7:7,d21:21};
function progDoneSafe(){
  return (typeof progState!=='undefined'&&progState)?progTotalDone():0;
}
var authBox=document.getElementById('auth-box');
var profileBox=document.getElementById('profile-box');
var btnLogout=document.getElementById('btn-logout');
var authForm=document.getElementById('auth-form');
var userInput=document.getElementById('auth-user');
var passInput=document.getElementById('auth-pass');
var pass2Input=document.getElementById('auth-pass2');
var fieldPass2=document.getElementById('field-pass2');
var submitBtn=document.getElementById('auth-submit');
var authTabs=document.querySelectorAll('.auth-tab');
var pnameEl=document.getElementById('pname');
var avatarImg=document.getElementById('avatar-img');

function getUsers(){ try{ var users=JSON.parse(localStorage.getItem(USERS_KEY)||'{}');Object.values(users).forEach(function(u){delete u.pass;});return users;}catch(e){return {};} }
function setUsers(u){
  Object.values(u).forEach(function(rec){delete rec.pass;});
  try{ localStorage.setItem(USERS_KEY,JSON.stringify(u)); return true; }
  catch(e){ return false; }
}
function findUser(name){
  var users=getUsers();
  var keys=Object.keys(users);
  for(var i=0;i<keys.length;i++){
    if(keys[i].toLowerCase()===String(name).toLowerCase()) return users[keys[i]];
  }
  return null;
}
function ptsKey(n){ return 'mzx_pts_'+n; }
function claimKey(n){ return 'mzx_claim_'+n; }
function getPoints(n){ return parseInt(localStorage.getItem(ptsKey(n))||'0',10)||0; }
function setPoints(n,v){ localStorage.setItem(ptsKey(n),String(v)); }
function getClaims(n){ try{ return JSON.parse(localStorage.getItem(claimKey(n))||'{}'); }catch(e){ return {}; } }
function setClaims(n,c){ localStorage.setItem(claimKey(n),JSON.stringify(c)); }

function makeAvatar(name){
  var ch=String(name||'码').trim().charAt(0).replace(/[<>&"']/g,'');
  var svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">'+
    '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">'+
    '<stop offset="0" stop-color="#3fc3f0"/><stop offset="1" stop-color="#1b4fd0"/></linearGradient></defs>'+
    '<circle cx="48" cy="48" r="48" fill="url(#g)"/>'+
    '<text x="48" y="61" font-size="38" text-anchor="middle" class="cf" font-family="Noto Serif SC, SimSun, serif">'+ch+'</text></svg>';
  return 'data:image/svg+xml,'+encodeURIComponent(svg);
}
function enterUser(name){
  currentUser=name;
  lpIdentityChanged();
  localStorage.setItem(SESS_KEY,name);
  var rec=findUser(name);
  pnameEl.textContent=name;
  avatarImg.src=(rec&&rec.avatar&&/^data:image\//.test(rec.avatar))?rec.avatar:makeAvatar(name);
  var sig=(rec&&rec.signature)?rec.signature:'';
  psigEl.textContent=sig||'点击 ✎ 写下你的个性签名';
  psigEl.classList.toggle('empty',!sig);
  authBox.hidden=true; profileBox.hidden=false; btnLogout.hidden=false;
  renderMine();
}
function exitUser(){
  currentUser=null;
  lpIdentityChanged();
  localStorage.removeItem(SESS_KEY);
  authBox.hidden=false; profileBox.hidden=true; btnLogout.hidden=true;
  renderMine();
}
function switchMode(m){
  authMode=m;
  for(var i=0;i<authTabs.length;i++){
    authTabs[i].classList.toggle('is-on',authTabs[i].getAttribute('data-mode')===m);
  }
  fieldPass2.hidden=(m!=='register');
  submitBtn.textContent=m==='register'?'注 册':'登 录';
}
for(var ti=0;ti<authTabs.length;ti++){
  (function(tb){ tb.addEventListener('click',function(){ switchMode(tb.getAttribute('data-mode')); }); })(authTabs[ti]);
}
// Profiles retain cosmetic settings locally; passwords and identity live on the server.
setUsers(getUsers());
async function restoreServerSession(){
  try{var session=await accountRequest('me');
    if(session.authenticated){var users=getUsers();if(!users[session.username]){users[session.username]={name:session.username,items:{}};setUsers(users);}enterUser(session.username);}
    else exitUser();
  }catch(e){exitUser();}finally{window.finishSessionRestore();}
}
authForm.addEventListener('submit',async function(e){
  e.preventDefault();if(submitBtn.disabled)return;
  var name=userInput.value.trim(),pass=passInput.value;
  if(!name){toast('请填写用户名');return;}
  if(pass.length<8){toast('密码至少8位；旧本机账号请重新注册服务端账号');return;}
  if(authMode==='register'&&pass!==pass2Input.value){toast('两次输入的密码不一致');return;}
  submitBtn.disabled=true;
  try{
    var result=await accountRequest(authMode==='register'?'register':'login',{username:name,password:pass});
    var users=getUsers();if(!users[result.username])users[result.username]={name:result.username,created:Date.now(),avatar:null,signature:'',items:{},frame:null};
    setUsers(users);enterUser(result.username);authForm.reset();toast('登录成功，学习数据由服务端保存');
  }catch(e){toast(e.message||'无法连接账号服务');}
  finally{submitBtn.disabled=false;}
});
var logoutModal=document.getElementById('logout-modal');
var logoutCancel=document.getElementById('logout-cancel');
var logoutOk=document.getElementById('logout-ok');
function openLogout(){ logoutModal.classList.add('is-open'); logoutModal.setAttribute('aria-hidden','false'); }
function closeLogout(){ logoutModal.classList.remove('is-open'); logoutModal.setAttribute('aria-hidden','true'); }
btnLogout.addEventListener('click',openLogout);
logoutCancel.addEventListener('click',closeLogout);
logoutOk.addEventListener('click',async function(){
  try{await accountRequest('logout',{});closeLogout();exitUser();toast('已退出登录');}catch(e){toast('退出失败，请检查后端后重试');}
});
logoutModal.addEventListener('click',function(e){
  if(e.target===logoutModal) closeLogout();
});

/* ---- 自定义头像（可选 ≤10MB 的图片，保存前自动压缩，避免撑爆本地存储） ---- */
var avModal=document.getElementById('av-modal');
var avFile=document.getElementById('av-file');
var avPreview=document.getElementById('av-preview');
var avHint=document.getElementById('av-hint');
var psigEl=document.getElementById('psig');
var pendingAvatar=null;
var AV_MAX_BYTES=10*1024*1024;  /* 用户可选的最大文件：10MB */
var AV_MAX_PX=512;              /* 存进 localStorage 前等比缩到 512 以内（头像最大显示约 96px） */
var AV_KEEP_BYTES=260*1024;     /* 又小又不大时原样保留（保住 PNG 透明与动图首帧） */
var AV_MAX_STORE=420*1024;      /* PNG 压缩结果超过这个体积就改用 JPEG */
function avKB(n){ return Math.max(1,Math.round(n/1024))+'KB'; }
function avDataKB(dataUrl){ return dataUrl?avKB(String(dataUrl).length*3/4):'0KB'; }
function avPreviewHtml(src){
  avPreview.innerHTML=src
    ?'<img src="'+src+'" alt="头像预览">'
    :'<span style="color:rgba(255,255,255,.4)">默认</span>';
}
function avSetHint(t){ if(avHint) avHint.textContent=t||'支持 JPG / PNG / GIF / WebP，单张不超过 10MB；过大的图会自动压缩后再保存'; }
/* 等比缩放到 512 以内；PNG/GIF 先保透明，体积过大再退回 JPEG */
function avShrink(img,orig){
  try{
    var w=img.naturalWidth||img.width, h=img.naturalHeight||img.height;
    if(!w||!h) return orig;
    var scale=Math.min(1,AV_MAX_PX/Math.max(w,h));
    var cw=Math.max(1,Math.round(w*scale)), ch=Math.max(1,Math.round(h*scale));
    var cv=document.createElement('canvas');
    cv.width=cw; cv.height=ch;
    var cx=cv.getContext&&cv.getContext('2d');
    if(!cx||!cv.toDataURL) return orig;
    var keepAlpha=/^data:image\/(png|gif|webp)/i.test(orig);
    if(!keepAlpha){ cx.fillStyle='#ffffff'; cx.fillRect(0,0,cw,ch); }
    cx.drawImage(img,0,0,cw,ch);
    var out=cv.toDataURL(keepAlpha?'image/png':'image/jpeg',.88);
    if(keepAlpha&&out.length>AV_MAX_STORE){
      cx.fillStyle='#ffffff'; cx.fillRect(0,0,cw,ch); cx.drawImage(img,0,0,cw,ch);
      out=cv.toDataURL('image/jpeg',.88);
    }
    if(!out||out.length>=orig.length) return orig;
    return out;
  }catch(e){ return orig; }
}
function avOpen(){
  if(!currentUser) return;
  var rec=findUser(currentUser);
  pendingAvatar=(rec&&rec.avatar&&/^data:image\//.test(rec.avatar))?rec.avatar:null;
  avPreviewHtml(pendingAvatar);
  avSetHint('');
  if(avFile) avFile.value='';
  avModal.classList.add('is-open');
  avModal.setAttribute('aria-hidden','false');
}
function avClose(){
  avModal.classList.remove('is-open');
  avModal.setAttribute('aria-hidden','true');
}
avatarImg.addEventListener('click',avOpen);
avFile.addEventListener('change',function(){
  var f=avFile.files&&avFile.files[0];
  if(!f) return;
  if(!/^image\//.test(f.type)){ toast('请选择图片文件（JPG / PNG / GIF / WebP）'); avFile.value=''; return; }
  if(f.size>AV_MAX_BYTES){
    toast('图片不能超过 10MB（当前 '+(f.size/1048576).toFixed(1)+'MB）');
    avFile.value='';
    return;
  }
  avSetHint('正在读取图片…');
  var rd=new FileReader();
  rd.onerror=function(){ toast('图片读取失败，换一张试试'); avSetHint(''); };
  rd.onload=function(){
    var raw=String(rd.result);
    var img=new Image();
    img.onerror=function(){ toast('这个图片浏览器无法解析，换一张试试'); avSetHint(''); };
    img.onload=function(){
      var small=Math.max(img.naturalWidth||img.width,img.naturalHeight||img.height)<=AV_MAX_PX
                &&raw.length<=AV_KEEP_BYTES;
      var out=small?raw:avShrink(img,raw);
      pendingAvatar=out;
      avPreviewHtml(out);
      avSetHint('已载入 '+(img.naturalWidth||img.width)+'×'+(img.naturalHeight||img.height)
        +' · 原图 '+avKB(f.size)+' → 保存体积约 '+avDataKB(out)+'，点「保 存」生效');
      toast(out===raw?('图片已载入（'+avKB(f.size)+'），点击保存生效')
                     :('已自动压缩到 512px 以内（约 '+avDataKB(out)+'），点击保存生效'));
    };
    img.src=raw;
  };
  rd.readAsDataURL(f);
});
document.getElementById('av-reset').addEventListener('click',function(){
  pendingAvatar=null;
  avPreviewHtml(null);
  avSetHint('已恢复默认头像，点「保 存」生效');
});
document.getElementById('av-save').addEventListener('click',function(){
  if(!currentUser) return;
  var users=getUsers();
  var rec=users[currentUser];
  if(!rec){ toast('账号数据异常，请重新登录'); avClose(); return; }
  rec.avatar=pendingAvatar||null;
  if(!setUsers(users)){
    toast('浏览器本地存储空间不足，头像未保存（换一张更小的图片试试）');
    return;
  }
  avatarImg.src=rec.avatar?rec.avatar:makeAvatar(currentUser);
  toast('头像已更新');
  avClose();
});
avModal.addEventListener('click',function(e){ if(e.target===avModal) avClose(); });

/* ---- 修改用户名（≤10 字符、不可重名；积分/签到/签名/社区帖子一起迁移） ---- */
var USERNAME_MAX=10;
var nameModal=document.getElementById('name-modal');
var nameInput=document.getElementById('name-input');
var nameHint=document.getElementById('name-hint');
var nameEditBtn=document.getElementById('pname-edit');
var NAME_HINT_DEFAULT='账号名用于识别学习记录，暂不支持修改；可编辑个性签名。';
var PERUSER_KEYS=['mzx_pts_','mzx_claim_','mzx_ledger_','mzx_sign_','mzx_streak_','mzx_study_'];
function nameHintSet(t){ if(nameHint) nameHint.textContent=t||NAME_HINT_DEFAULT; }
function openNameModal(){
  if(!currentUser){ toast('请先登录'); return; }
  nameInput.value=currentUser;
  nameHintSet('');
  nameModal.classList.add('is-open');
  nameModal.setAttribute('aria-hidden','false');
  try{ nameInput.focus(); nameInput.setSelectionRange(0,nameInput.value.length); }catch(e){}
}
function closeNameModal(){
  nameModal.classList.remove('is-open');
  nameModal.setAttribute('aria-hidden','true');
}
/* 改名：users 主键 → 会话 → 各 per-user 键 → 小社区里的作者/点赞/@ */
function renameUser(from,to){return {ok:false,msg:'账号名用于识别学习记录，暂不支持修改；可修改个性签名。'};}

if(nameEditBtn) nameEditBtn.addEventListener('click',openNameModal);
document.getElementById('name-cancel').addEventListener('click',closeNameModal);
nameModal.addEventListener('click',function(e){ if(e.target===nameModal) closeNameModal(); });
nameInput.addEventListener('input',function(){
  var n=nameInput.value.trim().length;
  nameHintSet(n>USERNAME_MAX?('已超出 '+USERNAME_MAX+' 个字符（当前 '+n+' 个）'):NAME_HINT_DEFAULT);
});
nameInput.addEventListener('keydown',function(e){
  if(e.key==='Enter'){ e.preventDefault(); document.getElementById('name-save').click(); }
});
document.getElementById('name-save').addEventListener('click',function(){
  if(!currentUser){ toast('请先登录'); return; }
  var to=nameInput.value.replace(/\s+/g,' ').trim();
  if(!to){ toast('用户名不能为空'); return; }
  if(to.length>USERNAME_MAX){ toast('用户名不能超过 '+USERNAME_MAX+' 个字符'); return; }
  if(to===currentUser){ toast('用户名没有变化'); closeNameModal(); return; }
  var from=currentUser;
  var r=renameUser(from,to);
  if(!r.ok){ toast(r.msg); return; }
  var rec=findUser(to);
  pnameEl.textContent=to;
  avatarImg.src=(rec&&rec.avatar&&/^data:image\//.test(rec.avatar))?rec.avatar:makeAvatar(to);
  closeNameModal();
  renderMine();
  if(typeof sugRender==='function') sugRender();
  toast('用户名已由「'+from+'」改为「'+to+'」');
});

/* ---- 个性签名 ---- */
var sigModal=document.getElementById('sig-modal');
var sigInput=document.getElementById('sig-input');
var sigN=document.getElementById('sig-n');
function sigOpen(){
  if(!currentUser) return;
  var rec=findUser(currentUser);
  sigInput.value=(rec&&rec.signature)?rec.signature:'';
  sigN.textContent=String(sigInput.value.length);
  sigModal.classList.add('is-open');
  sigModal.setAttribute('aria-hidden','false');
  sigInput.focus();
}
function sigClose(){
  sigModal.classList.remove('is-open');
  sigModal.setAttribute('aria-hidden','true');
}
document.getElementById('psig-edit').addEventListener('click',sigOpen);
document.getElementById('sig-cancel').addEventListener('click',sigClose);
sigModal.addEventListener('click',function(e){ if(e.target===sigModal) sigClose(); });
sigInput.addEventListener('input',function(){
  var v=sigInput.value;
  if(v.length>60){ v=v.slice(0,60); sigInput.value=v; }
  sigN.textContent=String(v.length);
});
document.getElementById('sig-save').addEventListener('click',function(){
  if(!currentUser) return;
  var v=sigInput.value.trim();
  if(v.length>60){ toast('个性签名不能超过 60 字'); return; }
  var users=getUsers();
  var rec=users[currentUser];
  if(rec){
    rec.signature=v;
    setUsers(users);
    psigEl.textContent=v||'点击 ✎ 写下你的个性签名';
    psigEl.classList.toggle('empty',!v);
    toast(v?'个性签名已保存':'个性签名已清空');
  }
  sigClose();
});

/* ---- rewards ---- */
var PTS={d2:2,d4:5,d7:8,d21:12};
var pointsEl=document.getElementById('points');
var rewardBtns=document.querySelectorAll('.ri-btn[data-key]');
function refreshRewards(){
  var streak=streakNow();
  var done=progDoneSafe();
  if(!currentUser){
    pointsEl.textContent='0';
    for(var i=0;i<rewardBtns.length;i++){
      rewardBtns[i].textContent='领取';
      rewardBtns[i].disabled=false;
      rewardBtns[i].setAttribute('title','');
    }
    btnInvite.textContent='邀请';
    btnInvite.setAttribute('title','');
    return;
  }
  pointsEl.textContent=String(getPoints(currentUser));
  var cl=getClaims(currentUser);
  for(var j=0;j<rewardBtns.length;j++){
    var b=rewardBtns[j], k=b.getAttribute('data-key');
    if(cl[k]){
      b.textContent='已领取';
      b.disabled=true;
      b.setAttribute('title','已领取');
    }else if(streak<DAYS[k]){
      b.textContent='未达标';
      b.disabled=false;
      b.setAttribute('title','需连续学习 '+DAYS[k]+' 天（当前 '+streak+' 天，每天学习满 10 分钟）');
    }else{
      b.textContent='领取';
      b.disabled=false;
      b.setAttribute('title','点击领取 '+PTS[k]+' 积分');
    }
  }
  if(done<1){
    btnInvite.textContent='未达标';
    btnInvite.setAttribute('title','需完成至少 1 个学习任务（当前 '+done+' 个）');
  }else{
    btnInvite.textContent='邀请';
    btnInvite.setAttribute('title','邀请好友 +6 积分');
  }
}
for(var bi=0;bi<rewardBtns.length;bi++){
  (function(b){
    b.addEventListener('click',function(){ claimReward(b.getAttribute('data-key')); });
  })(rewardBtns[bi]);
}
function claimReward(key){
  if(!currentUser){ toast('请先登录，再领取积分奖励'); return; }
  var streak=streakNow();
  if(streak<DAYS[key]){
    toast('需连续学习 '+DAYS[key]+' 天才能领取（当前 '+streak+' 天，每天学习满 10 分钟）');
    return;
  }
  var cl=getClaims(currentUser);
  if(cl[key]){ toast('该奖励已经领取过啦'); return; }
  cl[key]=true;
  setClaims(currentUser,cl);
  var pts=getPoints(currentUser)+PTS[key];
  setPoints(currentUser,pts);
  pointsEl.textContent=String(pts);
  ledger(currentUser,PTS[key],'奖励领取 · '+PTS[key]+' 积分');
  refreshRewards();
  toast('领取成功 +'+PTS[key]+' 积分');
}

/* ---- invite ---- */
var btnInvite=document.getElementById('btn-invite');
var inviteOut=document.getElementById('invite-out');
var inviteLink=document.getElementById('invite-link');
var inviteCopy=document.getElementById('invite-copy');
btnInvite.addEventListener('click',function(){
  if(!currentUser){ toast('请先登录，再邀请好友'); return; }
  if(progDoneSafe()<1){ toast('完成至少 1 个学习任务后才能邀请好友'); return; }
  var code='MZX-'+Math.random().toString(36).slice(2,8).toUpperCase();
  inviteLink.value='https://mazhixin.example.com/i/'+code;
  inviteOut.hidden=false;
  var cl=getClaims(currentUser);
  if(!cl['invite']){
    cl['invite']=true;
    setClaims(currentUser,cl);
    var pts=getPoints(currentUser)+6;
    setPoints(currentUser,pts);
    pointsEl.textContent=String(pts);
    ledger(currentUser,6,'邀请好友奖励');
    updatePointsUI();
    toast('邀请成功 +6 积分，链接已生成');
  }else{
    toast('邀请链接已更新');
  }
});
inviteCopy.addEventListener('click',function(){
  function fallback(){
    inviteLink.focus(); inviteLink.select();
    var ok=false;
    try{ ok=document.execCommand('copy'); }catch(e){}
    toast(ok?'邀请链接已复制':'复制失败，请手动复制');
  }
  if(navigator.clipboard&&navigator.clipboard.writeText){
    navigator.clipboard.writeText(inviteLink.value).then(function(){
      toast('邀请链接已复制');
    },fallback);
  }else{
    fallback();
  }
});

/* ---- about modal ---- */
var ABOUT={
  about:{title:'关于我们',
    body:'<p>「码上知新」是一款面向数据结构学习者的训练平台。我们把《数据结构》全书的十一章内容做成水面上的涟漪圆环，配上会流动的代码树与缓缓坠落的 0 和 1，让每一次学习都像在湖边散步。</p><p>在这里，你可以按章节打卡训练、领取积分奖励、邀请好友一起学习。温故而知新——愿你在码上，遇见更好的自己。</p>'},
  terms:{title:'用户协议',
    body:'<p>1. 用户应保证注册信息真实有效，并妥善保管账号与密码。</p><p>2. 本平台的训练内容仅供学习交流使用，未经许可请勿用于商业用途。</p><p>3. 积分与奖励仅限平台内使用，最终解释权归「码上知新」所有。</p>'},
  privacy:{title:'隐私政策',
    body:'<p>1. 账号密码哈希、答题记录和错题保存在运行后端的电脑中；头像、签名、签到和演示社区保存在浏览器。未登录的guest为共享演示身份，请勿保存私人资料。</p><p>2. 使用AI答疑或辅导时，问题、所选答案及相关课程资料会发送给所配置的模型服务商；请勿输入个人敏感信息。密码不会发送给模型。</p><p>3. 清理浏览器不会删除后端学习记录。如需清除服务端数据，请联系项目维护者；退出登录会撤销当前会话。</p>'}
};
var aboutModal=document.getElementById('about-modal');
var aboutTitle=document.getElementById('about-title');
var aboutBody=document.getElementById('about-body');
var aboutClose=document.getElementById('about-close');
var aboutBtns=document.querySelectorAll('.about-item');
function openAbout(key){
  var a=ABOUT[key];
  aboutTitle.textContent=a.title;
  aboutBody.innerHTML=a.body;
  aboutModal.classList.add('is-open');
  aboutModal.setAttribute('aria-hidden','false');
}
function closeAbout(){
  aboutModal.classList.remove('is-open');
  aboutModal.setAttribute('aria-hidden','true');
}
for(var ai=0;ai<aboutBtns.length;ai++){
  (function(b){ b.addEventListener('click',function(){ openAbout(b.getAttribute('data-about')); }); })(aboutBtns[ai]);
}
aboutClose.addEventListener('click',closeAbout);
aboutModal.addEventListener('click',function(e){
  if(e.target===aboutModal) closeAbout();
});

/* ---- 每日签到 / 有效学习 / 积分兑换 ---- */
var signRowEl=document.getElementById('sign-row');
var studyRowEl=document.getElementById('study-row');
var shopEl=document.getElementById('shop');
var points2El=document.getElementById('points2');
var ledgerOpenBtn=document.getElementById('ledger-open');
var ledgerModal=document.getElementById('ledger-modal');
var ledgerListEl=document.getElementById('ledger-list');
var ledgerTotalEl=document.getElementById('ledger-total');
var avatarEl=document.querySelector('.profile .avatar');
function mAddDays(str,n){
  var p=str.split('-');
  var d=new Date(+p[0],+p[1]-1,+p[2]);
  d.setDate(d.getDate()+n);
  var m=d.getMonth()+1, dd=d.getDate();
  return d.getFullYear()+'-'+(m<10?'0'+m:m)+'-'+(dd<10?'0'+dd:dd);
}
function ledger(name,delta,reason){
  var k='mzx_ledger_'+name;
  var l=[];
  try{ l=JSON.parse(localStorage.getItem(k)||'[]'); }catch(e){}
  l.unshift({t:Date.now(),d:delta,r:reason});
  if(l.length>60) l.length=60;
  try{ localStorage.setItem(k,JSON.stringify(l)); }catch(e){}
}
/* 签到 */
function signKey(){ return 'mzx_sign_'+currentUser; }
function getSignData(){
  var s=null;
  try{ s=JSON.parse(localStorage.getItem(signKey())||'null'); }catch(e){}
  if(!s||!s.dates) s={dates:{}};
  return s;
}
function setSignData(s){ try{ localStorage.setItem(signKey(),JSON.stringify(s)); }catch(e){} }
function latestSign(s){
  var keys=Object.keys(s.dates).sort();
  return keys.length?keys[keys.length-1]:null;
}
function signStreak(s){
  var last=latestSign(s);
  if(!last) return 0;
  if(last!==mToday(0)&&last!==mToday(1)) return 0;
  var n=0,cur=last;
  while(s.dates[cur]){ n++; cur=mAddDays(cur,-1); }
  return n;
}
function renderSign(){
  if(!currentUser){
    signRowEl.innerHTML='<div class="sign-info"><span class="sign-title">📅 每日签到</span></div><span style="color:rgba(255,255,255,.5);font-size:calc(13 * var(--u))">登录后每天签到 +1 积分</span>';
    return;
  }
  var s=getSignData();
  var today=mToday(0);
  var signed=!!s.dates[today];
  var streak=signStreak(s);
  var last=latestSign(s);
  var canMakeup=!!last&&last!==today&&mAddDays(last,1)!==today;
  var dots='<div class="sign-dots">';
  for(var i=6;i>=0;i--){
    var d=mAddDays(today,-i);
    var on=s.dates[d];
    dots+='<span class="sign-dot'+(on?' on':'')+(i===0?' today':'')+'" title="'+d+'">'+(on?'✓':'')+'</span>';
  }
  dots+='</div>';
  var btns='<div class="sign-btns">';
  btns+=signed
    ?'<button class="sign-btn" type="button" disabled>已签到 ✓</button>'
    :'<button class="sign-btn" type="button" data-sign="sign">签到 +1</button>';
  if(canMakeup){
    btns+='<button class="sign-btn makeup" type="button" data-sign="makeup">补签 -3</button>';
  }
  btns+='</div>';
  signRowEl.innerHTML='<div class="sign-info"><span class="sign-title">📅 每日签到</span>'+
    '<span class="sign-streak">连续签到 <b>'+streak+'</b> 天</span></div>'+dots+btns;
}
function doSign(){
  if(!currentUser){ toast('请先登录'); return; }
  var s=getSignData();
  var today=mToday(0);
  if(s.dates[today]){ toast('今天已经签到过啦'); return; }
  s.dates[today]=true;
  setSignData(s);
  setPoints(currentUser,getPoints(currentUser)+1);
  ledger(currentUser,1,'每日签到');
  renderMine();
  toast('签到成功 +1 积分 · 连续签到 '+signStreak(getSignData())+' 天');
}
function doMakeup(){
  if(!currentUser){ toast('请先登录'); return; }
  var s=getSignData();
  var last=latestSign(s);
  if(!last){ toast('还没有签到记录，无需补签'); return; }
  var next=mAddDays(last,1);
  if(next===mToday(0)){ toast('今天可直接签到，无需补签'); return; }
  if(getPoints(currentUser)<3){ toast('积分不足，补签需要 3 积分'); return; }
  setPoints(currentUser,getPoints(currentUser)-3);
  s.dates[next]=true;
  setSignData(s);
  ledger(currentUser,-3,'补签 '+next);
  renderMine();
  toast('补签成功（'+next+'）-3 积分');
}
signRowEl.addEventListener('click',function(e){
  var b=e.target.closest('[data-sign]');
  if(!b) return;
  if(b.getAttribute('data-sign')==='sign') doSign();
  else doMakeup();
});
/* 有效学习（每天 ≥10 分钟） */
function streakKey(){ return 'mzx_streak_'+currentUser; }
function getStreak(){
  var s=null;
  try{ s=JSON.parse(localStorage.getItem(streakKey())||'null'); }catch(e){}
  return s||{last:null,n:0};
}
function setStreak(s){ try{ localStorage.setItem(streakKey(),JSON.stringify(s)); }catch(e){} }
function streakNow(){
  if(!currentUser) return 0;
  var st=getStreak();
  if(!st.last) return 0;
  if(st.last===mToday(0)||st.last===mToday(1)) return st.n;
  return 0;
}
function markStudyDay(){
  var today=mToday(0);
  var st=getStreak();
  if(st.last===today) return;
  if(st.last===mToday(1)) st.n++;
  else st.n=1;
  st.last=today;
  setStreak(st);
}
function getStudy(){
  var k='mzx_study_'+currentUser;
  var s=null;
  try{ s=JSON.parse(localStorage.getItem(k)||'null'); }catch(e){}
  if(!s||s.date!==mToday(0)) return {sec:0};
  return s;
}
function renderStudy(){
  if(!currentUser){
    studyRowEl.innerHTML='<span class="study-label">🔥 有效学习</span><span style="color:rgba(255,255,255,.5);font-size:calc(12.5 * var(--u))">每天学习满 10 分钟为有效学习 · 连续天数可领奖励</span>';
    return;
  }
  var st=getStudy();
  var min=Math.floor(st.sec/60);
  var pct=Math.min(100,st.sec/600*100);
  studyRowEl.innerHTML='<span class="study-label">🔥 连续学习 <b>'+streakNow()+'</b> 天</span>'+
    '<div class="study-bar"><i style="width:'+pct+'%"></i></div>'+
    '<span class="study-min">今日 '+min+'/10 分钟</span>';
}
var lastActive=Date.now();
function touchActive(){ lastActive=Date.now(); }
document.addEventListener('pointerdown',touchActive);
document.addEventListener('keydown',touchActive);
document.addEventListener('scroll',touchActive);
setInterval(function(){
  if(!currentUser||document.hidden) return;
  if(Date.now()-lastActive>45000) return;
  var today=mToday(0);
  var k='mzx_study_'+currentUser;
  var s=null;
  try{ s=JSON.parse(localStorage.getItem(k)||'null'); }catch(e){}
  if(!s||s.date!==today){ s={date:today,sec:0,days:s&&s.days?s.days:{}}; }
  s.days=s.days||{};
  s.sec+=20;
  if(s.sec>3600) s.sec=3600;
  s.days[today]=Math.round(s.sec/60);        /* 保留每天的学习分钟数，供热力图使用 */
  if(s.sec>=600&&!s.done){
    s.done=true;
    markStudyDay();
    toast('🎉 今日有效学习 10 分钟达成');
    if(viewMine.classList.contains('is-open')) renderMine();
  }
  try{ localStorage.setItem(k,JSON.stringify(s)); }catch(e){}
  if(viewMine.classList.contains('is-open')) renderStudy();
},20000);
/* 积分兑换商城 */
var FRAMES=[
 {id:'f1',name:'涟漪蓝环',cost:20,cls:'avf-1'},
 {id:'f2',name:'流光金边',cost:25,cls:'avf-2'},
 {id:'f3',name:'星夜紫韵',cost:30,cls:'avf-3'},
 {id:'f4',name:'翠叶之环',cost:30,cls:'avf-4'},
 {id:'f5',name:'炽焰红环',cost:35,cls:'avf-5'},
 {id:'f6',name:'极光渐变',cost:40,cls:'avf-6'},
 {id:'f7',name:'钻石棱光',cost:40,cls:'avf-7'},
 {id:'f8',name:'皇冠金耀',cost:45,cls:'avf-8'}
];
function frameById(id){
  for(var i=0;i<FRAMES.length;i++){ if(FRAMES[i].id===id) return FRAMES[i]; }
  return null;
}
function shopName(id){
  var f=frameById(id);
  if(f) return f.name;
  var n={mark:'社区发言高亮 + 积分达人标识',theme:'网页整体换肤'};
  return n[id]||id;
}
function updatePointsUI(){
  var pts=currentUser?getPoints(currentUser):0;
  pointsEl.textContent=String(pts);
  points2El.textContent=String(pts);
}
function applyFrame(){
  if(!avatarEl) return;
  avatarEl.classList.remove('avf','avf-1','avf-2','avf-3','avf-4','avf-5','avf-6','avf-7','avf-8');
  if(!currentUser) return;
  var rec=findUser(currentUser);
  if(rec&&rec.frame){
    avatarEl.classList.add('avf',rec.frame.replace(/^f/,'avf-'));
  }
}
/* 是否已领取「社区发言高亮 + 积分达人标识」 */
function hasMark(name){
  var rec=name?findUser(name):null;
  return !!(rec&&rec.items&&rec.items.mark);
}
function renderShop(){
  if(!currentUser){
    shopEl.innerHTML='<div class="shop-empty">登录后可用积分兑换头像框与特权好礼</div>';
    return;
  }
  var users=getUsers();
  var rec=users[currentUser];
  if(!rec){
    shopEl.innerHTML='<div class="shop-empty">账号数据异常，请重新登录后再试</div>';
    return;
  }
  if(!rec.items){ rec.items={}; setUsers(users); }
  var html='<div class="shop-group-title">🎭 头像框（20~45 积分）</div><div class="shop-frames">';
  for(var i=0;i<FRAMES.length;i++){
    var f=FRAMES[i];
    var owned=!!rec.items[f.id];
    var using=rec.frame===f.id;
    var ava=(rec.avatar&&/^data:image\//.test(rec.avatar))?rec.avatar:makeAvatar(currentUser);
    html+='<div class="shop-frame'+(using?' cur':'')+'">';
    html+='<div class="shop-av"><span class="avf '+f.cls+'"><img src="'+ava+'" alt=""></span></div>';
    html+='<div class="shop-fname">'+f.name+'</div>';
    html+='<div class="shop-fcost">'+(owned?'已拥有':f.cost+' 积分')+'</div>';
    html+='<button class="shop-btn'+(using?' on':'')+'" type="button" data-shop="'+f.id+'">'+(using?'使用中':(owned?'使用':'兑换'))+'</button>';
    html+='</div>';
  }
  html+='</div><div class="shop-group-title">✨ 特权兑换</div>';
  var feats=[
   {id:'mark',name:'社区发言高亮 + 积分达人标识',cost:0,
    desc:'0 积分免费领取 · 小社区里你的发言会高亮显示，昵称旁带「积分达人」标识'},
   {id:'theme',name:'网页整体换肤',cost:0,desc:'0 积分免费领取 · 永久解锁 2 套配色'}
  ];
  for(i=0;i<feats.length;i++){
    var ft=feats[i];
    var owned2=!!rec.items[ft.id];
    var btn;
    if(ft.id==='theme'){
      btn='<button class="shop-btn'+(ft.cost===0&&!owned2?' free':'')+'" type="button" data-shop="'+ft.id+'">'+
        (owned2?'换肤':(ft.cost===0?'免费领取':'兑换'))+'</button>';
    }else{
      btn=owned2
        ? '<button class="shop-btn on" type="button" disabled>已拥有</button>'
        : '<button class="shop-btn'+(ft.cost===0?' free':'')+'" type="button" data-shop="'+ft.id+'">'+
          (ft.cost===0?'免费领取':'兑换')+'</button>';
    }
    var costTxt=owned2?'':(ft.cost===0?'免费':ft.cost+' 积分');
    html+='<div class="shop-feat"><div class="sf-main"><div class="sf-name">'+ft.name+'</div><div class="sf-desc">'+ft.desc+'</div></div>'+
      '<div class="sf-cost'+(ft.cost===0?' free':'')+'">'+costTxt+'</div>'+btn+'</div>';
  }
  shopEl.innerHTML=html;
}
function buyItem(id,cost){
  var pts=getPoints(currentUser);
  if(cost>0&&pts<cost){
    toast('积分不足（需 '+cost+' 分，当前 '+pts+' 分）');
    return false;
  }
  if(cost>0){
    setPoints(currentUser,pts-cost);
    ledger(currentUser,-cost,'兑换：'+shopName(id));
    updatePointsUI();
  }
  return true;
}
function shopAction(id){
  if(!currentUser){ toast('请先登录'); return; }
  /* 注意：必须拿 getUsers() 里的同一个对象再写回，否则改动不会持久化 */
  var users=getUsers();
  var rec=users[currentUser];
  if(!rec){ toast('账号数据异常，请重新登录'); return; }
  rec.items=rec.items||{};
  if(id==='mark'){
    if(!rec.items.mark){
      if(!buyItem('mark',0)) return;
      rec.items.mark=true;
      setUsers(users);
      renderShop();
      if(typeof sugRender==='function') sugRender();
      applyVipBadge();
      toast('已免费领取「社区发言高亮 + 积分达人标识」');
      return;
    }
    toast('已经领取过了 · 去小社区看看高亮效果吧');
    return;
  }
  if(id==='theme'){
    if(!rec.items.theme){
      if(!buyItem('theme',0)) return;
      rec.items.theme=true;
      setUsers(users);
      renderShop();
      toast('免费解锁成功！请选择喜欢的配色（0 积分，永久可用）');
      openThemePicker();
      return;
    }
    renderShop();
    openThemePicker();
    return;
  }
  var f=frameById(id);
  if(f){
    if(!rec.items[id]){
      if(!buyItem(id,f.cost)) return;
      rec.items[id]=true;
      setUsers(users);
    }
    rec.frame=id;
    setUsers(users);
    applyFrame();
    renderShop();
    toast('头像框已佩戴：'+f.name);
  }
}
shopEl.addEventListener('click',function(e){
  var b=e.target.closest('[data-shop]');
  if(b) shopAction(b.getAttribute('data-shop'));
});
/* 积分明细 */
function openLedger(){
  if(!currentUser){ toast('请先登录'); return; }
  var l=[];
  try{ l=JSON.parse(localStorage.getItem('mzx_ledger_'+currentUser)||'[]'); }catch(e){}
  ledgerTotalEl.textContent='共 '+getPoints(currentUser)+' 积分';
  if(!l.length){
    ledgerListEl.innerHTML='<div style="padding:calc(20 * var(--u));text-align:center;color:rgba(255,255,255,.45)">暂无积分记录</div>';
  }else{
    var html='';
    for(var i=0;i<l.length;i++){
      var e=l[i];
      var d=new Date(e.t);
      var ts=(d.getMonth()+1)+'-'+d.getDate()+' '+(d.getHours()<10?'0':'')+d.getHours()+':'+(d.getMinutes()<10?'0':'')+d.getMinutes();
      html+='<div class="ledger-item"><span class="lt">'+ts+'</span><span class="lr">'+sugEsc(e.r)+'</span>'+
        '<span class="ld '+(e.d>=0?'plus':'minus')+'">'+(e.d>=0?'+':'')+e.d+'</span></div>';
    }
    ledgerListEl.innerHTML=html;
  }
  ledgerModal.classList.add('is-open');
  ledgerModal.setAttribute('aria-hidden','false');
}
function closeLedger(){
  ledgerModal.classList.remove('is-open');
  ledgerModal.setAttribute('aria-hidden','true');
}
ledgerOpenBtn.addEventListener('click',openLedger);
document.getElementById('ledger-close').addEventListener('click',closeLedger);
ledgerModal.addEventListener('click',function(e){ if(e.target===ledgerModal) closeLedger(); });
/* 汇总渲染 */
function renderMine(){
  renderSign();
  renderStudy();
  refreshRewards();
  renderShop();
  updatePointsUI();
  applyFrame();
  applyVipBadge();
  /* 登录/退出后同步小社区里的身份、等级与头像框（模块初始化完成后才刷新） */
  if(cmTabsEl&&typeof sugRender==='function') sugRender();
}
/* 「我的」昵称旁的积分达人标识 */
function applyVipBadge(){
  var el=document.getElementById('pname-vip');
  if(!el) return;
  el.hidden=!hasMark(currentUser);
}

/* ---- session restore ---- */
exitUser();
setTimeout(restoreServerSession,0);
window.addEventListener('mzx-session-expired',function(){exitUser();toast('登录已过期，请重新登录');});

/* ================= PROGRESS PAGE (进度) ================= */
var viewProgress=document.getElementById('view-progress');
var PROG=[
 {no:'壹',name:'绪论',weeks:'2周',difficulty:'入门',
  tasks:[
   {name:'什么是数据结构',type:'video',tag:'重点',desc:'数据、数据元素、数据对象、ADT 概念'},
   {name:'算法基础',type:'video',tag:'',desc:'算法定义、五大特性、设计要求'},
   {name:'算法分析',type:'video',tag:'重点',desc:'时间复杂度、空间复杂度、Big-O'},
   {name:'应用：最大子列和',type:'project',tag:'实战',desc:'从 O(n³) 优化到 O(n) 的四种解法'}],
  knowledge:[
   {name:'数据、数据元素、数据对象',diff:'easy'},
   {name:'抽象数据类型（ADT）',diff:'medium'},
   {name:'算法五大特性',diff:'easy'},
   {name:'时间复杂度与 Big-O 表示法',diff:'hard'},
   {name:'空间复杂度分析',diff:'medium'},
   {name:'常见复杂度量级对比',diff:'medium'}]},
 {no:'贰',name:'线性表',weeks:'3周',difficulty:'基础',
  tasks:[
   {name:'线性表定义与 ADT',type:'video',tag:'',desc:'线性表的逻辑结构与基本操作'},
   {name:'顺序存储结构',type:'video',tag:'重点',desc:'顺序表插入删除、元素移动分析'},
   {name:'单链表',type:'video',tag:'重点',desc:'头插法、尾插法、插入删除查找'},
   {name:'循环链表与双向链表',type:'video',tag:'',desc:'循环链表、双向链表、静态链表'},
   {name:'顺序表 vs 链表对比',type:'quiz',tag:'',desc:'时间空间复杂度对比与场景选择'},
   {name:'应用：多项式相加',type:'project',tag:'实战',desc:'一元多项式表示与相加'}],
  knowledge:[
   {name:'顺序表存储与地址计算',diff:'easy'},
   {name:'顺序表插入删除分析',diff:'medium'},
   {name:'单链表头插法与尾插法',diff:'medium'},
   {name:'循环链表与双向链表',diff:'medium'},
   {name:'顺序表与链表对比',diff:'hard'},
   {name:'链表反转与环检测',diff:'hard'}]},
 {no:'叁',name:'栈与队列',weeks:'2.5周',difficulty:'基础',
  tasks:[
   {name:'栈的定义与实现',type:'video',tag:'重点',desc:'LIFO 特性、顺序栈、链栈'},
   {name:'栈的应用',type:'video',tag:'重点',desc:'括号匹配、表达式求值、递归'},
   {name:'队列的定义与实现',type:'video',tag:'',desc:'FIFO 特性、循环队列、链队列'},
   {name:'队列的应用',type:'video',tag:'',desc:'BFS 基础、缓冲区、杨辉三角'},
   {name:'项目：表达式计算器',type:'project',tag:'实战',desc:'中缀转后缀并计算结果'}],
  knowledge:[
   {name:'栈的 LIFO 特性',diff:'easy'},
   {name:'顺序栈与链栈实现',diff:'medium'},
   {name:'括号匹配算法',diff:'medium'},
   {name:'中缀表达式转后缀',diff:'hard'},
   {name:'循环队列队空队满判断',diff:'hard'},
   {name:'双端队列',diff:'medium'}]},
 {no:'肆',name:'串',weeks:'1.5周',difficulty:'基础',
  tasks:[
   {name:'串的基本概念',type:'video',tag:'',desc:'串的定义、术语、ADT'},
   {name:'串的存储结构',type:'video',tag:'',desc:'定长存储、堆分配、块链'},
   {name:'BF 与 KMP 算法',type:'video',tag:'重点',desc:'暴力匹配与 KMP 优化'},
   {name:'练习：模式匹配',type:'quiz',tag:'实战',desc:'next 数组求解与 KMP 实现'}],
  knowledge:[
   {name:'串的基本术语',diff:'easy'},
   {name:'串的三种存储结构',diff:'medium'},
   {name:'BF 暴力匹配算法',diff:'easy'},
   {name:'KMP 算法核心思想',diff:'hard'},
   {name:'next 数组与 nextval 求解',diff:'hard'}]},
 {no:'伍',name:'数组与广义表',weeks:'1.5周',difficulty:'基础',
  tasks:[
   {name:'数组的存储',type:'video',tag:'',desc:'行优先、列优先、地址计算'},
   {name:'特殊矩阵压缩',type:'video',tag:'',desc:'对称、三角、对角矩阵'},
   {name:'稀疏矩阵',type:'video',tag:'重点',desc:'三元组、十字链表、快速转置'},
   {name:'广义表',type:'video',tag:'',desc:'表头表尾、深度长度、递归'}],
  knowledge:[
   {name:'数组行优先与列优先',diff:'easy'},
   {name:'数组元素地址计算',diff:'medium'},
   {name:'对称矩阵压缩存储',diff:'medium'},
   {name:'稀疏矩阵三元组表示',diff:'medium'},
   {name:'稀疏矩阵快速转置',diff:'hard'},
   {name:'广义表递归操作',diff:'hard'}]},
 {no:'陆',name:'树与二叉树',weeks:'4周',difficulty:'进阶',
  tasks:[
   {name:'树的基本概念',type:'video',tag:'',desc:'定义、术语、存储结构'},
   {name:'二叉树定义与性质',type:'video',tag:'重点',desc:'五大性质推导、满/完全二叉树'},
   {name:'二叉树遍历',type:'video',tag:'重点',desc:'先序/中序/后序/层序、递归与非递归'},
   {name:'线索二叉树',type:'video',tag:'',desc:'线索化概念、中序线索构造与遍历'},
   {name:'树与森林转换',type:'video',tag:'',desc:'树转二叉树、森林转二叉树'},
   {name:'哈夫曼树与编码',type:'video',tag:'重点',desc:'WPL、构造算法、哈夫曼编码'},
   {name:'并查集',type:'video',tag:'',desc:'Find、Union、路径压缩'},
   {name:'项目：文件压缩',type:'project',tag:'实战',desc:'基于哈夫曼编码的图片压缩'}],
  knowledge:[
   {name:'树的基本术语',diff:'easy'},
   {name:'二叉树五大性质',diff:'medium'},
   {name:'二叉树递归遍历',diff:'medium'},
   {name:'二叉树非递归遍历',diff:'hard'},
   {name:'由遍历序列恢复二叉树',diff:'hard'},
   {name:'线索二叉树构造',diff:'hard'},
   {name:'哈夫曼树构造与编码',diff:'hard'},
   {name:'并查集路径压缩',diff:'hard'}]},
 {no:'柒',name:'图',weeks:'4周',difficulty:'进阶',
  tasks:[
   {name:'图的基本概念',type:'video',tag:'',desc:'定义、术语、有向/无向图'},
   {name:'图的存储结构',type:'video',tag:'重点',desc:'邻接矩阵、邻接表、十字链表'},
   {name:'图的遍历（DFS/BFS）',type:'video',tag:'重点',desc:'深度优先、广度优先搜索'},
   {name:'最小生成树',type:'video',tag:'重点',desc:'Prim 算法、Kruskal 算法'},
   {name:'最短路径',type:'video',tag:'重点',desc:'Dijkstra 算法、Floyd 算法'},
   {name:'拓扑排序与关键路径',type:'video',tag:'',desc:'AOV 网拓扑排序、AOE 网关键路径'},
   {name:'图的综合练习',type:'quiz',tag:'实战',desc:'连通分量、路径查找综合题'},
   {name:'项目：地图导航',type:'project',tag:'实战',desc:'基于最短路径的导航系统'}],
  knowledge:[
   {name:'图的基本术语',diff:'easy'},
   {name:'邻接矩阵与邻接表',diff:'medium'},
   {name:'DFS 递归与非递归',diff:'medium'},
   {name:'BFS 与队列应用',diff:'medium'},
   {name:'Prim 算法',diff:'hard'},
   {name:'Kruskal 算法',diff:'hard'},
   {name:'Dijkstra 算法',diff:'hard'},
   {name:'Floyd 算法',diff:'hard'},
   {name:'拓扑排序',diff:'hard'},
   {name:'关键路径',diff:'hard'}]},
 {no:'捌',name:'查找',weeks:'3周',difficulty:'进阶',
  tasks:[
   {name:'查找基本概念',type:'video',tag:'',desc:'查找表、关键字、ASL'},
   {name:'顺序与折半查找',type:'video',tag:'重点',desc:'顺序查找 O(n)、二分查找 O(log n)'},
   {name:'二叉排序树（BST）',type:'video',tag:'重点',desc:'查找、插入、删除操作'},
   {name:'平衡二叉树（AVL）',type:'video',tag:'重点',desc:'平衡因子、四种旋转调整'},
   {name:'B 树与 B+ 树',type:'video',tag:'',desc:'多路查找、数据库索引原理'},
   {name:'哈希表',type:'video',tag:'重点',desc:'哈希函数、冲突处理、性能分析'}],
  knowledge:[
   {name:'平均查找长度 ASL',diff:'easy'},
   {name:'折半查找与判定树',diff:'medium'},
   {name:'二叉排序树操作',diff:'medium'},
   {name:'AVL 树四种旋转',diff:'hard'},
   {name:'B 树插入分裂与删除合并',diff:'hard'},
   {name:'B+ 树特点与应用',diff:'hard'},
   {name:'哈希函数构造',diff:'medium'},
   {name:'开放定址法与链地址法',diff:'hard'}]},
 {no:'玖',name:'排序',weeks:'3.5周',difficulty:'进阶',
  tasks:[
   {name:'排序基本概念',type:'video',tag:'',desc:'内/外排序、稳定性、评价标准'},
   {name:'插入排序',type:'video',tag:'',desc:'直接插入、折半插入、希尔排序'},
   {name:'交换排序',type:'video',tag:'重点',desc:'冒泡排序、快速排序'},
   {name:'选择排序',type:'video',tag:'重点',desc:'简单选择、堆排序'},
   {name:'归并排序',type:'video',tag:'',desc:'二路归并、多路归并'},
   {name:'基数排序',type:'video',tag:'',desc:'LSD 与 MSD'},
   {name:'排序算法综合对比',type:'quiz',tag:'重点',desc:'复杂度/稳定性/场景选择'},
   {name:'项目：排序可视化',type:'project',tag:'实战',desc:'8 种排序算法同屏对比动画'}],
  knowledge:[
   {name:'排序稳定性概念',diff:'easy'},
   {name:'直接插入排序',diff:'easy'},
   {name:'希尔排序',diff:'medium'},
   {name:'冒泡排序',diff:'easy'},
   {name:'快速排序分区思想',diff:'hard'},
   {name:'简单选择排序',diff:'easy'},
   {name:'堆排序建堆与调整',diff:'hard'},
   {name:'归并排序分治思想',diff:'medium'},
   {name:'基数排序',diff:'medium'},
   {name:'各排序算法综合对比',diff:'hard'}]},
 {no:'拾',name:'综合应用与课程设计',weeks:'2周',difficulty:'进阶',
  tasks:[
   {name:'外部排序概述',type:'video',tag:'',desc:'磁盘 I/O、多路平衡归并'},
   {name:'置换-选择排序与败者树',type:'video',tag:'',desc:'置换-选择排序、最佳归并树'},
   {name:'Trie 树与跳表',type:'video',tag:'',desc:'前缀树检索、Skip List'},
   {name:'红黑树',type:'video',tag:'',desc:'红黑树性质与调整'},
   {name:'课程设计：综合实战',type:'project',tag:'实战',desc:'文本搜索引擎综合实现'}],
  knowledge:[
   {name:'外部排序基本思路',diff:'medium'},
   {name:'多路平衡归并',diff:'hard'},
   {name:'Trie 树构造与检索',diff:'medium'},
   {name:'跳表原理',diff:'hard'},
   {name:'红黑树基本性质',diff:'hard'}]}
];
var PROG_KEY='mzx_progress';
var progState=null;
var progChList=document.getElementById('prog-ch-list');
var progContent=document.getElementById('prog-content');
var progDoneEl=document.getElementById('prog-done');
var progTotalEl=document.getElementById('prog-total');
var progBarFill=document.getElementById('prog-bar-fill');
var progChCount=document.getElementById('prog-ch-count');
var progPrev=document.getElementById('prog-prev');
var progNext=document.getElementById('prog-next');
var PROG_ICONS={video:'🎬',code:'💻',quiz:'📝',project:'🚀'};
var PROG_DIFF={easy:'基础',medium:'中等',hard:'困难'};

function progLoad(){
  var s=null;
  try{ s=JSON.parse(localStorage.getItem(PROG_KEY)||'null'); }catch(e){}
  if(s&&typeof s.current==='number'&&s.done&&s.expanded){ progState=s; }
  else{ progState={current:0,expanded:[0],done:{}}; }
  for(var i=0;i<PROG.length;i++){
    if(!progState.done[i]) progState.done[i]={};
  }
}
function progSave(){
  try{ localStorage.setItem(PROG_KEY,JSON.stringify(progState)); }catch(e){}
}
function progDoneCount(ci){
  var n=0;
  for(var j=0;j<PROG[ci].tasks.length;j++){ if(progState.done[ci][j]) n++; }
  return n;
}
function progTotalDone(){
  var n=0,i;
  for(i=0;i<PROG.length;i++) n+=progDoneCount(i);
  return n;
}
function progTotalTasks(){
  var n=0,i;
  for(i=0;i<PROG.length;i++) n+=PROG[i].tasks.length;
  return n;
}
function progRenderPanel(){
  var html='';
  for(var ci=0;ci<PROG.length;ci++){
    var ch=PROG[ci];
    var open=progState.expanded.indexOf(ci)>=0;
    var active=ci===progState.current;
    var doneN=progDoneCount(ci), total=ch.tasks.length;
    var all=doneN===total;
    html+='<div class="prog-ch-item">';
    html+='<div class="prog-ch-head'+(active?' active':'')+'" data-ci="'+ci+'">';
    html+='<div class="prog-ch-check'+(all?' on':'')+'" data-ci="'+ci+'">✓</div>';
    html+='<div class="prog-ch-no'+(all?' on':'')+'">'+ch.no+'</div>';
    html+='<div class="prog-ch-info"><div class="prog-ch-name">'+ch.name+'</div>';
    html+='<div class="prog-ch-count">'+doneN+'/'+total+' 已完成</div>';
    html+='<div class="prog-ch-bar"><i style="width:'+(total?(doneN/total*100):0)+'%"></i></div></div>';
    html+='<div class="prog-ch-arrow'+(open?' open':'')+'">▶</div></div>';
    html+='<div class="prog-task-list'+(open?' open':'')+'">';
    for(var ti=0;ti<ch.tasks.length;ti++){
      var t=ch.tasks[ti], dn=!!progState.done[ci][ti];
      html+='<div class="prog-task'+(dn?' done':'')+'" data-ci="'+ci+'" data-ti="'+ti+'">';
      html+='<div class="tcheck'+(dn?' on':'')+'">✓</div>';
      html+='<span class="tname">'+t.name+'</span>';
      if(t.tag) html+='<span class="prog-tag '+(t.tag==='重点'?'key':'practice')+'">'+t.tag+'</span>';
      html+='</div>';
    }
    html+='</div></div>';
  }
  progChList.innerHTML=html;
}
function progRenderContent(){
  var ch=PROG[progState.current];
  var doneN=progDoneCount(progState.current), total=ch.tasks.length;
  var html='';
  html+='<div class="card">';
  html+='<div class="prog-crumb"><a data-ci="0">首页</a> / 第'+ch.no+'章 / '+ch.name+'</div>';
  html+='<div class="prog-title">第'+ch.no+'章：'+ch.name+'</div>';
  html+='<div class="prog-meta">';
  html+='<span>⏱️ 预计 '+ch.weeks+'</span><span>📖 '+total+' 个任务</span>';
  html+='<span>📊 难度：'+ch.difficulty+'</span><span>✅ 已完成 '+doneN+'/'+total+'</span>';
  html+='</div>';
  html+='<div class="prog-ch-bar" style="height:calc(6 * var(--u));margin-top:calc(14 * var(--u))"><i style="width:'+(total?(doneN/total*100):0)+'%"></i></div>';
  html+='</div>';
  html+='<div class="prog-cards">';
  for(var ti=0;ti<ch.tasks.length;ti++){
    var t=ch.tasks[ti], dn=!!progState.done[progState.current][ti];
    html+='<div class="prog-card" data-ci="'+progState.current+'" data-ti="'+ti+'">';
    html+='<div class="ico '+t.type+'">'+(PROG_ICONS[t.type]||'📄')+'</div>';
    html+='<div class="t">'+t.name+'</div>';
    html+='<div class="d">'+(t.desc||'')+'</div>';
    html+='<span class="st '+(dn?'done':'pending')+'">'+(dn?'✅ 已完成':'⏳ 待学习')+'</span>';
    html+='</div>';
  }
  html+='</div>';
  html+='<div class="card prog-know">';
  html+='<div class="prog-know-title">📌 本章知识点</div>';
  for(var ki=0;ki<ch.knowledge.length;ki++){
    var k=ch.knowledge[ki];
    html+='<div class="prog-k-item"><div class="prog-k-dot"></div>';
    html+='<span class="prog-k-name">'+k.name+'</span>';
    html+='<span class="prog-diff '+k.diff+'">'+(PROG_DIFF[k.diff]||k.diff)+'</span></div>';
  }
  html+='</div>';
  progContent.innerHTML=html;
}
function progRenderHead(){
  var dn=progTotalDone(), tt=progTotalTasks();
  progDoneEl.textContent=String(dn);
  progTotalEl.textContent=String(tt);
  progBarFill.style.width=(tt?(dn/tt*100):0)+'%';
  progChCount.textContent='共 '+PROG.length+' 章';
  progPrev.disabled=progState.current===0;
  progNext.disabled=progState.current===PROG.length-1;
}
/* ---- 学习热力图（GitHub 年历风，数据来自签到 + 每日学习分钟） ---- */
function ymd(d){
  var m=d.getMonth()+1, dd=d.getDate();
  return d.getFullYear()+'-'+(m<10?'0':'')+m+'-'+(dd<10?'0':'')+dd;
}
function hmLevel(min,signed){
  if(min>=60) return 4;
  if(min>=30) return 3;
  if(min>=10) return 2;
  if(min>0||signed) return 1;
  return 0;
}
function renderHeatmap(){
  var box=document.getElementById('hm-card');
  if(!box) return;
  var now=new Date(), year=now.getFullYear();
  var head='<div class="hm-head"><div><div class="hm-title">🔥 学习热力图 · '+year+'</div>'+
    '<div class="hm-sub">每一格是一天，颜色越深学得越久（签到也算一次）</div></div>';
  if(!currentUser){
    box.innerHTML=head+'</div><div class="hm-empty">登录后即可看到你这一年的坚持情况（签到 + 每日学习时长）</div>';
    return;
  }
  var sd=getSignData(), signed=sd.dates||{};
  var st=null;
  try{ st=JSON.parse(localStorage.getItem('mzx_study_'+currentUser)||'null'); }catch(e){}
  var days=(st&&st.days)||{};
  var start=new Date(year,0,1), end=new Date(year,11,31);
  var lastEnd=new Date(end.getTime()+(6-end.getDay())*86400000);
  var first=new Date(start.getTime()-start.getDay()*86400000);
  var list=[], c=new Date(first.getTime());
  while(c<=lastEnd){ list.push(new Date(c.getTime())); c=new Date(c.getTime()+86400000); }
  var MONS=['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
  var cells='', monthCols={}, activeDays=0, sumMin=0, run=0, maxStreak=0;
  for(var i=0;i<list.length;i++){
    var d=list[i], key=ymd(d), wk=Math.floor(i/7);
    var inYear=d.getFullYear()===year, fut=d.getTime()>now.getTime();
    var min=days[key]||0, sg=!!signed[key];
    if(inYear&&d.getDate()===1) monthCols[wk]=MONS[d.getMonth()];
    var lv=inYear?hmLevel(min,sg):0;
    if(inYear&&!fut){
      if(min>0||sg) activeDays++;
      sumMin+=min;
      if(min>0||sg){ run++; if(run>maxStreak) maxStreak=run; } else run=0;
    }else if(inYear&&fut){ run=0; }
    cells+='<span class="hm-cell'+(lv?(' l'+lv):'')+(fut?' future':'')+'"'+
      (inYear?(' title="'+key+' · '+(min?min+' 分钟':'未学习')+(sg?' · 已签到':'')+'"'):' aria-hidden="true"')+'></span>';
  }
  var curStreak=0, p=new Date(now.getTime());
  if(!((days[ymd(p)]||0)>0||signed[ymd(p)])) p=new Date(p.getTime()-86400000);
  while((days[ymd(p)]||0)>0||signed[ymd(p)]){ curStreak++; p=new Date(p.getTime()-86400000); }
  var cols=Math.ceil(list.length/7), monthRow='';
  for(var w=0;w<cols;w++) monthRow+='<span class="hm-month">'+(monthCols[w]||'')+'</span>';
  var legend='';
  for(var L=0;L<5;L++) legend+='<span class="hm-cell'+(L?(' l'+L):'')+'"></span>';
  box.innerHTML=head+
    '<div class="hm-stats">'+
      '<div class="hm-stat"><b>'+(sumMin>=60?(sumMin/60).toFixed(1)+'h':sumMin+'m')+'</b><span>累计学习</span></div>'+
      '<div class="hm-stat"><b>'+activeDays+'</b><span>学习天数</span></div>'+
      '<div class="hm-stat"><b>'+curStreak+'</b><span>当前连续</span></div>'+
      '<div class="hm-stat"><b>'+maxStreak+'</b><span>最长连续</span></div>'+
    '</div></div>'+
    '<div class="hm-scroll"><div class="hm-months">'+monthRow+'</div>'+
    '<div class="hm-grid">'+cells+'</div></div>'+
    '<div class="hm-legend"><span>少</span>'+legend+'<span>多</span>'+
    '<span style="margin-left:auto">学习满 10 分钟计一次有效学习 · 数据保存在本机</span></div>';
}
function progRender(){
  progRenderPanel();
  progRenderContent();
  progRenderHead();
  renderHeatmap();
  progSave();
  syncRingProgress();
}
function progSelect(ci){
  var at=progState.expanded.indexOf(ci);
  if(at>=0&&ci===progState.current){
    progState.expanded.splice(at,1);
  }else{
    if(at<0) progState.expanded.push(ci);
    progState.current=ci;
  }
  progRender();
}
function progToggleTask(ci,ti){
  progState.done[ci][ti]=!progState.done[ci][ti];
  progRender();
}
function progToggleChapter(ci){
  var all=progDoneCount(ci)===PROG[ci].tasks.length;
  for(var j=0;j<PROG[ci].tasks.length;j++){ progState.done[ci][j]=!all; }
  progRender();
}
function progGo(d){
  var n=progState.current+d;
  if(n<0||n>=PROG.length) return;
  progState.current=n;
  if(progState.expanded.indexOf(n)<0) progState.expanded.push(n);
  progRender();
}
progChList.addEventListener('click',function(e){
  var h=e.target.closest('.prog-ch-head');
  if(h){ progSelect(parseInt(h.getAttribute('data-ci'),10)); return; }
  var c=e.target.closest('.prog-ch-check');
  if(c){ progToggleChapter(parseInt(c.getAttribute('data-ci'),10)); return; }
  var t=e.target.closest('.prog-task');
  if(t){ progToggleTask(parseInt(t.getAttribute('data-ci'),10),parseInt(t.getAttribute('data-ti'),10)); }
});
progContent.addEventListener('click',function(e){
  var a=e.target.closest('.prog-crumb a');
  if(a){ progSelect(0); return; }
  var c=e.target.closest('.prog-card');
  if(c){ progToggleTask(parseInt(c.getAttribute('data-ci'),10),parseInt(c.getAttribute('data-ti'),10)); }
});
progPrev.addEventListener('click',function(){ progGo(-1); });
progNext.addEventListener('click',function(){ progGo(1); });

/* click -> 0/1 slowly falling to water on EVERY page */
function bindDrops(viewEl){
  viewEl.addEventListener('click',function(e){
    if(e.target.closest('.card,.modal,.toast,button,input,a,label,form')) return;
    Scene.effectAt(e.clientX,e.clientY);
  });
}
bindDrops(viewMine);
bindDrops(viewProgress);
bindTouchFx(viewProgress);

progLoad();
progRender();
/* 把学习进度同步到首页的章节圆环（序章显示整体完成度） */
function syncRingProgress(){
  if(typeof Scene==='undefined'||!Scene.setProgress) return;
  var map={};
  var tt=progTotalTasks();
  map.preface=tt?Math.min(1,progTotalDone()/tt):0;
  for(var i=0;i<PROG.length&&i<10;i++){
    var n=PROG[i].tasks.length;
    map['ch'+(i+1)]=n?progDoneCount(i)/n:0;
  }
  Scene.setProgress(map);
}

/* ================= COMMUNITY PAGE (小社区) ================= */
var viewSuggest=document.getElementById('view-suggest');
var dmnkLayer=document.getElementById('dmnk-layer');
var sugListEl=document.getElementById('sug-list');
var sugInput=document.getElementById('sug-input');
var sugPost=document.getElementById('sug-post');
var sugAvaEl=document.getElementById('sug-ava');
var sugLoginTip=document.getElementById('sug-login-tip');
var cmTopicsEl=document.getElementById('cm-topics');
var cmTabsEl=document.getElementById('cm-tabs');
var cmSortsEl=document.getElementById('cm-sorts');
var cmSearchEl=document.getElementById('cm-search');
var cmCharEl=document.getElementById('cm-char');
var cmNPost=document.getElementById('cm-n-post');
var cmNReply=document.getElementById('cm-n-reply');
var cmNUser=document.getElementById('cm-n-user');
var cmNToday=document.getElementById('cm-n-today');
var SUG_KEY='mzx_comments';
var SUG=[];
var replyOpenId=null, replyToUser=null;
var deleteArmId=null, armTimer=null;
var dmnkTimer=null;
/* 社区分区：发帖先选分区，列表可按分区筛选 */
var CM_TOPICS=[
 {id:'study',name:'学习打卡',icon:'📌'},
 {id:'help',name:'提问求助',icon:'❓'},
 {id:'share',name:'资源分享',icon:'📚'},
 {id:'idea',name:'建议反馈',icon:'💡'},
 {id:'chat',name:'闲聊灌水',icon:'☕'}
];
var cmTopic='study';   /* 发帖框当前分区 */
var cmFilter='all';    /* 列表筛选：all 或分区 id */
var cmSort='new';      /* new | hot | mine */
var cmQuery='';
function cmTopicById(id){
  for(var i=0;i<CM_TOPICS.length;i++){ if(CM_TOPICS[i].id===id) return CM_TOPICS[i]; }
  return CM_TOPICS[CM_TOPICS.length-1];
}

function sugSeed(){
  var now=Date.now(), h=3600e3, m=60e3;
  SUG=[
    {id:'c1',topic:'idea',user:'星野',time:now-7.2*h,text:'建议在每一章结束后加一个「十分钟速刷」小测验，考前复习会很方便！',likes:['小树','阿码','林间','泽宇','一叶'],replies:[
      {id:'r11',user:'阿码',time:now-6*h,text:'附议！最好还能导出错题本。',to:null},
      {id:'r12',user:'林间',time:now-5.4*h,text:'错题本 +1，期末复习太需要了。',to:'阿码'}]},
    {id:'c2',topic:'help',user:'阿码',time:now-4.6*h,text:'「树与二叉树」的递归展开总是画不对，先序/中序怎么快速判别？求同学指点～',likes:['星野','泽宇'],replies:[
      {id:'r21',user:'泽宇',time:now-4.1*h,text:'先看根的位置：先序第一个是根，中序里根左边是左子树。',to:null},
      {id:'r22',user:'星野',time:now-3.8*h,text:'再配合图表专区那张遍历图看一遍就通了。',to:'泽宇'}]},
    {id:'c3',topic:'share',user:'小树',time:now-3.2*h,text:'整理了一份「八大排序动图笔记」，每张图都标了复杂度，需要的同学自取～',likes:['星野','林间','一叶'],replies:[
      {id:'r31',user:'一叶',time:now-2.9*h,text:'收藏了，谢谢分享！',to:null}]},
    {id:'c4',topic:'study',user:'林间',time:now-2.2*h,text:'打卡第 12 天：今天刷完「栈与队列」18 道题，错 3 道，明天复盘。',likes:['泽宇','小树'],replies:[
      {id:'r41',user:'泽宇',time:now-2*h,text:'稳住，连续打卡最难得。',to:null}]},
    {id:'c5',topic:'chat',user:'泽宇',time:now-1.3*h,text:'有人一起组队做课程设计吗？想做「迷宫最短路可视化」这个题目。',likes:['木木'],replies:[]},
    {id:'c6',topic:'help',user:'木木',time:now-38*m,text:'哈希冲突用链地址法时，负载因子怎么估比较合适？',likes:[],replies:[
      {id:'r61',user:'阿码',time:now-22*m,text:'一般控制在 0.75 左右，超过就扩容。',to:null}]}
  ];
  sugSave();
}
function sugLoad(){
  var s=null;
  try{ s=JSON.parse(localStorage.getItem(SUG_KEY)||'null'); }catch(e){}
  if(s&&s.length){
    SUG=s;
    /* 兼容旧数据：补分区字段、点赞数组与回复的 to 字段 */
    for(var i=0;i<SUG.length;i++){
      var c=SUG[i];
      if(!c.topic) c.topic='chat';
      if(!c.likes) c.likes=[];
      if(!c.replies) c.replies=[];
      for(var j=0;j<c.replies.length;j++){
        if(c.replies[j].to===undefined) c.replies[j].to=null;
      }
    }
    sugSave();
  }else{ sugSeed(); }
}
function sugSave(){ try{ localStorage.setItem(SUG_KEY,JSON.stringify(SUG)); }catch(e){} }
function sugFind(id){
  for(var i=0;i<SUG.length;i++){ if(SUG[i].id===id) return SUG[i]; }
  return null;
}
function sugEsc(s){
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function sugAttr(s){ return sugEsc(s).replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
function sugTime(ts){
  var d=Date.now()-ts;
  if(d<60e3) return '刚刚';
  if(d<3600e3) return Math.floor(d/60e3)+' 分钟前';
  if(d<86400e3) return Math.floor(d/3600e3)+' 小时前';
  return Math.floor(d/86400e3)+' 天前';
}
/* 社区活跃度 → 等级（发帖 3 / 回复 1 / 获赞 2 计权，鼓励互动） */
var CM_LV=[
 {n:0,t:'新芽'},{n:8,t:'学徒'},{n:20,t:'熟手'},{n:40,t:'达人'},{n:70,t:'助教'},{n:110,t:'大神'}
];
function sugActivity(user){
  var act=0;
  for(var i=0;i<SUG.length;i++){
    var c=SUG[i];
    if(c.user===user) act+=3;
    for(var j=0;j<c.replies.length;j++){ if(c.replies[j].user===user) act+=1; }
    for(var k=0;k<c.likes.length;k++){ if(c.likes[k]===user) act+=2; }
  }
  return act;
}
function sugLevel(user){
  var a=sugActivity(user), lv=1;
  for(var i=0;i<CM_LV.length;i++){ if(a>=CM_LV[i].n) lv=i+1; }
  return {lv:lv,title:CM_LV[lv-1].t,act:a};
}
function sugHot(c){ return c.likes.length*2+c.replies.length*3; }
function sugFeatured(){
  return SUG.slice()
    .filter(function(c){ return sugHot(c)>=6; })
    .sort(function(a,b){ return sugHot(b)-sugHot(a); })
    .slice(0,12);
}
function cmFiltered(){
  var q=cmQuery.trim().toLowerCase();
  var arr=[];
  for(var i=0;i<SUG.length;i++){
    var c=SUG[i];
    if(cmSort==='mine'&&(!currentUser||c.user!==currentUser)) continue;
    if(cmFilter!=='all'&&c.topic!==cmFilter) continue;
    if(q){
      var hit=(c.user+' '+c.text).toLowerCase().indexOf(q)>=0;
      for(var j=0;!hit&&j<c.replies.length;j++){
        hit=(c.replies[j].user+' '+c.replies[j].text).toLowerCase().indexOf(q)>=0;
      }
      if(!hit) continue;
    }
    arr.push(c);
  }
  if(cmSort==='hot') arr.sort(function(a,b){ return (sugHot(b)-sugHot(a))||(b.time-a.time); });
  else arr.sort(function(a,b){ return b.time-a.time; });
  return arr;
}
function sugRender(){
  /* ---- 顶部数据 ---- */
  var replyN=0, users={}, dayNew=0, dayAgo=Date.now()-86400e3;
  for(var i=0;i<SUG.length;i++){
    var cc=SUG[i];
    replyN+=cc.replies.length;
    users[cc.user]=1;
    if(cc.time>=dayAgo) dayNew++;
    for(var j=0;j<cc.replies.length;j++) users[cc.replies[j].user]=1;
  }
  cmNPost.textContent=String(SUG.length);
  cmNReply.textContent=String(replyN);
  cmNUser.textContent=String(Object.keys(users).length);
  cmNToday.textContent=String(dayNew);
  /* ---- 头像与身份 ---- */
  var rec=currentUser?findUser(currentUser):null;
  sugAvaEl.className='sug-ava'+((rec&&rec.frame)?(' avf avf-'+String(rec.frame).replace(/^f/,'')):'');
  if(rec&&rec.avatar&&/^data:image\//.test(rec.avatar)){
    sugAvaEl.innerHTML='<img src="'+rec.avatar+'" alt="" style="width:100%;height:100%;border-radius:50%;object-fit:cover">';
  }else{
    sugAvaEl.textContent=currentUser?String(currentUser).charAt(0):'客';
  }
  if(currentUser){
    var myLv=sugLevel(currentUser);
    sugLoginTip.textContent='以 '+currentUser+' 的身份发言 · Lv.'+myLv.lv+' '+myLv.title
      +'（活跃度 '+myLv.act+'）'+(hasMark(currentUser)?' · ✦ 积分达人':'');
  }else{
    sugLoginTip.textContent='登录后可发帖、点赞与回复';
  }
  /* ---- 分区选择（发帖） ---- */
  var th='';
  for(i=0;i<CM_TOPICS.length;i++){
    var t=CM_TOPICS[i];
    th+='<button type="button" class="cm-topic'+(cmTopic===t.id?' on':'')+'" data-ctopic="'+t.id+'">'+t.icon+' '+t.name+'</button>';
  }
  cmTopicsEl.innerHTML=th;
  /* ---- 分区筛选标签 ---- */
  var tb='<button type="button" class="cm-tab'+(cmFilter==='all'?' on':'')+'" data-cfilter="all">全部 '+SUG.length+'</button>';
  for(i=0;i<CM_TOPICS.length;i++){
    var t2=CM_TOPICS[i], n=0;
    for(j=0;j<SUG.length;j++){ if(SUG[j].topic===t2.id) n++; }
    tb+='<button type="button" class="cm-tab'+(cmFilter===t2.id?' on':'')+'" data-cfilter="'+t2.id+'">'+t2.name+' '+(n||'')+'</button>';
  }
  cmTabsEl.innerHTML=tb;
  /* ---- 排序按钮状态 ---- */
  var sorts=cmSortsEl.querySelectorAll('.cm-sort');
  for(i=0;i<sorts.length;i++){
    sorts[i].classList.toggle('on',sorts[i].getAttribute('data-sort')===cmSort);
  }
  /* ---- 帖子列表 ---- */
  var list=cmFiltered();
  var html='';
  if(!list.length){
    html='<div class="sug-empty">'+((cmQuery||cmFilter!=='all'||cmSort==='mine')
      ?'没有符合条件的帖子，换个筛选或关键词再看看～'
      :'社区还很安静，来发第一张帖子吧～')+'</div>';
  }
  for(i=0;i<list.length;i++){
    var c=list[i];
    var mine=!!(currentUser&&c.user===currentUser);
    var liked=!!(currentUser&&c.likes.indexOf(currentUser)>=0);
    var armed=deleteArmId===c.id;
    var lv=sugLevel(c.user);
    var tp=cmTopicById(c.topic);
    var hl=hasMark(c.user);
    html+='<div class="card sug-item'+(hl?' hl':'')+'">';
    var cRec=findUser(c.user);
    var frame=(cRec&&cRec.frame)?(' avf avf-'+String(cRec.frame).replace(/^f/,'')):'';
    html+=cRec&&cRec.avatar&&/^data:image\//.test(cRec.avatar)
      ?'<span class="sug-c-ava'+frame+'" data-uid="'+sugAttr(c.user)+'" title="看看 TA 的主页"><img src="'+cRec.avatar+'" alt="" style="width:100%;height:100%;border-radius:50%;object-fit:cover"></span>'
      :'<span class="sug-c-ava'+frame+'" data-uid="'+sugAttr(c.user)+'" title="看看 TA 的主页">'+sugEsc(String(c.user).charAt(0))+'</span>';
    html+='<div class="sug-c-main">';
    html+='<div class="sug-c-head">'
      +'<span class="sug-c-name" data-uid="'+sugAttr(c.user)+'" title="看看 TA 的主页">'+sugEsc(c.user)+'</span>'
      +(hl?'<span class="sug-vip">✦ 积分达人</span>':'')
      +'<span class="sug-lv">Lv.'+lv.lv+' '+lv.title+'</span>'
      +'<span class="sug-tag">'+tp.icon+' '+tp.name+'</span>'
      +'<span class="sug-c-time">'+sugTime(c.time)+'</span></div>';
    html+='<div class="sug-c-text">'+sugEsc(c.text)+'</div>';
    html+='<div class="sug-c-foot">';
    html+='<button class="sug-act'+(liked?' liked':'')+'" data-act="like" data-id="'+c.id+'"><span class="h">♥</span> '+c.likes.length+'</button>';
    html+='<button class="sug-act" data-act="reply" data-id="'+c.id+'">💬 回复 '+(c.replies.length||'')+'</button>';
    if(mine){
      html+='<button class="sug-act del'+(armed?' confirm':'')+'" data-act="del" data-id="'+c.id+'">'+(armed?'确认删除？':'删除')+'</button>';
    }else{
      html+='<span class="sug-op">热度 '+sugHot(c)+'</span>';
    }
    html+='</div>';
    if(replyOpenId===c.id){
      var ph=replyToUser?('回复 @'+replyToUser+'…'):('回复 '+c.user+'…');
      html+='<div class="sug-reply-box"><input id="sug-reply-input" maxlength="120" placeholder="'+sugAttr(ph)+'">';
      html+='<button data-act="sendreply" data-id="'+c.id+'">回复</button>';
      html+='<button class="rb-cancel" data-act="cancelreply" data-id="'+c.id+'">取消</button></div>';
    }
    if(c.replies.length){
      html+='<div class="sug-replies">';
      for(var k=0;k<c.replies.length;k++){
        var r=c.replies[k];
        var rMine=!!(currentUser&&r.user===currentUser);
        var rHl=hasMark(r.user);
        html+='<div class="sug-reply'+(rHl?' hl':'')+'"><span class="who" data-uid="'+sugAttr(r.user)+'">'+sugEsc(r.user)+'：</span>';
        html+='<span class="body">'+(r.to?('<span class="to">回复 @'+sugEsc(r.to)+' </span>'):'')+sugEsc(r.text)+'</span>';
        html+='<span class="time">'+sugTime(r.time)+'</span>';
        if(currentUser){
          html+='<button class="rrep" data-act="rreply" data-id="'+c.id+'" data-ruser="'+sugAttr(r.user)+'">回复</button>';
        }
        if(rMine){
          html+='<button class="rdel'+(deleteArmId===r.id?' confirm':'')+'" data-act="delr" data-id="'+c.id+'" data-rid="'+r.id+'">'+(deleteArmId===r.id?'确认删除？':'删除')+'</button>';
        }
        html+='</div>';
      }
      html+='</div>';
    }
    html+='</div></div>';
  }
  sugListEl.innerHTML=html;
  cmCharEl.textContent=sugInput.value.length+' / 300';
  cmCharEl.classList.toggle('warn',sugInput.value.length>270);
}
/* ---- danmaku ---- */
function dmnkSpawn(){
  if(Scene.reduced) return;
  var pool=sugFeatured();
  if(!pool.length) return;
  var c=pool[(Math.random()*pool.length)|0];
  var el=document.createElement('div');
  el.className='dmnk';
  el.style.top='calc('+(8+Math.random()*118).toFixed(1)+' * var(--u))';
  var txt=c.text.length>26?c.text.slice(0,26)+'…':c.text;
  el.innerHTML='<span class="dstar">✦</span><b>'+sugEsc(c.user)+'</b>'+sugEsc(txt);
  el.style.animationDuration=(9+Math.random()*5).toFixed(1)+'s';
  dmnkLayer.appendChild(el);
  el.addEventListener('animationend',function(){ if(el.parentNode) el.parentNode.removeChild(el); });
}
function dmnkStart(){
  dmnkStop();
  dmnkSpawn();
  if(Scene.reduced) return;
  dmnkTimer=setInterval(dmnkSpawn,4500);
}
function dmnkStop(){
  if(dmnkTimer){ clearInterval(dmnkTimer); dmnkTimer=null; }
  dmnkLayer.innerHTML='';
}
/* ---- interactions ---- */
function sugLike(id){
  if(!currentUser){ toast('请先登录，再点赞'); return; }
  var c=sugFind(id); if(!c) return;
  var at=c.likes.indexOf(currentUser);
  if(at>=0){ c.likes.splice(at,1); }
  else{ c.likes.push(currentUser); }
  sugSave(); sugRender();
  if(sugHot(c)>=6&&viewSuggest.classList.contains('is-open')) dmnkSpawn();
}
function sugToggleReply(id,toUser){
  if(!currentUser){ toast('请先登录，再回复'); return; }
  if(replyOpenId===id&&replyToUser===(toUser||null)){ replyOpenId=null; replyToUser=null; }
  else{ replyOpenId=id; replyToUser=toUser||null; }
  sugRender();
  if(replyOpenId){
    var inp=document.getElementById('sug-reply-input');
    if(inp){ inp.focus(); if(!toUser&&inp.setSelectionRange){ inp.setSelectionRange(inp.value.length,inp.value.length); } }
  }
}
function sugSendReply(id){
  var inp=document.getElementById('sug-reply-input');
  if(!inp) return;
  var txt=inp.value.trim();
  if(!txt){ toast('回复内容不能为空'); return; }
  var c=sugFind(id); if(!c) return;
  c.replies.push({id:'r'+Date.now()+Math.floor(Math.random()*1e4),user:currentUser,time:Date.now(),text:txt,to:replyToUser||null});
  replyOpenId=null; replyToUser=null;
  sugSave(); sugRender();
  toast(replyToUser?('已回复 @'+replyToUser):'回复成功');
  if(sugHot(c)>=6&&viewSuggest.classList.contains('is-open')) dmnkSpawn();
}
function sugArm(id,fn){
  if(deleteArmId===id){
    deleteArmId=null;
    if(armTimer){ clearTimeout(armTimer); armTimer=null; }
    fn();
    sugSave(); sugRender();
  }else{
    deleteArmId=id;
    sugRender();
    if(armTimer) clearTimeout(armTimer);
    armTimer=setTimeout(function(){
      if(deleteArmId===id){ deleteArmId=null; sugRender(); }
    },2600);
  }
}
function sugDel(id){
  var c=sugFind(id);
  if(!c||c.user!==currentUser) return;
  sugArm(id,function(){
    SUG.splice(SUG.indexOf(c),1);
    toast('帖子已删除');
  });
}
function sugDelReply(cid,rid){
  var c=sugFind(cid);
  if(!c) return;
  var r=null;
  for(var i=0;i<c.replies.length;i++){ if(c.replies[i].id===rid){ r=c.replies[i]; break; } }
  if(!r||r.user!==currentUser) return;
  sugArm(rid,function(){
    c.replies.splice(c.replies.indexOf(r),1);
    toast('回复已删除');
  });
}
sugPost.addEventListener('click',function(){
  if(!currentUser){ toast('请先登录，再发帖'); return; }
  var txt=sugInput.value.trim();
  if(!txt){ toast('先写点内容吧'); return; }
  var tp=cmTopicById(cmTopic);
  SUG.push({id:'c'+Date.now()+Math.floor(Math.random()*1e4),topic:cmTopic,user:currentUser,
            time:Date.now(),text:txt,likes:[],replies:[]});
  sugInput.value='';
  /* 发完立刻能看到自己的帖子：清掉筛选/搜索并回到最新排序 */
  cmFilter='all'; cmSort='new'; cmQuery='';
  if(cmSearchEl) cmSearchEl.value='';
  sugSave(); sugRender();
  toast('发布成功 · 已发到「'+tp.name+'」');
});
sugInput.addEventListener('input',function(){
  cmCharEl.textContent=sugInput.value.length+' / 300';
  cmCharEl.classList.toggle('warn',sugInput.value.length>270);
});
sugInput.addEventListener('keydown',function(e){
  if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); sugPost.click(); }
});
cmTopicsEl.addEventListener('click',function(e){
  var b=e.target.closest('[data-ctopic]');
  if(!b) return;
  cmTopic=b.getAttribute('data-ctopic');
  sugRender();
});
cmTabsEl.addEventListener('click',function(e){
  var b=e.target.closest('[data-cfilter]');
  if(!b) return;
  cmFilter=b.getAttribute('data-cfilter');
  sugRender();
});
cmSortsEl.addEventListener('click',function(e){
  var b=e.target.closest('[data-sort]');
  if(!b) return;
  if(b.getAttribute('data-sort')==='mine'&&!currentUser){ toast('登录后可查看我的帖子'); return; }
  cmSort=b.getAttribute('data-sort');
  sugRender();
});
cmSearchEl.addEventListener('input',function(){
  cmQuery=cmSearchEl.value;
  sugRender();
});
sugListEl.addEventListener('click',function(e){
  var u=e.target.closest('[data-uid]');
  if(u&&!e.target.closest('[data-act]')){ openUserCard(u.getAttribute('data-uid')); return; }
  var b=e.target.closest('[data-act]');
  if(!b) return;
  var act=b.getAttribute('data-act');
  var id=b.getAttribute('data-id');
  if(act==='like'){ sugLike(id); }
  else if(act==='reply'){ sugToggleReply(id,null); }
  else if(act==='rreply'){ sugToggleReply(id,b.getAttribute('data-ruser')); }
  else if(act==='cancelreply'){ replyOpenId=null; replyToUser=null; sugRender(); }
  else if(act==='del'){ sugDel(id); }
  else if(act==='sendreply'){ sugSendReply(id); }
  else if(act==='delr'){ sugDelReply(id,b.getAttribute('data-rid')); }
});
sugListEl.addEventListener('keydown',function(e){
  if(e.key!=='Enter'||!replyOpenId) return;
  if(!e.target||e.target.id!=='sug-reply-input') return;
  e.preventDefault();
  sugSendReply(replyOpenId);
});
bindDrops(viewSuggest);
bindTouchFx(viewSuggest);
sugLoad();
sugRender();

/* ================= CHARTS VIEW (图表专区) ================= */
var viewCharts=document.getElementById('view-charts');
var chNavEl=document.getElementById('ch-nav');
var chNameEl=document.getElementById('ch-name');
var chBtnsEl=document.getElementById('ch-btns');
var chStageEl=document.getElementById('ch-stage');
var chLegendEl=document.getElementById('ch-legend');
var chInputCard=document.getElementById('ch-input-card');
var chInputEl=document.getElementById('ch-input');
var chCodeEl=document.getElementById('ch-code');
var chTotalEl=document.getElementById('ch-total');
var CH_CUR=null, CH_STATE={};
var CH_CATS=[
 {name:'数据图表',ids:['bar','line','pie']},
 {name:'线性结构',ids:['seqlist','linklist','dlist','clist','stack','queue','cqueue']},
 {name:'树结构',ids:['btree','huffman','bst','avl','heap']},
 {name:'图结构',ids:['adjmatrix','adjlist','prim','dijkstra','topo']},
 {name:'查找与排序',ids:['binarysearch','hashtable','bubble','quick','merge','heapsort']},
 {name:'速查表',ids:['table-complex','table-sort','table-sl']}
];
/* 图表 SVG 颜色 → 主题化 class（换肤时一起变色；未收录的颜色原样保留） */
var CH_FILL={
 '#d7f2ff':'cf','#eafcff':'cf','#e4f7ff':'cf','#ffffff':'cf',
 '#9fd8f2':'cf-cy','#a8e6ff':'cf-cy','#5fc8f0':'cf-cy','#79dce8':'cf-cy',
 '#9b7bf5':'cf-violet','#f0a2c8':'cf-rose','#ffd76a':'cf-gold',
 '#7be0a2':'cf-ok','#ff9d9d':'cf-bad',
 'rgba(90,180,240,.3)':'cb','rgba(90,180,240,.16)':'cb-cell','rgba(9,24,46,.5)':'cb-dark'
};
var CH_LINE={
 'rgba(160,220,250,.3)':'cs1','rgba(160,220,250,.35)':'cs2','rgba(160,220,250,.5)':'cs3',
 'rgba(160,220,250,.55)':'cs4','rgba(160,220,250,.6)':'cs5','rgba(160,220,250,.65)':'cs6',
 '#d7f2ff':'cs-ink','#5fc8f0':'cs-cy','#9b7bf5':'cs-violet','#ffd76a':'cs-gold',
 '#7be0a2':'cs-ok','#ff9d9d':'cs-bad','rgba(4,16,31,.8)':'cs-panel'
};
function chAttr(v,kind){
  var k=String(v==null?'':v).replace(/\s+/g,'').toLowerCase();
  if(/^(cf-|cb|cs|sw)/.test(k)) return 'class="'+k+'"';   /* 已经是主题化 class */
  var m=(kind==='stroke'?CH_LINE:CH_FILL)[k];
  if(m) return 'class="'+m+'"';
  return (kind==='stroke'?'stroke':'fill')+'="'+v+'"';
}
function chSvg(inner){ return '<svg viewBox="0 0 720 360" preserveAspectRatio="xMidYMid meet">'+inner+'</svg>'; }
function chTxt(x,y,s,fs,fill,anchor){ return '<text x="'+x+'" y="'+y+'" font-size="'+(fs||13)+'" '+chAttr(fill||'#d7f2ff','fill')+' text-anchor="'+(anchor||'middle')+'">'+s+'</text>'; }
function chRect(x,y,w,h,fill,rx){ return '<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" rx="'+(rx==null?6:rx)+'" '+chAttr(fill,'fill')+'/>'; }
function chCell(x,y,w,h,txt,fill){ return chRect(x,y,w,h,fill||'rgba(90,180,240,.16)')+chTxt(x+w/2,y+h/2+5,txt,15,'#eafcff'); }
function chArrow(x1,y1,x2,y2,color){
  var dx=x2-x1,dy=y2-y1,L=Math.hypot(dx,dy)||1,ux=dx/L,uy=dy/L,ah=9;
  return '<line x1="'+x1+'" y1="'+y1+'" x2="'+(x2-ux*ah)+'" y2="'+(y2-uy*ah)+'" '+chAttr(color||'rgba(160,220,250,.65)','stroke')+' stroke-width="2"/>'+
    '<path d="M'+x2+' '+y2+' L'+(x2-ux*ah-uy*ah*.55)+' '+(y2-uy*ah+ux*ah*.55)+' L'+(x2-ux*ah+uy*ah*.55)+' '+(y2-uy*ah-ux*ah*.55)+' Z" '+chAttr(color||'rgba(160,220,250,.65)','fill')+'/>';
}
function chEsc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function chHl(code){
  var s=chEsc(code);
  s=s.replace(/(\/\/[^\n]*)/g,'<span class="c">$1</span>');
  s=s.replace(/"([^"]*)"/g,'<span class="s">"$1"</span>');
  s=s.replace(/(#\s*include[^\n]*)/g,'<span class="k">$1</span>');
  s=s.replace(/\b(class(?!\s*=)|if|else|for|while|return|new|delete|struct|typedef|include|using|namespace|std|auto|nullptr|template|constexpr|const|int|void|bool|char|float|double|long|unsigned|true|false|NULL|public|private|protected|function|let|var)\b/g,'<span class="k">$1</span>');
  s=s.replace(/([A-Za-z_$][\w$]*)\s*\(/g,'<span class="f">$1</span>(');
  return s;
}
function chState(){ return CH_STATE[CH_CUR.id]; }
function chById(id){
  for(var i=0;i<CH_ITEMS.length;i++){ if(CH_ITEMS[i].id===id) return CH_ITEMS[i]; }
  return null;
}
function chRandInt(a,b){ return a+Math.floor(Math.random()*(b-a+1)); }
function chRandData(){ var n=5+((Math.random()*4)|0),d=[]; for(var i=0;i<n;i++) d.push(chRandInt(1,99)); return d; }
function bsSteps(arr,t){
  var sts=[],lo=0,hi=arr.length-1;
  while(lo<=hi&&sts.length<30){
    var mid=(lo+hi)>>1;
    var f=arr[mid]===t;
    sts.push({lo:lo,hi:hi,mid:mid,found:f});
    if(f) break;
    if(arr[mid]<t) lo=mid+1; else hi=mid-1;
  }
  return sts;
}
function chTrav(mode,vals){
  var out=[];
  (function go(i){
    if(i>=vals.length) return;
    if(mode==='pre') out.push(i);
    go(2*i+1);
    if(mode==='in') out.push(i);
    go(2*i+2);
    if(mode==='post') out.push(i);
  })(0);
  return out;
}
function chTreePos(i){
  var d=Math.floor(Math.log2(i+1));
  var cnt=Math.pow(2,d);
  var idx=i-(cnt-1);
  return {x:360+(idx-(cnt-1)/2)*(460/cnt),y:64+d*92};
}
function chTable(head,rows){
  var html='<div class="ch-table-wrap"><table class="ch-table"><thead><tr>';
  for(var i=0;i<head.length;i++) html+='<th>'+head[i]+'</th>';
  html+='</tr></thead><tbody>';
  for(var r=0;r<rows.length;r++){
    html+='<tr>';
    for(var c=0;c<rows[r].length;c++){
      html+='<td'+(c===0?' class="gold"':'')+'>'+rows[r][c]+'</td>';
    }
    html+='</tr>';
  }
  html+='</tbody></table></div>';
  return html;
}
function chPlayFlash(){
  chStageEl.style.opacity='0.45';
  setTimeout(function(){
    chRenderStage();
    chStageEl.style.opacity='1';
  },220);
}
function chRenderBtns(){
  var b=CH_CUR.buttons||[];
  chBtnsEl.innerHTML=b.map(function(x){
    return '<button class="ch-btn'+(x.p?' primary':'')+'" data-a="'+x.a+'">'+x.l+'</button>';
  }).join('');
}
function chRenderNav(){
  var html='';
  for(var c=0;c<CH_CATS.length;c++){
    html+='<div class="ch-cat">'+CH_CATS[c].name+'</div>';
    for(var i=0;i<CH_CATS[c].ids.length;i++){
      var it=chById(CH_CATS[c].ids[i]);
      if(!it) continue;
      html+='<div class="ch-item'+(CH_CUR&&CH_CUR.id===it.id?' active':'')+'" data-id="'+it.id+'"><span class="ic">'+it.icon+'</span>'+it.name+'</div>';
    }
  }
  chNavEl.innerHTML=html;
}
function chRenderStage(){
  var st=chState();
  var r=CH_CUR.render(st);
  chStageEl.innerHTML=r.html;
  chLegendEl.innerHTML=r.legend||'';
}
function chSwitch(id){
  var it=chById(id);
  if(!it) return;
  CH_CUR=it;
  if(!CH_STATE[id]) CH_STATE[id]=it.init();
  if(it.hasInput){
    chInputCard.hidden=false;
    var st=CH_STATE[id];
    if(st.data) chInputEl.value=st.data.join(', ');
    else if(st.arr) chInputEl.value=st.arr.join(', ');
  }else{
    chInputCard.hidden=true;
  }
  chNameEl.innerHTML='<span style="margin-right:calc(8 * var(--u))">'+it.icon+'</span>'+it.name+'<small>'+it.desc+'</small>';
  chCodeEl.innerHTML=chHl(it.code);
  chRenderBtns();
  chRenderNav();
  chRenderStage();
}
function chRender(){
  if(CH_CUR) chSwitch(CH_CUR.id);
  else chSwitch('bar');
}
function chParseInput(){
  var v=chInputEl.value.split(/[,，\s]+/).map(Number).filter(function(n){ return !isNaN(n); });
  return v.length?v:null;
}

var CH_ITEMS=[
/* ---------- 数据图表 ---------- */
{id:'bar',name:'柱状图',icon:'📊',desc:'比较不同类别的数值大小',hasInput:true,
 init:function(){ return {data:[12,19,3,5,2,3,15,8]}; },
 code:'// 柱状图：比较各类别的数值大小\n#include <vector>\n#include <algorithm>\nint main() {\n  std::vector<int> data = {12, 7, 9, 15, 6};\n  int m = *std::max_element(data.begin(), data.end());\n  for (int v : data) bar(v * 100 / m);   // 按比例画柱\n}',
 buttons:[{a:'random',l:'🎲 随机数据'},{a:'play',l:'▶️ 播放动画',p:1}],
 actions:{random:function(){ var st=chState(); st.data=chRandData(); chInputEl.value=st.data.join(', '); chRenderStage(); },
   play:chPlayFlash},
 render:function(st){
   var d=st.data, max=Math.max.apply(null,d.concat([1]));
   var n=d.length,x0=80,bw=560/n,base=295;
   var s='<line x1="70" y1="'+base+'" x2="655" y2="'+base+'" class="cs1" stroke-width="2"/>';
   for(var i=0;i<n;i++){
     var h=Math.max(6,(d[i]/max)*235);
     s+=chRect(x0+i*bw+8,base-h,bw-16,h,'#5fc8f0',8);
     s+=chTxt(x0+i*bw+bw/2,base+26,d[i],13,'#9fd8f2');
   }
   return {html:chSvg(s),legend:'<i class="sw sw-cy"></i>数值大小'};
 }},
{id:'line',name:'折线图',icon:'📈',desc:'展示数据随时间或顺序的趋势',hasInput:true,
 init:function(){ return {data:[10,25,40,15,30,45,20,35]}; },
 code:'// 折线图：展示数据的变化趋势\n#include <vector>\nint main() {\n  std::vector<int> data = {5, 9, 7, 13, 11};\n  for (int i = 0; i < data.size(); i++)\n    plot(i, data[i]);           // 描点\n  for (int i = 1; i < data.size(); i++)\n    line(i - 1, i);             // 相邻点连线\n}',
 buttons:[{a:'random',l:'🎲 随机数据'},{a:'play',l:'▶️ 播放动画',p:1}],
 actions:{random:function(){ var st=chState(); st.data=chRandData(); chInputEl.value=st.data.join(', '); chRenderStage(); },
   play:chPlayFlash},
 render:function(st){
   var d=st.data, max=Math.max.apply(null,d.concat([1]));
   var x0=80,x1=650,base=295;
   var step=(x1-x0)/(d.length>1?d.length-1:1);
   var pts='',s='';
   for(var i=0;i<d.length;i++){
     var x=x0+i*step, y=base-(d[i]/max)*235;
     pts+=x+','+y+' ';
     s+='<circle cx="'+x+'" cy="'+y+'" r="5" class="cf-violet"/>';
     s+=chTxt(x,y-14,d[i],12,'cf-violet');
   }
   s+='<polyline points="'+pts.trim()+'" fill="none" class="cs-violet" stroke-width="3"/>';
   s+='<line x1="70" y1="'+base+'" x2="655" y2="'+base+'" class="cs1" stroke-width="2"/>';
   return {html:chSvg(s),legend:'<i class="sw sw-violet"></i>趋势线'};
 }},
{id:'pie',name:'饼图',icon:'🥧',desc:'显示各部分占整体的比例',hasInput:true,
 init:function(){ return {data:[30,20,15,35]}; },
 code:'// 饼图：展示各部分占整体的比例\n#include <vector>\nint main() {\n  std::vector<int> data = {30, 40, 30};\n  int sum = 0;\n  for (int v : data) sum += v;     // 总和\n  double start = 0;\n  for (int v : data) {\n    double ang = 2 * 3.14159 * v / sum;\n    arc(start, start + ang);       // 画扇形\n    start += ang;\n  }\n}',
 buttons:[{a:'random',l:'🎲 随机数据'},{a:'play',l:'▶️ 播放动画',p:1}],
 actions:{random:function(){ var st=chState(); st.data=[]; var n=3+((Math.random()*3)|0); for(var i=0;i<n;i++) st.data.push(chRandInt(1,60)); chInputEl.value=st.data.join(', '); chRenderStage(); },
   play:chPlayFlash},
 render:function(st){
   var d=st.data,total=0,i;
   for(i=0;i<d.length;i++) total+=d[i];
   var cx=360,cy=185,r=125,start=0;
   var colors=['cf-cy','cf-violet','cf-gold','cf-ok','cf-bad','cf-rose'];  /* 主题化 class 名 */
   var s='',leg='';
   for(i=0;i<d.length;i++){
     var a=(d[i]/total)*2*Math.PI, end=start+a;
     var x1=cx+r*Math.cos(start),y1=cy+r*Math.sin(start);
     var x2=cx+r*Math.cos(end),y2=cy+r*Math.sin(end);
     var laf=a>Math.PI?1:0;
     s+='<path d="M '+cx+' '+cy+' L '+x1+' '+y1+' A '+r+' '+r+' 0 '+laf+' 1 '+x2+' '+y2+' Z" class="'+colors[i%6]+' cs-panel" stroke-width="2"/>';
     leg+='<span><i class="sw '+colors[i%6]+'"></i>Part '+(i+1)+'：'+d[i]+'（'+Math.round(d[i]/total*100)+'%）</span>';
     start=end;
   }
   return {html:chSvg(s),legend:leg};
 }},
/* ---------- 线性结构 ---------- */
{id:'seqlist',name:'顺序表',icon:'📦',desc:'连续存储，按下标随机访问 O(1)',
 init:function(){ return {data:[12,19,3,5,2,3,15,8]}; },
 code:'// 顺序表：连续存储，随机访问 O(1)\n#include <vector>\nstd::vector<int> sq;   // 动态数组即顺序表\nsq.push_back(x);       // 尾部插入 O(1)\nint v = sq[i];         // 随机访问 O(1)\n// 地址 = 基地址 + i × 元素大小',
 buttons:[{a:'random',l:'🎲 随机数据'},{a:'play',l:'▶️ 播放动画',p:1}],
 actions:{random:function(){ var st=chState(); st.data=chRandData().slice(0,8); chRenderStage(); },
   play:chPlayFlash},
 render:function(st){
   var d=st.data,x0=90,w=64,y=140,h=50,n=d.length;
   var s=chTxt(30,172,'元素',13,'#9fd8f2')+chTxt(30,220,'下标',13,'#79dce8');
   for(var i=0;i<n;i++){
     s+=chCell(x0+i*w,y,w,h,d[i]);
     s+=chTxt(x0+i*w+w/2,y+h+26,i,13,'#79dce8');
     s+=chTxt(x0+i*w+w/2,y+h+44,'a['+i+']',11,'rgba(160,220,250,.5)');
   }
   s+=chTxt(360,322,'地址 = 基地址 + i × sizeof(元素) · 随机访问 O(1)',13,'rgba(160,220,250,.6)');
   return {html:chSvg(s),legend:'<i style="background:rgba(90,180,240,.3)"></i>数据元素 <i class="sw sw-cy"></i>下标'};
 }},
{id:'linklist',name:'单链表',icon:'🔗',desc:'数据域 + 指针域，头插/尾插',
 init:function(){ return {items:[12,7,19,3]}; },
 code:'// 单链表：结点 = 数据域 + 指针域\nstruct LNode {\n  int data;\n  LNode* next;\n  LNode(int x) : data(x), next(nullptr) {}\n};\n// 头插法：新结点插到头结点之后\ns->next = L->next;\nL->next = s;',
 buttons:[{a:'headins',l:'⤵ 头插'},{a:'tailins',l:'尾插 ⤵'},{a:'delhead',l:'删除头结点'},{a:'reset',l:'重置'}],
 actions:{
   headins:function(){ var st=chState(); if(st.items.length>=5){ toast('链表最多显示 5 个结点'); return; } st.items.unshift(chRandInt(1,99)); chRenderStage(); },
   tailins:function(){ var st=chState(); if(st.items.length>=5){ toast('链表最多显示 5 个结点'); return; } st.items.push(chRandInt(1,99)); chRenderStage(); },
   delhead:function(){ var st=chState(); if(st.items.length<=1){ toast('至少保留一个结点'); return; } st.items.shift(); chRenderStage(); },
   reset:function(){ var st=chState(); st.items=[12,7,19,3]; chRenderStage(); }},
 render:function(st){
   var items=st.items,n=items.length;
   var s=chTxt(52,152,'head',13,'#ffd76a')+chArrow(76,152,120,152,'#ffd76a');
   var x=120;
   for(var i=0;i<n;i++){
     s+=chRect(x,128,74,46,'rgba(90,180,240,.2)',8);
     s+=chTxt(x+30,157,items[i],15,'#eafcff');
     s+='<line x1="'+(x+74)+'" y1="151" x2="'+(x+110)+'" y2="151" class="cs6" stroke-width="2"/>';
     if(i<n-1){ s+=chArrow(x+110,151,x+128,151); }
     else{ s+=chTxt(x+128,156,'∧',16,'rgba(255,150,150,.85)'); }
     x+=128;
   }
   s+=chTxt(360,260,'插入删除 O(1) · 查找 O(n)',13,'rgba(160,220,250,.6)');
   return {html:chSvg(s),legend:'<i class="sw sw-gold"></i>头指针 <i style="background:rgba(255,150,150,.85)"></i>NULL'};
 }},
{id:'dlist',name:'双向链表',icon:'🔁',desc:'每个结点有前驱与后继指针',
 init:function(){ return {}; },
 code:'// 双向链表：prior 与 next 两个指针\nstruct DNode {\n  int data;\n  DNode *prior, *next;\n};\n// 在 p 之后插入结点 s\ns->next = p->next;\np->next->prior = s;\ns->prior = p;\np->next = s;',
 buttons:[{a:'play',l:'▶️ 播放动画',p:1}],
 actions:{play:chPlayFlash},
 render:function(){
   var d=[4,8,2,9],x0=110,w=84,gap=56,y=152;
   var s=chTxt(x0-6,128,'head',12,'#ffd76a')+chTxt(x0+(d.length-1)*(w+gap)+w,128,'tail',12,'#ffd76a','end');
   for(var i=0;i<d.length;i++){
     var x=x0+i*(w+gap);
     s+=chRect(x,y,w,46,'rgba(90,180,240,.2)',8)+chTxt(x+w/2,y+29,d[i],15,'#eafcff');
     if(i<d.length-1){
       s+=chArrow(x+w+6,y+18,x+w+gap-8,y+18);
       s+=chArrow(x+w+gap-8,y+64,x+w+6,y+64);
     }else{
       s+=chTxt(x+w+26,y+22,'∧',14,'rgba(255,150,150,.85)');
     }
     if(i===0){ s+=chTxt(x+w/2,y+90,'∧',14,'rgba(255,150,150,.85)'); }
   }
   s+=chTxt(360,290,'prior 指向前驱 · next 指向后继',13,'rgba(160,220,250,.6)');
   return {html:chSvg(s),legend:'<i style="background:rgba(90,180,240,.3)"></i>结点 <i style="background:rgba(255,150,150,.85)"></i>NULL'};
 }},
{id:'clist',name:'循环链表',icon:'🌀',desc:'尾结点 next 指向头结点',
 init:function(){ return {}; },
 code:'// 循环链表：尾结点的 next 指向头结点\n// 判空：L->next == L   判尾：p->next == L\nvoid init(LNode*& L) {\n  L = new LNode(0);   // 头结点\n  L->next = L;        // 自己指向自己\n}',
 buttons:[{a:'play',l:'▶️ 播放动画',p:1}],
 actions:{play:chPlayFlash},
 render:function(){
   var d=[5,2,8,1,6],cx=360,cy=175,r=105;
   var s='';
   for(var i=0;i<d.length;i++){
     var a=-Math.PI/2+i*2*Math.PI/d.length;
     var x=cx+r*Math.cos(a),y=cy+r*Math.sin(a);
     s+=chRect(x-32,y-20,64,40,'rgba(90,180,240,.2)',8);
     s+=chTxt(x,y+5,d[i],14,'#eafcff');
   }
   for(i=0;i<d.length;i++){
     var a1=-Math.PI/2+i*2*Math.PI/d.length;
     var a2=-Math.PI/2+(i+1)*2*Math.PI/d.length;
     var x1=cx+(r-34)*Math.cos(a1),y1=cy+(r-34)*Math.sin(a1);
     var x2=cx+(r-34)*Math.cos(a2),y2=cy+(r-34)*Math.sin(a2);
     s+=chArrow(x1,y1,x2,y2,'rgba(160,220,250,.6)');
   }
   s+=chTxt(360,330,'尾结点的 next 指向头结点 · 从头出发可回到头',13,'rgba(160,220,250,.6)');
   return {html:chSvg(s),legend:'<i style="background:rgba(90,180,240,.3)"></i>结点'};
 }},
{id:'stack',name:'栈',icon:'📚',desc:'后进先出（LIFO）结构',
 init:function(){ return {items:[10,20,30,40]}; },
 code:'// 顺序栈：后进先出 LIFO\n#include <stack>\nstd::stack<int> s;\ns.push(x);        // 入栈\nint v = s.top();  // 取栈顶\ns.pop();          // 出栈',
 buttons:[{a:'push',l:'⤵ 入栈'},{a:'pop',l:'出栈 ⤴'},{a:'reset',l:'重置'}],
 actions:{
   push:function(){ var st=chState(); if(st.items.length>=5){ toast('栈最多显示 5 个元素'); return; } st.items.push(chRandInt(1,99)); chRenderStage(); },
   pop:function(){ var st=chState(); if(!st.items.length){ toast('栈已为空'); return; } st.items.pop(); chRenderStage(); },
   reset:function(){ var st=chState(); st.items=[10,20,30,40]; chRenderStage(); }},
 render:function(st){
   var items=st.items,n=items.length;
   var s='<rect x="292" y="76" width="146" height="220" rx="10" fill="none" class="cs2" stroke-dasharray="6 6"/>';
   for(var i=0;i<n;i++){
     var y=290-(i+1)*42;
     s+=chCell(300,y,130,36,items[i],i===n-1?'rgba(155,123,245,.4)':'rgba(90,180,240,.18)');
   }
   if(n){ s+=chTxt(456,290-n*42+22,'← top',13,'#ffd76a','start'); }
   else{ s+=chTxt(365,190,'栈空',15,'rgba(160,220,250,.5)'); }
   s+=chTxt(365,330,'后进先出 LIFO · 栈顶指针 top',13,'rgba(160,220,250,.6)');
   return {html:chSvg(s),legend:'<i style="background:rgba(155,123,245,.4)"></i>栈顶元素'};
 }},
{id:'queue',name:'队列',icon:'🚶',desc:'先进先出（FIFO）结构',
 init:function(){ return {items:[1,2,3,4,5]}; },
 code:'// 顺序队列：先进先出 FIFO\n#include <queue>\nstd::queue<int> q;\nq.push(x);         // 入队到队尾\nint v = q.front(); // 取队头\nq.pop();           // 出队',
 buttons:[{a:'enq',l:'⤵ 入队'},{a:'deq',l:'出队 ⤴'},{a:'reset',l:'重置'}],
 actions:{
   enq:function(){ var st=chState(); if(st.items.length>=5){ toast('队列最多显示 5 个元素'); return; } st.items.push(chRandInt(1,99)); chRenderStage(); },
   deq:function(){ var st=chState(); if(!st.items.length){ toast('队列已为空'); return; } st.items.shift(); chRenderStage(); },
   reset:function(){ var st=chState(); st.items=[1,2,3,4,5]; chRenderStage(); }},
 render:function(st){
   var items=st.items,n=items.length,x0=120,w=86,gap=24,y=150,h=54;
   var s='';
   if(n){
     s+=chTxt(x0+w/2,y-16,'front',13,'#ff6b81');
     s+=chTxt(x0+(n-1)*(w+gap)+w/2,y-16,'rear',13,'#ffd76a');
   }
   for(var i=0;i<n;i++){
     s+=chCell(x0+i*(w+gap),y,w,h,items[i]);
   }
   if(!n){ s+=chTxt(360,180,'队空',15,'rgba(160,220,250,.5)'); }
   s+=chTxt(360,290,'先进先出 FIFO · 队头 front / 队尾 rear',13,'rgba(160,220,250,.6)');
   return {html:chSvg(s),legend:'<i class="sw sw-pink"></i>队头 front <i class="sw sw-gold"></i>队尾 rear'};
 }},
{id:'cqueue',name:'循环队列',icon:'💍',desc:'取模运算把队列接成环',
 init:function(){ return {cells:[8,3,9,2,null,null],front:0,count:4}; },
 code:'// 循环队列：取模把队列接成环\n// 入队：rear = (rear + 1) % MaxSize\n// 队空：front == rear\n// 队满：(rear + 1) % MaxSize == front\n#include <queue>\nstd::queue<int> cq;   // 也可用数组 + 取模手写',
 buttons:[{a:'enq',l:'⤵ 入队'},{a:'deq',l:'出队 ⤴'},{a:'reset',l:'重置'}],
 actions:{
   enq:function(){ var st=chState(); if(st.count>=6){ toast('循环队列已满'); return; } st.cells[(st.front+st.count)%6]=chRandInt(1,99); st.count++; chRenderStage(); },
   deq:function(){ var st=chState(); if(!st.count){ toast('循环队列已空'); return; } st.cells[st.front]=null; st.front=(st.front+1)%6; st.count--; chRenderStage(); },
   reset:function(){ var st=chState(); st.cells=[8,3,9,2,null,null]; st.front=0; st.count=4; chRenderStage(); }},
 render:function(st){
   var cx=360,cy=175,r=95;
   var s='';
   for(var j=0;j<6;j++){
     var a=-Math.PI/2+j*2*Math.PI/6;
     var x=cx+r*Math.cos(a),y=cy+r*Math.sin(a);
     var v=st.cells[j];
     s+=chRect(x-24,y-18,48,36,v==null?'rgba(255,255,255,.05)':'rgba(90,180,240,.2)',8);
     if(v!=null) s+=chTxt(x,y+5,v,13,'#eafcff');
     s+=chTxt(x,y-30,j,11,'rgba(160,220,250,.5)');
   }
   var fa=-Math.PI/2+st.front*2*Math.PI/6;
   s+=chTxt(cx+(r+26)*Math.cos(fa),cy+(r+26)*Math.sin(fa),'front',12,'#ff6b81');
   if(st.count){
     var ra=-Math.PI/2+((st.front+st.count-1)%6)*2*Math.PI/6;
     s+=chTxt(cx+(r+26)*Math.cos(ra),cy+(r+26)*Math.sin(ra),'rear',12,'#ffd76a');
   }
   s+=chTxt(360,330,'front == rear 队空 · (rear+1)%6 == front 队满',13,'rgba(160,220,250,.6)');
   return {html:chSvg(s),legend:'<i class="sw sw-pink"></i>front <i class="sw sw-gold"></i>rear'};
 }},
/* ---------- 树结构 ---------- */
{id:'btree',name:'二叉树',icon:'🌳',desc:'层级结构，三种遍历方式',
 init:function(){ return {vals:[50,30,70,20,40,60,80],order:null}; },
 code:'// 递归遍历二叉树\nstruct TreeNode {\n  int val;\n  TreeNode *left, *right;\n};\nvoid inOrder(TreeNode* root) {\n  if (root == nullptr) return;\n  inOrder(root->left);   // 左\n  visit(root);           // 根\n  inOrder(root->right);  // 右\n}',
 buttons:[{a:'pre',l:'先序'},{a:'in',l:'中序'},{a:'post',l:'后序'},{a:'clear',l:'复位'}],
 actions:{
   pre:function(){ chState().order='pre'; chRenderStage(); },
   in:function(){ chState().order='in'; chRenderStage(); },
   post:function(){ chState().order='post'; chRenderStage(); },
   clear:function(){ chState().order=null; chRenderStage(); }},
 render:function(st){
   var vals=st.vals,n=vals.length;
   var s='';
   for(var i=1;i<n;i++){
     var p=(i-1)>>1, P=chTreePos(p), C=chTreePos(i);
     s+='<line x1="'+P.x+'" y1="'+P.y+'" x2="'+C.x+'" y2="'+C.y+'" class="cs3" stroke-width="2"/>';
   }
   var order=st.order?chTrav(st.order,vals):null;
   for(i=0;i<n;i++){
     var pos=chTreePos(i);
     s+='<circle cx="'+pos.x+'" cy="'+pos.y+'" r="20" class="cb" class="cs-cy" stroke-width="2"/>';
     s+=chTxt(pos.x,pos.y+5,vals[i],14,'#eafcff');
     if(order){
       var k=order.indexOf(i);
       s+=chTxt(pos.x+22,pos.y-16,k+1,12,'#ffd76a');
     }
   }
   var nm={pre:'先序（根→左→右）',in:'中序（左→根→右）',post:'后序（左→右→根）'};
   var bottom=st.order?(nm[st.order]+'：'+order.map(function(k){ return vals[k]; }).join(' → ')):'点击上方按钮查看遍历顺序';
   s+=chTxt(360,336,bottom,13,st.order?'#ffd76a':'rgba(160,220,250,.6)');
   return {html:chSvg(s),legend:'<i class="sw sw-gold"></i>访问序号'};
 }},
{id:'huffman',name:'哈夫曼树',icon:'🎯',desc:'带权路径长度最短的二叉树',
 init:function(){ return {}; },
 code:'// 哈夫曼：每次取两个权值最小的结点合并\n#include <queue>\nstd::priority_queue<int, std::vector<int>, std::greater<int>> pq;\n// 左分支记 0，右分支记 1\n// WPL = Σ 叶子权值 × 路径长度',
 buttons:[{a:'play',l:'▶️ 播放动画',p:1}],
 actions:{play:chPlayFlash},
 render:function(){
   var s='';
   var E=[{x1:360,y1:50,x2:200,y2:130,l:'0'},{x1:360,y1:50,x2:520,y2:130,l:'1'},
          {x1:520,y1:130,x2:430,y2:220,l:'0'},{x1:520,y1:130,x2:610,y2:220,l:'1'},
          {x1:610,y1:220,x2:540,y2:310,l:'0'},{x1:610,y1:220,x2:680,y2:310,l:'1'}];
   for(var i=0;i<E.length;i++){
     s+='<line x1="'+E[i].x1+'" y1="'+E[i].y1+'" x2="'+E[i].x2+'" y2="'+E[i].y2+'" class="cs4" stroke-width="2"/>';
     s+=chTxt((E[i].x1+E[i].x2)/2+12,(E[i].y1+E[i].y2)/2,E[i].l,12,'#ffd76a');
   }
   var N=[[360,50,'18',null],[200,130,'7','a：7 → 0'],[520,130,'11',null],[430,220,'5','b：5 → 10'],
          [610,220,'6',null],[540,310,'2','c：2 → 110'],[680,310,'4','d：4 → 111']];
   for(i=0;i<N.length;i++){
     s+='<circle cx="'+N[i][0]+'" cy="'+N[i][1]+'" r="19" class="cb" class="cs-cy" stroke-width="2"/>';
     s+=chTxt(N[i][0],N[i][1]+5,N[i][2],14,'#eafcff');
     if(N[i][3]) s+=chTxt(N[i][0],N[i][1]+34,N[i][3],12,'#7be0a2');
   }
   s+=chTxt(360,352,'WPL = 7×2 + 5×2 + 2×3 + 4×3 = 42',13,'rgba(160,220,250,.7)');
   return {html:chSvg(s),legend:'<i class="sw sw-ok"></i>叶子（权值 → 编码） <i class="sw sw-gold"></i>分支 0/1'};
 }},
{id:'bst',name:'二叉排序树',icon:'🔎',desc:'左 < 根 < 右，中序即有序',
 init:function(){ return {vals:[8,3,10,1,6,14,4,7,13]}; },
 code:'// 二叉排序树：左 < 根 < 右\nTreeNode* insert(TreeNode* t, int x) {\n  if (t == nullptr) return new TreeNode{x};\n  if (x < t->val)  t->left  = insert(t->left,  x);\n  else             t->right = insert(t->right, x);\n  return t;\n}',
 buttons:[{a:'random',l:'🎲 随机数据'},{a:'play',l:'▶️ 播放动画',p:1}],
 actions:{random:function(){
   var st=chState(),v=[];
   while(v.length<8){ var x=chRandInt(1,99); if(v.indexOf(x)<0) v.push(x); }
   st.vals=v; chRenderStage(); },
   play:chPlayFlash},
 render:function(st){
   function node(v){ return {v:v,l:null,r:null}; }
   function ins(n,v){ if(!n) return node(v); if(v<n.v) n.l=ins(n.l,v); else n.r=ins(n.r,v); return n; }
   var root=null,i;
   for(i=0;i<st.vals.length;i++) root=ins(root,st.vals[i]);
   var cnt=0;
   (function walk(n){ if(!n) return; walk(n.l); n.idx=cnt++; walk(n.r); })(root);
   function draw(n,d){
     if(!n) return '';
     var x=120+n.idx*((560)/(cnt-1||1)), y=70+d*96;
     var s='';
     if(n.l){
       var lx=120+n.l.idx*((560)/(cnt-1||1)), ly=70+(d+1)*96;
       s+='<line x1="'+x+'" y1="'+y+'" x2="'+lx+'" y2="'+ly+'" class="cs3" stroke-width="2"/>'+draw(n.l,d+1);
     }
     if(n.r){
       var rx=120+n.r.idx*((560)/(cnt-1||1)), ry=70+(d+1)*96;
       s+='<line x1="'+x+'" y1="'+y+'" x2="'+rx+'" y2="'+ry+'" class="cs3" stroke-width="2"/>'+draw(n.r,d+1);
     }
     s+='<circle cx="'+x+'" cy="'+y+'" r="19" class="cb" class="cs-cy" stroke-width="2"/>'+chTxt(x,y+5,n.v,13,'#eafcff');
     return s;
   }
   var ino=[];
   (function walk(n){ if(!n) return; walk(n.l); ino.push(n.v); walk(n.r); })(root);
   var s=draw(root,0);
   s+=chTxt(360,340,'中序遍历（有序序列）：'+ino.join(' → '),13,'#7be0a2');
   return {html:chSvg(s),legend:'<i class="sw sw-ok"></i>中序即有序'};
 }},
{id:'avl',name:'平衡二叉树',icon:'⚖️',desc:'平衡因子超限时旋转调整',
 init:function(){ return {}; },
 code:'// AVL：平衡因子 BF = 左高 - 右高，|BF| > 1 时旋转\nstruct AvlNode {\n  int val, height;\n  AvlNode *left, *right;\n};\n// LL 型 → 右旋    RR 型 → 左旋\n// LR 型 → 先左后右   RL 型 → 先右后左',
 buttons:[{a:'play',l:'▶️ 播放动画',p:1}],
 actions:{play:chPlayFlash},
 render:function(){
   var s='';
   function tnode(x,y,v,bf){ return '<circle cx="'+x+'" cy="'+y+'" r="18" class="cb" class="cs-cy" stroke-width="2"/>'+chTxt(x,y+5,v,13,'#eafcff')+chTxt(x+20,y-16,bf,12,'#ff9d9d'); }
   s+='<line x1="130" y1="120" x2="160" y2="200" class="cs3" stroke-width="2"/>';
   s+='<line x1="160" y1="200" x2="190" y2="280" class="cs3" stroke-width="2"/>';
   s+=tnode(130,120,30,'+2')+tnode(160,200,20,'+1')+tnode(190,280,10,'0');
   s+=chTxt(255,190,'LL 型失衡',12,'#ff9d9d');
   s+=chArrow(300,190,360,190,'#ffd76a');
   s+=chTxt(330,172,'右旋',12,'#ffd76a');
   s+='<line x1="470" y1="120" x2="420" y2="200" class="cs3" stroke-width="2"/>';
   s+='<line x1="470" y1="120" x2="520" y2="200" class="cs3" stroke-width="2"/>';
   s+=tnode(470,120,20,'0')+tnode(420,200,10,'0')+tnode(520,200,30,'0');
   s+=chTxt(470,270,'旋转后恢复平衡',12,'#7be0a2');
   s+=chTxt(360,340,'平衡因子 = 左子树高 − 右子树高 · 保持 O(log n)',13,'rgba(160,220,250,.6)');
   return {html:chSvg(s),legend:'<i class="sw sw-bad"></i>平衡因子 <i class="sw sw-gold"></i>旋转方向'};
 }},
{id:'heap',name:'堆',icon:'⛰️',desc:'完全二叉树，根为最大（小）值',
 init:function(){ return {mode:'max',vals:[50,42,35,20,18,27,9]}; },
 code:'// 堆：完全二叉树，根是最大（小）值\n#include <queue>\nstd::priority_queue<int> maxHeap;   // 大根堆\nstd::priority_queue<int, std::vector<int>, std::greater<int>> minHeap;\n// 插入 O(log n)，删除堆顶 O(log n)',
 buttons:[{a:'max',l:'大顶堆'},{a:'min',l:'小顶堆'}],
 actions:{
   max:function(){ var st=chState(); st.mode='max'; st.vals=[50,42,35,20,18,27,9]; chRenderStage(); },
   min:function(){ var st=chState(); st.mode='min'; st.vals=[9,18,20,27,35,42,50]; chRenderStage(); }},
 render:function(st){
   var vals=st.vals,n=vals.length;
   var s='';
   for(var i=1;i<n;i++){
     var p=(i-1)>>1, P=chTreePos(p), C=chTreePos(i);
     s+='<line x1="'+P.x+'" y1="'+P.y+'" x2="'+C.x+'" y2="'+C.y+'" class="cs3" stroke-width="2"/>';
   }
   for(i=0;i<n;i++){
     var pos=chTreePos(i);
     s+='<circle cx="'+pos.x+'" cy="'+pos.y+'" r="20" class="cb" class="cs-cy" stroke-width="2"/>';
     s+=chTxt(pos.x,pos.y+5,vals[i],13,'#eafcff');
   }
   s+=chTxt(360,340,(st.mode==='max'?'大顶堆：任意结点 ≥ 其孩子':'小顶堆：任意结点 ≤ 其孩子')+' · 用数组顺序存储',13,'rgba(160,220,250,.6)');
   return {html:chSvg(s),legend:'<i style="background:rgba(90,180,240,.3)"></i>堆结点'};
 }},
/* ---------- 图结构 ---------- */
{id:'adjmatrix',name:'邻接矩阵',icon:'🕸️',desc:'n×n 数组表示边，适合稠密图',
 init:function(){ return {}; },
 code:'// 邻接矩阵：g[i][j] = 权值，无边为 ∞\n#include <vector>\nconst int INF = 0x3f3f3f3f;\nstd::vector<std::vector<int>> g(n, std::vector<int>(n, INF));\n// 无向图对称，有向图不对称\n// 空间 O(n²)，判断任意边 O(1)',
 buttons:[{a:'play',l:'▶️ 播放动画',p:1}],
 actions:{play:chPlayFlash},
 render:function(){
   var names=['A','B','C','D','E'];
   var W=[[0,4,0,2,0],[4,0,1,0,5],[0,1,0,3,0],[2,0,3,0,6],[0,5,0,6,0]];
   var head=[''].concat(names);
   var rows=[];
   for(var i=0;i<5;i++){
     var row=[names[i]];
     for(var j=0;j<5;j++){ row.push(W[i][j]?String(W[i][j]):'—'); }
     rows.push(row);
   }
   return {html:chTable(head,rows),legend:'数字为边的权值 · "—" 表示无边（∞）'};
 }},
{id:'adjlist',name:'邻接表',icon:'📋',desc:'顶点数组 + 边链表，适合稀疏图',
 init:function(){ return {}; },
 code:'// 邻接表：顶点数组 + 边链表\n#include <vector>\nstruct Edge { int to, w; };\nstd::vector<Edge> g[N];   // g[u] 存 u 的所有出边\n// 无向图每条边存两次，空间 O(n + e)',
 buttons:[{a:'play',l:'▶️ 播放动画',p:1}],
 actions:{play:chPlayFlash},
 render:function(){
   var g=[[[1,4],[3,2]],[[0,4],[2,1],[4,5]],[[1,1],[3,3]],[[0,2],[2,3],[4,6]],[[1,5],[3,6]]];
   var s='';
   for(var i=0;i<5;i++){
     var y=60+i*58;
     s+='<circle cx="90" cy="'+y+'" r="20" class="cb" class="cs-cy" stroke-width="2"/>';
     s+=chTxt(90,y+5,i,14,'#eafcff');
     s+='<line x1="110" y1="'+y+'" x2="150" y2="'+y+'" class="cs5" stroke-width="2"/>';
     var x=160;
     for(var j=0;j<g[i].length;j++){
       s+=chRect(x,y-18,64,36,'rgba(90,180,240,.2)',8);
       s+=chTxt(x+20,y+5,g[i][j][0],13,'#eafcff');
       s+=chTxt(x+48,y+5,g[i][j][1],11,'#ffd76a');
       if(j<g[i].length-1){ s+=chArrow(x+64,y,x+84,y); }
       else{ s+=chTxt(x+84,y+5,'∧',13,'rgba(255,150,150,.85)'); }
       x+=104;
     }
   }
   s+=chTxt(360,336,'顶点数组 + 边链表 · 空间 O(n+e)',13,'rgba(160,220,250,.6)');
   return {html:chSvg(s),legend:'<i class="sw sw-gold"></i>权值'};
 }},
{id:'prim',name:'最小生成树 Prim',icon:'🌉',desc:'贪心取最近顶点，逐点连入生成树',
 init:function(){ return {}; },
 code:'// Prim：任选起点，每次把最近的未收录顶点加入\n#include <queue>\nfor (int i = 1; i < n; i++) {\n  // 未收录顶点中选 dist 最小者 u\n  // 用 u 更新其余顶点的 dist\n}',
 buttons:[{a:'play',l:'▶️ 播放动画',p:1}],
 actions:{play:chPlayFlash},
 render:function(){
   var P=[[150,110],[360,70],[570,120],[200,260],[520,270]];
   var E=[[0,1,4],[0,3,2],[1,2,5],[1,3,7],[1,4,6],[2,4,3],[3,4,8]];
   var MST=[[0,1],[0,3],[1,2],[2,4]];
   var s='';
   for(var i=0;i<E.length;i++){
     var e=E[i];
     var isM=MST.some(function(m){ return (m[0]===e[0]&&m[1]===e[1])||(m[0]===e[1]&&m[1]===e[0]); });
     var x1=P[e[0]][0],y1=P[e[0]][1],x2=P[e[1]][0],y2=P[e[1]][1];
     s+='<line x1="'+x1+'" y1="'+y1+'" x2="'+x2+'" y2="'+y2+'" stroke="'+(isM?'#7be0a2':'rgba(160,220,250,.28)')+'" stroke-width="'+(isM?4:2)+'"/>';
     s+=chTxt((x1+x2)/2,(y1+y2)/2-8,e[2],12,isM?'#7be0a2':'rgba(160,220,250,.5)');
   }
   for(i=0;i<P.length;i++){
     s+='<circle cx="'+P[i][0]+'" cy="'+P[i][1]+'" r="19" class="cb" class="cs-cy" stroke-width="2"/>';
     s+=chTxt(P[i][0],P[i][1]+5,i,14,'#eafcff');
   }
   s+=chTxt(360,340,'MST = {0-3, 0-1, 1-2, 2-4} · 总权值 2+4+5+3 = 14',13,'#7be0a2');
   return {html:chSvg(s),legend:'<i class="sw sw-ok"></i>生成树边 <i style="background:rgba(160,220,250,.3)"></i>其余边'};
 }},
{id:'dijkstra',name:'最短路径 Dijkstra',icon:'🛰️',desc:'单源最短路径，贪心扩展',
 init:function(){ return {}; },
 code:'// Dijkstra：单源最短路径（非负权）\n#include <queue>\n// dist[v] = min(dist[v], dist[u] + w[u][v])\n// 每次选未收录的 dist 最小顶点 u\n// 可用 priority_queue 优化到 O((n+e) log n)',
 buttons:[{a:'play',l:'▶️ 播放动画',p:1}],
 actions:{play:chPlayFlash},
 render:function(){
   var P=[[150,110],[360,70],[570,120],[200,260],[520,270]];
   var E=[[0,1,4],[0,3,2],[1,2,5],[1,3,7],[1,4,6],[2,4,3],[3,4,8]];
   var SP=[[0,1],[0,3],[3,2],[2,4]];
   var dist=[0,4,5,2,8];
   var s='';
   for(var i=0;i<E.length;i++){
     var e=E[i];
     var isS=SP.some(function(m){ return (m[0]===e[0]&&m[1]===e[1])||(m[0]===e[1]&&m[1]===e[0]); });
     var x1=P[e[0]][0],y1=P[e[0]][1],x2=P[e[1]][0],y2=P[e[1]][1];
     s+='<line x1="'+x1+'" y1="'+y1+'" x2="'+x2+'" y2="'+y2+'" stroke="'+(isS?'#7be0a2':'rgba(160,220,250,.28)')+'" stroke-width="'+(isS?4:2)+'"/>';
     s+=chTxt((x1+x2)/2,(y1+y2)/2-8,e[2],12,isS?'#7be0a2':'rgba(160,220,250,.5)');
   }
   for(i=0;i<P.length;i++){
     s+='<circle cx="'+P[i][0]+'" cy="'+P[i][1]+'" r="19" class="cb" stroke="'+(i===0?'#ffd76a':'#5fc8f0')+'" stroke-width="2"/>';
     s+=chTxt(P[i][0],P[i][1]+5,i,14,'#eafcff');
     s+=chTxt(P[i][0],P[i][1]+38,'d='+dist[i],12,'#ffd76a');
   }
   s+=chTxt(360,340,'源点 0 到各顶点的最短距离：0 4 5 2 8',13,'#7be0a2');
   return {html:chSvg(s),legend:'<i class="sw sw-ok"></i>最短路径 <i class="sw sw-gold"></i>源点/距离'};
 }},
{id:'topo',name:'拓扑排序',icon:'📐',desc:'AOV 网，依次输出入度为 0 的顶点',
 init:function(){ return {}; },
 code:'// 拓扑排序：AOV 网\n#include <queue>\n// 依次输出入度为 0 的顶点并删除其出边\nwhile (!q.empty()) {\n  int u = q.front(); q.pop();\n  for (int v : g[u])\n    if (--indegree[v] == 0) q.push(v);\n}',
 buttons:[{a:'play',l:'▶️ 播放动画',p:1}],
 actions:{play:chPlayFlash},
 render:function(){
   var P=[[120,100],[360,60],[120,240],[360,180],[600,120],[360,300]];
   var E=[[0,1],[0,2],[1,3],[2,3],[2,5],[3,4],[5,4]];
   var ord=[0,1,2,3,5,4];
   var s='';
   for(var i=0;i<E.length;i++){
     s+=chArrow(P[E[i][0]][0],P[E[i][0]][1],P[E[i][1]][0],P[E[i][1]][1]);
   }
   for(i=0;i<P.length;i++){
     s+='<circle cx="'+P[i][0]+'" cy="'+P[i][1]+'" r="19" class="cb" class="cs-cy" stroke-width="2"/>';
     s+=chTxt(P[i][0],P[i][1]+5,i,14,'#eafcff');
     s+=chTxt(P[i][0]+22,P[i][1]-16,ord[i]+1,12,'#ffd76a');
   }
   s+=chTxt(360,342,'拓扑序列：0 → 1 → 2 → 3 → 5 → 4（橙色为输出次序）',13,'#7be0a2');
   return {html:chSvg(s),legend:'<i class="sw sw-gold"></i>输出次序'};
 }},
/* ---------- 查找与排序 ---------- */
{id:'binarysearch',name:'折半查找',icon:'🔍',desc:'有序表 O(log n)，逐步演示',hasInput:true,
 init:function(){ var a=[3,7,12,19,24,31,42,56,68,79,91]; return {arr:a,target:42,steps:bsSteps(a,42),step:0}; },
 code:'// 折半查找：仅适用于有序表 O(log n)\nwhile (low <= high) {\n  mid = (low + high) / 2;\n  if (a[mid] == key) return mid;\n  if (a[mid] < key) low = mid + 1;\n  else high = mid - 1;\n}',
 buttons:[{a:'next',l:'▶ 下一步'},{a:'reset',l:'重置'}],
 actions:{
   next:function(){ var st=chState(); if(st.step<st.steps.length-1) st.step++; else toast('查找完成，点击重置再来一次'); chRenderStage(); },
   reset:function(){ chState().step=0; chRenderStage(); }},
 render:function(st){
   var a=st.arr,n=a.length,x0=40,w=640/n,y=110,h=52;
   var sp=st.steps[Math.min(st.step,st.steps.length-1)];
   var s='';
   if(sp&&st.step<st.steps.length){
     s+=chRect(x0+sp.lo*w,y-14,(sp.hi-sp.lo+1)*w,h+28,'rgba(121,220,232,.08)',10);
     s+=chTxt(x0+sp.lo*w+6,y-24,'low='+sp.lo,11,'#7be0a2','start');
     s+=chTxt(x0+sp.hi*w+w-6,y-24,'high='+sp.hi,11,'#7be0a2','end');
   }
   for(var i=0;i<n;i++){
     var mid=(sp&&i===sp.mid);
     var found=(sp&&sp.found&&i===sp.mid);
     var fill=found?'rgba(123,224,162,.45)':mid?'rgba(255,215,106,.35)':'rgba(90,180,240,.16)';
     s+=chRect(x0+i*w+2,y,w-4,h,fill,6);
     s+=chTxt(x0+i*w+w/2,y+h/2+5,a[i],13,'#eafcff');
   }
   var status='';
   if(sp){
     status='第 '+(st.step+1)+' 步：mid='+sp.mid+'，a[mid]='+a[sp.mid]+'，目标 '+st.target+' → '+
       (sp.found?'找到！':'a[mid] '+(a[sp.mid]<st.target?'<':'≥')+' 目标，'+(a[sp.mid]<st.target?'low=mid+1':'high=mid-1'));
   }
   s+=chTxt(360,210,status,13,sp&&sp.found?'#7be0a2':'#ffd76a');
   s+=chTxt(360,250,'查找 '+st.target+' · 每次比较排除一半元素',13,'rgba(160,220,250,.6)');
   s+=chTxt(360,290,'更新数据将自动排序',12,'rgba(160,220,250,.4)');
   return {html:chSvg(s),legend:'<i style="background:rgba(255,215,106,.35)"></i>mid <i style="background:rgba(123,224,162,.45)"></i>命中 <i style="background:rgba(121,220,232,.08)"></i>查找区间'};
 }},
{id:'hashtable',name:'哈希表',icon:'🗃️',desc:'h(key)=key%7，链地址法处理冲突',
 init:function(){ return {}; },
 code:'// 哈希表：h(key) = key % 7\n// 冲突处理：链地址法（拉链）\n// 装填因子 α = 记录数 / 表长\n// 平均查找长度 ASL = 1 + α/2',
 buttons:[{a:'play',l:'▶️ 播放动画',p:1}],
 actions:{play:chPlayFlash},
 render:function(){
   var B=[[14],[1,36],[23],[],[11],[19,68],[55]];
   var keys=[19,1,23,14,55,68,11,36];
   var s=chTxt(360,40,'h(key) = key % 7 · 链地址法',14,'rgba(160,220,250,.8)');
   var x0=70,w=90;
   for(var i=0;i<7;i++){
     var x=x0+i*w;
     s+=chRect(x,70,80,36,'rgba(90,180,240,.2)',8)+chTxt(x+40,92,i,14,'#79dce8');
     var y=140;
     for(var j=0;j<B[i].length;j++){
       s+=chRect(x+4,y,72,34,'rgba(90,180,240,.14)',6)+chTxt(x+40,y+21,B[i][j],12,'#eafcff');
       if(j<B[i].length-1){ s+='<line x1="'+(x+40)+'" y1="'+(y+34)+'" x2="'+(x+40)+'" y2="'+(y+44)+'" class="cs3" stroke-width="2"/>'; }
       y+=44;
     }
   }
   s+=chTxt(360,336,'同义词拉成链表：19 与 68 冲突于桶 5，1 与 36 冲突于桶 1',13,'rgba(160,220,250,.6)');
   return {html:chSvg(s),legend:'<i class="sw sw-cy"></i>桶下标'};
 }},
{id:'bubble',name:'冒泡排序',icon:'🫧',desc:'每趟把最大元素"浮"到最后',hasInput:true,
 init:function(){ return {arr:[7,3,9,2,8,5],i:0,j:0,done:false,swapped:false}; },
 code:'// 冒泡排序：相邻比较，大者后移\nfor (i = 0; i < n - 1; i++)\n  for (j = 0; j < n - 1 - i; j++)\n    if (a[j] > a[j + 1])\n      swap(a[j], a[j + 1]);\n// 稳定 · O(n²)',
 buttons:[{a:'next',l:'▶ 下一步'},{a:'reset',l:'重置'}],
 actions:{
   next:function(){
     var st=chState();
     if(st.done){ toast('排序已完成，点击重置'); return; }
     var a=st.arr,n=a.length;
     if(st.j>n-2-st.i){ st.i++; st.j=0;
       if(st.i>n-2){ st.done=true; chRenderStage(); return; } }
     st.swapped=a[st.j]>a[st.j+1];
     if(st.swapped){ var t=a[st.j]; a[st.j]=a[st.j+1]; a[st.j+1]=t; }
     st.j++;
     chRenderStage();
   },
   reset:function(){ var st=chState(); st.arr=[7,3,9,2,8,5]; st.i=0; st.j=0; st.done=false; st.swapped=false; chRenderStage(); }},
 render:function(st){
   var a=st.arr,n=a.length,x0=70,w=580/n,y=120,h=56;
   var s='';
   for(var i=0;i<n;i++){
     var fill='rgba(90,180,240,.16)';
     if(st.done) fill='rgba(123,224,162,.35)';
     else if(i===st.j||i===st.j+1) fill=st.swapped?'rgba(255,120,120,.35)':'rgba(255,215,106,.35)';
     else if(i>=n-st.i) fill='rgba(123,224,162,.28)';
     s+=chRect(x0+i*w+3,y,w-6,h,fill,6);
     s+=chTxt(x0+i*w+w/2,y+h/2+5,a[i],14,'#eafcff');
   }
   var msg=st.done?'排序完成！':'第 '+(st.i+1)+' 趟 · 比较 a['+st.j+'] 与 a['+(st.j+1)+']'+(st.swapped?' → 交换':'');
   s+=chTxt(360,240,msg,13,st.done?'#7be0a2':'#ffd76a');
   s+=chTxt(360,280,'绿色为已就位的最大元素',12,'#7be0a2');
   return {html:chSvg(s),legend:'<i style="background:rgba(255,215,106,.35)"></i>正在比较 <i style="background:rgba(255,120,120,.35)"></i>发生交换 <i style="background:rgba(123,224,162,.3)"></i>已就位'};
 }},
{id:'quick',name:'快速排序',icon:'⚡',desc:'一趟划分确定枢轴位置，递归处理',
 init:function(){ return {}; },
 code:'// 快速排序：一趟划分 + 递归\nint Partition(int a[], int low, int high) {\n  int p = a[low];\n  while (low < high) {\n    while (low < high && a[high] >= p) high--;\n    a[low] = a[high];\n    while (low < high && a[low] <= p) low++;\n    a[high] = a[low];\n  }\n  a[low] = p; return low;\n}',
 buttons:[{a:'play',l:'▶️ 播放动画',p:1}],
 actions:{play:chPlayFlash},
 render:function(){
   var orig=[5,2,9,3,7,6,1,8],x0=60,w=75,y=70,h=48;
   var s=chTxt(360,38,'一次划分（枢轴 pivot = 5）',14,'rgba(160,220,250,.8)');
   for(var i=0;i<orig.length;i++){
     s+=chRect(x0+i*w+4,y,w-8,h,i===0?'rgba(255,215,106,.4)':'rgba(90,180,240,.16)',6);
     s+=chTxt(x0+i*w+w/2,y+h/2+5,orig[i],14,'#eafcff');
   }
   var left=[1,2,3],right=[9,7,6,8];
   var y2=170;
   var xl=150;
   for(i=0;i<left.length;i++){ s+=chRect(xl+i*w+4,y2,w-8,h,'rgba(123,224,162,.25)',6)+chTxt(xl+i*w+w/2,y2+h/2+5,left[i],14,'#eafcff'); }
   s+=chRect(450,y2,w-8,h,'rgba(255,215,106,.4)',6)+chTxt(450+(w-8)/2,y2+h/2+5,5,14,'#eafcff');
   var xr=540;
   for(i=0;i<right.length;i++){ s+=chRect(xr+i*w+4,y2,w-8,h,'rgba(90,180,240,.16)',6)+chTxt(xr+i*w+w/2,y2+h/2+5,right[i],14,'#eafcff'); }
   s+=chTxt(330,270,'左子表（≤ 枢轴）',12,'#7be0a2');
   s+=chTxt(487,270,'枢轴就位',12,'#ffd76a');
   s+=chTxt(640,270,'右子表（≥ 枢轴）',12,'#9fd8f2');
   s+=chTxt(360,320,'平均 O(n log n) · 最坏 O(n²) · 不稳定',13,'rgba(160,220,250,.6)');
   return {html:chSvg(s),legend:'<i style="background:rgba(255,215,106,.4)"></i>枢轴 <i style="background:rgba(123,224,162,.3)"></i>左子表'};
 }},
{id:'merge',name:'归并排序',icon:'🧩',desc:'分治 + 二路归并，稳定 O(n log n)',
 init:function(){ return {}; },
 code:'// 归并排序：分治 + 二路归并\nvoid Merge(int a[], int l, int m, int r) {\n  // 合并有序区间 [l,m] 与 [m+1,r]\n}\nvoid MergeSort(int a[], int l, int r) {\n  if (l >= r) return;\n  int m = (l + r) / 2;\n  MergeSort(a, l, m);\n  MergeSort(a, m + 1, r);\n  Merge(a, l, m, r);\n}',
 buttons:[{a:'play',l:'▶️ 播放动画',p:1}],
 actions:{play:chPlayFlash},
 render:function(){
   var orig=[38,27,43,3,9,82,10];
   var L=[3,27,38,43],R=[9,10,82],M=[3,9,10,27,38,43,82];
   var s='',x0=130,w=66,h=44,y1=60;
   function row(arr,y,fill,label){
     var str='';
     for(var i=0;i<arr.length;i++){
       str+=chRect(x0+i*w+4,y,w-8,h,fill,6)+chTxt(x0+i*w+w/2,y+h/2+5,arr[i],13,'#eafcff');
     }
     if(label) str+=chTxt(x0-40,y+h/2+5,label,12,'#79dce8','end');
     return str;
   }
   s+=row(orig,y1,'rgba(90,180,240,.16)','原序列');
   s+=row(L,170,'rgba(155,123,245,.25)','左半');
   s+=row(R,240,'rgba(155,123,245,.25)','右半');
   s+=chArrow(340,284,340,316,'#ffd76a');
   s+=row(M,330,'rgba(123,224,162,.3)','合并');
   s+=chTxt(360,26,'分治：拆到只剩一个元素，再两两归并',13,'rgba(160,220,250,.7)');
   return {html:chSvg(s),legend:'<i style="background:rgba(155,123,245,.25)"></i>有序子表 <i style="background:rgba(123,224,162,.3)"></i>归并结果'};
 }},
{id:'heapsort',name:'堆排序',icon:'🗻',desc:'建堆 + 反复交换堆顶与末尾',
 init:function(){ return {}; },
 code:'// 堆排序：建堆 + 反复调整\nBuildMaxHeap(a);\nfor (i = n - 1; i > 0; i--) {\n  swap(a[0], a[i]);   // 堆顶归位\n  HeapAdjust(a, 0, i - 1); // 下沉\n}\n// O(n log n) · 不稳定',
 buttons:[{a:'play',l:'▶️ 播放动画',p:1}],
 actions:{play:chPlayFlash},
 render:function(){
   var vals=[50,42,35,20,18,27,9];
   var s=chTxt(200,40,'① 大顶堆',14,'rgba(160,220,250,.8)');
   for(var i=1;i<vals.length;i++){
     var p=(i-1)>>1,P=chTreePos(p),C=chTreePos(i);
     P.x-=140;
     C.x-=140;
     s+='<line x1="'+P.x+'" y1="'+P.y+'" x2="'+C.x+'" y2="'+C.y+'" class="cs3" stroke-width="2"/>';
   }
   for(i=0;i<vals.length;i++){
     var pos=chTreePos(i); pos.x-=140;
     s+='<circle cx="'+pos.x+'" cy="'+pos.y+'" r="17" class="cb" class="cs-cy" stroke-width="2"/>';
     s+=chTxt(pos.x,pos.y+5,vals[i],12,'#eafcff');
   }
   s+=chTxt(200,320,'堆顶 50 与末尾 9 交换 → 下沉调整',12,'#ffd76a');
   s+=chArrow(300,160,400,160,'#ffd76a');
   s+=chTxt(350,130,'② 反复交换',13,'#ffd76a');
   var arr=[50,42,35,20,18,27,9];
   var x0=440,w=40,h=44,y=100;
   for(i=0;i<arr.length;i++){
     s+=chRect(x0+i*w+2,y,w-4,h,i===0?'rgba(255,215,106,.35)':'rgba(90,180,240,.16)',6);
     s+=chTxt(x0+i*w+w/2,y+h/2+5,arr[i],12,'#eafcff');
   }
   s+=chTxt(600,180,'堆顶 → 数组末尾',12,'#ffd76a');
   s+=chTxt(600,210,'最终得到有序序列',12,'#7be0a2');
   return {html:chSvg(s),legend:'<i style="background:rgba(255,215,106,.35)"></i>堆顶'};
 }},
/* ---------- 速查表 ---------- */
{id:'table-complex',name:'复杂度速查表',icon:'📑',desc:'常用结构的时间与空间复杂度',
 init:function(){ return {}; },
 code:'// 速查表：熟记复杂度\n// 考前对照复习，事半功倍',
 buttons:[{a:'play',l:'▶️ 刷新',p:1}],
 actions:{play:chPlayFlash},
 render:function(){
   return {html:chTable(['结构','查找','插入','删除','空间'],
     [['顺序表','O(1)','O(n)','O(n)','O(n)'],
      ['单链表','O(n)','O(1)','O(1)','O(n)'],
      ['顺序栈','O(n)','O(1)','O(1)','O(n)'],
      ['顺序队列','O(n)','O(1)','O(1)','O(n)'],
      ['二叉排序树（平均）','O(log n)','O(log n)','O(log n)','O(n)'],
      ['平衡二叉树','O(log n)','O(log n)','O(log n)','O(n)'],
      ['哈希表（平均）','O(1)','O(1)','O(1)','O(n)'],
      ['图 · 邻接矩阵','O(1)','O(1)','O(1)','O(n²)'],
      ['图 · 邻接表','O(n)','O(1)','O(e)','O(n+e)']]),
      legend:'指平均情况 · 具体与实现有关'};
 }},
{id:'table-sort',name:'排序算法对比表',icon:'🏷️',desc:'八大排序的复杂度与稳定性',
 init:function(){ return {}; },
 code:'// 排序对比：复杂度与稳定性\n// 不稳定口诀：快选希堆',
 buttons:[{a:'play',l:'▶️ 刷新',p:1}],
 actions:{play:chPlayFlash},
 render:function(){
   return {html:chTable(['排序算法','最好','平均','最坏','空间','稳定性'],
     [['冒泡排序','O(n)','O(n²)','O(n²)','O(1)','稳定'],
      ['直接插入','O(n)','O(n²)','O(n²)','O(1)','稳定'],
      ['简单选择','O(n²)','O(n²)','O(n²)','O(1)','不稳定'],
      ['希尔排序','O(n^1.3)','O(n^1.3)','O(n²)','O(1)','不稳定'],
      ['快速排序','O(n log n)','O(n log n)','O(n²)','O(log n)','不稳定'],
      ['归并排序','O(n log n)','O(n log n)','O(n log n)','O(n)','稳定'],
      ['堆排序','O(n log n)','O(n log n)','O(n log n)','O(1)','不稳定'],
      ['基数排序','O(d(n+r))','O(d(n+r))','O(d(n+r))','O(n+r)','稳定']]),
      legend:'不稳定口诀：快（速）选（择）希（尔）堆（排序）'};
 }},
{id:'table-sl',name:'顺序表 vs 链表',icon:'⚔️',desc:'两种线性结构的场景选择',
 init:function(){ return {}; },
 code:'// 顺序表 vs 链表\n// 查得多用顺序表，改得多用链表',
 buttons:[{a:'play',l:'▶️ 刷新',p:1}],
 actions:{play:chPlayFlash},
 render:function(){
   return {html:chTable(['对比项','顺序表','链表'],
     [['存储方式','连续存储，地址可计算','结点散落，靠指针链接'],
      ['随机访问','O(1) 按下标直接访问','O(n) 需从头遍历'],
      ['插入 / 删除','O(n) 需移动元素','O(1) 仅改指针'],
      ['空间开销','无指针开销，可能预留空间','每个结点多存一个指针'],
      ['适用场景','频繁查找、元素个数稳定','频繁增删、元素个数变动大']]),
      legend:'按场景选择：查找多 → 顺序表；增删多 → 链表'};
 }}
];
chTotalEl.textContent=String(CH_ITEMS.length);
chNavEl.addEventListener('click',function(e){
  var it=e.target.closest('.ch-item');
  if(it) chSwitch(it.getAttribute('data-id'));
});
chBtnsEl.addEventListener('click',function(e){
  var b=e.target.closest('.ch-btn');
  if(!b||!CH_CUR) return;
  var a=b.getAttribute('data-a');
  if(CH_CUR.actions&&CH_CUR.actions[a]) CH_CUR.actions[a]();
});
document.getElementById('ch-update').addEventListener('click',function(){
  var p=chParseInput();
  if(!p){ toast('请输入有效的数字'); return; }
  var st=chState();
  if(CH_CUR.id==='bubble'){
    if(p.length>14) p=p.slice(0,14);
    st.arr=p; st.i=0; st.j=0; st.done=false; st.swapped=false;
  }else if(CH_CUR.id==='binarysearch'){
    if(p.length>16) p=p.slice(0,16);
    st.arr=p.slice().sort(function(a,b){ return a-b; });
    st.target=st.arr[Math.min(st.arr.length-1,Math.floor(st.arr.length*0.62))];
    st.steps=bsSteps(st.arr,st.target);
    st.step=0;
  }else{
    st.data=p;
  }
  chRenderStage();
  toast('图表已更新');
});
bindDrops(viewCharts);
bindTouchFx(viewCharts);
chSwitch('bar');

/* ================= MISTAKES VIEW (错题巩固) ================= */
var viewMistakes=document.getElementById('view-mistakes');
var mkListEl=document.getElementById('mk-list');
var mkStatsEl=document.getElementById('mk-stats');
var mkSideEl=document.getElementById('mk-side');
var mkQEl=document.getElementById('mk-q');
var mkCatEl=document.getElementById('mk-cat-filter');
var MK_KEY='mzx_mistakes';
var MK_API_BASE=location.port==='8080'?location.origin:'http://127.0.0.1:8080';
var MK_API_WRONG=MK_API_BASE+'/api/wrong-questions';
var MK_API_RECOMMENDATIONS=MK_API_BASE+'/api/recommendations';
var MK_API_SUBMIT=MK_API_BASE+'/api/exercises/submit';
var MK=[];
var mkFilter={view:'all',status:'all',q:'',cat:'全部章节'};
var mkArmId=null,mkArmT=null;
var mkReviewModal=document.getElementById('mk-review-modal');
var mkReviewMeta=document.getElementById('mk-review-meta');
var mkReviewContent=document.getElementById('mk-review-content');
var mkReviewResult=document.getElementById('mk-review-result');
var mkReviewSubmit=document.getElementById('mk-review-submit');
var mkReviewClose=document.getElementById('mk-review-close');
var mkReviewState={wrongId:null,exercise:null,answer:null,submitting:false,requestToken:0};

function mToday(daysAgo){
  var d=new Date(Date.now()-(daysAgo||0)*86400e3);
  var m=d.getMonth()+1, day=d.getDate();
  return d.getFullYear()+'-'+(m<10?'0'+m:m)+'-'+(day<10?'0'+day:day);
}
function mkEsc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function mkFind(id){
  for(var i=0;i<MK.length;i++){ if(MK[i].id===id) return MK[i]; }
  return null;
}
function mkLoad(){ MK=[]; }
function mkMapItem(it){
  it=it||{};
  var courseId=it.course_id||it.course||'';
  return {
    id:String(it.id!=null?it.id:('srv'+Date.now()+Math.floor(Math.random()*1e4))),
    courseId:courseId,
    title:it.question||it.title||it.name||'（无标题）',
    cat:qaName(courseId),
    path:it.knowledge_point||it.section||qaName(courseId),
    reason:it.reason||'来自课程答疑',
    status:it.status||'待复习',
    last:mkDateOf(it),
    count:it.count||it.wrong_count||1
  };
}
function mkDateOf(it){
  var v=it.created_at||it.createdAt||it.time||it.last||'';
  if(!v) return mToday(0);
  var s=String(v);
  var m=s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if(m) return m[1]+'-'+m[2]+'-'+m[3];
  var d=new Date(s);
  if(!isNaN(d.getTime())){
    var mo=d.getMonth()+1, dd=d.getDate();
    return d.getFullYear()+'-'+(mo<10?'0'+mo:mo)+'-'+(dd<10?'0'+dd:dd);
  }
  return mToday(0);
}
var mkLoadEpoch=0;
function mkLoadFromServer(){
  var request=++mkLoadEpoch,user=currentUser;
  if(typeof fetch!=='function'){ MK=[]; mkRender(); return; }
  fetch(MK_API_WRONG,{method:'GET',headers:{'Content-Type':'application/json'}})
    .then(function(resp){
      if(!resp.ok) throw new Error('HTTP '+resp.status);
      return resp.json();
    })
    .then(function(data){
      if(request!==mkLoadEpoch||user!==currentUser)return;
      var arr=Array.isArray(data)?data:((data&&Array.isArray(data.items))?data.items:[]);
      MK=arr.map(mkMapItem);
      mkRender();
    })
    .catch(function(err){
      if(request!==mkLoadEpoch||user!==currentUser)return;
      MK=[];
      mkRender();
      toast('错题列表加载失败：'+(String(err&&err.message||'')||('连接不上后端（'+MK_API_BASE+'）')));
    });
}
function mkSave(){ try{ localStorage.setItem(MK_KEY,JSON.stringify(MK)); }catch(e){} }
function mkFiltered(){
  var today=mToday(0);
  var q=mkFilter.q.trim();
  return MK.filter(function(m){
    if(mkFilter.cat!=='全部章节'&&m.cat!==mkFilter.cat) return false;
    if(mkFilter.status!=='all'&&m.status!==mkFilter.status) return false;
    if(mkFilter.view==='today'&&m.last!==today) return false;
    if(mkFilter.view==='weak'&&m.status==='已掌握') return false;
    if(q&&(m.title+m.path+m.reason).indexOf(q)<0) return false;
    return true;
  });
}
function mkRender(){
  var today=mToday(0);
  var total=MK.length;
  var weak=MK.filter(function(m){ return m.status!=='已掌握'; }).length;
  var todayN=MK.filter(function(m){ return m.last===today; }).length;
  var n1=MK.filter(function(m){ return m.status==='待复习'; }).length;
  var n2=MK.filter(function(m){ return m.status==='易错'; }).length;
  var n3=MK.filter(function(m){ return m.status==='已掌握'; }).length;
  mkStatsEl.innerHTML=
    '<div class="mk-stat"><div class="lbl">累计错题</div><div class="num">'+total+'<em>道</em></div></div>'+
    '<div class="mk-stat warm"><div class="lbl">待巩固</div><div class="num">'+weak+'<em>道</em></div></div>'+
    '<div class="mk-stat ok"><div class="lbl">今日已复习</div><div class="num">'+todayN+'<em>道</em></div></div>';
  var s='';
  s+='<div class="mk-side-item'+(mkFilter.view==='all'?' active':'')+'" data-v="all">全部错题<span class="n">'+total+'</span></div>';
  s+='<div class="mk-side-item'+(mkFilter.view==='today'?' active':'')+'" data-v="today">今日复习<span class="n">'+todayN+'</span></div>';
  s+='<div class="mk-side-item'+(mkFilter.view==='weak'?' active':'')+'" data-v="weak">待巩固<span class="n">'+weak+'</span></div>';
  s+='<div class="mk-side-label">掌握情况</div>';
  s+='<div><span class="mk-chip warm'+(mkFilter.status==='待复习'?' on':'')+'" data-s="待复习">待复习 <span class="n">'+n1+'</span></span>';
  s+='<span class="mk-chip hot'+(mkFilter.status==='易错'?' on':'')+'" data-s="易错">易错 <span class="n">'+n2+'</span></span>';
  s+='<span class="mk-chip ok'+(mkFilter.status==='已掌握'?' on':'')+'" data-s="已掌握">已掌握 <span class="n">'+n3+'</span></span></div>';
  mkSideEl.innerHTML=s;
  var list=mkFiltered();
  var html='';
  if(!list.length){ html='<div class="mk-empty">暂无错题记录</div>'; }
  for(var i=0;i<list.length;i++){
    var m=list[i];
    var stCls=m.status==='待复习'?'warm':(m.status==='易错'?'hot':'ok');
    html+='<div class="card mk-item">';
    html+='<div class="mk-i-main">';
    html+='<div class="mk-i-top"><span class="mk-i-title">'+mkEsc(m.title)+'</span>';
    html+='<button class="mk-pill '+stCls+'" data-st="'+m.id+'" title="点击切换掌握状态">'+m.status+'</button></div>';
    html+='<div class="mk-i-mid"><span class="mk-cat-chip">'+mkEsc(m.path)+'</span>';
    html+='<span class="mk-reason">⚠ 错因：'+mkEsc(m.reason)+'</span></div>';
    html+='<div class="mk-i-meta"><span>上次复习：'+m.last+'</span><span>累计错误：'+m.count+' 次</span></div>';
    html+='</div>';
    html+='<div class="mk-i-actions">';
    html+='<button class="mk-rev" data-rev="'+m.id+'">开始复习</button>';
    html+='</div></div>';
  }
  mkListEl.innerHTML=html;
  var cats=[];
  for(var c=0;c<MK.length;c++){ if(cats.indexOf(MK[c].cat)<0) cats.push(MK[c].cat); }
  var opts='<option>全部章节</option>';
  for(var c2=0;c2<cats.length;c2++){
    opts+='<option'+(mkFilter.cat===cats[c2]?' selected':'')+'>'+cats[c2]+'</option>';
  }
  mkCatEl.innerHTML=opts;
}
function mkOpenReviewModal(){
  mkReviewModal.classList.add('is-open');
  mkReviewModal.setAttribute('aria-hidden','false');
}
function mkCloseReviewModal(){
  mkReviewState.requestToken++;
  mkReviewState.wrongId=null;
  mkReviewState.exercise=null;
  mkReviewState.answer=null;
  mkReviewState.submitting=false;
  mkReviewState.userId=learningUser();mkReviewState.submissionTokens={};
  mkReviewModal.classList.remove('is-open');
  mkReviewModal.setAttribute('aria-hidden','true');
}
function mkRenderReviewExercise(exercise){
  var html='<div class="mk-review-question">'+mkEsc(exercise.question||'（无题目内容）')+'</div>';
  html+='<div class="mk-review-options">';
  var options=Array.isArray(exercise.options)?exercise.options:[];
  for(var i=0;i<options.length;i++){
    var option=options[i]||{};
    html+='<button type="button" class="mk-review-option" data-review-answer="'+mkEsc(option.key||'')+'">'+
      '<span class="mk-review-key">'+mkEsc(option.key||'')+'</span>'+
      '<span>'+mkEsc(option.text||'')+'</span></button>';
  }
  html+='</div>';
  mkReviewContent.innerHTML=html;
  mkReviewSubmit.disabled=true;
}
async function mkReview(id){
  var m=mkFind(id);
  if(!m) return;

  var token=++mkReviewState.requestToken;
  mkReviewState.wrongId=id;
  mkReviewState.exercise=null;
  mkReviewState.answer=null;
  mkReviewState.submitting=false;
  mkReviewState.userId=learningUser();mkReviewState.submissionTokens={};
  mkReviewMeta.textContent=(m.cat||'课程')+' · '+(m.path||'综合知识点');
  mkReviewContent.innerHTML='<div class="mk-review-loading">正在获取同知识点练习题…</div>';
  mkReviewResult.hidden=true;
  mkReviewResult.className='mk-review-result';
  mkReviewResult.innerHTML='';
  mkReviewSubmit.disabled=true;
  mkReviewSubmit.textContent='提交答案';
  mkOpenReviewModal();

  var courseId=m.courseId||(m.cat==='数据结构'?'data-structure':'cpp');
  var url=MK_API_RECOMMENDATIONS+
    '?course_id='+encodeURIComponent(courseId)+
    '&knowledge_point='+encodeURIComponent(m.path||'');

  try{
    var resp=await fetch(url,{method:'GET',headers:{'Accept':'application/json'}});
    var data=await resp.json();
    if(!resp.ok) throw new Error(data.message||('HTTP '+resp.status));
    if(token!==mkReviewState.requestToken) return;

    var items=data&&Array.isArray(data.items)?data.items:[];
    if(!items.length){
      mkReviewContent.innerHTML='<div class="mk-review-error">当前知识点暂时没有可用练习题。</div>';
      return;
    }

    mkReviewState.exercise=items[0];
    if(data.fallback){
      mkReviewMeta.textContent+=(m.path?' · 暂无完全匹配题，已推荐同课程练习':'');
    }
    mkRenderReviewExercise(items[0]);
  }catch(err){
    if(token!==mkReviewState.requestToken) return;
    console.error(err);
    mkReviewContent.innerHTML='<div class="mk-review-error">练习题加载失败：'+
      mkEsc(String(err&&err.message||'请检查后端是否运行'))+'</div>';
  }
}
async function mkSetStatus(id,newStatus){
  var resp=await fetch(
    MK_API_WRONG+'/'+encodeURIComponent(id)+'/status',
    {
      method:'PUT',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({status:newStatus})
    }
  );
  var data=await resp.json();
  if(!resp.ok || data.status!=='ok'){
    throw new Error(data.message||('HTTP '+resp.status));
  }
  var m=mkFind(id);
  if(m){ m.status=newStatus; m.last=mToday(0); }
  mkRender();
  mkLoadFromServer();
  return data;
}
async function mkCycle(id){
  var m=mkFind(id);
  if(!m) return;

  var order=['待复习','易错','已掌握'];
  var currentIndex=order.indexOf(m.status);
  var nextStatus=order[(currentIndex+1)%order.length];

  try{
    await mkSetStatus(id,nextStatus);
    toast('状态已更新为「'+nextStatus+'」');
  }catch(err){
    console.error(err);
    toast(
      '状态更新失败：'+
      String(err&&err.message||'未知错误')
    );
  }
}
function mkDel(id){
  var m=mkFind(id); if(!m) return;
  if(mkArmId===id){
    MK.splice(MK.indexOf(m),1);
    mkArmId=null;
    mkSave(); mkRender();
    toast('错题已删除');
  }else{
    mkArmId=id;
    mkRender();
    if(mkArmT) clearTimeout(mkArmT);
    mkArmT=setTimeout(function(){
      if(mkArmId===id){ mkArmId=null; mkRender(); }
    },2600);
  }
}
mkSideEl.addEventListener('click',function(e){
  var v=e.target.closest('[data-v]');
  if(v){
    mkFilter.view=v.getAttribute('data-v');
    if(mkFilter.view!=='all') mkFilter.status='all';
    mkRender();
    return;
  }
  var s2=e.target.closest('[data-s]');
  if(s2){
    var st=s2.getAttribute('data-s');
    mkFilter.status=mkFilter.status===st?'all':st;
    mkFilter.view='all';
    mkRender();
  }
});
mkQEl.addEventListener('input',function(){ mkFilter.q=mkQEl.value; mkRender(); });
mkCatEl.addEventListener('change',function(){ mkFilter.cat=mkCatEl.value; mkRender(); });
mkListEl.addEventListener('click',function(e){
  var r=e.target.closest('[data-rev]');
  if(r){ mkReview(r.getAttribute('data-rev')); return; }
  var d=e.target.closest('[data-del]');
  if(d){ mkDel(d.getAttribute('data-del')); return; }
  var st=e.target.closest('[data-st]');
  if(st){ mkCycle(st.getAttribute('data-st')); }
});
mkReviewContent.addEventListener('click',function(e){
  var option=e.target.closest('[data-review-answer]');
  if(!option || mkReviewState.submitting || !mkReviewState.exercise) return;
  mkReviewState.answer=option.getAttribute('data-review-answer');
  var all=mkReviewContent.querySelectorAll('[data-review-answer]');
  for(var i=0;i<all.length;i++){
    all[i].classList.toggle('on',all[i]===option);
  }
  mkReviewSubmit.disabled=false;
});
mkReviewSubmit.addEventListener('click',async function(){
  if(mkReviewState.submitting || !mkReviewState.exercise || !mkReviewState.answer) return;
  if(mkReviewState.userId!==learningUser()){toast("用户已切换，请重新打开重练");return;}
  var reviewToken=mkReviewState.requestToken,reviewUser=learningUser();
  mkReviewState.submitting=true;
  mkReviewSubmit.disabled=true;
  mkReviewSubmit.textContent='正在提交…';

  try{
    var resp=await fetch(MK_API_SUBMIT,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        exercise_id:mkReviewState.exercise.id,
        answer:mkReviewState.answer,
        user_id:learningUser(),
        submission_id:learningSubmission(mkReviewState,mkReviewState.exercise.id,mkReviewState.answer)
      })
    });
    var data=await resp.json();
    if(reviewToken!==mkReviewState.requestToken||reviewUser!==learningUser())return;
    if(!resp.ok || data.status!=='ok'){
      throw new Error(data.message||('HTTP '+resp.status));
    }

    lpRecorded();
    var newStatus=data.correct?'已掌握':'易错';
    var statusSaved=true;
    var statusError='';
    try{
      await mkSetStatus(mkReviewState.wrongId,newStatus);
    }catch(err2){
      statusSaved=false;
      statusError=String(err2&&err2.message||'未知错误');
      console.error(err2);
    }

    if(reviewToken!==mkReviewState.requestToken||reviewUser!==learningUser())return;
    var title=data.correct?'回答正确':'回答错误';
    mkReviewResult.className='mk-review-result '+(data.correct?'good':'bad');
    mkReviewResult.innerHTML='<strong>'+title+'</strong><br>'+
      '正确答案：'+mkEsc(data.correct_answer||'—')+'<br>'+
      '解析：'+mkEsc(data.explanation||'暂无解析')+
      '<div class="mk-review-status-note">'+
      (statusSaved?('掌握状态已更新为「'+newStatus+'」。'):
        ('答案已判定，但状态保存失败：'+mkEsc(statusError)))+'</div>';
    mkReviewResult.hidden=false;

    var all=mkReviewContent.querySelectorAll('[data-review-answer]');
    for(var i=0;i<all.length;i++) all[i].disabled=true;
    mkReviewSubmit.textContent='已提交';
    toast(data.correct?'回答正确，已标记为已掌握':'回答错误，已标记为易错');
  }catch(err){
    if(reviewToken!==mkReviewState.requestToken||reviewUser!==learningUser())return;
    console.error(err);
    mkReviewResult.className='mk-review-result bad';
    mkReviewResult.innerHTML='<strong>提交失败</strong><br>'+mkEsc(String(err&&err.message||'请稍后重试'));
    mkReviewResult.hidden=false;
    if(reviewToken===mkReviewState.requestToken)mkReviewState.submitting=false;

    mkReviewSubmit.disabled=false;
    mkReviewSubmit.textContent='重新提交';
  }
});
mkReviewClose.addEventListener('click',mkCloseReviewModal);
mkReviewModal.addEventListener('click',function(e){
  if(e.target===mkReviewModal) mkCloseReviewModal();
});
document.addEventListener('keydown',function(e){
  if(e.key==='Escape'&&mkReviewModal.classList.contains('is-open')) mkCloseReviewModal();
});
/* ================= 网页整体换肤（0 积分免费解锁 2 套配色） =================
 * 只改变配色，不改动布局与结构；画布场景用 mix-blend-mode 色相融合统一变色。
 * ====================================================================== */
var SITE_THEMES=[
 {id:'bamboo',name:'竹露青提',desc:'#e5ffde #fffee9 #d1e4ca #99bf8e 四色整体渐变晕染 · 清透如竹露',
  cls:'theme-bamboo',
  sky:'radial-gradient(52% 40% at 16% 12%, #e5ffde 0%, rgba(229,255,222,0) 72%), radial-gradient(50% 38% at 84% 18%, #fffee9 0%, rgba(255,254,233,0) 74%), radial-gradient(62% 46% at 22% 88%, #d1e4ca 0%, rgba(209,228,202,0) 76%), radial-gradient(56% 44% at 80% 82%, #99bf8e 0%, rgba(153,191,142,0) 78%), linear-gradient(150deg,#fffee9 0%,#e5ffde 46%,#d1e4ca 100%)',
  accent:'linear-gradient(90deg,#e5ffde 0%,#d1e4ca 42%,#99bf8e 100%)',
  card:'rgba(255,255,255,.72)'},
 {id:'taro',name:'紫薯奶圆',desc:'#b5a4cb #feffea #fefbb4 #dcd3e8 四色整体渐变晕染 · 奶紫般柔软',
  cls:'theme-taro',
  sky:'radial-gradient(52% 40% at 16% 12%, #feffea 0%, rgba(254,255,234,0) 72%), radial-gradient(50% 38% at 84% 18%, #fefbb4 0%, rgba(254,251,180,0) 74%), radial-gradient(62% 46% at 22% 88%, #dcd3e8 0%, rgba(220,211,232,0) 76%), radial-gradient(56% 44% at 80% 82%, #b5a4cb 0%, rgba(181,164,203,0) 78%), linear-gradient(150deg,#feffea 0%,#dcd3e8 48%,#b5a4cb 100%)',
  accent:'linear-gradient(90deg,#dcd3e8 0%,#fefbb4 42%,#b5a4cb 100%)',
  card:'rgba(255,255,255,.74)'}
];
var DEEP_THEME={id:'deep',name:'默认 · 深海蓝',desc:'网站初始配色',
  cls:'',
  sky:'radial-gradient(120% 84% at 50% 30%, rgba(18,62,128,.5) 0%, rgba(10,40,80,.22) 46%, rgba(4,16,31,0) 74%), linear-gradient(180deg,#041020 0%,#02101f 55%,#031428 100%)',
  accent:'linear-gradient(90deg,#bfefff 0%,#79dce8 50%,#5fd0e1 100%)',
  card:'rgba(255,255,255,.10)'};
var siteTheme='deep';
try{ siteTheme=localStorage.getItem('mzx_sitetheme')||'deep'; }catch(e){}
function siteThemeById(id){
  for(var i=0;i<SITE_THEMES.length;i++){ if(SITE_THEMES[i].id===id) return SITE_THEMES[i]; }
  return DEEP_THEME;
}
function applySiteTheme(id,opts){
  var t=siteThemeById(id);
  siteTheme=t.id;
  var el=document.documentElement;
  el.classList.remove('theme-bamboo','theme-taro');
  if(t.cls) el.classList.add(t.cls);
  try{ localStorage.setItem('mzx_sitetheme',t.id); }catch(e){}
  renderThemeCards();
  if(!(opts&&opts.silent)){
    toast(t.id==='deep'?'已恢复默认配色（深海蓝）':('已换肤：'+t.name));
  }
}
function renderThemeCards(){
  var el=document.getElementById('th-cards');
  if(!el) return;
  el.innerHTML=SITE_THEMES.map(function(t){
    var sel=(t.id===siteTheme);
    return '<div class="th-card'+(sel?' on':'')+'" data-th="'+t.id+'" role="button" tabindex="0">'+
      '<div class="th-prev" style="background:'+t.sky+'">'+
        '<div class="th-prev-card" style="background:'+t.card+'"></div>'+
        '<div class="th-prev-line" style="background:'+t.accent+'"></div>'+
        '<div class="th-prev-line2"></div>'+
      '</div>'+
      '<div class="th-name">'+t.name+(sel?' ✓ 使用中':'')+'</div>'+
      '<div class="th-desc">'+t.desc+'</div>'+
    '</div>';
  }).join('');
  var foot=document.getElementById('th-foot');
  if(foot) foot.innerHTML='当前配色：'+siteThemeById(siteTheme).name+' · 已免费永久解锁 2 套 · 可随时更换，不再扣积分';
}
function openThemePicker(){
  renderThemeCards();
  var m=document.getElementById('theme-modal');
  if(!m) return;
  m.classList.add('is-open');
  m.setAttribute('aria-hidden','false');
}
function closeThemePicker(){
  var m=document.getElementById('theme-modal');
  if(!m) return;
  m.classList.remove('is-open');
  m.setAttribute('aria-hidden','true');
}
document.getElementById('th-cards').addEventListener('click',function(e){
  var el=e.target.closest('[data-th]');
  if(el) applySiteTheme(el.getAttribute('data-th'));
});
document.getElementById('th-cards').addEventListener('keydown',function(e){
  if(e.key!=='Enter'&&e.key!==' ') return;
  var el=e.target.closest('[data-th]');
  if(!el) return;
  e.preventDefault();
  applySiteTheme(el.getAttribute('data-th'));
});
document.getElementById('th-reset').addEventListener('click',function(){ applySiteTheme('deep'); });
document.getElementById('th-close').addEventListener('click',closeThemePicker);
document.getElementById('theme-modal').addEventListener('click',function(e){
  if(e.target===document.getElementById('theme-modal')) closeThemePicker();
});

/* 启动时同步已保存的皮肤（CSS 类已由 <head> 提前应用） */
if(siteTheme!=='deep') applySiteTheme(siteTheme,{silent:true});
else renderThemeCards();

/* ================= 设置面板（配色跟随系统 / 字号 / 动效 / 弹幕） ================= */
var SET_KEY='mzx_settings';
var SET_DEF={themeMode:'manual', fontSize:'std', motion:'std', danmaku:'on', autoLight:'bamboo'};
var settings=null;
var SET_ROWS=[
 {key:'themeMode',dom:'set-theme',opts:[['auto','跟随系统'],['deep','深海蓝'],['bamboo','竹露青提'],['taro','紫薯奶圆']]},
 {key:'fontSize', dom:'set-font', opts:[['compact','紧凑'],['std','标准'],['large','大']]},
 {key:'motion',   dom:'set-motion',opts:[['off','关闭'],['std','标准'],['rich','华丽']]},
 {key:'danmaku',  dom:'set-dmnk', opts:[['on','开'],['off','关']]}
];
/* 设置项的中文名（注意：不要与本文件已有的 setLabel(章节按钮) 重名） */
function setOptLabel(key,val){
  for(var i=0;i<SET_ROWS.length;i++){
    if(SET_ROWS[i].key!==key) continue;
    for(var j=0;j<SET_ROWS[i].opts.length;j++){
      if(SET_ROWS[i].opts[j][0]===val) return SET_ROWS[i].opts[j][1];
    }
  }
  return val;
}
function loadSettings(){
  var s=null;
  try{ s=JSON.parse(localStorage.getItem(SET_KEY)||'null'); }catch(e){}
  settings={};
  for(var k in SET_DEF){ if(SET_DEF.hasOwnProperty(k)) settings[k]=SET_DEF[k]; }
  if(s){ for(var k2 in s){ if(SET_DEF.hasOwnProperty(k2)) settings[k2]=s[k2]; } }
  if(settings.autoLight!=='taro') settings.autoLight='bamboo';
  return settings;
}
function saveSettings(){
  try{ localStorage.setItem(SET_KEY,JSON.stringify(settings)); }catch(e){}
}
function sysPrefersLight(){
  try{ return !!(window.matchMedia&&window.matchMedia('(prefers-color-scheme: light)').matches); }
  catch(e){ return false; }
}
function currentThemeTarget(){
  if(settings.themeMode==='auto') return sysPrefersLight()?settings.autoLight:'deep';
  return settings.themeMode;
}
function renderSetPanel(){
  for(var i=0;i<SET_ROWS.length;i++){
    var row=SET_ROWS[i], box=document.getElementById(row.dom);
    if(!box) continue;
    var h='';
    for(var j=0;j<row.opts.length;j++){
      var v=row.opts[j][0], t=row.opts[j][1], on=(settings[row.key]===v);
      h+='<button type="button" class="set-opt'+(on?' on':'')+'" data-set="'+row.key+'" data-val="'+v+'"'+
         ' aria-pressed="'+(on?'true':'false')+'">'+t+'</button>';
    }
    box.innerHTML=h;
  }
}
function applySettings(opts){
  if(!settings) loadSettings();
  /* 配色 */
  applySiteTheme(currentThemeTarget(),{silent:true});
  /* 字号：整站等比缩放 */
  var fs=settings.fontSize==='compact'?0.9:(settings.fontSize==='large'?1.14:1);
  document.documentElement.style.setProperty('--fs',String(fs));
  /* 动效 */
  document.documentElement.classList.toggle('motion-off',settings.motion==='off');
  if(typeof Scene!=='undefined'&&Scene.setMotion) Scene.setMotion(settings.motion==='off'?0:(settings.motion==='rich'?2:1));
  /* 弹幕 */
  if(settings.danmaku==='off') dmnkStop();
  else if(currentView==='suggest') dmnkStart();
  renderSetPanel();
  if(!(opts&&opts.silent)) saveSettings();
}
function openSettings(){
  renderSetPanel();
  var m=document.getElementById('set-modal');
  if(!m) return;
  m.classList.add('is-open');
  m.setAttribute('aria-hidden','false');
}
function closeSettings(){
  var m=document.getElementById('set-modal');
  if(!m) return;
  m.classList.remove('is-open');
  m.setAttribute('aria-hidden','true');
}
(function(){
  var gear=document.getElementById('set-open');
  if(gear) gear.addEventListener('click',openSettings);
  var sheetSet=document.getElementById('sheet-set');
  if(sheetSet) sheetSet.addEventListener('click',function(){ closeSheet(); openSettings(); });
  var modal=document.getElementById('set-modal');
  if(modal){
    modal.addEventListener('click',function(e){
      var b=e.target.closest('[data-set]');
      if(b){
        var key=b.getAttribute('data-set'), val=b.getAttribute('data-val');
        if(key==='themeMode'&&(val==='bamboo'||val==='taro')) settings.autoLight=val;
        settings[key]=val;
        applySettings();
        if(key==='motion') toast(val==='off'?'已关闭动效':(val==='rich'?'动效已调至「华丽」':'动效已恢复「标准」'));
        else if(key==='fontSize') toast('字号：'+setOptLabel('fontSize',val));
        else if(key==='themeMode') toast(val==='auto'
          ? ('配色：跟随系统（当前'+(sysPrefersLight()?'浅色':'深色')+'）')
          : ('配色：'+setOptLabel('themeMode',val)));
        else if(key==='danmaku') toast(val==='off'?'已关闭社区弹幕':'已开启社区弹幕');
        return;
      }
      if(e.target===modal) closeSettings();
    });
  }
  var close=document.getElementById('set-close');
  if(close) close.addEventListener('click',closeSettings);
  var reset=document.getElementById('set-reset');
  if(reset) reset.addEventListener('click',function(){
    settings=null;
    try{ localStorage.removeItem(SET_KEY); }catch(e){}
    loadSettings();
    applySettings();
    toast('已恢复默认设置');
  });
  /* 系统深浅色变化时自动跟随 */
  try{
    var mq=window.matchMedia('(prefers-color-scheme: light)');
    var onChange=function(){
      if(settings&&settings.themeMode==='auto'){
        applySettings({silent:true});
        toast('已跟随系统切换为'+(sysPrefersLight()?'浅色':'深色')+'配色');
      }
    };
    if(mq.addEventListener) mq.addEventListener('change',onChange);
    else if(mq.addListener) mq.addListener(onChange);
  }catch(e){}
})();
loadSettings();
applySettings({silent:true});

/* ================= 手机底部标签栏 + 「更多」面板 ================= */
var tabbarEl=document.getElementById('tabbar');
var moreSheet=document.getElementById('more-sheet');
var tabMoreBtn=document.getElementById('tab-more');
var TAB_VIEWS=['hero','progress','mistakes','suggest','mine'];
var MORE_VIEWS=['charts','qa'];
function closeSheet(){
  if(!moreSheet) return;
  moreSheet.classList.remove('open');
  moreSheet.setAttribute('aria-hidden','true');
  if(tabMoreBtn) tabMoreBtn.setAttribute('aria-expanded','false');
}
function toggleSheet(){
  if(!moreSheet) return;
  var open=!moreSheet.classList.contains('open');
  moreSheet.classList.toggle('open',open);
  moreSheet.setAttribute('aria-hidden',open?'false':'true');
  if(tabMoreBtn) tabMoreBtn.setAttribute('aria-expanded',open?'true':'false');
}
function syncTabs(){
  var tabs=document.querySelectorAll('.tab[data-tab]');
  for(var i=0;i<tabs.length;i++){
    var v=tabs[i].getAttribute('data-tab');
    tabs[i].classList.toggle('on',v===currentView);
  }
  if(tabMoreBtn) tabMoreBtn.classList.toggle('on',MORE_VIEWS.indexOf(currentView)>=0);
}
if(tabbarEl){
  tabbarEl.addEventListener('click',function(e){
    var b=e.target.closest('[data-tab]');
    if(!b){ if(e.target===tabbarEl) closeSheet(); return; }
    closeSheet();
    setNav(false);
    setView(b.getAttribute('data-tab'));
  });
}
if(moreSheet){
  moreSheet.addEventListener('click',function(e){
    var b=e.target.closest('[data-tab]');
    if(!b) return;
    closeSheet();
    setNav(false);
    setView(b.getAttribute('data-tab'));
  });
}
if(tabMoreBtn) tabMoreBtn.addEventListener('click',toggleSheet);
document.addEventListener('keydown',function(e){
  if(e.key!=='Escape') return;
  if(moreSheet&&moreSheet.classList.contains('open')){ closeSheet(); return; }
  var openModal=document.querySelector('.modal.is-open');
  if(openModal){
    openModal.classList.remove('is-open');
    openModal.setAttribute('aria-hidden','true');
  }
});

/* ================= 小社区 · 用户资料卡 ================= */
function cmUserStats(user){
  var posts=0, replies=0, likesGot=0, best=null;
  for(var i=0;i<SUG.length;i++){
    var c=SUG[i];
    if(c.user===user){
      posts++;
      likesGot+=c.likes.length;
      if(!best||c.likes.length>best.likes.length) best=c;
    }
    for(var j=0;j<(c.replies||[]).length;j++){
      var r=c.replies[j];
      if(r.user===user){ replies++; likesGot+=1; }
    }
  }
  var lv=sugLevel(user);
  return {posts:posts,replies:replies,likes:likesGot,best:best,lv:lv.lv,title:lv.title,act:lv.act};
}
function openUserCard(user){
  var rec=findUser(user);
  var st=cmUserStats(user);
  var frame=(rec&&rec.frame)?(' avf avf-'+String(rec.frame).replace(/^f/,'')):'';
  var ava=(rec&&rec.avatar&&/^data:image\//.test(rec.avatar))
    ? '<img src="'+rec.avatar+'" alt="">'
    : sugEsc(String(user).charAt(0));
  var joined='';
  if(rec&&rec.created){
    var d=new Date(rec.created);
    joined=' · 加入于 '+d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate();
  }
  var best=st.best
    ? '<div class="uc-best"><div class="t">🏅 代表作 · ♥ '+st.best.likes.length+'</div>'+
      '<div class="b">'+sugEsc(st.best.text.length>90?st.best.text.slice(0,90)+'…':st.best.text)+'</div></div>'
    : '<div class="uc-best"><div class="t">🏅 代表作</div><div class="b">还没有发过帖，去打个招呼吧～</div></div>';
  var html='<div class="uc-top">'+
      '<span class="uc-ava'+frame+'">'+ava+'</span>'+
      '<div><div class="uc-name">'+sugEsc(user)+
        (hasMark(user)?'<span class="sug-vip">✦ 积分达人</span>':'')+
        '<span class="sug-lv">Lv.'+st.lv+' '+st.title+'</span></div>'+
      '<div class="uc-meta">社区活跃度 '+st.act+joined+'</div></div>'+
    '</div>'+
    '<div class="uc-stats">'+
      '<div class="uc-stat"><b>'+st.posts+'</b><span>发帖</span></div>'+
      '<div class="uc-stat"><b>'+st.replies+'</b><span>回复</span></div>'+
      '<div class="uc-stat"><b>'+st.likes+'</b><span>获赞</span></div>'+
      '<div class="uc-stat"><b>Lv.'+st.lv+'</b><span>等级</span></div>'+
    '</div>'+best+
    '<div class="uc-actions"><button class="modal-primary" type="button" id="ucard-close">关 闭</button></div>';
  var body=document.getElementById('ucard-body');
  var modal=document.getElementById('ucard-modal');
  if(!body||!modal) return;
  body.innerHTML=html;
  modal.classList.add('is-open');
  modal.setAttribute('aria-hidden','false');
}
function closeUserCard(){
  var modal=document.getElementById('ucard-modal');
  if(!modal) return;
  modal.classList.remove('is-open');
  modal.setAttribute('aria-hidden','true');
}
(function(){
  var modal=document.getElementById('ucard-modal');
  if(!modal) return;
  modal.addEventListener('click',function(e){
    if(e.target===modal||e.target.id==='ucard-close') closeUserCard();
  });
})();

/* 收录新题 modal */
var mkModal=document.getElementById('mk-modal');
var mkForm=document.getElementById('mk-form');
var mkTitleEl=document.getElementById('mk-title');
var mkCatSel=document.getElementById('mk-cat');
var mkReasonEl=document.getElementById('mk-reason');
var mkStatusSel=document.getElementById('mk-status');
function mkOpenModal(){
  var cats=[];
  for(var i=0;i<MK.length;i++){ if(cats.indexOf(MK[i].cat)<0) cats.push(MK[i].cat); }
  mkCatSel.innerHTML=cats.map(function(c){ return '<option>'+c+'</option>'; }).join('');
  mkModal.classList.add('is-open');
  mkModal.setAttribute('aria-hidden','false');
  mkTitleEl.focus();
}
function mkCloseModal(){
  mkModal.classList.remove('is-open');
  mkModal.setAttribute('aria-hidden','true');
}
document.getElementById('mk-open').addEventListener('click',mkOpenModal);
document.getElementById('mk-cancel').addEventListener('click',mkCloseModal);
mkModal.addEventListener('click',function(e){ if(e.target===mkModal) mkCloseModal(); });
mkForm.addEventListener('submit',function(e){
  e.preventDefault();
  var t=mkTitleEl.value.trim();
  var reason=mkReasonEl.value.trim();
  if(!t){ toast('请填写题目名称'); return; }
  if(!reason){ toast('请填写错因分析'); return; }
  var cat=mkCatSel.value||'线性表';
  MK.push({id:'m'+Date.now()+Math.floor(Math.random()*1e4),title:t,cat:cat,
    path:'数据结构 / '+cat,reason:reason,status:mkStatusSel.value,last:mToday(0),count:1});
  mkSave();
  mkForm.reset();
  mkCloseModal();
  mkRender();
  toast('已收录到错题本');
});
bindDrops(viewMistakes);
bindTouchFx(viewMistakes);
mkLoad();
mkRender();

/* ================= BURGER MENU ================= */
var navrow=document.querySelector('.navrow');
var burger=document.querySelector('.burger');
function setNav(open){
  navrow.setAttribute('data-open',String(open));
  burger.setAttribute('aria-expanded',String(open));
  burger.setAttribute('aria-label',open?'Close navigation':'Open navigation');
}
setNav(false);
burger.addEventListener('click',function(e){
  e.stopPropagation();
  setNav(navrow.getAttribute('data-open')!=='true');
});
document.addEventListener('click',function(e){
  if(navrow.getAttribute('data-open')!=='true') return;
  if(!navrow.contains(e.target)) setNav(false);
});
document.addEventListener('keydown',function(e){
  if(e.key==='Escape'){
    if(aboutModal.classList.contains('is-open')){ closeAbout(); return; }
    if(logoutModal.classList.contains('is-open')){ closeLogout(); return; }
    if(avModal.classList.contains('is-open')){ avClose(); return; }
    if(sigModal.classList.contains('is-open')){ sigClose(); return; }
    if(ledgerModal.classList.contains('is-open')){ closeLedger(); return; }
    if(document.getElementById('theme-modal').classList.contains('is-open')){ closeThemePicker(); return; }
    if(mkModal.classList.contains('is-open')){ mkCloseModal(); return; }
    if(navrow.getAttribute('data-open')==='true'){ setNav(false); burger.focus(); }
    return;
  }
  if(currentView!=='hero') return;
  if(e.key==='ArrowLeft'){ step(-1); }
  else if(e.key==='ArrowRight'){ step(1); }
});
var links=document.querySelectorAll('.links a');
for(var i=0;i<links.length;i++){
  (function(l){
    l.addEventListener('click',function(e){
      e.preventDefault();
      handleNav(l);
    });
  })(links[i]);
}

/* ================= ENTRANCE DRIVER ================= */
(function(){
  var el=document.documentElement;
  if(!el.classList.contains('anim')) return;
  var done=false;
  var guard=setTimeout(start,500);
  function start(){
    if(done) return;
    done=true;
    clearTimeout(guard);
    requestAnimationFrame(function(){
      requestAnimationFrame(function(){ el.classList.add('play'); });
    });
    setTimeout(function(){ el.classList.remove('anim'); el.classList.remove('play'); },2150);
  }
  if(document.fonts&&document.fonts.ready&&document.fonts.ready.then){
    document.fonts.ready.then(function(){ start(); });
  }else{
    start();
  }
})();

/* ================= QA VIEW (课程答疑) =================
 * 接口保持不变：
 *   POST /api/ask                 { course_id, question } → { answer, sources[] }
 *   POST /api/wrong-questions     { course_id, question, answer, knowledge_point } → { status, message, id }
 * ===================================================== */
var viewQa=document.getElementById('view-qa');
var QA_API_BASE=MK_API_BASE;
var QA_API_ASK=QA_API_BASE+'/api/ask';
var QA_API_WRONG=QA_API_BASE+'/api/wrong-questions';       /* POST 保存错题 */
var QA_API_WRONG_GET=QA_API_BASE+'/api/wrong-questions';   /* GET 读取错题列表 */
var QA_MAX=500;
var QA_NAMES={'cpp':'C++程序设计','data-structure':'数据结构'};
var qaState={
  course:document.getElementById('qa-course'),
  question:document.getElementById('qa-question'),
  count:document.getElementById('qa-count'),
  ask:document.getElementById('qa-ask'),
  headBadge:document.getElementById('qa-head-badge'),
  status:document.getElementById('qa-status'),
  answer:document.getElementById('qa-answer'),
  body:document.getElementById('qa-body'),
  badge:document.getElementById('qa-badge'),
  meta:document.getElementById('qa-meta'),
  src:document.getElementById('qa-src'),
  srcList:document.getElementById('qa-src-list'),
  save:document.getElementById('qa-save'),
  saveHint:document.getElementById('qa-save-hint'),
  link:document.getElementById('qa-link')
};
var qaBusy=false, qaLastCourse='cpp';
var qaCurrent=null, qaSaveState='idle', qaLastQuestion='', qaToastT=null;

function qaName(id){ return QA_NAMES[id]||id||'课程'; }
function qaNow(){
  var d=new Date(), p=function(n){ return n<10?'0'+n:''+n; };
  return p(d.getHours())+':'+p(d.getMinutes())+':'+p(d.getSeconds());
}
function qaFormat(raw){ return MZX_AI.format(raw); }
function qaPlain(raw){
  // Preserve C++ templates such as vector<int> when saving a model answer.
  return String(raw==null?'':raw).trim();
}
function qaToast(msg,type){
  toast(msg);
  if(!type) return;
}
function qaSetStatus(kind,msg){
  var box=qaState.status;
  box.className='qa-status '+kind;
  if(kind==='loading'){
    box.innerHTML='<span class="qa-spinner"></span><span class="st-text">'+sugEsc(msg||'正在回答，请稍候…')+'</span>';
    return;
  }
  if(kind==='error'){
    box.innerHTML='<span>⚠</span><span class="st-text">'+sugEsc(msg||'回答失败，请稍后再试')+'</span>'+
      '<span class="qa-stacts"><button class="qa-mini" type="button" id="qa-retry">重试</button>'+
      '<button class="qa-mini ghost" type="button" id="qa-mock">用演示数据看看</button></span>';
    var r=document.getElementById('qa-retry'), m=document.getElementById('qa-mock');
    if(r) r.addEventListener('click',function(){ qaAsk(qaLastQuestion,{silent:true,courseId:qaLastCourse}); });
    if(m) m.addEventListener('click',function(){ qaRunMock(qaLastQuestion); });
    return;
  }
  if(kind==='success'){
    box.innerHTML='<span style="color:#7be0a2">✓</span><span class="st-text">'+sugEsc(msg||'回答完成')+'</span>';
    return;
  }
  box.innerHTML='<span>💡</span><span class="st-text">'+
    sugEsc(msg||'选择课程并输入问题，点击「提交问题」获取回答与资料出处。')+'</span>';
}
function qaMock(courseId){
  var cn=qaName(courseId);
  var answer, sources;
  if(courseId==='cpp'){
    answer='引用（reference）是变量的别名：int a=10; int &r=a; 之后 r 与 a 就是同一个对象，修改 r 等价于修改 a。\n\n'+
           '指针（pointer）则存放另一个变量的地址：int *p=&a; 用 *p 解引用得到 a 的值。\n\n'+
           '二者区别：引用必须在定义时初始化且不能改绑；指针可以为空、可重新指向。引用更安全，指针更灵活。';
    sources=[
      {title:cn+'课程讲义',section:'指针与引用',page:null},
      {title:'《C++ Primer》',section:'第 2 章 · 引用与指针',page:45},
      {title:'码上知新 · 数据结构平台',section:'C++ 基础',page:null}
    ];
  }else{
    answer='树是 n（n≥0）个结点的有限集合：根结点在最上层，其余结点分成若干互不相交的子树。\n\n'+
           '二叉树是每个结点最多只有两棵子树（左子树、右子树）的树：第 i 层最多 2^(i-1) 个结点，深度为 k 的二叉树最多 2^k-1 个结点。\n\n'+
           '三种遍历：先序（根-左-右）、中序（左-根-右）、后序（左-右-根）；由「先序+中序」或「后序+中序」可唯一确定一棵二叉树。';
    sources=[
      {title:cn+'课程讲义',section:'树与二叉树',page:null},
      {title:'《数据结构》教材',section:'第 6 章 · 树与二叉树',page:120},
      {title:'码上知新 · 数据结构平台',section:'二叉树遍历',page:null}
    ];
  }
  return new Promise(function(resolve){
    setTimeout(function(){ resolve({answer:answer, sources:sources}); },800);
  });
}
async function qaFetchAnswer(courseId,question){
  return MZX_AI.request(QA_API_ASK,{course_id:courseId,question:question});
}
async function qaPostWrong(payload){
  var resp=await fetch(QA_API_WRONG,{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify(payload)
  });
  if(!resp.ok) throw new Error('HTTP '+resp.status);
  try{ return await resp.json(); }catch(e){ return {status:'ok'}; }
}
function qaRenderAnswer(data,meta){
  var raw=data&&(data.answer!=null?data.answer:(data.content!=null?data.content:data.text));
  var sources=(data&&data.sources)||[];
  qaState.badge.textContent=qaName(meta.courseId);
  qaState.headBadge.textContent=qaName(meta.courseId);
  qaState.answer.hidden=false;
  qaState.body.innerHTML=qaFormat(raw);
  var modeLabel=meta.demo?'演示数据':data.mode==='generated'?'AI 讲解':data.mode==='no_evidence'?'资料不足':'资料摘录';
  qaState.meta.textContent=modeLabel+' · 课程：'+qaName(meta.courseId)+' · 完成于 '+qaNow();
  qaState.src.hidden=false;
  if(sources.length){
    qaState.srcList.innerHTML=sources.map(function(s){
      var page=(s&&s.page!=null)?('第 '+s.page+' 页'):((s&&s.path)||'课程资料');
      return '<div class="qa-src"><span class="qa-src-ico">📖</span><div class="qa-src-main">'+
        '<div class="qa-src-title">'+sugEsc((s&&s.title)||'未命名资料')+'</div>'+
        '<div class="qa-src-meta">'+sugEsc((s&&s.section)||'—')+' · '+sugEsc(page)+'</div></div></div>';
    }).join('');
  }else{
    qaState.srcList.innerHTML='<div class="qa-src-meta" style="padding:calc(10 * var(--u)) 0">暂无资料出处</div>';
  }
  qaCurrent={courseId:meta.courseId,question:meta.question,answerText:qaPlain(raw),sources:sources};
  qaSaveState='idle';
  qaState.save.disabled=!!meta.demo||data.mode==='no_evidence';
  qaState.save.textContent='加入错题集';
  qaState.saveHint.textContent='会调用 '+QA_API_WRONG+' 保存到你的错题集。';
  qaState.link.hidden=true;
  qaSetStatus('success',meta.demo?'演示数据：未调用大模型，不可保存为学习记录。':(data.notice||modeLabel));
  if(meta.demo||data.mode==='no_evidence') qaCurrent=null;
}
async function qaAsk(forced,opts){
  if(qaBusy)return;
  var options=opts||{};
  var q=String(forced!=null?forced:qaState.question.value).trim();
  var courseId=options.courseId||qaState.course.value;
  if(!q){
    qaSetStatus('idle','问题不能为空：请先输入你的问题，再点击「提交问题」。');
    toast('请输入问题后再提交');
    qaState.question.focus();
    qaState.question.classList.add('shake');
    setTimeout(function(){ qaState.question.classList.remove('shake'); },500);
    return;
  }
  if(q.length>QA_MAX){ toast('问题太长了（最多 '+QA_MAX+' 字）'); return; }
  qaLastQuestion=q;
  qaBusy=true;qaLastCourse=courseId;qaState.course.value=courseId;
  qaState.course.disabled=true;qaState.question.disabled=true;
  qaState.question.value=q;
  qaState.ask.disabled=true;
  qaState.ask.textContent='回答中…';
  qaState.answer.hidden=true;
  qaState.src.hidden=true;
  qaState.save.disabled=true;
  qaSetStatus('loading','正在等待回答…');
  var stopWaiting=MZX_AI.waiting(qaState.status.querySelector('.st-text'));
  try{
    var data=await qaFetchAnswer(courseId,q);
    if(!data||(data.answer==null&&data.content==null&&data.text==null)) throw new Error('返回数据格式不正确');
    qaRenderAnswer(data,{courseId:courseId,question:q});
    toast('回答成功');
  }catch(err){
    qaState.answer.hidden=true;
    qaState.src.hidden=true;
    qaCurrent=null;
    qaState.save.disabled=true;
    var msg=String(err&&err.message||'');
    var reason=/Failed to fetch|NetworkError|Load failed/i.test(msg)
      ?('连接不上后端（'+QA_API_BASE+'），请确认后端已启动'):(msg||'未知错误');
    qaSetStatus('error',MZX_AI.error(err));
    toast('回答失败，可点击重试');
  }finally{
    stopWaiting();qaBusy=false;qaState.course.disabled=false;qaState.question.disabled=false;
    qaState.ask.disabled=false;
    qaState.ask.textContent='提交问题';
  }
}
async function qaRunMock(question){
  var q=String(question||qaState.question.value).trim();
  if(!q){
    qaSetStatus('idle','问题不能为空：请先输入你的问题。');
    toast('请输入问题');
    qaState.question.focus();
    return;
  }
  qaLastQuestion=q;
  qaSetStatus('loading','正在生成本地演示回答…');
  qaState.answer.hidden=true;
  qaState.src.hidden=true;
  try{
    var data=await qaMock(qaState.course.value);
    qaRenderAnswer(data,{courseId:qaState.course.value,question:q,demo:true});
    toast('已展示演示数据（未调用后端）');
  }catch(e){
    qaSetStatus('error','演示数据生成失败');
  }
}
async function qaSaveMistake(){
  if(!qaCurrent){ toast('请先获取回答'); qaSetStatus('idle','还没有回答内容：先提交问题，再来加入错题集。'); return; }
  if(qaSaveState==='saving') return;
  if(qaSaveState==='saved'){ toast('这道题已经在错题集里了'); return; }
  var kp=(qaCurrent.sources&&qaCurrent.sources[0]&&qaCurrent.sources[0].section)||qaName(qaCurrent.courseId);
  var payload={course_id:qaCurrent.courseId,question:qaCurrent.question,answer:qaCurrent.answerText,knowledge_point:kp};
  qaSaveState='saving';
  qaState.save.disabled=true;
  qaState.save.textContent='保存中…';
  qaState.saveHint.textContent='正在提交到 '+QA_API_WRONG+' …';
  try{
    var res=await qaPostWrong(payload);
    qaSaveState='saved';
    qaState.save.textContent='已加入错题集 ✓';
    qaState.save.disabled=true;
    qaState.saveHint.textContent='保存成功'+((res&&res.id!=null)?('（编号 #'+res.id+'）'):'')+' · 知识点：'+kp;
    qaState.link.hidden=false;
    /* 保存成功后重新从后端拉取错题列表（不再 MK.push 重复保存到浏览器） */
    try{ mkLoadFromServer(); }catch(e){}
    toast('保存成功 · 已加入错题集');
  }catch(err){
    qaSaveState='idle';
    qaState.save.disabled=false;
    qaState.save.textContent='重新加入错题集';
    var msg2=String(err&&err.message||'');
    var reason2=/Failed to fetch|NetworkError|Load failed/i.test(msg2)
      ?('连接不上后端（'+QA_API_BASE+')'):(msg2||'未知错误');
    qaState.saveHint.textContent='保存失败：'+reason2+'，请确认后端已启动后重试。';
    toast('保存失败：'+reason2);
  }
}
function qaUpdateCount(){
  var n=qaState.question.value.length;
  qaState.count.textContent=n+' / '+QA_MAX;
  qaState.count.style.color=n>QA_MAX?'#ff9d9d':'rgba(190,240,255,.6)';
}
function qaInit(){
  qaState.headBadge.textContent=qaName(qaState.course.value);
  if(qaCurrent) qaState.badge.textContent=qaName(qaState.course.value);
  qaUpdateCount();
  if(!qaState.status.innerHTML) qaSetStatus('idle');
}
qaState.ask.addEventListener('click',function(){ qaAsk(); });
qaState.save.addEventListener('click',qaSaveMistake);
qaState.question.addEventListener('input',qaUpdateCount);
qaState.question.addEventListener('keydown',function(e){
  if((e.ctrlKey||e.metaKey)&&e.key==='Enter') qaAsk();
});
qaState.course.addEventListener('change',function(){
  qaState.headBadge.textContent=qaName(qaState.course.value);
  if(qaCurrent) qaState.badge.textContent=qaName(qaState.course.value);
});
qaState.link.addEventListener('click',function(){ setView('mistakes'); });
var qaChips=document.querySelectorAll('[data-qa-example]');
for(var qi=0;qi<qaChips.length;qi++){
  (function(chip){
    chip.addEventListener('click',function(){
      var question=chip.getAttribute('data-qa-example');
      var courseId=chip.getAttribute('data-qa-course');

      qaState.question.value=question;

      if(courseId){
        qaState.course.value=courseId;
        qaState.headBadge.textContent=qaName(courseId);
      }

      qaUpdateCount();
      qaState.question.focus();
    });
  })(qaChips[qi]);
}
qaSetStatus('idle');
qaUpdateCount();
bindDrops(viewQa);
bindTouchFx(viewQa);

var coachModule;
function resetCoach(){if(coachModule)coachModule.reset();}
function renderCoach(q,r){if(coachModule)coachModule.render(q,r);}
/* ================= Persisted learning progress ================= */
var lpState={courseId:'cpp',request:0};
var prEpoch=0;
function learningUser(){return currentUser?String(currentUser):'guest';}
function learningToken(){return window.crypto&&crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);}
function learningSubmission(state,id,answer){
  if(!state.submissionTokens)state.submissionTokens={};
  var item=state.submissionTokens[id];if(!item||item.answer!==answer)item=state.submissionTokens[id]={answer:answer,token:learningToken()};return item.token;
}
function lpEl(id){return document.getElementById('lp-'+id);}
function lpIdentityChanged(){
  if(!lpState||!prState)return;
  if(typeof mkLoadFromServer==='function'){MK=[];mkLoadFromServer();}
  if(typeof resetCoach==='function')resetCoach();
  lpState.request++;lpEl('content').hidden=true;lpEl('status').textContent='';
  prEpoch++;Object.assign(prState,{items:[],selectedAnswers:{},results:{},savedWrongQuestions:{},submissionTokens:{},currentIndex:0,loading:false,submitting:false,saving:false,finished:false,started:false,coaching:false,userId:learningUser()});
  if(typeof mkReviewState!=='undefined'&&mkReviewState){mkReviewState.requestToken++;mkReviewState.exercise=null;if(typeof mkCloseReviewModal==='function')mkCloseReviewModal();}
  if(currentView==='progress')lpLoad();
  if(currentView==='practice')prLoad('cpp');
}
async function lpLoad(){
  await window.MZXSessionReady;
  if(!lpState)return;
  var user=learningUser(),course=lpState.courseId,request=++lpState.request;
  lpEl('user').textContent=user==='guest'?'当前：访客 guest（未登录访客共用）':'当前用户：'+user;
  lpEl('status').textContent='正在加载学习记录……';lpEl('content').hidden=true;lpEl('refresh').disabled=true;
  document.querySelectorAll('[data-lp-course]').forEach(function(b){b.setAttribute('aria-pressed',b.dataset.lpCourse===course?'true':'false');});
  try{
    var data=await prRequest(MK_API_BASE+'/api/progress?user_id='+encodeURIComponent(user)+'&course_id='+encodeURIComponent(course));
    if(request!==lpState.request||user!==learningUser())return;
    if(data.status!=='ok'||data.user_id!==user||data.course_id!==course||!Array.isArray(data.knowledge_points))throw new Error('Invalid progress');
    lpEl('metrics').replaceChildren();
    [['总答题数',data.total_attempts],['答对次数',data.correct_attempts],['正确率',data.accuracy+'%'],['课程掌握度',data.mastery+'%']].forEach(function(pair){var box=document.createElement('div');box.className='lp-metric';var value=document.createElement('b');value.textContent=pair[1];var label=document.createElement('span');label.textContent=pair[0];box.append(value,label);lpEl('metrics').appendChild(box);});
    lpEl('weak').textContent=data.weak_knowledge_points.length?'薄弱知识点：'+data.weak_knowledge_points.join('、')+'。开始练习时将优先推荐这些知识点。':'暂无待加强知识点。未学习的知识点可以从下方开始练习。';
    lpEl('topics').replaceChildren();
    data.knowledge_points.forEach(function(point){
      var card=document.createElement('section');card.className='lp-topic'+(point.level==='待加强'?' is-weak':'');card.dataset.knowledgePoint=point.knowledge_point;
      var title=document.createElement('h3');title.textContent=point.knowledge_point+' · '+point.level;
      var info=document.createElement('p');info.textContent='作答 '+point.attempted+' 次 · 覆盖 '+point.unique_exercises+' 道不同题 · 首次正确率 '+point.first_attempt_accuracy+'%';
      var bar=document.createElement('progress');bar.max=100;bar.value=point.mastery;bar.setAttribute('aria-label',point.knowledge_point+'掌握度 '+point.mastery+'%');
      var score=document.createElement('p');score.textContent='练习掌握度估计 '+point.mastery+'%（'+point.recent_attempts+' 道不同题的最近表现；至少覆盖3道题才标记已掌握）';
      var button=document.createElement('button');button.type='button';button.textContent=point.level==='待加强'?'练习薄弱知识点':'同类题练习';button.addEventListener('click',function(){if(prBusy()){toast('请等待当前答题请求完成');return;}prState.started=true;setView('practice');prLoad(course,point.knowledge_point);});
      card.append(title,info,bar,score,button);lpEl('topics').appendChild(card);
    });
    lpEl('status').textContent=data.total_attempts?'学习记录已同步。':'还没有答题记录，完成一次练习提交后即可查看真实进度。';lpEl('content').hidden=false;
  }catch(e){if(request===lpState.request)lpEl('status').textContent='无法加载学习进度，请确认后端已启动后重试。';}
  finally{if(request===lpState.request)lpEl('refresh').disabled=false;}
}
function lpRecorded(){if(currentView==='progress')lpLoad();}
document.querySelectorAll('[data-lp-course]').forEach(function(b){b.addEventListener('click',function(){lpState.courseId=b.dataset.lpCourse;lpLoad();});});
lpEl('refresh').addEventListener('click',lpLoad);
window.addEventListener('storage',function(e){if(e.key===SESS_KEY)restoreServerSession();});
/* ================= Real API chapter practice ================= */
var PR_API_BASE=MK_API_BASE;
var PR_API_RECOMMENDATIONS=PR_API_BASE+'/api/recommendations';
var PR_API_SUBMIT=PR_API_BASE+'/api/exercises/submit';
var PR_API_WRONG=PR_API_BASE+'/api/wrong-questions';
var prState={userId:learningUser(),submissionTokens:{},courseId:'cpp',items:[],currentIndex:0,selectedAnswers:{},results:{},loading:false,submitting:false,saving:false,savedWrongQuestions:{},started:false,finished:false,knowledgePoint:''};
function prEl(id){return document.getElementById('pr-'+id);}
function prBusy(){return prState.loading||prState.submitting||prState.saving||prState.coaching;}
function prQuestion(){return prState.items[prState.currentIndex];}
function prStatus(text){prEl('status').textContent=text;}
async function prRequest(url,body){
  var controller=new AbortController(), timer=setTimeout(function(){controller.abort();},15000);
  try{
    var response=await fetch(url,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined,signal:controller.signal});
    if(!response.ok) throw new Error('HTTP '+response.status);
    return await response.json();
  }finally{clearTimeout(timer);}
}
function prRender(){
  var busy=prBusy(),q=prQuestion(),r=q&&prState.results[q.id];
  if(typeof renderCoach==='function')renderCoach(q,r);
  viewPractice.setAttribute('aria-busy',busy?'true':'false');
  viewPractice.querySelectorAll('[data-pr-course]').forEach(function(b){b.disabled=busy;b.setAttribute('aria-pressed',b.dataset.prCourse===prState.courseId?'true':'false');});
  prEl('question-panel').hidden=!q||prState.loading||prState.finished;
  prEl('summary').hidden=!prState.finished;
  prEl('reload').hidden=!!q||prState.loading||prState.finished;
  prEl('reload').disabled=busy;
  if(prState.finished){
    var correct=prState.items.filter(function(item){return prState.results[item.id]&&prState.results[item.id].correct;}).length;
    prEl('stats').textContent='总题数：'+prState.items.length+'\n答对数量：'+correct+'\n答错数量：'+(prState.items.length-correct)+'\n正确率：'+Math.round(correct/prState.items.length*100)+'%';
  }
  if(!q)return;
  prEl('progress').textContent='第 '+(prState.currentIndex+1)+' / '+prState.items.length+' 题 · 题目编号 '+q.id;
  prEl('knowledge').textContent='知识点：'+(q.knowledge_point||'未分类');
  prEl('question').textContent=q.question;
  prEl('options').replaceChildren();
  q.options.forEach(function(option){
    var b=document.createElement('button');b.type='button';b.textContent=option.key+' · '+option.text;
    b.dataset.key=option.key;b.setAttribute('aria-pressed',prState.selectedAnswers[q.id]===option.key?'true':'false');b.disabled=busy||!!r;
    if(r&&option.key===r.correct_answer)b.classList.add('pr-correct');
    if(r&&!r.correct&&option.key===prState.selectedAnswers[q.id])b.classList.add('pr-wrong');
    b.addEventListener('click',function(){if(prBusy()||prState.results[q.id])return;prState.selectedAnswers[q.id]=option.key;prStatus('');prRender();prEl('options').querySelector('[data-key="'+option.key+'"]').focus();});
    prEl('options').appendChild(b);
  });
  prEl('submit').disabled=busy||!!r;prEl('submit').textContent=prState.submitting?'正在提交……':r?'已提交':'提交答案';
  prEl('result').hidden=!r;
  prEl('result').textContent=r?((r.correct?'回答正确':'回答错误')+'\n正确答案：'+r.correct_answer+'\n解析：'+r.explanation):'';
  prEl('save').hidden=!r||r.correct;
  prEl('save').disabled=busy||!!prState.savedWrongQuestions[q.id];
  prEl('save').textContent=prState.savedWrongQuestions[q.id]?'已加入错题集':prState.saving?'正在保存……':'加入错题集';
  prEl('prev').disabled=busy||prState.currentIndex===0;
  prEl('next').disabled=busy;prEl('next').textContent=prState.currentIndex===prState.items.length-1?'完成练习':'下一题';
  prEl('similar').disabled=busy||!q.knowledge_point;
}
async function prLoad(course,knowledge){
  await window.MZXSessionReady;
  if(prBusy()||['cpp','data-structure'].indexOf(course)<0)return;
  if(typeof resetCoach==='function')resetCoach();
  var epoch=prEpoch,user=learningUser();prState.userId=user;prState.submissionTokens={};
  prState.courseId=course;prState.knowledgePoint=knowledge||'';prState.started=true;prState.loading=true;prState.finished=false;
  prState.items=[];prState.currentIndex=0;prState.selectedAnswers={};prState.results={};prState.savedWrongQuestions={};
  prStatus('正在加载题目');prRender();
  try{
    var data=await prRequest(PR_API_RECOMMENDATIONS+'?user_id='+encodeURIComponent(user)+'&course_id='+encodeURIComponent(course)+(knowledge?'&knowledge_point='+encodeURIComponent(knowledge):''));
    if(epoch!==prEpoch||user!==learningUser())return;
    if(!data||!Array.isArray(data.items))throw new Error('Invalid items');
    var ids=new Set();
    data.items.forEach(function(q){
      if(!Number.isInteger(q.id)||ids.has(q.id)||q.course_id!==course||typeof q.question!=='string'||!Array.isArray(q.options)||q.options.length!==4||new Set(q.options.map(function(o){return o.key;})).size!==4||q.options.some(function(o){return !/^[ABCD]$/.test(o.key)||typeof o.text!=='string';}))throw new Error('Invalid exercise');
      ids.add(q.id);
    });
    prState.items=data.items;
    prStatus(data.items.length?(knowledge?(data.fallback?'当前知识点暂无专属题目，已显示后端推荐的课程练习。':'同类题巩固：'+knowledge):'请选择答案并提交。'):'当前课程暂无题目');
  }catch(e){if(epoch===prEpoch)prStatus('无法连接后端，请确认后端已经启动');}
  finally{if(epoch===prEpoch){prState.loading=false;prRender();}}
}
prEl('submit').addEventListener('click',async function(){
  var q=prQuestion();if(!q||prBusy()||prState.results[q.id])return;
  var answer=prState.selectedAnswers[q.id];if(!answer){prStatus('请先选择一个答案');return;}
  var epoch=prEpoch,user=learningUser();if(user!==prState.userId){lpIdentityChanged();return;}
  prState.submitting=true;prStatus('');prRender();
  try{
    var data=await prRequest(PR_API_SUBMIT,{exercise_id:q.id,answer:answer,user_id:user,submission_id:learningSubmission(prState,q.id,answer)});
    if(epoch!==prEpoch||user!==learningUser())return;
    if(data.status!=='ok'||data.exercise_id!==q.id||typeof data.correct!=='boolean'||!/^[ABCD]$/.test(data.correct_answer)||typeof data.explanation!=='string')throw new Error('Invalid grading');
    prState.results[q.id]=data;lpRecorded();
  }catch(e){if(epoch===prEpoch)prStatus('答案提交失败，请检查后端');}
  finally{if(epoch===prEpoch){prState.submitting=false;prRender();}}
});
prEl('save').addEventListener('click',async function(){
  var q=prQuestion(),r=q&&prState.results[q.id];if(!r||r.correct||prBusy()||prState.savedWrongQuestions[q.id])return;
  var epoch=prEpoch;prState.saving=true;prStatus('');prRender();
  try{
    var data=await prRequest(PR_API_WRONG,{course_id:q.course_id,question:q.question,answer:'正确答案：'+r.correct_answer+'\n解析：'+r.explanation,knowledge_point:q.knowledge_point||''});
    if(epoch!==prEpoch)return;
    if(data.status!=='ok')throw new Error('Save failed');
    prState.savedWrongQuestions[q.id]=true;prStatus('已加入错题集');
    if(typeof mkLoadFromServer==='function')mkLoadFromServer();
  }catch(e){if(epoch===prEpoch)prStatus('加入错题集失败，请检查后端后重试');}
  finally{if(epoch===prEpoch){prState.saving=false;prRender();}}
});
prEl('prev').addEventListener('click',function(){if(prBusy()||prState.currentIndex===0)return;prState.currentIndex--;prStatus('');prRender();});
prEl('next').addEventListener('click',function(){
  if(prBusy()||!prQuestion())return;
  prStatus('');
  if(prState.currentIndex<prState.items.length-1)prState.currentIndex++;
  else{
    var missing=prState.items.findIndex(function(q){return !prState.results[q.id];});
    if(missing>=0){prState.currentIndex=missing;prStatus('请先完成全部题目，已返回尚未提交的题目。');}
    else prState.finished=true;
  }
  prRender();
});
prEl('similar').addEventListener('click',function(){var q=prQuestion();if(q)prLoad(prState.courseId,q.knowledge_point);});
prEl('reload').addEventListener('click',function(){prLoad(prState.courseId,prState.knowledgePoint);});
prEl('retry').addEventListener('click',function(){prLoad(prState.courseId,prState.knowledgePoint);});
prEl('review').addEventListener('click',function(){prState.finished=false;prState.currentIndex=0;prRender();});
prEl('mistakes').addEventListener('click',function(){setView('mistakes');});
['home','summary-home'].forEach(function(id){prEl(id).addEventListener('click',function(){setView('hero');});});
viewPractice.querySelectorAll('[data-pr-course]').forEach(function(b){b.addEventListener('click',function(){prLoad(b.dataset.prCourse);});});
document.getElementById('start-learn').addEventListener('click',function(e){e.preventDefault();var started=prState.started;setView('practice');if(started&&!prBusy())prLoad('cpp');});
bindTouchFx(viewPractice);

coachModule=window.createPracticeCoach({state:prState,question:prQuestion,busy:prBusy,render:prRender,load:prLoad,user:learningUser});
/* ================= 深链：根据 URL hash 直接打开对应页面 ================= */
(function(){
  var MAP={hero:'hero',train:'hero',progress:'progress',charts:'charts',
           mistakes:'mistakes',suggest:'suggest',mine:'mine',qa:'qa',practice:'practice'};
  function applyHash(){
    var h=String(location.hash||'').replace(/^#/,'').toLowerCase();
    if(MAP[h]) setView(MAP[h]);
  }
  applyHash();
  window.addEventListener('hashchange',applyHash);
})();

/* ================= 玻璃拟态交互：卡片鼠标跟随高光 ================= */
(function(){
  var reduced=false;
  try{ reduced=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches; }catch(e){}
  if(reduced) return;
  var raf=null,pending=null,hoverEl=null;
  function apply(){
    raf=null;
    if(!pending) return;
    var el=pending.el,r=el.getBoundingClientRect();
    if(r.width&&r.height){
      el.style.setProperty('--mx',(((pending.x-r.left)/r.width)*100).toFixed(1)+'%');
      el.style.setProperty('--my',(((pending.y-r.top)/r.height)*100).toFixed(1)+'%');
    }
    pending=null;
  }
  document.addEventListener('pointermove',function(e){
    var t=e.target;
    var card=(t&&t.closest)?t.closest('.card'):null;
    if(card!==hoverEl){
      hoverEl=card;
      if(card&&card.style&&!card.style.getPropertyValue('--mx')){
        card.style.setProperty('--mx','50%');
        card.style.setProperty('--my','0%');
      }
    }
    if(!card) return;
    pending={el:card,x:e.clientX,y:e.clientY};
    if(!raf) raf=requestAnimationFrame(apply);
  },{passive:true});
})();
})();
