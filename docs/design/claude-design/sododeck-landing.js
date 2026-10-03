// Sododeck landing page (sododeck.com) · direction B · Deck
// Product visuals are real renders from sododeck-cards.js (SDC.lib) and sododeck-db.js (SDDB.lib).
// Motion: CSS keyframes generated here (one stylesheet in <head>), CSS offset-path for the flow token.
(function(){
function init(){
const SDC=window.SDC,DB=window.SDDB;
if(!SDC||!SDC.lib||!DB||!DB.lib||!window.React||!window.lucide)return false;
const L=SDC.lib,DL=DB.lib,R=window.React,h=R.createElement;
const {PAL,Ic,X,D,S,as,G,M,card,shape,frame,proxy,anc,geom,edgeStyle,labelEl,startMark,arrow,stepBadge,token,nodeBox,pnl,btnI,kbd,chip,ml,pathOrth}=L;
const TK=th=>L.TK('B',th);
// ---------- keyframes
let sheet=null;const KFI={};let kfN=0;
const sh=()=>{if(!sheet){let el=document.getElementById('sdl-kf');if(!el){el=document.createElement('style');el.id='sdl-kf';document.head.appendChild(el);}sheet=el.sheet;}return sheet;};
const kb=k=>k.replace(/[A-Z]/g,x=>'-'+x.toLowerCase());
const css=o=>Object.entries(o).map(([k,v])=>kb(k)+':'+v).join(';');
function kf(pts,dur){const P=x=>Math.max(0,Math.min(100,x/dur*100)).toFixed(3)+'%';const tf=p=>p[2]?';animation-timing-function:'+p[2]:'';const fr=[];
 if(pts[0][0]>0)fr.push('0%{'+css(pts[0][1])+tf(pts[0])+'}');pts.forEach(p=>fr.push(P(p[0])+'{'+css(p[1])+tf(p)+'}'));const l=pts[pts.length-1];if(l[0]<dur)fr.push('100%{'+css(l[1])+'}');
 const body=fr.join('');let n=KFI[body];if(!n){n='sdl'+(++kfN);KFI[body]=n;try{const s=sh();s.insertRule('@keyframes '+n+'{'+body+'}',s.cssRules.length);}catch(e){console.warn('kf',e);}}return n;}
// m = {on, dur, loop, at}: at freezes the timeline at that second (storyboard). No m → final frame, static.
function an(m,pts){if(!m||!m.on)return {};const st={animationName:kf(pts,m.dur),animationDuration:m.dur+'s',animationTimingFunction:'ease',animationFillMode:'both',animationIterationCount:m.loop?'infinite':1};if(m.at!=null){st.animationDelay=(-m.at)+'s';st.animationPlayState='paused';}return st;}
const fadeIn=(m,t0,d,from)=>an(m,[[t0,as({opacity:0},from||{})],[t0+(d||.35),as({opacity:1},from?{transform:'none'}:{})]]);

// ---------- copy
const CP={
 nav:['Features','Database','Docs','Blog'],open:'Open app',
 hero:{A:'Describe your system. Get a living map.',B:'Your AI drafts the system. You get a map you can run.',C:'From a prompt to a map you can click, trace and edit.'},
 sub:'Your agent writes the architecture as one open file. Sododeck opens it as a living map: services, flows, rules and the tables behind them, on one canvas.',
 cta1:'Start drawing — no sign-up',cta2:'Get the AI skill',small:'Runs with your own AI. Nothing leaves your browser.',
 gen:['From a description, a codebase or Mermaid text','Validated before it opens','Laid out automatically'],
 prompt:['Map our checkout: web, gateway, order','service with Postgres, payments, Kafka,','shipping. Include the checkout flow.'],
 proof:[['user-round-x','No account'],['wifi-off','Works offline'],['braces','Open JSON format'],['shield-check','Nothing sent anywhere']],
 explore:{e:'Step 2 · Explore',h:'See the whole system, then just the part you need',b:'Zoom out and cards become icons; zoom in and they show fields and tags. Focus a card to see only what it talks to, or open a group to work inside it.',
  caps:[['bookmark','Saved views','Keep a named camera and filter for each audience.'],['layout-grid','Auto-layout','Arrange the deck in one step. Pinned cards stay where you put them.'],['search','Search','Jump to any card, table or step by name or id.']]},
 flows:{e:'Step 3 · Flows',h:'Watch a flow run end to end',b:'Flows are objects with steps, conditions and rules, not coloured lines. Play one and the deck deals each step in order; a branch shows where the path splits.'},
 know:{e:'Step 4 · Knowledge',h:'Rules live where they apply',b:'Attach a decision table to the step it governs. The inspector shows the step, its condition and its rule. Stickies and notes hold what is still open.'},
 db:{e:'Step 5 · Database',h:'The tables behind the map, on the same canvas',b:'Open a database card and its tables are there: columns, keys, enums and indexes, with relationships attached to the columns they join. One SQL dialect per deck: Postgres, MySQL or SQLite.',
  pts:[['file-down','Draw tables, or import SQL and DBML.'],['workflow','Flows show which tables each step touches.'],['file-code','Export runnable SQL for your dialect.']]},
 code:{e:'Step 6 · Code',h:'One document, two views',b:'The canvas and the code panel edit the same file. Select a card and its JSON is highlighted; change the JSON or the DBML and the canvas follows.'},
 edit:{e:'Step 7 · Edit',h:'AI drafts it. You own it.',b:'Change anything by hand: rename a card in place, pick colours for cards and tags, align with guides, snap and resize, and re-route a connector by dragging its bends.'},
 local:{e:'Step 8 · Own your file',h:'Your decks stay on your machine',b:'No account. Decks live in your browser and keep working offline, and nothing is sent anywhere. The format is open JSON, so your work is never locked in.'},
 fin:{h:'Start with a prompt, or with a blank canvas.',b:'Sododeck runs in your browser. Bring your own AI, or draw it by hand.'},
 foot:['Product','Docs','Blog','Privacy','Terms'],copy:'© 2026 Sododeck'};

// ---------- sample deck "Checkout"
const W0=1084,H0=520;
const NODES=[
 {k:'web',x:24,y:72,c:{type:'client',title:'Web app',desc:'Storefront',id:'web'}},
 {k:'gw',x:24,y:236,c:{type:'gateway',title:'API Gateway',desc:'Auth, rate limits',id:'api-gateway'}},
 {k:'svc',x:300,y:72,c:{type:'service',title:'Order Service',desc:'Creates the order',id:'order-svc'}},
 {k:'odb',x:300,y:236,c:{type:'database',title:'Orders DB',desc:'Primary + replica',color:'blue',kids:3,id:'orders-db'}},
 {k:'pay',x:576,y:72,c:{type:'service',title:'Payment Service',desc:'Authorises, captures',id:'payment-svc'}},
 {k:'psp',x:576,y:236,c:{type:'external',title:'Payment Provider',desc:'Card acquirer, 3DS',id:'payment-provider'}},
 {k:'kfk',x:852,y:72,c:{type:'queue',typeName:'Kafka topic',title:'order.placed',id:'order-placed'}},
 {k:'ship',x:852,y:256,c:{type:'service',title:'Shipping Service',desc:'Books the carrier',id:'shipping-svc'}},
 {k:'cancel',kind:'shape',x:600,y:420,c:{shape:'pill',title:'Cancel order',w:136,h:40}}];
const NB={};NODES.forEach(n=>NB[n.k]=n);
const FRAMES=[{x:0,y:36,w:232,h:326,title:'Edge',n:2},{x:276,y:36,w:232,h:358,title:'Orders',n:2},{x:552,y:36,w:232,h:326,title:'Payments',n:2},{x:828,y:36,w:232,h:137,title:'Messaging',n:1},{x:828,y:220,w:232,h:162,title:'Fulfilment',n:1}];
const EDGES=[{id:1,a:'web',as:'b',b:'gw',bs:'t',label:'checkout'},{id:2,a:'gw',as:'r',b:'svc',bs:'l',label:'POST /orders',lp:.55},{id:3,a:'svc',as:'b',b:'odb',bs:'t',label:'writes orders',rel:'writes'},
 {id:4,a:'svc',as:'r',b:'pay',bs:'l',label:'authorize'},{id:5,a:'pay',as:'b',b:'psp',bs:'t',label:'charge'},{id:6,a:'psp',as:'r',b:'kfk',bs:'l',label:'payment.succeeded',lp:.5},{id:7,a:'kfk',as:'b',b:'ship',bs:'t',bat:150,label:'consume',lp:.35},
 {id:'f',a:'psp',as:'b',b:'cancel',bs:'t',label:'failed · retry ×3',err:true}];
const STEPS=[['Start at Web app','checkout'],['Web app → API Gateway','checkout'],['API Gateway → Order Service','POST /orders'],['Order Service → Orders DB','writes orders'],['Order Service → Payment Service','authorize'],['Payment Service → Payment Provider','charge'],['Payment Provider → order.placed','payment.succeeded'],['order.placed → Shipping Service','consume']];
const SEQ=[{e:1,k:'gw',n:2},{e:2,k:'svc',n:3},{e:3,k:'odb',n:4},{e:4,k:'pay',n:5},{e:5,k:'psp',n:6},{e:6,k:'kfk',n:7},{e:7,k:'ship',n:8}];
const TBL={orders:DL.mk('orders',[['id','uuid','pk'],['customer_id','uuid','fk:customers.id'],['status','order_status','en:order_status'],['total_cents','int'],['created_at','timestamptz']],{idx:2}),
 order_items:DL.mk('order_items',[['order_id','uuid','pk fk:orders.id'],['product_id','uuid','pk'],['qty','int'],['price_cents','int']]),
 payments:DL.mk('payments',[['id','uuid','pk'],['order_id','uuid','fk:orders.id'],['provider','text'],['amount_cents','int'],['status','text']])};
const DBML=['Table orders {','  id uuid [pk]','  customer_id uuid [ref: > customers.id]','  status order_status [not null]','  total_cents int [not null]','  created_at timestamptz [not null]','  indexes {','    customer_id','    created_at','  }','}','','Table payments {','  id uuid [pk]','  order_id uuid [ref: > orders.id]','  provider text','  amount_cents int','  status text','}','','Enum order_status {','  pending','  paid','  shipped','  cancelled','}'];
const JSONL=['{','  "$schema":','    "https://sododeck.com/schema/v1.json",','  "version": 1,','  "name": "Checkout",','  "groups": [ … ],','  "nodes": [','    {','      "id": "order-svc",','      "type": "service",','      "title": "Order Service",','      "group": "orders",','      "description": "Creates the order"','    },','    {','      "id": "orders-db",','      "type": "database",','      "title": "Orders DB"','    }','  ],','  "edges": [{ "id": "e-writes-orders",','    "from": "order-svc", "to": "orders-db",','    "label": "writes orders" }],','  "flows": [{ "id": "checkout", … }]','}'];
const GENJ=['{','  "$schema":','    "https://sododeck.com/schema/v1.json",','  "version": 1,','  "name": "Checkout",','  "nodes": [','    { "id": "order-svc",','      "type": "service",','      "title": "Order Service" },','    …','  ],','  "edges": [ … ],','  "flows": [ … ]','}'];

// ---------- deck renderer (frames, edges, cards, labels, optional flow layer)
function deckEls(t,o){o=o||{};const nodes=o.nodes||NODES,edges=o.edges||EDGES,frames=o.frames||FRAMES,ns=o.ns||{},es=o.es||{},m=o.m;const ww=o.w||W0,wh=o.h||H0;
 const box={};nodes.forEach(n=>{box[n.k]=nodeBox(t,n);});
 const G={};edges.forEach(e=>{const a=box[e.a],b=box[e.b];if(!a||!b)return;const p1=anc(t,a,e.as,e.aat),p2=anc(t,b,e.bs,e.bat);G[e.id]=as(geom(t,p1,e.as,p2,e.bs),{p1,p2});});
 const fr=frames.map((f,i)=>D(as({position:'absolute',left:0,top:0},o.fA?o.fA(i):{}),frame(t,f)));
 const svg=[],lab=[];
 edges.forEach((e,i)=>{const g=G[e.id];if(!g)return;const sk=es[e.id]||(e.err?'err':null);const st=edgeStyle(t,{st:sk,rel:e.rel});const ea=o.eA?o.eA(e,i):{};
  svg.push(h('g',{key:'e'+e.id,opacity:st.op,style:ea},st.c===t.ac?h('path',{d:g.d,fill:'none',stroke:t.ac,strokeOpacity:.18,strokeWidth:st.w+6,strokeLinecap:'round'}):null,
   h('path',{d:g.d,fill:'none',stroke:st.c,strokeWidth:st.w,strokeDasharray:st.dash||undefined,strokeLinecap:st.dash==='1.5 4'||st.dash==='2 6'?'round':'butt'}),startMark(t,g.p1,st.c),arrow(t,g.p2,e.bs,st.c)));
  if(e.label&&o.labels!==false)lab.push(D(as({position:'absolute',left:0,top:0,zIndex:2},ea),labelEl(t,g.at(e.lp||.5),e.label,{cur:sk==='cur',err:sk==='err',dim:sk==='dim'})));});
 const F=o.flow?flowLayer(t,G,box,o.flow,m,ww,wh):null;
 const nd=nodes.map((n,i)=>{const s=ns[n.k]||{};const st2=as({},o.zoom?{zoom:o.zoom}:{},s);const el=n.kind==='shape'?shape(t,n.c,st2):n.kind==='proxy'?proxy(t,n.c,0,0,n.w):card(t,n.c,st2);
  return D(as({position:'absolute',left:n.x,top:n.y,width:box[n.k].w,zIndex:s.sel||s.ph==='cur'?3:1},o.nA?o.nA(n,i):{}),el);});
 return {G,box,els:[fr,X('svg',{width:ww,height:wh,style:{position:'absolute',left:0,top:0,overflow:'visible',pointerEvents:'none'}},svg),F&&F.svg,nd,lab,F&&F.els,o.extra]};}
// flow: {start:{k,n}, seq:[{e,k,n}], t0, step, pre:[edge ids], preN:[[k,n]]}
function flowLayer(t,G,box,f,m,ww,wh){const svg=[],out=[],N=f.seq.length;const slot=i=>[f.t0+i*f.step,f.t0+(i+1)*f.step];const dw=t.edgeW+.5,cw=t.edgeW+1.25;
 (f.pre||[]).forEach(id=>{const g=G[id];if(g)svg.push(h('path',{key:'p'+id,d:g.d,fill:'none',stroke:t.tx2,strokeWidth:dw}));});
 f.seq.forEach((s,i)=>{const g=G[s.e];if(!g)return;const [a,b]=slot(i),last=i===N-1;
  if(!last)svg.push(h('path',{key:'d'+i,d:g.d,fill:'none',stroke:t.tx2,strokeWidth:dw,style:as({opacity:1},an(m,[[b,{opacity:0}],[b+.15,{opacity:1}]]))}));
  svg.push(h('path',{key:'o'+i,d:g.d,fill:'none',stroke:t.ac,strokeWidth:cw,strokeLinecap:'round',pathLength:1,strokeDasharray:'1 1',style:as({strokeDashoffset:0,opacity:last?1:0},an(m,last?[[a,{strokeDashoffset:1,opacity:1}],[b,{strokeDashoffset:0,opacity:1}]]:[[a,{strokeDashoffset:1,opacity:1}],[b,{strokeDashoffset:0,opacity:1}],[b+.15,{strokeDashoffset:0,opacity:0}]]))}));
  out.push(D(as({position:'absolute',left:0,top:0,width:0,height:0,zIndex:6,offsetPath:`path('${g.d}')`,offsetRotate:'0deg',offsetAnchor:'0 0',offsetDistance:'100%',opacity:last?1:0},
   an(m,[[a,{opacity:0,offsetDistance:'0%'}],[a+.01,{opacity:1,offsetDistance:'0%'},'ease-in-out'],[b,{opacity:1,offsetDistance:'100%'}],[b+.01,{opacity:last?1:0,offsetDistance:'100%'}]])),token(t,{x:0,y:0},s.n)));});
 const arr=[[f.start.k,f.start.n,f.t0]].concat(f.seq.map((s,i)=>[s.k,s.n,slot(i)[1]]));
 const wrap=(bx,el,st)=>D(as({position:'absolute',left:bx.x,top:bx.y,width:0,height:0,zIndex:5},st),el);
 arr.forEach(([k,n,ta],i)=>{const bx=box[k];if(!bx)return;const tn=i<arr.length-1?arr[i+1][2]:null;
  out.push(wrap(bx,stepBadge(t,'cur',n),as({opacity:tn==null?1:0},an(m,tn==null?[[ta,{opacity:0}],[ta+.05,{opacity:1}]]:[[ta,{opacity:0}],[ta+.05,{opacity:1}],[tn,{opacity:1}],[tn+.05,{opacity:0}]]))));
  if(tn!=null)out.push(wrap(bx,stepBadge(t,'done',n),as({opacity:1},an(m,[[tn,{opacity:0}],[tn+.05,{opacity:1}]]))));});
 (f.preN||[]).forEach(([k,n])=>{const bx=box[k];if(bx)out.push(wrap(bx,stepBadge(t,'done',n),{}));});
 return {svg:X('svg',{width:ww,height:wh,style:{position:'absolute',left:0,top:0,overflow:'visible',pointerEvents:'none'}},svg),els:out};}
// viewport onto a world (crop + scale on the dotted canvas)
function vp(t,o,world){const s=o.s||1;return D({position:'relative',width:o.w,height:o.h,flex:'none',overflow:'hidden',borderRadius:o.bleed?'20px 0 0 20px':(o.r!=null?o.r:20),background:t.cv,backgroundImage:`radial-gradient(${t.dot} ${1.6*s}px, transparent ${1.9*s}px)`,backgroundSize:`${26*s}px ${26*s}px`,backgroundPosition:`${o.ox||0}px ${o.oy||0}px`,boxShadow:o.border===false?'none':`inset 0 0 0 1.5px ${t.bd2}`,boxSizing:'border-box',isolation:'isolate',fontFamily:G,color:t.tx},
 D(as({position:'absolute',left:o.ox||0,top:o.oy||0,width:o.ww||W0,height:o.wh||H0,transform:s!==1?`scale(${s})`:undefined,transformOrigin:'0 0'},o.wst||{}),world),o.over);}
const plab=(t,txt,sub,pos)=>D(as({position:'absolute',left:12,bottom:12,height:30,padding:'0 12px',borderRadius:99,background:t.s,border:`1.5px solid ${t.bd2}`,boxShadow:`0 2px 0 0 ${t.bd2}`,boxSizing:'border-box',display:'flex',gap:8,alignItems:'center',fontSize:12.5,fontWeight:600,zIndex:8,whiteSpace:'nowrap',color:t.tx},pos||{}),txt,sub&&S({fontFamily:M,fontSize:11,fontWeight:500,color:t.mu},sub));
const crumb=(t,parts,pos)=>D(as({position:'absolute',left:12,top:12,height:32,padding:'0 12px',borderRadius:99,background:t.s,border:`1.5px solid ${t.bd2}`,boxShadow:`0 2px 0 0 ${t.bd2}`,boxSizing:'border-box',display:'flex',gap:6,alignItems:'center',fontSize:12.5,zIndex:8,whiteSpace:'nowrap',color:t.tx2},pos||{}),parts.map((p,i)=>[i>0&&Ic('chevron-right',13,t.mu,2),S({fontWeight:i===parts.length-1?600:400,color:i===parts.length-1?t.tx:t.tx2},p)]));

// ---------- step player (B), timeline-driven
function playerB(t,o){const m=o.m,TT=o.tt||[],N=8;
 const segs=D({display:'flex',gap:4},Array.from({length:N},(_,i)=>{const fin=i<o.cur?t.tx2:i===o.cur?t.ac:t.s3;const a=TT[i],b=TT[i+1];
  const pts=a==null?null:b==null?[[Math.max(0,a-.01),{backgroundColor:t.s3}],[a,{backgroundColor:t.ac}]]:[[Math.max(0,a-.01),{backgroundColor:t.s3}],[a,{backgroundColor:t.ac}],[b,{backgroundColor:t.ac}],[b+.01,{backgroundColor:t.tx2}]];
  return D(as({flex:1,height:8,borderRadius:4,backgroundColor:fin},pts?an(m,pts):{}));}));
 const info=D({position:'relative',flex:1,minWidth:0,height:o.compact?54:38},(o.idx||[o.cur]).map(i=>{const a=TT[i],b=TT[i+1];return D(as({position:'absolute',left:0,top:0,right:0,display:'flex',flexDirection:'column',gap:3,opacity:i===o.cur?1:0},a==null?{}:an(m,b==null?[[a,{opacity:0}],[a+.05,{opacity:1}]]:[[a,{opacity:0}],[a+.05,{opacity:1}],[b,{opacity:1}],[b+.05,{opacity:0}]])),
  D({display:'flex',alignItems:'baseline',gap:8},S({fontSize:14,fontWeight:700},'Step '+(i+1)+' of 8'),S({fontSize:11.5,color:t.mu},'Checkout')),
  S({fontSize:12,lineHeight:1.4,color:t.tx2,textWrap:'pretty'},STEPS[i][0]+' · '+STEPS[i][1]));}));
 const ctr=D({display:'flex',alignItems:'center',gap:4,flex:'none'},!o.compact&&btnI(t,'skip-back',{}),D({width:40,height:40,borderRadius:99,background:t.ac,display:'flex',alignItems:'center',justifyContent:'center',boxShadow:`0 3px 0 0 ${t.aci}`},Ic('pause',18,t.onac,2.25)),!o.compact&&btnI(t,'skip-forward',{}));
 return pnl(t,{position:'absolute',left:o.x,top:o.y,width:o.w,padding:'12px 14px',display:'flex',flexDirection:'column',gap:10,zIndex:8},D({display:'flex',alignItems:'center',gap:12},ctr,info,S({fontFamily:M,fontSize:11,padding:'2px 7px',borderRadius:99,background:t.s2,color:t.tx2,flex:'none'},'1×')),segs);}

// ---------- code pane (canvas-first panel + DB board code lines)
function codePane(t,o){return DL.cpnl(t,{width:o.w,height:o.h,padding:0,display:'flex',flexDirection:'column',overflow:'hidden',borderRadius:16,flex:'none'},
 D({display:'flex',alignItems:'center',gap:8,height:48,padding:'0 10px',borderBottom:'1px solid var(--bd)',flex:'none'},DL.seg(t,o.tabs,o.on,{h:30}),S({flex:1}),o.chip),
 D({flex:1,padding:'8px 0',overflow:'hidden',background:'var(--code)'},o.lines.map((l,i)=>D(o.la?o.la(i):{},DL.codeL(t,i+1,l,{hl:o.hl&&o.hl.includes(i)})))),
 o.foot!==false&&D({display:'flex',alignItems:'center',gap:8,height:44,padding:'0 12px',borderTop:'1px solid var(--bd)',flex:'none',fontSize:12,color:t.tx2,whiteSpace:'nowrap'},Ic('refresh-cw',13,t.tx2,2),o.foot,S({flex:1}),!o.narrow&&S({fontFamily:M,fontSize:11,color:t.mu},'checkout.sododeck.json')));}

// ---------- buttons
function Btn(p){L.use(R);const t=p.t;const [st,set]=R.useState({h:0,f:0,a:0});const s=p.force||(st.a?'pressed':st.f?'focus':st.h?'hover':'default');const pri=p.kind!=='sec',sm=p.size==='sm';
 const lip=s==='hover'?4:s==='pressed'?0:3,lipC=pri?t.aci:(s==='hover'?t.tx2:t.bd2);
 const style={height:sm?36:46,padding:`0 ${sm?14:20}px`,display:'inline-flex',alignItems:'center',justifyContent:'center',gap:8,borderRadius:sm?10:12,border:pri?'none':`1.5px solid ${s==='hover'||s==='pressed'?t.tx2:t.bd2}`,background:pri?t.ac:(s==='hover'||s==='pressed'?t.s2:t.s),color:pri?t.onac:t.tx,fontFamily:G,fontSize:sm?13.5:15.5,fontWeight:500,cursor:'pointer',boxSizing:'border-box',
  boxShadow:[`0 ${lip}px 0 0 ${lipC}`,s==='focus'?`0 0 0 2px ${p.bg||t.cv}, 0 0 0 4.5px ${t.tx}`:null].filter(Boolean).join(','),transform:s==='hover'?'translateY(-1px)':s==='pressed'?'translateY(3px)':'none',transition:'transform .12s, box-shadow .12s, background-color .12s',outline:'none',whiteSpace:'nowrap',textDecoration:'none',flex:'none'};
 const up=k=>v=>set(x=>as({},x,{[k]:v}));
 return h('a',{href:p.href||'#',style,onMouseEnter:()=>up('h')(1),onMouseLeave:()=>set(x=>as({},x,{h:0,a:0})),onMouseDown:()=>up('a')(1),onMouseUp:()=>up('a')(0),onFocus:e=>up('f')(e.target.matches(':focus-visible')?1:0),onBlur:()=>up('f')(0),onClick:e=>e.preventDefault()},p.icon&&Ic(p.icon,sm?15:17,null,2),p.label);}
const btn=(t,o)=>h(Btn,as({t},o));
const link=(t,txt,st)=>h('a',{href:'#',onClick:e=>e.preventDefault(),style:as({color:t.tx2,textDecoration:'none',fontSize:14,borderRadius:6,outlineOffset:3},st||{}),onMouseEnter:e=>{e.currentTarget.style.color=t.tx;},onMouseLeave:e=>{e.currentTarget.style.color=(st&&st.color)||t.tx2;}},txt);
const logo=t=>D({display:'flex',alignItems:'center',gap:9,flex:'none'},D({width:28,height:28,borderRadius:9,background:t.inv,color:t.invt,display:'flex',alignItems:'center',justifyContent:'center'},Ic('layers',16,null,2)),S({fontSize:16,fontWeight:600,letterSpacing:'-.01em',color:t.tx},'Sododeck'));
const tile=(t,ic,sz)=>D({width:sz||36,height:sz||36,borderRadius:10,background:t.s,border:`1.5px solid ${t.bd2}`,boxShadow:`0 2px 0 0 ${t.bd2}`,boxSizing:'border-box',display:'flex',alignItems:'center',justifyContent:'center',color:t.tx,flex:'none'},Ic(ic,17,null,1.75));

// ---------- page context and type scale
const TY={d:{hero:[56,1.05,-.035],h2:[38,1.12,-.025],body:[17,1.55],lead:[19,1.5],py:112},t:{hero:[52,1.06,-.03],h2:[32,1.15,-.02],body:[17,1.55],lead:[18,1.5],py:88},m:{hero:[40,1.08,-.025],h2:[28,1.18,-.015],body:[16,1.55],lead:[17,1.5],py:64}};
function mkP(th,W,p){p=p||{};const bp=W>=1200?'d':W>=700?'t':'m';const pad=bp==='d'?120:bp==='t'?32:24;let reduce=p.motion==='off';if(p.motion!=='on'&&!reduce&&window.matchMedia)reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 return {th,t:TK(th),W,bp,pad,cw:W-2*pad,mo:!reduce,copy:p.heroCopy||'A',ty:TY[bp]};}
const eyebrow=(t,txt,c)=>S({fontFamily:M,fontSize:12.5,fontWeight:500,letterSpacing:'.05em',textTransform:'uppercase',color:c||t.tx2},txt);
function txtBlock(P,o){const t=P.t,ty=P.ty;return D({display:'flex',flexDirection:'column',gap:16,maxWidth:o.full?760:undefined},eyebrow(t,o.e),
 X('h2',{style:{margin:0,fontSize:ty.h2[0],lineHeight:ty.h2[1],letterSpacing:ty.h2[2]+'em',fontWeight:500,textWrap:'balance',color:t.tx}},o.h),
 X('p',{style:{margin:0,fontSize:ty.body[0],lineHeight:ty.body[1],color:t.tx2,textWrap:'pretty',maxWidth:600}},o.b),o.extra);}
function section(P,o){const t=P.t,bp=P.bp;let inner;
 if(bp==='d'&&!o.full){const txt=D({width:440,flex:'none'},txtBlock(P,o));const vis=D({width:696,flex:'none'},o.vis(696));inner=D({display:'flex',gap:64,alignItems:'center'},o.side==='l'?[vis,txt]:[txt,vis]);}
 else inner=D({display:'flex',flexDirection:'column',gap:bp==='m'?32:48},txtBlock(P,o),o.vis(P.cw),o.after);
 return X('section',{id:o.id,'data-screen-label':o.label,style:as({padding:`${P.ty.py}px ${P.pad}px`,boxSizing:'border-box'},o.st||{})},[inner,bp==='d'&&!o.full?o.after:null]);}
function Play(p){L.use(R);const ref=R.useRef(null);const [seen,setSeen]=R.useState(false);const [k,setK]=R.useState(0);
 R.useEffect(()=>{if(!p.on)return;const el=ref.current;if(!el||!window.IntersectionObserver){setSeen(true);return;}const io=new IntersectionObserver(es=>{if(es.some(e=>e.isIntersecting)){setSeen(true);io.disconnect();}},{threshold:.35});io.observe(el);return ()=>io.disconnect();},[p.on]);
 const m=p.on&&seen?{on:true,dur:p.dur,loop:false}:null;const t=p.t;
 return h('div',{ref,style:{position:'relative'}},h('div',{key:k},p.render(m)),p.on&&h('button',{onClick:()=>{setSeen(true);setK(x=>x+1);},'aria-label':'Replay animation',style:{position:'absolute',right:14,top:p.bottom?'auto':14,bottom:p.bottom?14:'auto',zIndex:20,height:32,padding:'0 12px',display:'flex',alignItems:'center',gap:6,borderRadius:99,border:`1.5px solid ${t.bd2}`,background:t.s,color:t.tx,boxShadow:`0 2px 0 0 ${t.bd2}`,fontFamily:G,fontSize:12.5,fontWeight:500,cursor:'pointer'}},Ic('rotate-ccw',14,null,2),'Replay'));}

// ---------- 1 nav
function nav(P){const t=P.t,m=P.bp==='m';
 const tg=h('button',{onClick:()=>P.setTh&&P.setTh(P.th==='light'?'dark':'light'),'aria-label':'Switch theme',style:{width:36,height:36,borderRadius:10,border:`1.5px solid ${t.bd2}`,background:t.s,color:t.tx2,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',padding:0,flex:'none'}},Ic(P.th==='light'?'moon':'sun',16,null,2));
 return X('header',{'data-screen-label':'Nav',style:{position:'sticky',top:0,zIndex:50,height:64,display:'flex',alignItems:'center',gap:m?10:32,padding:`0 ${P.pad}px`,background:t.cv,borderBottom:`1px solid ${t.hl}`,boxSizing:'border-box'}},[
  logo(t),!m&&D({display:'flex',gap:28,alignItems:'center'},CP.nav.map(x=>link(t,x))),S({flex:1}),!m&&tg,btn(t,{kind:'sec',size:'sm',label:CP.open}),
  m&&h('button',{'aria-label':'Menu',style:{width:36,height:36,borderRadius:10,border:`1.5px solid ${t.bd2}`,background:t.s,color:t.tx,display:'flex',alignItems:'center',justifyContent:'center',padding:0,cursor:'pointer'}},Ic('menu',17,null,2))]);}

// ---------- 2 hero
const HC={d:{w:800,h:540,s:.7,ox:20,oy:150,tp:[32,56,420],cp:[330,138,440,330],pill:[24,24]},t:{w:736,h:520,s:.64,ox:20,oy:150,tp:[28,48,400],cp:[300,138,410,320],pill:[20,20]},m:{w:366,h:470,s:.69,ox:8,oy:104,tp:[14,20,334],cp:[14,136,334,330],pill:[14,14]}};
function heroVis(P,m){const t=P.t,c=HC[P.bp],M2=m&&m.on?m:null;
 const peek=D(as({position:'absolute',left:300,top:374,width:184,zIndex:4},an(M2,[[6.1,{opacity:0,transform:'translateY(-6px)'}],[6.4,{opacity:1,transform:'none'}]])),
  D({width:2,height:22,background:t.bd2,marginLeft:91}),
  pnl(t,{padding:'8px 8px',display:'flex',flexDirection:'column',gap:2},ml(t,'Inside · 3 tables',{padding:'2px 6px 4px'}),['orders','order_items','payments'].map(n=>D({display:'flex',alignItems:'center',gap:7,height:24,padding:'0 6px',borderRadius:8,fontSize:12,fontWeight:500},Ic('table',13,t.tx2,2),S({fontFamily:M,fontSize:11.5,flex:1},n),S({fontFamily:M,fontSize:10.5,color:t.mu},String(TBL[n].cols.length))))));
 const nm=P.bp==='m';const dk=deckEls(t,{m:M2,flow:{start:{k:'web',n:1},seq:nm?SEQ.slice(0,3):SEQ,t0:6.6,step:nm?.6:.36},extra:peek,nodes:nm?NODES.slice(0,4):NODES,edges:nm?EDGES.slice(0,3):EDGES,frames:nm?FRAMES.slice(0,2):FRAMES,
  nA:(n,i)=>an(M2,[[5.1+i*.09,{opacity:0,transform:'translateY(-18px) rotate(-3deg)'}],[5.5+i*.09,{opacity:1,transform:'none'}]]),
  fA:i=>an(M2,[[4.9+i*.07,{opacity:0}],[5.3+i*.07,{opacity:1}]]),eA:(e,i)=>an(M2,[[5.9+i*.05,{opacity:0}],[6.2+i*.05,{opacity:1}]])});
 const endFade=an(M2,[[0,{opacity:1}],[9.5,{opacity:1}],[10,{opacity:0}]]);
 const [tx,ty,tw]=c.tp;const fs=12;
 const typed=(txt,a,b)=>S(as({display:'inline-block',verticalAlign:'top',overflow:'hidden',whiteSpace:'pre',width:txt.length+'ch'},an(M2,[[a,{width:'0ch'},`steps(${txt.length},end)`],[b,{width:txt.length+'ch'}]])),txt);
 const tl=(st,...k)=>D(as({display:'flex',alignItems:'center',gap:6,minHeight:20},st),...k);
 const term=pnl(t,as({position:'absolute',left:tx,top:ty,width:tw,padding:0,overflow:'hidden',zIndex:10,opacity:0},an(M2,[[0,{opacity:1,transform:'none'}],[4.7,{opacity:1,transform:'none'}],[5.1,{opacity:0,transform:'scale(.96)'}]])),
  D({display:'flex',alignItems:'center',gap:8,height:40,padding:'0 14px',borderBottom:`1px solid ${t.hl}`},Ic('square-terminal',15,t.tx2,2),S({fontSize:13,fontWeight:600},'Your agent'),S({flex:1}),S({fontFamily:M,fontSize:11,color:t.mu},'sododeck skill')),
  D({padding:'12px 14px 14px',fontFamily:M,fontSize:fs,lineHeight:'20px',color:t.tx,display:'flex',flexDirection:'column',gap:0},
   CP.prompt.map((ln,i)=>tl({},S({color:t.mu,width:'2ch',flex:'none'},i?'':'›'),typed(ln,.2+i*.78,.95+i*.78))),
   tl(as({marginTop:8,color:t.tx2},an(M2,[[2.6,{opacity:0}],[2.8,{opacity:1}]])),Ic('loader',13,t.mu,2),'Writing checkout.sododeck.json'),
   tl(as({color:t.tx2},an(M2,[[4.15,{opacity:0}],[4.35,{opacity:1}]])),Ic('circle-check',13,PAL.green[P.th].dot,2.25),'validate · 0 problems'),
   tl(as({color:t.tx2},an(M2,[[4.45,{opacity:0}],[4.6,{opacity:1}]])),Ic('external-link',13,t.mu,2),'Opening in Sododeck')));
 const [cx,cy,cw2,ch]=c.cp;const gp=PAL.green[P.th];
 const code=D(as({position:'absolute',left:cx,top:cy,zIndex:11,opacity:0},an(M2,[[2.7,{opacity:0,transform:'translateY(10px)'}],[3.0,{opacity:1,transform:'none'}],[4.7,{opacity:1,transform:'none'}],[5.1,{opacity:0,transform:'scale(.96)'}]])),
  codePane(t,{w:cw2,h:ch,tabs:['JSON'],on:0,lines:GENJ,foot:false,la:i=>an(M2,[[2.9+i*.09,{opacity:0}],[3.0+i*.09,{opacity:1}]]),
   chip:S(as({display:'inline-flex',alignItems:'center',gap:5,height:24,padding:'0 9px',borderRadius:99,background:gp.chip,color:gp.ink,fontSize:12,fontWeight:600},an(M2,[[4.1,{opacity:0,transform:'scale(.8)'}],[4.3,{opacity:1,transform:'none'}]])),Ic('circle-check',13,null,2.25),'valid')}));
 const pill=D(as({position:'absolute',left:c.pill[0],top:c.pill[1],zIndex:9,display:'flex',gap:8,flexWrap:'wrap',maxWidth:c.w-40},an(M2,[[0,{opacity:0}],[5.0,{opacity:0}],[5.3,{opacity:1}],[9.5,{opacity:1}],[10,{opacity:0}]])),
  D({height:32,padding:'0 12px',borderRadius:99,background:t.s,border:`1.5px solid ${t.bd2}`,boxShadow:`0 2px 0 0 ${t.bd2}`,boxSizing:'border-box',display:'flex',alignItems:'center',gap:7,fontSize:12.5,whiteSpace:'nowrap'},Ic('circle-check',14,gp.dot,2.25),S({fontFamily:M,fontSize:11.5},'checkout.sododeck.json'),P.bp!=='m'&&S({color:t.tx2},'· valid · laid out')),
  D({height:32,padding:'0 12px',borderRadius:99,background:t.acs,border:`1.5px solid ${t.ac}`,boxSizing:'border-box',display:'flex',alignItems:'center',gap:7,fontSize:12.5,fontWeight:600,color:t.aci,whiteSpace:'nowrap'},Ic('play',13,null,2.5),'Flow · Checkout'));
 return vp(t,{w:c.w,h:c.h,s:c.s,ox:c.ox,oy:c.oy,bleed:true,wst:endFade,over:[term,code,pill]},dk.els);}
function hero(P){const t=P.t,ty=P.ty,bp=P.bp;const m=P.mo?{on:true,dur:10,loop:true}:null;
 const text=D({display:'flex',flexDirection:'column',gap:24,width:bp==='d'?480:undefined,maxWidth:620,flex:'none',boxSizing:'border-box',padding:bp==='d'?0:`0 ${P.pad}px 0 0`},
  X('h1',{style:{margin:0,fontSize:ty.hero[0],lineHeight:ty.hero[1],letterSpacing:ty.hero[2]+'em',fontWeight:500,textWrap:'balance',color:t.tx}},CP.hero[P.copy]||CP.hero.A),
  X('p',{style:{margin:0,fontSize:ty.lead[0],lineHeight:ty.lead[1],color:t.tx2,textWrap:'pretty'}},CP.sub),
  D({display:'flex',gap:12,flexWrap:'wrap',marginTop:4},btn(t,{label:CP.cta1}),btn(t,{kind:'sec',label:CP.cta2,icon:'square-terminal'})),
  D({display:'flex',alignItems:'center',gap:8,fontSize:14,color:t.tx2},Ic('shield-check',15,t.tx2,2),CP.small));
 const gen=D({display:'flex',gap:bp==='m'?8:22,flexWrap:'wrap',flexDirection:bp==='m'?'column':'row',marginTop:16,paddingRight:P.pad},CP.gen.map(g=>D({display:'flex',alignItems:'center',gap:7,fontSize:13.5,color:t.tx2},Ic('check',14,t.tx2,2.25),g)));
 const vis=D({display:'flex',flexDirection:'column',flex:'none'},heroVis(P,m),gen);
 return X('section',{id:'hero','data-screen-label':'Hero',style:{display:'flex',flexDirection:bp==='d'?'row':'column',alignItems:bp==='d'?'center':'stretch',gap:bp==='d'?40:bp==='t'?48:36,padding:`${bp==='d'?80:bp==='t'?64:40}px 0 ${bp==='d'?96:72}px ${P.pad}px`,boxSizing:'border-box'}},[text,vis]);}

// ---------- 3 proof strip
function proof(P){const t=P.t;const cols=P.bp==='d'?4:2;
 return X('section',{'data-screen-label':'Proof',style:{padding:`0 ${P.pad}px`}},[D({display:'grid',gridTemplateColumns:`repeat(${cols},minmax(0,1fr))`,gap:P.bp==='m'?16:24,padding:`${P.bp==='m'?24:32}px 0`,borderTop:`1px solid ${t.hl}`,borderBottom:`1px solid ${t.hl}`},
  CP.proof.map(([ic,l])=>D({display:'flex',alignItems:'center',gap:12,fontSize:P.bp==='m'?14.5:15.5,fontWeight:500,color:t.tx},tile(t,ic),l)))]);}

// ---------- 4 explore
function exploreVis(P,w){const t=P.t,one=P.bp!=='d',g=24;const nm=P.bp==='m';const pw=one?w:(w-2*g)/3,ph=nm?300:270;
 const p1=vp(t,{w:pw,h:ph,s:.3,ox:(pw-W0*.3)/2,oy:(ph-H0*.3)/2-14,over:plab(t,'System','30%')},deckEls(t,{zoom:'land',labels:false}).els);
 const s2=Math.min(.72,(pw-28)/508);
 const p2=vp(t,{w:pw,h:ph,s:s2,ox:(pw-508*s2)/2,oy:8-22*s2,over:plab(t,'Containers','70%')},deckEls(t,{zoom:'ctr',nodes:NODES.slice(0,4),edges:EDGES.slice(0,3),frames:FRAMES.slice(0,2)}).els);
 const svcF=as({},NB.svc.c,{fields:[{k:'Tech',v:'Go'},{k:'Owner',v:'Orders team',ft:'person'}],tags:['critical','pci']});
 const p3=vp(t,{w:pw,h:ph,s:.8,ox:(pw-232*.8)/2-276*.8,oy:10-22*.8,over:plab(t,'Components','100%')},deckEls(t,{nodes:[{k:'svc',x:300,y:72,c:svcF}],frames:[{x:276,y:36,w:232,h:248,title:'Orders',n:1}],edges:[]}).els);
 const pw2=one?w:(w-g)/2,ph2=P.bp==='m'?280:320;
 const con={gw:1,odb:1,pay:1,svc:1},ns={},es={};NODES.forEach(n=>{ns[n.k]=n.k==='svc'?{sel:true}:con[n.k]?{}:{dim:true};});EDGES.forEach(e=>{es[e.id]=(e.a==='svc'||e.b==='svc')?'hl':'dim';});
 const sF=nm?.62:.52;const fnm=nm?{nodes:MNODES,edges:MEDGES,frames:MFRAMES,w:430,h:460}:{};
 const p4=vp(t,{w:pw2,h:nm?340:ph2,s:sF,ox:nm?(pw2-430*sF)/2:(pw2-W0*sF)/2,oy:nm?6:24,ww:nm?430:W0,wh:nm?460:H0,over:[plab(t,'Connection focus','Order Service'),D({position:'absolute',right:12,top:12,height:30,padding:'0 12px',borderRadius:99,background:t.acs,border:`1.5px solid ${t.ac}`,boxSizing:'border-box',display:'flex',alignItems:'center',gap:6,fontSize:12.5,fontWeight:600,color:t.aci,zIndex:8},Ic('focus',14,null,2.25),'Focus')]},deckEls(t,as({ns,es},fnm)).els);
 const dn=[{k:'osvc',kind:'proxy',x:16,y:110,w:124,c:{type:'service',title:'Order Service'}},{k:'pay',x:236,y:80,c:NB.pay.c},{k:'psp',x:236,y:250,c:NB.psp.c},{k:'kfk',kind:'proxy',x:560,y:250,w:150,c:{type:'queue',title:'order.placed'}}];
 const de=[{id:'a',a:'osvc',as:'r',b:'pay',bs:'l',label:'authorize'},{id:'b',a:'pay',as:'b',b:'psp',bs:'t',label:'charge'},{id:'c',a:'psp',as:'r',b:'kfk',bs:'l',label:'payment.succeeded'}];
 const dnm=[{k:'osvc',kind:'proxy',x:100,y:0,w:150,c:{type:'service',title:'Order Service'}},as({},dn[1],{x:24,y:132}),as({},dn[2],{x:24,y:296}),{k:'kfk',kind:'proxy',x:41,y:470,w:150,c:{type:'queue',title:'order.placed'}}];
 const denm=[{id:'a',a:'osvc',as:'b',b:'pay',bs:'t',bat:151,label:'authorize',lp:.5},de[1],{id:'c',a:'psp',as:'b',b:'kfk',bs:'t',label:'payment.succeeded',lp:.55}];
 const p5=nm?vp(t,{w:pw2,h:470,s:.76,ox:(pw2-232*.76)/2,oy:56,ww:420,wh:540,over:crumb(t,['Checkout','Payments'])},deckEls(t,{nodes:dnm,edges:denm,frames:[{x:0,y:96,w:232,h:326,title:'Payments',n:2}],w:420,h:540}).els)
  :vp(t,{w:pw2,h:ph2,s:.78,ox:Math.max(6,(pw2-710*.78)/2),oy:22,ww:720,over:crumb(t,['Checkout','Payments'],{top:'auto',bottom:12})},deckEls(t,{nodes:dn,edges:de,frames:[{x:212,y:44,w:232,h:332,title:'Payments',n:2}],w:720,h:400}).els);
 const caps=D({display:'grid',gridTemplateColumns:one?'minmax(0,1fr)':'repeat(3,minmax(0,1fr))',gap:one?20:32,marginTop:8},CP.explore.caps.map(([ic,a,b])=>D({display:'flex',gap:14,alignItems:'flex-start'},tile(t,ic),D({display:'flex',flexDirection:'column',gap:4},S({fontSize:15.5,fontWeight:500},a),S({fontSize:14.5,lineHeight:1.5,color:t.tx2,textWrap:'pretty'},b)))));
 return D({display:'flex',flexDirection:'column',gap:g},D({display:'flex',flexDirection:one?'column':'row',gap:g},p1,p2,p3),D({display:'flex',flexDirection:one?'column':'row',gap:g},p4,p5),caps);}
const explore=P=>section(P,as({id:'explore',label:'Explore',full:true,vis:w=>exploreVis(P,w)},CP.explore));

// ---------- 5 flows
const FC={d:{w:696,h:520,s:.7,ox:4-84*.7,oy:4,px:48,py:396,pw:520},t:{w:704,h:520,s:.7,ox:8-84*.7,oy:4,px:52,py:396,pw:520},m:{w:342,h:540,s:.78,ox:7,oy:6,px:12,py:378,pw:318}};
const MNODES=[{k:'gwp',kind:'proxy',x:79,y:0,w:150,c:{type:'gateway',title:'API Gateway'}},as({},NB.svc,{x:24,y:132}),as({},NB.odb,{x:24,y:296}),{k:'payp',kind:'proxy',x:300,y:166,w:120,c:{type:'service',title:'Payment Service'}}];
const MEDGES=[{id:2,a:'gwp',as:'b',b:'svc',bs:'t',bat:130,label:'POST /orders',lp:.25},EDGES[2],{id:4,a:'svc',as:'r',b:'payp',bs:'l',label:'authorize',lp:.5}];
const MFRAMES=[{x:0,y:96,w:232,h:358,title:'Orders',n:2}];
const FNODES=[{k:'gwp',kind:'proxy',x:92,y:79,w:120,c:{type:'gateway',title:'API Gateway'}}].concat(NODES.filter(n=>n.k!=='web'&&n.k!=='gw'));
const FEDGES=[{id:2,a:'gwp',as:'r',b:'svc',bs:'l',label:'POST /orders',lp:.5}].concat(EDGES.filter(e=>e.id!==1&&e.id!==2));
const FFRAMES=FRAMES.slice(1);
function flowsVis(P,w,m){const t=P.t,c=FC[P.bp];const nm=P.bp==='m';const f={start:{k:'svc',n:3},seq:nm?SEQ.slice(2,4):SEQ.slice(2),t0:.6,step:.9,pre:[2]};
 const dk=nm?deckEls(t,{m,flow:f,nodes:MNODES,edges:MEDGES,frames:MFRAMES,w:430,h:460}):deckEls(t,{m,flow:f,nodes:FNODES,edges:FEDGES,frames:FFRAMES});const tt=nm?[null,null,0,1.5,2.4]:[null,null,0,1.5,2.4,3.3,4.2,5.1];
 return vp(t,{w:c.w,h:c.h,s:c.s,ox:c.ox,oy:c.oy,ww:nm?430:W0,wh:nm?460:H0,over:playerB(t,{x:c.px,y:c.py,w:c.pw,m,tt,cur:nm?4:7,idx:nm?[2,3,4]:[2,3,4,5,6,7],compact:nm})},dk.els);}
const flows=P=>section(P,as({id:'flows',label:'Flows',side:'r',vis:w=>h(Play,{t:P.t,on:P.mo,dur:5.4,bottom:P.bp!=='m',render:m=>flowsVis(P,w,m)})},CP.flows));

// ---------- 6 knowledge
function dtable(t){const am={background:'var(--ams)',color:'var(--amt)'},or={background:t.acs,color:t.aci};const cols='62px minmax(0,1.1fr) minmax(0,1fr)';
 const band=(txt,st,span)=>D(as({gridColumn:span,height:22,display:'flex',alignItems:'center',padding:'0 8px',fontSize:10.5,fontWeight:600,letterSpacing:'.07em'},st),txt);
 const cell=(txt,st)=>D(as({minHeight:30,display:'flex',alignItems:'center',padding:'0 8px',fontSize:11.5,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',borderTop:`1px solid ${t.hl}`},st||{}),txt);
 const rows=[['< 3','timeout','Retry in 2 s'],['< 3','declined_soft','Retry in 30 s'],['3','any','Cancel order'],['any','declined_hard','Cancel order']];
 return D({display:'grid',gridTemplateColumns:cols,border:`1.5px solid ${t.bd2}`,borderRadius:12,overflow:'hidden',background:t.s},band('WHEN',am,'1 / 3'),band('THEN',or,'3 / 4'),
  ['attempt','error','action'].map(x=>D({height:24,display:'flex',alignItems:'center',padding:'0 8px',fontFamily:M,fontSize:10.5,color:t.mu},x)),
  rows.map((r,i)=>{const on=i===0;const st=on?{background:t.acs,color:t.aci,fontWeight:500}:{};return [cell(r[0],as({fontFamily:M},st)),cell(r[1],as({fontFamily:M},st)),cell(r[2],st)];}));}
function inspector(t,st){const sec=(title,kids,last)=>D({padding:'12px 16px',borderBottom:last?'none':`1px solid ${t.hl}`,display:'flex',flexDirection:'column',gap:8},ml(t,title),kids);
 return pnl(t,as({display:'flex',flexDirection:'column',overflow:'hidden'},st),
  D({padding:'14px 16px',borderBottom:`1px solid ${t.hl}`,display:'flex',flexDirection:'column',gap:6},ml(t,'Flow step 6 of 8'),D({fontSize:15,fontWeight:500,lineHeight:1.35},'Payment Service → Payment Provider'),D({display:'flex',gap:6},S({fontFamily:M,fontSize:11,padding:'2px 8px',borderRadius:99,background:t.s2,color:t.tx2},'charge'),S({fontFamily:M,fontSize:11,padding:'2px 8px',borderRadius:99,background:t.s2,color:t.tx2},'HTTPS'))),
  sec('Condition',D({fontFamily:M,fontSize:12,padding:'8px 10px',borderRadius:10,background:'var(--code)',border:`1px solid ${t.hl}`},S({color:'var(--amt)',fontWeight:500},'when'),' order.total_cents > 0')),
  sec('Rule',[D({display:'flex',alignItems:'center',gap:8,height:34,padding:'0 10px',borderRadius:10,background:'var(--ams)',color:'var(--amt)',fontSize:12.5,fontWeight:600},Ic('table',14,null,2),'R-12 Payment retry',S({flex:1}),Ic('arrow-right',14,null,2)),dtable(t)]),
  sec('Note',D({fontSize:12.5,lineHeight:1.5,color:t.tx2,textWrap:'pretty'},'Retries reuse the order id, so the provider sees one charge.'),true));}
function knowVis(P,w){const t=P.t,one=P.bp!=='d';const ns={pay:{ph:'done',n:5},psp:{ph:'cur',n:6}};
 const nodes=[{k:'pay',x:28,y:44,c:NB.pay.c},{k:'psp',x:28,y:320,c:NB.psp.c},{k:'note',kind:'shape',x:200,y:40,c:{shape:'sticky',title:'Ask finance about partial refunds',w:130,h:124,color:'yellow'}}];
 const dk=deckEls(t,{nodes,frames:[],edges:[{id:5,a:'pay',as:'b',b:'psp',bs:'t',label:'charge'}],es:{5:'cur'},ns,w:380,h:440,
  extra:[D({position:'absolute',left:146,top:226,width:16,height:2,background:'var(--amt)',zIndex:2}),D({position:'absolute',left:160,top:213,height:28,padding:'0 10px',borderRadius:99,background:'var(--ams)',color:'var(--amt)',display:'flex',alignItems:'center',gap:6,fontSize:12,fontWeight:600,whiteSpace:'nowrap',zIndex:2,boxShadow:'0 2px 0 0 var(--amt)'},Ic('table',13,null,2),'R-12 Payment retry')]});
 if(one)return D({display:'flex',flexDirection:'column',gap:16},vp(t,{w,h:460,ox:Math.max(0,(w-380)/2)},dk.els),inspector(t,{width:w}));
 return vp(t,{w,h:560,oy:20,over:inspector(t,{position:'absolute',right:14,top:14,bottom:14,width:304,zIndex:8})},dk.els);}
const knowledge=P=>section(P,as({id:'knowledge',label:'Knowledge',side:'l',vis:w=>knowVis(P,w)},CP.know));

// ---------- 7 database
function dbWorld(t,m){
 const rels=[{a:'items',ac:'order_id',b:'orders',bc:'id',ae:'zmany',be:'one'},{a:'pay',ac:'order_id',b:'orders',bc:'id',ae:'zmany',be:'one'},{a:'orders',ac:'customer_id',b:'cust',bc:'id',ae:'zmany',be:'one'}];
 const base=DL.dboard(t,{w:820,h:600,frames:[{x:236,y:56,w:568,h:489,title:'Orders DB',n:3,color:'blue'}],tables:[{k:'orders',x:260,y:100,tb:TBL.orders,s:{oneSchema:true}},{k:'items',x:540,y:100,tb:TBL.order_items,s:{oneSchema:true}},{k:'pay',x:540,y:320,tb:TBL.payments,s:{oneSchema:true}}],
  enums:[{k:'en',x:260,y:360,e:DL.ENUM.order_status}],proxies:[{k:'cust',x:24,y:440,w:180,name:'customers',sub:'Accounts DB · outside'}],nodes:[{k:'odb',x:24,y:84,c:NB.odb.c,s:{sel:true}}],rels});
 const lit=(x,y,tb,n,rw,t0)=>D(as({position:'absolute',left:0,top:0,zIndex:3},an(m,[[t0,{opacity:0}],[t0+.3,{opacity:1}]])),DL.tableCard(t,tb,{x,y,ph:'cur',n,rw,oneSchema:true}));
 return [base,
  lit(260,100,TBL.orders,4,{status:'w',total_cents:'w'},.6),lit(540,320,TBL.payments,5,{amount_cents:'w',status:'w'},1.8),
  X('svg',{width:820,height:600,style:{position:'absolute',left:0,top:0,overflow:'visible',pointerEvents:'none',zIndex:2}},[h('path',{key:'a',d:'M210 150H228',stroke:t.tx2,strokeWidth:2,strokeDasharray:'3 4',strokeLinecap:'round'}),h('path',{key:'b',d:'M226 145L232 150L226 155',stroke:t.tx2,strokeWidth:2,fill:'none',strokeLinecap:'round',strokeLinejoin:'round'})]),
  D({position:'absolute',left:24,top:232,display:'flex',alignItems:'center',gap:6,fontSize:11.5,color:t.tx2},'Open with',kbd(t,'⏎')),
  crumb(t,['Checkout','Orders','Orders DB'],{left:16,top:12}),
  D(as({position:'absolute',left:470,top:556,width:334,display:'flex',justifyContent:'flex-end',zIndex:6},an(m,[[.4,{opacity:0}],[.7,{opacity:1}]])),pnl(t,{display:'flex',alignItems:'center',gap:8,height:34,padding:'0 12px',borderRadius:99,whiteSpace:'nowrap'},Ic('play',12,t.aci,2.5),S({fontSize:12.5,fontWeight:600},'Checkout'),S({fontFamily:M,fontSize:11,color:t.tx2},'4 writes orders · 5 writes payments')))];}
function dbWorldM(t,m){
 const rels=[{a:'pay',ac:'order_id',b:'orders',bc:'id',ae:'zmany',be:'one',side:['r','r']},{a:'orders',ac:'customer_id',b:'cust',bc:'id',ae:'zmany',be:'one',side:['l','l']}];
 const base=DL.dboard(t,{w:420,h:710,frames:[{x:50,y:124,w:290,h:531,title:'Orders DB',n:3,color:'blue'}],tables:[{k:'orders',x:74,y:164,tb:TBL.orders,s:{oneSchema:true}},{k:'pay',x:74,y:430,tb:TBL.payments,s:{oneSchema:true}}],proxies:[{k:'cust',x:66,y:56,w:170,name:'customers',sub:'Accounts DB · outside'}],rels});
 const lit=(x,y,tb,n,rw,t0)=>D(as({position:'absolute',left:0,top:0,zIndex:3},an(m,[[t0,{opacity:0}],[t0+.3,{opacity:1}]])),DL.tableCard(t,tb,{x,y,ph:'cur',n,rw,oneSchema:true}));
 return [base,lit(74,164,TBL.orders,4,{status:'w',total_cents:'w'},.6),lit(74,430,TBL.payments,5,{amount_cents:'w',status:'w'},1.8),crumb(t,['Checkout','Orders','Orders DB'],{left:12,top:10}),
  D(as({position:'absolute',left:12,top:668,zIndex:6},an(m,[[.4,{opacity:0}],[.7,{opacity:1}]])),pnl(t,{display:'flex',alignItems:'center',gap:8,height:34,padding:'0 12px',borderRadius:99,whiteSpace:'nowrap'},Ic('play',12,t.aci,2.5),S({fontSize:12.5,fontWeight:600},'Checkout'),S({fontFamily:M,fontSize:11,color:t.tx2},'4 writes orders · 5 writes payments')))];}
function dbSec(P){const t=P.t,bp=P.bp;const bg=t.s2;
 const pane=w=>codePane(t,{w,h:bp==='d'?600:590,tabs:['JSON','DBML','SQL'],on:1,lines:DBML,hl:[3],foot:'Edits apply as you type',narrow:bp==='m',chip:S({flex:'none',display:'inline-flex',alignItems:'center',gap:5,height:26,padding:'0 10px',borderRadius:99,background:t.s2,color:t.tx2,fontSize:12,fontWeight:500,whiteSpace:'nowrap'},Ic('database',13,null,2),'Postgres')});
 const cv=w=>{const c=bp==='d'?{w:820,h:600,s:1,ox:0,oy:0}:bp==='t'?{w,h:520,s:.84,ox:8,oy:6}:{w,h:560,s:.78,ox:(w-420*.78)/2,oy:2};const nm=bp==='m';return h(Play,{t,on:P.mo,dur:2.4,render:m=>vp(t,{w:c.w,h:c.h,s:c.s,ox:c.ox,oy:c.oy,ww:nm?420:820,wh:nm?710:600},nm?dbWorldM(t,m):dbWorld(t,m))});};
 const vis=w=>bp==='d'?D({display:'flex',gap:20},cv(820),pane(360)):D({display:'flex',flexDirection:'column',gap:16},cv(w),pane(w));
 const pts=D({display:'grid',gridTemplateColumns:bp==='d'?'repeat(3,minmax(0,1fr))':'minmax(0,1fr)',gap:bp==='d'?32:16,marginTop:bp==='d'?48:0},CP.db.pts.map(([ic,x])=>D({display:'flex',gap:14,alignItems:'center',fontSize:15.5,fontWeight:500,color:t.tx},tile(t,ic),x)));
 return D({background:bg,color:t.tx},section(P,as({id:'database',label:'Database',full:true,vis,after:pts},CP.db)));}

// ---------- 8 canvas + code
function codeVis(P,w){const t=P.t,one=P.bp==='m';const ns={svc:{sel:true}};
 const cvs=ww=>vp(t,{w:ww,h:one?420:590,ox:(ww-232)/2-276,oy:one?6:(590-394)/2-8},deckEls(t,{ns,nodes:[NB.svc,NB.odb],edges:[EDGES[2]],frames:[FRAMES[1]]}).els);
 const pane=ww=>codePane(t,{w:ww,h:590,tabs:['JSON','DBML'],on:0,lines:JSONL,hl:[7,8,9,10,11,12,13],foot:'In sync with the canvas',narrow:ww<360,chip:S({flex:'none',display:'inline-flex',alignItems:'center',gap:5,height:26,padding:'0 10px',borderRadius:99,background:t.s2,color:t.tx2,fontSize:12,fontWeight:500,whiteSpace:'nowrap'},Ic('mouse-pointer-2',13,null,2),'Selection')});
 if(one)return D({display:'flex',flexDirection:'column',gap:16},cvs(w),pane(w));
 const cw=Math.round((w-16)*.47);return D({display:'flex',gap:16},cvs(cw),pane(w-16-cw));}
const codeSec=P=>section(P,as({id:'code',label:'Canvas and code',side:'r',vis:w=>codeVis(P,w)},CP.code));

// ---------- 9 edit by hand
const HUES13=['red','orange','amber','yellow','lime','green','teal','cyan','blue','indigo','violet','pink','slate'];
function editWorld(t,nm){const ac=t.ac;
 const A={type:'service',title:'Shipping Service',desc:'Books the carrier',tags:['eu','ops'],color:'teal',id:'shipping-svc'},B={type:'queue',typeName:'Kafka topic',title:'order.placed',id:'order-placed'},C={type:'external',title:'Payment Provider',desc:'Card acquirer, 3DS',id:'payment-provider'};
 const tb=pnl(t,{position:'absolute',left:nm?16:40,top:nm?16:28,height:42,padding:'0 6px',borderRadius:12,display:'flex',alignItems:'center',gap:2,zIndex:9},btnI(t,'type',{}),btnI(t,'palette',{fill:true}),btnI(t,'tag',{}),btnI(t,'align-start-vertical',{}),D({width:1,height:20,background:t.hl,margin:'0 3px'}),btnI(t,'ellipsis',{}));
 const sw=n=>{const p=PAL[n][t.th];return S({width:22,height:22,borderRadius:99,background:p.fill,border:`1.5px solid ${p.stroke}`,boxSizing:'border-box',outline:n==='teal'?`2px solid ${ac}`:'none',outlineOffset:2,flex:'none'});};
 const pop=pnl(t,{position:'absolute',left:nm?226:236,top:nm?72:84,width:nm?220:248,padding:'12px 14px',display:'flex',flexDirection:'column',gap:10,zIndex:9},ml(t,'Card colour'),
  D({display:'grid',gridTemplateColumns:'repeat(7,22px)',gap:nm?6:10},S({width:22,height:22,borderRadius:99,border:`1.5px dashed ${t.bd2}`,boxSizing:'border-box'}),HUES13.map(sw)),
  D({height:1,background:t.hl,margin:'2px 0'}),ml(t,'Tag colours'),D({display:'flex',flexWrap:'wrap',gap:6},chip(t,'eu','blue'),chip(t,'ops','slate'),chip(t,'critical','red'),chip(t,'pci','violet'),S({height:21,padding:'0 8px',borderRadius:99,border:`1.5px dashed ${t.bd2}`,fontSize:11.5,color:t.tx2,display:'inline-flex',alignItems:'center',gap:3},Ic('plus',11,null,2.25),'Tag')));
 const P1=nm?{x:200,y:330}:{x:224,y:330},Pt=nm?[P1,{x:318,y:330},{x:318,y:420}]:[P1,{x:352,y:330},{x:352,y:410},{x:440,y:410}];const d=pathOrth(Pt,10);const ax=nm?40-24:40;
 const knob=(x,y,on)=>D({position:'absolute',left:x-(on?8:6),top:y-(on?8:6),width:on?16:12,height:on?16:12,borderRadius:99,boxSizing:'border-box',background:on?ac:t.s,border:`2px solid ${ac}`,boxShadow:on?`0 0 0 4px ${t.acs}`:'none',zIndex:7});
 return [D({position:'absolute',left:ax,top:nm?72:88,width:184,zIndex:3},card(t,A,{sel:true,edit:true})),D({position:'absolute',left:ax,top:300,width:184,zIndex:2},card(t,B,{})),D({position:'absolute',left:nm?226:440,top:nm?420:380,width:184,zIndex:2},card(t,C,{})),
  X('svg',{width:696,height:540,style:{position:'absolute',left:0,top:0,overflow:'visible',pointerEvents:'none',zIndex:1}},[h('line',{key:'g',x1:ax,y1:nm?62:76,x2:ax,y2:420,stroke:ac,strokeWidth:1.5,strokeDasharray:'4 4'}),h('path',{key:'h',d,fill:'none',stroke:ac,strokeOpacity:.18,strokeWidth:9,strokeLinecap:'round'}),h('path',{key:'p',d,fill:'none',stroke:ac,strokeWidth:2.5}),h('g',{key:'s'},startMark(t,P1,ac)),h('g',{key:'ar'},nm?arrow(t,{x:318,y:420},'t',ac):arrow(t,{x:440,y:410},'l',ac))]),
  nm?[knob(318,330),knob(259,330,true)]:[knob(352,330),knob(352,410),knob(352,370,true)],D({position:'absolute',left:nm?226:366,top:nm?288:356,height:24,padding:'0 9px',borderRadius:8,background:t.inv,color:t.invt,fontFamily:M,fontSize:11,display:'flex',alignItems:'center',whiteSpace:'nowrap',zIndex:8},'drag to re-route'),
  D({position:'absolute',left:ax+12,top:nm?250:252,height:22,padding:'0 8px',borderRadius:99,background:t.inv,color:t.invt,fontFamily:M,fontSize:10.5,display:'flex',alignItems:'center',whiteSpace:'nowrap',zIndex:8},'aligned left · snap'),tb,pop];}
function editVis(P,w){const t=P.t,nm=P.bp==='m';return nm?vp(t,{w,h:410,s:.74,ox:(w-460*.74)/2,oy:4,ww:460,wh:540},editWorld(t,true)):vp(t,{w,h:520,ox:Math.max(0,(w-660)/2),oy:6,ww:696,wh:520},editWorld(t,false));}
const editSec=P=>section(P,as({id:'edit',label:'Edit by hand',side:'l',vis:w=>editVis(P,w)},CP.edit));

// ---------- 10 local-first and formats
function deckCard(t,w,title,meta,o){o=o||{};const s=(w-24)/W0;return D({width:w,boxSizing:'border-box',background:t.s,border:`1.5px solid ${t.bd2}`,borderRadius:16,boxShadow:`0 3px 0 0 ${t.bd2}`,overflow:'hidden',display:'flex',flexDirection:'column',flex:'none'},
 vp(t,{w:w-3,h:140,s,ox:12,oy:(140-H0*s)/2,r:0,border:false},deckEls(t,{labels:false,zoom:'ctr'}).els),
 D({padding:'12px 14px',borderTop:`1px solid ${t.hl}`,display:'flex',flexDirection:'column',gap:4},S({fontSize:14,fontWeight:600},title),S({fontSize:12,color:t.mu},meta)));}
function localVis(P,w){const t=P.t,one=P.bp==='m';const g=16;const cw=one?w:(w-2*g)/3;
 const nd=D({width:cw,minHeight:one?84:209,boxSizing:'border-box',border:`1.5px dashed ${t.bd2}`,borderRadius:16,display:'flex',flexDirection:one?'row':'column',alignItems:'center',justifyContent:'center',gap:10,padding:16,flex:'none'},tile(t,'plus'),D({display:'flex',flexDirection:'column',gap:2,alignItems:one?'flex-start':'center'},S({fontSize:14,fontWeight:600},'New deck'),S({fontSize:12,color:t.mu},'or import JSON, SQL or DBML')));
 const lib=D({display:'flex',flexDirection:one?'column':'row',gap:g},deckCard(t,cw,'Checkout','8 cards · 1 flow · edited today'),!one&&deckCard(t,cw,'Checkout · before refactor','8 cards · 1 flow · edited 12 Sep'),nd);
 const banner=D({display:'flex',alignItems:'center',gap:10,padding:'12px 14px',borderRadius:14,background:'var(--ams)',color:'var(--amt)',fontSize:13.5,flexWrap:'wrap'},Ic('archive',16,null,2),S({flex:1,minWidth:200},'Decks live only in this browser. Export a backup now and then.'),S({fontWeight:600,display:'inline-flex',alignItems:'center',gap:5},Ic('download',14,null,2.25),'Export backup'));
 const F=[['JSON','braces'],['PNG','image'],['SVG','pen-tool'],['SQL','database'],['DBML','file-code']];
 const fm=D({display:'flex',flexDirection:'column',gap:10},ml(t,'Export'),D({display:'flex',gap:8,flexWrap:'wrap'},F.map(([n,ic])=>S({height:34,padding:'0 13px 0 11px',borderRadius:99,background:t.s,border:`1.5px solid ${t.bd2}`,boxShadow:`0 2px 0 0 ${t.bd2}`,boxSizing:'border-box',display:'inline-flex',alignItems:'center',gap:7,fontFamily:M,fontSize:12.5,fontWeight:500,color:t.tx},Ic(ic,14,t.tx2,2),n))));
 return D({display:'flex',flexDirection:'column',gap:20},lib,banner,fm);}
const localSec=P=>section(P,as({id:'local',label:'Local-first',side:'r',vis:w=>localVis(P,w)},CP.local));

// ---------- 11 final CTA, 12 footer
function finalCta(P){const t=P.t,ty=P.ty;return X('section',{id:'start','data-screen-label':'Final CTA',style:{padding:`${ty.py}px ${P.pad}px`,borderTop:`1px solid ${t.hl}`}},[D({display:'flex',flexDirection:'column',alignItems:P.bp==='m'?'flex-start':'center',textAlign:P.bp==='m'?'left':'center',gap:18},
 X('h2',{style:{margin:0,fontSize:ty.h2[0]*1.1,lineHeight:ty.h2[1],letterSpacing:ty.h2[2]+'em',fontWeight:500,textWrap:'balance',maxWidth:720}},CP.fin.h),
 X('p',{style:{margin:0,fontSize:ty.lead[0],lineHeight:ty.lead[1],color:t.tx2,maxWidth:560,textWrap:'pretty'}},CP.fin.b),
 D({display:'flex',gap:12,flexWrap:'wrap',justifyContent:P.bp==='m'?'flex-start':'center',marginTop:8},btn(t,{label:CP.cta1}),btn(t,{kind:'sec',label:CP.cta2,icon:'square-terminal'})))]);}
function footer(P){const t=P.t,m=P.bp==='m';return X('footer',{'data-screen-label':'Footer',style:{padding:`32px ${P.pad}px 40px`,borderTop:`1px solid ${t.hl}`,display:'flex',flexDirection:m?'column':'row',alignItems:m?'flex-start':'center',gap:m?20:32}},[
 logo(t),D({display:'flex',gap:m?16:24,flexWrap:'wrap'},CP.foot.map(x=>link(t,x,{fontSize:13.5}))),S({flex:1}),S({fontSize:13,color:t.mu},CP.copy)]);}

// ---------- page
function Page(p){L.use(R);const [th,setTh]=R.useState(p.theme||'light');R.useEffect(()=>{setTh(p.theme||'light');},[p.theme]);
 const P=mkP(th,+p.width||1440,p);P.setTh=setTh;const t=P.t;
 const parts=p.only==='hero-db'?[nav(P),hero(P),dbSec(P)]:[nav(P),hero(P),proof(P),explore(P),flows(P),knowledge(P),dbSec(P),codeSec(P),editSec(P),localSec(P),finalCta(P),footer(P)];
 return D(as({},DL.TH[th],{width:P.W,background:t.cv,color:t.tx,fontFamily:G,position:'relative',overflow:'clip',flex:'none',textAlign:'left',WebkitFontSmoothing:'antialiased'}),parts);}

// ---------- board helpers: storyboard, CTA states
function story(th){L.use(R);const P=mkP(th,1440,{motion:'on'});const wrap=el=>D(as({},DL.TH[th],{display:'flex',background:t0(th).cv,borderRadius:20}),el);
 const beats=[['Beat 1 · 1.6 s','The agent types the prompt (your AI, your machine).',1.6],['Beat 2 · 4.4 s','checkout.sododeck.json streams in and validates.',4.4],['Beat 3 · 8.0 s','Groups, cards and connectors deal in; Orders DB shows its tables; the Checkout flow plays.',8.0]];
 return beats.map(([a,b,at])=>({label:a,sub:b,el:wrap(heroVis(P,{on:true,dur:10,loop:true,at}))})).concat([{label:'Reduced motion · final frame',sub:'prefers-reduced-motion: no keyframes; flow complete, token on the last step. Flows and Database show this frame too.',el:wrap(heroVis(P,null))}]);}
const t0=th=>TK(th);
function cta(th){L.use(R);const t=TK(th);const st=['default','hover','focus','pressed'];
 const row=(lab,o)=>D({display:'grid',gridTemplateColumns:'150px repeat(4,auto)',gap:28,alignItems:'center'},S({fontFamily:M,fontSize:12,color:t.tx2},lab),st.map(s=>btn(t,as({force:s},o))));
 return D(as({},DL.TH[th],{background:t.cv,color:t.tx,fontFamily:G,padding:32,borderRadius:20,display:'flex',flexDirection:'column',gap:24,width:'max-content'}),
  D({display:'grid',gridTemplateColumns:'150px repeat(4,auto)',gap:28},S({}),st.map(s=>S({fontFamily:M,fontSize:12,color:t.mu},s))),
  row('Primary',{label:CP.cta1}),row('Secondary',{kind:'sec',label:CP.cta2,icon:'square-terminal'}),row('Nav · small',{kind:'sec',size:'sm',label:CP.open}));}

// ---------- copy and notes for the board
const COPY=[
 {s:'Hero',items:[['Headline A · chosen',CP.hero.A],['Headline B',CP.hero.B],['Headline C',CP.hero.C],['Subline',CP.sub],['Primary CTA',CP.cta1],['Secondary CTA',CP.cta2],['Under the CTAs',CP.small],['Under the visual',CP.gen.join(' · ')],['Agent prompt',CP.prompt.join(' ')]]},
 {s:'Proof strip',items:CP.proof.map(([,l],i)=>['Promise '+(i+1),l])},
 {s:'Explore',items:[['Eyebrow',CP.explore.e],['Headline',CP.explore.h],['Body',CP.explore.b]].concat(CP.explore.caps.map(c=>[c[1],c[2]]))},
 {s:'Flows',items:[['Eyebrow',CP.flows.e],['Headline',CP.flows.h],['Body',CP.flows.b]]},
 {s:'Knowledge',items:[['Eyebrow',CP.know.e],['Headline',CP.know.h],['Body',CP.know.b],['Sticky','Ask finance about partial refunds']]},
 {s:'Database',items:[['Eyebrow',CP.db.e],['Headline',CP.db.h],['Body',CP.db.b]].concat(CP.db.pts.map((p,i)=>['Point '+(i+1),p[1]]))},
 {s:'Canvas + code',items:[['Eyebrow',CP.code.e],['Headline',CP.code.h],['Body',CP.code.b]]},
 {s:'Edit by hand',items:[['Eyebrow',CP.edit.e],['Headline',CP.edit.h],['Body',CP.edit.b]]},
 {s:'Local-first',items:[['Eyebrow',CP.local.e],['Headline',CP.local.h],['Body',CP.local.b],['Banner','Decks live only in this browser. Export a backup now and then.'],['Formats','JSON · PNG · SVG · SQL · DBML']]},
 {s:'Final CTA and footer',items:[['Headline',CP.fin.h],['Body',CP.fin.b],['Buttons',CP.cta1+' · '+CP.cta2],['Footer',CP.foot.join(' · ')+' · '+CP.copy]]}];
const NOTES=[
 {title:'NEW TOKENS (proposed, add to DESIGN.md)',items:[['marketing-hero','Geist 500 · 56 / 1.05 · −0.035em at 1440; 52 / 1.06 at 768; 40 / 1.08 at 390'],['marketing-h2','Geist 500 · 38 / 1.12 · −0.025em; 32 / 1.15 at 768; 28 / 1.18 at 390. Final CTA uses 1.1×'],['marketing-lead','Geist 400 · 19 / 1.5 (18 at 768, 17 at 390), text-secondary'],['marketing-body','Geist 400 · 17 / 1.55 (16 at 390), text-secondary'],['marketing-eyebrow','Geist Mono 500 · 12.5 · 0.05em · uppercase, text-secondary'],['marketing-button','46 tall · 12 radius · 15.5 / 500 · 0 3px 0 lip (primary-ink on primary, border-strong on secondary). Small: 36 · 10 radius · 13.5'],['marketing-layout','content 1200 at 1440 (gutters 120), 704 at 768 (32), 342 at 390 (24); section padding 112 / 88 / 64; text column 440 + 64 gap + 696 visual']]},
 {title:'REUSED, NOT FORKED',items:[['sododeck-cards.js','TK(\'B\'), PAL, card (all zoom levels), frame, proxy, shape (pill, sticky), anc, geom, edgeStyle, labelEl, startMark, arrow, stepBadge, token, nodeBox, pnl, btnI, chip, ml, kbd, pathOrth'],['sododeck-db.js','tableCard, dboard (crow’s foot attached to column rows), tproxy, enumCard, ENUM, mk, codeL, cpnl, seg, chipN. Added a read-only export SDDB.lib; no behaviour change'],['Theme vars','--code, --ams/--amt (amber), --bd from the canvas-first theme for code panes, rules and the backup banner'],['Motion','CSS keyframes generated into one stylesheet; flow token rides CSS offset-path on the real edge path; edges draw with pathLength 1 dash offset']]},
 {title:'DEVIATIONS AND OPEN QUESTIONS',items:[['customers table','Decided: customers is a dashed proxy in Accounts DB; Orders DB has 3 tables (orders, order_items, payments)'],['Primary hover','primary-hover (#d9560f) with dark on-primary text is about 4.1:1, under AA. Hover keeps primary and lifts the lip (4px, −1px); pressed drops the lip (0, +3px); focus is a 2px gap plus 2.5px ink ring'],['Logo','Inverse tile with the lucide “layers” glyph is a placeholder until there is a mark'],['Typing','Per-line ch-width steps, so the prompt is pre-broken into three lines that fit 334px at 390']]},
 {title:'CHANGES IN THIS ROUND',items:[['File format','Hero and Code JSON use format v1: $schema, version, name, groups, nodes (id, type, title, group, description), edges (id, from, to, label), flows. Readable ids (order-svc, orders-db, e-writes-orders); no dialect on the database node'],['Database band','surface-2 in both themes (#f4f4f1 / #212120); visuals use the page theme. dbBand tweak removed'],['No cut text','Dialect chip dropped from the Orders DB card header (dialect shows in the code pane); player step text wraps instead of truncating; code chips no longer shrink'],['Clean crops','390 has its own worlds: hero shows Edge + Orders (steps 1–4); Flows shows Orders with API Gateway and Payment Service as outside proxies (steps 3–5); Database stacks orders and payments with the customers proxy above; Explore focus and drill-in use the Orders / Payments groups with outside proxies; Edit stacks the re-routed connector under the cards. Flows: API Gateway is a dashed outside proxy and the whole path sits inside the frame. Code: canvas shows only the Orders group. Explore: Containers shows Edge + Orders, Components shows one card clear of its label'],['Final frames','motion = off renders Flows and Database at their final frame at every width (W badges, the flow bar, flow complete)'],['Copy','Headline A marked as chosen']]},
 {title:'BEHAVIOUR',items:[['Hero','10 s loop: prompt 0–2.5 s, JSON 2.7–4.3 s with “valid”, canvas 4.9–6.6 s, flow 6.6–9.1 s, hold, fade'],['Flows, Database','Play once when 35 % in view (IntersectionObserver), Replay button top-right'],['Reduced motion','No keyframes at all; every visual renders its final frame. Tweak motion = off previews it'],['390','Hero stacks; visuals use narrow worlds at 0.69–0.8 scale so no card, connector or label meets the frame edge; nav is logo + Open app + menu'],['Runtime','No third-party scripts beyond Geist and lucide, which the site bundles; no images, video or canvas']]}];

window.SDL={Page,story,cta,COPY,NOTES,CP};
return true;}
if(!init()){const iv=setInterval(()=>{if(init())clearInterval(iv);},60);}
})();
