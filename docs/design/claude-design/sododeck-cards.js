(function(){
const G="'Geist',system-ui,sans-serif",M="'Geist Mono',ui-monospace,monospace";
let h=null;
const X=(tag,p,k)=>h(tag,p,...[].concat(k==null?[]:k).flat(9).filter(v=>v!=null&&v!==false&&v!==''&&v!==0));
const D=(st,...k)=>X('div',{style:st},k);
const S=(st,...k)=>X('span',{style:st},k);
const as=Object.assign;
// ---------- colour math
function okl(L,C,H){const r=H*Math.PI/180,a=C*Math.cos(r),b=C*Math.sin(r);const l_=L+.3963377774*a+.2158037573*b,m_=L-.1055613458*a-.0638541728*b,s_=L-.0894841775*a-1.291485548*b;const l=l_*l_*l_,m=m_*m_*m_,s=s_*s_*s_;const R=4.0767416621*l-3.3077115913*m+.2309699292*s,Gr=-1.2684380046*l+2.6097574011*m-.3413193965*s,Bl=-.0041960863*l-.7034186147*m+1.707614701*s;const f=x=>{x=Math.max(0,Math.min(1,x));return Math.round((x<=.0031308?12.92*x:1.055*Math.pow(x,1/2.4)-.055)*255);};return '#'+[R,Gr,Bl].map(v=>f(v).toString(16).padStart(2,'0')).join('');}
function lum(hx){const v=[1,3,5].map(i=>parseInt(hx.substr(i,2),16)/255).map(c=>c<=.04045?c/12.92:Math.pow((c+.055)/1.055,2.4));return .2126*v[0]+.7152*v[1]+.0722*v[2];}
const CR=(a,b)=>{const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
const HUES=[['red',27],['orange',55],['amber',80],['yellow',100],['lime',130],['green',152],['teal',182],['cyan',215],['blue',255],['indigo',278],['violet',302],['pink',350],['slate',255]];
const PAL={};HUES.forEach(([n,hu])=>{const k=n==='slate'?.22:1,y=(n==='yellow'||n==='lime'||n==='amber')?.05:0;
 PAL[n]={n,hu,light:{fill:okl(.955,.035*k,hu),stroke:okl(.6-y*.6,.14*k,hu),ink:okl(.42,.11*k,hu),chip:okl(.915,.065*k,hu),dot:okl(.6-y*.6,.15*k,hu)},
  dark:{fill:okl(.31,.05*k,hu),stroke:okl(.72,.12*k,hu),ink:okl(.9,.07*k,hu),chip:okl(.39,.08*k,hu),dot:okl(.74,.13*k,hu)}};});
const CUSTOM=[['Navy','#1F2A44'],['Sand','#E8D5B7'],['Mint','#C9E7DC']];
const BASE={light:{app:'#e9e9e6',s:'#ffffff',s2:'#f4f4f1',s3:'#ecece8',cv:'#fafaf8',dot:'#d9d9d3',hl:'#ecece8',bd:'#deded8',bd2:'#cfcfc7',edge:'#c9c9c2',tx:'#1c1c1a',tx2:'#55554f',mu:'#72726b',ac:'#f2661c',acs:'#fdeee4',aci:'#b3480c',onac:'#1c1c1a',clay:'#9a3b25',clayS:'#f7e5df',inv:'#1c1c1a',invt:'#ffffff',sh:'rgba(0,0,0,.09)',grp:'rgba(255,255,255,.7)',selT:'#fbd9c3'},
 dark:{app:'#0b0b0a',s:'#171716',s2:'#212120',s3:'#2b2b29',cv:'#121211',dot:'#2a2a27',hl:'#262624',bd:'#35352f',bd2:'#45453f',edge:'#3d3d38',tx:'#ededea',tx2:'#b8b8b1',mu:'#909089',ac:'#f07a32',acs:'#3a2214',aci:'#ffb285',onac:'#1c1c1a',clay:'#ef9f8a',clayS:'#3a1f19',inv:'#ededea',invt:'#171716',sh:'rgba(0,0,0,.5)',grp:'rgba(255,255,255,.025)',selT:'#6a3315'}};
function TK(dir,th){const b=BASE[th],L=th==='light';const t=as({dir,th},b);
 if(dir==='A')as(t,{w:176,r:6,bw:1,cb:b.bd,pad:10,gap:6,hdr:16,tf:13.5,tw:500,tlh:1.3,df:11.5,dlh:1.4,lip:0,anc:24,rowH:19,tagRowH:17,tagPer:3,edgeR:8,edgeW:1.25,edgeC:L?'#b9b9b1':'#4d4d47'});
 if(dir==='B')as(t,{w:184,r:14,bw:1.5,cb:b.bd2,pad:12,gap:8,hdr:24,tf:14,tw:600,tlh:1.28,df:12,dlh:1.4,lip:3,anc:30,rowH:24,tagRowH:22,tagPer:3,edgeW:2,edgeC:L?'#b4b4ab':'#5a5a53'});
 if(dir==='C')as(t,{w:188,r:2,bw:1,cb:L?'#b5b5ad':'#4d4d46',pad:9,gap:5,hdr:22,tf:12.5,tw:500,tlh:1.35,df:11,dlh:1.4,lip:0,anc:36,rowH:20,tagRowH:20,tagPer:3,edgeR:0,edgeW:1,edgeC:L?'#8f8f87':'#6a6a62'});
 t.REL={calls:{dash:null,c:t.dir==='C'?t.tx2:null},reads:{dash:'6 4',c:t.dir==='C'?PAL.blue[th].stroke:null},writes:{dash:'12 3',c:t.dir==='C'?PAL.violet[th].stroke:null},depends:{dash:'1.5 4',c:t.dir==='C'?PAL.teal[th].stroke:null}};
 return t;}
// ---------- icons
function Ic(n,sz,col,sw){const L=window.lucide;let kids=[];if(L&&L.icons&&n){const k=n.split('-').map(s=>s?s[0].toUpperCase()+s.slice(1):'').join('');let node=L.icons[k];if(node){if(node[0]==='svg')node=node[2];kids=node.map(([tg,a],i)=>h(tg,as({key:i},a)));}}
 return h('svg',{width:sz,height:sz,viewBox:'0 0 24 24',fill:'none',stroke:col||'currentColor',strokeWidth:sw||1.75,strokeLinecap:'round',strokeLinejoin:'round',style:{flex:'none',display:'block'}},kids);}
// ---------- data
const TYPES={service:{icon:'box',name:'Service',cat:'Architecture'},database:{icon:'database',name:'Database',cat:'Architecture'},gateway:{icon:'router',name:'API gateway',cat:'Architecture'},client:{icon:'monitor-smartphone',name:'Client',cat:'Architecture'},queue:{icon:'arrow-left-right',name:'Queue',cat:'Architecture'},external:{icon:'cloud',name:'External',cat:'Architecture'},component:{icon:'puzzle',name:'Component',cat:'Architecture'},
 task:{icon:'square-check-big',name:'Task',cat:'Process'},decision:{icon:'diamond',name:'Decision',cat:'Process'},document:{icon:'file-text',name:'Document',cat:'Process'},
 warehouse:{icon:'warehouse',name:'Warehouse',cat:'Logistics'},truck:{icon:'truck',name:'Truck route',cat:'Logistics'},ticket:{icon:'ticket',name:'Issue',cat:'Data'}};
const STAT={'In progress':['blue','circle-dot'],'Open':['green','door-open'],'In review':['violet','eye'],'To do':['slate','circle-dashed'],'Done':['green','circle-check'],'Blocked':['red','circle-x']};
const TAGC={critical:'red',pci:'violet','1 pt':'slate','11 pts':'blue','2 pts':'teal','3 pts':'green','5 pts':'amber','8 pts':'orange',Lan:'pink',PIC:'indigo',api:'cyan',legacy:'yellow',beta:'lime',eu:'blue',mobile:'teal',ops:'slate',q4:'amber',payments:'green'};
const TEN=['critical','pci','api','legacy','beta','eu','mobile','ops','q4','payments'];
const K={
 svc:{type:'service',title:'Order Service',desc:'Creates orders and holds stock until payment clears.',fields:[{k:'Tech',v:'Go'},{k:'Owner',v:'Payments team',ft:'person'}],tags:['critical','pci'],id:'SVC-014'},
 dbc:{type:'database',title:'Orders DB',desc:'PostgreSQL 16, primary and one replica',fields:[{k:'Size',v:'120 GB',ft:'number'}],color:'blue',id:'DB-003'},
 task:{type:'task',title:'Reserve stock',status:'In progress',fields:[{k:'Assignee',v:'Lan',ft:'person'},{k:'Due',v:'14 Oct',ft:'date'}],id:'T-221'},
 wh:{type:'warehouse',title:'Warehouse HCM',status:'Open',fields:[{k:'Capacity',v:82,ft:'progress'},{k:'SLA',v:'24 h',ft:'number'}],color:'teal',id:'WH-02'},
 truck:{type:'truck',title:'Truck HCM → Hanoi',desc:'Route R-12, 1,700 km',fields:[{k:'Departs',v:'Mon 06:00',ft:'date'}],id:'RT-12'},
 data:{type:'ticket',typeName:'CHK-142',title:'Retry payment webhook on timeout',status:'In review',fields:[{k:'Assignee',v:'Lan',ft:'person'},{k:'Estimate',v:'5 pts',ft:'number'},{k:'Dates',v:'6–17 Oct',ft:'range'}],tags:['1 pt','11 pts','2 pts','3 pts','5 pts','8 pts','Lan','PIC'],id:'CHK-142'},
 gw:{type:'gateway',title:'API Gateway',desc:'Kong, rate-limited',id:'GW-01'},
 web:{type:'client',title:'Web checkout',desc:'Next.js storefront',id:'CL-01'},
 an:{type:'queue',title:'Order events',desc:'Kafka topic',id:'Q-07'},
 nt:{type:'service',title:'Notifications',desc:'Email and push',id:'SVC-031'},
 bank:{type:'external',title:'Bank API',desc:'Acquirer, 3DS',id:'EXT-02'},
 pay:{type:'service',title:'Payment gateway',fields:[{k:'Tech',v:'Kotlin'}],id:'SVC-020'},
 fraud:{type:'service',title:'Fraud check',desc:'Rules + score',id:'SVC-021'},
 ledger:{type:'database',title:'Ledger',desc:'Double-entry store',id:'DB-009'}
};
const GPAY={title:'Payments',n:3,members:['Payment gateway','Fraud check','Ledger'],icons:['box','box','database'],color:'violet',id:'GRP-03'};
// ---------- helpers
function lines(text,w,fs,max){if(!text)return 0;const cpl=Math.max(4,Math.floor(w/(fs*.54)));let n=1,cur=0;String(text).split(' ').forEach(wd=>{const l=wd.length;if(cur===0)cur=l;else if(cur+1+l<=cpl)cur+=1+l;else{n++;cur=l;}});return Math.min(max||3,n);}
function est(t,c){const w=c.w||t.w,iw=w-2*t.pad-2*t.bw;let H=t.dir==='C'?2*t.bw+t.hdr+2*t.pad:2*t.bw+2*t.pad+t.hdr;
 H+=t.gap+lines(c.title,iw,t.tf)*t.tf*t.tlh;if(c.desc)H+=t.gap+lines(c.desc,iw,t.df)*t.df*t.dlh;
 const nf=(c.fields||[]).length+(c.more?1:0);if(nf)H+=t.gap+nf*t.rowH;
 const nt=(c.tags||[]).length;if(nt)H+=(t.dir==='C'?12:t.gap)+Math.ceil(nt/Math.max(1,Math.round(t.tagPer*w/t.w)))*t.tagRowH;
 if(c.kids)H+=t.gap+24;return Math.round(H);}
const initials=v=>{const w=String(v).trim().split(/\s+/);return (w.length>1?w[0][0]+w[1][0]:w[0].slice(0,2)).toUpperCase();};
const clamp=n=>({display:'-webkit-box',WebkitLineClamp:n,WebkitBoxOrient:'vertical',overflow:'hidden'});
const ml=(t,txt,st)=>S(as({fontSize:t.dir==='C'?9.5:10.5,letterSpacing:'.07em',textTransform:'uppercase',color:t.mu,fontWeight:500,fontFamily:t.dir==='C'?M:G,whiteSpace:'nowrap'},st||{}),txt);
const kbd=(t,k)=>S({fontFamily:M,fontSize:10,color:t.tx2,border:`1px solid ${t.bd}`,borderRadius:t.dir==='C'?1:4,padding:'0 4px',height:16,display:'inline-flex',alignItems:'center',flex:'none'},k);
function chip(t,label,cn,icon,o){o=o||{};const p=PAL[cn]?PAL[cn][t.th]:{stroke:t.mu,chip:t.s2,ink:t.tx2,dot:t.mu};const sm=o.sm;
 if(t.dir==='A')return S({display:'inline-flex',alignItems:'center',gap:4,height:sm?15:17,fontSize:sm?10.5:11,color:t.tx2,whiteSpace:'nowrap',flex:'none'},icon?Ic(icon,11,p.dot,2.25):S({width:6,height:6,borderRadius:3,background:p.dot,flex:'none'}),label,o.x&&Ic('x',11,t.mu));
 if(t.dir==='B')return S({display:'inline-flex',alignItems:'center',gap:4,height:sm?18:21,padding:sm?'0 6px':'0 8px 0 7px',borderRadius:999,background:p.chip,color:p.ink,fontSize:sm?10.5:11.5,fontWeight:500,whiteSpace:'nowrap',flex:'none'},icon&&Ic(icon,12,p.ink,2),label,o.x&&Ic('x',11,p.ink));
 return S({display:'inline-flex',alignItems:'center',gap:4,height:sm?15:17,padding:'0 4px',border:`1px solid ${p.stroke}`,borderRadius:1,fontFamily:M,fontSize:sm?9.5:10,color:t.tx,textTransform:'uppercase',letterSpacing:'.02em',whiteSpace:'nowrap',flex:'none'},icon?Ic(icon,10,p.stroke,2.25):S({width:6,height:6,background:p.stroke,flex:'none'}),label,o.x&&Ic('x',10,t.mu));}
const statChip=(t,v,o)=>{const s=STAT[v]||['slate','circle-dashed'];return chip(t,v,s[0],s[1],o);};
function person(t,v){const B=t.dir==='B',C=t.dir==='C';const av=S({width:16,height:16,borderRadius:C?1:8,background:B?t.s3:'transparent',border:B?'none':`1px solid ${t.bd2}`,display:'inline-flex',alignItems:'center',justifyContent:'center',fontFamily:M,fontSize:7.5,fontWeight:600,color:t.tx2,flex:'none',boxSizing:'border-box'},initials(v));
 const nm=S({overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'},v);
 if(B)return S({display:'inline-flex',alignItems:'center',gap:5,height:21,padding:'0 8px 0 3px',borderRadius:999,background:t.s2,fontSize:11.5,fontWeight:500,color:t.tx,minWidth:0,flex:'none'},av,nm);
 return S({display:'inline-flex',alignItems:'center',gap:5,fontSize:11,color:t.tx,minWidth:0},av,nm);}
function neutralChip(t,icon,v){if(t.dir==='B')return S({display:'inline-flex',alignItems:'center',gap:4,height:21,padding:'0 8px 0 6px',borderRadius:999,background:t.s2,fontSize:11.5,fontWeight:500,color:t.tx,flex:'none',whiteSpace:'nowrap'},Ic(icon,12,t.tx2,2),v);
 return S({display:'inline-flex',alignItems:'center',gap:4,fontFamily:M,fontSize:10.5,color:t.tx,whiteSpace:'nowrap'},Ic(icon,11,t.mu,2),v);}
function progress(t,v){const A=t.dir==='A',B=t.dir==='B';
 if(t.dir==='C')return D({display:'flex',alignItems:'center',gap:6,width:'100%'},D({display:'flex',gap:2,flex:1},Array.from({length:10},(_,i)=>D({flex:1,height:7,boxSizing:'border-box',border:`1px solid ${t.tx2}`,background:i<Math.round(v/10)?t.tx2:'transparent'}))),S({fontFamily:M,fontSize:10,color:t.tx},v+'%'));
 return D({display:'flex',alignItems:'center',gap:6,width:'100%'},D({flex:1,height:B?8:4,borderRadius:B?4:2,background:t.s3,overflow:'hidden'},D({width:v+'%',height:'100%',background:t.tx2,borderRadius:B?4:0})),S({fontFamily:M,fontSize:10.5,color:t.tx},v+' %'));}
function fval(t,f){switch(f.ft){case 'select':return chip(t,f.v,f.c||'slate');case 'status':return statChip(t,f.v);case 'person':return person(t,f.v);
 case 'date':return neutralChip(t,'calendar',f.v);case 'range':return neutralChip(t,'calendar-range',f.v);
 case 'link':return S({display:'inline-flex',alignItems:'center',gap:4,fontSize:11,color:t.tx,minWidth:0},Ic('link',11,t.mu,2),S({textDecoration:'underline',textUnderlineOffset:2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'},f.v));
 case 'progress':return progress(t,f.v);case 'number':return S({fontFamily:M,fontSize:t.dir==='B'?11.5:10.5,color:t.tx},f.v);
 default:return S({fontSize:t.dir==='B'?12:11.5,color:t.tx,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'},f.v);}}
const CHIPT={select:1,status:1,person:1,date:1,range:1};
function fieldsBlock(t,fields,more,onFill){const lab=onFill?t.tx2:t.mu;fields=fields||[];
 if(t.dir==='A'){return D({display:'flex',flexDirection:'column',gap:0},fields.map(f=>D({display:'grid',gridTemplateColumns:'54px minmax(0,1fr)',columnGap:8,alignItems:'center',minHeight:19},S({fontSize:10.5,color:lab,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'},f.k),D({minWidth:0,display:'flex'},fval(t,f)))),
  more&&D({display:'flex',alignItems:'center',gap:4,minHeight:19,fontSize:10.5,color:t.tx2},Ic('chevrons-right',11,t.mu,2),more+' more fields'));}
 if(t.dir==='B'){const ch=fields.filter(f=>CHIPT[f.ft]),rw=fields.filter(f=>!CHIPT[f.ft]);
  return D({display:'flex',flexDirection:'column',gap:5},ch.length&&D({display:'flex',flexWrap:'wrap',gap:4},ch.map(f=>fval(t,f))),
   rw.map(f=>D({display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,minHeight:19},S({fontSize:11.5,color:lab,whiteSpace:'nowrap'},f.k),D({minWidth:0,display:'flex',justifyContent:'flex-end',flex:f.ft==='progress'?1:'none'},fval(t,f)))),
   more&&S({alignSelf:'flex-start',display:'inline-flex',alignItems:'center',gap:4,height:20,padding:'0 8px',borderRadius:999,border:`1.5px dashed ${t.bd2}`,fontSize:11,fontWeight:500,color:t.tx2},'+'+more+' fields'));}
 return D({display:'flex',flexDirection:'column'},fields.map(f=>D({display:'grid',gridTemplateColumns:'58px minmax(0,1fr)',columnGap:6,alignItems:'center',minHeight:20,borderTop:`1px solid ${t.hl}`},S({fontFamily:M,fontSize:9,letterSpacing:'.05em',textTransform:'uppercase',color:lab,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'},f.k),D({minWidth:0,display:'flex'},fval(t,f)))),
  more&&D({display:'flex',alignItems:'center',gap:4,minHeight:20,borderTop:`1px solid ${t.hl}`,fontFamily:M,fontSize:9,letterSpacing:'.05em',color:t.tx2},'+'+more+' FIELDS IN DRAWER',Ic('arrow-up-right',10,t.mu,2)));}
function tagsBlock(t,tags){return D({display:'flex',flexWrap:'wrap',columnGap:t.dir==='A'?8:4,rowGap:t.dir==='A'?1:4},tags.map(g=>chip(t,g,TAGC[g]||'slate',null,{sm:true})));}
function probBadge(t){if(t.dir==='B')return S({display:'inline-flex',alignItems:'center',gap:3,height:20,padding:'0 7px 0 5px',borderRadius:999,background:t.clayS,color:t.clay,fontSize:11,fontWeight:600,flex:'none'},Ic('triangle-alert',12,t.clay,2.25),'2');
 if(t.dir==='C')return S({display:'inline-flex',alignItems:'center',gap:3,height:15,padding:'0 3px',border:`1px solid ${t.clay}`,color:t.clay,fontFamily:M,fontSize:9.5,flex:'none'},Ic('triangle-alert',10,t.clay,2.25),'2');
 return S({display:'inline-flex',alignItems:'center',gap:3,color:t.clay,fontSize:10.5,fontWeight:600,flex:'none'},Ic('triangle-alert',12,t.clay,2.25),'2');}
function stepBadge(t,ph,n){if(!ph||ph==='src'&&n==null)return null;const done=ph==='done'||ph==='src',cur=ph==='cur',nx=ph==='next';const num=n==null?'':String(n).padStart(t.dir==='A'?2:1,'0');
 if(t.dir==='A'){if(n==null&&!done)return null;return D({position:'absolute',right:8,top:-9,height:17,padding:'0 5px',borderRadius:4,fontFamily:M,fontSize:10,fontWeight:500,display:'flex',alignItems:'center',gap:3,boxSizing:'border-box',background:cur?t.ac:done?t.tx:t.s,color:cur?t.onac:done?t.s:t.tx2,border:nx?`1px dashed ${t.tx2}`:'none',zIndex:3},done&&Ic('check',10,t.s,2.5),cur&&Ic('play',9,t.onac,2.5),num);}
 if(t.dir==='B'){if(n==null&&!done)return null;return D({position:'absolute',left:-9,top:-9,width:cur?26:22,height:cur?26:22,borderRadius:99,boxSizing:'border-box',display:'flex',alignItems:'center',justifyContent:'center',fontSize:cur?12.5:11,fontWeight:700,background:cur?t.ac:done?t.tx:t.s,color:cur?t.onac:done?t.s:t.tx2,border:nx?`1.5px dashed ${t.tx2}`:`2px solid ${t.s}`,zIndex:3},done?Ic('check',12,t.s,3):num);}
 if(n==null&&!done)return null;
 return D({position:'absolute',left:10,top:-30,display:'flex',flexDirection:'column',alignItems:'center',zIndex:3},D({width:22,height:22,borderRadius:99,boxSizing:'border-box',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:M,fontSize:10.5,fontWeight:500,background:cur?t.ac:done?t.tx:t.cv,color:cur?t.onac:done?t.s:t.tx2,border:nx?`1px dashed ${t.tx2}`:`1px solid ${cur?t.ac:t.tx}`},done&&n==null?Ic('check',11,t.s,2.5):num),D({width:1,height:8,background:cur?t.ac:t.tx2}));}
function handles(t,act){const A=t.dir==='A',B=t.dir==='B';return [['l','0%','50%'],['r','100%','50%'],['t','50%','0%'],['b','50%','100%']].map(([sd,x,y])=>{const on=act===sd,v=sd==='l'||sd==='r';let st;
 if(A)st={width:v?(on?4:3):(on?16:12),height:v?(on?16:12):(on?4:3),borderRadius:2,background:on?t.ac:t.tx2,boxShadow:`0 0 0 2px ${t.cv}`};
 else if(B)st={width:on?16:12,height:on?16:12,borderRadius:99,background:on?t.ac:t.s,border:`2px solid ${on?t.ac:t.tx2}`,boxShadow:on?`0 0 0 4px ${t.acs}`:'none'};
 else st={width:on?9:7,height:on?9:7,background:on?t.ac:t.s,border:`1px solid ${on?t.ac:t.tx}`};
 return D(as({position:'absolute',left:x,top:y,transform:'translate(-50%,-50%)',boxSizing:'border-box',zIndex:4},st));});}
function editTitle(t,txt){const i=txt.lastIndexOf(' ');return [txt.slice(0,i+1),S({background:t.selT},txt.slice(i+1)),S({display:'inline-block',width:1.5,height:'1.05em',background:t.ac,verticalAlign:'-.15em',marginLeft:1})];}
// ---------- information card
function card(t,c,s){s=s||{};const A=t.dir==='A',B=t.dir==='B',C=t.dir==='C',z=s.zoom||'cmp';
 const w=c.w||t.w,TY=TYPES[c.type]||{},icon=c.icon||TY.icon||'square',tname=c.typeName!==undefined?c.typeName:TY.name;
 const col=c.color?PAL[c.color][t.th]:null,fill=col?col.fill:t.s,base=col?col.stroke:t.cb,ph=s.ph,lit=ph==='cur'||ph==='src';
 let stroke=base,bw=t.bw;if(s.hover||s.nb)stroke=col&&!s.nb?base:(C?t.tx:t.tx2);if(lit||s.target){stroke=t.ac;bw=Math.max(1.5,bw);}
 let lip=t.lip;if(B&&(s.hover||ph==='cur'||s.nb))lip=5;if(B&&s.drag)lip=6;
 const sh=[];if(B)sh.push(`0 ${lip}px 0 0 ${lit?t.ac:s.nb?t.tx2:base}`);if(ph==='cur'&&!B)sh.push(`0 0 0 4px ${t.acs}`);if(s.drag)sh.push(`0 14px 30px ${t.sh}`);
 let tr=null;if(B&&(s.hover||ph==='cur'))tr='translateY(-2px)';if(s.drag)tr=B?'rotate(-2.5deg)':'translate(0,-2px)';
 let ol=null,oo=2;if(s.problem){ol=`1.5px dashed ${t.clay}`;oo=4;}if(s.sel){ol=`2px solid ${t.ac}`;oo=C?3:2;}
 const root={position:c.x!=null?'absolute':'relative',left:c.x,top:c.y,width:w,flex:'none',boxSizing:'border-box',background:fill,border:`${bw}px solid ${stroke}`,borderRadius:t.r,boxShadow:sh.length?sh.join(','):'none',transform:tr,outline:ol,outlineOffset:oo,opacity:s.dim?.22:1,fontFamily:G,color:t.tx,display:'flex',flexDirection:'column',textAlign:'left',zIndex:s.drag?5:1};
 if(z!=='cmp')root.height=s.H||est(t,c);
 const extras=[];if(s.hover||s.target||s.handles)extras.push(handles(t,s.target?'l':null));if(ph)extras.push(stepBadge(t,ph,s.n));
 if(z==='land')return D(as(root,{alignItems:'center',justifyContent:'center',background:col?col.fill:t.s2}),Ic(icon,30,col?col.ink:t.tx2,1.5),extras);
 const full=z==='ctr'||z==='cmp',lab=col?t.tx2:t.mu;
 const badges=[];if(full&&c.status)badges.push(w<150?Ic(STAT[c.status][1],13,PAL[STAT[c.status][0]][t.th].dot,2.25):statChip(t,c.status,{sm:true}));if(c.pin)badges.push(Ic('pin',12,t.mu,2));if(s.problem)badges.push(probBadge(t));
 let hdr;
 if(A)hdr=D({display:'flex',alignItems:'center',gap:5,height:16,minWidth:0},Ic(icon,13,col?col.ink:t.tx2,1.75),full&&tname&&S({fontSize:10,letterSpacing:'.07em',textTransform:'uppercase',color:lab,fontWeight:500,flex:1,minWidth:0,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'},tname),!full&&S({flex:1}),badges);
 else if(B)hdr=D({display:'flex',alignItems:'center',gap:6,height:24,minWidth:0},D({width:24,height:24,borderRadius:8,background:col?col.chip:t.s2,color:col?col.ink:t.tx2,display:'flex',alignItems:'center',justifyContent:'center',flex:'none'},Ic(icon,14,null,2)),full&&tname&&S({fontSize:11.5,fontWeight:500,color:lab,flex:1,minWidth:0,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'},tname),!full&&S({flex:1}),badges);
 else hdr=D({display:'flex',alignItems:'center',gap:5,height:22,padding:'0 7px 0 8px',borderBottom:`1px solid ${lit?t.ac:base}`,background:ph==='cur'?t.acs:'transparent',fontFamily:M,fontSize:9.5,letterSpacing:'.06em',textTransform:'uppercase',color:ph==='cur'?t.aci:t.tx2,minWidth:0,flex:'none'},Ic(icon,12,null,1.75),S({flex:1,minWidth:0,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'},full?(ph==='cur'?'Step '+String(s.n).padStart(2,'0')+' · now':tname):''),full&&!badges.length&&ph!=='cur'&&c.id&&S({color:lab,flex:'none'},c.id),badges);
 const title=D(as({fontSize:t.tf,fontWeight:t.tw,lineHeight:t.tlh,letterSpacing:A?'-.01em':0,color:t.tx,overflowWrap:'break-word'},clamp(3)),s.edit?editTitle(t,c.title):c.title);
 const desc=full&&c.desc&&D(as({fontSize:t.df,lineHeight:t.dlh,color:t.tx2,textWrap:'pretty'},clamp(3)),c.desc);
 const flds=z==='cmp'&&(c.fields&&c.fields.length||c.more)&&fieldsBlock(t,c.fields,c.more,!!col);
 const tg=z==='cmp'&&c.tags&&c.tags.length&&tagsBlock(t,c.tags);
 const kids=c.kids&&(A?D({display:'flex',alignItems:'center',gap:5,fontSize:11,color:t.tx2,borderTop:`1px solid ${col?base:t.hl}`,paddingTop:6},Ic('layers',12,t.tx2,2),c.kids+' parts inside',S({flex:1}),kbd(t,'⏎'))
  :B?D({display:'flex',alignItems:'center',gap:5,height:24,padding:'0 4px 0 8px',borderRadius:999,background:t.s2,fontSize:11.5,fontWeight:500,color:t.tx},Ic('layers',13,t.tx2,2),c.kids+' inside',S({flex:1}),kbd(t,'⏎'))
  :D({display:'flex',alignItems:'center',gap:5,height:22,padding:'0 8px',borderTop:`1px solid ${base}`,fontFamily:M,fontSize:9.5,letterSpacing:'.05em',color:t.tx2},Ic('layers',11,t.tx2,2),c.kids+' PARTS',S({flex:1}),'ENTER ⏎'));
 if(C){const ft=tg&&D({borderTop:`1px solid ${base}`,padding:'5px 8px'},tg);
  return D(root,hdr,D({display:'flex',flexDirection:'column',gap:t.gap,padding:`${t.pad}px ${t.pad}px`},title,desc,flds),ft,kids,extras);}
 return D(as(root,{gap:t.gap,padding:`${t.pad}px ${t.pad+1}px`}),hdr,title,desc,flds,tg,kids,extras);}
// ---------- shapes
function geo(k,w,H,i){const r=(a)=>a;switch(k){
 case 'rect':return `M${i} ${i}H${w-i}V${H-i}H${i}Z`;
 case 'rrect':case 'pill':{const rr=k==='pill'?(H-2*i)/2:Math.min(12,H/4);return `M${i+rr} ${i}H${w-i-rr}A${rr} ${rr} 0 0 1 ${w-i} ${i+rr}V${H-i-rr}A${rr} ${rr} 0 0 1 ${w-i-rr} ${H-i}H${i+rr}A${rr} ${rr} 0 0 1 ${i} ${H-i-rr}V${i+rr}A${rr} ${rr} 0 0 1 ${i+rr} ${i}Z`;}
 case 'ellipse':{const rx=w/2-i,ry=H/2-i;return `M${i} ${H/2}A${rx} ${ry} 0 1 0 ${w-i} ${H/2}A${rx} ${ry} 0 1 0 ${i} ${H/2}Z`;}
 case 'diamond':return `M${w/2} ${i}L${w-i} ${H/2}L${w/2} ${H-i}L${i} ${H/2}Z`;
 case 'cylinder':{const ry=Math.min(10,H*.14),rx=w/2-i;return `M${i} ${i+ry}A${rx} ${ry} 0 0 1 ${w-i} ${i+ry}V${H-i-ry}A${rx} ${ry} 0 0 1 ${i} ${H-i-ry}Z`;}
 case 'document':return `M${i} ${i}H${w-i}V${H*.84}Q${w*.75} ${H*.7} ${w/2} ${H*.84}T${i} ${H*.84}Z`;
 case 'parallelogram':{const o=H*.32;return `M${i+o} ${i}H${w-i}L${w-i-o} ${H-i}H${i}Z`;}
 case 'hexagon':{const o=H*.3;return `M${i+o} ${i}H${w-i-o}L${w-i} ${H/2}L${w-i-o} ${H-i}H${i+o}L${i} ${H/2}Z`;}
 case 'sticky':return `M${i} ${i}H${w-i}V${H-i-16}L${w-i-16} ${H-i}H${i}Z`;
 default:return `M${i} ${i}H${w-i}V${H-i}H${i}Z`;}}
const INSET={diamond:[.24,.22],ellipse:[.15,.14],hexagon:[.2,.1],parallelogram:[.2,.1],cylinder:[.06,.24],document:[.07,.08,.24],pill:[.1,.1],sticky:[.08,.08],actor:[0,0]};
const SHAPEN={rect:'Rectangle',rrect:'Rounded rectangle',ellipse:'Ellipse',diamond:'Diamond',pill:'Pill',cylinder:'Cylinder',document:'Document',parallelogram:'Parallelogram',hexagon:'Hexagon',actor:'Actor',sticky:'Sticky note',text:'Text',frame:'Frame'};
function shape(t,c,s){s=s||{};const A=t.dir==='A',B=t.dir==='B',C=t.dir==='C',k=c.shape,w=c.w||120,H=c.h||64,z=s.zoom||'cmp';
 const col=c.color?PAL[c.color][t.th]:null,ph=s.ph,lit=ph==='cur'||ph==='src';
 let fill=col?col.fill:t.s,stroke=col?col.stroke:t.cb;
 if(k==='sticky'){const p=PAL.yellow[t.th];fill=p.chip;stroke=B?p.stroke:(C?p.stroke:'none');}
 if(s.hover||s.nb)stroke=C?t.tx:t.tx2;if(lit||s.target)stroke=t.ac;
 const err=s.err;if(err)stroke=t.clay;
 const sw=lit?1.75:(B?1.5:1),i=4;const vb={width:w,height:H,style:{position:'absolute',left:0,top:0,overflow:'visible'}};
 const P=[];const dash=k==='frame'?'5 4':(ph==='next'&&err?'5 3':null);
 if(k==='actor'){const cx=w/2;P.push(h('circle',{key:'h',cx,cy:14,r:10,fill,stroke:lit?t.ac:t.tx2,strokeWidth:sw}),h('path',{key:'b',d:`M${cx} 24V48M${cx-16} 33H${cx+16}M${cx} 48L${cx-13} 66M${cx} 48L${cx+13} 66`,fill:'none',stroke:lit?t.ac:t.tx2,strokeWidth:sw+.25,strokeLinecap:'round'}));}
 else if(k!=='text'){const d=geo(k,w,H,i);
  if(ph==='cur')P.push(h('path',{key:'halo',d,fill:'none',stroke:t.acs,strokeWidth:9,strokeLinejoin:'round'}));
  if(B&&k!=='frame')P.push(h('path',{key:'lip',d,transform:`translate(0 ${s.hover||ph==='cur'?5:3})`,fill:lit?t.ac:(k==='sticky'?PAL.yellow[t.th].stroke:stroke)}));
  if(k==='sticky'&&!B)P.push(h('path',{key:'sh',d,transform:'translate(0 2)',fill:t.sh}));
  P.push(h('path',{key:'m',d,fill:k==='frame'?'none':fill,stroke:stroke==='none'?'none':stroke,strokeWidth:sw,strokeDasharray:dash,strokeLinejoin:'round'}));
  if(k==='cylinder'){const ry=Math.min(10,H*.14),rx=w/2-i;P.push(h('path',{key:'rim',d:`M${i} ${i+ry}A${rx} ${ry} 0 0 0 ${w-i} ${i+ry}`,fill:'none',stroke,strokeWidth:sw}));}
  if(k==='sticky')P.push(h('path',{key:'f',d:`M${w-i} ${H-i-16}H${w-i-16}V${H-i}`,fill:PAL.yellow[t.th].stroke,fillOpacity:.35,stroke:'none'}));}
 const ins=INSET[k]||[.06,.06];
 const ts={fontSize:k==='text'?15:(B?13:12.5),fontWeight:k==='text'?500:(B?600:500),lineHeight:1.3,color:t.tx,textAlign:'center',textWrap:'pretty',overflowWrap:'anywhere'};
 let tx;
 if(k==='frame')tx=D({position:'absolute',left:10,top:8,fontFamily:C?M:G,fontSize:C?9.5:10.5,letterSpacing:'.07em',textTransform:'uppercase',color:t.tx2,fontWeight:500},c.title);
 else if(k==='actor')tx=D(as({position:'absolute',left:-20,right:-20,top:72},ts,clamp(2)),c.title);
 else tx=z==='land'?null:D({position:'absolute',left:w*ins[0]+4,right:w*ins[0]+4,top:H*ins[1]+(k==='cylinder'?2:0),bottom:H*(ins[2]||ins[1]),display:'flex',alignItems:'center',justifyContent:'center'},D(as({},ts,clamp(3)),s.edit?editTitle(t,c.title):c.title));
 let ol=null,oo=3;if(s.problem){ol=`1.5px dashed ${t.clay}`;oo=5;}if(s.sel){ol=`2px solid ${t.ac}`;oo=4;}
 const extra=[];if(C&&s.label!==false&&k!=='text'&&k!=='frame')extra.push(D({position:'absolute',right:0,top:-15,fontFamily:M,fontSize:9,letterSpacing:'.06em',color:t.mu,textTransform:'uppercase',whiteSpace:'nowrap'},c.tn||SHAPEN[k]));
 if(ph)extra.push(stepBadge(t,ph,s.n));
 if(s.problem)extra.push(D({position:'absolute',right:-6,top:-8,zIndex:3},probBadge(t)));
 if(err)extra.push(D({position:'absolute',left:'50%',bottom:-9,transform:'translateX(-50%)',display:'flex',alignItems:'center',gap:3,height:17,padding:'0 6px',borderRadius:B?99:C?1:4,background:t.clayS,color:t.clay,fontSize:10.5,fontWeight:600,fontFamily:C?M:G,whiteSpace:'nowrap',zIndex:3},Ic('octagon-x',11,t.clay,2.25),'Error end'));
 if(s.hover||s.target||s.handles)extra.push(handles(t,s.target?'l':null));
 if(s.kids)extra.push(D({position:'absolute',left:'50%',bottom:-11,transform:'translateX(-50%)',zIndex:3},kidsPill(t,s.kids)));
 let tr=null;if(s.drag)tr=B?'rotate(-3deg)':'translate(0,-2px)';
 return D({position:c.x!=null?'absolute':'relative',left:c.x,top:c.y,width:w,height:H,flex:'none',opacity:s.dim?.22:1,outline:ol,outlineOffset:oo,borderRadius:4,transform:tr,filter:null,zIndex:s.drag?5:1},X('svg',vb,P),tx,extra);}
function kidsPill(t,n){return S({display:'inline-flex',alignItems:'center',gap:4,height:20,padding:'0 4px 0 6px',background:t.s,border:`1px solid ${t.bd2}`,borderRadius:t.dir==='B'?99:t.dir==='C'?1:5,fontSize:10.5,fontFamily:t.dir==='C'?M:G,color:t.tx2,whiteSpace:'nowrap'},Ic('layers',11,t.tx2,2),n+' inside',kbd(t,'⏎'));}
// ---------- collapsed group & frame
function stackH(t){return t.dir==='A'?100:t.dir==='B'?112:120;}
function stack(t,g,s){s=s||{};const A=t.dir==='A',B=t.dir==='B',C=t.dir==='C',w=g.w||t.w,H=g.h||stackH(t);const col=g.color?PAL[g.color][t.th]:null,fill=col?col.fill:t.s,stroke=col?col.stroke:t.cb;
 const back=(dx,dy,rot)=>D({position:'absolute',left:dx,top:dy,width:w,height:H,boxSizing:'border-box',background:fill,border:`${t.bw}px solid ${stroke}`,borderRadius:t.r,transform:rot?`rotate(${rot}deg)`:null,transformOrigin:'50% 100%',boxShadow:B?`0 3px 0 0 ${stroke}`:'none'});
 const backs=A?[back(8,-8),back(4,-4)]:B?[back(0,0,-7),back(0,0,4)]:[back(8,8),back(4,4)];
 let ol=null;if(s.sel)ol=`2px solid ${t.ac}`;
 const fr={position:'absolute',left:0,top:0,width:w,height:H,boxSizing:'border-box',background:fill,border:`${s.nb?1.5:t.bw}px solid ${s.nb?t.tx2:stroke}`,borderRadius:t.r,boxShadow:B?`0 ${s.nb?5:3}px 0 0 ${s.nb?t.tx2:stroke}`:'none',display:'flex',flexDirection:'column',fontFamily:G,color:t.tx,outline:ol,outlineOffset:2};
 let front;
 if(A)front=D(as(fr,{padding:'10px 11px',gap:6}),D({display:'flex',alignItems:'center',gap:5},Ic('layers',13,col?col.ink:t.tx2),S({fontSize:10,letterSpacing:'.07em',textTransform:'uppercase',color:t.tx2,fontWeight:500,flex:1},'Group'),S({fontFamily:M,fontSize:10.5,color:t.tx},g.n+' cards')),D({fontSize:13.5,fontWeight:500,letterSpacing:'-.01em'},g.title),D(as({fontSize:11,color:t.tx2,lineHeight:1.4},clamp(2)),g.members.join(' · ')));
 else if(B)front=D(as(fr,{padding:'11px 12px',gap:7}),D({display:'flex',alignItems:'center',gap:6},D({width:24,height:24,borderRadius:8,background:col?col.chip:t.s2,color:col?col.ink:t.tx2,display:'flex',alignItems:'center',justifyContent:'center'},Ic('layers',14,null,2)),S({fontSize:11.5,fontWeight:500,color:t.tx2,flex:1},'Group'),D({minWidth:26,height:26,borderRadius:99,background:t.tx,color:t.s,display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:700},g.n)),D({fontSize:14,fontWeight:600},g.title),D({display:'flex',gap:4},g.icons.map(ic=>D({width:22,height:22,borderRadius:7,background:t.s,border:`1.5px solid ${stroke}`,display:'flex',alignItems:'center',justifyContent:'center',boxSizing:'border-box'},Ic(ic,12,t.tx2,2)))));
 else front=D(fr,D({display:'flex',alignItems:'center',gap:5,height:22,padding:'0 8px',borderBottom:`1px solid ${stroke}`,fontFamily:M,fontSize:9.5,letterSpacing:'.06em',color:t.tx2},Ic('layers',12,null,1.75),S({flex:1},'GROUP · '+g.n+' SHEETS'),S({color:t.mu},g.id)),D({padding:'7px 9px 4px',fontSize:12.5,fontWeight:500},g.title),D({padding:'0 9px'},g.members.map((m,i)=>D({display:'flex',gap:6,fontFamily:M,fontSize:9.5,lineHeight:'17px',color:t.tx2,borderTop:`1px solid ${t.hl}`,textTransform:'uppercase'},S({color:t.mu},String(i+1).padStart(2,'0')),m))));
 return D({position:g.x!=null?'absolute':'relative',left:g.x,top:g.y,width:w,height:H,flex:'none',opacity:s.dim?.22:1,zIndex:1},backs,front);}
function frame(t,f){const A=t.dir==='A',B=t.dir==='B',C=t.dir==='C';const col=f.color?PAL[f.color][t.th]:null;const st={position:'absolute',left:f.x,top:f.y,width:f.w,height:f.h,boxSizing:'border-box',opacity:f.dim?.22:1};
 if(A){as(st,{border:`1px solid ${t.bd}`,borderRadius:10,background:t.grp});return D(st,D({position:'absolute',left:12,top:9,display:'flex',alignItems:'center',gap:6},Ic('chevron-down',12,t.tx2,2),ml(t,f.title,{color:t.tx2}),S({fontFamily:M,fontSize:10.5,color:t.mu},f.n)));}
 if(B){as(st,{border:`1.5px solid ${col?col.stroke:t.bd2}`,borderRadius:20,background:col?col.fill:t.s2});return D(st,D({position:'absolute',left:16,top:-14,display:'flex',alignItems:'center',gap:6,height:28,padding:'0 6px 0 10px',borderRadius:99,background:t.s,border:`1.5px solid ${col?col.stroke:t.bd2}`,boxShadow:`0 2px 0 0 ${col?col.stroke:t.bd2}`,fontSize:12.5,fontWeight:600},Ic('chevron-down',13,t.tx2,2.25),f.title,S({minWidth:18,height:18,borderRadius:99,background:t.tx,color:t.s,fontSize:10.5,display:'inline-flex',alignItems:'center',justifyContent:'center',padding:'0 5px'},f.n)));}
 as(st,{border:`1px dashed ${t.tx2}`});const tick=(x,y,r)=>D({position:'absolute',left:x,top:y,width:10,height:10,borderLeft:`1.5px solid ${t.tx}`,borderTop:`1.5px solid ${t.tx}`,transform:`rotate(${r}deg)`});
 return D(st,tick(-2,-2,0),tick(f.w-8,-2,90),tick(f.w-8,f.h-8,180),tick(-2,f.h-8,270),D({position:'absolute',right:10,top:7,fontFamily:M,fontSize:9.5,letterSpacing:'.06em',color:t.tx2,display:'flex',gap:6,alignItems:'center'},Ic('chevron-down',11,t.tx2,2),(f.id||'GRP')+' · '+f.title.toUpperCase()),
  D({position:'absolute',right:-1,bottom:-1,display:'grid',gridTemplateColumns:'auto auto',border:`1px solid ${t.tx2}`,background:t.cv,fontFamily:M,fontSize:9,color:t.tx2},S({padding:'2px 6px',borderRight:`1px solid ${t.tx2}`},'CARDS'),S({padding:'2px 6px',color:t.tx},f.n),S({padding:'2px 6px',borderRight:`1px solid ${t.tx2}`,borderTop:`1px solid ${t.tx2}`},'STATE'),S({padding:'2px 6px',borderTop:`1px solid ${t.tx2}`,color:t.tx},'OPEN')));}
function proxy(t,c,x,y,w){const B=t.dir==='B',C=t.dir==='C';const TY=TYPES[c.type]||{};return D({position:'absolute',left:x,top:y,width:w||150,boxSizing:'border-box',border:`${B?1.5:1}px dashed ${t.tx2}`,borderRadius:t.r,background:t.cv,padding:C?'0':'8px 10px',display:'flex',flexDirection:C?'column':'row',alignItems:C?'stretch':'center',gap:C?0:7,fontFamily:G,zIndex:1},
 C?[D({fontFamily:M,fontSize:9,letterSpacing:'.06em',color:t.mu,padding:'3px 7px',borderBottom:`1px dashed ${t.tx2}`},'OUTSIDE · '+(c.id||'')),D({display:'flex',alignItems:'center',gap:6,padding:'6px 8px',fontSize:12,fontWeight:500},Ic(TY.icon,12,t.tx2),c.title)]
 :[Ic(TY.icon,13,t.tx2),D({display:'flex',flexDirection:'column',minWidth:0},S({fontSize:B?12.5:12,fontWeight:B?600:500,whiteSpace:'nowrap'},c.title),S({fontSize:10,color:t.mu},'Outside'))]);}
// ---------- edges
const NRM={l:[-1,0],r:[1,0],t:[0,-1],b:[0,1]};
function anc(t,bx,side,at){if(at==null)at=(side==='l'||side==='r')?Math.min(bx.h/2,bx.anc||t.anc):bx.w/2;return side==='l'?{x:bx.x,y:bx.y+at}:side==='r'?{x:bx.x+bx.w,y:bx.y+at}:side==='t'?{x:bx.x+at,y:bx.y}:{x:bx.x+at,y:bx.y+bx.h};}
function route(p1,s1,p2,s2){const H1=s1==='l'||s1==='r',H2=s2==='l'||s2==='r';let P;
 if(H1&&H2){const mx=(p1.x+p2.x)/2;P=[p1,{x:mx,y:p1.y},{x:mx,y:p2.y},p2];}else if(!H1&&!H2){const my=(p1.y+p2.y)/2;P=[p1,{x:p1.x,y:my},{x:p2.x,y:my},p2];}else if(H1)P=[p1,{x:p2.x,y:p1.y},p2];else P=[p1,{x:p1.x,y:p2.y},p2];
 return P.filter((p,i)=>i===0||Math.hypot(p.x-P[i-1].x,p.y-P[i-1].y)>.5);}
function pathOrth(P,r){let d=`M${P[0].x} ${P[0].y}`;for(let i=1;i<P.length-1;i++){const a=P[i-1],b=P[i],c=P[i+1];const l1=Math.hypot(b.x-a.x,b.y-a.y),l2=Math.hypot(c.x-b.x,c.y-b.y);const rr=Math.min(r,l1/2,l2/2);const s={x:b.x+(a.x-b.x)*rr/l1,y:b.y+(a.y-b.y)*rr/l1},f={x:b.x+(c.x-b.x)*rr/l2,y:b.y+(c.y-b.y)*rr/l2};d+=` L${s.x} ${s.y} Q${b.x} ${b.y} ${f.x} ${f.y}`;}const z=P[P.length-1];return d+` L${z.x} ${z.y}`;}
function polyAt(P,f){let L=0;const seg=[];for(let i=1;i<P.length;i++){const l=Math.hypot(P[i].x-P[i-1].x,P[i].y-P[i-1].y);seg.push(l);L+=l;}let d=f*L;for(let i=0;i<seg.length;i++){if(d<=seg[i]){const q=seg[i]?d/seg[i]:0;return {x:P[i].x+(P[i+1].x-P[i].x)*q,y:P[i].y+(P[i+1].y-P[i].y)*q};}d-=seg[i];}return P[P.length-1];}
function geom(t,p1,s1,p2,s2){if(t.dir==='B'){const k=Math.max(28,Math.hypot(p2.x-p1.x,p2.y-p1.y)*.42);const c1={x:p1.x+NRM[s1][0]*k,y:p1.y+NRM[s1][1]*k},c2={x:p2.x+NRM[s2][0]*k,y:p2.y+NRM[s2][1]*k};
 return {d:`M${p1.x} ${p1.y} C${c1.x} ${c1.y} ${c2.x} ${c2.y} ${p2.x} ${p2.y}`,at:f=>{const u=1-f;return {x:u*u*u*p1.x+3*u*u*f*c1.x+3*u*f*f*c2.x+f*f*f*p2.x,y:u*u*u*p1.y+3*u*u*f*c1.y+3*u*f*f*c2.y+f*f*f*p2.y};}};}
 const P=route(p1,s1,p2,s2);return {d:pathOrth(P,t.edgeR),at:f=>polyAt(P,f)};}
function arrow(t,p,side,col,kind){const v=NRM[side].map(x=>-x),pp=[-v[1],v[0]];const pt=(a,b)=>`${p.x+v[0]*a+pp[0]*b} ${p.y+v[1]*a+pp[1]*b}`;
 if(kind==='x')return h('path',{d:`M${pt(-12,-4)}L${pt(-4,4)}M${pt(-12,4)}L${pt(-4,-4)}`,stroke:col,strokeWidth:2,strokeLinecap:'round',fill:'none'});
 if(t.dir==='A')return h('path',{d:`M${pt(-7,-4)}L${pt(0,0)}L${pt(-7,4)}`,stroke:col,strokeWidth:1.5,fill:'none',strokeLinecap:'round',strokeLinejoin:'round'});
 if(t.dir==='B')return h('path',{d:`M${pt(-1,0)}L${pt(-9,-5)}L${pt(-9,5)}Z`,stroke:col,strokeWidth:2,fill:col,strokeLinejoin:'round'});
 return h('path',{d:`M${pt(0,0)}L${pt(-8,-3.5)}L${pt(-8,3.5)}Z`,fill:col});}
function startMark(t,p,col){if(t.dir==='B')return h('circle',{cx:p.x,cy:p.y,r:3.5,fill:col});if(t.dir==='C')return h('rect',{x:p.x-2.5,y:p.y-2.5,width:5,height:5,fill:t.cv,stroke:col,strokeWidth:1});return null;}
function edgeStyle(t,e){const r=e.rel&&t.REL[e.rel];const base=r&&r.c?r.c:t.edgeC;const S0={c:base,w:t.edgeW,dash:r?r.dash:null,op:1};
 switch(e.st){case 'done':return as(S0,{c:t.dir==='C'&&r&&r.c?r.c:t.tx2,w:t.edgeW+.5});case 'cur':return as(S0,{c:t.ac,w:t.edgeW+1.25,dash:null});case 'next':return as(S0,{dash:t.dir==='B'?'2 6':'4 4'});case 'dim':return as(S0,{op:.2});case 'hl':return as(S0,{c:r&&r.c?r.c:t.tx,w:t.edgeW+.75});case 'err':return as(S0,{c:t.clay,w:t.edgeW+.5,dash:'7 4'});case 'ghost':return as(S0,{c:t.mu,dash:'3 3',op:.6});default:return S0;}}
function labelEl(t,p,txt,o){o=o||{};const B=t.dir==='B',C=t.dir==='C';const cur=o.cur,err=o.err;
 const st={position:'absolute',left:p.x,top:p.y,transform:'translate(-50%,-50%)',whiteSpace:'nowrap',zIndex:2,display:'flex',alignItems:'center',gap:3,opacity:o.dim?.25:1,boxSizing:'border-box'};
 if(C)as(st,{fontFamily:M,fontSize:9.5,letterSpacing:'.04em',textTransform:'uppercase',padding:'1px 4px',background:cur?t.ac:t.cv,color:cur?t.onac:err?t.clay:t.tx2,border:err?`1px solid ${t.clay}`:'none'});
 else if(B)as(st,{fontSize:11,fontWeight:600,height:20,padding:'0 8px',borderRadius:99,background:cur?t.ac:err?t.clayS:t.s,color:cur?t.onac:err?t.clay:t.tx2,border:`1.5px solid ${cur?t.ac:err?t.clay:t.bd2}`});
 else as(st,{fontFamily:M,fontSize:10.5,height:18,padding:'0 6px',borderRadius:4,background:cur?t.ac:t.s,color:cur?t.onac:err?t.clay:t.tx2,border:`1px solid ${cur?t.ac:err?t.clay:t.hl}`});
 return D(st,err&&Ic('octagon-x',11,t.clay,2.25),txt);}
function countBadge(t,p,n,o){o=o||{};const B=t.dir==='B',C=t.dir==='C';return D({position:'absolute',left:p.x,top:p.y,transform:'translate(-50%,-50%)',zIndex:3,display:'flex',alignItems:'center',justifyContent:'center',boxSizing:'border-box',whiteSpace:'nowrap',opacity:o.dim?.25:1,
 ...(C?{fontFamily:M,fontSize:10,padding:'1px 4px',background:t.cv,border:`1px solid ${t.tx}`,color:t.tx}:B?{height:22,minWidth:22,padding:'0 7px',borderRadius:99,background:t.tx,color:t.s,fontSize:11.5,fontWeight:700,border:`2px solid ${t.cv}`}:{height:18,padding:'0 5px',borderRadius:4,background:t.tx,color:t.s,fontFamily:M,fontSize:10.5})},C?n+'×':'×'+n);}
function token(t,p,n){if(t.dir==='A')return D({position:'absolute',left:p.x-5,top:p.y-5,width:10,height:10,borderRadius:5,background:t.ac,boxShadow:`0 0 0 2px ${t.s}, 0 0 0 8px ${t.ac}33`,zIndex:4});
 if(t.dir==='B')return D({position:'absolute',left:p.x-12,top:p.y-12,width:24,height:24,borderRadius:12,background:t.ac,border:`2.5px solid ${t.s}`,boxShadow:`0 3px 0 0 ${t.aci}`,boxSizing:'border-box',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11.5,fontWeight:700,color:t.onac,zIndex:4},n);
 return D({position:'absolute',left:p.x-11,top:p.y-11,width:22,height:22,zIndex:4},D({position:'absolute',left:3,top:3,width:16,height:16,borderRadius:8,border:`1px solid ${t.ac}`,boxSizing:'border-box'}),D({position:'absolute',left:0,top:10.5,width:22,height:1,background:t.ac}),D({position:'absolute',left:10.5,top:0,width:1,height:22,background:t.ac}),D({position:'absolute',left:7,top:7,width:8,height:8,borderRadius:4,background:t.ac}));}
// ---------- board
function nodeBox(t,n){const c=n.c;if(n.kind==='shape')return {x:n.x,y:n.y,w:c.w,h:c.h,anc:c.h/2};if(n.kind==='stack')return {x:n.x,y:n.y,w:c.w||t.w,h:stackH(t),anc:40};if(n.kind==='proxy')return {x:n.x,y:n.y,w:n.w||150,h:t.dir==='C'?50:46,anc:t.dir==='C'?36:23};return {x:n.x,y:n.y,w:c.w||t.w,h:est(t,c),anc:n.anc};}
function nodeEl(t,n){if(n.kind==='shape')return shape(t,as({},n.c,{x:n.x,y:n.y}),n.s);if(n.kind==='stack')return stack(t,as({},n.c,{x:n.x,y:n.y}),n.s);if(n.kind==='proxy')return proxy(t,n.c,n.x,n.y,n.w);return card(t,as({},n.c,{x:n.x,y:n.y}),n.s);}
function board(t,o){const box={};(o.nodes||[]).forEach(n=>{box[n.k]=nodeBox(t,n);});const svg=[],over=[];
 (o.edges||[]).forEach((e,i)=>{const a=box[e.a],b=box[e.b];if(!a||!b)return;const p1=e.p1||anc(t,a,e.as,e.aat),p2=e.p2||anc(t,b,e.bs,e.bat);const g=geom(t,p1,e.as,p2,e.bs);const st=edgeStyle(t,e);
  if(e.st==='cur')svg.push(h('path',{key:'h'+i,d:g.d,fill:'none',stroke:t.ac,strokeOpacity:.18,strokeWidth:st.w+6,strokeLinecap:'round'}));
  svg.push(h('g',{key:'e'+i,opacity:st.op},h('path',{d:g.d,fill:'none',stroke:st.c,strokeWidth:st.w,strokeDasharray:st.dash,strokeLinecap:st.dash==='1.5 4'||st.dash==='2 6'?'round':'butt'}),startMark(t,p1,st.c),arrow(t,p2,e.bs,st.c,e.st==='err'?'x':null)));
  if(e.label)over.push(labelEl(t,g.at(e.lp||.5),e.label,{cur:e.st==='cur',err:e.st==='err',dim:e.st==='dim'}));
  if(e.count)over.push(countBadge(t,g.at(e.cp||.5),e.count,{dim:e.st==='dim'}));
  if(e.tok!=null)over.push(token(t,g.at(e.tok),e.tokN));});
 return [(o.frames||[]).map(f=>frame(t,f)),X('svg',{width:o.w||PW,height:o.h||800,style:{position:'absolute',left:0,top:0,overflow:'visible',pointerEvents:'none'}},svg),(o.nodes||[]).map(n=>nodeEl(t,n)),over];}
const PW=1180;
function plate(t,H,kids,o){o=o||{};const bg=t.dir==='C'?{backgroundImage:`linear-gradient(${t.th==='light'?'#e6e6e0':'#212120'} 1px,transparent 1px),linear-gradient(90deg,${t.th==='light'?'#e6e6e0':'#212120'} 1px,transparent 1px),linear-gradient(${t.th==='light'?'#f0f0eb':'#191918'} 1px,transparent 1px),linear-gradient(90deg,${t.th==='light'?'#f0f0eb':'#191918'} 1px,transparent 1px)`,backgroundSize:'120px 120px,120px 120px,24px 24px,24px 24px'}
 :{backgroundImage:`radial-gradient(${t.dot} ${t.dir==='B'?1.6:1}px, transparent ${t.dir==='B'?1.9:1.3}px)`,backgroundSize:t.dir==='B'?'26px 26px':'22px 22px'};
 return D(as({position:'relative',width:PW,minHeight:H||undefined,flex:'1 1 auto',background:t.cv,borderRadius:14,overflow:'hidden',fontFamily:G,color:t.tx,boxSizing:'border-box',boxShadow:'0 2px 12px rgba(0,0,0,.08)'},o.flow?{padding:28,display:'flex',flexDirection:'column',gap:26}:{height:H},bg),kids);}
const cap=(t,txt,x,y,st)=>D(as({position:'absolute',left:x,top:y,fontFamily:M,fontSize:11,letterSpacing:'.05em',textTransform:'uppercase',color:t.tx2,zIndex:6,whiteSpace:'nowrap'},st||{}),txt);
const sh=(t,txt,sub)=>D({display:'flex',alignItems:'baseline',gap:12,flexWrap:'wrap'},S({fontFamily:M,fontSize:11,letterSpacing:'.05em',textTransform:'uppercase',color:t.tx2},txt),sub&&S({fontSize:12.5,color:t.mu},sub));
const lbl=(t,txt,sub)=>D({display:'flex',flexDirection:'column',gap:2,maxWidth:200},S({fontFamily:M,fontSize:10.5,color:t.tx2},txt),sub&&S({fontSize:11.5,color:t.mu,lineHeight:1.4,textWrap:'pretty'},sub));
function pnl(t,st,...k){const B=t.dir==='B',C=t.dir==='C';return D(as({background:t.s,border:`${B?1.5:1}px solid ${C?t.tx2:B?t.bd2:t.hl}`,borderRadius:B?16:C?2:10,boxShadow:B?`0 3px 0 0 ${t.bd2}, 0 10px 28px ${t.sh}`:`0 8px 28px ${t.sh}`,color:t.tx,fontFamily:G,boxSizing:'border-box'},st),...k);}
const tog=(t,on)=>S({width:28,height:16,borderRadius:t.dir==='C'?2:99,background:on?t.ac:t.s3,position:'relative',flex:'none',display:'inline-block',border:on?'none':`1px solid ${t.bd2}`,boxSizing:'border-box'},S({position:'absolute',top:on?2:1,left:on?14:1,width:12,height:12,borderRadius:t.dir==='C'?1:99,background:on?'#fff':t.tx2}));
function inp(t,val,o){o=o||{};const B=t.dir==='B',C=t.dir==='C';return D({height:32,display:'flex',alignItems:'center',gap:7,padding:'0 10px',border:`1px solid ${o.focus?t.ac:t.bd}`,borderRadius:B?10:C?2:8,background:o.fill?t.s2:t.s,fontSize:12.5,color:val?t.tx:t.mu,boxSizing:'border-box',fontFamily:C&&o.mono?M:G},o.icon&&Ic(o.icon,14,t.mu,2),S({flex:1,whiteSpace:'nowrap',overflow:'hidden'},val||o.ph,o.focus&&S({display:'inline-block',width:1.5,height:14,background:t.ac,verticalAlign:'-2px',marginLeft:1})),o.right);}
const btnI=(t,ic,o)=>{o=o||{};return D({width:o.s||28,height:o.s||28,borderRadius:t.dir==='B'?99:t.dir==='C'?2:7,display:'flex',alignItems:'center',justifyContent:'center',background:o.on?t.ac:o.fill?t.s2:'transparent',color:o.on?'#fff':t.tx2,flex:'none',border:o.line?`1px solid ${t.bd}`:'none',boxSizing:'border-box',boxShadow:o.focus?`0 0 0 2px ${t.s}, 0 0 0 4px ${t.ac}`:'none'},Ic(ic,o.is||15,null,2));};
// ---------- rows
function rowSample(t){const A=t.dir==='A',B=t.dir==='B',C=t.dir==='C';
 const N=[
  {k:'start',kind:'shape',x:40,y:64,c:{shape:'pill',title:'Start checkout',w:132,h:40},s:{ph:'done'}},
  {k:'cust',kind:'shape',x:62,y:136,c:{shape:'actor',title:'Customer',w:88,h:70},s:{ph:'done',label:false}},
  {k:'web',x:270,y:100,c:K.web,s:{ph:'done',n:1}},{k:'gw',x:500,y:100,c:K.gw,s:{ph:'src',n:2}},{k:'svc',x:730,y:100,c:K.svc,s:{ph:'cur',n:3}},
  {k:'db',kind:'shape',x:982,y:96,c:{shape:'cylinder',title:'Orders DB',w:150,h:96,color:'blue'},s:{ph:'next',n:4}},
  {k:'pg',kind:'stack',x:982,y:226,c:GPAY,s:{dim:true}},
  {k:'dec',kind:'shape',x:744,y:360,c:{shape:'diamond',title:'Payment OK?',w:160,h:104},s:{ph:'next',n:5}},
  {k:'fail',kind:'shape',x:990,y:520,c:{shape:'pill',title:'Payment failed',w:140,h:44},s:{ph:'next',err:true}},
  {k:'sticky',kind:'shape',x:40,y:296,c:{shape:'sticky',title:'Retry 3DS timeouts once before failing?',w:150,h:116},s:{dim:true}},
  {k:'txt',kind:'shape',x:30,y:436,c:{shape:'text',title:'Checkout v2 · draft',w:180,h:30},s:{dim:true}},
  {k:'an',x:270,y:320,c:K.an,s:{dim:true}},
  {k:'task',x:730,y:552,c:K.task,s:{ph:'next',n:6}},{k:'wh',x:500,y:552,c:K.wh,s:{ph:'next',n:7}},{k:'truck',x:270,y:552,c:K.truck,s:{ph:'next',n:8}},
  {k:'end',kind:'shape',x:40,y:556,c:{shape:'pill',title:'Order shipped',w:132,h:44},s:{ph:'next'}},
  {k:'data',x:982,y:612,c:K.data,s:{dim:true}}];
 const E=[{a:'start',as:'b',b:'cust',bs:'t',st:'done'},{a:'cust',as:'r',aat:30,b:'web',bs:'l',st:'done',label:'opens cart'},{a:'web',as:'r',b:'gw',bs:'l',st:'done'},
  {a:'gw',as:'r',b:'svc',bs:'l',st:'cur',tok:.5,tokN:3},{a:'svc',as:'r',b:'db',bs:'l',bat:30,st:'next'},
  {a:'svc',as:'r',aat:96,b:'pg',bs:'l',bat:44,st:'dim',count:3,cp:.6},{a:'svc',as:'b',b:'dec',bs:'t',st:'next'},
  {a:'dec',as:'b',b:'task',bs:'t',st:'next',label:'Yes',lp:.45},{a:'dec',as:'r',b:'fail',bs:'t',st:'err',label:'No · declined',lp:.42},
  {a:'task',as:'l',b:'wh',bs:'r',st:'next'},{a:'wh',as:'l',b:'truck',bs:'r',st:'next'},{a:'truck',as:'l',b:'end',bs:'r',bat:22,st:'next'},
  {a:'gw',as:'b',aat:40,b:'an',bs:'r',st:'dim'}];
 const fr=[{x:250,y:508,w:460,h:236,title:'Fulfilment',n:2,id:'GRP-05',color:'teal'}];
 const legend=D({position:'absolute',right:24,top:18,display:'flex',gap:16,alignItems:'center',fontSize:11.5,color:t.tx2,zIndex:6},
  ...[['done','Played'],['cur','Current'],['next','Not yet played'],['dim','Not in flow']].map(([k,l])=>D({display:'flex',alignItems:'center',gap:6},X('svg',{width:26,height:8},h('path',{d:'M1 4H25',stroke:edgeStyle(t,{st:k}).c,strokeWidth:edgeStyle(t,{st:k}).w,strokeDasharray:edgeStyle(t,{st:k}).dash,opacity:edgeStyle(t,{st:k}).op})),l)));
 const branch=pnl(t,{position:'absolute',left:520,top:372,width:208,padding:B?'10px 12px':'9px 10px',display:'flex',flexDirection:'column',gap:6,zIndex:6},
  D({display:'flex',alignItems:'center',gap:6,fontSize:11.5,color:t.tx2,fontFamily:C?M:G},Ic('git-branch',13,t.tx2,2),C?'STEP 05 · BRANCH':'Step 5 branches · pick a path'),
  D({display:'flex',alignItems:'center',gap:7,fontSize:12,fontWeight:500,padding:'4px 6px',borderRadius:B?10:C?1:6,background:t.s2},kbd(t,'1'),'Yes → Reserve stock'),
  D({display:'flex',alignItems:'center',gap:7,fontSize:12,fontWeight:500,padding:'4px 6px',borderRadius:B?10:C?1:6,border:`1px dashed ${t.clay}`,color:t.tx},kbd(t,'2'),'No → Payment failed',Ic('octagon-x',12,t.clay,2.25)),
  D({position:'absolute',right:-6,top:24,width:10,height:10,background:t.s,borderRight:`${B?1.5:1}px solid ${C?t.tx2:B?t.bd2:t.hl}`,borderTop:`${B?1.5:1}px solid ${C?t.tx2:B?t.bd2:t.hl}`,transform:'rotate(45deg)'}));
 return plate(t,900,[cap(t,'Sample board · flow “Checkout” playing',24,20),legend,board(t,{nodes:N,edges:E,frames:fr,h:900}),branch,player(t,{x:300,y:792})]);}
function player(t,o){const A=t.dir==='A',B=t.dir==='B',C=t.dir==='C';const seg=Array.from({length:8},(_,i)=>i);
 const segs=C?D({display:'grid',gridTemplateColumns:'repeat(8,1fr)',border:`1px solid ${t.tx2}`},seg.map(i=>D({height:16,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:M,fontSize:9,borderLeft:i?`1px solid ${t.tx2}`:'none',background:i===2?t.ac:i<2?t.tx2:'transparent',color:i===2?t.onac:i<2?t.s:t.tx2},String(i+1).padStart(2,'0'))))
  :D({display:'flex',gap:B?4:3},seg.map(i=>D({flex:1,height:B?8:4,borderRadius:B?4:2,background:i<2?t.tx2:i===2?t.ac:t.s3,outline:i===4?`${B?1.5:1}px dashed ${t.tx2}`:'none',outlineOffset:1})));
 const ctrls=D({display:'flex',alignItems:'center',gap:4},btnI(t,'skip-back',{}),D({width:B?40:32,height:B?40:32,borderRadius:C?2:99,background:t.ac,display:'flex',alignItems:'center',justifyContent:'center',boxShadow:B?`0 3px 0 0 ${t.aci}`:'none'},Ic('pause',B?18:15,'#fff',2.25)),btnI(t,'skip-forward',{}));
 const info=D({display:'flex',flexDirection:'column',gap:2,flex:1,minWidth:0},D({display:'flex',alignItems:'baseline',gap:8},S({fontSize:B?14:13,fontWeight:B?700:500,fontFamily:C?M:G},C?'STEP 03 / 08':'Step 3 of 8'),S({fontSize:11.5,color:t.mu},C?'':'Checkout')),S({fontSize:12,color:t.tx2,fontFamily:C?M:G},C?'GW-01 → SVC-014 · createOrder':'API Gateway → Order Service · createOrder'));
 const speed=S({fontFamily:M,fontSize:11,padding:'2px 7px',borderRadius:B?99:C?1:5,background:t.s2,color:t.tx2},'1×');
 const kids=[C&&D({display:'flex',alignItems:'center',gap:6,height:22,margin:'-10px -12px 0',padding:'0 10px',borderBottom:`1px solid ${t.tx2}`,fontFamily:M,fontSize:9.5,letterSpacing:'.06em',color:t.tx2},Ic('play',10,t.tx2,2),'FLOW · CHECKOUT',S({flex:1}),'BRANCH AT 05'),D({display:'flex',alignItems:'center',gap:12},ctrls,info,speed),segs];
 return pnl(t,{position:'absolute',left:o.x,top:o.y,width:560,padding:B?'12px 14px':'10px 12px',display:'flex',flexDirection:'column',gap:B?10:8,zIndex:6},kids);}
function rowConn(t){const A=t.dir==='A',B=t.dir==='B',C=t.dir==='C';const out=[];
 // a) hover
 const NA=[{k:'web',x:30,y:70,c:K.web,s:{dim:true}},{k:'gw',x:30,y:260,c:K.gw,s:{nb:true}},{k:'svc',x:270,y:240,c:K.svc,s:{hover:true}},{k:'db',x:510,y:70,c:K.dbc,s:{nb:true}},{k:'pg',kind:'stack',x:510,y:300,c:GPAY,s:{nb:true}},{k:'an',x:270,y:470,c:K.an,s:{nb:true}},{k:'nt',x:30,y:470,c:K.nt,s:{dim:true}}];
 const EA=[{a:'web',as:'b',b:'gw',bs:'t',st:'dim'},{a:'gw',as:'r',b:'svc',bs:'l',st:'hl',rel:'calls'},{a:'svc',as:'r',b:'db',bs:'l',st:'hl',rel:'writes'},{a:'svc',as:'r',aat:100,b:'pg',bs:'l',st:'hl',rel:'calls',count:3,cp:.55},{a:'svc',as:'b',b:'an',bs:'t',st:'hl',rel:'writes'},{a:'an',as:'l',b:'nt',bs:'r',st:'dim'}];
 out.push(cap(t,'a · Hover Order Service: neighbours stay, rest dims',24,20),board(t,{nodes:NA,edges:EA,h:600}));
 out.push(D({position:'absolute',left:24,top:42,display:'flex',gap:14,fontSize:11,color:t.tx2,zIndex:6},...['calls','reads','writes','depends'].map(r=>{const st=edgeStyle(t,{rel:r,st:'hl'});return D({display:'flex',alignItems:'center',gap:6},X('svg',{width:30,height:8},h('path',{d:'M1 4H29',stroke:st.c,strokeWidth:st.w,strokeDasharray:st.dash,strokeLinecap:r==='depends'?'round':'butt'})),r==='depends'?'depends on':r);})));
 // b) bundle
 out.push(cap(t,'b · 4 parallel connectors bundled',740,20));
 const sv={k:'s1',x:740,y:70,c:{type:'service',title:'Order Service',w:140}},py={k:'p1',x:1010,y:70,c:{type:'service',title:'Payment gateway',w:150}};
 const by=[44,58,72,86],my=86,rel=['calls','calls','reads','writes'];const bsvg=[];
 by.forEach((y0,i)=>{const p1={x:880,y:70+y0},p2={x:1010,y:70+y0};const st=edgeStyle(t,{rel:rel[i]});const d=`M${p1.x} ${p1.y} C${p1.x+22} ${p1.y} ${915} ${70+my} ${935} ${70+my} L${955} ${70+my} C${975} ${70+my} ${p2.x-22} ${p2.y} ${p2.x} ${p2.y}`;bsvg.push(h('path',{key:i,d,fill:'none',stroke:st.c,strokeWidth:st.w,strokeDasharray:st.dash}));bsvg.push(h('g',{key:'a'+i},arrow(t,p2,'l',st.c)));});
 bsvg.push(h('path',{key:'trunk',d:`M932 ${70+my}H958`,stroke:t.tx2,strokeWidth:t.edgeW+3,strokeLinecap:'round'}));
 out.push(X('svg',{width:PW,height:300,style:{position:'absolute',left:0,top:0,overflow:'visible'}},bsvg),card(t,as({},sv.c,{x:sv.x,y:sv.y,desc:'Go'})),card(t,as({},py.c,{x:py.x,y:py.y,desc:'Kotlin'})),countBadge(t,{x:945,y:70+my-16},4));
 out.push(D({position:'absolute',left:740,top:206,display:'flex',gap:12,fontSize:11.5,color:t.tx2,alignItems:'center'},'calls 2 · reads 1 · writes 1',S({color:t.mu},'Click the count to fan out')));
 // c) end along side
 out.push(cap(t,'c · Connector end moved along a side',740,262));
 const gx=740,gy=320,dx=1010,dy=300;out.push(card(t,{type:'gateway',title:'API Gateway',w:140,x:gx,y:gy}),card(t,{type:'database',title:'Orders DB',desc:'PostgreSQL 16',color:'blue',w:150,x:dx,y:dy},{handles:true}));
 const dh=est(t,{type:'database',title:'Orders DB',desc:'PostgreSQL 16',w:150}),oldY=dy+dh/2,newY=dy+dh*.78,src={x:gx+140,y:gy+t.anc};
 const g1=geom(t,src,'r',{x:dx,y:oldY},'l'),g2=geom(t,src,'r',{x:dx,y:newY},'l');
 out.push(X('svg',{width:PW,height:600,style:{position:'absolute',left:0,top:0,overflow:'visible'}},[h('path',{key:'o',d:g1.d,fill:'none',stroke:t.mu,strokeWidth:1,strokeDasharray:'3 3',opacity:.7}),h('path',{key:'n',d:g2.d,fill:'none',stroke:t.ac,strokeWidth:t.edgeW+.75,strokeDasharray:'6 4'}),h('rect',{key:'tr',x:dx-1.5,y:dy+4,width:3,height:dh-8,rx:1.5,fill:t.ac,opacity:.35}),...[.25,.5,.75].map(f=>h('path',{key:'k'+f,d:`M${dx-6} ${dy+dh*f}H${dx}`,stroke:t.ac,strokeWidth:1}))]));
 out.push(D({position:'absolute',left:dx-7,top:newY-7,width:14,height:14,borderRadius:C?1:7,background:t.s,border:`2px solid ${t.ac}`,boxSizing:'border-box',zIndex:5}),
  D({position:'absolute',left:dx-120,top:newY+12,height:22,padding:'0 8px',borderRadius:C?1:99,background:t.inv,color:t.invt,fontFamily:M,fontSize:10.5,display:'flex',alignItems:'center',zIndex:5},'left side · 78 %'),
  D({position:'absolute',left:740,top:470,fontSize:11.5,color:t.tx2,lineHeight:1.45,width:420,textWrap:'pretty'},'Drag an end along the side; it snaps at 25 / 50 / 75 % (ticks) and stays where it is dropped. The old route shows dashed until release. Handles: '+(A?'3×12 bars at side midpoints.':B?'12px knobs, 16px with halo when active.':'7px square ports.')));
 // d) drill-in
 const top=560;out.push(D({position:'absolute',left:16,right:16,top:top-8,height:1,background:t.hl}));
 const P=[{k:'gwp',kind:'proxy',x:40,y:top+90,c:K.gw},{k:'auth',kind:'proxy',x:40,y:top+210,c:{type:'service',title:'Auth service',id:'SVC-002'}},{k:'dbp',kind:'proxy',x:990,y:top+76,c:K.dbc},{k:'bus',kind:'proxy',x:990,y:top+226,c:{type:'queue',title:'Event bus',id:'Q-01'}},
  {k:'h1',x:286,y:top+86,c:{type:'component',title:'Checkout handler',w:160,desc:'HTTP · /orders'}},{k:'pr',x:500,y:top+86,c:{type:'component',title:'Pricing module',w:160}},{k:'rp',x:714,y:top+86,c:{type:'component',title:'Order repository',w:160}},{k:'ob',x:500,y:top+222,c:{type:'component',title:'Outbox publisher',w:160}}];
 const PE=[{a:'gwp',as:'r',b:'h1',bs:'l',rel:'calls'},{a:'h1',as:'r',b:'pr',bs:'l',rel:'calls'},{a:'pr',as:'r',b:'rp',bs:'l',rel:'calls'},{a:'rp',as:'r',b:'dbp',bs:'l',rel:'writes'},{a:'rp',as:'r',aat:52,b:'dbp',bs:'l',bat:38,rel:'reads'},{a:'h1',as:'b',b:'ob',bs:'l',rel:'writes'},{a:'ob',as:'r',b:'bus',bs:'l',rel:'writes'},{a:'h1',as:'l',aat:50,b:'auth',bs:'r',rel:'depends'}];
 const cnt={};PE.forEach(e=>cnt[e.rel]=(cnt[e.rel]||0)+1);
 out.push(frame(t,{x:262,y:top+44,w:650,h:300,title:'Inside Order Service',n:4,id:'SVC-014'}));
 out.push(D({position:'absolute',left:24,top:top+6,right:24,display:'flex',alignItems:'center',gap:10,zIndex:6},S({fontFamily:M,fontSize:11,letterSpacing:'.05em',textTransform:'uppercase',color:t.tx2},'d · Drill-in'),S({fontSize:12,color:t.mu},'Checkout deck ›'),S({fontSize:13.5,fontWeight:600},'Inside Order Service'),S({flex:1}),
  ...['calls','reads','writes','depends'].map(r=>{const st=edgeStyle(t,{rel:r});return D({display:'flex',alignItems:'center',gap:6,height:24,padding:'0 8px',borderRadius:B?99:C?1:6,border:`1px solid ${t.bd}`,background:t.s,fontSize:11.5,color:t.tx},X('svg',{width:22,height:8},h('path',{d:'M1 4H21',stroke:st.c==t.edgeC?t.tx2:st.c,strokeWidth:1.75,strokeDasharray:st.dash,strokeLinecap:r==='depends'?'round':'butt'})),r==='depends'?'depends on':r,S({fontFamily:M,fontWeight:600},cnt[r]));})));
 out.push(board(t,{nodes:P,edges:PE.map(e=>as({st:'hl'},e)),h:900}));
 return plate(t,920,out);}
function rowGroups(t){const B=t.dir==='B';const out=[cap(t,'Collapsed group · one connector per neighbour, with count',24,20),cap(t,'Expanded group · frame with label',740,20)];
 const N=[{k:'gw',x:30,y:80,c:K.gw},{k:'svc',x:30,y:300,c:{type:'service',title:'Order Service',desc:'Go',tags:['critical']}},{k:'pg',kind:'stack',x:270,y:190,c:GPAY,s:{}},{k:'bank',x:500,y:96,c:K.bank},{k:'nt',x:500,y:320,c:K.nt}];
 const E=[{a:'gw',as:'r',b:'pg',bs:'l',bat:30,count:2,rel:'calls'},{a:'svc',as:'r',b:'pg',bs:'l',bat:70,count:3,rel:'calls'},{a:'pg',as:'r',aat:30,b:'bank',bs:'l',count:1,rel:'calls'},{a:'pg',as:'r',aat:76,b:'nt',bs:'l',rel:'writes'}];
 out.push(board(t,{nodes:N,edges:E,h:560}));
 out.push(D({position:'absolute',left:24,top:470,width:660,fontSize:12,color:t.tx2,lineHeight:1.5,textWrap:'pretty'},'The stack keeps the group colour, shows the name, member count and members, and is wider-looking than a card because of the offset sheets. Each neighbour gets one merged connector with ×n; n is the number of member connections it replaces. ⏎ or double-click expands.'));
 const fx=740,fy=70;
 out.push(frame(t,{x:fx,y:fy,w:420,h:440,title:'Payments',n:3,id:'GRP-03',color:'violet'}));
 const M2=[{k:'pay',x:fx+20,y:fy+46,c:as({},K.pay,{w:170})},{k:'fr',x:fx+230,y:fy+46,c:as({},K.fraud,{w:170})},{k:'lg',x:fx+20,y:fy+250,c:as({},K.ledger,{w:170})}];
 out.push(board(t,{nodes:M2,edges:[{a:'pay',as:'r',b:'fr',bs:'l',rel:'calls'},{a:'pay',as:'b',b:'lg',bs:'t',rel:'writes'}],h:560}));
 return plate(t,560,out);}
function rowSet(t){const C=t.dir==='C';const item=(el,a,b)=>D({display:'flex',flexDirection:'column',gap:10,alignItems:'flex-start'},el,lbl(t,a,b));
 const shp=(k,title,w,H,o)=>item(D({paddingTop:C?16:0},shape(t,as({shape:k,title,w,h:H},o||{}),{})),SHAPEN[k]);
 return plate(t,0,[sh(t,'Information cards','one frame: header · title · description · fields · tags; empty regions collapse'),
  D({display:'flex',flexWrap:'wrap',gap:'28px 20px',alignItems:'flex-start'},item(card(t,K.svc),'Service','Architecture'),item(card(t,K.dbc),'Database','Architecture · colour blue'),item(card(t,K.task),'Task','Process'),item(card(t,K.wh),'Warehouse','Logistics · colour teal'),item(card(t,K.truck),'Truck route','Logistics'),item(card(t,K.data),'Data card','8 coloured tags')),
  sh(t,'Shapes','true geometry, centred text, max 3 lines; no fields or tags'),
  D({display:'flex',flexWrap:'wrap',gap:'30px 26px',alignItems:'flex-end'},shp('diamond','Payment OK?',150,100,{tn:'Decision'}),shp('pill','Start checkout',140,44,{tn:'Start'}),shp('pill','Order shipped',140,44,{tn:'End'}),item(D({width:120,height:100,display:'flex',justifyContent:'center'},shape(t,{shape:'actor',title:'Customer',w:88,h:70},{})),'Actor'),
   shp('rect','Validate cart',130,64),shp('rrect','Send receipt',130,64),shp('ellipse','Idle',120,70),shp('diamond','In stock?',120,84),shp('cylinder','Orders DB',120,84,{color:'blue'}),shp('document','Invoice PDF',120,80),shp('parallelogram','Card details',140,60),shp('hexagon','Prepare',130,64),shp('sticky','Ask finance about refunds',130,120),shp('text','Checkout v2',130,40),shp('frame','Frame',180,110)),
  sh(t,'Same object, two forms','decision · database · document convert both ways; fields stay in the drawer while it is a shape'),
  D({display:'flex',flexWrap:'wrap',gap:'24px 56px',alignItems:'center'},...[[{type:'decision',title:'Payment OK?',desc:'Card authorised and fraud score below 70',fields:[{k:'Rule',v:'pay-ok v3'}]},{shape:'diamond',title:'Payment OK?',w:150,h:100,tn:'Decision'}],[K.dbc,{shape:'cylinder',title:'Orders DB',w:130,h:96,color:'blue'}],[{type:'document',title:'Invoice PDF',desc:'Generated after capture',fields:[{k:'Link',v:'files/invoice.pdf',ft:'link'}]},{shape:'document',title:'Invoice PDF',w:130,h:90}]].map(([a,b])=>D({display:'flex',alignItems:'center',gap:16},card(t,a),D({display:'flex',flexDirection:'column',alignItems:'center',gap:3,color:t.mu,fontFamily:M,fontSize:10},Ic('arrow-left-right',16,t.tx2,2),'convert'),D({paddingTop:C?16:0},shape(t,b,{})))))],{flow:true});}
function rowEdge(t){const C=t.dir==='C';const item=(el,a,b,pt)=>D({display:'flex',flexDirection:'column',gap:10,alignItems:'flex-start',paddingTop:pt||0},el,lbl(t,a,b));
 const long='Reconcile settlement batches from the acquiring bank against ledger entries and flag every mismatch for manual review';
 const tip=D({position:'absolute',left:-6,top:-62,width:260,padding:'7px 10px',background:t.inv,color:t.invt,fontSize:12,lineHeight:1.4,borderRadius:t.dir==='B'?12:t.dir==='C'?1:7,zIndex:5,textWrap:'pretty'},long,D({position:'absolute',left:30,bottom:-5,width:10,height:10,background:t.inv,transform:'rotate(45deg)'}));
 return plate(t,0,[sh(t,'Content edge cases'),D({display:'flex',flexWrap:'wrap',gap:'36px 22px',alignItems:'flex-start'},
  item(card(t,{type:'service',title:'Cart Service',fields:[{k:'Tech',v:'Node'}]}),'One-line title'),
  item(D({position:'relative',marginRight:70},card(t,{type:'service',title:long,desc:'Nightly job',id:'JOB-07'},{hover:true}),tip),'Long title, cut at 3 lines','Tooltip shows only the full title, only when cut',70),
  item(card(t,{type:'service',title:'Search'}),'Minimal card','No description, fields or tags'),
  item(card(t,{type:'service',title:'Checkout API',tags:TEN}),'10 tags','The tag limit'),
  item(card(t,{type:'warehouse',title:'Warehouse HCM',desc:'District 9 cross-dock, 4 bays',status:'Open',w:340,fields:[{k:'Capacity',v:82,ft:'progress'},{k:'SLA',v:'24 h',ft:'number'},{k:'Manager',v:'Minh Tran',ft:'person'}],tags:['ops','eu']}),'Wide · resized to 340','Width is user-set; height follows content'),
  item(card(t,{type:'task',title:'Pack order',status:'To do',w:132,fields:[{k:'Due',v:'14 Oct',ft:'date'}]}),'Narrow · 132','Status becomes icon-only under 150'))],{flow:true});}
function rowStates(t){const A=t.dir==='A',B=t.dir==='B',C=t.dir==='C';const rc={type:'service',title:'Order Service',desc:'Go · Payments team',tags:['critical','pci'],w:164,id:'SVC-014'};
 const cue={hover:A?'Secondary border + bar handles':B?'Lifts 2px, lip 5px, knobs':'Ink border + square ports',sel:'2px orange frame outside',edit:'Same type and wrap, caret + selection',problem:'Dashed ring + ⚠ count in header',cur:A?'▶03 tab + border + halo':B?'Number sticker, lifted, orange lip':C?'Balloon + “STEP 03 · NOW” band':'',dim:'22 % opacity',drag:B?'Tilted, deep lip, ghost at origin':'Float shadow, ghost at origin',target:'Active side handle, orange border',kids:'“4 parts inside ⏎” footer',group:'Offset sheets + count',nb:A||C?'Darker border; stays at 100 %':'Ink lip; stays at 100 %'};
 const cell=(el,n,c)=>D({display:'flex',flexDirection:'column',gap:10,alignItems:'flex-start',minHeight:B?210:200},D({flex:1,display:'flex',alignItems:'flex-start',paddingTop:12},el),lbl(t,n,c));
 const ghost=(el,w,hh)=>D({position:'relative',width:w+16,height:hh+16},D({position:'absolute',left:0,top:0,width:w,height:hh,border:`1.5px dashed ${t.mu}`,borderRadius:t.r,boxSizing:'border-box'}),D({position:'absolute',left:14,top:12},el));
 const H0=est(t,rc);const info=[cell(card(t,rc),'Default',''),cell(card(t,rc,{hover:true}),'Hover',cue.hover),cell(card(t,rc,{sel:true}),'Selected',cue.sel),cell(card(t,rc,{sel:true,edit:true}),'Editing title',cue.edit),cell(card(t,rc,{problem:true}),'Has a problem',cue.problem),cell(D({paddingTop:C?22:0},card(t,rc,{ph:'cur',n:3})),'Current flow step',cue.cur),
  cell(card(t,rc,{dim:true}),'Dimmed',cue.dim),cell(ghost(card(t,rc,{drag:true}),164,H0),'Being dragged',cue.drag),cell(card(t,rc,{target:true}),'Connection target',cue.target),cell(card(t,as({},rc,{kids:4})),'Has child components',cue.kids),cell(stack(t,as({},GPAY,{w:164,color:null})),'Collapsed group',cue.group),cell(card(t,rc,{nb:true}),'Highlighted neighbour',cue.nb)];
 const sc={shape:'diamond',title:'Payment OK?',w:150,h:96,tn:'Decision'};const sp=x=>D({paddingTop:C?16:6},x);
 const shp=[cell(sp(shape(t,sc,{})),'Default'),cell(sp(shape(t,sc,{hover:true})),'Hover'),cell(sp(shape(t,sc,{sel:true})),'Selected'),cell(sp(shape(t,sc,{sel:true,edit:true})),'Editing text'),cell(sp(shape(t,sc,{problem:true})),'Has a problem'),cell(D({paddingTop:C?24:6},shape(t,sc,{ph:'cur',n:5})),'Current flow step'),
  cell(sp(shape(t,sc,{dim:true})),'Dimmed'),cell(ghost(shape(t,sc,{drag:true}),150,96),'Being dragged'),cell(sp(shape(t,sc,{target:true})),'Connection target'),cell(sp(shape(t,sc,{kids:3})),'Has child components'),cell(sp(stack(t,{title:'Payment rules',n:3,members:['Payment OK?','Fraud OK?','Retry?'],icons:['diamond','diamond','diamond'],w:164,id:'GRP-08'})),'Collapsed group','A group of shapes stacks as cards'),cell(sp(shape(t,sc,{nb:true})),'Highlighted neighbour')];
 const grid=k=>D({display:'grid',gridTemplateColumns:'repeat(6,minmax(0,1fr))',gap:'18px 16px'},k);
 return plate(t,0,[sh(t,'States · information card','every state has a non-colour cue (right column of each label)'),grid(info),sh(t,'States · shape'),grid(shp)],{flow:true});}
function rowZoom(t){const C=t.dir==='C';const lv=[['land','Landscape','≤ 45 % · type icon and colour'],['sys','System','45–90 % · + title'],['ctr','Container','90–150 % · + type, description, status'],['cmp','Component','> 150 % · everything']];const c=as({},K.wh,{desc:'District 9 cross-dock'});const H=est(t,c);
 const row=D({display:'grid',gridTemplateColumns:'repeat(4,minmax(0,1fr))',gap:20},lv.map(([z,n,d])=>D({display:'flex',flexDirection:'column',gap:12},lbl(t,n,d),card(t,c,{zoom:z,H}),D({paddingTop:C?16:4},shape(t,{shape:'diamond',title:z==='land'?'':'Payment OK?',w:140,h:90,tn:'Decision',color:z==='land'?'amber':null},{zoom:z,label:z!=='land'})))));
 // dense board at landscape
 const cl=[['Storefront','slate',0,0,5,4],['Checkout','orange',1,0,5,5],['Payments','violet',2,0,4,5],['Fulfilment','teal',0,1,6,4],['Data','blue',1,1,5,4],['Ops','amber',2,1,4,5]];const sc=.255,cw=t.w,ch=96,gx=40,gy=40;const els=[];let n=0;
 cl.forEach(([nm,colr,cx,cy,cols,rows],ci)=>{const fx=cx*1420+30,fy=cy*820+60,fw=cols*(cw+gx)+gx,fh=rows*(ch+gy)+gy+50;
  els.push(D({position:'absolute',left:fx,top:fy,width:fw,height:fh,border:`3px ${t.dir==='C'?'dashed':'solid'} ${t.tx2}`,borderRadius:t.dir==='B'?40:t.dir==='C'?0:20,background:t.dir==='B'?PAL[colr][t.th].fill:'transparent',boxSizing:'border-box'},D({position:'absolute',left:24,top:-64,fontSize:46,fontWeight:600,color:t.tx,fontFamily:t.dir==='C'?M:G,letterSpacing:t.dir==='C'?'.04em':'-.01em',textTransform:t.dir==='C'?'uppercase':'none'},nm)));
  for(let r=0;r<rows;r++)for(let k=0;k<cols;k++){n++;const seed=(n*37)%11;const colored=seed<6;const cc=colored?PAL[colr][t.th]:null;const hh=ch+((n*13)%3)*14;const cur=ci===1&&r===1&&k===2;const icons=['box','database','router','arrow-left-right','square-check-big','warehouse','truck','ticket','cloud','monitor-smartphone'];
   els.push(D({position:'absolute',left:fx+gx+k*(cw+gx),top:fy+50+gy+r*(ch+gy),width:cw,height:hh,boxSizing:'border-box',background:cc?cc.fill:t.s2,border:`${cur?6:2}px solid ${cur?t.ac:cc?cc.stroke:t.cb}`,borderRadius:t.r*1.5,display:'flex',alignItems:'center',justifyContent:'center',boxShadow:t.dir==='B'?`0 6px 0 0 ${cur?t.ac:cc?cc.stroke:t.bd2}`:'none'},Ic(icons[n%icons.length],40,cc?cc.ink:t.tx2,1.5)));}});
 const W=3*1420+20,Hh=2*820+40;const dense=D({position:'relative',width:W*sc,height:Hh*sc,overflow:'hidden'},D({position:'absolute',left:0,top:0,width:W,height:Hh,transform:`scale(${sc})`,transformOrigin:'0 0'},X('svg',{width:W,height:Hh,style:{position:'absolute',left:0,top:0}},[[1100,400,1360,400],[2430,400,2690,400],[700,860,700,1000],[2000,860,2000,980],[1100,1250,1360,1250],[3100,860,3100,950]].map((p,i)=>h('path',{key:i,d:`M${p[0]} ${p[1]}L${p[2]} ${p[3]}`,stroke:i===0?t.ac:t.edgeC,strokeWidth:i===0?10:5}))),els));
 return plate(t,0,[sh(t,'Semantic zoom','the card keeps its size; detail appears and disappears'),row,sh(t,'Dense board at Landscape (~25 %)',n+' cards in 6 groups; the flow’s current card keeps its orange border'),dense],{flow:true});}
const FT=[['text','Text','type','Go','row'],['number','Number','hash','5 pts','row'],['select','Select','circle-chevron-down','Go','chip'],['status','Status','circle-dot','In progress','chip'],['person','Person','user-round','Lan','chip'],['date','Date','calendar','14 Oct','chip'],['range','Date range','calendar-range','6–17 Oct','chip'],['link','Link','link','runbook.sodo.dev/orders','row'],['progress','Number · as bar','gauge',82,'row']];
function rowFields(t){const A=t.dir==='A',B=t.dir==='B',C=t.dir==='C';const iw=t.w-2*t.pad-2;
 const types=D({display:'flex',flexDirection:'column',width:430,flex:'none'},sh(t,'Field types on the card'),D({height:12}),FT.map(([ft,nm,ic,v,how])=>{const f={k:nm.split(' ')[0],v,ft:ft==='text'?null:ft,c:'cyan'};const shown=B&&CHIPT[ft]?'chip':A?'row':C?'row':how;return D({display:'grid',gridTemplateColumns:'130px '+iw+'px 1fr',gap:14,alignItems:'center',minHeight:34,borderTop:`1px solid ${t.hl}`},D({display:'flex',alignItems:'center',gap:7,fontSize:12.5},Ic(ic,14,t.tx2,2),nm),D({minWidth:0},fieldsBlock(t,[f])),S({fontFamily:M,fontSize:10.5,color:t.mu},shown));}),
  D({fontSize:11.5,color:t.mu,lineHeight:1.5,marginTop:10,textWrap:'pretty'},A?'All fields are label–value rows; select and status values render as dot chips inside the row.':B?'Select, status, person and dates float as chips on one shelf (no label, the icon names them); text, number, link and bars are label–value rows.':'All fields are ruled table rows with a Mono label column; values keep their own form (chip, initials, ticks).'));
 const cardEx=D({display:'flex',flexDirection:'column',gap:12,flex:'none'},sh(t,'On the card'),card(t,as({},K.wh,{fields:[{k:'Capacity',v:82,ft:'progress'},{k:'SLA',v:'24 h',ft:'number'},{k:'Region',v:'South',ft:'select',c:'amber'}],more:3})),lbl(t,'3 more fields','hidden fields stay in the drawer; the row opens it'));
 const row=(ic,k,v,on,o)=>D({display:'grid',gridTemplateColumns:'14px 16px 74px minmax(0,1fr) 28px',gap:8,alignItems:'center',height:34,padding:'0 6px',borderRadius:B?10:C?1:6,background:o&&o.focus?t.s2:'transparent',boxShadow:o&&o.focus?`inset 0 0 0 2px ${t.ac}`:'none'},Ic('grip-vertical',13,t.mu,2),Ic(ic,14,t.tx2,2),S({fontSize:12,color:t.tx2,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'},k),D({minWidth:0,display:'flex'},v),tog(t,on));
 const fv=f=>fval(t,f);
 const menu=pnl(t,{position:'absolute',left:150,top:398,width:196,padding:6,zIndex:5},D({padding:'4px 6px 6px'},ml(t,'Field type')),FT.slice(0,8).map(([ft,nm,ic],i)=>D({display:'flex',alignItems:'center',gap:8,height:28,padding:'0 8px',borderRadius:B?9:C?1:6,fontSize:12.5,background:i===2?t.s2:'transparent',boxShadow:i===2?`inset 0 0 0 2px ${t.ac}`:'none'},Ic(ic,14,t.tx2,2),nm,S({flex:1}),i===2&&kbd(t,'⏎'))));
 const drawer=pnl(t,{position:'relative',width:380,flex:'none',padding:0,boxShadow:'none'},
  D({display:'flex',alignItems:'center',gap:10,padding:'14px 16px',borderBottom:`1px solid ${t.hl}`},D({width:36,height:36,borderRadius:B?12:C?2:9,background:PAL.teal[t.th].chip,color:PAL.teal[t.th].ink,display:'flex',alignItems:'center',justifyContent:'center'},Ic('warehouse',18,null,1.75)),D({display:'flex',flexDirection:'column',gap:1,flex:1},S({fontSize:15,fontWeight:500},'Warehouse HCM'),S({fontSize:11.5,color:t.mu},'Warehouse · Logistics')),btnI(t,'x',{})),
  D({padding:'14px 12px 16px',display:'flex',flexDirection:'column',gap:2,position:'relative'},D({display:'flex',justifyContent:'space-between',padding:'0 6px 6px'},ml(t,'Fields'),ml(t,'On card')),
   row('gauge','Capacity',fv({v:82,ft:'progress'}),true),row('hash','SLA',fv({v:'24 h',ft:'number'}),true),row('circle-chevron-down','Region',fv({v:'South',ft:'select',c:'amber'}),true),row('circle-dot','Status',fv({v:'Open',ft:'status'}),true,{focus:false}),
   row('user-round','Manager',fv({v:'Minh Tran',ft:'person'}),false),row('hash','Docks',fv({v:'12',ft:'number'}),false),row('link','Site',fv({v:'maps/hcm-d9',ft:'link'}),false),
   D({height:1,background:t.hl,margin:'8px 0'}),
   D({display:'grid',gridTemplateColumns:'1fr 120px',gap:8,padding:'0 6px'},inp(t,'Temperature zone',{focus:true}),D({height:32,display:'flex',alignItems:'center',gap:6,padding:'0 8px',border:`1px solid ${t.ac}`,borderRadius:B?10:C?2:8,fontSize:12.5,boxSizing:'border-box'},Ic('circle-chevron-down',14,t.tx2,2),'Select',S({flex:1}),Ic('chevron-down',13,t.mu,2))),
   D({display:'flex',flexWrap:'wrap',gap:6,padding:'10px 6px 0',alignItems:'center'},chip(t,'Ambient','amber'),chip(t,'Chilled','blue'),chip(t,'Frozen','cyan'),S({fontSize:12,color:t.tx2,display:'inline-flex',alignItems:'center',gap:3},Ic('plus',12,t.tx2,2),'Option')),
   D({display:'flex',alignItems:'center',gap:8,padding:'12px 6px 0',fontSize:12.5},tog(t,true),'Show on card',S({flex:1}),S({fontSize:11.5,color:t.mu},'Esc cancels · ⏎ adds')),
   D({display:'flex',alignItems:'center',gap:6,height:30,margin:'12px 6px 0',padding:'0 10px',alignSelf:'flex-start',borderRadius:B?99:C?1:8,border:`1px dashed ${t.bd2}`,fontSize:12.5,color:t.tx2},Ic('plus',14,t.tx2,2),'Add field'),menu));
 return plate(t,0,[D({display:'flex',gap:36,alignItems:'flex-start'},types,cardEx,D({display:'flex',flexDirection:'column',gap:12,paddingBottom:230},sh(t,'Details drawer · field editor'),drawer))],{flow:true});}
function rowTags(t){const B=t.dir==='B',C=t.dir==='C';const deck=['critical','pci','payments','PIC','api','legacy','beta','ops'];
 const sw=(cn,o)=>{o=o||{};const p=PAL[cn][t.th];return S({width:o.s||18,height:o.s||18,borderRadius:C?1:99,background:p.fill,border:`1.5px solid ${p.stroke}`,boxSizing:'border-box',display:'inline-flex',alignItems:'center',justifyContent:'center',flex:'none',boxShadow:o.sel?`0 0 0 2px ${t.s}, 0 0 0 4px ${t.ac}`:'none'},o.sel&&Ic('check',11,p.ink,3));};
 const spec=D({display:'flex',flexDirection:'column',gap:14,width:300,flex:'none'},sh(t,'Tag chip'),D({display:'flex',flexWrap:'wrap',columnGap:t.dir==='A'?10:5,rowGap:6},HUES.map(([n])=>chip(t,n,n,null,{sm:true}))),lbl(t,'On card',t.dir==='A'?'15px tall, 6px dot, no fill':B?'18px pill, chip fill + ink':'15px, 1px colour outline, square swatch'),
  D({display:'flex',flexWrap:'wrap',gap:6},chip(t,'critical','red',null,{x:true}),chip(t,'pci','violet',null,{x:true}),chip(t,'payments','green',null,{x:true})),lbl(t,'In the drawer','21px with remove ×; focus ring 2px orange'),
  D({paddingTop:12},card(t,{type:'service',title:'Checkout API',tags:TEN})),lbl(t,'10 tags on one card'));
 const rowT=(n,c,cnt,o)=>D({display:'flex',alignItems:'center',gap:9,height:30,padding:'0 8px',borderRadius:B?9:C?1:6,fontSize:12.5,background:o&&o.hover?t.s2:'transparent',boxShadow:o&&o.focus?`inset 0 0 0 2px ${t.ac}`:'none'},o&&o.on?Ic('check',14,t.tx,2.25):S({width:14}),sw(c,{s:14}),S({flex:1},n),S({fontFamily:M,fontSize:10.5,color:t.mu},cnt),o&&o.hover&&Ic('pencil',13,t.tx2,2));
 const picker=pnl(t,{width:272,padding:6,flex:'none'},D({padding:2},inp(t,'pa',{icon:'search',focus:true,fill:true})),D({padding:'8px 8px 4px'},ml(t,'Deck tags')),rowT('payments','green',6,{on:true}),rowT('pci','violet',4,{on:true,hover:true,focus:true}),rowT('PIC','indigo',2),rowT('Lan','pink',3),
  D({height:1,background:t.hl,margin:'5px -6px'}),D({display:'flex',alignItems:'center',gap:8,height:30,padding:'0 8px',fontSize:12.5,color:t.tx},Ic('plus',14,t.tx2,2),'Create tag ',S({fontWeight:600},'“pa”'),S({flex:1}),kbd(t,'⏎')));
 const edit=pnl(t,{width:244,padding:12,display:'flex',flexDirection:'column',gap:10,flex:'none'},ml(t,'Edit tag'),inp(t,'pci',{}),D({display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:8,justifyItems:'center'},HUES.map(([n])=>sw(n,{s:22,sel:n==='violet'})),S({width:22,height:22,borderRadius:C?1:99,border:`1px dashed ${t.bd2}`,display:'inline-flex',alignItems:'center',justifyContent:'center',boxSizing:'border-box'},Ic('plus',12,t.tx2,2))),
  D({display:'flex',alignItems:'center',gap:6,fontSize:11.5,color:t.mu},'Deck colours',...CUSTOM.map(([n,hx])=>S({width:16,height:16,borderRadius:C?1:99,background:hx,border:`1px solid ${t.bd2}`}))),D({height:1,background:t.hl,margin:'0 -12px'}),D({display:'flex',alignItems:'center',gap:8,fontSize:12.5,color:t.clay},Ic('trash-2',14,t.clay,2),'Delete tag',S({flex:1}),S({fontSize:11,color:t.mu},'used on 4 cards')));
 const drawerRow=pnl(t,{width:380,padding:'14px 16px',boxShadow:'none',display:'flex',flexDirection:'column',gap:10,flex:'none'},ml(t,'Tags'),D({display:'flex',flexWrap:'wrap',gap:6,alignItems:'center'},chip(t,'critical','red',null,{x:true}),D({borderRadius:t.dir==='A'?3:99,boxShadow:`0 0 0 2px ${t.s}, 0 0 0 4px ${t.ac}`},chip(t,'pci','violet',null,{x:true})),chip(t,'payments','green',null,{x:true}),S({display:'inline-flex',alignItems:'center',gap:4,height:22,padding:'0 9px',borderRadius:B?99:C?1:6,border:`1px dashed ${t.bd2}`,fontSize:12,color:t.tx2},Ic('plus',12,t.tx2,2),'Add tag')),S({fontSize:11.5,color:t.mu},'Focus on “pci”: ⌫ removes, ⏎ opens the picker'));
 return plate(t,0,[D({display:'flex',gap:28,alignItems:'flex-start',flexWrap:'wrap'},spec,D({display:'flex',flexDirection:'column',gap:12},sh(t,'Tag picker'),D({display:'flex',gap:10,alignItems:'flex-start'},picker,D({paddingTop:52},edit))),D({display:'flex',flexDirection:'column',gap:12},sh(t,'Drawer tag row'),drawerRow))],{flow:true});}
function rowPalette(t){const A=t.dir==='A',B=t.dir==='B',C=t.dir==='C';const fx=v=>v.toFixed(1);
 const badge=(r,min)=>S({fontFamily:M,fontSize:10.5,color:r>=min?t.tx2:t.clay,display:'inline-flex',alignItems:'center',gap:3},r>=min?Ic('check',11,t.tx2,2.5):Ic('x',11,t.clay,2.5),fx(r));
 const head=D({display:'grid',gridTemplateColumns:'110px 190px 150px 210px 1fr',gap:14,padding:'0 0 8px',borderBottom:`1px solid ${t.bd}`},...['Colour','Card fill · title','Stroke · on canvas','Chip · '+(A?'dot':B?'solid tint':'outline'),'Tokens (hex)'].map(x=>ml(t,x)));
 const rows=HUES.map(([n])=>{const p=PAL[n][t.th];const chipTxt=A?t.tx2:B?p.ink:t.tx,chipBg=A?t.s:B?p.chip:t.s;
  return D({display:'grid',gridTemplateColumns:'110px 190px 150px 210px 1fr',gap:14,alignItems:'center',minHeight:38,borderBottom:`1px solid ${t.hl}`},S({fontSize:12.5,fontWeight:500,textTransform:'capitalize'},n),
   D({display:'flex',alignItems:'center',gap:8},D({width:96,height:28,background:p.fill,border:`1px solid ${p.stroke}`,borderRadius:t.r,display:'flex',alignItems:'center',padding:'0 8px',fontSize:12.5,fontWeight:500,color:t.tx,boxSizing:'border-box'},'Aa Title'),badge(CR(t.tx,p.fill),4.5)),
   D({display:'flex',alignItems:'center',gap:8},D({width:48,height:0,borderTop:`2px solid ${p.stroke}`}),badge(CR(p.stroke,t.cv),3)),
   D({display:'flex',alignItems:'center',gap:8},chip(t,n,n),badge(CR(chipTxt,chipBg),4.5),(A||C)&&S({fontFamily:M,fontSize:10,color:t.mu},'mark '+fx(CR(A?p.dot:p.stroke,t.s)))),
   S({fontFamily:M,fontSize:10,color:t.mu,whiteSpace:'nowrap'},`fill ${p.fill} · stroke ${p.stroke} · chip ${p.chip} · ink ${p.ink}`));});
 const cust=CUSTOM.map(([n,hx])=>{const txt=lum(hx)<.18?'#ffffff':'#1c1c1a';return D({display:'grid',gridTemplateColumns:'110px 190px 150px 210px 1fr',gap:14,alignItems:'center',minHeight:38,borderBottom:`1px solid ${t.hl}`},S({fontSize:12.5,fontWeight:500},n+' · custom'),D({display:'flex',alignItems:'center',gap:8},D({width:96,height:28,background:hx,borderRadius:t.r,display:'flex',alignItems:'center',padding:'0 8px',fontSize:12.5,fontWeight:500,color:txt}, 'Aa Title'),badge(CR(txt,hx),4.5)),D({display:'flex',alignItems:'center',gap:8},D({width:48,borderTop:`2px solid ${hx}`}),badge(CR(hx,t.cv),3)),S({fontSize:11.5,color:t.mu},'chip uses the hex as fill, text flips'),S({fontFamily:M,fontSize:10,color:t.mu},hx+' · text '+txt));});
 return plate(t,0,[sh(t,'Palette · 13 colours · '+t.th,'Ratios are computed from the hex values: text ≥ 4.5 (AA), stroke and dots ≥ 3 (non-text). Colour is decoration; no state depends on it.'),D({display:'flex',flexDirection:'column'},head,rows,cust),
  D({fontSize:12,color:t.tx2,lineHeight:1.5,maxWidth:900,textWrap:'pretty'},A?'Dot chip: text is always Secondary on the card surface, so contrast does not depend on the colour; the 6px dot carries the colour and is checked as a non-text mark (≥ 3). Amber, yellow and lime strokes sit slightly darker (L .57) in light mode so they clear 3:1 on the canvas.':B?'Solid tint: chip fill at L .915 (light) / .39 (dark) with ink at L .42 / .90 of the same hue. All 13 pass AA for 10.5px/500 text. The lip uses the stroke colour, which is checked against the canvas (≥ 3).':'Outline chip: text is Ink on the surface; the 1px outline and 6px square swatch carry the colour and are checked as non-text marks. Relationship colours (blue, violet, teal) come from the same palette.')],{flow:true});}
function rowTypes(t){const B=t.dir==='B',C=t.dir==='C';const cats=[['Architecture',['service','database','gateway','client','queue','external','component']],['Process',['task','decision','document']],['Logistics',['warehouse','truck']],['Data',['ticket']]];
 const tile=(ic,nm,i,o)=>D({display:'flex',flexDirection:'column',alignItems:C?'flex-start':'center',justifyContent:'center',gap:6,height:66,padding:C?'0 8px':0,borderRadius:B?12:C?1:7,border:`${B?1.5:1}px solid ${o&&o.focus?t.ac:B?t.bd2:C?t.cb:t.hl}`,background:B?t.s2:t.s,boxShadow:B?`0 2px 0 0 ${t.bd2}`:o&&o.focus?`0 0 0 3px ${t.acs}`:'none',position:'relative',boxSizing:'border-box',fontSize:11.5,color:t.tx},Ic(ic,18,t.tx2,1.75),S({fontFamily:C?M:G,fontSize:C?9.5:11.5,textTransform:C?'uppercase':'none',letterSpacing:C?'.04em':0,whiteSpace:'nowrap'},nm),C&&S({position:'absolute',right:5,top:4,fontFamily:M,fontSize:8.5,color:t.mu},'A-'+String(i).padStart(2,'0')));
 let ii=0;const fly=pnl(t,{width:316,flex:'none',padding:0},D({display:'flex',alignItems:'center',gap:6,height:46,padding:'0 8px 0 14px',borderBottom:`1px solid ${t.hl}`},S({fontSize:13.5,fontWeight:500,flex:1},'Add'),btnI(t,'pin',{}),btnI(t,'x',{})),
  D({padding:'10px 12px 0'},inp(t,'',{icon:'search',ph:'Search types…',fill:true,right:kbd(t,'/')})),
  D({display:'flex',gap:4,padding:'10px 12px',flexWrap:'wrap'},...['All','Architecture','Process','Logistics','Data','Shapes'].map((x,i)=>S({height:24,padding:'0 9px',display:'inline-flex',alignItems:'center',borderRadius:B?99:C?1:6,fontSize:11.5,fontWeight:i===0?600:400,background:i===0?t.tx:'transparent',color:i===0?t.s:t.tx2,border:i===0?'none':`1px solid ${t.hl}`},x))),
  D({padding:'0 12px 12px',display:'flex',flexDirection:'column',gap:10},cats.map(([cn,ts])=>D({display:'flex',flexDirection:'column',gap:6},D({display:'flex',justifyContent:'space-between'},ml(t,cn),S({fontFamily:M,fontSize:10,color:t.mu},ts.length)),D({display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6},ts.map(k=>tile(TYPES[k].icon,TYPES[k].name,++ii,ii===1?{focus:true}:null))))),
   D({display:'flex',flexDirection:'column',gap:6},ml(t,'Basic shapes'),D({display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6},[['square','Rectangle'],['circle','Ellipse'],['diamond','Diamond'],['sticky-note','Sticky'],['type','Text'],['frame','Frame']].map(([ic,nm])=>tile(ic,nm,++ii))))),
  D({display:'flex',alignItems:'center',gap:8,height:42,padding:'0 14px',borderTop:`1px solid ${t.hl}`,fontSize:12.5,color:t.tx2},Ic('package',14,t.tx2,2),'Packs · 5 on',S({flex:1}),Ic('chevron-right',14,t.mu,2)));
 const packs=[['Architecture',7,true],['Process',3,true],['Logistics',2,true],['Data cards',1,true],['Basic shapes',13,true],['C4 model',6,false],['BPMN',14,false],['Cloud · AWS',40,false]];
 const pk=pnl(t,{width:300,flex:'none',padding:0},D({display:'flex',alignItems:'center',gap:6,height:46,padding:'0 8px 0 10px',borderBottom:`1px solid ${t.hl}`},btnI(t,'chevron-left',{}),S({fontSize:13.5,fontWeight:500,flex:1},'Packs in this deck')),
  D({padding:8},packs.map(([n,c,on],i)=>D({display:'flex',alignItems:'center',gap:10,height:40,padding:'0 8px',borderRadius:B?10:C?1:7,boxShadow:i===5?`inset 0 0 0 2px ${t.ac}`:'none'},D({display:'flex',flexDirection:'column',flex:1},S({fontSize:12.5,color:on?t.tx:t.tx2},n),S({fontSize:11,color:t.mu},c+(c===1?' type':' types'))),S({fontSize:11,color:t.mu},on?'On':'Off'),tog(t,on)))),
  D({padding:'0 16px 14px',fontSize:11.5,color:t.mu,lineHeight:1.45,textWrap:'pretty'},'Turning a pack off hides its types from Add. Cards already on the board keep rendering.'));
 const rail=pnl(t,{width:48,padding:5,display:'flex',flexDirection:'column',gap:4,flex:'none',alignItems:'center',boxShadow:'none'},btnI(t,'mouse-pointer-2',{}),btnI(t,'hand',{}),D({width:34,height:34,borderRadius:B?99:C?2:8,background:t.acs,color:t.aci,display:'flex',alignItems:'center',justifyContent:'center'},Ic('plus',18,null,2)),btnI(t,'spline',{}),btnI(t,'type',{}));
 return plate(t,0,[sh(t,'Card type palette · rail “Add” flyout','search, category tabs and sections, packs on/off per deck'),D({display:'flex',gap:14,alignItems:'flex-start'},rail,fly,D({width:30}),pk)],{flow:true});}
// ---------- notes & comparison
const NOTES={A:{name:'Ledger',kind:'Editorial / quiet',tagline:'Type-led cards on a flat sheet. Structure comes from type and hairlines; colour is a user-chosen fill, stroke or dot. Flow position is an index tab clipped to the card’s top edge.',
 tokens:[['Radius','6 card · 10 frame and popovers'],['Border','1px Border #deded8 / #35352f; hover Secondary; coloured cards use the colour stroke'],['Shadow','None on cards. Float only on floating tools'],['Type','Type label 10/500 caps +.07em · title 13.5/500 −.01em, 1.3 · body 11.5 · field label 10.5 Muted · Mono 10–10.5'],['Spacing','176 wide · 10/11 padding · 6 gap'],['Chip','Dot chip: 6px colour dot + Secondary text, no fill, 15–17px'],['Connector','1.25px, orthogonal, 8px corners, open chevron end, no start mark'],['Handles','3×12 bars at side midpoints, 4×16 orange when active']],
 distinct:'The title leads; the kind is a small-caps line, not a coloured tile. Played, current and upcoming steps read as a tabbed index (✓02, ▶03, 04). Handles are short bars, not grey dots.',
 deck:'Light touch. The index tab is the card’s corner index; a collapsed group is two hairline sheets offset up-right. Playback does not move cards.',
 risks:'Can look plain in screenshots; a board without user colour is mostly grey. Hairlines sit close to the dot grid in dark mode (border raised to #35352f). Index tabs need 12px vertical clearance between cards.'},
 B:{name:'Deck',kind:'Tactile / playful',tagline:'Cards are thick paper: a solid 3px lip, 14px corners, filled chips. Playback deals the deck: played cards get a ✓ sticker, the current card lifts on an orange lip, upcoming cards wait with a dashed number.',
 tokens:[['Radius','14 card · 20 frame · pill chips'],['Border','1.5px Border-strong #cfcfc7 / #45453f, or the colour stroke'],['Shadow','Solid 0 3px 0 lip in the stroke colour (5px hover / current, 6px dragging); no blur'],['Type','Title 14/600, 1.28 · type name 11.5/500 · body 12 · chips 11.5/500'],['Spacing','184 wide · 12 padding · 8 gap'],['Chip','Solid tint: chip fill L .915 / .39 with same-hue ink L .42 / .90'],['Connector','2px smooth curves, rounded filled arrow, 3.5px start knob'],['Handles','12px round knobs, 16px orange with 4px halo when active']],
 distinct:'The lip gives every card a physical edge and costs one extra rect in Canvas 2D. Kind sits in a 24px rounded tile; flow stickers sit on the top-left corner. Collapsed groups fan out like a hand of cards.',
 deck:'Most literal: cards have thickness, groups are fanned hands, and playback deals the deck in order.',
 risks:'Busy on dense boards: 200 lips form stripes and filled chips compete with the flow highlight. Drop the lip below 60 % zoom and use dots for chips at System level. Cards are ~20 % taller, so fewer fit per screen. Fanned stacks need rotation in the Canvas renderer.'},
 C:{name:'Spec',kind:'Technical / blueprint',tagline:'Cards are spec sheets: a header band with a Mono type label and id, a body, and a footer band for tags. Ports, numbered balloons and relationship line styles come from engineering drawings.',
 tokens:[['Radius','2'],['Border','1px Border-strong #b5b5ad / #4d4d46; bands use the same rule'],['Shadow','None'],['Type','Header Mono 9.5/500 caps · title 12.5/500 · body 11 · field labels Mono 9 caps'],['Spacing','188 wide · 22 header · 9 body padding · 5 gap'],['Chip','Outline: 1px colour stroke + 6px square swatch, Mono caps text in Ink'],['Connector','1px orthogonal, sharp corners, filled triangle, 5px square start port; calls solid · reads dashed · writes long dash · depends dotted, each with its own colour'],['Handles','7px square ports, 9px orange when active'],['Canvas','Line grid 24 / 120 instead of dots']],
 distinct:'Regions are visible as ruled bands, so the card reads without colour. Ids live in the header. Flow steps are numbered balloons on leaders, like part callouts.',
 deck:'Reads the deck as a drawing set: a collapsed group is a stack of sheets with a sheet count, and the id is the sheet number. Playback calls parts out in order rather than dealing them.',
 risks:'Mono caps cost characters per line (~22 vs ~28) and tire the eye. Bands add ~40px per card. Relationship colours compete with user card colours, so they are limited to three and always paired with a dash. Feels cold for process and planning boards.'}};
const CMP=[['Character','Quiet, type-led, flat','Friendly, physical, chunky','Structured, precise, technical'],
 ['200+ cards','Calmest. Hairlines and dots fade into the grid','Busiest. Lips and filled chips stripe the board; needs zoom rules','Calm but dense; bands add height, the grid adds texture'],
 ['Flow playback','Index tabs ✓02 ▶03 04; orange edge + dot token','Stickers, lifted current card, numbered token disc; strongest moment','Balloons on leaders, “STEP 03 · NOW” band, crosshair token'],
 ['Deck metaphor','Corner index; hairline sheets','Thick cards, fanned hands, dealing','Drawing set; sheet stack and sheet numbers'],
 ['Identity vs a generic card','Moderate: needs the tab and type label to stand out','High: the lip is recognisable at any zoom','High: bands, ids and ports'],
 ['Colour & contrast','All chip text is neutral; passes everywhere','Chip ink on tint passes AA for all 13','Ink text, colour in outlines; relationship colours add load'],
 ['Canvas 2D cost','Lowest: rect + text','Low: one extra offset rect; rotation for fans','Low: rect + rules; more text runs'],
 ['Card size','176 wide, shortest','184 wide, ~20 % taller','188 wide, ~25 % taller'],
 ['Main risk','Plain; relies on user colour','Noise on dense boards','Cold; Mono caps fatigue'],
 ['Best for','Large architecture maps','Process, planning, workshops','Architecture reviews, docs']];
function compareEl(dir,th){const t=TK(dir,th);h=h||window.React.createElement;return plate(t,0,[sh(t,dir+' · '+NOTES[dir].name),D({display:'flex',gap:22,alignItems:'flex-start',paddingTop:dir==='C'?24:6},card(t,K.svc,{ph:'cur',n:3}),stack(t,GPAY),shape(t,{shape:'diamond',title:'Payment OK?',w:140,h:92,tn:'Decision'},{ph:'next',n:5}))],{flow:true});}
const ROWS=[['sample','Signature moment · sample board with a flow playing','~20 cards, five categories, one collapsed group, one expanded group, a branch point and an error path',rowSample],
 ['conn','Connections and focus','hover highlight, bundle with count, an end moved along a side, drill-in with outside proxies and a relationship legend',rowConn],
 ['groups','Groups','collapsed stack with merged connectors, expanded frame',rowGroups],
 ['set','Sample set','information cards, shapes, and the in-between types in both forms',rowSet],
 ['edge','Edge cases','',rowEdge],['states','States','',rowStates],['zoom','Zoom levels','',rowZoom],['fields','Typed fields','',rowFields],['tags','Tags','',rowTags],['palette','Colour','',rowPalette],['types','Type palette','',rowTypes]];
window.SDC={ROWS:ROWS.map(r=>({id:r[0],title:r[1],sub:r[2]})),NOTES,CMP,
 plate(React,row,dir,th){h=React.createElement;const r=ROWS.find(x=>x[0]===row);try{return r[3](TK(dir,th));}catch(e){console.error('plate',row,dir,th,e);return null;}},
 compare(React,dir,th){h=React.createElement;return compareEl(dir,th);}};
})();
