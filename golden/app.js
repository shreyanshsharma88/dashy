/* ZG557 dashboard — PRESENTATION LAYER ONLY.
   Lecture data comes from window.ACI_DATA (app-data.js, generated from content/*.md).
   This file never edits content; all transforms below are DOM/CSS-level.
   Persisted keys: zg557.studied.v1, zg557.marks.v1, zg557.scores.v1,
   zg557.focus.v1, zg557.theme.v1, zg557.type.v1, zg557.notes.v1,
   zg557.collapsed.v1, zg557.last.v1, zg557.streak.v1 */
(function(){
"use strict";
var DATA = window.ACI_DATA || {lectures:[], examPatternHtml:"", cheatSheetHtml:"", diagrams:[]};
var LS_STUDIED="zg557.studied.v1", LS_MARKS="zg557.marks.v1", LS_SCORES="zg557.scores.v1",
    LS_FOCUS="zg557.focus.v1", LS_THEME="zg557.theme.v1", LS_TYPE="zg557.type.v1",
    LS_NOTES="zg557.notes.v1", LS_COLL="zg557.collapsed.v1",
    LS_LAST="zg557.last.v1", LS_STREAK="zg557.streak.v1";
function load(k,d){ try{var v=localStorage.getItem(k);return v?JSON.parse(v):d;}catch(e){return d;} }
function save(k,v){ try{localStorage.setItem(k,JSON.stringify(v));}catch(e){} }
var studied=load(LS_STUDIED,{}), marks=load(LS_MARKS,{}), scores=load(LS_SCORES,{});
var notes=load(LS_NOTES,{}), collapsed=load(LS_COLL,{});
var focusMode=load(LS_FOCUS,false), theme=load(LS_THEME,"dark"), typeCtl=load(LS_TYPE,{fs:18,lh:1.75});
var route="home", flashIdx={}, galleryFilter="All", cardIdx=0, cardFlip=false, cardFilter={lec:"All",weak:false};
var spyObs=null;

function esc(s){ return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;"); }
function lectureById(id){ for(var i=0;i<DATA.lectures.length;i++) if(DATA.lectures[i].id===id) return DATA.lectures[i]; return null; }
function lecIdx(id){ for(var i=0;i<DATA.lectures.length;i++) if(DATA.lectures[i].id===id) return i; return -1; }
function minsOf(L){ var w=(L.text||"").split(/\s+/).length; return Math.max(1,Math.round(w/200)); }
function shortTitle(L){ try{ return L.title.split("—")[1].split("(")[0].trim(); }catch(e){ return L.title; } }

/* ---------- theme / type / focus ---------- */
function applyTheme(){ document.documentElement.setAttribute("data-theme",theme);
  document.getElementById("btn-theme").textContent = theme==="dark"?"◐":(theme==="sepia"?"◑":"○"); }
function applyType(){ var r=document.documentElement.style;
  r.setProperty("--fs",typeCtl.fs+"px"); r.setProperty("--lh",typeCtl.lh); }
function applyFocus(){ document.body.classList.toggle("focus",!!focusMode);
  document.getElementById("btn-focus").classList.toggle("on",!!focusMode); }

/* ---------- sidebar / progress / dots / weak ---------- */
function renderNav(){
  var nav=document.getElementById("nav");
  var items=[{r:"home",t:"Home"}]
    .concat(DATA.lectures.map(function(l){ return {r:l.id,t:"<span>"+l.id+" — "+esc(shortTitle(l))+"</span><span class='rt'>"+minsOf(l)+" min</span>"}; }))
    .concat([{r:"review",t:"Review Queue"},{r:"cards",t:"Flashcards"},{r:"gallery",t:"Diagrams ("+(allDiags().length)+")"},{r:"cheat",t:"Cheat sheet (print)"},{r:"pattern",t:"Previous-year pattern"}]);
  nav.innerHTML=items.map(function(it){ return '<button data-r="'+it.r+'" class="'+(route===it.r?"active":"")+'">'+it.t+"</button>"; }).join("");
  nav.querySelectorAll("button").forEach(function(b){ b.onclick=function(){ render(b.getAttribute("data-r")); }; });
  var sl=document.getElementById("studied-list");
  sl.innerHTML=DATA.lectures.map(function(l){
    return '<label><input type="checkbox" data-l="'+l.id+'" '+(studied[l.id]?"checked":"")+"> "+l.id+" <span class='src'>· "+minsOf(l)+" min</span></label>";
  }).join("");
  sl.querySelectorAll("input").forEach(function(cb){ cb.onchange=function(){
    studied[cb.getAttribute("data-l")]=cb.checked; save(LS_STUDIED,studied); updateProgress(); renderWeak(); renderDots(); }; });
  updateProgress(); renderWeak(); renderDots();
}
function updateProgress(){
  var n=DATA.lectures.length, d=DATA.lectures.filter(function(l){return studied[l.id];}).length;
  document.getElementById("progress-bar").style.setProperty("--p",(n?Math.round(100*d/n):0)+"%");
  document.getElementById("progress-label").textContent=d+"/"+n+" studied";
}
function topicName(tid){ for(var i=0;i<DATA.lectures.length;i++){ var L=DATA.lectures[i];
  for(var j=0;j<L.topics.length;j++) if(L.topics[j].id===tid) return L.id+" · "+L.topics[j].name; } return tid; }
function weakIds(){ return Object.keys(marks).filter(function(k){return marks[k]==="weak";}); }
function strongIds(){ return Object.keys(marks).filter(function(k){return marks[k]==="strong";}); }
function renderWeak(){
  var weak=weakIds();
  document.getElementById("weak-count").textContent=weak.length?"("+weak.length+")":"";
  document.getElementById("weak-list").innerHTML=weak.length
    ? weak.map(function(k){ var lid=k.split("-")[0];
      return '<div><a href="#" data-w="'+esc(k)+'" data-l="'+lid+'">⚠ '+esc(topicName(k))+"</a></div>"; }).join("")
    : "None — mark shaky topics Weak as you revise.";
  document.querySelectorAll("#weak-list a").forEach(function(a){ a.onclick=function(e){
    e.preventDefault(); goTo(a.getAttribute("data-l"),a.getAttribute("data-w")); }; });
}
function renderDots(){
  var d=document.getElementById("dots");
  var L=lectureById(route);
  var crumb=L?("Home / "+L.id):({home:"Home",review:"Review",cards:"Flashcards",gallery:"Diagrams",cheat:"Cheat sheet",pattern:"Pattern"}[route]||"Home");
  d.innerHTML='<span class="crumb">'+esc(crumb)+"</span>"+DATA.lectures.map(function(l){
    var c=""; if(route===l.id)c+=" cur"; if(studied[l.id])c+=" done";
    return '<button data-d="'+l.id+'" class="'+c+'" title="'+l.id+" — "+esc(shortTitle(l))+'">●</button>'; }).join("");
  d.querySelectorAll("button").forEach(function(b){ b.onclick=function(){ render(b.getAttribute("data-d")); }; });
}

/* ---------- streak / last ---------- */
function touchStreak(){
  var t=new Date(), ds=t.toISOString().slice(0,10);
  var s=load(LS_STREAK,{last:null,count:0});
  if(s.last!==ds){ var y=new Date(t.getTime()-864e5).toISOString().slice(0,10);
    s.count=(s.last===y)?s.count+1:1; s.last=ds; save(LS_STREAK,s); }
  return load(LS_STREAK,{last:ds,count:1});
}
function resumeTarget(){
  var last=load(LS_LAST,null);
  if(last&&last.lecture&&lectureById(last.lecture)&&!studied[last.lecture]) return last.lecture;
  for(var i=0;i<DATA.lectures.length;i++) if(!studied[DATA.lectures[i].id]) return DATA.lectures[i].id;
  return (last&&last.lecture)?last.lecture:"L1";
}

/* ---------- quiz (unchanged grading) ---------- */
function gradeShort(answer,keywords){ var a=(answer||"").toLowerCase();
  var hit=keywords.filter(function(k){return a.indexOf(k.toLowerCase())>=0;});
  return {hit:hit.length,total:keywords.length}; }
function renderQuiz(L){
  var sc=scores[L.id]||{};
  var h='<h2>Self-check ('+L.quizzes.length+' Qs, auto-graded)</h2>';
  if(sc.done) h+='<p class="src">Last score: '+sc.ok+"/"+L.quizzes.length+" — retake below.</p>";
  h+=L.quizzes.map(function(q,qi){
    var inner=q.type==="mcq"
      ? q.options.map(function(o){ return '<label><input type="radio" name="q'+qi+'" value="'+esc(o)+'"> '+esc(o)+"</label>"; }).join("")
      : '<input type="text" id="qa'+qi+'" placeholder="Type key terms — graded on keywords">';
    return '<div class="quiz-q"><b>Q'+(qi+1)+'.</b> <span class="qtype">'+esc(q.type)+"</span> "+esc(q.q)+inner+
      '<div><button class="btn ghost" data-check="'+qi+'">Check</button> <span class="fb" id="qf'+qi+'"></span></div></div>';
  }).join("");
  return h+'<button class="btn" id="quiz-all">Check all</button> <span id="quiz-total"></span>';
}
function wireQuiz(L){
  function checkOne(qi){ var q=L.quizzes[qi],fb=document.getElementById("qf"+qi),ok=false,msg="";
    if(q.type==="mcq"){ var sel=document.querySelector('input[name="q'+qi+'"]:checked');
      var v=sel?sel.value:""; ok=(v===q.answer); msg=ok?"Correct.":("Answer: "+q.answer+". "+q.explanation);
    } else { var v2=document.getElementById("qa"+qi).value, g=gradeShort(v2,q.keywords||[]);
      ok=g.total?(g.hit===g.total):(v2.trim().length>3);
      msg=ok?"Correct — all keywords present.":("Matched "+g.hit+"/"+g.total+" keywords. Expected: "+q.answer+" — "+q.explanation); }
    fb.textContent=msg; fb.className="fb "+(ok?"good":"bad"); return ok; }
  document.querySelectorAll("[data-check]").forEach(function(b){
    b.onclick=function(){ checkOne(+b.getAttribute("data-check")); }; });
  document.getElementById("quiz-all").onclick=function(){ var ok=0;
    L.quizzes.forEach(function(_,qi){ if(checkOne(qi))ok++; });
    document.getElementById("quiz-total").textContent="Score: "+ok+"/"+L.quizzes.length;
    scores[L.id]={done:true,ok:ok}; save(LS_SCORES,scores); };
}

/* ---------- per-lecture flashcards (unchanged) ---------- */
function renderFlash(L){
  if(!L.flashcards||!L.flashcards.length)
    return '<h2>Flashcards</h2><p class="src">No flashcards for this lecture yet.</p>';
  if(!(L.id in flashIdx)) flashIdx[L.id]=0;
  flashIdx[L.id]=Math.min(Math.max(flashIdx[L.id],0),L.flashcards.length-1);
  var i=flashIdx[L.id],c=L.flashcards[i];
  return '<h2>Flashcards ('+L.flashcards.length+', click to flip)</h2>'+
    '<div class="flash" id="flash-card"><b>'+esc(c.front)+'</b><small>click to reveal answer</small></div>'+
    '<p class="flash-nav no-print"><button class="btn ghost" id="fl-prev">◀ Prev</button> '+(i+1)+"/"+L.flashcards.length+
    ' <button class="btn ghost" id="fl-next">Next ▶</button></p>';
}
function wireFlash(L){
  var card=document.getElementById("flash-card"); if(!card)return;
  var flipped=false,i=flashIdx[L.id],c=L.flashcards[i];
  card.onclick=function(){ flipped=!flipped;
    card.innerHTML=flipped?esc(c.back)+"<small>click to hide</small>":"<b>"+esc(c.front)+"</b><small>click to reveal answer</small>"; };
  document.getElementById("fl-prev").onclick=function(e){ e.stopPropagation(); flashIdx[L.id]=(i-1+L.flashcards.length)%L.flashcards.length; render(route); };
  document.getElementById("fl-next").onclick=function(e){ e.stopPropagation(); flashIdx[L.id]=(i+1)%L.flashcards.length; render(route); };
}

/* ---------- lecture body structuring (DOM-level only) ---------- */
function matchTopic(L,text){
  var ht=text.trim().toLowerCase().replace(/\\/g,"");
  for(var i=0;i<L.topics.length;i++){ var tn=L.topics[i].name.toLowerCase().replace(/\\/g,"");
    if(ht.indexOf(tn.slice(0,18))>=0||tn.indexOf(ht.slice(0,18))>=0) return L.topics[i]; }
  return null;
}
function structureLecture(L){
  var body=document.querySelector("#view .lec-body"); if(!body) return [];
  var kids=Array.prototype.slice.call(body.children), sec=null, sbody=null, idx=-1, inSources=false;
  var matched=[];
  kids.forEach(function(n){
    if(n.tagName==="H3"){
      inSources=false; idx++;
      sec=document.createElement("section"); sec.className="topic"; sec.dataset.i=idx;
      var head=document.createElement("div"); head.className="topic-head";
      body.insertBefore(sec,n); head.appendChild(n);
      var btn=document.createElement("button"); btn.className="collapse-btn no-print";
      var key=L.id+":"+idx, isC=!!collapsed[key];
      btn.textContent=isC?"+":"–"; btn.setAttribute("aria-expanded",isC?"false":"true");
      btn.title="Collapse/expand section";
      btn.onclick=(function(s,b,k){ return function(){ var c=s.classList.toggle("collapsed");
        b.textContent=c?"+":"–"; b.setAttribute("aria-expanded",c?"false":"true");
        if(c)collapsed[k]=true; else delete collapsed[k]; save(LS_COLL,collapsed); }; })(sec,btn,key);
      head.appendChild(btn); sec.appendChild(head);
      sbody=document.createElement("div"); sbody.className="topic-body"; sec.appendChild(sbody);
      if(isC)sec.classList.add("collapsed");
      var t=matchTopic(L,n.textContent);
      if(t){ n.id=t.id; sec.dataset.tid=t.id; matched.push({sec:sec,topic:t});
        // tools + notes
        var bar=document.createElement("div"); bar.className="topic-tools no-print";
        var cur=marks[t.id]||"";
        bar.innerHTML='<button data-m="weak" class="'+(cur==="weak"?"on-weak":"")+'">Weak</button>'+
          '<button data-m="strong" class="'+(cur==="strong"?"on-strong":"")+'">Strong</button>';
        sbody.appendChild(bar);
        bar.querySelectorAll("button").forEach(function(b){ b.onclick=function(){
          var m=b.getAttribute("data-m"); marks[t.id]=(marks[t.id]===m)?"":m;
          if(!marks[t.id])delete marks[t.id]; save(LS_MARKS,marks); render(route,t.id); }; });
        var det=document.createElement("details"); det.className="notes no-print";
        if(notes[t.id])det.open=true;
        det.innerHTML="<summary>My notes"+(notes[t.id]?" ●":"")+"</summary>";
        var ta=document.createElement("textarea"); ta.placeholder="Jot a memory hook for this topic… (saved locally)";
        ta.value=notes[t.id]||"";
        var tm=null;
        ta.addEventListener("input",function(){ clearTimeout(tm);
          tm=setTimeout(function(){ if(ta.value.trim())notes[t.id]=ta.value; else delete notes[t.id];
            save(LS_NOTES,notes); },400); });
        det.appendChild(ta); sbody.appendChild(det);
        var mb=mediaBlock(t); if(mb)sbody.appendChild(mb);
      }
    } else if(n.tagName==="H2"){
      sec=null; inSources=/sources|todo/i.test(n.textContent);
      if(/worked exam/i.test(n.textContent))n.classList.add("worked-sec");
      // raw Self-check / Flashcards MD sections duplicate the widgets below — hide when widgets exist
      if(/self.check|flashcards/i.test(n.textContent)&&(L.quizzes.length||L.flashcards.length)){
        n.style.display="none";
        var sib=n.nextSibling;
        while(sib){
          var nx=sib.nextSibling;
          if(sib.tagName==="H2")break;
          if(sib.nodeType===1)sib.style.display="none";
          sib=nx;
        }
      }
      if(inSources){
        var d=document.createElement("details"); d.className="card"; d.open=false;
        var sm=document.createElement("summary"); sm.textContent=n.textContent; d.appendChild(sm);
        body.insertBefore(d,n); d.appendChild(n); n.style.display="none";
        var rest=Array.prototype.slice.call(body.children);
        var after=false;
        rest.forEach(function(r){ if(r===d){after=true;return;} if(after&&r.tagName!=="H2")d.appendChild(r); });
      }
    } else if(sec&&!inSources){ sbody.appendChild(n); }
    else if(inSources){ var dd=body.querySelector("details.card:last-of-type"); if(dd&&n.tagName!=="H2")dd.appendChild(n); }
  });
  // prose-list softening: long explanatory bullets read as paragraphs
  body.querySelectorAll("ul").forEach(function(ul){
    var lis=ul.querySelectorAll(":scope > li"); if(lis.length<3)return;
    var tot=0; lis.forEach(function(li){tot+=li.textContent.length;});
    if(tot/lis.length>140)ul.classList.add("prose");
  });
  // worked-example blocks get their own card
  body.querySelectorAll("li,p").forEach(function(el){
    if(/^\s*worked[\s—–-]*(example|steps)?/i.test(el.textContent))el.classList.add("worked");
  });
  // tools + notes read best at the END of a section (after media): move them there
  matched.forEach(function(m){ var b=m.sec.querySelector(".topic-body"); if(!b)return;
    [".topic-media",".topic-tools",".notes"].forEach(function(sel){ var el=b.querySelector(sel); if(el)b.appendChild(el); }); });
  highlightKeywords(L);
  cleanupMeta();
  return matched;
}
/* Authoring metadata is build notes, not reading content: hide the noisy
   provenance lines (real diagrams/videos render inline via media.js). */
function cleanupMeta(){
  var body=document.querySelector("#view .lec-body"); if(!body)return;
  body.querySelectorAll("li,p").forEach(function(el){
    if(el.closest("aside,pre,table"))return;
    var t=(el.textContent||"").trim();
    if(/^(diagram_asset|video|confidence)\s*:/i.test(t))el.style.display="none";
    else if(/^formula_box\s*:\s*none\s*\.?$/i.test(t))el.style.display="none";
  });
}
/* Keywords: color + bold + underline inside paragraphs (DOM-level;
   terms derived from the lecture's own quiz keywords + flashcard vocabulary) */
var KW_STOP={a:1,an:1,the:1,and:1,or:1,of:1,to:1,in:1,on:1,for:1,with:1,from:1,that:1,this:1,these:1,those:1,into:1,over:1,under:1,between:1,each:1,which:1,what:1,when:1,where:1,while:1,than:1,then:1,them:1,they:1,your:1,you:1,are:1,was:1,were:1,been:1,being:1,have:1,has:1,had:1,does:1,did:1,will:1,would:1,should:1,could:1,there:1,their:1,about:1,after:1,before:1,such:1,other:1,more:1,most:1,some:1,only:1,also:1,very:1,just:1,both:1,give:1,given:1,using:1,used:1,states:1,gives:1};
function buildTerms(L){
  var terms=[];
  L.quizzes.forEach(function(q){ (q.keywords||[]).forEach(function(k){
    k=String(k).trim(); if(k.length>=2)terms.push(k); }); });
  var bag=[];
  L.flashcards.forEach(function(c){ bag.push(c.front+" "+c.back); });
  L.quizzes.forEach(function(q){ bag.push(q.q+" "+(q.explanation||"")); });
  var seen={};
  bag.join(" ").toLowerCase().split(/[^a-z]+/).forEach(function(w){
    if(w.length>=7&&!KW_STOP[w]&&!seen[w]){ seen[w]=1; terms.push(w); } });
  var out=[],have={};
  terms.sort(function(a,b){ return b.length-a.length; }).forEach(function(t){
    var k=t.toLowerCase(); if(!have[k]){ have[k]=1; out.push(t); } });
  return out.slice(0,60);
}
function highlightKeywords(L){
  var terms=buildTerms(L); if(!terms.length)return 0;
  var re=new RegExp("(?<!\\w)(?:"+terms.map(escRe).join("|")+")(?!\\w)","gi");
  var body=document.querySelector("#view .lec-body"); if(!body)return 0;
  var walker=document.createTreeWalker(body,NodeFilter.SHOW_TEXT,null), nodes=[],n,guard=0;
  while((n=walker.nextNode())&&guard<2000){ guard++;
    var p=n.parentElement; if(!p)continue;
    var tag=p.tagName;
    if(tag!=="P"&&tag!=="LI")continue;
    if(p.closest("aside,pre,table,a,.kw"))continue;
    re.lastIndex=0;
    if(re.test(n.nodeValue))nodes.push(n);
  }
  var hits=0;
  nodes.slice(0,300).forEach(function(tn){
    re.lastIndex=0;
    var html=esc(tn.nodeValue).replace(re,function(mm){ hits++; return '<strong class="kw">'+mm+'</strong>'; });
    var span=document.createElement("span"); span.innerHTML=html;
    tn.parentNode.replaceChild(span,tn);
  });
  return hits;
}
function buildTOC(matched){
  var box=document.getElementById("toc-list"); var toc=document.getElementById("toc");
  if(!matched.length){ box.innerHTML=""; toc.style.display="none"; return; }
  toc.style.display="";
  box.innerHTML=matched.map(function(m){ return '<a href="#'+m.topic.id+'" data-t="'+m.topic.id+'">'+esc(m.topic.name)+"</a>"; }).join("");
  box.querySelectorAll("a").forEach(function(a){ a.onclick=function(e){ e.preventDefault();
    var el=document.getElementById(a.getAttribute("data-t")); if(el)el.scrollIntoView({block:"start"}); }; });
  if(spyObs)spyObs.disconnect();
  spyObs=new IntersectionObserver(function(es){ es.forEach(function(en){
    if(en.isIntersecting){ box.querySelectorAll("a").forEach(function(a){
      a.classList.toggle("active",a.getAttribute("data-t")===en.target.dataset.tid); });
      pdfOnTopic(en.target); } }); },
    {rootMargin:"-30% 0px -60% 0px"});
  matched.forEach(function(m){ spyObs.observe(m.sec); });
}

/* ---------- diagrams (existing data) ---------- */
/* ---------- diagrams + per-topic media (filenames/IDs from media.js) ---------- */
function allDiags(){ return (DATA.diagrams||[]).concat(((window.ACI_MEDIA||{}).newDiagrams||[])); }
function normKey(s){ return String(s||"").toLowerCase().replace(/\\/g,"").replace(/[`*_#>\[\]()]/g,"").replace(/\s+/g," ").trim(); }
function mediaFor(tname){
  var M=window.ACI_MEDIA||{images:{},videos:{}};
  if(M.images[tname]||M.videos[tname]) return {imgs:(M.images[tname]||[]), vid:(M.videos[tname]||null)};
  var nk=normKey(tname), out={imgs:[],vid:null}, k;
  for(k in M.images){ if(normKey(k)===nk){ out.imgs=M.images[k]; break; } }
  for(k in M.videos){ if(normKey(k)===nk){ out.vid=M.videos[k]; break; } }
  return out;
}
function diagCount(lid){ return allDiags().filter(function(d){return d.lecture===lid;}).length; }
function mediaBlock(t){
  var med=mediaFor(t.name);
  if(!med.imgs.length&&!med.vid)return null;
  var md=document.createElement("div"); md.className="topic-media";
  med.imgs.forEach(function(im){
    var fg=document.createElement("figure"); fg.className="topic-fig";
    var img=document.createElement("img"); img.loading="lazy";
    img.src="assets/diagrams/"+im.f; img.alt=im.c; fg.appendChild(img);
    var cap=document.createElement("figcaption"); cap.textContent=im.c; fg.appendChild(cap);
    md.appendChild(fg); });
  if(med.vid){ var v=med.vid;
    var box=document.createElement("div"); box.className="video no-print";
    box.innerHTML='<div class="vframe"><iframe src="https://www.youtube-nocookie.com/embed/'+v.id+
      '" title="'+v.t.replace(/"/g,"")+'" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allow="accelerometer; encrypted-media; picture-in-picture" allowfullscreen></iframe></div>'+
      '<p class="vmeta">▶ '+v.t+" — "+v.ch+
      ' · <a href="https://www.youtube.com/watch?v='+v.id+'" target="_blank" rel="noopener">Watch on YouTube</a>'+
      ' <span class="src">(needs internet)</span></p>';
    md.appendChild(box); }
  return md;
}
function diagBlock(L){
  var ds=allDiags().filter(function(d){return d.lecture===L.id;});
  if(!ds.length)return "";
  return '<details class="card no-print" id="lec-diags"><summary>Diagrams from the PDF ('+ds.length+' — click to view)</summary>'+
    ds.map(function(d){ return '<figure class="diag-block"><img loading="lazy" src="assets/diagrams/'+esc(d.file)+'" alt="'+esc(d.caption)+'">'+
      "<figcaption>"+esc(d.caption)+"</figcaption></figure>"; }).join("")+"</details>";
}
function renderGallery(){
  var v=document.getElementById("view"); v.classList.add("wide");
  var lecs=["All"].concat(DATA.lectures.map(function(l){return l.id;}));
  var all=allDiags();
  var list=all.filter(function(d){return galleryFilter==="All"||d.lecture===galleryFilter;});
  v.innerHTML='<h1>Diagrams ('+list.length+' shown / '+all.length+' filed)</h1>'+
    '<p class="src">Page-renders are exact PDF screenshots (caption cites page). Embedded-figures are the largest figures auto-curated from the PDFs — verify the panel against the PDF before memorizing numbers.</p>'+
    '<p class="no-print">'+lecs.map(function(l){ return '<button class="btn'+(l===galleryFilter?"":" ghost")+'" data-gf="'+l+'">'+l+'</button> '; }).join("")+'</p>'+
    '<div class="gal-grid">'+list.map(function(d){
      return '<figure class="gal-card"><img loading="lazy" src="assets/diagrams/'+esc(d.file)+'" alt="'+esc(d.caption)+'">'+
        '<figcaption><b>'+esc(d.lecture)+'</b> · '+esc(d.kind)+'<br>'+esc(d.caption)+'<br><small>'+esc(d.file)+'</small></figcaption></figure>';
    }).join("")+'</div>';
  v.querySelectorAll("[data-gf]").forEach(function(b){ b.onclick=function(){ galleryFilter=b.getAttribute("data-gf"); renderGallery(); }; });
}

/* ---------- review queue ---------- */
function renderReview(){
  var v=document.getElementById("view"); v.classList.add("wide");
  var weak=weakIds(), strong=strongIds();
  var h='<h1>Review Queue</h1><p class="src">Weak-tagged topics surface first; Strong-tagged rarely (spaced-repetition-lite). Tags are set per topic on lecture pages.</p>';
  h+='<h2>Due now — Weak ('+weak.length+')</h2>';
  h+=weak.length?weak.map(function(k){ return '<div class="rev-row"><span class="tag">weak</span><span class="grow">'+esc(topicName(k))+'</span>'+
    '<button class="btn ghost" data-go="'+esc(k)+'">Go</button><button class="btn ghost" data-un="'+esc(k)+'">Unmark</button></div>'; }).join("")
    :'<div class="card">Nothing marked Weak. Tag shaky topics on any lecture page and they’ll queue here.</div>';
  h+='<details class="card"><summary>Strong — rarely shown ('+strong.length+')</summary>'+
    (strong.length?strong.map(function(k){ return '<div class="rev-row"><span class="tag strong">strong</span><span class="grow">'+esc(topicName(k))+'</span>'+
      '<button class="btn ghost" data-go="'+esc(k)+'">Go</button><button class="btn ghost" data-un="'+esc(k)+'">Unmark</button></div>'; }).join(""):"<p class='src'>None.</p>")+"</details>";
  v.innerHTML=h;
  v.querySelectorAll("[data-go]").forEach(function(b){ b.onclick=function(){
    var k=b.getAttribute("data-go"); goTo(k.split("-")[0],k); }; });
  v.querySelectorAll("[data-un]").forEach(function(b){ b.onclick=function(){
    delete marks[b.getAttribute("data-un")]; save(LS_MARKS,marks); renderReview(); renderNav(); }; });
}

/* ---------- global flashcards ---------- */
function cardDeck(){
  var all=[];
  DATA.lectures.forEach(function(L){ L.flashcards.forEach(function(c){ all.push({lec:L.id,front:c.front,back:c.back}); }); });
  var weakLecs={}; weakIds().forEach(function(k){ weakLecs[k.split("-")[0]]=true; });
  return all.filter(function(c){
    if(cardFilter.lec!=="All"&&c.lec!==cardFilter.lec)return false;
    if(cardFilter.weak&&!weakLecs[c.lec])return false;
    return true; });
}
function renderCards(){
  var v=document.getElementById("view");
  var deck=cardDeck();
  if(cardIdx>=deck.length)cardIdx=0;
  var h='<h1>Flashcards</h1><p class="src">Auto-built from formulas/definitions across all 7 lectures. Weak-only = lectures containing Weak-tagged topics.</p>';
  h+='<p class="no-print"><select id="cf-lec">'+["All"].concat(DATA.lectures.map(function(l){return l.id;})).map(function(l){
    return '<option '+(cardFilter.lec===l?"selected":"")+'>'+l+'</option>'; }).join("")+'</select> '+
    '<label><input type="checkbox" id="cf-weak" '+(cardFilter.weak?"checked":"")+'> Weak-only</label> '+
    '<button class="btn ghost" id="cf-shuf">Shuffle</button></p>';
  if(!deck.length){ v.innerHTML=h+'<div class="card">No cards under this filter.</div>'; wireCardFilters(); return; }
  var c=deck[cardIdx];
  h+='<div class="flash" id="gcard"><b>['+c.lec+'] '+esc(c.front)+'</b><small>click to reveal ('+(cardIdx+1)+"/"+deck.length+")</small></div>"+
    '<p class="flash-nav no-print"><button class="btn ghost" id="gc-prev">◀ Prev</button> '+
    '<button class="btn ghost" id="gc-next">Next ▶</button></p>';
  v.innerHTML=h; wireCardFilters();
  var flipped=false, el=document.getElementById("gcard");
  el.onclick=function(){ flipped=!flipped;
    el.innerHTML=flipped?esc(c.back)+"<small>click to hide</small>":"<b>["+c.lec+"] "+esc(c.front)+"</b><small>click to reveal ("+(cardIdx+1)+"/"+deck.length+")</small>"; };
  document.getElementById("gc-prev").onclick=function(e){ e.stopPropagation(); cardIdx=(cardIdx-1+deck.length)%deck.length; renderCards(); };
  document.getElementById("gc-next").onclick=function(e){ e.stopPropagation(); cardIdx=(cardIdx+1)%deck.length; renderCards(); };
}
function wireCardFilters(){
  document.getElementById("cf-lec").onchange=function(e){ cardFilter.lec=e.target.value; cardIdx=0; renderCards(); };
  document.getElementById("cf-weak").onchange=function(e){ cardFilter.weak=e.target.checked; cardIdx=0; renderCards(); };
  document.getElementById("cf-shuf").onclick=function(){
    var d=cardDeck(); for(var i=d.length-1;i>0;i--){ var j=Math.floor(Math.random()*(i+1));
      var t=d[i];d[i]=d[j];d[j]=t; }
    // persist shuffle by rewriting deck order into a session cache
    window._shuf=d; cardIdx=0; renderShuffled(); };
}
function renderShuffled(){ // renders window._shuf if present
  var d=window._shuf; if(!d||!d.length){renderCards();return;}
  var v=document.getElementById("view");
  if(cardIdx>=d.length)cardIdx=0;
  var c=d[cardIdx];
  v.innerHTML='<h1>Flashcards (shuffled)</h1><p class="no-print"><button class="btn ghost" id="cf-back">← Back to filters</button></p>'+
    '<div class="flash" id="gcard"><b>['+c.lec+'] '+esc(c.front)+'</b><small>click to reveal ('+(cardIdx+1)+"/"+d.length+")</small></div>"+
    '<p class="flash-nav no-print"><button class="btn ghost" id="gc-prev">◀ Prev</button> <button class="btn ghost" id="gc-next">Next ▶</button></p>';
  document.getElementById("cf-back").onclick=function(){ window._shuf=null; renderCards(); };
  var flipped=false, el=document.getElementById("gcard");
  el.onclick=function(){ flipped=!flipped;
    el.innerHTML=flipped?esc(c.back)+"<small>click to hide</small>":"<b>["+c.lec+"] "+esc(c.front)+"</b><small>click to reveal ("+(cardIdx+1)+"/"+d.length+")</small>"; };
  document.getElementById("gc-prev").onclick=function(e){ e.stopPropagation(); cardIdx=(cardIdx-1+d.length)%d.length; renderShuffled(); };
  document.getElementById("gc-next").onclick=function(e){ e.stopPropagation(); cardIdx=(cardIdx+1)%d.length; renderShuffled(); };
}

/* ---------- home (study session) ---------- */
function renderHome(){
  var v=document.getElementById("view"); v.classList.add("wide");
  var st=load(LS_STREAK,{last:null,count:0});
  var rt=resumeTarget(), RL=lectureById(rt), weak=weakIds();
  var h='<h1>Study session</h1>';
  h+='<div class="card"><b>Pick up where you left off:</b> '+esc(rt)+' — '+esc(shortTitle(RL))+
    ' <button class="btn" data-goto="'+rt+'">Resume →</button></div>';
  h+='<div class="card">Due for review: <b>'+weak.length+' Weak-tagged topic'+(weak.length===1?"":"s")+'</b> '+
    '<button class="btn ghost" data-r="review">Open Review Queue</button><br>'+
    '<span class="src">Studied '+st.count+' day'+(st.count===1?"":"s")+' in a row'+(st.last?" · last: "+st.last:"")+' · progress in top bar</span></div>';
  h+='<h2>Lectures</h2><div class="grid">'+DATA.lectures.map(function(l){
    var q=(scores[l.id]&&scores[l.id].done)?" · quiz "+scores[l.id].ok+"/"+l.quizzes.length:"";
    return '<button data-goto="'+l.id+'"><b>'+l.id+"</b> — "+esc(shortTitle(l))+
      "<br><small>"+l.topics.length+" topics · "+minsOf(l)+" min · "+l.quizzes.length+" Qs · "+l.flashcards.length+" cards"+(studied[l.id]?" · ✓ studied":"")+q+"</small></button>";
  }).join("")+"</div>";
  h+='<h2>At-risk (not asked last year)</h2><div class="card">4 AI perspectives · risks · agent types · BFS/DFS/IDS · admissibility/consistency checks · b* · relaxed/pattern-DB · hill/beam · online vs offline · NEAT/CoDeepNEAT · CS#8 game playing (missing PDF) · PSO (external).</div>';
  v.innerHTML=h;
  v.querySelectorAll("[data-goto]").forEach(function(b){ b.onclick=function(){ goTo(b.getAttribute("data-goto")); }; });
  var rb=v.querySelector('[data-r="review"]'); if(rb)rb.onclick=function(){ render("review"); };
}

/* ---------- reference-PDF mini window (synced to scrollspy topic) ---------- */
var LS_PDFW="zg557.pdfwin.v1";
var pdfW=load(LS_PDFW,{open:true,w:0,h:0}), pdfCur="";
function pdfShow(){ var w=document.getElementById("pdfwin"); w.hidden=false;
  document.body.classList.add("pdfwin");
  if(pdfW.w>0)w.style.width=pdfW.w+"px"; if(pdfW.h>0)w.style.height=pdfW.h+"px"; }
function pdfHide(){ document.getElementById("pdfwin").hidden=true;
  document.body.classList.remove("pdfwin"); }
function pdfSrc(lid,page){ return "pdf/"+lid+".pdf#page="+page; }
function pdfLoad(lid,page){
  document.getElementById("pdf-title").textContent=lid+".pdf";
  document.getElementById("pdf-page").textContent="p. "+page;
  var link="pdf/"+lid+".pdf"; document.getElementById("pdf-link").href=link;
  document.getElementById("pdf-open").onclick=function(){ window.open(link,"_blank"); };
  var s=pdfSrc(lid,page);
  if(s!==pdfCur){ pdfCur=s; document.getElementById("pdf-frame").src=s; }
}
function topicPdfPage(sec){
  var imgs=sec.querySelectorAll(".topic-media img"), i, m;
  for(i=0;i<imgs.length;i++){ m=(imgs[i].getAttribute("src")||"").match(/-0?(\d{1,3})\.png$/);
    if(m){ var p=parseInt(m[1],10); if(p>=1&&p<=90)return p; } }
  m=(sec.textContent||"").match(/(?:slides?\s*(?:pp?\.?)?|p{1,2}\.?\s*)(\d{1,3})/i);
  if(m){ var q=parseInt(m[1],10); if(q>=1&&q<=90)return q; }
  return null;
}
function pdfOnTopic(sec){
  var w=document.getElementById("pdfwin"); if(!sec||!sec.dataset||!sec.dataset.tid||w.hidden)return;
  var p=topicPdfPage(sec); if(!p)return;
  var lid=(sec.dataset.tid.split("-")[0]||"").toUpperCase();
  if(!lectureById(lid))return;
  pdfLoad(lid,p);
}
function pdfRoute(){
  var L=lectureById(route);
  if(!L||pdfW.open===false){ pdfHide(); return; }
  pdfShow();
  var first=document.querySelector("#view section.topic"), p=first?topicPdfPage(first):null;
  pdfLoad(L.id,p||1);
}
document.getElementById("btn-pdf").onclick=function(){
  pdfW.open=!(pdfW.open!==false); save(LS_PDFW,pdfW);
  document.getElementById("btn-pdf").classList.toggle("on",pdfW.open!==false);
  if(pdfW.open!==false)pdfRoute(); else pdfHide(); };
document.getElementById("pdf-hide").onclick=function(){
  pdfW.open=false; save(LS_PDFW,pdfW);
  document.getElementById("btn-pdf").classList.remove("on"); pdfHide(); };
if(typeof ResizeObserver!=="undefined"){
  new ResizeObserver(function(es){ var w=document.getElementById("pdfwin"); if(!w||w.hidden)return;
    pdfW.w=Math.round(w.offsetWidth); pdfW.h=Math.round(w.offsetHeight); save(LS_PDFW,pdfW);
  }).observe(document.getElementById("pdfwin"));
}
/* top-left resize grip (native bottom-right handle stays too) */
(function(){ var grip=document.getElementById("pdf-grip"), win=document.getElementById("pdfwin");
  if(!grip||!win||!win.parentNode)return;
  grip.addEventListener("pointerdown",function(e){
    e.preventDefault();
    try{ grip.setPointerCapture(e.pointerId); }catch(err){}
    var sx=e.clientX, sy=e.clientY, sw=win.offsetWidth, sh=win.offsetHeight;
    function mv(ev){
      var nw=Math.min(Math.max(sw+(sx-ev.clientX),230),Math.min(window.innerWidth*0.92,560));
      var nh=Math.min(Math.max(sh+(sy-ev.clientY),170),window.innerHeight*0.82);
      win.style.width=nw+"px"; win.style.height=nh+"px";
    }
    function up(){ grip.removeEventListener("pointermove",mv);
      grip.removeEventListener("pointerup",up); grip.removeEventListener("pointercancel",up); }
    grip.addEventListener("pointermove",mv);
    grip.addEventListener("pointerup",up); grip.addEventListener("pointercancel",up);
  });
})();

/* ---------- read-aloud voice mode (built-in offline browser TTS) ----------
   Tip for the most human-like free voices: macOS System Settings →
   Accessibility → Spoken Content → download an Enhanced/Siri voice, then
   pick it below (Safari uses macOS voices). Wispr Flow needs no integration:
   it dictates into any text field, so use it for search, quiz answers & notes. */
var LS_TTS="zg557.tts.v1";
var ttsCfg=load(LS_TTS,{voice:"",rate:1}), ttsBlocks=[], ttsIdx=0, ttsPlaying=false, ttsTimer=null;
function ttsSupported(){ return ("speechSynthesis" in window)&&("SpeechSynthesisUtterance" in window); }
function ttsVoices(){ try{ return speechSynthesis.getVoices(); }catch(e){ return []; } }
function ttsStop(silent){
  try{ speechSynthesis.cancel(); }catch(e){}
  ttsPlaying=false; ttsIdx=0;
  if(ttsTimer){ clearInterval(ttsTimer); ttsTimer=null; }
  ttsUnwrapAll();
  var b=document.getElementById("tts-toggle");
  if(b&&!silent)b.textContent="▶ Play";
}
/* lecture finished: keep the spoken trail highlighted, just stop */
function ttsFinish(){
  try{ speechSynthesis.cancel(); }catch(e){}
  ttsPlaying=false;
  if(ttsTimer){ clearInterval(ttsTimer); ttsTimer=null; }
  document.querySelectorAll("#view span.w.w-on").forEach(function(s){
    s.classList.remove("w-on"); s.classList.add("w-done"); });
  document.querySelectorAll("#view .speaking").forEach(function(el){ el.classList.remove("speaking"); });
  var bf=document.getElementById("tts-toggle"); if(bf)bf.textContent="▶ Play";
  var tf=document.getElementById("tts-track"); if(tf)tf.textContent="Done ✓";
}
/* word-wrap blocks into span.w (preserves inner markup); the wrapped trail is
   kept while reading and restored all-at-once by ttsUnwrapAll */
var ttsWrapped=[];
function ttsUnwrapAll(){
  ttsWrapped.forEach(function(w){ try{ w.el.innerHTML=w.html; }catch(e){}
    try{ delete w.el.dataset.ww; }catch(e){} });
  ttsWrapped=[];
  document.querySelectorAll("#view .speaking").forEach(function(el){ el.classList.remove("speaking"); });
}
function ttsWrap(el){
  if(el.dataset.ww)return;
  ttsWrapped.push({el:el,html:el.innerHTML});
  var walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT,null), nodes=[],n;
  while((n=walker.nextNode()))nodes.push(n);
  nodes.forEach(function(tn){
    var parts=tn.nodeValue.split(/(\s+)/);
    if(parts.length<=1)return;
    var frag=document.createDocumentFragment();
    parts.forEach(function(part){
      if(!part)return;
      if(/^\s+$/.test(part))frag.appendChild(document.createTextNode(part));
      else{ var s=document.createElement("span"); s.className="w"; s.textContent=part; frag.appendChild(s); }
    });
    tn.parentNode.replaceChild(frag,tn);
  });
  el.dataset.ww="1";
}
function ttsResetBlock(el){
  el.querySelectorAll("span.w").forEach(function(s){ s.classList.remove("w-on"); s.classList.remove("w-done"); });
}
function ttsPickVoice(){
  var vs=ttsVoices(); if(!vs.length)return null;
  var v=vs.filter(function(x){ return x.voiceURI===ttsCfg.voice; })[0]
    || vs.filter(function(x){ return /^en([-_]|$)/i.test(x.lang); })[0] || vs[0];
  return v;
}
function ttsSpeak(i){
  if(i>=ttsBlocks.length){ ttsFinish(); return; }
  ttsIdx=i;
  if(ttsTimer){ clearInterval(ttsTimer); ttsTimer=null; }
  var blk=ttsBlocks[i];
  ttsWrap(blk.el);
  ttsResetBlock(blk.el);
  blk.el.classList.add("speaking");
  try{ blk.el.scrollIntoView({block:"center"}); }catch(e){}
  var spans=blk.el.querySelectorAll("span.w"), shown=-1;
  var wpm=160*(ttsCfg.rate||1), anchorIdx=0, anchorT=Date.now();
  function paint(idx){
    if(idx>spans.length-1)idx=spans.length-1;
    if(idx<=shown||idx<0)return;
    var k;
    if(shown>=0&&spans[shown]){ spans[shown].classList.remove("w-on"); spans[shown].classList.add("w-done"); }
    for(k=shown+1;k<idx&&k<spans.length;k++){ spans[k].classList.add("w-done"); }
    if(spans[idx])spans[idx].classList.add("w-on");
    shown=idx;
  }
  function tick(){
    if(!ttsPlaying)return;
    paint(anchorIdx+Math.floor((Date.now()-anchorT)*wpm/60000));
  }
  var u=new SpeechSynthesisUtterance(blk.text);
  var v=ttsPickVoice(); if(v)u.voice=v;
  u.rate=ttsCfg.rate||1;
  u.onboundary=function(e){ /* exact karaoke where supported; timer covers the rest */
    if(!e||typeof e.charIndex!=="number")return;
    var idx=blk.text.slice(0,e.charIndex).split(" ").filter(function(w){ return !!w; }).length;
    anchorIdx=idx; anchorT=Date.now(); paint(idx);
  };
  u.onend=function(){ if(!ttsPlaying)return;
    if(ttsTimer){ clearInterval(ttsTimer); ttsTimer=null; }
    var k; for(k=0;k<spans.length;k++){ spans[k].classList.remove("w-on"); spans[k].classList.add("w-done"); }
    blk.el.classList.remove("speaking"); ttsSpeak(i+1); };
  u.onerror=function(){ if(!ttsPlaying)return;
    if(ttsTimer){ clearInterval(ttsTimer); ttsTimer=null; } ttsSpeak(i+1); };
  try{ speechSynthesis.speak(u); }catch(e){ ttsStop(); return; }
  ttsTimer=setInterval(tick,110);
  var t2=document.getElementById("tts-track");
  if(t2)t2.textContent="Block "+(i+1)+" / "+ttsBlocks.length;
}
function ttsCollect(){
  var out=[];
  document.querySelectorAll("#view .lec-body section.topic").forEach(function(sec){
    var h=sec.querySelector("h3"), topic=h?h.textContent.replace(/\s+/g," ").trim():"";
    sec.querySelectorAll(".topic-body > p, .topic-body > ul > li, .topic-body > ol > li").forEach(function(el){
      if(el.closest(".topic-tools,.notes,.topic-media"))return;
      var t=(el.textContent||"").replace(/\s+/g," ").trim();
      if(t.length>25)out.push({el:el,text:t,topic:topic});
    });
  });
  return out;
}
function ttsStart(){
  ttsStop(true);
  ttsBlocks=ttsCollect();
  if(!ttsBlocks.length)return;
  ttsPlaying=true;
  var b=document.getElementById("tts-toggle"); if(b)b.textContent="⏸ Pause";
  ttsSpeak(0);
}
function ttsGoTo(bl){
  ttsStop(true);
  ttsBlocks=ttsCollect();
  var at=0;
  ttsBlocks.forEach(function(b,j){ if(b.el===bl.el)at=j; });
  ttsPlaying=true;
  var t=document.getElementById("tts-toggle"); if(t)t.textContent="⏸ Pause";
  ttsSpeak(at);
}
function ttsBar(){
  var bar=document.createElement("div"); bar.className="tts-bar no-print";
  var vs=ttsVoices();
  bar.innerHTML='<b>🔊 Listen</b><button id="tts-toggle">▶ Play</button>'+
    '<button id="tts-stop">■ Stop</button>'+
    '<select id="tts-rate" title="Speed">'+[0.75,1,1.25,1.5].map(function(r){
      return '<option value="'+r+'"'+(ttsCfg.rate===r?" selected":"")+'>'+r+'×</option>'; }).join("")+'</select>'+
    '<select id="tts-voice" title="Voice"><option value="">Auto voice</option>'+
    vs.map(function(x){ return '<option value="'+esc(x.voiceURI)+'"'+(ttsCfg.voice===x.voiceURI?" selected":"")+'>'+esc(x.name+" ("+x.lang+")")+'</option>'; }).join("")+'</select>'+
    '<input id="tts-find" type="search" placeholder="Find & speak…  (e.g. admissible)" autocomplete="off" aria-label="Find passage to speak">'+
    '<div id="tts-sugg" hidden></div>'+
    '<span class="src" id="tts-track"></span>';
  var v=document.getElementById("view"); v.insertBefore(bar,v.firstChild);
  wireTtsFind();
  document.getElementById("tts-toggle").onclick=function(){
    if(ttsPlaying){ try{ speechSynthesis.cancel(); }catch(e){} ttsPlaying=false; this.textContent="▶ Play"; }
    else if(ttsBlocks.length&&ttsIdx<ttsBlocks.length){ ttsPlaying=true; this.textContent="⏸ Pause"; ttsSpeak(ttsIdx); }
    else ttsStart(); };
  document.getElementById("tts-stop").onclick=function(){ ttsStop(); };
/* autocomplete find-and-speak: filters lecture passages, Enter/click speaks from there */
function wireTtsFind(){
  var inp=document.getElementById("tts-find"), box=document.getElementById("tts-sugg");
  if(!inp||!box)return;
  var index=ttsCollect(), sel=0, cur=[];
  function close(){ box.hidden=true; box.innerHTML=""; cur=[]; sel=0; }
  function pick(bl){ close(); inp.value=bl.topic||""; ttsGoTo(bl); }
  inp.addEventListener("input",function(){
    var q=inp.value.trim().toLowerCase();
    if(q.length<2){ close(); return; }
    cur=index.filter(function(b){
      return b.text.toLowerCase().indexOf(q)>=0||b.topic.toLowerCase().indexOf(q)>=0;
    }).slice(0,6);
    sel=0;
    if(!cur.length){ box.hidden=true; box.innerHTML=""; return; }
    box.innerHTML=cur.map(function(b,i){
      var at=b.text.toLowerCase().indexOf(q), sn=b.text;
      if(at>=0)sn=(at>40?"…"+sn.slice(at-40):sn.slice(0,at))+sn.slice(Math.max(0,at),at+100)+(sn.length>at+100?"…":"");
      return '<a href="#" data-k="'+i+'" class="'+(i===sel?"on":"")+'"><b>'+esc(b.topic.split("—")[0].trim())+"</b> — <small>"+esc(sn.slice(0,110))+"</small></a>";
    }).join("");
    box.hidden=false;
    box.querySelectorAll("a").forEach(function(a){
      a.onclick=function(e){ e.preventDefault(); pick(cur[+a.getAttribute("data-k")]); };
      a.onmousemove=function(){ sel=+a.getAttribute("data-k");
        box.querySelectorAll("a").forEach(function(x){ x.classList.remove("on"); }); a.classList.add("on"); };
    });
  });
  inp.addEventListener("keydown",function(e){
    if(box.hidden||!cur.length)return;
    if(e.key==="ArrowDown"){ e.preventDefault(); sel=(sel+1)%cur.length; }
    else if(e.key==="ArrowUp"){ e.preventDefault(); sel=(sel-1+cur.length)%cur.length; }
    else if(e.key==="Enter"){ e.preventDefault(); pick(cur[sel]); return; }
    else if(e.key==="Escape"){ close(); return; }
    else return;
    box.querySelectorAll("a").forEach(function(x,i){ x.classList.toggle("on",i===sel); });
  });
  inp.addEventListener("blur",function(){ setTimeout(close,150); });
}
  document.getElementById("tts-rate").onchange=function(e){ ttsCfg.rate=parseFloat(e.target.value)||1;
    save(LS_TTS,ttsCfg); if(ttsPlaying){ var i=ttsIdx; ttsStop(true); ttsPlaying=true; ttsSpeak(i); } };
  document.getElementById("tts-voice").onchange=function(e){ ttsCfg.voice=e.target.value;
    save(LS_TTS,ttsCfg); if(ttsPlaying){ var j=ttsIdx; ttsStop(true); ttsPlaying=true; ttsSpeak(j); } };
  if(typeof speechSynthesis!=="undefined"){
    try{ speechSynthesis.onvoiceschanged=function(){
      var s=document.getElementById("tts-voice"); if(!s)return;
      var cur=s.value, vs=ttsVoices();
      s.innerHTML='<option value="">Auto voice</option>'+vs.map(function(x){
        return '<option value="'+esc(x.voiceURI)+'"'+(cur===x.voiceURI?" selected":"")+'>'+esc(x.name+" ("+x.lang+")")+'</option>'; }).join("");
    }; }catch(e){}
  }
}

/* ---------- router ---------- */
function goTo(lid,tid){ route=lid; render(route,tid); }
function render(r,tid){
  if(r)route=r;
  if(typeof ttsStop==="function")ttsStop(true);
  if(spyObs){spyObs.disconnect();spyObs=null;}
  renderNav();
  var v=document.getElementById("view"); v.classList.remove("wide");
  document.getElementById("toc-list").innerHTML=""; document.getElementById("toc").style.display="none";
  if(route==="home"){ renderHome(); }
  else if(route==="review"){ renderReview(); }
  else if(route==="cards"){ window._shuf=null; renderCards(); }
  else if(route==="gallery"){ renderGallery(); }
  else if(route==="cheat"){ v.classList.add("wide"); v.innerHTML=DATA.cheatSheetHtml+'<p class="no-print"><button class="btn" onclick="window.print()">Print cheat sheet</button></p>'; }
  else if(route==="pattern"){ v.classList.add("wide"); v.innerHTML=DATA.examPatternHtml; }
  else {
    var L=lectureById(route);
    if(!L){ route="home"; renderHome(); return; }
    save(LS_LAST,{lecture:L.id,ts:Date.now()}); touchStreak();
    v.innerHTML='<h1>'+esc(L.title)+'</h1>'+
      '<p class="src">'+minsOf(L)+' min read · '+L.topics.length+' topics · '+L.quizzes.length+' self-check · '+L.flashcards.length+' cards &nbsp; '+
      '<label class="no-print"><input type="checkbox" id="studied-now" '+(studied[L.id]?"checked":"")+'> studied</label> '+
      '<button class="btn ghost no-print" id="lec-diags">Diagrams ('+diagCount(L.id)+')</button>'+
      (ttsSupported()?' <button class="btn ghost no-print" id="lec-listen">🔊 Listen</button>':'')+'</p>'+
      '<div class="lec-body">'+L.html+"</div>"+diagBlock(L)+"<hr>"+renderQuiz(L)+"<hr>"+renderFlash(L);
    document.getElementById("studied-now").onchange=function(e){ studied[L.id]=e.target.checked;
      save(LS_STUDIED,studied); updateProgress(); renderNav(); };
    document.getElementById("lec-diags").onclick=function(){ var d=document.getElementById("lec-diags");
      if(d)d.open=!d.open; if(d&&d.open)d.scrollIntoView({block:"start"}); };
    var lb=document.getElementById("lec-listen");
    if(lb)lb.onclick=function(){ if(!document.getElementById("tts-toggle"))ttsBar(); ttsStart();
      document.querySelector(".tts-bar").scrollIntoView({block:"start"}); };
    var matched=structureLecture(L); buildTOC(matched); wireQuiz(L); wireFlash(L);
    if(location.protocol==="file:"&&v.querySelector(".video")){
      var fw=document.createElement("div"); fw.className="card filewarn no-print";
      fw.innerHTML="⚠ <b>Videos vs file://:</b> YouTube embeds show <i>Error 153</i> on pages opened directly as files — "+
        "open this dashboard over http instead: <code>http://localhost:8000/dashboard/</code> (a local server is already running on this machine). "+
        "If that address fails, start it with:<br><code>cd \"/Users/s4dge/Downloads/study/S2/ACI\" &amp;&amp; nohup python3 -m http.server 8000 &gt;/dev/null 2&gt;&amp;1 &amp;</code>"+
        "<br>Still erroring over http? Disable ad-blocker / Brave Shields for localhost, then reload. "+
        "Images, PDFs and quizzes work offline either way; each video also has a <i>Watch on YouTube</i> link.";
      var fv=v.querySelector(".video"); if(fw&&fv)fv.parentNode.insertBefore(fw,fv);
    }
    if(tid){ var el=document.getElementById(tid);
      if(el){ el.scrollIntoView({block:"start"});
        var sc=el.closest?el.closest("section.topic"):null;
        if(lectureById(route)){ pdfShow(); var pp=sc?topicPdfPage(sc):null;
          if(pp)pdfLoad(route,pp); else pdfRoute(); }
        return; } }
  }
  if(lectureById(route))pdfRoute(); else pdfHide();
  window.scrollTo(0,0);
}

/* ---------- smarter search: snippets + topic anchors ---------- */
function escRe(s){ return s.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"); }
function guessTopic(L,idx){
  var ctx=L.text.slice(Math.max(0,idx-80),idx+80).toLowerCase().split(/[^a-z0-9ρ]+/);
  var set={}; ctx.forEach(function(w){ if(w.length>3)set[w]=1; });
  var best=null,bs=0;
  L.topics.forEach(function(t){ var words=t.name.toLowerCase().split(/[^a-z0-9]+/).filter(function(w){return w.length>3;});
    var s=words.filter(function(w){return set[w];}).length;
    if(s>bs){bs=s;best=t;} });
  return bs>0?best:null;
}
document.getElementById("search").addEventListener("input",function(e){
  var box=document.getElementById("search-results");
  var q=e.target.value.trim(); if(q.length<2){box.hidden=true;box.innerHTML="";return;}
  var ql=q.toLowerCase(), hits=[];
  DATA.lectures.forEach(function(L){
    var tl=L.text.toLowerCase(), from=0, n=0;
    while(n<4){ var ix=tl.indexOf(ql,from); if(ix<0)break;
      var sn=L.text.slice(Math.max(0,ix-60),ix+120);
      hits.push({l:L.id,ix:ix,sn:sn,t:guessTopic(L,ix)}); from=ix+ql.length; n++; }
  });
  hits=hits.slice(0,12);
  box.hidden=!hits.length;
  box.innerHTML=hits.map(function(h,i){
    var s=esc(h.sn).replace(new RegExp("("+escRe(esc(q))+")","ig"),"<mark>$1</mark>");
    return '<a href="#" data-s="'+h.l+'" data-t="'+(h.t?h.t.id:"")+'" data-ix="'+i+'"><b>'+h.l+"</b>"+(h.t?" → "+esc(h.t.name):"")+" — <small>"+s+"</small></a>";
  }).join("")||"";
  box.querySelectorAll("a").forEach(function(a){ a.onclick=function(ev){ ev.preventDefault();
    document.getElementById("search").value=""; box.hidden=true;
    var t=a.getAttribute("data-t"); goTo(a.getAttribute("data-s"),t||undefined); }; });
});

/* ---------- reading progress on scroll ---------- */
window.addEventListener("scroll",function(){
  var bar=document.querySelector("#read-progress span");
  var body=document.querySelector("#view .lec-body");
  if(!body||!lectureById(route)){bar.style.width="0";return;}
  var r=body.getBoundingClientRect(), total=r.height-window.innerHeight+200;
  var done=Math.min(Math.max((200-r.top)/Math.max(total,1),0),1);
  bar.style.width=(done*100)+"%";
},{passive:true});

/* ---------- keyboard ---------- */
document.addEventListener("keydown",function(e){
  var t=e.target, typing=t&&(t.tagName==="INPUT"||t.tagName==="TEXTAREA"||t.tagName==="SELECT"||t.isContentEditable);
  if(e.key==="Escape"){ document.getElementById("search-results").hidden=true;
    document.getElementById("keys-pop").hidden=true; return; }
  if(typing)return;
  if(e.key==="/"){ e.preventDefault(); document.getElementById("search").focus(); }
  else if(e.key==="?"){ var k=document.getElementById("keys-pop"); k.hidden=!k.hidden; }
  else if(e.key==="f"||e.key==="F"){ focusMode=!focusMode; save(LS_FOCUS,focusMode); applyFocus(); }
  else if(e.key==="ArrowRight"||e.key==="ArrowLeft"){
    var i=lecIdx(route); if(i<0)return;
    var j=e.key==="ArrowRight"?Math.min(i+1,DATA.lectures.length-1):Math.max(i-1,0);
    render(DATA.lectures[j].id); }
});
document.getElementById("btn-keys").onclick=function(){ var k=document.getElementById("keys-pop"); k.hidden=!k.hidden; };

/* ---------- topbar controls ---------- */
document.getElementById("btn-focus").onclick=function(){ focusMode=!focusMode; save(LS_FOCUS,focusMode); applyFocus(); };
document.getElementById("btn-theme").onclick=function(){
  theme=theme==="dark"?"sepia":(theme==="sepia"?"light":"dark"); save(LS_THEME,theme); applyTheme(); };
document.getElementById("btn-font-inc").onclick=function(){ typeCtl.fs=Math.min(22,typeCtl.fs+1); save(LS_TYPE,typeCtl); applyType(); };
document.getElementById("btn-font-dec").onclick=function(){ typeCtl.fs=Math.max(15,typeCtl.fs-1); save(LS_TYPE,typeCtl); applyType(); };
document.getElementById("btn-lh").onclick=function(){
  var steps=[1.6,1.75,1.9]; var i=steps.indexOf(typeCtl.lh); typeCtl.lh=steps[(i+1)%steps.length];
  save(LS_TYPE,typeCtl); applyType(); };

/* ---------- pomodoro ---------- */
var TM={focusLen:25*60,brkLen:5*60,left:25*60,run:false,mode:"Focus",cycles:0,t:null};
function tmShow(){ var m=Math.floor(TM.left/60),s=TM.left%60;
  document.getElementById("tm-time").textContent=(m<10?"0":"")+m+":"+(s<10?"0":"")+s;
  document.getElementById("tm-mode").textContent=TM.mode+" · "+TM.cycles+"✓"; }
function tmTick(){ TM.left--;
  if(TM.left<=0){ if(TM.mode==="Focus"){TM.cycles++;TM.mode="Break";TM.left=TM.brkLen;}
    else {TM.mode="Focus";TM.left=TM.focusLen;} }
  tmShow(); document.title="("+document.getElementById("tm-time").textContent+") ZG557"; }
document.getElementById("btn-timer").onclick=function(){ var t=document.getElementById("timer");
  t.hidden=!t.hidden; if(!t.hidden)tmShow(); };
document.getElementById("tm-hide").onclick=function(){ document.getElementById("timer").hidden=true; };
document.getElementById("tm-start").onclick=function(){
  TM.run=!TM.run; document.getElementById("tm-start").textContent=TM.run?"Pause":"Start";
  if(TM.run){TM.t=setInterval(tmTick,1000);} else {clearInterval(TM.t);document.title="ZG557 Mid-Sem Study Dashboard";} };
document.getElementById("tm-reset").onclick=function(){ TM.run=false; clearInterval(TM.t);
  TM.mode="Focus"; TM.left=TM.focusLen; document.getElementById("tm-start").textContent="Start";
  document.title="ZG557 Mid-Sem Study Dashboard"; tmShow(); };
document.getElementById("tm-m25").onclick=function(){ TM.focusLen=25*60;TM.brkLen=5*60;TM.left=TM.focusLen;TM.mode="Focus";
  document.getElementById("tm-m25").classList.add("on");document.getElementById("tm-m50").classList.remove("on");tmShow(); };
document.getElementById("tm-m50").onclick=function(){ TM.focusLen=50*60;TM.brkLen=10*60;TM.left=TM.focusLen;TM.mode="Focus";
  document.getElementById("tm-m50").classList.add("on");document.getElementById("tm-m25").classList.remove("on");tmShow(); };

/* ---------- init ---------- */
applyTheme(); applyType(); applyFocus(); tmShow();
document.getElementById("btn-pdf").classList.toggle("on",pdfW.open!==false);
render("home");
})();
