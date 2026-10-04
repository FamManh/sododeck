(function(){
function init(){
const S=window.SODO,ST=window.SODO_ST;if(!S||!ST||!ST.TH)return false;
const W=S.W,H=S.H,LANE=S.LANE,mono="'Geist Mono',ui-monospace,monospace",geist="'Geist',system-ui,sans-serif";
// ---------- card colour tokens
const HUES=[['red',27],['orange',55],['amber',80],['yellow',102],['lime',130],['green',152],['teal',182],['cyan',215],['blue',255],['indigo',278],['violet',302],['pink',350],['slate',255]];
const CARDS=HUES.map(([n,h])=>{const sl=n==='slate';return {n,h,
 lf:`oklch(${sl?.94:.95} ${sl?.012:.045} ${h})`,ls:`oklch(${sl?.55:.62} ${sl?.03:.15} ${h})`,
 df:`oklch(${sl?.30:.31} ${sl?.015:.055} ${h})`,ds:`oklch(${sl?.66:.72} ${sl?.03:.13} ${h})`};});
const CV={light:{},dark:{}};CARDS.forEach(c=>{CV.light['--card-'+c.n+'-fill']=c.lf;CV.light['--card-'+c.n+'-stroke']=c.ls;CV.dark['--card-'+c.n+'-fill']=c.df;CV.dark['--card-'+c.n+'-stroke']=c.ds;});
const TH={light:Object.assign({},ST.TH.light,CV.light,{'--seltx':'rgba(242,102,28,.26)','--marq':'rgba(242,102,28,.07)'}),dark:Object.assign({},ST.TH.dark,CV.dark,{'--seltx':'rgba(240,122,50,.36)','--marq':'rgba(240,122,50,.09)'})};
const CUSTOM=[['Navy','#1F2A44'],['Sand','#E8D5B7'],['Mint','#C9E7DC']];
const cap=s=>s[0].toUpperCase()+s.slice(1);
function lum(hex){const v=[1,3,5].map(i=>parseInt(hex.substr(i,2),16)/255).map(c=>c<=.03928?c/12.92:Math.pow((c+.055)/1.055,2.4));return .2126*v[0]+.7152*v[1]+.0722*v[2];}
const fillV=v=>v[0]==='#'?v:'var(--card-'+v+'-fill)',strokeV=v=>v[0]==='#'?v:'var(--card-'+v+'-stroke)';
// ---------- icons / kinds
const LI={smartphone:'smartphone',local_shipping:'truck',dashboard:'layout-dashboard',router:'router',key:'key-round',receipt_long:'receipt',photo_camera:'camera',my_location:'locate-fixed',notifications:'bell',sell:'tag',credit_card:'credit-card',hub:'network',route:'route',swap_horiz:'arrow-left-right',database:'database',timeline:'activity',bolt:'zap',map:'map',sms:'message-square',payments:'wallet'};
const KI={service:'box',data:'database',queue:'arrow-left-right',edge:'router',client:'monitor-smartphone',external:'cloud'};
const KIND=S.KIND,KT=S.KT;
const ic=(s,x)=>Object.assign({width:s,height:s,display:'inline-flex',flex:'none'},x||{});
const tileS=(k,s)=>{const t=KT[k]||KT.client;return {width:s,height:s,flex:'none',borderRadius:Math.round(s*.3),background:t[0],color:t[1],display:'flex',alignItems:'center',justifyContent:'center'};};
const FOC={outline:'2px solid var(--ac)',outlineOffset:2};
const FLOAT='0 8px 28px var(--sh), 0 1px 2px var(--sh)';
// ---------- primitives
const KBD={font:'500 10.5px/1 '+mono,color:'var(--mu)',marginLeft:'auto',paddingLeft:14,whiteSpace:'nowrap'};
function cell(o){o=o||{};const t=o.t==null?'':String(o.t);return {st:Object.assign({display:'flex',alignItems:'center',gap:6,flex:'none',minWidth:0},o.st||{}),
 hasTile:!!o.tile,tileSt:o.tileSt||{},tileIcon:o.tile||'',tileIst:ic(o.tsz||15),icon:o.icon||'',ist:o.ist||ic(o.isz||16),
 t,tst:Object.assign({whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',minWidth:0},o.tst||{}),t2:o.t2||'',t2st:Object.assign({fontSize:11.5,color:'var(--mu)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'},o.t2st||{}),
 wst:Object.assign({display:'flex',flexDirection:'column',gap:2,minWidth:0,flex:1},o.wst||{}),one:!o.t2&&t!=='',two:!!o.t2,
 segs:(o.segs||[]).map(g=>({t:g.t||'',icon:g.icon||'',ist:g.ist||ic(14),st:g.st||{}})),el:o.el||null,pre:o.pre||null,kbd:o.kbd||'',kst:Object.assign({},KBD,o.kst||{}),chev:o.chev||'',cst:o.cst||ic(14,{color:'var(--mu)'})};}
const row=(cells,st)=>({st:Object.assign({display:'flex',alignItems:'center',gap:2},st||{}),cells:(cells||[]).map(cell)});
const panel=(st,rows)=>({st:Object.assign({position:'absolute',background:'var(--s)',border:'1px solid var(--bd)',borderRadius:12,boxShadow:'0 1px 2px var(--sh)',color:'var(--tx)',zIndex:20},st),rows:rows||[]});
const tw=(t,px)=>Math.round(String(t||'').length*(px||7));
function ib(icon,o){o=o||{};const h=o.h||34,isz=o.isz||18;const w=o.t?(8+isz+6+tw(o.t)+10+(o.chev?20:0)):(o.w||h);
 return {icon,ist:ic(isz),t:o.t,tst:Object.assign({fontSize:12.5},o.tst||{}),chev:o.chev,cst:ic(14,{color:'var(--mu)'}),kbd:o.kbd,_w:w,
  st:Object.assign({height:h,minWidth:o.w||h,padding:o.t?'0 10px 0 8px':0,justifyContent:'center',borderRadius:8,color:o.on?'var(--act)':'var(--tx2)',background:o.on?'var(--acs)':o.hover?'var(--s2)':'transparent',fontWeight:o.on?500:400,gap:6,position:'relative'},o.focus?FOC:{},o.dis?{opacity:.4}:{},o.x||{})};}
const dv=v=>v?{st:{width:22,height:1,background:'var(--bd)',margin:'4px auto'},_w:22}:{st:{width:1,height:20,background:'var(--bd)',margin:'0 4px'},_w:9};
const PRIM=(icon,t,x)=>({icon,ist:ic(16),t,tst:{fontSize:13,fontWeight:500},_w:t?(10+16+6+tw(t)+13):34,st:Object.assign({height:34,padding:t?'0 13px 0 10px':0,minWidth:34,justifyContent:'center',borderRadius:8,background:'var(--ac)',color:'var(--onac)',gap:6},x||{})});
const SEC=(icon,t,kbd,x)=>({icon,ist:ic(15),t,tst:{fontSize:12.5,fontWeight:500},kbd,kst:{marginLeft:4,paddingLeft:6},st:Object.assign({height:32,padding:'0 11px 0 9px',borderRadius:9,border:'1px solid var(--bd2)',background:'var(--s)',color:'var(--tx)',gap:6},x||{})});
const LAB=(t,x)=>({t,tst:{fontSize:11,letterSpacing:'.07em',fontWeight:500,color:'var(--mu)'},st:Object.assign({width:'100%'},x||{})});
const TXT=(t,x,tx)=>({t,tst:Object.assign({whiteSpace:'normal',textWrap:'pretty',overflow:'visible',fontSize:12,lineHeight:1.5,color:'var(--tx2)'},tx||{}),st:Object.assign({width:'100%'},x||{})});
const inp=(v,o)=>{o=o||{};return {t:v||o.ph||'',icon:o.icon,ist:ic(15,{color:'var(--mu)'}),tst:Object.assign({flex:1,color:v?'var(--tx)':'var(--mu)',fontStyle:o.mixed?'italic':'normal'},o.mono?{fontFamily:mono,fontSize:12}:{},o.mixed?{color:'var(--mu)'}:{}),chev:o.chev,tile:o.tile,tileSt:o.tileSt,tsz:12,segs:o.segs,
 st:Object.assign({height:o.h||36,border:'1px solid '+(o.focus?'var(--ac)':'var(--bd2)'),borderRadius:10,padding:'0 11px',width:o.w||'100%',fontSize:13,background:'var(--s)',gap:8,flex:'none'},o.x||{})};};
const chip=(t,o)=>{o=o||{};return {t,kbd:o.meta,kst:{marginLeft:2,paddingLeft:4,fontSize:10.5},chev:o.x===false?'':'x',cst:ic(13,{color:'var(--tx2)'}),tst:{fontSize:12},st:{height:26,padding:'0 7px 0 10px',borderRadius:999,background:o.part?'transparent':'var(--s2)',border:o.part?'1px dashed var(--tx2)':'1px solid transparent',gap:4}};};
const addChip=t=>({icon:'plus',ist:ic(13),t:t||'Add tag',tst:{fontSize:12},st:{height:26,padding:'0 10px 0 7px',borderRadius:999,border:'1px dashed var(--bd2)',color:'var(--tx2)',gap:4}});
const HR=()=>row([],{height:1,background:'var(--bd)',margin:'5px -6px',flex:'none'});
const tip=(x,y,t,kbd,o)=>panel(Object.assign({left:x,top:y,background:'var(--ink)',color:'var(--inkt)',border:'none',borderRadius:8,padding:'6px 9px',boxShadow:'0 4px 14px var(--sh)',zIndex:70},o||{}),[row([{t,tst:{fontSize:12,fontWeight:500},kbd,kst:{color:'var(--inkt)',opacity:.72,paddingLeft:10}}],{gap:0})]);
const pill=(x,y,parts,o)=>panel(Object.assign({left:x,top:y,background:'var(--ink)',color:'var(--inkt)',border:'none',borderRadius:999,padding:'0 12px',height:30,display:'flex',alignItems:'center',boxShadow:'0 4px 14px var(--sh)',zIndex:65},o||{}),[row(parts.map(p=>typeof p==='string'?{t:p,tst:{fontSize:12}}:p),{gap:10})]);
const K=(k,t)=>({t,tst:{fontSize:12},segs:[],kbd:'',icon:'',st:{gap:6},_k:k});
function kp(k,t){return {t,tst:{fontSize:12,opacity:.85},st:{gap:6,flexDirection:'row-reverse'},kbd:k,kst:{color:'inherit',marginLeft:0,paddingLeft:0,font:'500 10.5px/1 '+mono,padding:'3px 5px',borderRadius:4,background:'rgba(127,127,127,.28)'}};}
// ---------- routing
function rp(pts,r){r=r||8;const p=[pts[0]];for(let i=1;i<pts.length;i++){const a=p[p.length-1],b=pts[i];if(Math.hypot(b[0]-a[0],b[1]-a[1])>.5)p.push(b);}
 let d='M'+p[0][0]+' '+p[0][1];for(let i=1;i<p.length-1;i++){const [px,py]=p[i-1],[x,y]=p[i],[nx,ny]=p[i+1];const l1=Math.hypot(x-px,y-py),l2=Math.hypot(nx-x,ny-y),rr=Math.min(r,l1/2,l2/2);d+=' L'+(x-(x-px)/l1*rr)+' '+(y-(y-py)/l1*rr)+' Q'+x+' '+y+' '+(x+(nx-x)/l2*rr)+' '+(y+(ny-y)/l2*rr);}
 const e=p[p.length-1];d+=' L'+e[0]+' '+e[1];let best=0,bi=1;for(let i=1;i<p.length;i++){const l=Math.hypot(p[i][0]-p[i-1][0],p[i][1]-p[i-1][1]);if(l>best){best=l;bi=i;}}
 return {d,p,lx:(p[bi][0]+p[bi-1][0])/2,ly:(p[bi][1]+p[bi-1][1])/2,ex:e[0],ey:e[1]};}
function rt(a,b,noLane){const aw=a.w||W,ah=a.h||H,bw=b.w||W,bh=b.h||H,acx=a.x+aw/2,acy=a.y+ah/2,bcx=b.x+bw/2,bcy=b.y+bh/2;let pts;
 if(!noLane&&(a.kind==='queue'||b.kind==='queue')){const q=a.kind==='queue'?a:b,n=q===a?b:a,nw=n.w||W,nh=n.h||H,ny=n.y+nh/2,ex=n.x+nw/2<LANE?n.x+nw:n.x,lx=Math.min(Math.max(LANE,q.x+12),q.x+(q.w||W)-12);pts=[[ex,ny],[lx,ny],[lx,q.y]];if(q===a)pts.reverse();}
 else if(Math.abs(bcx-acx)<Math.max(aw,bw)){pts=bcy>acy?[[acx,a.y+ah],[acx,(a.y+ah+b.y)/2],[bcx,(a.y+ah+b.y)/2],[bcx,b.y]]:[[acx,a.y],[acx,(a.y+b.y+bh)/2],[bcx,(a.y+b.y+bh)/2],[bcx,b.y+bh]];}
 else if(bcx>acx){const gx=b.x-24;pts=[[a.x+aw,acy],[gx,acy],[gx,bcy],[b.x,bcy]];}
 else{const gx=b.x+bw+22;pts=[[a.x,acy],[gx,acy],[gx,bcy],[b.x+bw,bcy]];}
 return rp(pts);}
// ---------- world pieces
const wd=(st,t,icon,ist)=>({st:Object.assign({position:'absolute',zIndex:8},st),t:t||'',icon:icon||'',ist:ist||ic(13)});
function handles8(x,y,w,h,hot,off){off=off==null?3:off;const xs=[x-off,x+w/2,x+w+off],ys=[y-off,y+h/2,y+h+off],out=[];
 ys.forEach((cy,j)=>xs.forEach((cx,i)=>{if(i===1&&j===1)return;const isHot=hot&&hot[0]===i&&hot[1]===j;out.push(wd({left:cx-4,top:cy-4,width:8,height:8,borderRadius:2,background:isHot?'var(--ac)':'var(--s)',border:'1.5px solid var(--ac)',zIndex:9}));}));return out;}
function grp(g,m){const st={position:'absolute',left:g.x,top:g.y,width:g.w,height:g.h,border:'1px dashed var(--bd2)',borderRadius:16,background:'var(--grp)',zIndex:0};
 let lst={position:'absolute',left:14,top:10,fontSize:10.5,fontWeight:500,letterSpacing:'.08em',textTransform:'uppercase',color:'var(--mu)',display:'flex',alignItems:'center',gap:6,whiteSpace:'nowrap'},label=g.label,icon='',count=g.count||'';
 if(g.fill){st.background=fillV(g.fill);st.border='1px solid '+strokeV(g.fill);lst.color='var(--tx2)';}
 if(g.stroke){st.border='1.5px dashed '+strokeV(g.stroke);}
 if(m==='sel'){Object.assign(st,{border:'1.5px solid var(--ac)',boxShadow:'0 0 0 3px var(--acs)'});Object.assign(lst,{top:-12,left:12,height:24,padding:'0 10px',borderRadius:999,background:'var(--acs)',color:'var(--act)',border:'1px solid var(--ac)'});}
 if(m==='drag'){Object.assign(st,{border:'1.5px solid var(--ac)',boxShadow:'0 14px 36px var(--sh)',zIndex:4});Object.assign(lst,{top:-12,left:12,height:24,padding:'0 10px',borderRadius:999,background:'var(--acs)',color:'var(--act)',border:'1px solid var(--ac)'});icon='move';}
 if(m==='drop'){Object.assign(st,{border:'1.5px dashed var(--ac)',background:'var(--marq)'});Object.assign(lst,{top:-12,left:12,height:24,padding:'0 10px',borderRadius:999,background:'var(--ac)',color:'var(--onac)',letterSpacing:'.04em'});icon='corner-right-down';label='Drop into '+g.label;}
 if(m==='ghost'){Object.assign(st,{border:'1.5px dashed var(--mu)',background:'transparent',opacity:.5});label='';}
 if(m==='dim')st.opacity=.3;
 if(m==='focus')Object.assign(st,FOC);
 return {st,lst,label,count,icon,ist:ic(13)};}
function nd(n,o){o=o||{};const w=n.w||W,h=n.h||H;
 if(o.ghost)return {st:{position:'absolute',left:n.x,top:n.y,width:w,height:h,borderRadius:12,border:'1.5px dashed var(--mu)',opacity:.5,zIndex:1},tileOn:false,tile:{},icon:'',ist:{},tp:[],tst:{},sub:'',sst:{},rules:false,rst:{},decos:[]};
 let bg='var(--s)',bd='1px solid var(--bd2)',tx='var(--tx)',sub='var(--mu)',rc='var(--amt)';const tl=tileS(n.kind,30);
 if(o.fill){if(o.fill[0]==='#'){bg=o.fill;if(lum(o.fill)<.18){tx='#ffffff';sub='rgba(255,255,255,.78)';rc='#ffffff';tl.background='rgba(255,255,255,.14)';tl.color='#ffffff';}else{tx='#1c1c1a';sub='#55554f';rc='#6b4c0e';}}else{bg=fillV(o.fill);sub='var(--tx2)';}}
 if(o.stroke)bd='1.5px solid '+strokeV(o.stroke);
 const st={position:'absolute',left:n.x,top:n.y,width:w,height:h,borderRadius:12,background:bg,border:bd,boxShadow:'0 1px 2px var(--sh)',display:'flex',alignItems:'center',gap:9,padding:'0 10px',color:tx,zIndex:2};
 if(o.sel)Object.assign(st,{outline:'2px solid var(--ac)',outlineOffset:2});
 if(o.focus)Object.assign(st,{outline:'2px solid var(--ac)',outlineOffset:4});
 if(o.flow)Object.assign(st,{border:'1.5px solid var(--ac)',boxShadow:'0 0 0 3px var(--acs)'});
 if(o.err)Object.assign(st,{outline:'1.5px dashed var(--rdt)',outlineOffset:3});
 if(o.dim)st.opacity=.22;
 if(o.lift)Object.assign(st,{boxShadow:'0 16px 36px var(--sh), 0 2px 6px var(--sh)',zIndex:6});
 if(o.edit)st.border='1.5px solid var(--ac)';
 if(o.hover)st.boxShadow='0 3px 10px var(--sh)';
 const caret={t:'',st:{width:1.5,height:15,background:'var(--ac)',display:'inline-block',flex:'none',margin:'0 1px'}};
 let tp=[{t:n.title,st:{}}];if(o.edit==='all')tp=[{t:n.title,st:{background:'var(--seltx)',borderRadius:2}},caret];if(o.edit==='empty')tp=[caret,{t:'Name this component',st:{color:sub,fontWeight:400}}];
 const tst={fontSize:12.5,fontWeight:500,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',lineHeight:'17px'};
 if(o.edit)Object.assign(tst,{display:'flex',alignItems:'center',background:o.fill?'rgba(255,255,255,.5)':'var(--s2)',margin:'-2px -5px',padding:'2px 5px',borderRadius:5,boxShadow:'inset 0 0 0 1px var(--bd2)'});
 const decos=[];
 if(o.details)decos.push(wd({top:-10,right:-10,width:22,height:22,borderRadius:999,background:'var(--ink)',color:'var(--inkt)',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 1px 3px var(--sh)',border:'2px solid var(--cv)'},'','panel-right-open',ic(11)));
 if(o.step)decos.push(wd({top:-10,left:-10,width:22,height:22,borderRadius:999,background:'var(--ac)',color:'var(--onac)',display:'flex',alignItems:'center',justifyContent:'center',font:'600 10.5px/1 '+mono,border:'2px solid var(--cv)'},o.step));
 if(o.err)decos.push(wd({top:-10,right:-10,width:22,height:22,borderRadius:999,background:'var(--rdt)',color:'var(--s)',display:'flex',alignItems:'center',justifyContent:'center',border:'2px solid var(--cv)'},'','circle-alert',ic(12)));
 if(o.targets)[[w/2,0],[w,h/2],[w/2,h],[0,h/2]].forEach(([cx,cy],i)=>{const hot=o.targets===i+1;decos.push(wd(Object.assign({left:cx-(hot?7:5),top:cy-(hot?7:5),width:hot?14:10,height:hot?14:10,borderRadius:999,background:hot?'var(--ac)':'var(--s)',border:hot?'2px solid var(--s)':'1.5px solid var(--ac)'},hot?{boxShadow:'0 0 0 4px var(--acs)'}:{})));});
 (o.decos||[]).forEach(d=>decos.push(d));
 const iname=LI[n.icon]||n.icon||KI[n.kind]||'box';
 return {st,tileOn:true,tile:tl,icon:iname,ist:ic(16),tp,tst,sub:o.sub!=null?o.sub:(n.sub!=null?n.sub:n.tech||''),sst:{fontSize:11,color:sub,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'},rules:!!(n.rules&&n.rules.length)&&!o.edit,rst:ic(14,{color:rc}),decos};}
function edge(r,m,sw){const st={fill:'none',stroke:'var(--edge)',strokeWidth:sw||1.5},dst={fill:'var(--edge)'};
 if(m==='dim'){st.opacity=.14;dst.opacity=.14;}
 if(m==='flow'){st.stroke='var(--ac)';st.strokeWidth=2;st.opacity=.5;dst.fill='var(--ac)';dst.opacity=.5;}
 if(m==='cur'||m==='sel'){st.stroke='var(--ac)';st.strokeWidth=m==='cur'?2.75:2;dst.fill='var(--ac)';}
 if(m==='conn'){st.stroke='var(--tx2)';st.strokeWidth=1.75;dst.fill='var(--tx2)';}
 if(m==='ghost'){st.stroke='var(--mu)';st.strokeDasharray='4 4';st.opacity=.55;}
 if(m==='hot'){st.stroke='var(--ac)';st.strokeWidth=2;st.strokeDasharray='6 4';dst.fill='var(--ac)';}
 return {d:r.d,st,dst,dot:m!=='ghost',ex:r.ex,ey:r.ey,r:3};}
const elab=(x,y,t,m,badge)=>{const base={left:x,top:y,transform:'translate(-50%,-50%)',height:20,padding:'0 7px',borderRadius:999,font:'400 10.5px/1 '+mono,display:'flex',alignItems:'center',gap:5,whiteSpace:'nowrap',background:'var(--s)',border:'1px solid var(--bd2)',color:'var(--tx2)',zIndex:5};
 if(m==='cur')Object.assign(base,{background:'var(--ac)',border:'1px solid var(--ac)',color:'var(--onac)',fontWeight:500});
 if(m==='sel')Object.assign(base,{border:'1.5px solid var(--ac)',color:'var(--act)',background:'var(--acs)'});
 return wd(base,(badge?badge+'  ':'')+t);};
// ---------- scene
function base(th,vw,vh,z,ox,oy){const pitch=z<.75?44*z:22*z;return {vw,vh,z,ox,oy,theme:th,
 root:Object.assign({width:vw,height:vh,position:'relative',overflow:'hidden',background:'var(--cv)',color:'var(--tx)',fontFamily:geist,fontSize:13},TH[th]),
 dots:{position:'absolute',inset:0,backgroundImage:'radial-gradient(var(--dot) 1px,transparent 1.2px)',backgroundSize:pitch+'px '+pitch+'px',backgroundPosition:ox+'px '+oy+'px'},
 w:{st:{position:'absolute',left:0,top:0,width:10,height:10,transform:`translate(${ox}px,${oy}px) scale(${z})`,transformOrigin:'0 0'},groups:[],edges:[],nodes:[],decos:[]},panels:[]};}
const sp=(s,x,y)=>[Math.round(s.ox+x*s.z),Math.round(s.oy+y*s.z)];
function sampleWorld(s,o){o=o||{};const w=s.w;
 const N=S.NODES.map(n=>Object.assign({},n,{w:W,h:H},(o.pos||{})[n.id]||{}));(o.add||[]).forEach(n=>N.push(Object.assign({w:W,h:H,rules:[],tags:[]},n)));
 const by={};N.forEach(n=>by[n.id]=n);
 S.GROUPS.forEach(g=>{const gg=Object.assign({},g,(o.gpos||{})[g.id]||{});w.groups.push(grp(gg,(o.gst||{})[g.id]||o.gdef));});
 (o.ghostG||[]).forEach(g=>w.groups.unshift(grp(g,'ghost')));
 S.EDGES.forEach(e=>{if((o.hideE||[]).includes(e.id))return;const m=(o.est||{})[e.id]||o.edef;const r=(o.epath||{})[e.id]||rt(by[e.from],by[e.to]);w.edges.push(edge(r,m));
  const lm=(o.elab||{})[e.id];if(lm)w.decos.push(elab(r.lx,r.ly,e.label,lm,(o.ebadge||{})[e.id]));});
 (o.xedges||[]).forEach(x=>w.edges.push(edge(x.r,x.m)));
 (o.ghosts||[]).forEach(g=>w.nodes.push(nd(g,{ghost:true})));
 N.forEach(n=>{if((o.hide||[]).includes(n.id))return;w.nodes.push(nd(n,Object.assign({},o.ndef||{},(o.nst||{})[n.id]||{})));});
 return by;}
// dense deck
const DG=[['Clients','client',['Web App','iOS App','Android App','Driver App','Partner Portal','Ops Console','Store Kiosk']],
['Edge','edge',['CDN','WAF','API Gateway','BFF Web','BFF Mobile','Rate Limiter']],
['Identity','edge',['Auth Service','SSO Bridge','User Directory','Permissions','Session Store','MFA Service']],
['Orders','service',['Order Service','Cart','Checkout','Quote Engine','Promotions','Order History','Order Search','Subscriptions','Gift Cards']],
['Payments','service',['Pricing','Payment Service','Ledger','Refunds','Fraud Check','Invoicing','Payouts','Tax Engine']],
['Dispatch','service',['Dispatch','Route Optimizer','Driver Pool','ETA Service','Shift Planner','Geo Index','Capacity']],
['Tracking','service',['Tracking Ingest','Position Cache','Tracking Store','Geofence','Live Map WS','Telemetry']],
['Messaging','queue',['Event Bus','Order Topic','Delivery Topic','Dead Letters','Schema Registry','Outbox Relay','Stream Processor']],
['Notifications','service',['Notification Hub','Push Sender','SMS Sender','Email Sender','Templates','Preferences']],
['Warehouse','service',['WMS','Inventory','Pick & Pack','Slotting','Returns','Label Printing','Dock Scheduler','Cycle Count']],
['Data','data',['Orders DB','Payments DB','Inventory DB','Search Index','Object Storage','Redis Cluster','Tracking TSDB']],
['Analytics','data',['ETL Jobs','Metrics','BI Dashboards','Feature Store','ML Scoring','Reports','Data Lake']],
['Platform','service',['Service Mesh','Config Service','Secrets Vault','Feature Flags','Audit Log','Scheduler','Log Pipeline']],
['Partner integrations','external',['Carrier API','Marketplace Sync','EDI Gateway','Webhooks Out','Partner Auth','Catalog Feed']],
['External','external',['Stripe','Twilio','Google Maps','SendGrid','Tax Provider','Weather API']],
['Legacy ERP','service',['SAP Bridge','Finance Export','Master Data','Batch Jobs','Cost Codes','Vendor Sync','Contract Repo']]];
const GW=572,GH=264,GX=90,GY=100;
function mulberry(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
let DENSE=null;
function dense(){if(DENSE)return DENSE;const groups=[],nodes=[],edges=[],R=mulberry(7);
 DG.forEach(([label,kind,names],gi)=>{const c=gi%4,r=Math.floor(gi/4),gx=c*(GW+GX),gy=r*(GH+GY);
  const g={id:'g'+gi,label,x:gx,y:gy,w:GW,h:GH,count:String(names.length),n:[]};if(label==='Partner integrations')g.fill='teal';if(label==='Legacy ERP')g.stroke='red';groups.push(g);
  names.forEach((t,i)=>{const n={id:'n'+gi+'_'+i,kind,title:t,x:gx+18+(i%3)*186,y:gy+40+Math.floor(i/3)*78,w:W,h:H,tech:['Go','Java','Kotlin','Node.js','Python','Rust','PostgreSQL','Kafka'][Math.floor(R()*8)],rules:R()<.18?['r']:[]};
   if(label==='Analytics'&&i<3)n.fill='violet';if(label==='Partner integrations')n.fill='teal';if(label==='Legacy ERP')n.stroke='red';if(label==='Payments'&&i===1)n.fill='amber';
   if(kind==='queue')n.tech='Kafka';if(kind==='data')n.tech=['PostgreSQL','Redis','S3','Elastic'][i%4];nodes.push(n);g.n.push(n);});});
 groups.forEach((g,gi)=>{const ns=g.n;ns.forEach((n,i)=>{if(i%3!==2&&ns[i+1]&&R()<.62)edges.push([n,ns[i+1]]);if(ns[i+3]&&R()<.38)edges.push([n,ns[i+3]]);});
  const right=groups[gi+1],down=groups[gi+4];if(right&&gi%4!==3)for(let k=0;k<3;k++)edges.push([ns[Math.floor(R()*ns.length)],right.n[Math.floor(R()*right.n.length)]]);
  if(down)for(let k=0;k<2;k++)edges.push([ns[Math.floor(R()*ns.length)],down.n[Math.floor(R()*down.n.length)]]);});
 for(let k=0;k<18;k++){const a=nodes[Math.floor(R()*nodes.length)],b=nodes[Math.floor(R()*nodes.length)];if(a!==b)edges.push([a,b]);}
 DENSE={groups,nodes,edges};return DENSE;}
function denseWorld(s,o){o=o||{};const D=dense(),w=s.w;D.groups.forEach(g=>w.groups.push(grp(g,(o.gst||{})[g.id])));
 D.edges.forEach(([a,b])=>w.edges.push(edge(rt(a,b,true),null,s.z<1?2:1.5)));
 D.nodes.forEach(n=>{w.nodes.push(nd(n,Object.assign({fill:n.fill,stroke:n.stroke},(o.nst||{})[n.id]||{})));});return D;}
// ---------- chrome
const VIEWS=()=>['System','Feature','Infra'].map((t,i)=>({t,st:Object.assign({height:28,padding:'0 11px',borderRadius:8,display:'flex',alignItems:'center',fontSize:12.5,color:'var(--tx2)',whiteSpace:'nowrap'},i===0?{background:'var(--s)',boxShadow:'0 1px 2px var(--sh)',color:'var(--tx)',fontWeight:500}:{})})).concat([{icon:'plus',ist:ic(15),st:{width:28,height:28,display:'flex',alignItems:'center',justifyContent:'center',color:'var(--tx2)'}}]);
const badgeRow=n=>row([{t:String(n),tst:{font:'600 11px/1 '+geist,color:'var(--onac)'},st:{width:20,height:20,justifyContent:'center'}}],{position:'absolute',top:-11,left:-11,borderRadius:999,background:'var(--ac)',border:'2px solid var(--cv)',zIndex:3});
function island(pos,cells,o){o=o||{};const rows=[row(cells,o.col?{flexDirection:'column',gap:2}:{})];if(o.badge)rows.push(badgeRow(o.badge));
 return panel(Object.assign({padding:4,display:'flex',flexDirection:o.col?'column':'row',alignItems:'center'},o.focus?FOC:{},o.ghostRing?{outline:'1.5px dashed var(--ac)',outlineOffset:3}:{},pos),rows);}
function railTop(vh){return Math.round((vh-486)/2);}
function chrome(s,o){const vw=s.vw,vh=s.vh,cp=!!o.compact,P=s.panels,B=o.badges||{};
 if(o.hideUI){P.push(panel({right:12,bottom:12,height:34,padding:'0 12px 0 10px',borderRadius:999,display:'flex',alignItems:'center',boxShadow:FLOAT},[row([{icon:'eye',ist:ic(15,{color:'var(--tx2)'}),t:'Show UI',tst:{fontSize:12.5,fontWeight:500}},{kbd:'⌘\\',kst:{marginLeft:4,paddingLeft:4}}],{gap:6})]));return;}
 const sv=o.save||'saved';
 const tl=[ib('menu',{on:o.menuOpen}),{t:o.deck||'Logistics Delivery',tst:{fontSize:13.5,fontWeight:500,maxWidth:cp?104:260},st:{height:34,padding:'0 4px 0 6px',borderRadius:8}},
  {icon:sv==='saving'?'loader-circle':sv==='error'?'circle-alert':'circle-check',ist:ic(15,{color:sv==='error'?'var(--rdt)':'var(--mu)'}),st:{width:24,height:34,justifyContent:'center'}},dv()];
 if(cp)tl.push({icon:'layers',ist:ic(15,{color:'var(--tx2)'}),t:'System',tst:{fontSize:12.5,fontWeight:500},chev:'chevron-down',st:{height:34,padding:'0 8px',borderRadius:8,gap:6}});
 else tl.push({segs:VIEWS(),st:{height:34,padding:3,gap:2,borderRadius:10,background:'var(--s2)'}});
 if(o.flowChip)tl.push({icon:'waypoints',ist:ic(14),t:cp?'':'Flow · '+o.flowChip,tst:{fontSize:12.5,fontWeight:500},chev:'x',cst:ic(14),st:{height:30,padding:'0 8px 0 10px',marginLeft:6,borderRadius:999,background:'var(--acs)',color:'var(--act)',gap:6,border:'1px solid var(--ac)'}});
 P.push(island({left:12,top:12},tl,{badge:B.tl,focus:o.focus==='tl'}));
 const tr=[];
 if(cp)tr.push(ib('search'));else tr.push({icon:'search',ist:ic(15),t:'Jump to…',tst:{fontSize:12.5,flex:1},kbd:'⌘K',kst:{padding:'4px 6px',borderRadius:6,background:'var(--s)',border:'1px solid var(--bd2)',color:'var(--tx2)',font:'500 10.5px/1 '+mono},st:{height:34,width:176,borderRadius:8,background:'var(--s2)',color:'var(--mu)',padding:'0 5px 0 10px',gap:8,marginRight:2}});
 tr.push(ib('tag',{t:cp?'':'Labels',on:o.labels}),ib('focus',{t:cp?'':'Focus',on:o.focusMode}),dv(),ib(s.theme==='dark'?'sun':'moon'),cp?PRIM('share',''):PRIM('share','Export',{marginLeft:2}));
 P.push(island({right:12,top:12},tr,{badge:B.tr,focus:o.focus==='tr'}));
 const rt0=railTop(vh),tool=o.tool||'select',pan=o.pan||'';
 const rail=[ib('mouse-pointer-2',{w:38,h:38,on:tool==='select',hover:o.railHover==='select'}),ib('square-plus',{w:38,h:38,on:tool==='add',hover:o.railHover==='add'}),ib('sticky-note',{w:38,h:38,on:tool==='sticky'}),ib('group',{w:38,h:38,on:tool==='group'}),ib('spline',{w:38,h:38,on:tool==='conn'}),dv(true),
  ib('list-tree',{w:38,h:38,on:pan==='outline'}),ib('waypoints',{w:38,h:38,on:pan==='flows'}),ib('table',{w:38,h:38,on:pan==='rules'}),ib('search',{w:38,h:38,on:pan==='search'})];
 P.push(island({left:12,top:rt0,width:48},rail,{col:true,badge:B.rail,focus:o.focus==='rail'}));
 P.push(island({left:12,top:rt0+398,width:48},[ib('undo-2',{w:38,h:38}),ib('redo-2',{w:38,h:38,dis:true})],{col:true,badge:B.undo}));
 const zr=o.zoomRight||12,zb=o.zoomBottom||12;
 P.push(island({right:zr,bottom:zb},[ib('maximize',{h:32,isz:16}),dv(),ib('minus',{h:32,isz:16}),{t:Math.round(s.z*100)+'%',tst:{font:'400 11.5px '+mono,color:'var(--tx2)'},st:{width:44,justifyContent:'center'}},ib('plus',{h:32,isz:16}),dv(),ib('map',{h:32,isz:16,on:!!o.mm}),ib('circle-help',{h:32,isz:16})],{badge:B.zoom,focus:o.focus==='zoom'}));
 if(o.mm)P.push(minimap(s,zr,zb+48));}
function minimap(s,r,b){const D=s._mm;const rows=[];if(!D)return panel({right:r,bottom:b,width:182,height:112},[]);
 const f=Math.min(170/D.w,100/D.h),offx=(172-D.w*f)/2,offy=(102-D.h*f)/2;const cells=[];
 D.groups.forEach(g=>cells.push({st:{position:'absolute',left:offx+g.x*f,top:offy+g.y*f,width:g.w*f,height:g.h*f,borderRadius:3,background:'var(--s2)'}}));
 D.nodes.forEach(n=>cells.push({st:{position:'absolute',left:offx+n.x*f,top:offy+n.y*f,width:Math.max(2,W*f),height:Math.max(1.5,H*f),borderRadius:1,background:n.sel?'var(--ac)':'var(--bd2)'}}));
 const vx=-s.ox/s.z,vy=-s.oy/s.z,vw=s.vw/s.z,vh=s.vh/s.z;cells.push({st:{position:'absolute',left:offx+Math.max(0,vx)*f-2,top:offy+Math.max(0,vy)*f-2,width:Math.min(D.w,vw)*f+4,height:Math.min(D.h,vh)*f+4,borderRadius:3,border:'1.5px solid var(--ac)'}});
 return panel({right:r,bottom:b,width:182,height:112,padding:5,boxShadow:FLOAT},[row(cells,{position:'relative',width:172,height:102})]);}
function E(th,o){o=o||{};const vw=o.vw||1440,vh=o.vh||900;const s=base(th,vw,vh,o.z||1,o.ox!=null?o.ox:190,o.oy!=null?o.oy:140);
 if(o.world)o.world(s);chrome(s,o);(o.extra?o.extra(s):[]).forEach(p=>s.panels.push(p));return s;}
// ---------- toolbar
function tbar(s,left,top,cells,o){o=o||{};const pos=[];let x=4;cells.forEach(c=>{pos.push(x);x+=(c._w||34)+2;});
 const p=panel({left,top,padding:4,display:'flex',zIndex:30,boxShadow:'0 4px 16px var(--sh), 0 1px 2px var(--sh)'},[row(cells)]);return {p,bx:i=>left+pos[i],w:x+4};}
const SW=(val,type,on,mixed)=>{let seg;if(type==='stroke')seg={width:18,height:18,borderRadius:999,border:'3px solid '+(val?strokeV(val):'var(--bd2)'),display:'block',boxSizing:'border-box'};
 else seg={width:18,height:18,borderRadius:999,background:mixed?'conic-gradient(var(--card-teal-fill) 0 33%,var(--card-amber-fill) 0 66%,var(--s3) 0)':val?fillV(val):'linear-gradient(135deg,transparent 43%,var(--rdt) 43%,var(--rdt) 57%,transparent 57%), var(--s)',border:mixed?'1px dashed var(--tx2)':'1px solid '+(val?strokeV(val):'var(--bd2)'),display:'block',boxSizing:'border-box'};
 return {segs:[{st:seg}],_w:34,st:{width:34,height:34,justifyContent:'center',borderRadius:8,background:on?'var(--acs)':'transparent'}};};
function tbComp(n,o){o=o||{};const k=n.kind,kn=o.kindT||KIND[k];
 return [ib('panel-right-open'),dv(),{tile:LI[n.icon]||KI[k],tileSt:tileS(k,22),tsz:13,t:kn,tst:{fontSize:12.5,fontStyle:o.mixed?'italic':'normal'},chev:'chevron-down',_w:7+22+7+tw(kn)+20+6,st:{height:34,padding:'0 6px 0 7px',borderRadius:8,gap:7}},dv(),
  SW(o.fill,'fill',o.pop==='fill',o.mixedFill),SW(o.stroke,'stroke',o.pop==='stroke'),dv(),ib('user-round',{on:o.pop==='owner'}),ib('tag',{on:o.pop==='tags'}),ib('cpu'),ib('link'),ib('table')];}
function popP(left,top,w,rows,x){return panel(Object.assign({left,top,width:w,padding:6,display:'flex',flexDirection:'column',gap:2,boxShadow:'0 12px 32px var(--sh), 0 1px 2px var(--sh)',zIndex:40},x||{}),rows);}
// ---------- menus
function menu(x,y,items,o){o=o||{};const rows=items.map(it=>{if(it==='-')return HR();const t=it[0],kbd=it[1],f=it[2]||{};
 const col=f.dis?'var(--mu)':f.danger?'var(--rdt)':'var(--tx)';
 return row([{icon:f.icon||'',ist:ic(15,{color:f.danger?'var(--rdt)':'var(--tx2)'}),tile:f.tile,tileSt:f.tile?tileS(f.kind,20):{},tsz:12,t,tst:{flex:1,color:col},kbd:kbd||'',kst:{opacity:f.dis?.6:1},chev:f.sub?'chevron-right':'',cst:ic(14,{color:'var(--tx2)',marginLeft:kbd?6:'auto'}),st:{flex:1,gap:9}}],
  Object.assign({height:30,padding:'0 8px 0 10px',borderRadius:7,fontSize:13,flex:'none'},f.on?{background:'var(--s2)'}:{},f.focus?{outline:'2px solid var(--ac)',outlineOffset:-2,background:'var(--s2)'}:{}));});
 return panel({left:x,top:y,width:o.w||252,padding:6,display:'flex',flexDirection:'column',boxShadow:'0 12px 32px var(--sh), 0 1px 2px var(--sh)',zIndex:o.z||45},rows);}
// ---------- flyouts
function flyout(s,title,rows,o){o=o||{};const head=row([{t:title,tst:{fontSize:13.5,fontWeight:500},st:{flex:1}},ib('pin',{h:28,isz:15,on:o.pinned}),ib('x',{h:28,isz:15})],{height:46,padding:'0 8px 0 14px',borderBottom:'1px solid var(--bd)',flex:'none'});
 return panel({left:68,top:68,width:280,maxHeight:s.vh-80,height:o.h,padding:0,display:'flex',flexDirection:'column',overflow:'hidden',boxShadow:FLOAT,zIndex:25},[head].concat(rows));}
const search=(ph,v)=>row([{icon:'search',ist:ic(15,{color:'var(--mu)'}),t:v||ph,tst:{fontSize:12.5,color:v?'var(--tx)':'var(--mu)'},st:{height:32,flex:1,borderRadius:9,background:'var(--s2)',padding:'0 10px',gap:8}}],{padding:'10px 10px 6px',flex:'none'});
const microRow=(t,meta)=>row([{t,tst:{fontSize:11,letterSpacing:'.07em',fontWeight:500,color:'var(--mu)'},st:{flex:1},kbd:meta,kst:{font:'400 11px '+geist}}],{padding:'10px 16px 6px',flex:'none'});
function paletteRows(hot){const kinds=[['service','Service','API or worker','1'],['data','Database','Store, cache','2'],['queue','Queue','Topic, stream','3'],['edge','Gateway','Ingress, auth','4'],['client','Client','App, console','5'],['external','External','Vendor, SaaS','6']];
 const card=(k,t,sub,key,icon,on)=>({tile:icon||KI[k],tileSt:k?tileS(k,28):{width:28,height:28,borderRadius:8,background:'var(--s2)',color:'var(--tx2)',display:'flex',alignItems:'center',justifyContent:'center'},tsz:16,t,t2:sub,tst:{fontSize:12.5,fontWeight:500},kbd:key,kst:{position:'absolute',top:9,right:9,marginLeft:0,paddingLeft:0,padding:'3px 5px',borderRadius:5,border:'1px solid var(--bd2)',background:'var(--s2)',color:'var(--tx2)'},
  st:Object.assign({position:'relative',width:122,height:78,flexDirection:'column',alignItems:'flex-start',gap:8,padding:10,borderRadius:10,border:'1px solid var(--bd)',background:'var(--s)'},on?{background:'var(--acs)',border:'1px solid var(--ac)'}:{}),wst:{gap:1}});
 return [search('Search components'),microRow('COMPONENTS'),row(kinds.map(([k,t,sub,key])=>card(k,t,sub,key,null,hot===k)),{flexWrap:'wrap',gap:8,padding:'0 12px',flex:'none'}),
  microRow('ANNOTATE'),row([card('','Sticky note','Free or pinned','S','sticky-note'),card('','Group','Boundary','G','group')],{flexWrap:'wrap',gap:8,padding:'0 12px',flex:'none'}),
  row([TXT('Click to add at the centre of the view, or drag onto the canvas.',{},{fontSize:11.5,color:'var(--mu)'})],{padding:'12px 16px 14px',flex:'none'})];}
// ---------- drawer
const secR=(cells,x)=>row(cells,Object.assign({flexWrap:'wrap',gap:8,padding:'13px 16px',borderBottom:'1px solid var(--bd)',flex:'none'},x||{}));
function drawer(s,rows,o){o=o||{};const w=o.w||360,left=s.vw-12-w;
 s.panels.push(panel({left,top:68,width:w,height:s.vh-80,padding:0,display:'flex',flexDirection:'column',overflow:'hidden',boxShadow:FLOAT,zIndex:25},rows));
 s.panels.push(panel({left:left-9,top:68+(s.vh-80)/2-24,width:4,height:48,borderRadius:4,background:'var(--bd2)',border:'none',boxShadow:'none',zIndex:26},[]));return left;}
const dHead=(tile,tileSt,t,sub,acts)=>row([{tile,tileSt,tsz:20,t,t2:sub,tst:{fontSize:15,fontWeight:500},st:{flex:1,gap:12},wst:{gap:3}}].concat(acts.map(a=>ib(a,{h:30,isz:17}))),{padding:'14px 10px 14px 16px',borderBottom:'1px solid var(--bd)',flex:'none',gap:2});
function compDrawer(n){return [dHead(LI[n.icon],tileS(n.kind,40),n.title,KIND[n.kind]+' · '+n.id,['ellipsis','x']),
 secR([LAB('TITLE'),inp(n.title)]),
 secR([LAB('KIND'),inp(KIND[n.kind],{tile:LI[n.icon],tileSt:tileS(n.kind,20),chev:'chevron-down',w:'calc(50% - 4px)'}),inp('Orders',{icon:'user-round',chev:'chevron-down',w:'calc(50% - 4px)'})],{paddingTop:12}),
 secR([LAB('APPEARANCE'),inp('No fill',{segs:[SW(null,'fill').segs[0]],w:'calc(50% - 4px)',chev:'chevron-down',x:{gap:8}}),inp('No stroke',{segs:[SW(null,'stroke').segs[0]],w:'calc(50% - 4px)',chev:'chevron-down'})]),
 secR([LAB('TECH · HOST'),inp(n.tech,{w:'calc(50% - 4px)',mono:true}),inp(n.host,{w:'calc(50% - 4px)',mono:true})]),
 secR([LAB('TAGS')].concat(n.tags.map(t=>chip(t))).concat([addChip()])),
 secR([LAB('DESCRIPTION'),TXT('Owns the order lifecycle from checkout to delivery. Validates cart and address, requests a quote and a payment authorization, emits order.created on success.',{},{fontSize:12.5,color:'var(--tx)'})]),
 secR([LAB('LINKS')].concat(n.links.map(l=>({icon:'link',ist:ic(14,{color:'var(--tx2)'}),t:l.label,t2:l.url,t2st:{fontFamily:mono,fontSize:11},tst:{fontSize:12.5},chev:'external-link',cst:ic(14,{color:'var(--mu)'}),st:{width:'100%',gap:9,height:36}})))),
 secR([{t:'RULES',tst:{fontSize:11,letterSpacing:'.07em',fontWeight:500,color:'var(--mu)'},kbd:'Open full page',kst:{font:'500 11.5px '+geist,color:'var(--tx2)'},chev:'maximize-2',cst:ic(13,{color:'var(--tx2)',marginLeft:5}),st:{width:'100%'}},
  {icon:'table',ist:ic(15),t:'Delivery tier',t2:'First match · 5 rows',t2st:{color:'var(--amt)',opacity:.85},tst:{fontSize:12.5,fontWeight:500},chev:'arrow-right',cst:ic(15),st:{width:'100%',height:46,padding:'0 12px',borderRadius:10,background:'var(--ams)',color:'var(--amt)',gap:10}}])];}
// ---------- JSON
function jsonPanel(s,n,right){const obj={id:n.id,kind:n.kind,title:n.title,group:n.group,tech:n.tech,host:n.host,owner:n.owner,tags:n.tags,fill:null,stroke:null,rules:n.rules,links:n.links.map(l=>({label:l.label,url:l.url})),position:{x:n.x,y:n.y}};
 const txt=JSON.stringify(obj,null,2);const lines=txt.split('\n').length;
 return panel({left:68,right:right||12,bottom:12,height:268,padding:0,display:'flex',flexDirection:'column',overflow:'hidden',boxShadow:FLOAT,zIndex:24},[
  row([{icon:'braces',ist:ic(16,{color:'var(--tx2)'}),t:'JSON',tst:{fontSize:12.5,fontWeight:500},st:{gap:8,marginRight:8}},{segs:[{t:'Selection',st:{height:24,padding:'0 10px',borderRadius:6,background:'var(--s)',boxShadow:'0 1px 2px var(--sh)',fontSize:12,fontWeight:500,display:'flex',alignItems:'center'}},{t:'Deck',st:{height:24,padding:'0 10px',fontSize:12,color:'var(--tx2)',display:'flex',alignItems:'center'}}],st:{background:'var(--s2)',borderRadius:8,padding:2}},
   {icon:'circle-check',ist:ic(13),t:'In sync with canvas',tst:{fontSize:11.5},st:{marginLeft:10,color:'var(--tx2)',gap:5}},{st:{flex:1}},{t:lines+' lines',tst:{font:'400 11px '+mono,color:'var(--mu)'},st:{marginRight:6}},ib('copy',{h:28,isz:15}),ib('x',{h:28,isz:15}),{kbd:'⌘J',kst:{marginLeft:0,paddingLeft:2,paddingRight:6}}],{height:42,padding:'0 6px 0 14px',borderBottom:'1px solid var(--bd)',flex:'none'}),
  row([{t:txt,tst:{whiteSpace:'pre',font:'400 12px/1.6 '+mono,color:'var(--tx)',overflow:'hidden'},st:{alignItems:'flex-start'}}],{flex:1,minHeight:0,background:'var(--code)',padding:'10px 16px',alignItems:'flex-start',overflow:'hidden'})]);}
// ---------- helpers for states
const BY={};S.NODES.forEach(n=>BY[n.id]=n);const EB={};S.EDGES.forEach(e=>EB[e.id]=e);
const selH=(n,hot,w,h)=>handles8(n.x,n.y,w||W,h||H,hot);
function frame(ids,label){let x1=1e9,y1=1e9,x2=-1e9,y2=-1e9;ids.forEach(id=>{const n=BY[id];x1=Math.min(x1,n.x);y1=Math.min(y1,n.y);x2=Math.max(x2,n.x+W);y2=Math.max(y2,n.y+H);});
 const out=[wd({left:x1-10,top:y1-10,width:x2-x1+20,height:y2-y1+20,border:'1px solid var(--ac)',borderRadius:16,zIndex:7})].concat(handles8(x1-10,y1-10,x2-x1+20,y2-y1+20,null,0));
 if(label)out.push(wd({left:x1-10,top:y2+18,height:22,padding:'0 9px',borderRadius:999,background:'var(--ac)',color:'var(--onac)',font:'500 11px/22px '+geist},label));return {decos:out,x1,y1,x2,y2};}
const hint=(s,parts,o)=>{o=o||{};return pill(0,0,parts,Object.assign({left:'50%',transform:'translateX(-50%)',top:'auto',bottom:o.bottom||12},o.x||{}));};
// ---------- STATES
const ST_={};
ST_['86']=th=>E(th,{deck:'Untitled deck',railHover:'add',extra:s=>{const rt0=railTop(s.vh);return [
 tip(68,rt0+4+40+5,'Add component','C'),
 panel({left:(s.vw-400)/2+24,top:s.vh/2-120,width:400,padding:'26px 28px 22px',boxShadow:FLOAT,display:'flex',flexDirection:'column',gap:0,alignItems:'center'},[
  row([{icon:'square-plus',ist:ic(22),st:{width:44,height:44,borderRadius:12,background:'var(--s2)',color:'var(--tx2)',justifyContent:'center'}}],{marginBottom:14}),
  row([{t:'Start with a component',tst:{fontSize:16,fontWeight:500}}],{marginBottom:6}),
  row([TXT('Add one from the rail, drop in a sticky, or paste a Sododeck JSON file. Everything stays in this browser.',{textAlign:'center'},{fontSize:12.5,textAlign:'center'})],{marginBottom:18,width:'100%'}),
  row([PRIM('square-plus','Add component',{height:34}),{kbd:'C',kst:{marginLeft:-2,paddingLeft:0,padding:'4px 6px',borderRadius:6,border:'1px solid var(--bd2)'}},SEC('upload','Import JSON','',{height:34,marginLeft:8})],{gap:6,marginBottom:18}),
  row([{t:'Drag to pan · Shift+drag to select · ⌘V to paste',tst:{fontSize:11.5,color:'var(--mu)'}}])])];}});
ST_['87']=th=>E(th,{z:.5,ox:92,oy:112,mm:true,world:s=>{const D=denseWorld(s);s._mm={w:4*GW+3*GX,h:4*GH+3*GY,groups:D.groups,nodes:D.nodes};}});
ST_['88']=th=>E(th,{tool:'add',world:s=>sampleWorld(s),extra:s=>[flyout(s,'Add component',paletteRows())]});
ST_['89']=th=>E(th,{pan:'outline',world:s=>{sampleWorld(s,{nst:{order:{sel:true}}});s.w.decos.push(...selH(BY.order));},extra:s=>{
 const rows=[search('Filter components')];const open={clients:1,edge:1,core:1,data:1};
 S.GROUPS.forEach(g=>{const ns=S.NODES.filter(n=>n.group===g.id);rows.push(row([{icon:open[g.id]?'chevron-down':'chevron-right',ist:ic(14,{color:'var(--mu)'}),t:g.label,tst:{fontSize:12.5,fontWeight:500,flex:1},kbd:String(ns.length),kst:{font:'400 11px '+geist},st:{flex:1,gap:6}}],{height:30,padding:'0 12px 0 10px',flex:'none'}));
  if(open[g.id])ns.forEach(n=>{const on=n.id==='order';rows.push(row([{tile:LI[n.icon],tileSt:tileS(n.kind,20),tsz:12,t:n.title,tst:{fontSize:12.5,flex:1,fontWeight:on?500:400},kbd:n.rules.length?'':'',st:{flex:1,gap:8}},n.rules.length?{icon:'table',ist:ic(13,{color:'var(--amt)'})}:{st:{}}],Object.assign({height:30,padding:'0 12px 0 30px',margin:'0 6px',borderRadius:8,flex:'none'},on?{background:'var(--acs)',color:'var(--act)'}:{})));});});
 return [flyout(s,'Outline',rows,{pinned:true,h:s.vh-80})];}});
ST_['90']=th=>{const f=S.FLOWS[0],fe=f.steps.map(x=>x.e),nodesIn={};fe.forEach(id=>{nodesIn[EB[id].from]=1;nodesIn[EB[id].to]=1;});
 const est={},nst={};S.EDGES.forEach(e=>est[e.id]=fe.includes(e.id)?'flow':'dim');est.e3='cur';S.NODES.forEach(n=>nst[n.id]=nodesIn[n.id]?{}:{dim:true});nst.order={flow:true,step:'3'};nst.gateway={flow:true};
 return E(th,{pan:'flows',flowChip:'Place order',ox:360,world:s=>sampleWorld(s,{est,nst,elab:{e3:'cur'},ebadge:{e3:''}}),extra:s=>{
  const rows=[row([{segs:[{t:'Flows  5',st:{flex:1,height:26,borderRadius:7,background:'var(--s)',boxShadow:'0 1px 2px var(--sh)',fontSize:12,fontWeight:500,display:'flex',alignItems:'center',justifyContent:'center'}},{t:'Features  3',st:{flex:1,height:26,fontSize:12,color:'var(--tx2)',display:'flex',alignItems:'center',justifyContent:'center'}}],st:{flex:1,background:'var(--s2)',borderRadius:9,padding:2}}],{padding:'10px 10px 6px',flex:'none'})];
  S.FLOWS.forEach((fl,i)=>{const on=i===0;rows.push(row([{icon:'waypoints',ist:ic(15,{color:on?'var(--act)':'var(--tx2)'}),t:fl.name,tst:{fontSize:12.5,fontWeight:on?500:400,flex:1},kbd:fl.steps.length+' steps',kst:{font:'400 11px '+geist,color:on?'var(--act)':'var(--mu)'},chev:on?'chevron-down':'',st:{flex:1,gap:8}}],Object.assign({height:32,padding:'0 10px',margin:'0 6px',borderRadius:8,flex:'none'},on?{background:'var(--acs)',color:'var(--act)'}:{})));
   if(on)fl.steps.forEach((stp,j)=>{const e=EB[stp.e],state=j<2?'done':j===2?'cur':'';const dot=Object.assign({width:22,height:22,borderRadius:999,justifyContent:'center',font:'500 10.5px/1 '+mono,flex:'none'},state==='cur'?{background:'var(--ac)',color:'var(--onac)'}:state==='done'?{background:'var(--acs)',color:'var(--act)'}:{background:'var(--s2)',color:'var(--tx2)'});
    rows.push(row([{t:String(j+1),tst:{overflow:'visible'},st:dot},{t:BY[e.from].title+' → '+BY[e.to].title,t2:e.label,t2st:{fontFamily:mono,fontSize:11},tst:{fontSize:12.5,fontWeight:500},st:{flex:1}}],Object.assign({gap:9,padding:'6px 10px 6px 16px',margin:'0 6px',borderRadius:9,flex:'none'},state==='cur'?{background:'var(--s2)'}:{})));});});
  rows.push(row([{icon:'plus',ist:ic(15),t:'New flow',tst:{fontSize:12},kbd:'⌥N',st:{flex:1,height:32,padding:'0 10px',border:'1px dashed var(--bd2)',borderRadius:9,color:'var(--tx2)',gap:7}}],{padding:'8px 12px 12px',flex:'none'}));
  const segs=f.steps.map((x,j)=>({st:{flex:1,height:4,borderRadius:4,background:j<=2?'var(--ac)':'var(--s3)'}}));const pl=(s.vw-500)/2+140;
  return [flyout(s,'Flows & features',rows,{h:s.vh-80}),panel({left:pl,bottom:12,width:500,padding:'12px 14px',display:'flex',flexDirection:'column',gap:10,boxShadow:FLOAT,zIndex:22},[
   row([SEC('skip-back','','',{width:32,padding:0,justifyContent:'center'}),PRIM('pause','',{width:32,height:32,minWidth:32}),SEC('skip-forward','','',{width:32,padding:0,justifyContent:'center'}),{t:'Step 3 of 8 · Place order',t2:'API Gateway → Order Service',tst:{fontSize:11.5,color:'var(--mu)'},t2st:{fontSize:13,fontWeight:500,color:'var(--tx)'},st:{flex:1,marginLeft:8}},{t:'1×',tst:{font:'500 11.5px '+mono},st:{height:28,padding:'0 9px',border:'1px solid var(--bd2)',borderRadius:8}}],{gap:4}),
   row([{segs,st:{flex:1,gap:4}}])])];}});};
ST_['91']=th=>E(th,{ox:120,zoomRight:12+360+8,world:s=>{sampleWorld(s,{nst:{order:{sel:true}}});s.w.decos.push(...selH(BY.order));},extra:s=>{drawer(s,compDrawer(BY.order));return [];}});
ST_['92']=th=>E(th,{ox:120,zoomRight:12+360+8,world:s=>{const ids=['pricing','payment','dispatch'];const nst={};ids.forEach(i=>nst[i]={sel:true});sampleWorld(s,{nst});s.w.decos.push(...frame(ids,'3 selected').decos);},extra:s=>{
 const al=['align-start-vertical','align-center-vertical','align-end-vertical','align-start-horizontal','align-center-horizontal','align-end-horizontal','align-horizontal-space-around','align-vertical-space-around'];
 drawer(s,[dHead('layers',{width:40,height:40,borderRadius:12,background:'var(--s2)',color:'var(--tx2)',display:'flex',alignItems:'center',justifyContent:'center'},'3 components','Pricing · Payment · Dispatch',['ellipsis','x']),
  secR([LAB('KIND'),inp('Service',{tile:'box',tileSt:tileS('service',20),chev:'chevron-down',w:'calc(50% - 4px)'}),inp('Mixed',{mixed:true,icon:'user-round',chev:'chevron-down',w:'calc(50% - 4px)'})]),
  secR([LAB('APPEARANCE'),inp('Mixed',{mixed:true,segs:[SW(null,'fill',false,true).segs[0]],w:'calc(50% - 4px)',chev:'chevron-down'}),inp('No stroke',{segs:[SW(null,'stroke').segs[0]],w:'calc(50% - 4px)',chev:'chevron-down'})]),
  secR([LAB('TECH'),inp('Mixed',{mixed:true,mono:true})]),
  secR([LAB('TAGS'),chip('critical',{part:true,meta:'2/3'}),chip('pci',{part:true,meta:'1/3'}),addChip('Add to all')]),
  secR([LAB('ALIGN · DISTRIBUTE')].concat(al.map((a,i)=>ib(a,{h:32,isz:17,x:{border:'1px solid var(--bd2)'},dis:i>5&&false})))),
  secR([LAB('ACTIONS'),SEC('group','Group','⌘G'),SEC('copy','Duplicate','⌘D'),SEC('trash-2','Delete','⌫',{color:'var(--rdt)',borderColor:'var(--rdt)'})],{borderBottom:'none'}),
  secR([TXT('Changes apply to all three. Fields that differ show “Mixed” until you set a value.',{},{fontSize:11.5,color:'var(--mu)'})],{borderBottom:'none',paddingTop:0})]);return [];}});
ST_['93']=th=>E(th,{oy:40,zoomBottom:12+268+8,world:s=>{sampleWorld(s,{nst:{order:{sel:true}}});s.w.decos.push(...selH(BY.order));},extra:s=>[jsonPanel(s,BY.order)]});
ST_['94']=th=>E(th,{hideUI:true,world:s=>sampleWorld(s)});
ST_['95']=th=>E(th,{world:s=>sampleWorld(s,{nst:{payment:{hover:true,details:true}}}),extra:s=>{const p=sp(s,650+W,207);return [tip(p[0]+16,p[1]-22,'Open details','⏎')];}});
ST_['96']=th=>E(th,{world:s=>sampleWorld(s,{nst:{order:{edit:'all'}}}),extra:s=>{const p=sp(s,460,80+H);return [pill(p[0],p[1]+12,[kp('⏎','Save'),kp('Esc','Cancel'),kp('⇥','Next card')],{gap:0})];}});
ST_['97']=th=>{const nn={id:'new',kind:'service',title:'',x:250,y:400,icon:'box',tech:'',sub:'Service'};
 return E(th,{tool:'add',world:s=>sampleWorld(s,{add:[nn],nst:{new:{edit:'empty',sub:'Service'}}}),extra:s=>{const p=sp(s,250,400+H);return [flyout(s,'Add component',paletteRows('service')),pill(p[0],p[1]+12,[kp('⏎','Save'),kp('⌘⏎','Save and add another'),kp('Esc','Keep as Untitled')])];}});};
function compTB(s,id,o){o=o||{};const n=BY[id];const p=sp(s,n.x,n.y);const cells=tbComp(n,o).concat([dv(),ib('ellipsis',{on:o.pop==='more'})]);const t=tbar(s,p[0]-4,p[1]-4-12-42,cells);return t;}
ST_['98']=th=>E(th,{world:s=>{sampleWorld(s,{nst:{payment:{sel:true}}});s.w.decos.push(...selH(BY.payment));},extra:s=>{const t=compTB(s,'payment',{pop:'owner'});const bx=t.bx(8);
 const rows=[row([{icon:'search',ist:ic(14,{color:'var(--mu)'}),t:'Filter teams',tst:{fontSize:12.5,color:'var(--mu)'},st:{flex:1,height:32,padding:'0 9px',borderRadius:8,background:'var(--s2)',gap:7}}],{padding:'2px 2px 4px'}),
  row([{icon:'ban',ist:ic(15,{color:'var(--mu)'}),t:'No owner',tst:{fontSize:13,color:'var(--tx2)'},st:{flex:1,gap:9}}],{height:30,padding:'0 10px',borderRadius:7})].concat(S.TEAMS.map(t=>{const on=t==='Payments';
   return row([{icon:'users',ist:ic(15,{color:'var(--tx2)'}),t,tst:{fontSize:13,flex:1,fontWeight:on?500:400},chev:on?'check':'',cst:ic(15,{color:'var(--act)'}),kbd:on?'':String(S.NODES.filter(n=>n.owner===t).length),kst:{font:'400 11px '+geist},st:{flex:1,gap:9}}],Object.assign({height:30,padding:'0 10px',borderRadius:7},on?{background:'var(--acs)',color:'var(--act)'}:{}));}))
  .concat([HR(),row([{icon:'settings',ist:ic(14,{color:'var(--mu)'}),t:'Edit teams in Deck settings',tst:{fontSize:12,color:'var(--tx2)'},st:{gap:8}}],{height:30,padding:'0 10px'})]);
 return [t.p,popP(bx-6,t.p.st.top+48,236,rows),tip(bx-18,t.p.st.top-34,'Owner','O')];}});
ST_['99']=th=>E(th,{oy:-6,world:s=>{const ids=['order','pricing','payment'];const nst={};ids.forEach(i=>nst[i]={sel:true});sampleWorld(s,{nst});s._f=frame(ids);s.w.decos.push(...s._f.decos);},extra:s=>{const f=s._f;const p=sp(s,f.x1-10,f.y2+10);
 const cells=[{t:'3 selected',tst:{fontSize:12.5,fontWeight:500},_w:84,st:{height:34,padding:'0 10px 0 8px'}},dv(),{tile:'box',tileSt:tileS('service',22),tsz:13,t:'Service',tst:{fontSize:12.5},chev:'chevron-down',_w:102,st:{height:34,padding:'0 6px 0 7px',borderRadius:8,gap:7}},dv(),
  SW(null,'fill',false,true),SW(null,'stroke'),dv(),ib('user-round'),ib('tag',{on:true}),ib('cpu'),ib('link'),ib('table'),dv(),ib('align-start-vertical',{t:'Align',chev:'chevron-down',isz:17}),ib('group',{t:'Group',isz:17}),dv(),ib('ellipsis')];
 const t=tbar(s,p[0],p[1]+12,cells);const bx=t.bx(9);
 const rows=[row([{t:'Tags on 3 components',tst:{fontSize:12,fontWeight:500,color:'var(--tx2)'}}],{padding:'6px 8px 4px'}),
  row([chip('critical',{part:true,meta:'2/3'}),chip('pii',{part:true,meta:'1/3'}),chip('pci',{part:true,meta:'1/3'})],{flexWrap:'wrap',gap:6,padding:'4px 8px 8px'}),
  row([inp('',{ph:'Add tag to all…',focus:true,h:34,icon:'plus',x:{margin:'0 2px'}})],{padding:'0 2px 4px'}),
  row([{t:'SUGGESTIONS',tst:{fontSize:10.5,letterSpacing:'.07em',color:'var(--mu)',fontWeight:500}}],{padding:'6px 8px 2px'})].concat(['async','realtime','vendor'].map((x,i)=>row([{icon:'tag',ist:ic(14,{color:'var(--tx2)'}),t:x,tst:{fontSize:13,flex:1},kbd:i===0?'⏎':'',st:{flex:1,gap:9}}],Object.assign({height:30,padding:'0 10px',borderRadius:7},i===0?{background:'var(--s2)'}:{}))))
  .concat([HR(),row([TXT('Dashed tags are on some of the selection. Click to add to all, × to remove from all.',{},{fontSize:11.5,color:'var(--mu)'})],{padding:'2px 8px 4px'})]);
 return [t.p,popP(bx-8,t.p.st.top+48,264,rows)];}});
const E6={a:[814,232],m:[862,413],b:[886,595]};
ST_['100']=th=>E(th,{world:s=>{sampleWorld(s,{est:{e6:'sel'},elab:{e6:'sel'},nst:{payment:{},stripe:{}}});
 s.w.decos.push(wd({left:E6.a[0]-6,top:E6.a[1]-6,width:12,height:12,borderRadius:999,background:'var(--s)',border:'2px solid var(--ac)',zIndex:9}),wd({left:E6.b[0]-6,top:E6.b[1]-6,width:12,height:12,borderRadius:999,background:'var(--s)',border:'2px solid var(--ac)',zIndex:9}),wd({left:E6.m[0]-4,top:E6.m[1]+26,width:8,height:22,borderRadius:4,background:'var(--s)',border:'1.5px solid var(--ac)',zIndex:9}));},
 extra:s=>{const p=sp(s,862,413);const cells=[ib('type',{t:'charge',isz:16,tst:{fontFamily:mono,fontSize:12}}),dv(),ib('plug',{t:'HTTPS',chev:'chevron-down',isz:16}),ib('arrow-right',{t:'One way',chev:'chevron-down',isz:16}),dv(),ib('route-off',{t:'Reset route',isz:16}),dv(),ib('ellipsis')];
 const t=tbar(s,p[0]-190,p[1]-12-12-44,cells);return [t.p];}});
ST_['101']=th=>E(th,{world:s=>{sampleWorld(s,{gst:{core:'sel'}});const g=S.GROUPS[2];s.w.decos.push(...handles8(g.x,g.y,g.w,g.h,null,0));},extra:s=>{const g=S.GROUPS[2];const p=sp(s,g.x,g.y);
 const t=tbar(s,p[0]+120,p[1]-12-44+2,[ib('pencil',{t:'Rename',isz:16}),ib('ungroup',{t:'Ungroup',isz:16}),ib('chevrons-down-up',{t:'Collapse',isz:16}),dv(),ib('square-dashed-mouse-pointer',{t:'Select members',isz:16}),dv(),ib('ellipsis')]);return [t.p];}});
ST_['102']=th=>E(th,{world:s=>{sampleWorld(s,{nst:{pricing:{sel:true}}});s.w.decos.push(...selH(BY.pricing));},extra:s=>{const p=sp(s,650+W-30,122+34);
 const m=menu(p[0],p[1],[['Open details','⏎'],['Rename','F2'],'-',['Copy','⌘C'],['Paste','⌘V'],['Duplicate','⌘D'],['Copy JSON','⇧⌘C'],'-',['Group selection','⌘G',{dis:true}],['Align','',{sub:true}],['Arrange','',{sub:true,on:true}],'-',['Delete','⌫',{danger:true,icon:'trash-2'}]]);
 const sub=menu(p[0]+252-6,p[1]+6+30*8+11*2+6-6,[['Bring to front','⇧⌘]'],['Bring forward','⌘]'],['Send backward','⌘['],['Send to back','⇧⌘[']],{w:220,z:46});return [m,sub];}});
ST_['103']=th=>E(th,{world:s=>sampleWorld(s),extra:s=>{const p=sp(s,150,420);const m=menu(p[0],p[1],[['Paste','⌘V',{dis:true}],'-',['Add component','',{sub:true,on:true}],['Add sticky','S'],['Add group','G'],'-',['Select all','⌘A'],['Fit to screen','⇧1']],{w:232});
 const sub=menu(p[0]+232-6,p[1]+6+30+11-6,[['Service','1',{tile:'box',kind:'service'}],['Database','2',{tile:'database',kind:'data'}],['Queue','3',{tile:'arrow-left-right',kind:'queue'}],['Gateway','4',{tile:'router',kind:'edge'}],['Client','5',{tile:'monitor-smartphone',kind:'client'}],['External','6',{tile:'cloud',kind:'external'}]],{w:200,z:46});
 return [m,sub,tip(p[0]+8,p[1]-32,'Clipboard is empty','')];}});
ST_['104']=th=>E(th,{world:s=>sampleWorld(s,{gst:{msg:'sel'}}),extra:s=>{const g=S.GROUPS[3];const p=sp(s,g.x+g.w-40,g.y-190);
 return [menu(p[0],p[1],[['Rename','F2'],['Ungroup','⇧⌘G'],['Collapse','⌘.'],['Select members','⌘⇧A'],'-',['Copy JSON',''],['Arrange','',{sub:true}],'-',['Delete group','',{danger:true,icon:'trash-2'}]],{w:248}),
  tip(p[0],p[1]+252,'Keeps Event Bus; moves it to the parent level','')];}});
function colourPop(x,y,o){o=o||{};const sel=o.sel;const sw=(bg,bd,on,t)=>({st:Object.assign({width:28,height:28,borderRadius:999,background:bg,border:'1px solid '+bd,justifyContent:'center',position:'relative'},on?{boxShadow:'0 0 0 2px var(--s), 0 0 0 4px var(--ac)'}:{}),icon:on?'check':'',ist:ic(15,{color:'var(--tx)'}),_t:t});
 const named=CARDS.map(c=>sw('var(--card-'+c.n+'-fill)','var(--card-'+c.n+'-stroke)',sel===c.n));
 const custom=CUSTOM.map(([n,h],i)=>{const c=sw(h,'rgba(0,0,0,.18)',sel===h);if(lum(h)<.18)c.ist=ic(15,{color:'#fff'});if(o.hoverCustom===i)c.segs=[{icon:'x',ist:ic(10),st:{position:'absolute',top:-5,right:-5,width:16,height:16,borderRadius:999,background:'var(--ink)',color:'var(--inkt)',display:'flex',alignItems:'center',justifyContent:'center',border:'2px solid var(--s)'}}];return c;});
 custom.push({icon:'plus',ist:ic(15),st:Object.assign({width:28,height:28,borderRadius:999,border:'1px dashed var(--bd2)',justifyContent:'center',color:'var(--tx2)'},o.adding?{background:'var(--acs)',border:'1px solid var(--ac)',color:'var(--act)'}:{})});
 const rows=[row([{segs:[{t:'Fill',st:{flex:1,height:26,borderRadius:7,background:'var(--s)',boxShadow:'0 1px 2px var(--sh)',fontSize:12,fontWeight:500,display:'flex',alignItems:'center',justifyContent:'center'}},{t:'Stroke',st:{flex:1,height:26,fontSize:12,color:'var(--tx2)',display:'flex',alignItems:'center',justifyContent:'center'}}],st:{flex:1,background:'var(--s2)',borderRadius:9,padding:2}}],{padding:'4px 6px 8px'}),
  row([{icon:'ban',ist:ic(15),t:'No colour',tst:{fontSize:12.5},st:{flex:1,height:32,borderRadius:8,border:'1px solid var(--bd2)',justifyContent:'center',gap:7,color:'var(--tx)'}}],{padding:'0 6px 6px'}),
  row([LAB('COLOURS')],{padding:'6px 6px 8px'}),row(named,{flexWrap:'wrap',gap:8,padding:'0 6px 8px'}),
  row([LAB('DECK COLOURS'),],{padding:'8px 6px 8px'}),row(custom,{flexWrap:'wrap',gap:8,padding:'0 6px 8px'})];
 if(o.adding){rows.push(HR());
  rows.push(row([{segs:[{st:{position:'absolute',left:198,top:18,width:14,height:14,borderRadius:999,border:'2px solid #fff',boxShadow:'0 0 0 1px rgba(0,0,0,.3)'}}],st:{position:'relative',width:'100%',height:118,borderRadius:8,background:'linear-gradient(to top,#000,transparent),linear-gradient(to right,#fff,hsl(222,100%,50%))'}}],{padding:'8px 6px 10px'}));
  rows.push(row([{segs:[{st:{position:'absolute',left:146,top:-3,width:14,height:14,borderRadius:999,background:'hsl(222,100%,50%)',border:'2px solid #fff',boxShadow:'0 0 0 1px rgba(0,0,0,.3)'}}],st:{position:'relative',width:'100%',height:8,borderRadius:8,background:'linear-gradient(to right,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)'}}],{padding:'0 6px 12px'}));
  rows.push(row([{st:{width:32,height:32,borderRadius:8,background:'#1F2A44',border:'1px solid rgba(0,0,0,.2)'}},inp('#1F2A44',{mono:true,focus:true,h:32,w:128,segs:[{st:{width:1.5,height:15,background:'var(--ac)',marginLeft:-6}}]}),PRIM('','Add',{height:32,padding:'0 12px'})],{gap:8,padding:'0 6px 6px'}));
  rows.push(row([{t:'Navy · saved to this deck as 4 of 12',tst:{fontSize:11.5,color:'var(--mu)'}}],{padding:'2px 6px 4px'}));}
 else rows.push(HR(),row([{st:{width:16,height:16,borderRadius:999,background:'var(--card-teal-fill)',border:'1px solid var(--card-teal-stroke)'}},{t:'Teal',tst:{fontSize:12.5,fontWeight:500}},{t:'--card-teal-fill',tst:{font:'400 11px '+mono,color:'var(--mu)'},st:{marginLeft:'auto'}}],{gap:8,padding:'4px 8px 4px'}));
 return popP(x,y,276,rows,{padding:8});}
ST_['105']=th=>E(th,{ox:150,world:s=>{sampleWorld(s,{nst:{payment:{sel:true,fill:'teal'}}});s.w.decos.push(...selH(BY.payment));},extra:s=>{const t=compTB(s,'payment',{pop:'fill',fill:'teal'});const bx=t.bx(4);const top=t.p.st.top+48;
 return [t.p,colourPop(bx+40,top,{sel:'teal',hoverCustom:0}),tip(bx+40+276+8,top+246,'Remove Navy','⌫')];}});
ST_['106']=th=>E(th,{ox:150,world:s=>{sampleWorld(s,{nst:{payment:{sel:true,fill:'#1F2A44'}}});s.w.decos.push(...selH(BY.payment));},extra:s=>{const t=compTB(s,'payment',{pop:'fill',fill:'#1F2A44'});const bx=t.bx(4);return [t.p,colourPop(bx+40,t.p.st.top+48,{adding:true})];}});
ST_['107']=th=>E(th,{ox:92,oy:236,world:s=>{const w=s.w,PX=188;const L=(x,y,t)=>w.decos.push(wd({left:x,top:y,fontSize:11,letterSpacing:'.07em',fontWeight:500,color:'var(--mu)',whiteSpace:'nowrap'},t));
 const kinds=['service','data','queue','edge','client','external'];const icons={service:'box',data:'database',queue:'arrow-left-right',edge:'router',client:'monitor-smartphone',external:'cloud'};
 const mk=(id,x,y,title,sub,k,o)=>{const n={id,kind:k,x,y,title,icon:icons[k],sub,rules:['r']};w.nodes.push(nd(n,o));return n;};
 L(0,0,'NAMED FILLS · 13');CARDS.forEach((c,i)=>mk('c'+i,(i%7)*PX,24+Math.floor(i/7)*74,cap(c.n),'--card-'+c.n,kinds[i%6],{fill:c.n}));
 L(0,176,'STROKES');['red','blue','green','violet'].forEach((c,i)=>mk('s'+i,i*PX,200,cap(c)+' stroke','--card-'+c+'-stroke',kinds[i%6],{stroke:c}));
 mk('fs',4*PX,200,'Teal fill + stroke','fill + stroke','service',{fill:'teal',stroke:'teal'});
 L(5*PX,176,'CUSTOM');mk('cn',5*PX,200,'Navy #1F2A44','Text flips to white','data',{fill:'#1F2A44'});mk('cs',6*PX,200,'Sand #E8D5B7','Stays dark','client',{fill:'#E8D5B7'});
 L(0,286,'STATES ON COLOUR');const a=mk('st0',0,310,'Selected · orange','Frame sits 2px outside','service',{fill:'orange',sel:true});w.decos.push(...handles8(0,310,W,H));
 mk('st1',PX,310,'Selected · navy','Frame on dark fill','data',{fill:'#1F2A44',sel:true});w.decos.push(...handles8(PX,310,W,H));
 const f1={x:2*PX,y:310,w:W,h:H},f2={x:3*PX,y:310,w:W,h:H};const r=rt(f1,f2);w.edges.push(edge(r,'cur'));
 mk('st2',2*PX,310,'Flow · amber','Ring + step badge','service',{fill:'amber',flow:true,step:'2'});mk('st3',3*PX,310,'Flow · blue','Current step','data',{fill:'blue',flow:true,step:'3'});
 mk('st4',4*PX,310,'Error · pink','Dashed ring + icon','service',{fill:'pink',err:true});mk('st5',5*PX,310,'Error · navy','On a dark custom fill','data',{fill:'#1F2A44',err:true});
 mk('st6',6*PX,310,'Dimmed · green','Off the flow path','client',{fill:'green',dim:true});}});
ST_['108']=th=>E(th,{world:s=>{const ids=['pricing','payment','dispatch','route'];const nst={};ids.forEach(i=>nst[i]={sel:true});sampleWorld(s,{nst});
 s.w.decos.push(wd({left:624,top:104,width:216,height:340,border:'1px solid var(--ac)',background:'var(--marq)',borderRadius:2,zIndex:7}),wd({left:846,top:450,height:22,padding:'0 9px',borderRadius:999,background:'var(--ink)',color:'var(--inkt)',font:'500 11px/22px '+geist,zIndex:9},'4 selected'),wd({left:833,top:437,color:'var(--tx)',zIndex:9},'','plus',ic(16)));},
 extra:s=>[hint(s,[kp('⇧ drag','Select'),kp('drag','Pan'),kp('⌥','Include touched cards')])]});
ST_['109']=th=>{const dx=96,dy=20;const pos={};S.NODES.filter(n=>n.group==='data').forEach(n=>pos[n.id]={x:n.x+dx,y:n.y+dy});const g=S.GROUPS[4];
 return E(th,{ox:150,world:s=>{sampleWorld(s,{pos,gpos:{data:{x:g.x+dx,y:g.y+dy}},gst:{data:'drag'},ghostG:[g],nst:{ordersdb:{lift:true},trackdb:{lift:true},cache:{lift:true}}});
  s.w.decos.push(wd({left:g.x+dx+g.w-78,top:g.y+dy-11,height:22,padding:'0 8px',borderRadius:999,background:'var(--ink)',color:'var(--inkt)',font:'500 11px/22px '+mono,zIndex:9},'+96, +20'));},extra:s=>[hint(s,[kp('Esc','Cancel move'),kp('⌥','Duplicate'),kp('⇧','Lock axis')])]});};
ST_['110']=th=>E(th,{z:1,ox:-228,oy:-40,world:s=>{const D=denseWorld(s,{gst:{g5:'drop'}});
 s.w.decos.push(wd({left:866,top:560,width:W,height:H,borderRadius:12,border:'1.5px dashed var(--ac)',background:'var(--marq)',zIndex:1}));
 s.w.nodes.push(nd({id:'drag',kind:'service',title:'Tariff Service',icon:'box',tech:'Go',x:890,y:584,rules:[]},{lift:true,sel:true}));},extra:s=>[hint(s,[kp('release','Add to Dispatch'),kp('⌥','Drop without grouping'),kp('Esc','Cancel')])]});
ST_['111']=th=>E(th,{world:s=>{sampleWorld(s,{pos:{pricing:{x:650,y:80}},nst:{pricing:{lift:true,sel:true}},ghosts:[{x:650,y:122,w:W,h:H}]});const w=s.w;
 const G=(st)=>w.decos.push(wd(Object.assign({background:'var(--ac)',zIndex:9},st)));const D=(x,y,t)=>w.decos.push(wd({left:x,top:y,transform:'translate(-50%,-50%)',height:18,padding:'0 6px',borderRadius:999,background:'var(--ac)',color:'var(--onac)',font:'500 10.5px/18px '+mono,zIndex:10},t));
 G({left:440,top:80,width:394,height:1});G({left:650,top:60,width:1,height:390});D(637,105,'26');D(732,168,'77');D(732,253,'35');
 w.decos.push(wd({left:626,top:105,width:22,height:1,borderTop:'1px dashed var(--ac)',zIndex:9}),wd({left:732,top:132,width:1,height:73,borderLeft:'1px dashed var(--ac)',zIndex:9}));},
 extra:s=>[hint(s,[kp('⌘','Hold to disable snapping'),kp('⇧','Lock axis')])]});
ST_['112']=th=>E(th,{world:s=>{sampleWorld(s,{pos:{dispatch:{w:212,h:64}},nst:{dispatch:{sel:true}},ghosts:[{x:650,y:292,w:W,h:H}]});s.w.decos.push(...handles8(650,292,212,64,[2,2]));
 s.w.decos.push(wd({left:650+212+12,top:292+64+10,height:22,padding:'0 8px',borderRadius:999,background:'var(--ink)',color:'var(--inkt)',font:'500 11px/22px '+mono},'212 × 64'));},extra:s=>[hint(s,[kp('⇧','Keep ratio'),kp('⌥','From centre'),kp('Esc','Cancel')])]});
ST_['113']=th=>E(th,{world:s=>{const newp=rp([[814,232],[844,232],[844,595],[886,595]]);sampleWorld(s,{est:{e6:'sel'},epath:{e6:newp},xedges:[{r:rt(BY.payment,BY.stripe),m:'ghost'}]});
 s.w.decos.push(wd({left:810-2,top:228-2,width:12,height:12,borderRadius:999,background:'var(--s)',border:'2px solid var(--ac)',zIndex:9,transform:'translate(-2px,-2px)'}),wd({left:886-6,top:595-6,width:12,height:12,borderRadius:999,background:'var(--s)',border:'2px solid var(--ac)',zIndex:9}),
  wd({left:844-5,top:402,width:10,height:24,borderRadius:5,background:'var(--ac)',border:'2px solid var(--s)',zIndex:9}),wd({left:856,top:403,height:22,padding:'0 8px',borderRadius:999,background:'var(--ink)',color:'var(--inkt)',font:'500 11px/22px '+mono,zIndex:9},'−18'),wd({left:862,top:190,width:1,height:440,borderLeft:'1px dashed var(--mu)',opacity:.6,zIndex:6}));},
 extra:s=>[hint(s,[kp('drag','Move segment'),kp('⇧','Snap to grid'),kp('R','Reset route')])]});
ST_['114']=th=>E(th,{world:s=>{const hot=rp([[814,232],[862,232],[862,510],[886,510]]);sampleWorld(s,{hideE:['e6'],xedges:[{r:rt(BY.payment,BY.stripe),m:'ghost'},{r:hot,m:'hot'}],nst:{sms:{targets:4,hover:true},stripe:{},maps:{}}});
 s.w.decos.push(wd({left:814-6,top:232-6,width:12,height:12,borderRadius:999,background:'var(--s)',border:'2px solid var(--ac)',zIndex:9}),wd({left:886-190,top:510+24,height:22,padding:'0 9px',borderRadius:999,background:'var(--ink)',color:'var(--inkt)',font:'500 11px/22px '+geist,zIndex:9},'Connect to SMS Gateway · left'));},
 extra:s=>[hint(s,[kp('release','Reconnect'),kp('Esc','Keep Payment Provider'),kp('⌥','Free end')])]});
ST_['115']=th=>E(th,{badges:{tl:1,tr:2,rail:3,undo:4,zoom:6},world:s=>{sampleWorld(s,{nst:{order:{focus:true,sel:true}}});},extra:s=>{const p=sp(s,460+24,80+H+10);
 return [panel({left:3,top:3,right:3,bottom:3,background:'transparent',border:'none',borderRadius:10,boxShadow:'inset 0 0 0 2px var(--ac)',zIndex:4},[Object.assign(badgeRow(5),{st:Object.assign({},badgeRow(5).st,{top:74,left:74})})]),
  menu(p[0],p[1],[['Open details','⏎',{focus:true}],['Rename','F2'],'-',['Copy','⌘C'],['Paste','⌘V'],['Duplicate','⌘D'],['Copy JSON','⇧⌘C'],'-',['Group selection','⌘G',{dis:true}],['Align','',{sub:true}],['Arrange','',{sub:true}],'-',['Delete','⌫',{danger:true,icon:'trash-2'}]]),
  hint(s,[kp('F6','Next region'),kp('⇧F6','Previous'),kp('⇧F10','Context menu'),kp('↑↓','Move'),kp('Esc','Close')],{bottom:64})];}});
ST_['116']=th=>E(th,{vw:1024,vh:768,compact:true,z:.8,ox:70,oy:120,zoomRight:12+360+8,world:s=>{sampleWorld(s,{nst:{order:{sel:true}}});s.w.decos.push(...selH(BY.order));},extra:s=>{drawer(s,compDrawer(BY.order));return [];}});
// ---------- list + notes
const N=(id,slug,sec,title,did,changed,keys,edge,x)=>Object.assign({id,slug,sec,title,did,changed,keys,edge,vw:1440,vh:900},x||{});
const LIST=[
N('86','shell-empty','A','Canvas-first shell · empty deck','Created a new deck from the library.','The dot-grid canvas fills the window. Chrome floats in five islands 12px from the edges: deck (≡, name, save status, views), tools (Jump to, Labels, Focus, theme, Export), the left rail, Undo/Redo, and zoom. An empty-canvas card offers the ways in.','C add component · S sticky · ⌘V paste JSON · ⌘K jump to · ⌘\\ hide UI. Hovering a rail button shows its tooltip with the shortcut.','Save status is an icon: check (saved), spinning loader (saving), clay alert (error; click opens the error popover from 84). The empty card disappears after the first component.'),
N('87','dense-50','A','Dense deck at 50% zoom','Opened a 110-component deck (16 groups, ~150 connections) and zoomed to 50%.','No side panels: the canvas gets the full 1440×900 minus five small islands, about 94% of the window instead of about 50%. Minimap is on and pops above the zoom island.','⇧1 fit · ⇧2 fit selection · ⌘+ / ⌘− zoom · M minimap · Space+drag pan.','Below 40% subtitles hide; below 25% cards become kind-coloured blocks (69). The minimap viewport outline is Deck Orange.'),
N('88','palette','A','Palette flyout','Pressed C, or clicked Add component on the rail.','The palette flyout opens next to the rail (280px) over the canvas: search, six component kinds with number keys, sticky and group. The rail button shows the pressed state.','C open · type to filter · 1–6 add at centre · arrows move · ⏎ add · Esc close.','No match: “No kind matches …” with Clear. Dragging a tile shows a ghost card that snaps to the grid. Opening another flyout replaces this one.'),
N('89','outline-pinned','A','Outline flyout, pinned','Opened Outline (⌥1) and clicked the pin.','A pinned flyout stays open while you work on the canvas. Clicking a row selects the card and pans to it; the selection shows in both places.','⌥1 toggle · ↑↓ move · ←→ collapse or expand · ⏎ select · F2 rename · Esc returns focus to the canvas (the pinned flyout stays).','One flyout at a time: opening Palette while Outline is pinned swaps them, and Outline comes back when Palette closes. An empty filter shows “No components match”.'),
N('90','flows','A','Flows flyout with a flow selected','Opened Flows & features and picked Place order.','The flow expands into its steps in the flyout; the canvas dims everything off the path and the step player docks bottom-centre. The deck island shows a Flow chip with a close button. The canvas pans right so the path clears the flyout.','⌥2 toggle · ←→ previous or next step · Space play/pause · Esc exits flow mode.','Broken steps show a dashed clay dot (44). With the drawer open the player centres on the remaining canvas.'),
N('91','drawer-component','A','Detail drawer on a component','Clicked the details icon on Order Service, or pressed ⏎ with it selected.','The drawer (360px) overlays the right of the canvas and never reflows it; the canvas pans so the selection stays clear. Inspector sections are reused, plus Appearance (fill and stroke). Its left edge has a resize grip (320–560px).','⏎ open · Esc close · Tab through fields · ⌘⇧D toggle the drawer.','Rules header links to the full-page rule editor. Width is remembered per deck. Field errors use the style from 63.'),
N('92','drawer-bulk','A','Drawer for a multi-selection','Shift-clicked Pricing, Payment and Dispatch, then opened details.','The header shows the count. Shared fields edit all three; differing values read “Mixed”; tags on some cards are dashed chips with n/3. Align, distribute and bulk actions sit at the end.','⌘A select all · ⌘G group · ⌘D duplicate · ⌫ delete (with an Undo toast).','Mixed kinds show Kind as Mixed; changing it asks for confirmation.'),
N('93','json-overlay','A','JSON panel as a bottom overlay','Pressed ⌘J with Order Service selected.','JSON is a bottom island spanning from the rail to the right edge. The zoom island moves up above it. The canvas does not resize.','⌘J toggle · ⌘⏎ apply edits · Esc returns focus to the canvas.','Invalid JSON: clay line marker and message, the draft is kept. With the drawer open, the panel ends at the drawer’s left edge.'),
N('94','hide-ui','A','Hide UI','Pressed ⌘\\.','Every island, flyout, drawer and toolbar hides. Only a small Show UI pill stays bottom-right.','⌘\\ or the pill brings the UI back. Canvas shortcuts keep working.','Selection and the context menu still work; the selection toolbar stays hidden in this mode.'),
N('95','card-hover','B','Card hover with the details icon','Hovered Payment Service.','A round details button appears on the card’s top-right corner, with a tooltip. The card lifts slightly.','Tabbing to a card shows the same button; ⏎ opens details.','Hidden while dragging, in flow mode, or when the card is under 80px wide on screen.'),
N('96','inline-edit','B','Inline title edit','Double-clicked Order Service.','The title becomes an input inside the card with all text selected. Negative margins keep the card from changing size. The selection toolbar hides while editing.','F2 or ⏎ on a selection starts editing · ⏎ save · Esc cancel · Tab saves and edits the next card.','Saving an empty title restores the previous one. Long titles scroll inside the input and truncate again after saving.'),
N('97','new-card','B','New card with an empty title','Picked Service in the palette.','The card lands at the centre of the view with an empty title, a placeholder and the caret ready. The palette stays open to add more.','Type the name · ⏎ save · ⌘⏎ save and add another of the same kind · Esc keeps it as “Untitled service”.','If the centre is taken, the card offsets by 24px until it finds space.'),
N('98','toolbar-one','B','Selection toolbar · one component','Selected Payment Service and clicked Owner.','The toolbar floats 12px above the selection frame: Open details · Kind · Fill · Stroke · Owner · Tags · Tech · Links · Rules · More. Owner opens a popover with a filter, No owner and the deck’s teams.','⌘E focuses the toolbar · ←→ move · ⏎ or Space open · Esc closes the popover, then the toolbar.','Hidden while dragging, resizing or editing a title. Near the top edge it flips below the selection (99).'),
N('99','toolbar-multi','B','Toolbar · multi-selection with Align','Selected three cards near the top and opened Tags.','The toolbar shows the count, the shared fields, Align and Group. It flips below the selection because the space above is under the top islands. Tags lists partial tags as dashed chips with counts.','⌘G group · ⌥A / ⌥D / ⌥W / ⌥S align left, right, top, bottom · Tab through the popover.','Clicking a dashed chip adds it to all; × removes it from all.'),
N('100','toolbar-connection','B','Toolbar on a connection','Clicked the charge connection.','The connection turns orange with endpoint handles and a segment handle. The toolbar shows Label, Protocol, Direction and Reset route.','⏎ edit label · P protocol · ⌫ delete · Tab next connection of the same card.','Reset route is disabled while the route is automatic.'),
N('101','toolbar-group','B','Toolbar on a group','Clicked the CORE SERVICES label.','The boundary turns solid orange with handles, the label becomes a selected chip, and the toolbar offers Rename, Ungroup, Collapse and Select members.','F2 rename · ⇧⌘G ungroup · ⌘. collapse · Esc clear.','Clicking inside a group still selects cards; the label is the group’s handle.'),
N('102','menu-component','B','Context menu on a component','Right-clicked Pricing Service and hovered Arrange.','Sectioned menu with right-aligned shortcuts. Group selection is disabled with one card. Arrange opens a submenu to the right.','⇧F10 or the menu key · ↑↓ move · → open submenu · ← close · ⏎ run · Esc close.','Flips left or up near the viewport edge. Delete is clay with an icon.'),
N('103','menu-canvas','B','Context menu on the empty canvas','Right-clicked empty canvas and hovered Add component.','Paste is disabled because the clipboard is empty (the tooltip says so). Add component lists the kinds with number keys; new items land at the click point.','Same keys as 102. 1–6 inside the submenu.','Paste enables when the clipboard holds Sododeck JSON.'),
N('104','menu-group','B','Context menu on a group','Right-clicked the MESSAGING label.','Group actions. Delete group keeps its members and moves them to the parent level; the tooltip spells that out.','Same keys as 102.','Collapse reads Expand for a collapsed group.'),
N('105','fill-popover','C','Fill colour popover','Selected Payment Service, clicked Fill and picked Teal.','Fill / Stroke tabs, No colour, 13 named colours and the deck’s custom colours ending in +. The selected swatch gets a ring and a check. Hovering a custom swatch shows its remove button.','Arrows move in the grid · ⏎ apply · ⌫ removes a focused custom swatch · Esc close.','With a mixed selection no swatch is checked; picking one sets all.'),
N('106','custom-colour','C','Add a custom colour','Clicked + under Deck colours.','A saturation box, hue slider and hex field open inside the popover. The card previews the colour live; Add saves it as a deck swatch. The dark fill flips the card text to white.','Type a hex value · ⏎ add · Esc cancel.','Invalid hex shows the field error and disables Add. A deck holds up to 12 custom colours; + hides when full.'),
N('107','colour-gallery','C','Coloured cards gallery','Reference board.','All 13 named fills with title, subtitle and rules glyph; strokes; custom fills; selection, flow and error on colour.','—','Ink on fills is ≥ 12:1. Subtitles use Secondary instead of Muted on coloured fills to keep 4.5:1. Custom fills below 0.18 luminance flip to white text. The selection frame sits 2px outside the card so it reads on any fill.'),
N('108','marquee','D','Marquee selection','Shift-dragged across four cards.','A marquee rectangle; cards fully inside get the selection frame live; a count chip follows the cursor. A plain drag pans.','⇧drag select · ⌥ also selects touched cards · Esc cancel.','Releasing on empty space with nothing inside clears the selection.'),
N('109','drag-group','D','Dragging a group','Dragged the DATA label.','The group and its members move together, lifted; connections re-route live; a dashed ghost marks the start; an offset readout shows the move.','Arrows nudge 1px, ⇧ arrows 10px · Esc cancels the drag.','Dropping over another group nests it, with an Undo toast.'),
N('110','drop-into-group','D','Drop-into-group highlight','Dragged a new Tariff Service card over DISPATCH (dense deck, 100%).','The target group gets a dashed orange boundary, a soft fill and a “Drop into Dispatch” chip. The empty slot shows where the card will land.','Hold ⌥ to drop without grouping · Esc cancel.','A group only highlights when the pointer is inside it, not just the card edge.'),
N('111','snap-guides','D','Alignment guides','Dragged Pricing Service up next to Order Service.','Orange hairline guides appear when edges or centres align within 6px on screen, with distance labels to neighbours. A dashed ghost marks the start.','Hold ⌘ to disable snapping · ⇧ lock axis.','Equal gaps show matching distance labels.'),
N('112','resize','D','Resizing a card','Dragged the bottom-right handle of Dispatch Service.','Eight handles around the selection frame; the active one fills orange. A W × H readout follows the corner and connections re-attach live.','⇧ keep ratio · ⌥ resize from the centre · Esc cancel.','Minimum 120 × 44; sizes snap to 4px.'),
N('113','segment-drag','D','Dragging a connector segment','Dragged the middle segment of charge.','The segment moves perpendicular to itself; a dashed ghost shows the automatic route and the offset is shown. The route becomes manual, which enables Reset route.','⇧ snap to grid · R reset route.','Segments cannot pass through a card; they stop 12px from its edge.'),
N('114','endpoint-targets','D','Endpoint side targets','Dragged the end of charge onto SMS Gateway.','The hovered card shows four side targets; the nearest is hot. The live path is dashed orange; the old route stays as a ghost.','Esc keeps the old target · ⌥ leaves a free end.','Dropping on the same card’s side only changes the attach side.'),
N('115','keyboard','D','Keyboard: regions and context menu','Pressed F6 through the regions, then ⇧F10 on Order Service.','Numbered badges show the F6 order (deck, tools, rail, undo, canvas, zoom). The canvas region has an inset focus ring, the card a focus frame, and the keyboard-opened menu focuses its first item.','F6 / ⇧F6 cycle regions · Tab within a region · ⇧F10 context menu · Esc close.','Regions that are hidden (Hide UI) are skipped.'),
N('116','narrow','D','Narrow window 1024×768','Resized the window to 1024×768 with the drawer open.','The rail stays. Top islands collapse text into icons: the view switcher becomes a dropdown, Jump to, Labels and Focus become icons, Export is icon-only. The drawer covers about 35% of the canvas.','Same shortcuts.','Below 1024 the editor is view-only (DESIGN.md).',{vw:1024,vh:768})];
function build(id,th){const f=ST_[id]||ST_['86'];return f(th||'light');}
// lib: chrome primitives for other boards (sododeck-db.js renders these descriptors unchanged)
window.SODO_CV={build,LIST,CARDS,CUSTOM,lib:{TH,CARDS,CUSTOM,ic,cell,row,panel,ib,dv,PRIM,SEC,LAB,TXT,inp,chip,addChip,HR,tip,pill,kp,base,chrome,island,railTop,minimap,tbar,SW,popP,menu,flyout,search,microRow,drawer,dHead,secR,colourPop,VIEWS,FLOAT,KBD,FOC,mono,geist}};
return true;}
if(!init()){const t=setInterval(()=>{if(init())clearInterval(t);},50);}
})();
