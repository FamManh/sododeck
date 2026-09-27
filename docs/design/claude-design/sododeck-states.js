(function(){
function init(){
const S=window.SODO; if(!S) return false;
const W=S.W,H=S.H,mono="'Geist Mono',ui-monospace,monospace";
const TH={light:Object.assign({},S.THEMES.light,{'--onac':'#1c1c1a','--gns':'#e3efe1','--gnt':'#2f6a38'}),dark:Object.assign({},S.THEMES.dark,{'--onac':'#171716','--gns':'#16281a','--gnt':'#8fd09a'})};
const LI={smartphone:'smartphone',local_shipping:'truck',dashboard:'layout-dashboard',router:'router',key:'key-round',receipt_long:'receipt',photo_camera:'camera',my_location:'locate-fixed',notifications:'bell',sell:'tag',credit_card:'credit-card',hub:'network',route:'route',swap_horiz:'arrow-left-right',database:'database',timeline:'activity',bolt:'zap',map:'map',sms:'message-square',payments:'wallet'};
const KT=Object.assign({},S.KT,{cloud:['var(--s2)','var(--tx)'],partner:['var(--rds)','var(--rdt)'],comp:['var(--acs)','var(--act)'],group:['var(--s2)','var(--tx2)']});
const FOCUS={outline:'2px solid var(--ac)',outlineOffset:2};
const BY={};S.NODES.forEach(n=>BY[n.id]=n);
const E={};S.EDGES.forEach(e=>E[e.id]=e);
const EX={e29:{id:'e29',from:'payment',to:'bus',label:'payment.authorized',proto:'Kafka'},e30:{id:'e30',from:'payment',to:'notify',label:'payment.failed',proto:'Kafka'},e31:{id:'e31',from:'order',to:'trackdb',label:'archive route',proto:'SQL'}};
Object.assign(E,EX);
const nm=id=>BY[id]?BY[id].title:id;
const ttl=id=>{const e=E[id];return nm(e.from)+' → '+nm(e.to);};
const ic=(s)=>({width:s,height:s,display:'inline-flex',flex:'none'});
const tile=(k,s)=>{const t=KT[k]||KT.client;return {width:s,height:s,flex:'none',borderRadius:Math.round(s*.3),background:t[0],color:t[1],display:'flex',alignItems:'center',justifyContent:'center'};};
// ---------- primitives
const BT={p:{background:'var(--ac)',color:'var(--onac)',border:'1px solid var(--ac)',fontWeight:500},s:{background:'var(--s)',color:'var(--tx)',border:'1px solid var(--bd2)'},g:{background:'transparent',color:'var(--tx2)',border:'1px solid transparent'},d:{background:'var(--s)',color:'var(--rdt)',border:'1px solid var(--rdt)'},a:{background:'var(--amt)',color:'var(--ams)',border:'1px solid var(--amt)',fontWeight:500},on:{background:'var(--acs)',color:'var(--act)',border:'1px solid var(--ac)',fontWeight:500},w:{background:'var(--ams)',color:'var(--amt)',border:'1px solid var(--amt)',fontWeight:500}};
const btn=(t,k,icon,kbd,x)=>({t,icon:icon||'',kbd:kbd||'',st:Object.assign({display:'flex',alignItems:'center',gap:6,height:30,padding:'0 11px',borderRadius:9,fontSize:12.5,whiteSpace:'nowrap',cursor:'pointer'},BT[k||'s'],x||{})});
const segI=(t,on,icon,x)=>({t,icon:icon||'',st:Object.assign({height:26,padding:'0 10px',borderRadius:7,display:'flex',alignItems:'center',justifyContent:'center',gap:5,fontSize:12,flex:1,whiteSpace:'nowrap'},on?{background:'var(--s)',boxShadow:'0 1px 2px var(--sh)',fontWeight:500,color:'var(--tx)'}:{color:'var(--tx2)'},x||{})});
const inSt=(o)=>{o=o||{};return Object.assign({height:36,border:'1px solid '+(o.err?'var(--rdt)':o.focus?'var(--ac)':'var(--bd2)'),borderRadius:10,padding:'0 11px',display:'flex',alignItems:'center',gap:8,fontSize:13,background:o.ro?'var(--s2)':'var(--s)',color:o.ro?'var(--tx2)':'var(--tx)'},o.err?{borderWidth:1.5}:{},o.mono?{fontFamily:mono,fontSize:12}:{},o.focus&&o.ring?FOCUS:{});};
const vSt=(o)=>{o=o||{};return {flex:o.nf?'none':1,minWidth:0,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',color:o.ph||o.mixed?'var(--mu)':'inherit',fontStyle:o.mixed?'italic':'normal'};};
const rowSt=(o)=>{o=o||{};return Object.assign({display:'flex',alignItems:'center',gap:8,height:o.h||30,padding:'0 8px',paddingLeft:8+(o.indent||0),borderRadius:8,fontSize:12.5,color:o.active?'var(--act)':'var(--tx)',background:o.active?'var(--acs)':o.hover?'var(--s2)':'transparent',fontWeight:o.active||o.bold?500:400,flex:'none'},o.focus?FOCUS:{},o.dim?{opacity:.5}:{});};
const P=(t,st)=>({t,st:st||{}});
const HI={fontWeight:600,textDecoration:'underline',textUnderlineOffset:3,textDecorationThickness:1.5};
// left blocks
const L={
 tabs:(on)=>({tabs:1,items:['Outline','Palette'].map((t,i)=>segI(t,i===on,'',{height:28}))}),
 sect:(t,icon,meta)=>({sect:1,t,icon:icon||'',meta:meta||''}),
 back:(t)=>({back:1,t}),
 row:(icon,t,meta,o)=>{o=o||{};return {row:1,icon,ist:Object.assign(ic(16),{color:o.ic||'var(--tx2)'}),parts:o.parts||[P(t)],meta:meta||'',st:rowSt(o),warn:!!o.warn,kbd:o.kbd||'',grip:!!o.grip};},
 field:(lab,v,o)=>{o=o||{};return {field:1,lab:lab||'',v:v||o.ph||'',icon:o.icon||'',focus:!!o.focus,st:inSt(o),vst:vSt({ph:!v}),errT:o.errT||'',help:o.help||''};},
 filter:(v,meta,o)=>{o=o||{};return {filter:1,v:v||'Filter flows',vst:vSt({ph:!v,nf:true}),meta:meta||'',rm:!!v,focus:!!o.focus,st:Object.assign({height:32,borderRadius:9,background:'var(--s2)',display:'flex',alignItems:'center',gap:7,padding:'0 9px',margin:'2px 0 6px',border:'1px solid '+(o.focus?'var(--ac)':'transparent')},o.focus?{background:'var(--s)'}:{})};},
 dashed:(icon,t,kbd,o)=>({dashed:1,icon,t,kbd:kbd||'',st:Object.assign({display:'flex',alignItems:'center',gap:7,minHeight:32,padding:'6px 10px',margin:'4px 0',border:'1px dashed var(--bd2)',borderRadius:9,fontSize:12,color:'var(--tx2)',lineHeight:1.4},(o&&o.hot)?{borderColor:'var(--ac)',color:'var(--act)',background:'var(--acs)'}:{},(o&&o.x)||{})}),
 note:(tone,icon,title,body,acts)=>({note:1,icon,title,body,acts:acts||[],st:noteSt(tone)}),
 empty:(icon,title,body,acts)=>({empty:1,icon,title,body,acts:acts||[]}),
 btns:(items)=>({btns:1,items}),
 kbdl:(items)=>({kbdl:1,items:items.map(([k,t])=>({k,t}))}),
 grow:()=>({grow:1}), rule:()=>({rule:1}),
 text:(t)=>({text:1,t}),
};
function noteSt(tone){const m={amber:['var(--ams)','var(--amt)'],clay:['var(--rds)','var(--rdt)'],orange:['var(--acs)','var(--act)'],green:['var(--gns)','var(--gnt)'],neutral:['var(--s2)','var(--tx)']}[tone||'neutral'];
 return {background:m[0],color:m[1],borderRadius:12,padding:'10px 12px',display:'flex',flexDirection:'column',gap:8,margin:'4px 0'};}
// step rows
function dotSt(state){const d={width:22,height:22,borderRadius:999,flex:'none',display:'flex',alignItems:'center',justifyContent:'center',font:'500 10.5px/1 '+mono,boxSizing:'border-box'};
 return Object.assign(d,{cur:{background:'var(--ac)',color:'var(--onac)'},done:{background:'var(--acs)',color:'var(--act)'},err:{background:'var(--rds)',color:'var(--rdt)',border:'1px dashed var(--rdt)'},errcur:{background:'var(--rdt)',color:'var(--s)'},bad:{background:'var(--rds)',color:'var(--rdt)',border:'1px dashed var(--rdt)'}}[state]||{background:'var(--s2)',color:'var(--tx2)'});}
function stepB(n,eid,state,o){o=o||{};const e=E[eid];
 const st={display:'flex',gap:9,alignItems:'flex-start',padding:'7px 8px',paddingLeft:8+(o.indent||0),borderRadius:9,flex:'none',background:state==='cur'?'var(--acs)':state==='errcur'?'var(--rds)':o.hover?'var(--s2)':'transparent'};
 if(o.focus) Object.assign(st,FOCUS);
 return {step:1,n:String(n),dst:dotSt(state),t:o.t||(nm(e.from)+' → '+nm(e.to)),lab:o.lab||e.label,st,grip:!!o.grip,rm:!!o.rm,err:state==='err'||state==='errcur'||!!o.err};}
function branchB(t,err,meta,indent){return {branch:1,t:'◇ '+t,meta:meta||'',icon:err?'circle-alert':'git-branch',ist:Object.assign(ic(14),{color:err?'var(--rdt)':'var(--tx2)'}),st:{display:'flex',alignItems:'center',gap:6,height:26,padding:'0 8px',paddingLeft:8+(indent||0),color:err?'var(--rdt)':'var(--tx2)',flex:'none'}};}
// inspector blocks
const I={
 head:(kind,icon,t,sub,acts)=>({head:1,tile:tile(kind,40),icon,t,sub,acts:(acts||[]).map(a=>({icon:a}))}),
 input:(lab,v,o)=>{o=o||{};return {input:1,lab,v:v||o.ph||'',icon:o.icon||'',kbd:o.kbd||'',focus:!!o.focus,st:inSt(o),vst:vSt({ph:!v,mixed:o.mixed}),errT:o.errT||'',help:o.help||'',meta:o.meta||''};},
 two:(a,b)=>({two:1,items:[a,b].map(x=>({lab:x[0],v:x[1],icon:x[2]===false?'':'chevron-down',st:inSt({ro:x[3]==='ro'}),vst:vSt({mixed:x[3]==='mixed'})}))}),
 md:(lab,txt,o)=>{o=o||{};return {md:1,lab:lab||'DESCRIPTION · MARKDOWN',right:[segI('Write',false,'',{flex:'none',height:22,fontSize:11.5}),segI('Preview',true,'',{flex:'none',height:22,fontSize:11.5})],lines:mdLines(txt)};},
 chips:(lab,items,ph)=>({chips:1,lab,items:items.map(c=>typeof c==='string'?{t:c}:c).map(c=>({t:c.t,meta:c.meta||'',st:{display:'inline-flex',alignItems:'center',gap:6,height:26,padding:'0 8px 0 10px',borderRadius:999,background:'var(--s2)',fontSize:12,border:c.part?'1px dashed var(--bd2)':'1px solid transparent'}})),ph:ph===undefined?'Add tag':ph}),
 links:(items)=>({links:1,lab:'LINKS',items:items.map(([t,u])=>({t,v:u,icon:'link'}))}),
 cond:(v,lab)=>({cond:1,lab:lab||'CONDITION',v}),
 sla:(v,pct,t)=>{const col=pct<=85?'var(--ac)':pct<=100?'var(--amt)':'var(--rdt)';return {sla:1,lab:'SLA TARGET',v,fillSt:{position:'absolute',left:0,top:0,bottom:0,width:Math.min(pct,100)+'%',borderRadius:8,background:col},tickSt:{position:'absolute',left:'85%',top:-3,bottom:-3,width:2,borderRadius:2,background:'var(--tx)'},icon:pct<=85?'circle-check':pct<=100?'triangle-alert':'circle-alert',t,st:inSt({mono:true})};},
 rows:(lab,items,meta)=>({rows:1,lab:lab||'',meta:meta||'',items}),
 stats:(items)=>({stats:1,items:items.map(([v,t])=>({v:String(v),t}))}),
 seg:(lab,items)=>({seg:1,lab,items}),
 text:(t,lab)=>({text:1,t,lab:lab||''}),
 kv:(lab,items)=>({kv:1,lab,items:items.map(([k,v,m])=>({k,v,st:{fontFamily:m?mono:'inherit',fontSize:m?12:12.5,color:'var(--tx)'}}))}),
 btns:(items,lab)=>({btns:1,items,lab:lab||''}),
 note:(tone,icon,title,body,acts)=>({note:1,icon,title,body,acts:acts||[],st:noteSt(tone)}),
 toggle:(t,sub,on,lab)=>({toggle:1,t,sub,lab:lab||'',trackSt:{width:32,height:18,borderRadius:999,background:on?'var(--ac)':'var(--s3)',position:'relative',flex:'none'},knobSt:{position:'absolute',top:2,left:on?16:2,width:14,height:14,borderRadius:999,background:'#fff',boxShadow:'0 1px 2px rgba(0,0,0,.2)'},meta:on?'On':'Off'}),
};
const R=(icon,t,sub,o)=>{o=o||{};return {icon,t,sub:o.mono?'':(sub||''),msub:o.mono?sub:'',meta:o.meta||'',tail:o.tail||'',ist:Object.assign(ic(16),{color:o.ic||'var(--tx2)'}),st:Object.assign({display:'flex',alignItems:'center',gap:10,padding:'8px 10px',borderRadius:10,background:o.active?'var(--acs)':o.bg||'var(--s2)',color:o.active?'var(--act)':'var(--tx)'},o.focus?FOCUS:{},o.dashed?{background:'transparent',border:'1px dashed var(--bd2)'}:{},o.x||{})};};
function mdLines(txt){return (txt||'').split('\n').filter(Boolean).map(l=>{const li=/^- /.test(l);l=l.replace(/^- /,'');const parts=l.split(/(`[^`]+`|\*\*[^*]+\*\*)/).filter(Boolean).map(p=>p[0]==='`'?P(p.slice(1,-1),{fontFamily:mono,fontSize:12,background:'var(--s2)',borderRadius:5,padding:'1px 5px'}):p.slice(0,2)==='**'?P(p.slice(2,-2),{fontWeight:600}):P(p));return {li,parts};});}
// popover blocks
const PB={
 phd:(icon,t,sub,o)=>{o=o||{};return {phd:1,icon:icon||'',t,sub:sub||'',rm:!!o.close,ist:Object.assign(ic(18),{color:o.ic||'var(--tx2)',marginTop:1})};},
 input:I.input, seg:I.seg, rows:I.rows, text:I.text, btns:I.btns, kv:I.kv, note:I.note, kbdl:L.kbdl,
};
const popSt=(x,y,w,o)=>Object.assign({position:'absolute',left:x,top:y,width:w,background:'var(--s)',border:'1px solid var(--bd)',borderRadius:14,boxShadow:'0 8px 28px var(--sh)',padding:14,display:'flex',flexDirection:'column',gap:12,zIndex:40},o||{});
const pop=(x,y,w,blocks,o)=>({st:popSt(x,y,w,o),blocks});
const tip=(x,y,w,icon,t,sub,tone)=>{const inv=tone!=='clay';return {st:Object.assign(popSt(x,y,w,{padding:'10px 12px',gap:6,borderRadius:12}),inv?{background:'var(--ink)',color:'var(--inkt)',border:'none'}:{background:'var(--s)',border:'1.5px solid var(--rdt)'}),blocks:[{phd:1,icon,t,sub:sub||'',rm:false,ist:Object.assign(ic(16),{color:inv?'var(--inkt)':'var(--rdt)',marginTop:1}),inv}]};};
const kbar=(cx,y,items)=>({st:{position:'absolute',left:cx,top:y,transform:'translateX(-50%)',background:'var(--s)',border:'1px solid var(--bd)',borderRadius:12,boxShadow:'0 8px 28px var(--sh)',padding:'8px 12px',display:'flex',zIndex:40},blocks:[{kbdl:1,inline:true,items:items.map(([k,t])=>({k,t}))}]});
// ---------- canvas
function rp(pts,r){r=r||8;const p=[pts[0]];for(let i=1;i<pts.length;i++){const a=p[p.length-1],b=pts[i];if(Math.hypot(b[0]-a[0],b[1]-a[1])>.5)p.push(b);}
 let d='M'+p[0][0]+' '+p[0][1];for(let i=1;i<p.length-1;i++){const [px,py]=p[i-1],[x,y]=p[i],[nx,ny]=p[i+1];const l1=Math.hypot(x-px,y-py),l2=Math.hypot(nx-x,ny-y),rr=Math.min(r,l1/2,l2/2);d+=' L'+(x-(x-px)/l1*rr)+' '+(y-(y-py)/l1*rr)+' Q'+x+' '+y+' '+(x+(nx-x)/l2*rr)+' '+(y+(ny-y)/l2*rr);}
 const e=p[p.length-1];let best=0,bi=1;for(let i=1;i<p.length;i++){const l=Math.hypot(p[i][0]-p[i-1][0],p[i][1]-p[i-1][1]);if(l>best){best=l;bi=i;}}
 return {d:d+' L'+e[0]+' '+e[1],lx:(p[bi][0]+p[bi-1][0])/2,ly:(p[bi][1]+p[bi-1][1])/2,ex:e[0],ey:e[1]};}
function route2(a,b){const aw=a.w||W,ah=a.h||H,bw=b.w||W,bh=b.h||H,acx=a.x+aw/2,acy=a.y+ah/2,bcx=b.x+bw/2,bcy=b.y+bh/2;let pts;
 if(Math.abs(bcx-acx)<Math.max(aw,bw)){pts=bcy>acy?[[acx,a.y+ah],[acx,(a.y+ah+b.y)/2],[bcx,(a.y+ah+b.y)/2],[bcx,b.y]]:[[acx,a.y],[acx,(a.y+b.y+bh)/2],[bcx,(a.y+b.y+bh)/2],[bcx,b.y+bh]];}
 else if(bcx>acx){const gx=b.x-24;pts=[[a.x+aw,acy],[gx,acy],[gx,bcy],[b.x,bcy]];}
 else{const gx=b.x+bw+22;pts=[[a.x,acy],[gx,acy],[gx,bcy],[b.x+bw,bcy]];}
 return rp(pts);}
const ES={normal:{stroke:'var(--edge)',strokeWidth:1.5},dim:{stroke:'var(--edge)',strokeWidth:1.5,opacity:.16},flow:{stroke:'var(--ac)',strokeWidth:2},cur:{stroke:'var(--ac)',strokeWidth:3},cand:{stroke:'var(--ac)',strokeWidth:1.75,strokeDasharray:'2 4',strokeLinecap:'round'},err:{stroke:'var(--rdt)',strokeWidth:2,strokeDasharray:'7 4'},errcur:{stroke:'var(--rdt)',strokeWidth:3,strokeDasharray:'7 4'},bad:{stroke:'var(--rdt)',strokeWidth:2.5,strokeDasharray:'3 3'},sel:{stroke:'var(--ac)',strokeWidth:2.5},hover:{stroke:'var(--tx2)',strokeWidth:2.25},ghost:{stroke:'var(--ac)',strokeWidth:1.75,strokeDasharray:'5 4'},merged:{stroke:'var(--tx2)',strokeWidth:2.25},faint:{stroke:'var(--edge)',strokeWidth:2.5,opacity:.7},ro:{stroke:'var(--edge)',strokeWidth:1.5}};
const LB={position:'absolute',transform:'translate(-50%,-50%)',zIndex:3,display:'flex',alignItems:'center',gap:4,height:20,padding:'0 7px',borderRadius:999,font:'400 10.5px/1 '+mono,whiteSpace:'nowrap',boxSizing:'border-box'};
const LS={normal:{background:'var(--s)',color:'var(--tx2)',border:'1px solid var(--bd2)'},dim:{background:'var(--s)',color:'var(--tx2)',border:'1px solid var(--bd2)',opacity:.35},flow:{background:'var(--s)',color:'var(--act)',border:'1px solid var(--ac)'},cur:{background:'var(--ac)',color:'var(--onac)',border:'1px solid var(--ac)',fontWeight:500},err:{background:'var(--rds)',color:'var(--rdt)',border:'1px dashed var(--rdt)'},errcur:{background:'var(--rds)',color:'var(--rdt)',border:'1.5px solid var(--rdt)',fontWeight:500},cand:{background:'var(--s)',color:'var(--act)',border:'1px dashed var(--ac)'},bad:{background:'var(--rds)',color:'var(--rdt)',border:'1.5px solid var(--rdt)',fontWeight:500},sel:{background:'var(--ac)',color:'var(--onac)',border:'1px solid var(--ac)',fontWeight:500},hover:{background:'var(--s)',color:'var(--tx)',border:'1px solid var(--tx2)',fontWeight:500},merged:{background:'var(--s)',color:'var(--tx)',border:'1px solid var(--tx2)',fontWeight:500},ghost:{background:'var(--s)',color:'var(--act)',border:'1px dashed var(--ac)'},warn:{background:'var(--ams)',color:'var(--amt)',border:'1px solid var(--amt)'}};
const LBADGE={flow:{background:'var(--ac)',color:'var(--onac)'},cur:{background:'var(--onac)',color:'var(--ac)'},err:{background:'var(--rdt)',color:'var(--s)'},errcur:{background:'var(--rdt)',color:'var(--s)'},cand:{background:'var(--acs)',color:'var(--act)'}};
const LICON={err:'circle-alert',errcur:'circle-alert',bad:'ban',cand:'plus',warn:'triangle-alert'};
function nodeV(n,states,x,lod){x=x||{};const w=n.w||(lod==='tile'?40:W),h=n.h||(lod==='tile'?40:H),has=s=>states.indexOf(s)>=0;
 const nx=lod==='tile'?n.x+(W-40)/2:n.x,ny=lod==='tile'?n.y+(H-40)/2:n.y;
 const st={position:'absolute',left:nx,top:ny,width:w,height:h,display:'flex',alignItems:'center',gap:9,padding:lod==='tile'?'0':'0 10px 0 9px',justifyContent:lod==='tile'?'center':'flex-start',background:'var(--s)',border:'1px solid var(--bd2)',borderRadius:12,boxShadow:'0 1px 2px var(--sh)',zIndex:2,boxSizing:'border-box'};
 if(lod==='full') Object.assign(st,{alignItems:'flex-start',padding:'12px 12px 10px',flexDirection:'row'});
 if(n.port) Object.assign(st,{border:'1px dashed var(--bd2)',background:'var(--cv)',boxShadow:'none',borderRadius:999,padding:'0 10px',gap:6,color:'var(--tx2)'});
 if(n.stack) st.boxShadow='5px 5px 0 -1px var(--s), 5px 5px 0 0 var(--bd2), 10px 10px 0 -1px var(--s), 10px 10px 0 0 var(--bd2)';
 if(has('dim')) st.opacity=.22; if(has('faded')) st.opacity=.45; if(has('hover')) st.boxShadow='0 4px 14px var(--sh)';
 if(has('hl')) st.border='1.5px solid var(--ac)';
 if(has('sel')||has('ring')) {st.border='1px solid var(--ac)';st.boxShadow=(n.stack?st.boxShadow+', ':'')+'0 0 0 3px var(--acs)';}
 if(has('valid')) {st.border='1.5px dashed var(--ac)';st.boxShadow='0 0 0 4px var(--acs)';}
 if(has('invalid')) {st.border='1.5px dashed var(--rdt)';st.boxShadow='0 0 0 4px var(--rds)';}
 if(has('focus')) Object.assign(st,FOCUS);
 const decos=[];const circ=(icon,bg,col,pos)=>decos.push({icon,t:'',ist:ic(12),st:Object.assign({position:'absolute',width:20,height:20,borderRadius:999,background:bg,color:col,border:'1.5px solid var(--s)',display:'flex',alignItems:'center',justifyContent:'center',boxSizing:'border-box',zIndex:3},pos||{right:-8,top:-8})});
 if(has('handles')) [[w/2,0],[w,h/2],[w/2,h],[0,h/2]].forEach(([hx,hy],i)=>{const hot=x.hot===i,s=hot?14:10;decos.push({icon:'',t:'',ist:{},st:{position:'absolute',left:hx-s/2,top:hy-s/2,width:s,height:s,borderRadius:999,background:hot?'var(--ac)':'var(--s)',border:'1.5px solid var(--ac)',boxSizing:'border-box',zIndex:3}});});
 if(has('warn')) circ('triangle-alert','var(--ams)','var(--amt)');
 if(has('valid')) circ('plus','var(--ac)','var(--onac)');
 if(has('invalid')) circ('ban','var(--rdt)','var(--s)');
 (x.decos||[]).forEach(d=>decos.push(Object.assign({icon:'',t:'',ist:ic(12)},d)));
 const iconSz=lod==='full'?20:n.port?13:18;
 return {st,tile:n.port?{display:'none'}:tile(n.kind,lod==='full'?36:30),icon:n.port?'':(n.icon||'box'),ist:ic(iconSz),showTile:!n.port,showText:lod!=='tile',title:n.title,tst:{fontSize:lod==='full'?13.5:n.port?11.5:12.5,fontWeight:500,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'},sub:lod==='title'||n.port?'':(n.sub!=null?n.sub:(n.tech||'')),full:lod==='full',l3:n.l3||'',chips:(n.chips||[]).map(t=>({t})),badge:n.prov||'',bst:{font:'500 9.5px/1 '+mono,letterSpacing:'.04em',padding:'3px 5px',borderRadius:5,border:'1px solid var(--bd2)',color:'var(--tx2)',background:'var(--s2)',flex:'none',alignSelf:lod==='full'?'flex-start':'center'},rules:lod!=='tile'&&!n.port&&!!(n.rules&&n.rules.length),decos,portIcon:n.port?(n.pdir||'arrow-right'):''};}
function sticky(k){const st={position:'absolute',left:k.x,top:k.y,width:180,background:'var(--ams)',border:'1px solid '+(k.sel?'var(--ac)':'var(--bd2)'),borderRadius:10,boxShadow:k.sel?'0 0 0 3px var(--acs), 0 2px 6px var(--sh)':'0 2px 6px var(--sh)',padding:k.open?'8px 10px 9px':'6px 10px',display:'flex',flexDirection:'column',gap:6,zIndex:4,color:'var(--tx)',boxSizing:'border-box',opacity:k.dim?.35:1};
 return {st,t:k.t,chev:k.open?'chevron-down':'chevron-right',open:!!k.open,lines:mdLines(k.md||''),anchor:k.anchor||'',hst:{display:'flex',alignItems:'center',gap:6,color:'var(--amt)',fontSize:11.5,fontWeight:600}};}
function toS(cv,wx,wy){return [264+cv.ox+wx*cv.z,56+(cv.bh||0)+cv.oy+wy*cv.z];}
function deck(o){o=o||{};
 const z=o.z!=null?o.z:.72,ox=o.ox!=null?o.ox:28,oy=o.oy!=null?o.oy:70,lod=o.lod||'tech';
 let nodes=o.nodes||S.NODES.map(n=>Object.assign({},n,{icon:LI[n.icon]||'box'}));
 if(o.patch) nodes=nodes.map(n=>o.patch[n.id]?Object.assign({},n,o.patch[n.id]):n);
 if(o.add) nodes=nodes.concat(o.add);
 if(o.only) nodes=nodes.filter(n=>o.only.indexOf(n.id)>=0);
 if(o.hide) nodes=nodes.filter(n=>o.hide.indexOf(n.id)<0);
 const by={};nodes.forEach(n=>by[n.id]=n);
 let edges=o.edges||S.EDGES.concat((o.addE||[]).map(id=>EX[id]));
 edges=edges.filter(e=>by[e.from]&&by[e.to]&&(o.hideE||[]).indexOf(e.id)<0);
 const em=o.em||{},nm_=o.nm||{},keep=new Set(o.keep||[]);
 const cE=[],cL=[];
 const addEdge=(r,k,m)=>{const s=ES[k]||ES.normal;cE.push({d:r.d,pst:Object.assign({fill:'none'},s),dot:k!=='ghost',ex:r.ex,ey:r.ey,dst:{fill:s.stroke,opacity:s.opacity||1}});
  const showL=m.show||(o.labels&&k!=='dim')||(['normal','dim','faint','ro'].indexOf(k)<0);
  if(showL&&m.t!==''){const lk=m.lk||k;cL.push({st:Object.assign({left:m.lx!=null?m.lx:r.lx,top:m.ly!=null?m.ly:r.ly},LB,LS[lk]||LS.normal),badge:m.b||'',bst:Object.assign({minWidth:15,height:15,borderRadius:999,display:'flex',alignItems:'center',justifyContent:'center',padding:'0 4px',font:'600 9.5px/1 '+mono,marginLeft:-4,boxSizing:'border-box'},LBADGE[lk]||LBADGE.flow),icon:m.icon!=null?m.icon:(LICON[lk]||''),ist:ic(11),t:m.t!=null?m.t:r.label});}};
 edges.forEach(e=>{const m=em[e.id]||{};const k=m.k||o.edgeDef||'normal';const r=Object.assign({},(by[e.from].w||by[e.to].w||m.r2)?route2(by[e.from],by[e.to]):S.route(by[e.from],by[e.to]),{label:e.label});if(m.pts)Object.assign(r,rp(m.pts),{label:e.label});addEdge(r,k,m);});
 (o.custom||[]).forEach(c=>{const r=Object.assign(c.pts?rp(c.pts):route2(c.a,c.b),{label:c.t||''});addEdge(r,c.k||'normal',c);});
 const cN=nodes.map(n=>{let s=nm_[n.id];let x={};if(s&&typeof s==='object'){x=s;s=s.s||'';}s=(s||'').split(' ').filter(Boolean);if(o.nodeDef&&!s.length&&!keep.has(n.id))s=[o.nodeDef];return nodeV(n,s,x,n.lod||lod);});
 const gIds=new Set(nodes.map(n=>n.group));
 const gSrc=o.groups||S.GROUPS.filter(g=>gIds.has(g.id)&&(o.hideG||[]).indexOf(g.id)<0);const groups=gSrc.map(g=>{const m=(o.gm||{})[g.id]||{};const solid=o.solidG;
  return {st:{position:'absolute',left:g.x,top:g.y,width:g.w,height:g.h,border:solid?'1px solid var(--bd2)':'1px dashed var(--bd2)',borderRadius:16,background:solid?'var(--s2)':'var(--grp)',opacity:o.gOp||1,boxSizing:'border-box'},
   lst:Object.assign({position:'absolute',left:12,top:10,display:'flex',alignItems:'center',gap:6,fontSize:solid?26:10.5,letterSpacing:'.08em',color:m.hover?'var(--tx)':'var(--mu)',fontWeight:500,padding:'2px 5px',borderRadius:6,background:m.hover?'var(--s2)':'transparent'},m.focus?FOCUS:{}),icon:m.chev||'',ist:ic(13),label:(g.label||'').toUpperCase(),count:String(g.count!=null?g.count:nodes.filter(n=>n.group===g.id).length)};});
 const cvH=632-(o.bh||0);
 const vp={x:-ox/z,y:-oy/z,w:840/z,h:cvH/z};
 const cv={z,ox,oy,bh:o.bh||0,worldSt:{position:'absolute',left:0,top:0,width:1,height:1,transform:'translate('+ox+'px,'+oy+'px) scale('+z+')',transformOrigin:'0 0'},
  groups,edges:cE,labels:cL,nodes:cN,stickies:(o.stickies||[]).map(sticky),wpaths:o.wpaths||[],wdivs:o.wdivs||[],
  crumbs:(o.crumbs||['Logistics Delivery','System view']).map((t,i,a)=>({t,more:i<a.length-1,st:{color:i===a.length-1?'var(--tx)':'var(--tx2)',fontWeight:i===a.length-1?500:400}})),
  tr:o.tr||[btn('Labels','s','tag','',{height:32,background:'var(--s)'}),btn('Focus','s','scan','',{height:32,background:'var(--s)'})],
  zoomT:o.zoomT||Math.round(z*100)+'%',lvl:o.lvl!=null,lvlT:['Landscape','System','Container','Component'][o.lvl||0],lvlTicks:[0,1,2,3].map(i=>({st:{width:4,height:6+i*3,borderRadius:2,background:i<=(o.lvl||0)?'var(--tx)':'var(--s3)'}})),
  mm:o.mm!==false,mmVB:'-40 -40 1170 740',mmG:gSrc.map(G=>({x:G.x,y:G.y,w:G.w,h:G.h})),
  mmN:nodes.filter(n=>!n.port).map(n=>({x:n.x,y:n.y,w:n.w||W,h:n.h||H,st:{fill:(o.mmHot||[]).indexOf(n.id)>=0?'var(--ac)':'var(--s3)'}})),mmVp:vp,
  player:!!o.player,pl:o.player||{}};
 return cv;}
function player(name,i,n,title,o){o=o||{};return {st:{position:'absolute',left:'50%',bottom:14,transform:'translateX(-50%)',width:420,background:'var(--s)',border:'1px solid var(--bd)',borderRadius:16,boxShadow:'0 8px 28px var(--sh)',padding:'12px 14px',display:'flex',flexDirection:'column',gap:10,zIndex:6,boxSizing:'border-box'},
 title:name+' · Step '+(o.lab||i)+' of '+n,sub:title,icon:o.playing?'pause':'play',speed:'1×',segs:Array.from({length:n},(_,k)=>({st:{flex:1,height:4,borderRadius:4,background:k<i?((o.errFrom&&k+1>=o.errFrom)?'var(--rdt)':'var(--ac)'):'var(--s3)'}})),hasBr:!!o.br,br:(o.br||[]).map(([t,on,icon])=>segI(t,on,icon||'',{height:24,fontSize:11.5}))};}
// flow canvas: steps [[eid,badge,kind]]
function flowCv(steps,o){o=o||{};const em=Object.assign({},o.em||{}),keep=new Set(o.keep||[]);
 steps.forEach(([eid,b,k])=>{em[eid]=Object.assign({k:k||'flow',b:String(b)},em[eid]||{});const e=E[eid];keep.add(e.from);keep.add(e.to);});
 return deck(Object.assign({edgeDef:'dim',nodeDef:'dim'},o,{em,keep:[...keep],mmHot:[...keep],crumbs:o.crumbs||['Logistics Delivery','Flow: '+(o.flow||'Place order')]}));}
// ---------- chrome
const TOP=(o)=>Object.assign({folder:'Logistics',deck:'Logistics Delivery',views:true,chip:false,chipSt:{},chipIcon:'',chipText:'',chipMeta:'',chipActs:[],saveIcon:'check',saveText:'Saved in this browser',saveSt:{display:'flex',alignItems:'center',gap:6,fontSize:12,color:'var(--mu)',whiteSpace:'nowrap',height:28,padding:'0 4px',borderRadius:8},saveIst:ic(15),saveBtn:false,saveBtnT:'',ro:false},o||{});
const chipSt=(tone)=>({display:'flex',alignItems:'center',gap:8,height:34,padding:'0 5px 0 12px',borderRadius:999,background:tone==='clay'?'var(--rds)':'var(--acs)',color:tone==='clay'?'var(--rdt)':'var(--act)',fontSize:12.5,fontWeight:500,whiteSpace:'nowrap',marginLeft:8});
const cbtn=(t,k,icon,kbd)=>btn(t,k,icon,kbd,{height:24,borderRadius:999,padding:'0 10px',fontSize:12});
const recChip=(name,n,o)=>{o=o||{};return {views:false,chip:true,chipSt:chipSt(),chipIcon:o.icon||'circle-dot',chipText:(o.verb||'Recording')+' ‘'+name+'’',chipMeta:o.meta||(n+' step'+(n===1?'':'s')),chipActs:o.acts||[cbtn('Undo','g','undo-2','⌘Z',),cbtn('Done','p','check','',n?{}:{}),cbtn('Cancel','s','','Esc')].map((b,i)=>{if(!n&&b.t==='Done')Object.assign(b.st,{opacity:.45,cursor:'not-allowed'});if(!n&&b.t==='Undo')Object.assign(b.st,{opacity:.45});return b;})};};
const flowChip=(name)=>({views:false,chip:true,chipSt:chipSt(),chipIcon:'workflow',chipText:'Flow mode · '+name,chipMeta:'',chipActs:[cbtn('','s','x','')]});
const FLOWN=[['Place order','8 steps'],['Assign driver','7 steps'],['Live tracking','6 steps'],['Proof of delivery','6 steps'],['Failed delivery','7 steps']];
function outline(open){const gs=[['Clients',['customer','driver','ops']],['Edge',['gateway','auth']],['Core services',['order','pod','tracking','notify','pricing','payment','dispatch','route']],['Messaging',['bus']],['Data',['ordersdb','trackdb','cache']],['External',['maps','sms','stripe']]];
 const out=[];gs.forEach(([g,ids],i)=>{const o=open&&open.indexOf(i)>=0;out.push({row:1,icon:o?'chevron-down':'chevron-right',ist:Object.assign(ic(15),{color:'var(--mu)'}),parts:[P(g)],meta:String(ids.length),st:rowSt({bold:true}),warn:false,kbd:'',grip:false});
  if(o) ids.forEach(id=>{const n=BY[id];out.push({row:1,icon:LI[n.icon],ist:Object.assign(ic(14),{color:KT[n.kind][1]}),parts:[P(n.title)],meta:'',st:rowSt({indent:22}),warn:false,kbd:'',grip:false});});});return out;}
function features(o){o=o||{};const r=[L.sect('FEATURES','plus')];if(o.filter)r.push(o.filter);
 r.push(L.row('box','Delivery',o.fmeta||'5 flows',{bold:true}));
 (o.flows||FLOWN.map(([t,m])=>({t,m}))).forEach(f=>r.push(L.row('workflow',f.t,f.m,{indent:14,ic:'var(--act)',parts:f.parts,warn:f.warn,active:f.active})));
 if(!o.noRules) r.push(L.row('table','Rules','3',{ic:'var(--amt)'}));return r;}
function leftDefault(o){o=o||{};return [L.tabs(0)].concat(outline(o.open||[0,1,2])).concat([L.grow(),L.rule()]).concat(features(o));}
function flowLeft(active,steps,o){o=o||{};const list=(o.flows||FLOWN).map(([t,m])=>L.row('workflow',t,m,{indent:0,ic:t===active?'var(--act)':'var(--tx2)',active:t===active}));
 return [L.back('Back to canvas'),L.sect('DELIVERY · FLOWS')].concat(list).concat([L.rule(),L.sect('STEPS',o.stepIcon||'',o.stepMeta||'')]).concat(steps);}
function inspDeck(extra){return [I.head('edge','workflow','Deck','Nothing selected'),I.input('NAME','Logistics Delivery'),I.md('DESCRIPTION · MARKDOWN','Order-to-doorstep delivery for the Berlin and Amsterdam regions.'),I.stats([[20,'Nodes'],[28,'Edges'],[5,'Flows'],[3,'Rules']])].concat(extra||[]);}
function inspNode(id,o){o=o||{};const n=Object.assign({},BY[id],o.patch||{});const ro=o.ro;
 const b=[I.head(n.kind,LI[n.icon]||n.icon,n.title,S.KIND[n.kind]+' · '+(n.group?S.GROUPS.find(g=>g.id===n.group).label:'Ungrouped')+' · '+id,ro?['lock']:['trash-2']),I.input('TITLE',n.title,{ro}),I.md('DESCRIPTION · MARKDOWN',n.desc),I.two(['OWNER',n.owner,true,ro?'ro':''],['TECH',n.tech,false,ro?'ro':'']),I.chips('TAGS',n.tags,ro?'':undefined)];
 if(n.links&&n.links.length) b.push(I.links(n.links.map(l=>[l.label,l.url])));
 if(n.rules&&n.rules.length) b.push(I.rows('RULES',n.rules.map(r=>R('table',S.RULES.find(x=>x.id===r).name,'Decision table',{bg:'var(--ams)',ic:'var(--amt)',tail:'arrow-right'}))));
 return b;}
function json(tab,obj,lines){const text=typeof obj==='string'?obj:JSON.stringify(obj,null,2);return {tabs:[segI(tab==='deck'?'Selection':tab,tab!=='deck','',{flex:'none',height:24}),segI('Deck',tab==='deck','',{flex:'none',height:24})],text,lines:(text.split('\n').length)+' lines'};}
const J0=json('Selection','// Select a node, edge or flow step');
function ed(o){return Object.assign({screen:'editor',top:TOP(),banner:null,left:leftDefault(),cv:deck(),json:J0,jsonOpen:true,insp:inspDeck(),pops:[],menus:[],toast:null,scrim:false},o||{});}
const toastSt=(x,y)=>({position:'absolute',left:x,top:y,transform:'translateX(-50%)',height:40,padding:'0 8px 0 14px',borderRadius:999,background:'var(--ink)',color:'var(--inkt)',display:'flex',alignItems:'center',gap:10,fontSize:12.5,boxShadow:'0 8px 28px var(--sh)',zIndex:70,whiteSpace:'nowrap'});
const toast=(icon,t,act,kbd,lib)=>({icon,t,act:act||'',kbd:kbd||'',st:toastSt(lib?838:684,lib?820:600),ast:{height:28,padding:'0 10px',borderRadius:999,display:'flex',alignItems:'center',fontWeight:600,textDecoration:'underline',textUnderlineOffset:3,border:'1px solid currentColor'}});
// ---------- library
function thumb(seed){let s=seed*9301+49297;const r=()=>{s=(s*9301+49297)%233280;return s/233280;};const rects=[],lines=[];const cols=[30,108,186];
 cols.forEach((x,ci)=>{const n=2+Math.floor(r()*2);for(let i=0;i<n;i++){const y=18+i*36+Math.floor(r()*10);rects.push({x,y,st:{fill:'var(--s)',stroke:ci===1&&i===0?'var(--ac)':'var(--bd2)',strokeWidth:1}});}});
 for(let i=0;i<rects.length-1;i++){const a=rects[i],b=rects[i+1];if(a.x!==b.x)lines.push({d:'M'+(a.x+44)+' '+(a.y+9)+' L'+(a.x+61)+' '+(a.y+9)+' L'+(a.x+61)+' '+(b.y+9)+' L'+b.x+' '+(b.y+9)});}
 return {rects,lines};}
const FOLD=[['Logistics',3],['Payments',2],['Platform',2],['Archive',1]];
const RECENT=[['Logistics Delivery','2 min'],['Checkout Platform','1 h'],['Warehouse Operations','Yesterday'],['Fleet Telemetry','3 d'],['Identity & Access','Sep 22'],['Payments Ledger','Sep 18'],['Internal Tooling','Sep 9'],['Returns Pipeline v1','Aug 30']];
function libSide(o){o=o||{};const b=[L.row('layout-grid','All decks','8',{active:o.sel!=='recent'&&!o.fsel,h:34}),L.sect('FOLDERS','folder-plus')];
 (o.folders||FOLD).forEach(([f,c])=>{if(o.rename===f)b.push(L.field('',o.renameV,{focus:true,icon:'folder',errT:o.renameErr||'',help:o.renameErr?'':'Enter to save · Esc to cancel'}));else b.push(L.row('folder',f,String(c),{h:34,hover:o.hover===f,active:o.fsel===f,focus:o.focusF===f}));});
 b.push(L.row('folder-plus','New folder','',{h:34,ic:'var(--tx2)',hover:o.newHover}));
 b.push(L.sect('RECENT','',o.recentEmpty?'':'8'));
 if(o.recentEmpty) b.push(L.dashed('clock','Decks you open appear here, newest first. Up to 8.'));
 else RECENT.forEach(([t,m],i)=>b.push(L.row('clock',t,m,{h:28,ic:'var(--mu)'})));
 b.push(L.grow());b.push(o.store||store(false));return b;}
function store(on,o){o=o||{};return {store:1,title:'Persistent storage',meta:on?'On':'Off',icon:on?'shield-check':'circle-dashed',ist:ic(12),stateSt:{display:'inline-flex',alignItems:'center',gap:4,height:20,padding:'0 7px',borderRadius:999,fontSize:11,fontWeight:500,background:on?'var(--gns)':'var(--s3)',color:on?'var(--gnt)':'var(--tx2)'},fillSt:{width:'12%',height:'100%',background:'var(--ac)'},sub:'1.2 MB used in this browser',body:o.body||(on?'The browser won’t clear your decks to free up space.':'The browser may clear decks when disk space runs low.'),acts:o.acts||(on?[]:[btn('Request persistent storage','s','shield-check','',{height:28,fontSize:12,width:'100%',justifyContent:'center'})]),st:{borderRadius:12,background:'var(--s2)',padding:12,display:'flex',flexDirection:'column',gap:8,flex:'none'}};}
function cards(o){o=o||{};return S.DECKS.filter(d=>(o.hide||[]).indexOf(d.id)<0).map(d=>{const t=thumb(d.seed);const hot=o.menu===d.id;return {name:d.name,meta:d.nodes+' nodes · '+d.flows+' flows',edited:d.edited,folder:d.folder,sample:!!d.sample,rects:t.rects,lines:t.lines,menu:hot||o.hover===d.id,mst:Object.assign({position:'absolute',right:10,top:10,width:30,height:30,borderRadius:8,background:'var(--s)',border:'1px solid var(--bd2)',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--tx)'},hot?FOCUS:{}),st:Object.assign({border:'1px solid '+(hot?'var(--bd2)':'var(--bd)'),borderRadius:16,background:'var(--s)',overflow:'hidden',display:'flex',flexDirection:'column'},hot?{boxShadow:'0 4px 16px var(--sh)'}:{}),rowSt:Object.assign({display:'grid',gridTemplateColumns:'minmax(0,2fr) 1fr 1fr 1fr 40px',gap:12,alignItems:'center',padding:'0 16px',height:52,fontSize:13,borderBottom:'1px solid var(--bd)'},hot?{background:'var(--s2)'}:{})};});}
function lib(o){return Object.assign({screen:'library',left:libSide(),lib:{title:'All decks',sub:'8 decks · 1.2 MB in this browser',banner:null,grid:true,list:false,cards:cards(),hasCards:true},pops:[],menus:[],toast:null,scrim:false},o||{});}
function menu(x,y,items,w){return {st:{position:'absolute',left:x,top:y,width:w||232,background:'var(--s)',border:'1px solid var(--bd)',borderRadius:12,boxShadow:'0 8px 28px var(--sh)',padding:5,zIndex:45,display:'flex',flexDirection:'column'},items:items.map(it=>it==='-'?{sep:true}:{icon:it[0],t:it[1],kbd:it[2]||'',tail:it[3]==='sub'?'chevron-right':'',check:it[3]==='check',st:Object.assign({display:'flex',alignItems:'center',gap:9,height:32,padding:'0 9px',borderRadius:8,fontSize:12.5,color:it[3]==='danger'?'var(--rdt)':'var(--tx)'},it[4]==='focus'?Object.assign({background:'var(--s2)'},FOCUS,{outlineOffset:-2}):it[4]==='hover'?{background:'var(--s2)'}:{})})};}
function dialog(blocks){return {st:popSt(510,240,420,{borderRadius:20,padding:20,gap:14,boxShadow:'0 24px 60px rgba(0,0,0,.25)',zIndex:60}),blocks};}
// ---------- JSON snippets
const flowJ=(id,name,steps)=>({id,name,feature:'delivery',steps});
// =================== STATES
const REC=['e1','e3','e8','e9','e12'];
const recSteps=(n,o)=>{o=o||{};return REC.slice(0,n).map((e,i)=>stepB(i+1,e,i===n-1?'cur':'done',{grip:true,rm:o.hover===i+1,hover:o.hover===i+1}));};
const recLeft=(n,tail)=>[L.sect('NEW FLOW · DELIVERY'),L.field('','Place order'),L.sect('STEPS','',String(n))].concat(tail);
const recInsp=(n,extra)=>[I.head('service','workflow','Place order','Flow · Delivery · recording'),I.input('TITLE','Place order'),I.input('DESCRIPTION · MARKDOWN','',{ph:'What does this flow do? Markdown supported.'}),I.two(['OWNER','Orders'],['FEATURE','Delivery'])].concat(extra||[]);
const recJ=(n)=>json('Flow',flowJ('f6','Place order',REC.slice(0,n).map((e,i)=>({n:i+1,edge:e,from:E[e].from,to:E[e].to}))));
const ST={};
ST['41']=()=>ed({top:TOP(recChip('Place order',0)),
 left:recLeft(0,[L.empty('mouse-pointer-click','No steps yet','Click an edge on the canvas to add step 1. Each next edge must start where the previous one ended.'),L.kbdl([['Tab','Focus next edge'],['↵','Add focused edge'],['⌘Z','Undo last step'],['Esc','Cancel recording']]),L.grow(),L.rule(),L.btns([btn('Cancel','s','','Esc'),btn('Done','p','check','',{opacity:.45,cursor:'not-allowed'})])]),
 cv:deck({em:{e1:{k:'cand',t:'Add as step 1',show:true}},nm:{customer:'hover',gateway:'hover'},labels:false}),
 pops:[tip(514,120,340,'mouse-pointer-click','Click the edge where the flow starts','Any edge can be step 1. Hover shows which one you’ll add.')],
 insp:recInsp(0),json:recJ(0)});
ST['42']=()=>ed({top:TOP(recChip('Place order',3)),
 left:recLeft(3,recSteps(3,{hover:2}).concat([L.dashed('corner-down-right','Next: click an edge leaving Event Bus','',{hot:true}),L.kbdl([['⌥↑↓','Move focused step'],['⌫','Remove focused step']]),L.grow(),L.rule(),L.btns([btn('Undo last step','s','undo-2','⌘Z'),btn('Done','p','check')])])),
 cv:deck({em:{e1:{k:'flow',b:'1'},e3:{k:'flow',b:'2'},e8:{k:'cur',b:'3'},e9:{k:'cand',t:'consume',show:true},e25:{k:'cand',t:'fan-out',show:true},e26:{k:'cand',t:'capture',show:true}},nm:{bus:'ring',customer:'hl',gateway:'hl',order:'hl'},
  wdivs:[{st:{position:'absolute',left:555,top:553,height:22,padding:'0 8px',borderRadius:999,background:'var(--ink)',color:'var(--inkt)',fontSize:11,display:'flex',alignItems:'center',gap:5,zIndex:5,whiteSpace:'nowrap'},icon:'corner-down-right',ist:ic(12),t:'Step 4 starts here'}]}),
 insp:recInsp(3),json:recJ(3)});
ST['43']=()=>ed({top:TOP(recChip('Place order',4)),
 left:recLeft(4,recSteps(4).concat([L.note('clay','ban','Edge not added','Order Service → Orders DB doesn’t start at Dispatch Service.'),L.dashed('corner-down-right','Next: click an edge leaving Dispatch Service','',{hot:true}),L.grow(),L.rule(),L.btns([btn('Undo last step','s','undo-2','⌘Z'),btn('Done','p','check')])])),
 cv:deck({em:{e1:{k:'flow',b:'1'},e3:{k:'flow',b:'2'},e8:{k:'flow',b:'3'},e9:{k:'cur',b:'4'},e7:{k:'bad',t:'INSERT',show:true},e10:{k:'cand',t:'optimize',show:true},e12:{k:'cand',t:'driver.assigned',show:true}},nm:{dispatch:'ring',order:'hl',customer:'hl',gateway:'hl',bus:'hl'}}),
 pops:[pop(700,222,310,[PB.phd('ban','Can’t add this edge as step 5','It starts at Order Service. Step 4 ended at Dispatch Service, so step 5 has to leave Dispatch Service.',{ic:'var(--rdt)',close:true}),PB.btns([btn('Add as branch from step 2','s','git-branch'),btn('Got it','g','','Esc')])],{border:'1.5px solid var(--rdt)'})],
 insp:recInsp(4),json:recJ(4)});
ST['44']=()=>ed({top:TOP(flowChip('Place order')),
 left:flowLeft('Place order',REC.map((e,i)=>stepB(i+1,e,i===0?'cur':'up')),{flows:[['Place order','5 steps'],['Assign driver','7 steps'],['Live tracking','6 steps'],['Proof of delivery','6 steps'],['Failed delivery','7 steps']],stepMeta:'5'}),
 cv:flowCv(REC.map((e,i)=>[e,i+1,i===0?'cur':'flow']),{player:player('Place order',1,5,'Customer App → API Gateway')}),
 toast:toast('circle-check','Saved ‘Place order’ · 5 steps','','',false),
 insp:[I.head('service','workflow','Place order','Flow · Delivery · f6'),I.input('TITLE','Place order'),I.input('DESCRIPTION · MARKDOWN','',{ph:'Add a description'}),I.two(['OWNER','Orders'],['FEATURE','Delivery']),I.kv('SUMMARY',[['Steps','5'],['Nodes touched','6'],['SLA budget','≈ 2.6 s',true]])],
 json:recJ(5)});
// A2
const BR_TOP=[['e1',1],['e3',2],['e5',3]];
ST['45']=()=>ed({top:TOP(recChip('Place order',4,{verb:'Editing',icon:'git-branch',meta:'adding branch after step 3',acts:[cbtn('Done','p','check'),cbtn('Cancel','s','','Esc')]})),
 left:[L.sect('PLACE ORDER · STEPS','','4')].concat([stepB(1,'e1','done'),stepB(2,'e3','done'),stepB(3,'e5','cur',{focus:true}),branchB('payment ok',false,'',14),stepB('4a','e29','done',{indent:28}),branchB('payment failed',true,'new',14),L.dashed('mouse-pointer-click','Click an edge leaving Payment Service','',{hot:true,x:{marginLeft:28}}),L.kbdl([['B','Add branch to focused step'],['Tab','Next candidate edge'],['↵','Use focused edge']]),L.grow(),L.rule(),L.btns([btn('Cancel branch','s','','Esc'),btn('Done','p','check')])]),
 cv:deck({edgeDef:'normal',nodeDef:'faded',keep:['customer','gateway','order','payment','bus','notify','stripe'],addE:['e29','e30'],em:{e1:{k:'flow',b:'1'},e3:{k:'flow',b:'2'},e5:{k:'cur',b:'3'},e29:{k:'flow',b:'4a'},e30:{k:'cand',t:'payment.failed',show:true},e6:{k:'cand',t:'charge',show:true}},nm:{payment:'ring'}}),
 insp:[I.head('service','git-branch','Step 3 · Order → Payment','Place order · step 3 · e5'),I.rows('BRANCHES AFTER THIS STEP',[R('git-branch','payment ok','payment.status == "authorized"',{mono:true,meta:'→ 4a'})]),I.input('NEW BRANCH · LABEL','payment failed',{focus:true}),I.input('CONDITION','payment.status == "declined"',{mono:true}),I.toggle('Error path','Draws dashed with an error icon',true),I.text('Now pick the first edge of this branch on the canvas.')],
 json:json('Step',{flow:'f1',step:3,edge:'e5',branches:[{label:'payment ok',when:'payment.status == "authorized"',next:'e29'},{label:'payment failed',when:'payment.status == "declined"',next:null,error:true}]})});
ST['46']=()=>ed({top:TOP(flowChip('Place order')),
 left:flowLeft('Place order',[stepB(1,'e1','done'),stepB(2,'e3','done'),stepB(3,'e5','done'),branchB('payment ok',false,'',14),stepB('4a','e29','up',{indent:28}),stepB('5a','e9','up',{indent:28}),branchB('payment failed',true,'error path',14),stepB('4b','e30','errcur',{indent:28}),stepB('5b','e15','err',{indent:28})],{stepMeta:'3 + 2 branches'}),
 cv:flowCv([['e1',1],['e3',2],['e5',3],['e29','4a'],['e9','5a'],['e30','4b','errcur'],['e15','5b','err']],{addE:['e29','e30'],player:player('Place order',4,5,'Payment Service → Notification Service',{lab:'4b',errFrom:4,br:[['payment ok',false,'git-branch'],['payment failed',true,'circle-alert']]})}),
 insp:[I.head('external','circle-alert','Step 4b · Payment → Notification','Place order · branch “payment failed” · e30'),I.cond('payment.status == "declined"'),I.input('SLA TARGET','< 2 s',{mono:true}),I.toggle('Error path','Dashed clay edge with an error icon',true),I.rows('ALTERNATIVE',[R('git-branch','4a · payment ok','Payment Service → Event Bus',{tail:'arrow-right'})])],
 json:json('Flow',{id:'f1',name:'Place order',steps:[{n:1,edge:'e1'},{n:2,edge:'e3'},{n:3,edge:'e5',branches:[{label:'payment ok',when:'payment.status == "authorized"',steps:[{n:'4a',edge:'e29'},{n:'5a',edge:'e9'}]},{label:'payment failed',when:'payment.status == "declined"',error:true,steps:[{n:'4b',edge:'e30'},{n:'5b',edge:'e15'}]}]}]})});
// A3
const hiParts=(t,q)=>{const i=t.toLowerCase().indexOf(q);return i<0?[P(t)]:[P(t.slice(0,i)),P(t.slice(i,i+q.length),HI),P(t.slice(i+q.length))].filter(p=>p.t);};
ST['47']=()=>ed({left:leftDefault({open:[0],filter:L.filter('deliv','2 of 5',{focus:true}),fmeta:'2 flows',flows:[{t:'Proof of delivery',m:'6 steps',parts:hiParts('Proof of delivery','deliv')},{t:'Failed delivery',m:'7 steps',parts:hiParts('Failed delivery','deliv'),active:true}],noRules:true}),
 cv:deck()});
ST['48']=()=>ed({left:[L.tabs(0)].concat(outline([0])).concat([L.grow(),L.rule(),L.sect('FEATURES','plus'),L.filter('refund','0 of 5',{focus:true}),L.empty('search-x','No flows match “refund”','Filter checks flow names, step labels and conditions.',[btn('Clear filter','s','','Esc',{height:28}),btn('New flow “refund”','s','plus','',{height:28})])]),cv:deck()});
// A4
ST['49']=()=>ed({cv:deck({em:{e5:{k:'sel'}},nm:{order:'ring',payment:'ring'}}),
 insp:[I.head('client','arrow-right','authorize','Edge · Order Service → Payment Service · e5',['trash-2']),I.input('TITLE','authorize'),I.two(['FROM','Order Service'],['TO','Payment Service']),I.seg('PROTOCOL',[segI('HTTPS'),segI('gRPC',true),segI('Kafka'),segI('SQL'),segI('WS')]),I.md('DESCRIPTION · MARKDOWN','Reserves the card amount before the order is stored.\n- Idempotency key: `order_id`\n- Timeout **800 ms**, no retries'),I.two(['OWNER','Payments'],['DIRECTION','One-way →']),I.chips('TAGS',['pci','sync']),I.links([['API contract','github.com/acme/payment-api/authorize.proto']]),I.rows('USED IN FLOWS',[R('workflow','Place order','Step 5 of 8',{tail:'arrow-right',ic:'var(--act)'})])],
 json:json('Selection',{id:'e5',from:'order',to:'payment',label:'authorize',protocol:'gRPC',direction:'forward',owner:'Payments',tags:['pci','sync']})});
const F1=S.FLOWS[0];
ST['50']=()=>ed({top:TOP(flowChip('Place order')),
 left:flowLeft('Place order',F1.steps.map((s,i)=>stepB(i+1,s.e,'up'))),
 cv:flowCv(F1.steps.map((s,i)=>[s.e,i+1])),
 insp:[I.head('service','workflow','Place order','Flow · Delivery · f1',['ellipsis']),I.input('TITLE','Place order'),I.md('DESCRIPTION · MARKDOWN','Checkout to a confirmed, paid order.\n- Starts when the customer taps **Place order**\n- Ends with `order.created` on the bus'),I.two(['OWNER','Orders'],['FEATURE','Delivery']),I.chips('TAGS',['checkout','critical']),I.links([['Checkout PRD','notion.so/acme/checkout-prd']]),I.kv('SUMMARY',[['Steps','8'],['Rules attached','1'],['SLA budget','≈ 3.0 s',true]])],
 json:json('Flow',{id:'f1',name:'Place order',owner:'Orders',tags:['checkout','critical'],steps:F1.steps.map((s,i)=>({n:i+1,edge:s.e}))})});
ST['51']=()=>ed({top:TOP(flowChip('Place order')),
 left:flowLeft('Place order',F1.steps.map((s,i)=>stepB(i+1,s.e,i<3?'done':i===3?'cur':'up'))),
 cv:flowCv(F1.steps.map((s,i)=>[s.e,i+1,i===3?'cur':'flow']),{player:player('Place order',4,8,'Order Service → Pricing Service')}),
 insp:[I.head('service','workflow','Order Service → Pricing Service','Place order · step 4 of 8 · e4',['ellipsis']),I.input('TITLE','Quote the delivery'),I.md('DESCRIPTION · MARKDOWN','Pricing returns a fee and tier.\n- Uses `Delivery tier` rule'),I.two(['OWNER','Orders'],['EDGE','quote · gRPC',false]),I.chips('TAGS',['pricing']),I.cond('cart.items.length > 0'),I.sla('< 120 ms',72,'p95 86 ms · within target'),I.rows('ATTACHED RULES',[R('table','Delivery tier','Row 1 matches → Bike · 45 min · €4.00',{bg:'var(--ams)',ic:'var(--amt)',tail:'arrow-right'})],'1')],
 json:json('Step',{flow:'f1',step:4,edge:'e4',from:'order',to:'pricing',title:'Quote the delivery',condition:'cart.items.length > 0',sla:'< 120 ms',rules:['r1']})});
// B1
const Z1={z:1,ox:-200,oy:-10};
ST['52']=()=>ed({cv:deck(Object.assign({nm:{order:{s:'hover handles',hot:1}}},Z1)),pops:[tip(546,74,270,'spline','Drag a handle to connect','Or focus the node and press C to connect by keyboard.')]});
ST['53']=()=>ed({cv:deck(Object.assign({nm:{order:{s:'sel handles',hot:1}},wpaths:[{d:'M624 105 L842 205',st:Object.assign({fill:'none'},ES.ghost)}],wdivs:[{st:{position:'absolute',left:838,top:200,color:'var(--tx)',zIndex:6},icon:'mouse-pointer-2',ist:ic(20),t:''}]},Z1)),
 pops:[kbar(684,600,[['Release','on a node to connect'],['Esc','cancel']])],insp:inspNode('order')});
ST['54']=()=>{const r=S.route(BY.order,BY.trackdb);return ed({cv:deck(Object.assign({nm:{order:{s:'sel handles',hot:1},trackdb:'valid'},wpaths:[{d:r.d,st:Object.assign({fill:'none'},ES.ghost,{strokeDasharray:'none',strokeWidth:2})}],wdivs:[{st:{position:'absolute',left:880,top:186,color:'var(--tx)',zIndex:6},icon:'mouse-pointer-2',ist:ic(20),t:''}]},Z1)),
 pops:[tip(730,272,240,'plus','Connect Order Service → Tracking Store','Release to create the edge.'),kbar(684,600,[['Release','create edge'],['Esc','cancel']])],insp:inspNode('order')});};
ST['55']=()=>ed({cv:deck(Object.assign({nm:{order:{s:'sel handles',hot:1},ordersdb:'invalid'},em:{e7:{k:'hover',show:true}},wdivs:[{st:{position:'absolute',left:878,top:100,color:'var(--tx)',zIndex:6},icon:'mouse-pointer-2',ist:ic(20),t:''}]},Z1)),
 pops:[tip(760,186,270,'ban','Order Service → Orders DB already exists','Releasing here does nothing. Select the existing INSERT edge to edit it.','clay')],insp:inspNode('order')});
ST['56']=()=>{const r=S.route(BY.order,BY.trackdb);return ed({cv:deck(Object.assign({nm:{order:'sel focus',trackdb:'valid'},wpaths:[{d:r.d,st:Object.assign({fill:'none'},ES.ghost)}]},Z1)),
 pops:[pop(526,186,270,[PB.phd('spline','Connect Order Service to…',''),PB.input('','tra',{focus:true,icon:'search'}),PB.rows('',[R('locate-fixed','Tracking Service','Core services',{bg:'transparent'}),R('activity','Tracking Store','Data · new edge preview on canvas',{active:true,focus:true})])]),kbar(684,600,[['C','connect from focused node'],['↑↓','choose'],['↵','create'],['Esc','cancel']])],insp:inspNode('order')});};
ST['57']=()=>ed({cv:deck(Object.assign({addE:['e31'],em:{e31:{k:'sel',lx:862,ly:150}},nm:{order:'ring',trackdb:'ring'}},Z1)),
 pops:[pop(820,212,276,[PB.phd('spline','New edge','Order Service → Tracking Store',{close:true}),PB.input('LABEL','archive route',{focus:true}),PB.seg('PROTOCOL',[segI('HTTPS'),segI('gRPC'),segI('Kafka'),segI('SQL',true),segI('WS')]),PB.seg('DIRECTION',[segI('One-way',true,'arrow-right'),segI('Reverse',false,'arrow-left'),segI('Both',false,'arrow-left-right')]),PB.btns([btn('Delete','g','trash-2','',{color:'var(--rdt)'}),btn('Done','p','','↵',{marginLeft:'auto'})])])],
 insp:[I.head('client','arrow-right','archive route','Edge · Order Service → Tracking Store · e31',['trash-2']),I.input('TITLE','archive route'),I.two(['FROM','Order Service'],['TO','Tracking Store']),I.seg('PROTOCOL',[segI('HTTPS'),segI('gRPC'),segI('Kafka'),segI('SQL',true),segI('WS')]),I.input('DESCRIPTION · MARKDOWN','',{ph:'Add a description'})],
 json:json('Selection',{id:'e31',from:'order',to:'trackdb',label:'archive route',protocol:'SQL',direction:'forward'})});
// B2
ST['58']=()=>ed({cv:deck({nm:{pricing:'sel',payment:'sel',dispatch:'sel'},wdivs:[{st:{position:'absolute',left:640,top:112,width:184,height:240,border:'1px dashed var(--ac)',borderRadius:14,zIndex:1},icon:'',ist:{},t:''},{st:{position:'absolute',left:640,top:356,height:22,padding:'0 8px',borderRadius:999,background:'var(--ac)',color:'var(--onac)',fontSize:11,fontWeight:500,display:'flex',alignItems:'center',zIndex:5},icon:'',ist:{},t:'3 selected'}]}),
 insp:[I.head('client','boxes','3 nodes selected','Pricing · Payment · Dispatch',['trash-2']),I.input('KIND','Service',{help:'Same on all 3'}),I.two(['OWNER','Mixed',true,'mixed'],['TECH','Mixed',false,'mixed']),I.input('GROUP','Core services'),I.chips('TAGS',[{t:'critical',meta:'2/3',part:true},{t:'pci',meta:'1/3',part:true}]),I.text('Fields marked Mixed keep each node’s own value until you type a new one. Dashed tags are on some nodes only.'),I.btns([btn('Delete 3 nodes','d','trash-2','⌫')])],
 json:json('Selection',{selection:['pricing','payment','dispatch'],kind:'service',owner:{mixed:['Orders','Payments','Dispatch']}})});
ST['59']=()=>ed({cv:deck({hide:['pricing','payment','dispatch']}),toast:toast('trash-2','Deleted 3 nodes and 8 edges','Undo','⌘Z',false),
 insp:inspDeck([I.note('amber','triangle-alert','3 new problems','Two flows now have steps without an edge.',[btn('Show problems','w','','',{height:26,fontSize:12})])])});
// B3
const LEG={id:'legacy',group:null,kind:'service',x:250,y:36,title:'Legacy Invoicer',icon:'file-text',tech:'PHP 7',rules:[]};
ST['60']=()=>ed({left:leftDefault({flows:[{t:'Place order',m:'8 steps'},{t:'Assign driver',m:'7 steps'},{t:'Live tracking',m:'6 steps'},{t:'Proof of delivery',m:'6 steps',warn:true},{t:'Failed delivery',m:'7 steps',warn:true}]}),
 cv:deck({add:[LEG],nm:{legacy:'sel warn',tracking:'warn'},em:{e17:{k:'normal',lk:'warn',t:'GPS stream ×2',show:true}},tr:[btn('4 problems','w','triangle-alert','',{height:32}),btn('Labels','s','tag','',{height:32}),btn('Focus','s','scan','',{height:32})]}),
 insp:[I.head('edge','workflow','Deck','Logistics Delivery'),I.rows('PROBLEMS',[R('unlink','Orphan node','Legacy Invoicer has no edges',{active:true,focus:true,tail:'arrow-right'}),R('workflow','Broken flow','Failed delivery · step 4 doesn’t continue from step 3',{tail:'arrow-right'}),R('copy','Duplicate edge','API Gateway → Tracking Service appears twice',{tail:'arrow-right'}),R('unplug','Step without edge','Proof of delivery · step 2 used e22, which was deleted',{tail:'arrow-right'})],'4'),I.text('Click a problem, or press ↵ on it, to select the object. The list updates as you edit.'),I.stats([[21,'Nodes'],[29,'Edges'],[5,'Flows'],[3,'Rules']])],
 json:json('Selection',{id:'legacy',type:'service',title:'Legacy Invoicer',tech:'PHP 7',group:null,problems:['orphan']})});
// B4
const CLOUD={ordersdb:{kind:'cloud',icon:'cloud',tech:'RDS · PostgreSQL 16',prov:'AWS'},cache:{kind:'cloud',icon:'cloud',tech:'ElastiCache · Redis',prov:'AWS'},trackdb:{kind:'cloud',icon:'cloud',tech:'Data Explorer',prov:'AZURE'},maps:{kind:'cloud',icon:'cloud',title:'Routes API',tech:'Maps Platform',prov:'GCP'},sms:{kind:'partner',icon:'handshake',title:'Twilio',tech:'SMS · Verify',prov:'PARTNER'},stripe:{kind:'partner',icon:'handshake',title:'Stripe',tech:'Card payments',prov:'PARTNER'}};
const palT=(icon,kind,t,sub,badge,hot)=>({icon,tile:tile(kind,30),t,sub,meta:badge||'',st:Object.assign({border:'1px solid var(--bd)',borderRadius:12,padding:10,display:'flex',flexDirection:'column',gap:8,background:'var(--s)'},hot?{borderColor:'var(--ac)',boxShadow:'0 0 0 3px var(--acs)'}:{})});
const PAL=[palT('smartphone','client','Client','App or UI'),palT('router','edge','Gateway','Edge or proxy'),palT('box','service','Service','Business logic'),palT('arrow-left-right','queue','Queue','Topic or stream'),palT('database','data','Database','Store or cache'),palT('globe','external','External','Third party')];
ST['61']=()=>ed({left:[L.tabs(1),L.field('','',{ph:'Filter components',icon:'search'}),L.sect('COMPONENTS'),{pal:1,items:PAL.slice(0,4)},L.sect('CLOUD & PARTNERS'),{pal:1,items:[palT('cloud','cloud','Cloud resource','AWS'==='AWS'?'Managed service':'', 'AWS',true),palT('cloud','cloud','Cloud resource','Managed service','GCP'),palT('cloud','cloud','Cloud resource','Managed service','AZURE'),palT('handshake','partner','Partner','External company','PARTNER')]},L.text('Provider shows as a text badge. No brand logos.')],
 cv:deck({z:1,ox:-330,oy:-10,patch:CLOUD,nm:{ordersdb:'sel'}}),
 insp:[I.head('cloud','cloud','Orders DB','Cloud resource · AWS · ordersdb',['trash-2']),I.input('TITLE','Orders DB'),I.seg('PROVIDER',[segI('AWS',true),segI('GCP'),segI('Azure'),segI('Other')]),I.two(['SERVICE','RDS'],['REGION','eu-central-1']),I.input('RESOURCE ID','arn:aws:rds:eu-central-1:…:db/orders',{mono:true}),I.two(['OWNER','Orders'],['TECH','PostgreSQL 16',false]),I.chips('TAGS',['pii'])],
 json:json('Selection',{id:'ordersdb',type:'cloud',provider:'aws',service:'RDS',region:'eu-central-1',title:'Orders DB',tech:'PostgreSQL 16'})});
// B5
const STK=(dim,sel)=>[{x:20,y:-140,open:true,t:'Open question',md:'Do we need a quote cache?\n- Pricing p95 is **180 ms**\n- Decide before Sep 30',dim:dim},{x:440,y:-140,open:true,t:'Checkout notes',md:'Idempotency key on `POST /orders`\n- Retries: 3 with backoff',anchor:'Order Service',sel:sel,dim:false},{x:650,y:-60,open:false,t:'Fee table owner: Orders',anchor:'Pricing Service',dim:dim}];
const ANCH=[{d:'M530 -28 L542 80',st:{fill:'none',stroke:'var(--amt)',strokeWidth:1.5,strokeDasharray:'2 3'}},{d:'M740 -32 L732 122',st:{fill:'none',stroke:'var(--amt)',strokeWidth:1.5,strokeDasharray:'2 3'}}];
const pin=(x,y)=>({st:{position:'absolute',left:x-8,top:y-8,width:16,height:16,borderRadius:999,background:'var(--ams)',border:'1.5px solid var(--amt)',color:'var(--amt)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:5,boxSizing:'border-box'},icon:'pin',ist:ic(9),t:''});
ST['62']=()=>ed({left:[L.tabs(1),L.sect('COMPONENTS'),{pal:1,items:PAL},L.sect('STRUCTURE'),{pal:1,items:[palT('square-dashed','group','Group','Boundary or team'),palT('sticky-note','queue','Note','Markdown, 180 px','',true)]},L.text('Drag Note onto a node to pin it, or onto empty canvas for a free note. N adds one at the pointer.')],
 cv:deck({z:.9,ox:10,oy:150,stickies:STK(false,true),wpaths:ANCH,wdivs:[pin(542,80),pin(732,122)]}),
 insp:[I.head('queue','sticky-note','Checkout notes','Note · pinned to Order Service',['trash-2']),I.md('TEXT · MARKDOWN','Idempotency key on `POST /orders`\n- Retries: 3 with backoff'),I.seg('ANCHOR',[segI('Free'),segI('Pinned to node',true,'pin')]),I.input('PINNED TO','Order Service',{icon:'pin',help:'Moves with the node. Unpin keeps it where it is.'}),I.seg('DISPLAY',[segI('Expanded',true,'chevron-down'),segI('Collapsed',false,'chevron-right')]),I.toggle('Stay visible during flows','Off: dims to 35% unless its node is on the current step',false)],
 json:json('Selection',{id:'note_2',type:'note',text:'Idempotency key on `POST /orders`\n- Retries: 3 with backoff',anchor:'order',collapsed:false,offset:{x:-20,y:-220}})});
ST['63']=()=>{const cv=flowCv(F1.steps.map((s,i)=>[s.e,i+1,i===2?'cur':'flow']),{z:.9,ox:10,oy:150,stickies:STK(true,false),wpaths:ANCH.map((p,i)=>({d:p.d,st:Object.assign({},p.st,{opacity:i===1?.35:1})})),wdivs:[pin(542,80),Object.assign(pin(732,122),{})],player:player('Place order',3,8,'API Gateway → Order Service',{playing:true}),tr:[btn('Notes: dimmed','s','sticky-note','',{height:32}),btn('Labels','s','tag','',{height:32})]});cv.wdivs[1].st=Object.assign({},cv.wdivs[1].st,{opacity:.35});
 return ed({top:TOP(flowChip('Place order')),left:flowLeft('Place order',F1.steps.map((s,i)=>stepB(i+1,s.e,i<2?'done':i===2?'cur':'up'))),cv,
 insp:[I.head('service','workflow','API Gateway → Order Service','Place order · step 3 of 8 · e3'),I.cond('token.valid && token.role == "customer"'),I.sla('< 200 ms',64,'p95 128 ms · within target'),I.rows('NOTES ON THIS STEP',[R('sticky-note','Checkout notes','Pinned to Order Service',{bg:'var(--ams)',ic:'var(--amt)'})])],
 json:json('Step',{flow:'f1',step:3,edge:'e3',notes:{shown:['note_2'],dimmed:['note_1','note_3']}})});};
// C1
ST['64']=()=>ed({left:[L.tabs(0)].concat(outline([])).concat([L.grow(),L.rule()]).concat(features()),
 cv:deck({z:.42,ox:191,oy:177,lod:'tile',solidG:true,edgeDef:'faint',lvl:0,crumbs:['Logistics Delivery'],mm:false}),pops:[tip(470,112,270,'zoom-in','Landscape · tiles only','Scroll in or double-click a group to go deeper.')]});
ST['65']=()=>ed({cv:deck({z:.62,ox:82,oy:111,lod:'title',lvl:1,gm:{core:{hover:true}},crumbs:['Logistics Delivery','System view']}),pops:[tip(470,74,280,'mouse-pointer-click','Double-click to open Core services','Or focus the group label and press ↵.')],
 insp:[I.head('group','square-dashed','Core services','Group · 8 nodes · core'),I.input('NAME','Core services'),I.two(['OWNER','Mixed',true,'mixed'],['NODES','9',false]),I.kv('EDGES',[['Inside','5'],['Leaving the group','17']])]});
ST['66']=()=>ed({left:[L.tabs(0),L.row('chevron-up','Up to Logistics Delivery','⌫',{ic:'var(--tx2)'}),L.sect('CORE SERVICES')].concat(['order','pod','tracking','notify','pricing','payment','dispatch','route'].map(id=>L.row(LI[BY[id].icon],BY[id].title,'',{ic:'var(--act)',active:id==='order'}))),
 cv:deck({only:['order','pod','tracking','notify','pricing','payment','dispatch','route'],z:1.25,ox:-376,oy:16,lvl:2,nm:{order:'sel'},crumbs:['Logistics Delivery','Core services'],mm:false}),pops:[tip(300,470,300,'mouse-pointer-click','Double-click Order Service for its components','Esc or ⌫ goes back up one level.')],insp:inspNode('order')});
const COMP=[['checkout',140,250,'Checkout API','HTTP handler · Go',['public']],['orch',370,250,'Order orchestrator','Saga coordinator',['critical']],['valid',370,90,'Cart validator','Rules engine',[]],['quote',600,90,'Quote client','gRPC client',[]],['payc',600,250,'Payment client','gRPC client',['pci']],['repo',600,410,'Order repository','pgx · sqlc',['pii']],['outbox',370,410,'Outbox publisher','Kafka producer',[]]].map(([id,x,y,t,tech,tags])=>({id,x,y,w:190,h:90,kind:'service',icon:'component',title:t,tech,l3:'Orders',chips:tags,rules:id==='valid'?['r1']:[],lod:'full'}));
const PORTS=[['p_gw',0,277,'API Gateway','arrow-right'],['p_pr',840,117,'Pricing Service','arrow-right'],['p_pay',840,277,'Payment Service','arrow-right'],['p_db',840,437,'Orders DB','arrow-right'],['p_bus',405,580,'Event Bus','arrow-down']].map(([id,x,y,t,d])=>({id,x,y,w:110,h:32,port:true,pdir:d,title:t,kind:'client'}));
ST['67']=()=>{const nodes=COMP.concat(PORTS);const E2=[['p_gw','checkout'],['checkout','orch'],['orch','valid'],['orch','quote'],['orch','payc'],['orch','repo'],['orch','outbox'],['quote','p_pr'],['payc','p_pay'],['repo','p_db'],['outbox','p_bus']].map(([a,b],i)=>({id:'c'+i,from:a,to:b,label:''}));
 return ed({left:[L.tabs(0),L.row('chevron-up','Up to Core services','⌫',{ic:'var(--tx2)'}),L.sect('ORDER SERVICE · COMPONENTS')].concat(COMP.map(c=>L.row('component',c.title,'',{ic:'var(--act)',active:c.id==='orch'}))),
 cv:deck({nodes,edges:E2,groups:[{id:'os',label:'Order Service · components',x:110,y:40,w:710,h:500,count:7}],z:.84,ox:-2,oy:34,lvl:3,zoomT:'170%',nm:{orch:'sel'},crumbs:['Logistics Delivery','Core services','Order Service'],mm:false}),
 insp:[I.head('service','component','Order orchestrator','Component · Order Service · order.orch',['trash-2']),I.input('TITLE','Order orchestrator'),I.md('DESCRIPTION · MARKDOWN','Runs the checkout saga.\n- Compensates on `payment.failed`'),I.two(['OWNER','Orders'],['TECH','Go',false]),I.chips('TAGS',['critical'])]});};
// C2
const CORE=['order','pod','tracking','notify','pricing','payment','dispatch','route'];
const CARD={id:'core_c',x:547,y:215,w:164,h:58,kind:'group',icon:'boxes',title:'Core services',tech:'8 nodes · 22 edges',stack:true};
function collapsed(o){o=o||{};const c=CARD;const T=(id,y)=>[[711,244],[862,244],[862,y],[886,y]];
 const cus=[{pts:[[414,185],[523,185],[523,244],[547,244]],k:o.gw||'merged',t:'×5',icon:'arrow-left-right',lx:470,ly:185,b:o.gwb||''},{pts:[[629,273],[629,384],[637,384],[637,495]],k:o.bus||'merged',t:'×5',icon:'arrow-left-right',lx:633,ly:420,b:o.busb||''},{pts:T('db',105),k:o.db||'merged',t:'×2',icon:'arrow-right',lx:862,ly:160,b:o.dbb||''},{pts:T(0,190),k:o.rest||'normal',t:''},{pts:T(0,275),k:o.rest||'normal',t:''},{pts:T(0,425),k:o.rest||'normal',t:''},{pts:T(0,510),k:o.rest||'normal',t:''},{pts:T(0,595),k:o.st||o.rest||'normal',t:o.st?'charge':'',b:o.stb||'',lx:862,ly:560}];
 return deck(Object.assign({hide:CORE,hideG:['core'],add:[Object.assign({},CARD,{tech:o.cardSub||CARD.tech})],hideE:S.EDGES.filter(e=>CORE.indexOf(e.from)>=0||CORE.indexOf(e.to)>=0).map(e=>e.id),custom:cus,nm:o.nm||{}},o.d||{}));}
ST['68']=()=>ed({cv:deck({gm:{core:{hover:true,focus:true,chev:'chevron-down'}}}),pops:[tip(420,74,260,'chevrons-down-up','Collapse Core services','Click the chevron, or press Space on the focused label.')],
 insp:[I.head('group','square-dashed','Core services','Group · 8 nodes · core'),I.input('NAME','Core services'),I.toggle('Collapsed','Shows as one card; edges merge per neighbour',false),I.kv('EDGES',[['Inside','5'],['Leaving the group','17']])]});
ST['69']=()=>ed({cv:collapsed({nm:{core_c:'sel'}}),
 insp:[I.head('group','boxes','Core services','Group · collapsed · 8 nodes'),I.input('NAME','Core services'),I.toggle('Collapsed','Shows as one card; edges merge per neighbour',true),I.rows('MERGED EDGES',[R('arrow-left-right','API Gateway','5 edges, both directions',{meta:'×5'}),R('arrow-left-right','Event Bus','5 edges, both directions',{meta:'×5'}),R('arrow-right','Orders DB','2 edges out',{meta:'×2'})]),I.btns([btn('Expand group','s','chevrons-up-down','Space')])],
 json:json('Selection',{id:'core',type:'group',collapsed:true,members:9})});
ST['70']=()=>ed({cv:collapsed({gw:'hover',nm:{gateway:'ring',core_c:'ring'}}),
 pops:[pop(360,262,330,[PB.phd('arrow-left-right','API Gateway ↔ Core services','5 edges merged'),PB.rows('',[['POST /orders','API Gateway → Order Service'],['GPS stream','API Gateway → Tracking Service'],['upload proof','API Gateway → Proof of Delivery'],['push','Notification Service → API Gateway'],['WebSocket','Tracking Service → API Gateway']].map(([t,s],i)=>R('spline',t,s,{bg:'transparent',focus:i===0,x:{padding:'6px 8px'}}))),PB.btns([btn('Expand group','s','chevrons-up-down','Space')])])],
 insp:[I.head('client','arrow-left-right','Merged edge','API Gateway ↔ Core services · 5 edges'),I.text('Hover or focus a merged edge to list what’s inside. ↵ pins the list; ↑↓ moves through it; ↵ on a row expands the group and selects that edge.')]});
ST['71']=()=>ed({top:TOP(flowChip('Place order')),left:flowLeft('Place order',F1.steps.map((s,i)=>stepB(i+1,s.e,i<4?'done':i===4?'cur':'up',{lab:(i===3||i===4)?E[s.e].label+' · inside Core services':''}))),
 cv:collapsed({gw:'flow',gwb:'3',db:'flow',dbb:'7',bus:'flow',busb:'8',st:'flow',stb:'6',cardSub:'Step 5 runs inside',rest:'dim',nm:{core_c:{s:'ring',decos:[{st:{position:'absolute',right:10,top:21,width:14,height:14,borderRadius:999,background:'var(--ac)',border:'2px solid var(--s)',boxShadow:'0 0 0 5px var(--acs)',zIndex:3},icon:'',t:''}]},customer:'',gateway:'',auth:'',stripe:'',ordersdb:'',bus:''},d:{nodeDef:'dim',keep:['customer','gateway','auth','stripe','ordersdb','bus','core_c'],edgeDef:'dim',em:{e1:{k:'flow',b:'1'},e2:{k:'flow',b:'2'}},crumbs:['Logistics Delivery','Flow: Place order'],player:player('Place order',5,8,'Order Service → Payment Service · inside Core services',{playing:true})}}),
 pops:[tip(470,340,270,'chevrons-up-down','Steps 4–5 run inside this group','Press Space to expand and watch them.')],
 insp:[I.head('service','workflow','Order Service → Payment Service','Place order · step 5 of 8 · e5 · inside a collapsed group'),I.cond('quote.accepted == true'),I.sla('< 800 ms',55,'p95 440 ms · within target')]});
// D1
const nfDlg=(v,err)=>dialog([PB.phd('folder-plus','New folder','Folders only group decks in this browser.',{close:true}),PB.input('NAME',v,{focus:true,err:!!err,errT:err||'',ph:'e.g. Payments'}),PB.btns([btn('Cancel','s','','Esc',{marginLeft:'auto'}),btn('Create folder','p','','↵')])]);
ST['72']=()=>lib({left:libSide({newHover:true}),pops:[nfDlg('','Enter a folder name.')],scrim:true});
ST['73']=()=>lib({left:libSide({newHover:true}),pops:[nfDlg('Logistics','A folder named “Logistics” already exists.')],scrim:true});
ST['74']=()=>lib({left:libSide({hover:'Archive',focusF:'Archive'}),menus:[menu(200,262,[['pencil','Rename','F2'],['folder-output','Export folder','⌘E'],'-',['trash-2','Delete folder','⌫','danger','focus']],220)]});
ST['75']=()=>lib({left:libSide({folders:[['Logistics',3],['Payments',2],['Platform',2]],rename:'Payments',renameV:'Payments & Billing'}),lib:{title:'All decks',sub:'8 decks · 1.2 MB in this browser',banner:null,grid:true,list:false,cards:cards().map(c=>c.folder==='Archive'?Object.assign(c,{folder:'Unfiled'}):c),hasCards:true},toast:toast('folder-x','Deleted “Archive” · 1 deck moved to Unfiled','Undo','⌘Z',true)});
// D2
const DM=(focus)=>[['arrow-up-right','Open','↵'],['pencil','Rename','F2'],['copy','Duplicate','⌘D'],['folder-input','Move to folder','','sub',focus==='move'?'focus':''],['download','Export .sododeck.json','⌘E'],'-',['trash-2','Delete','⌫','danger',focus==='del'?'focus':'']];
ST['76']=()=>lib({lib:{title:'All decks',sub:'8 decks · 1.2 MB in this browser',banner:null,grid:true,list:false,cards:cards({menu:'wh'}),hasCards:true},
 menus:[menu(876,194,DM('move'),240),menu(1120,318,[['folder','Logistics','','check','hover'],['folder','Payments'],['folder','Platform'],['folder','Archive'],'-',['folder-plus','New folder…']],196)]});
ST['77']=()=>lib({lib:{title:'All decks',sub:'7 decks · 1.1 MB in this browser',banner:null,grid:false,list:true,cards:cards({hide:['ledger'],menu:'fleet'}),hasCards:true},menus:[menu(1162,300,DM('del'),240)],toast:toast('trash-2','Deleted “Payments Ledger”','Undo','⌘Z',true)});
// D3
ST['78']=()=>lib({left:libSide({}),lib:{title:'All decks',sub:'8 decks · 1.2 MB in this browser',banner:null,grid:true,list:false,cards:cards(),hasCards:true}});
ST['79']=()=>lib({left:libSide({recentEmpty:true}),lib:{title:'All decks',sub:'1 deck · 48 KB in this browser',banner:null,grid:true,list:false,cards:cards().slice(0,1),hasCards:true}});
// D4
ST['80']=()=>lib({left:libSide({store:store(false)}),lib:{title:'All decks',sub:'8 decks · 1.2 MB in this browser',banner:{st:Object.assign(noteSt('amber'),{flexDirection:'row',alignItems:'center',gap:14,padding:'12px 14px 12px 16px',borderRadius:14,marginBottom:22}),icon:'triangle-alert',title:'Safari may delete these decks after 7 days without a visit.',body:'Safari clears site data for sites you haven’t opened in a week. Open Sododeck at least weekly, turn on persistent storage, or keep a backup file.',acts:[btn('Export backup','a','download','',{height:32}),btn('','g','x','',{color:'var(--amt)',height:32})]},grid:true,list:false,cards:cards(),hasCards:true}});
ST['81']=()=>lib({left:libSide({store:store(true)}),toast:toast('shield-check','Persistent storage is on','','',true)});
// D5
const BAN={st:{height:44,flex:'none',display:'flex',alignItems:'center',gap:10,padding:'0 12px 0 16px',background:'var(--ams)',color:'var(--amt)',borderBottom:'1px solid var(--bd)',fontSize:13},icon:'lock',title:'This deck is open in another tab — this tab is read-only',body:'Edits here would overwrite the other tab.',acts:[btn('Use here instead','a','','',{height:30})]};
ST['82']=()=>ed({banner:BAN,top:TOP({saveIcon:'lock',saveText:'Read-only',saveSt:{display:'flex',alignItems:'center',gap:6,fontSize:12,color:'var(--tx2)',whiteSpace:'nowrap',height:28,padding:'0 10px',borderRadius:999,background:'var(--s2)',fontWeight:500},ro:true}),
 left:[L.tabs(0)].concat(outline([0,1,2])).concat([L.grow(),L.rule()]).concat(features()),cv:deck({bh:44,oy:50,nm:{order:'sel'},edgeDef:'ro'}),insp:inspNode('order',{ro:true})});
// D6
const SAVE={saving:{saveIcon:'loader-circle',saveText:'Saving…'},saved:{},err:{saveIcon:'circle-alert',saveText:'Couldn’t save — export a backup',saveSt:{display:'flex',alignItems:'center',gap:6,fontSize:12,color:'var(--rdt)',whiteSpace:'nowrap',height:30,padding:'0 4px 0 10px',borderRadius:999,background:'var(--rds)',fontWeight:500},saveBtn:true,saveBtnT:'Export'}};
ST['83']=()=>ed({top:TOP(SAVE.saving),cv:deck({nm:{order:'sel'}}),insp:inspNode('order',{patch:{title:'Order Service v2'}})});
ST['84']=()=>ed({top:TOP(SAVE.saved),cv:deck({nm:{order:'sel'}}),insp:inspNode('order',{patch:{title:'Order Service v2'}})});
ST['85']=()=>ed({top:TOP(SAVE.err),cv:deck({nm:{order:'sel'}}),insp:inspNode('order',{patch:{title:'Order Service v2'}}),
 pops:[pop(640,62,380,[PB.phd('circle-alert','Couldn’t save your last change','This browser’s storage is full. Your edits are safe in this tab until you close it.',{ic:'var(--rdt)',close:true}),PB.kv('',[['Unsaved since','14:32'],['Error','QuotaExceededError',true]]),PB.btns([btn('Export .sododeck.json','p','download'),btn('Retry','s','rotate-cw','⌘S')])],{border:'1.5px solid var(--rdt)',zIndex:41})]});
// =================== META
const N=(id,slug,sec,title,did,changed,keys,edge)=>({id,slug,sec,title,did,changed,keys,edge});
const LIST=[
N('41','rec-empty','A','Record a flow · empty','Clicked “+ New flow” in Features and named it Place order.','Recording chip replaces the view switcher. Left panel becomes the step list. Canvas stays at full opacity so every edge is clickable; hovering an edge previews it as step 1 (dotted orange + “Add as step 1”).','Tab / Shift+Tab cycle edges · ↵ add focused edge · Esc cancel recording (asks only if steps exist).','Empty: “No steps yet” with instructions. Done is disabled until one step exists (dimmed + not-allowed cursor).'),
N('42','rec-mid','A','Record a flow · mid recording','Added three edges in order: HTTPS, POST /orders, order.created.','Recorded edges turn orange with a numbered badge; the last one is solid-filled. Event Bus gets a ring and a “Step 4 starts here” tag, and its three outgoing edges show as dotted candidates. Hovering step 2 shows grip and remove.','⌘Z undo last step · ⌥↑/⌥↓ move focused step · ⌫ remove focused step · drag the grip to reorder.','Reordering that breaks the chain marks the affected rows with a clay dashed dot and an alert icon and blocks Done until fixed.'),
N('43','rec-invalid','A','Record a flow · invalid click','With 4 steps recorded, clicked Order Service → Orders DB.','The clicked edge flashes clay with a dashed stroke and a ban icon (readable without colour). A popover explains why and offers “Add as branch from step 2”. Valid candidates stay dotted orange. The same message appears in the step list.','Esc or “Got it” closes the popover · focus returns to the canvas edge.','Screen readers get the same sentence through a polite live region. Nothing is added; the step count doesn’t change.'),
N('44','rec-finished','A','Record a flow · finished','Pressed Done.','Flow is saved to Delivery with 5 steps. The editor switches to normal flow mode: the path is highlighted, everything else dims to 22%, and the player waits on step 1. Toast confirms.','← / → step · Space play/pause · Esc exit flow mode.','If saving fails, the toast is replaced by the autosave error state (see 85).'),
N('45','branch-create','A','Branches · creating a branch','Focused step 3 and pressed B (or Step menu → Add branch).','Step list indents a “◇ payment ok” branch (existing) and a new “◇ payment failed” branch. The inspector edits label, condition and the Error path toggle. Candidate edges leaving Payment Service are dotted orange.','B add branch · Tab next candidate edge · ↵ use focused edge · Esc cancel the branch.','A branch needs a label and a condition; empty fields show a clay inline error on Done. Only edges leaving the branch node are accepted (same rule as 43).'),
N('46','branch-tree','A','Branches · tree + error path','Opened the flow and chose the “payment failed” branch in the player.','Step list shows the shared trunk, then two indented branches with ◇ condition headers. On the canvas the error branch is a dashed clay edge with a circle-alert icon on its label and step badge; the ok branch stays solid orange. Readable in greyscale: dash + icon.','In the player, ←/→ steps; ↑/↓ switches branch at a fork; the branch picker is a segmented control.','A branch whose condition overlaps another shows an amber warning in Problems.'),
N('47','flow-filter','A','Flow list filter','Pressed / in the Features area and typed “deliv”.','List filters live. Matches are underlined and bold (not colour only). Count “2 of 5” sits in the field. Parent feature stays visible.','/ focus filter · ↓ into results · Esc clear, second Esc blurs.','See 48 for no results.'),
N('48','flow-filter-empty','A','Flow list filter · no results','Typed “refund”.','List is replaced by an empty state with two actions.','Esc clears the filter · ↵ on “New flow” starts recording with that name.','Filter searches names, step labels and conditions.'),
N('49','insp-edge','A','Inspector · edge','Clicked the “authorize” edge.','Edge and its two endpoints get the selection ring. Inspector reuses the node layout: title, from/to, protocol, markdown description, owner, direction, tags, links, and the flows that use it.','Tab through fields · ⌫ on the canvas deletes the edge (with Undo toast).','A title is optional; an empty label renders no pill on the canvas.'),
N('50','insp-flow','A','Inspector · flow','Opened Place order without picking a step.','All flow edges show at equal weight with numbered badges. Inspector shows title, markdown description, owner, feature, tags, links and a summary.','↵ in the step list jumps to a step · ⌘↵ play from the start.','A flow with 0 steps shows the empty recording state (41).'),
N('51','insp-step','A','Inspector · step','Moved to step 4.','Step inspector adds condition, SLA target with meter, and attached rules on top of title, description, owner, tags.','← / → previous and next step.','SLA over target shows the meter in amber (85–100%) or clay (>100%) with an icon and text status.'),
N('52','edge-hover','B','Edges · hover handles','Hovered Order Service.','Four connection handles appear on the node’s sides; the one under the pointer grows and fills. Tooltip teaches the keyboard path.','Focus a node (Tab) to show the same handles · C starts keyboard connect (56).','Handles never appear in read-only (82) or flow mode.'),
N('53','edge-dragging','B','Edges · dragging','Dragged from the right handle.','A dashed orange ghost line follows the pointer. Bottom bar shows what release and Esc do.','Esc cancels · holding Space pans while dragging.','Releasing on empty canvas cancels silently; no edge is created.'),
N('54','edge-valid-target','B','Edges · valid target','Moved over Tracking Store.','Target gets a dashed orange ring and a + badge; the ghost snaps to the final route and becomes solid.','Release creates the edge and opens the inline popover (57).','—'),
N('55','edge-invalid-drop','B','Edges · invalid drop','Moved over Orders DB, which is already connected.','Target gets a dashed clay ring and a ban badge; the existing edge highlights. Tooltip explains.','Release does nothing · Esc cancels.','Self-connections show the same state with “A node can’t connect to itself”.'),
N('56','edge-keyboard','B','Edges · keyboard connect','Focused Order Service, pressed C and typed “tra”.','A “Connect to…” listbox opens next to the node with type-ahead. The highlighted option previews its edge on the canvas.','C open · type to filter · ↑↓ choose · ↵ create · Esc cancel.','No match: “No nodes match” with the query; nodes that would duplicate an edge are listed but disabled with “already connected”.'),
N('57','edge-popover','B','Edges · inline edit popover','Released on Tracking Store (or double-clicked an edge).','Small popover on the edge with label, protocol and direction. Changes apply live; the inspector mirrors them.','↵ or ⌘↵ close · Esc close without deleting · ⌫ in an empty label does nothing.','Label is optional. Delete removes the edge with an Undo toast.'),
N('58','multi-select','B','Multi-select · mixed values','Shift-clicked three services (or drew a marquee).','Selection frame with “3 selected”. Inspector shows shared fields; differing values show “Mixed” in italic. Tags on only some nodes are dashed with a count.','Shift+click add/remove · ⌘A select all in view · ⌫ delete selection.','Typing into a Mixed field sets that value on all selected nodes.'),
N('59','bulk-delete','B','Multi-select · deleted with Undo','Pressed ⌫.','Nodes and their 8 edges are removed. Toast “Deleted 3 nodes and 8 edges · Undo” stays 6 s (longer than usual toasts). Deck inspector flags new problems.','⌘Z or the toast button restores everything, including flow steps.','If the toast times out, ⌘Z still works.'),
N('60','problems','B','Problems list','Opened the deck inspector with nothing selected.','Problems section lists orphan nodes, broken flows, duplicate edges and steps with deleted edges. Affected nodes and flow rows get an amber triangle glyph; the canvas gets a “4 problems” button. Clicking a row selects the object.','↑↓ move through problems · ↵ select object · ⌘. jump to next problem from anywhere.','No problems: section shows “No problems” with a check icon and collapses to one line.'),
N('61','cloud-partner','B','Cloud and partner kinds','Opened Palette and dropped a Cloud resource.','Cloud resources use a neutral cloud tile with a provider text badge (AWS / GCP / AZURE); partners use a handshake tile with a PARTNER badge. No brand logos. Inspector adds provider, service, region and resource id.','Palette items: ↵ adds at canvas centre · arrows move the new node.','Unknown provider → “Other” with a free-text badge.'),
N('62','stickies','B','Sticky notes','Dragged Note onto Order Service, then added a free note.','Amber-soft 180 px notes with markdown. A pinned note shows a dotted leader and pin to its node and moves with it. Collapsed notes show one line with a chevron.','N add note at pointer · ↵ edit · Esc stop editing · ⌥C collapse/expand.','Empty note shows “Write a note…” placeholder and is deleted on blur if still empty.'),
N('63','stickies-flow','B','Sticky notes during a flow','Played Place order.','Notes dim to 35%. A note pinned to a node on the current step stays at full opacity. “Notes: dimmed” lets the user switch to shown or hidden.','—','Reduced motion: dimming applies instantly, no fade.'),
N('64','zoom-landscape','C','Semantic zoom · landscape','Zoomed out below 45%.','Groups become solid regions with large labels; nodes show only their kind tile; edges are faint.','⌘− zoom out · ⌘0 fit · level control shows 1 of 4 bars and “Landscape”.','Thresholds: Landscape ≤ 45% · System 46–90% · Container 91–150% · Component > 150% or drilled into a node.'),
N('65','zoom-system','C','Semantic zoom · system','Zoomed to 62% and hovered Core services.','Nodes show title only. Group label hover shows the drill hint.','Double-click or ↵ on a group label drills in.','—'),
N('66','zoom-container','C','Semantic zoom · container','Double-clicked Core services.','Only that group is shown. Nodes show title + tech. Breadcrumb adds the level; outline lists members and an “Up” row.','Esc or ⌫ up one level · double-click a node drills to components.','A group with no members shows the empty-canvas card scoped to that group.'),
N('67','zoom-component','C','Semantic zoom · component','Double-clicked Order Service.','Components render as full cards (title, tech, owner, tags, rule glyph). Connections to the outside show as dashed port pills at the edge.','Esc / ⌫ up · click a port pill jumps to that node one level up.','Node without components: “No components yet — add one from the palette”.'),
N('68','group-expanded','C','Collapsible group · expanded','Hovered the Core services label.','A chevron appears in the label; focus ring shows on keyboard focus.','Space or ↵ on the focused label toggles.','—'),
N('69','group-collapsed','C','Collapsible group · collapsed','Clicked the chevron.','Group becomes a node-sized stacked card with name and member count. Edges to each neighbour merge into one with a count pill (×5, ×2) and a direction icon.','Space expands · Tab focuses merged edges.','Collapse state is saved per view.'),
N('70','merged-edge-hover','C','Collapsible group · merged edge hover','Hovered the ×5 edge to API Gateway.','Merged edge darkens; popover lists the 5 underlying edges with label and direction.','↵ pins list · ↑↓ move · ↵ on a row expands and selects that edge.','—'),
N('71','flow-collapsed','C','Collapsible group · flow through it','Played Place order at step 5.','Steps inside the group light the card (ring + pulsing dot) and the player says “inside Core services”. Merged edges on the path carry step badges.','Space expands the group while playing.','Reduced motion: dot is static, no pulse.'),
N('72','new-folder-empty','D','New folder · empty name','Clicked New folder and pressed Create with no name.','Dialog shows a clay border (1.5 px) and an inline message with an icon.','↵ create · Esc cancel · focus stays in the field.','—'),
N('73','new-folder-duplicate','D','New folder · duplicate name','Typed “Logistics”.','Same inline error, specific message. Check is case-insensitive and trims spaces.','—','—'),
N('74','folder-menu','D','Folder menu · delete','Right-clicked Archive (or Shift+F10 on the focused row).','Context menu with Rename, Export folder and Delete folder.','↑↓ move · ↵ choose · Esc close.','—'),
N('75','folder-rename','D','Folder deleted + rename','Deleted Archive, then pressed F2 on Payments.','Archive’s deck moved to Unfiled; toast offers Undo. Payments row turns into an inline field.','↵ save · Esc cancel.','Empty or duplicate names show the same inline error as 72/73 under the field.'),
N('76','deck-menu-card','D','Deck menu on a card','Opened ⋯ on Warehouse Operations and hovered Move to folder.','Card gets a hover shadow; menu and submenu open. Current folder is checked.','Shift+F10 or ⋯ opens · → opens submenu · ← closes it.','—'),
N('77','deck-menu-row','D','Deck menu on a list row + delete','Deleted Payments Ledger from its row menu, then opened Fleet Telemetry’s menu.','No confirm dialog. The row disappears and a toast offers Undo for 6 s.','⌘Z also restores.','—'),
N('78','recent','D','Recent decks','Default library.','Sidebar shows the 8 most recently opened decks with relative times.','↵ on a row opens the deck.','—'),
N('79','recent-empty','D','Recent · empty','First visit, nothing opened yet.','Recent shows a dashed placeholder explaining what will appear.','—','—'),
N('80','storage-off','D','Storage · off + Safari warning','Library in Safari with persistent storage not granted.','Storage card says Off with a button to request it. An amber banner explains Safari’s 7-day rule and offers a backup.','Tab to Request / Export.','If the browser declines, the card shows “Browser declined. Try again after installing the app.”'),
N('81','storage-on','D','Storage · on','Clicked “Request persistent storage” and the browser granted it.','Card switches to On with a shield icon; green is used only here (success). Toast confirms.','—','—'),
N('82','second-tab','D','Deck open in another tab','Opened the same deck in a second tab.','Amber banner under the top bar; autosave status becomes “Read-only”; inspector fields are greyed; handles and palette are disabled. Selecting and exporting still work.','“Use here instead” takes the lock; the other tab then shows this banner.','—'),
N('83','autosave-saving','D','Autosave · saving','Renamed a node.','Status shows a loader and “Saving…” ~650 ms after the last edit.','⌘S forces a save.','Reduced motion: the loader icon doesn’t spin.'),
N('84','autosave-saved','D','Autosave · saved','Save finished.','Status returns to “Saved in this browser” with a check.','—','—'),
N('85','autosave-error','D','Autosave · error','A save failed (storage quota).','Status becomes a clay pill “Couldn’t save — export a backup” with an Export button; a popover explains and offers export and retry.','⌘S retry · Esc closes popover (status stays).','The error clears only after a successful save.')];
const cache={};
function build(id,theme){const k=id+theme;if(cache[k])return cache[k];const f=ST[id];if(!f)return null;const s=f();s.theme=theme;finalize(s,theme);cache[k]=s;return s;}
const TYPES=['tabs','sect','back','filter','row','step','branch','dashed','note','empty','pal','btns','kbdl','field','store','grow','rule','text','head','input','two','md','chips','links','cond','sla','rows','stats','seg','kv','toggle','phd'];
const D={t:'',sub:'',meta:'',icon:'',ist:{},st:{},vst:{},parts:[],items:[],acts:[],lines:[],right:[],n:'',dst:{},lab:'',grip:false,rm:false,err:false,warn:false,v:'',ph:'',focus:false,title:'',body:'',kbd:'',k:'',tile:{},check:false,help:'',errT:'',msub:'',tail:'',li:false,fillSt:{},tickSt:{},stateSt:{},trackSt:{},knobSt:{},sep:false,item:false,inv:false,row:false};
function norm(o,top){if(!o||typeof o!=='object')return o;const r=Object.assign({},D,o);if(top){TYPES.forEach(t=>{r[t]=!!o[t];});r.wrap=!o.head;r.hasLab=!!r.lab;}
 ['parts','items','acts','lines','right'].forEach(k=>{r[k]=(r[k]||[]).map(x=>norm(x,false));});
 r.hasActs=r.acts.length>0;r.hasRight=r.right.length>0;r.item=!r.sep;r.plain=!r.inv;
 if(top&&o.kbdl) r.kst={display:'flex',flexDirection:o.inline?'row':'column',gap:o.inline?14:5,padding:o.inline?0:'6px 6px',flexWrap:'wrap'};
 return r;}
function finalize(s,theme){s.isEditor=s.screen==='editor';s.isLibrary=s.screen==='library';
 s.rootStyle=Object.assign({},TH[theme],{width:1440,height:900,display:'flex',flexDirection:'column',background:'var(--app)',color:'var(--tx)',fontFamily:"'Geist',system-ui,sans-serif",fontSize:13,position:'relative',overflow:'hidden',WebkitFontSmoothing:'antialiased',boxSizing:'border-box',colorScheme:theme});
 s.left=(s.left||[]).map(b=>norm(b,true));s.insp=(s.insp||[]).map(b=>norm(b,true));
 s.pops=(s.pops||[]).map(p=>({st:p.st,blocks:p.blocks.map(b=>norm(b,true))}));
 s.menus=(s.menus||[]).map(m=>({st:m.st,items:m.items.map(x=>norm(x,false))}));
 s.hasToast=!!s.toast;s.toast=s.toast||{icon:'',t:'',act:'',kbd:'',st:{},ast:{}};
 s.leftSt={width:s.isLibrary?236:264,flex:'none',borderRight:'1px solid var(--bd)',background:'var(--s)',display:'flex',flexDirection:'column',minHeight:0,padding:s.isLibrary?'14px 12px':'10px 10px 12px',gap:2,overflow:'hidden',boxSizing:'border-box'};
 s.top=s.top||TOP();s.top.chipActs=(s.top.chipActs||[]).map(x=>norm(x,false));
 s.hasBanner=!!s.banner;s.banner=norm(s.banner||{},false);
 s.themeIcon=theme==='dark'?'sun':'moon';
 if(s.lib){s.lib.hasBanner=!!s.lib.banner;s.lib.banner=norm(s.lib.banner||{},false);}
 else s.lib={title:'',sub:'',grid:false,list:false,cards:[],hasBanner:false,banner:norm({},false)};
 if(!s.cv) s.cv=deck();if(!s.json) s.json=J0;
 const cv=s.cv;cv.stickies.forEach(k=>k.lines=k.lines.map(l=>norm(l,false)));cv.pl=Object.assign({title:'',sub:'',icon:'play',speed:'1×',segs:[],hasBr:false,br:[],st:{}},cv.pl);cv.pl.br=cv.pl.br.map(x=>norm(x,false));
 cv.tr=cv.tr.map(x=>norm(x,false));
 s.json.tabs=s.json.tabs.map(x=>norm(x,false));}
window.SODO_ST={build,LIST,TH};
window.SODO_ICONS=function(root){const L=window.lucide;if(!L||!L.icons||!root)return false;
 root.querySelectorAll('[data-i]').forEach(el=>{const n=el.getAttribute('data-i')||'';if(el.getAttribute('data-f')===n)return;el.setAttribute('data-f',n);if(!n){el.innerHTML='';return;}
  const key=n.split('-').map(s=>s? s[0].toUpperCase()+s.slice(1):'').join('');let node=L.icons[key];
  if(!node){const M=(window.__missIcons=window.__missIcons||{});if(!M[n]){M[n]=1;console.warn('missing icon',n);}el.innerHTML='<svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="8"/></svg>';return;}
  let kids=node;if(node[0]==='svg')kids=node[2]||[];
  const inner=kids.map(([tag,attrs])=>'<'+tag+' '+Object.keys(attrs||{}).filter(a=>a!=='key').map(a=>a+'="'+attrs[a]+'"').join(' ')+'/>').join('');
  el.innerHTML='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="display:block">'+inner+'</svg>';});
 return true;};
return true;}
if(!init()){const t=setInterval(()=>{if(init())clearInterval(t);},50);}
})();
