(function(){
const W=164,H=50,LANE=637,WW=1090,WH=660;
const THEMES={
light:{'--app':'#e9e9e6','--s':'#ffffff','--s2':'#f4f4f1','--s3':'#ecece8','--bd':'#ecece8','--bd2':'#deded8','--cv':'#fafaf8','--grp':'rgba(255,255,255,.7)','--dot':'#d9d9d3','--tx':'#1c1c1a','--tx2':'#55554f','--mu':'#72726b','--ac':'#f2661c','--ach':'#d9560f','--acs':'#fdeee4','--act':'#b3480c','--ams':'#f6eddb','--amt':'#8a6112','--rds':'#f7e5df','--rdt':'#9a3b25','--bls':'#e3ecf5','--blt':'#2d5b86','--ink':'#1c1c1a','--inkt':'#ffffff','--edge':'#c9c9c2','--sh':'rgba(0,0,0,.06)','--code':'#f7f7f4','--ov':'rgba(28,28,26,.3)'},
dark:{'--app':'#0b0b0a','--s':'#171716','--s2':'#212120','--s3':'#2b2b29','--bd':'#262624','--bd2':'#35352f','--cv':'#121211','--grp':'rgba(255,255,255,.025)','--dot':'#2a2a27','--tx':'#ededea','--tx2':'#b8b8b1','--mu':'#909089','--ac':'#f07a32','--ach':'#ff8a45','--acs':'#3a2214','--act':'#ffb285','--ams':'#352a14','--amt':'#e2b659','--rds':'#3a1f19','--rdt':'#ef9f8a','--bls':'#172636','--blt':'#8fbbe3','--ink':'#ededea','--inkt':'#171716','--edge':'#3d3d38','--sh':'rgba(0,0,0,.45)','--code':'#1c1c1b','--ov':'rgba(0,0,0,.6)'}};
const KT={client:['var(--s2)','var(--tx2)'],edge:['var(--ink)','var(--inkt)'],service:['var(--acs)','var(--act)'],queue:['var(--ams)','var(--amt)'],data:['var(--bls)','var(--blt)'],external:['var(--rds)','var(--rdt)'],note:['var(--s2)','var(--mu)']};
const KIND={client:'Client',edge:'Gateway',service:'Service',queue:'Queue',data:'Database',external:'External'};
const KICON={client:'devices',edge:'router',service:'deployed_code',queue:'swap_horiz',data:'database',external:'cloud'};
const tile=(k,s)=>({width:s,height:s,flex:'none',borderRadius:Math.round(s*.3),background:(KT[k]||KT.note)[0],color:(KT[k]||KT.note)[1],display:'flex',alignItems:'center',justifyContent:'center'});
const GROUPS=[
{id:'clients',label:'Clients',x:20,y:30,w:196,h:290},
{id:'edge',label:'Edge',x:234,y:110,w:196,h:210},
{id:'core',label:'Core services',x:444,y:30,w:386,h:420},
{id:'msg',label:'Messaging',x:444,y:470,w:386,h:100},
{id:'data',label:'Data',x:870,y:30,w:196,h:290},
{id:'external',label:'External',x:870,y:350,w:196,h:290}];
const N=(id,group,kind,x,y,title,icon,tech,host,owner,tags,desc,rules,links)=>({id,group,kind,x,y,title,icon,tech,host,owner,tags,desc,rules:rules||[],links:links||[]});
const NODES=[
N('customer','clients','client',36,80,'Customer App','smartphone','React Native','iOS · Android','Mobile',['public'],'Consumer app for placing orders and following deliveries on a live map.'),
N('driver','clients','client',36,165,'Driver App','local_shipping','React Native','Android fleet devices','Mobile',['field'],'Receives job offers, navigates routes and captures proof of delivery.'),
N('ops','clients','client',36,250,'Ops Console','dashboard','Next.js','Vercel','Operations',['internal'],'Dispatcher view of live orders, exceptions and driver capacity.'),
N('gateway','edge','edge',250,160,'API Gateway','router','Envoy','k8s · 4 pods','Platform',['edge','critical'],'Single entry point for all clients.\n- Terminates TLS\n- Rate limit per client: `600 req/min`\n- Routes to internal services over gRPC',[],[{label:'Runbook',url:'notion.so/acme/gateway-runbook'}]),
N('auth','edge','edge',250,245,'Auth Service','key','Keycloak','k8s · 2 pods','Platform',['security'],'Issues and validates JWTs for customers, drivers and staff.'),
N('order','core','service',460,80,'Order Service','receipt_long','Go','k8s · 6 pods','Orders',['critical','pii'],'Owns the order lifecycle from checkout to delivery.\n- Validates cart and address\n- Requests a quote and a payment authorization\n- Emits `order.created` on success',['r1'],[{label:'Runbook',url:'notion.so/acme/order-runbook'},{label:'Repository',url:'github.com/acme/order-service'},{label:'Dashboard',url:'grafana.acme.io/d/orders'}]),
N('pod','core','service',460,165,'Proof of Delivery','photo_camera','Kotlin','k8s · 2 pods','Dispatch',['field'],'Stores photos and signatures and records delivered or failed attempts.',['r2']),
N('tracking','core','service',460,250,'Tracking Service','my_location','Rust','k8s · 8 pods','Dispatch',['realtime'],'Ingests GPS pings and streams positions to customers.'),
N('notify','core','service',460,335,'Notification Service','notifications','Node.js','k8s · 3 pods','Platform',[],'Sends push, SMS and email based on order events.'),
N('pricing','core','service',650,122,'Pricing Service','sell','Python','k8s · 3 pods','Orders',[],'Quotes delivery fees from distance, weight and priority.',['r1']),
N('payment','core','service',650,207,'Payment Service','credit_card','Java','k8s · 3 pods','Payments',['pci','critical'],'Authorizes at checkout and captures after delivery.',['r3']),
N('dispatch','core','service',650,292,'Dispatch Service','hub','Go','k8s · 4 pods','Dispatch',['critical'],'Matches orders to available drivers and reschedules failed attempts.',['r1','r2']),
N('route','core','service',650,377,'Route Optimizer','route','Python · OR-Tools','k8s · GPU pool','Dispatch',[],'Builds multi-stop routes under vehicle and time-window constraints.'),
N('bus','msg','queue',555,495,'Event Bus','swap_horiz','Kafka','MSK · 3 brokers','Platform',['async'],'Order and delivery events. Topics: `order.*`, `delivery.*`.'),
N('ordersdb','data','data',886,80,'Orders DB','database','PostgreSQL 16','RDS · Multi-AZ','Orders',['pii'],'System of record for orders and delivery status.'),
N('trackdb','data','data',886,165,'Tracking Store','timeline','TimescaleDB','Managed · 30-day retention','Dispatch',[],'Time series of driver positions.'),
N('cache','data','data',886,250,'Position Cache','bolt','Redis','ElastiCache','Dispatch',['realtime'],'Latest known position per driver, TTL 30 s.'),
N('maps','external','external',886,400,'Maps API','map','Google Maps Platform','External vendor','Dispatch',['vendor'],'Distance matrix and ETA estimates.'),
N('sms','external','external',886,485,'SMS Gateway','sms','Twilio','External vendor','Platform',['vendor'],'Delivery SMS to customers.'),
N('stripe','external','external',886,570,'Payment Provider','payments','Stripe','External vendor','Payments',['vendor','pci'],'Card authorization and capture.')];
const EDGES=[['e1','customer','gateway','HTTPS'],['e2','gateway','auth','verify JWT'],['e3','gateway','order','POST /orders'],['e4','order','pricing','quote'],['e5','order','payment','authorize'],['e6','payment','stripe','charge'],['e7','order','ordersdb','INSERT'],['e8','order','bus','order.created'],['e9','bus','dispatch','consume'],['e10','dispatch','route','optimize'],['e11','route','maps','ETA matrix'],['e12','dispatch','notify','driver.assigned'],['e13','notify','gateway','push'],['e14','gateway','driver','job offer'],['e15','notify','sms','send SMS'],['e16','driver','gateway','HTTPS'],['e17','gateway','tracking','GPS stream'],['e18','tracking','trackdb','append'],['e19','tracking','cache','latest pos'],['e20','tracking','gateway','WebSocket'],['e21','gateway','customer','live map'],['e22','gateway','pod','upload proof'],['e23','pod','ordersdb','UPDATE status'],['e24','pod','bus','delivery.completed'],['e25','bus','notify','fan-out'],['e26','bus','payment','capture'],['e27','pod','dispatch','reattempt'],['e28','gateway','ops','alert']].map(([id,from,to,label])=>({id,from,to,label,proto:/POST|HTTPS|JWT|upload|alert/.test(label)?'HTTPS':/order\.|delivery\.|consume|fan-out|capture|assigned/.test(label)?'Kafka':/INSERT|UPDATE|append/.test(label)?'SQL':/WebSocket|live|stream|push|offer/.test(label)?'WebSocket':'gRPC'}));
const FLOWS=[
{id:'f1',name:'Place order',desc:'Checkout to a confirmed, paid order.',steps:[['e1','customer taps Place order','< 150 ms'],['e2','request.headers.authorization != null','< 40 ms'],['e3','token.valid && token.role == "customer"','< 200 ms'],['e4','cart.items.length > 0','< 120 ms','r1',{'Distance (km)':'3.2','Weight (kg)':'4','Priority':'Express'}],['e5','quote.accepted == true','< 800 ms'],['e6','payment.method != null','< 1.5 s'],['e7','payment.status == "authorized"','< 50 ms'],['e8','order.persisted == true','< 100 ms']]},
{id:'f2',name:'Assign driver',desc:'Match a new order to a driver and notify both sides.',steps:[['e9','event.type == "order.created"','< 2 s'],['e10','drivers.available > 0','< 3 s','r1',{'Distance (km)':'14','Weight (kg)':'22','Priority':'Standard'}],['e11','route.stops <= 25','< 400 ms'],['e12','route.feasible == true','< 500 ms'],['e13','driver.online == true','< 1 s'],['e14','offer.expires_in >= 60 s','< 60 s'],['e15','customer.sms_opt_in == true','< 5 s']]},
{id:'f3',name:'Live tracking',desc:'Driver GPS to the customer map in near real time.',steps:[['e16','every 5 s while on shift','< 1 s'],['e17','ping.accuracy < 50 m','< 100 ms'],['e18','always','< 20 ms'],['e19','always','< 10 ms'],['e20','subscribers.count > 0','< 300 ms'],['e21','app.state == "foreground"','< 1 s']]},
{id:'f4',name:'Proof of delivery',desc:'Driver confirms drop-off; payment is captured.',steps:[['e16','driver taps Delivered','< 1 s'],['e22','proof.photo || proof.signature','< 3 s'],['e23','proof.verified == true','< 50 ms'],['e24','order.status == "delivered"','< 100 ms'],['e25','always','< 2 s'],['e26','order.status in ("delivered","partial")','< 5 s','r3',{'Order status':'Delivered','Amount (€)':'42'}]]},
{id:'f5',name:'Failed delivery',desc:'Attempt failed; reschedule or return to depot.',steps:[['e16','driver marks attempt failed','< 1 s'],['e22','reason != null','< 3 s'],['e27','attempt.count <= 3','< 1 s','r2',{'Attempt':'2','Customer reachable':'No'}],['e10','slot.available == true','< 3 s'],['e12','job.rescheduled == true','< 500 ms'],['e13','always','< 1 s'],['e28','attempt.count > 2','< 1 min']]}].map(f=>({...f,steps:f.steps.map(([e,cond,sla,rule,ctx])=>({e,cond,sla,rule:rule||null,ctx:ctx||null}))}));
const RULES=[
{id:'r1',name:'Delivery tier',desc:'Picks vehicle, SLA and surcharge from distance, weight and priority.',policy:'First match',conds:['Distance (km)','Weight (kg)','Priority'],acts:['Vehicle','SLA','Surcharge'],rows:[
{c:['≤ 5','≤ 10','Express'],a:['Bike','45 min','€4.00']},{c:['≤ 5','≤ 10','Standard'],a:['Bike','2 h','€0.00']},{c:['≤ 20','≤ 30','Any'],a:['Van','4 h','€2.50']},{c:['> 20','≤ 30','Any'],a:['Van','Next day','€6.00']},{c:['Any','> 30','Any'],a:['Truck','Next day','€12.00']}]},
{id:'r2',name:'Reattempt policy',desc:'What happens after a failed delivery attempt.',policy:'First match',conds:['Attempt','Customer reachable'],acts:['Action','Notify'],rows:[
{c:['≤ 1','No'],a:['Reschedule same day','SMS + push']},{c:['≤ 2','Any'],a:['Reschedule next day','SMS']},{c:['> 2','Any'],a:['Return to depot','Ops alert']}]},
{id:'r3',name:'Payment capture',desc:'How much to capture once the delivery outcome is known.',policy:'First match',conds:['Order status','Amount (€)'],acts:['Capture','Review'],rows:[
{c:['Delivered','Any'],a:['Full amount','No']},{c:['Partial','≤ 200'],a:['Pro rata','No']},{c:['Partial','> 200'],a:['Pro rata','Finance']},{c:['Failed','Any'],a:['Void','No']}]}];
const TEAMS=['Platform','Orders','Payments','Dispatch','Mobile','Operations'];
const DECKS=[
{id:'delivery',name:'Logistics Delivery',folder:'Logistics',nodes:20,flows:5,edited:'2 min ago',sample:true,seed:3},
{id:'wh',name:'Warehouse Operations',folder:'Logistics',nodes:26,flows:7,edited:'Yesterday',seed:7},
{id:'fleet',name:'Fleet Telemetry',folder:'Logistics',nodes:14,flows:3,edited:'3 days ago',seed:11},
{id:'checkout',name:'Checkout Platform',folder:'Payments',nodes:34,flows:8,edited:'Sep 18',seed:5},
{id:'ledger',name:'Payments Ledger',folder:'Payments',nodes:18,flows:4,edited:'Sep 12',seed:13},
{id:'iam',name:'Identity & Access',folder:'Platform',nodes:12,flows:3,edited:'Sep 3',seed:2},
{id:'tools',name:'Internal Tooling',folder:'Platform',nodes:9,flows:2,edited:'Aug 28',seed:17},
{id:'returns',name:'Returns Pipeline v1',folder:'Archive',nodes:16,flows:4,edited:'Jul 14',seed:19}];
function rp(pts,r){r=r||8;const p=[pts[0]];for(let i=1;i<pts.length;i++){const a=p[p.length-1],b=pts[i];if(Math.hypot(b[0]-a[0],b[1]-a[1])>.5)p.push(b);}
 let d='M'+p[0][0]+' '+p[0][1];for(let i=1;i<p.length-1;i++){const [px,py]=p[i-1],[x,y]=p[i],[nx,ny]=p[i+1];const l1=Math.hypot(x-px,y-py),l2=Math.hypot(nx-x,ny-y),rr=Math.min(r,l1/2,l2/2);d+=' L'+(x-(x-px)/l1*rr)+' '+(y-(y-py)/l1*rr)+' Q'+x+' '+y+' '+(x+(nx-x)/l2*rr)+' '+(y+(ny-y)/l2*rr);}
 const e=p[p.length-1];return {d:d+' L'+e[0]+' '+e[1],p};}
function route(a,b){const acx=a.x+W/2,acy=a.y+H/2,bcx=b.x+W/2,bcy=b.y+H/2;let pts;
 if(a.kind==='queue'||b.kind==='queue'){const q=a.kind==='queue'?a:b,n=q===a?b:a,ny=n.y+H/2,ex=n.x+W/2<LANE?n.x+W:n.x,lx=Math.min(Math.max(LANE,q.x+12),q.x+W-12);pts=[[ex,ny],[lx,ny],[lx,q.y]];if(q===a)pts.reverse();}
 else if(Math.abs(bcx-acx)<W){pts=bcy>acy?[[acx,a.y+H],[acx,(a.y+H+b.y)/2],[bcx,(a.y+H+b.y)/2],[bcx,b.y]]:[[acx,a.y],[acx,(a.y+b.y+H)/2],[bcx,(a.y+b.y+H)/2],[bcx,b.y+H]];}
 else if(bcx>acx){const gx=b.x-24;pts=[[a.x+W,acy],[gx,acy],[gx,bcy],[b.x,bcy]];}
 else{const gx=b.x+W+22;pts=[[a.x,acy],[gx,acy],[gx,bcy],[b.x+W,bcy]];}
 const r=rp(pts),p=r.p;let best=0,bi=0;for(let i=1;i<p.length;i++){const l=Math.hypot(p[i][0]-p[i-1][0],p[i][1]-p[i-1][1]);if(l>best){best=l;bi=i;}}
 const e=p[p.length-1];return {d:r.d,lx:(p[bi][0]+p[bi-1][0])/2,ly:(p[bi][1]+p[bi-1][1])/2,ex:e[0],ey:e[1]};}
function cellMatch(c,v){c=String(c==null?'':c).trim();if(!c||/^any$/i.test(c)||c==='—')return true;v=String(v==null?'':v).trim();
 const m=c.match(/^(≤|<=|<|≥|>=|>|=)?\s*(-?[\d.]+)\s*$/);if(m&&v!==''&&!isNaN(+v)){const n=+m[2],x=+v;switch(m[1]){case '≤':case '<=':return x<=n;case '<':return x<n;case '≥':case '>=':return x>=n;case '>':return x>n;default:return x===n;}}
 return c.split(/\s*(?:,|\bor\b)\s*/i).some(p=>p.toLowerCase()===v.toLowerCase());}
function matchRows(rule,vals){const out=[];rule.rows.forEach((r,i)=>{if(rule.conds.every((k,j)=>cellMatch(r.c[j],vals[k])))out.push(i);});return rule.policy==='Collect'?out:out.slice(0,1);}
function shape(n){const t=n.title.replace(/"/g,"'");return n.kind==='data'?'[("'+t+'")]':n.kind==='queue'?'[["'+t+'"]]':n.kind==='client'?'(["'+t+'"])':n.kind==='external'?'{{"'+t+'"}}':'["'+t+'"]';}
function mermaid(nodes,edges,groups){let o='flowchart LR\n';const ids=new Set(nodes.map(n=>n.id));
 if(groups)GROUPS.forEach(g=>{const ns=nodes.filter(n=>n.group===g.id);if(!ns.length)return;o+='  subgraph '+g.id+'["'+g.label+'"]\n';ns.forEach(n=>o+='    '+n.id+shape(n)+'\n');o+='  end\n';});
 nodes.filter(n=>!groups||!n.group).forEach(n=>o+='  '+n.id+shape(n)+'\n');
 edges.filter(e=>ids.has(e.from)&&ids.has(e.to)).forEach(e=>o+='  '+e.from+' -->|'+e.label+'| '+e.to+'\n');return o;}
function svgString(nodes,edges,theme,transparent){const t=THEMES[theme]||THEMES.light,c=k=>t[k];const by={};nodes.forEach(n=>by[n.id]=n);
 let s='<svg xmlns="http://www.w3.org/2000/svg" width="'+WW+'" height="'+WH+'" viewBox="0 0 '+WW+' '+WH+'" font-family="Geist, system-ui, sans-serif">';
 if(!transparent)s+='<rect width="100%" height="100%" fill="'+c('--cv')+'"/>';
 GROUPS.forEach(g=>{if(!nodes.some(n=>n.group===g.id))return;s+='<rect x="'+g.x+'" y="'+g.y+'" width="'+g.w+'" height="'+g.h+'" rx="16" fill="none" stroke="'+c('--bd2')+'" stroke-dasharray="4 4"/><text x="'+(g.x+14)+'" y="'+(g.y+22)+'" font-size="11" letter-spacing="1" fill="'+c('--mu')+'">'+g.label.toUpperCase()+'</text>';});
 edges.forEach(e=>{const a=by[e.from],b=by[e.to];if(!a||!b)return;s+='<path d="'+route(a,b).d+'" fill="none" stroke="'+c('--edge')+'" stroke-width="1.5"/>';});
 nodes.forEach(n=>{s+='<rect x="'+n.x+'" y="'+n.y+'" width="'+W+'" height="'+H+'" rx="12" fill="'+c('--s')+'" stroke="'+c('--bd2')+'"/><text x="'+(n.x+14)+'" y="'+(n.y+22)+'" font-size="13" font-weight="500" fill="'+c('--tx')+'">'+n.title.replace(/&/g,'&amp;')+'</text><text x="'+(n.x+14)+'" y="'+(n.y+38)+'" font-size="11" fill="'+c('--mu')+'">'+(n.tech||'').replace(/&/g,'&amp;')+'</text>';});
 return s+'</svg>';}
window.SODO={W,H,LANE,WW,WH,THEMES,KT,KIND,KICON,tile,GROUPS,NODES,EDGES,FLOWS,RULES,TEAMS,DECKS,route,cellMatch,matchRows,mermaid,svgString};
})();
