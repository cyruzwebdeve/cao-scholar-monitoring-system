const assert = require('node:assert/strict');
const { test, before, after, beforeEach } = require('node:test');
const express = require('express');
const jwt = require('jsonwebtoken');
const { randomBytes } = require('node:crypto');
const prisma = {};
const prismaPath = require.resolve('../config/prisma');
require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: prisma };
const blobPath = require.resolve('../services/blobStorage');
const blob = require(blobPath);
const uploads = [], deletions = [];
require.cache[blobPath].exports = { ...blob, uploadDataUrl: async () => { const url = 'https://synthetic.public.blob.vercel-storage.com/'+(uploads.length+1)+'.png';uploads.push(url);return {url}; }, deleteBlob: async (url) => { deletions.push(url); } };
process.env.JWT_SECRET = randomBytes(32).toString('hex');
const { createAnnouncement, updateAnnouncement, getAnnouncementManagement, getLatestPublishedAnnouncement } = require('../controllers/applicationController');
const routes = require('../routes/applicationRoutes');
const response = () => ({ locals: {}, statusCode:200,status(value){this.statusCode=value;return this;},json(value){this.body=value;return this;} });
let server,baseUrl;
before(async()=>{const app=express();app.use(express.json());app.use(routes);server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));baseUrl='http://127.0.0.1:'+server.address().port;});
after(async()=>{await new Promise(r=>server.close(r));});
beforeEach(()=>{ uploads.length=0;deletions.length=0;prisma.admins={findUnique:async({where})=>({id:where.id,is_active:true,auth_version:0,is_super_admin:where.id===1,role:'admin',section_access:where.id===3?['announcements']:['settings']})};prisma.applicants={findUnique:async()=>({id:7,email:'synthetic@example.test'})};prisma.scholar_accounts={findFirst:async()=>null};prisma.control_accounts={findFirst:async()=>({applicant_id:7,is_active:true,auth_version:0})};prisma.activity_logs={create:async()=>({id:1})}; });
const noticePayload = (extra={}) => ({title:'Synthetic notice',content:'Synthetic announcement content',audience:'all',priority:'normal',status:'draft',...extra});
const noticeRow = (extra={}) => ({id:1,title:'Synthetic notice',content:'Synthetic announcement content',audience:'all',priority:'normal',status:'published',publish_at:null,expires_at:null,published_at:new Date(),created_at:new Date(),updated_at:new Date(),image_data:null,...extra});
const matchesNotice=(row,where={})=>Object.entries(where).every(([key,v])=>{
  if(key==='OR')return v.some(w=>matchesNotice(row,w));
  if(key==='AND')return v.every(w=>matchesNotice(row,w));
  if(v instanceof Date)return +new Date(row[key])===+v;
  if(v && typeof v==='object' && !(v instanceof Date)){
    if(v.in)return v.in.includes(row[key]);
    if(v.lte!==undefined)return row[key]!=null && +new Date(row[key])<=+v.lte;
    if(v.gt!==undefined)return row[key]!=null && +new Date(row[key])>+v.gt;
  }
  return row[key]===v;
});
const notices=(initial=[])=>{
 prisma.announcement_email_deliveries = { groupBy: async () => [] };
 const state={rows:initial,writes:[]};
 prisma.$transaction=async (callback,options)=>{assert.equal(options.isolationLevel,'Serializable');const before=structuredClone(state.rows);const length=state.writes.length;try{return await callback(prisma);}catch(error){state.rows=before;state.writes.length=length;throw error;}};
 prisma.announcements={
  findFirst:async(query)=>{ const rows=await prisma.announcements.findMany({...query,take:1});return rows[0]||null; },
  findUnique:async({where})=>structuredClone(state.rows.find(r=>r.id===where.id)||null),
  findMany:async({where={},orderBy=[],take}={})=>{let rows=state.rows.filter(r=>matchesNotice(r,where));const order=Array.isArray(orderBy)?orderBy:[orderBy];rows.sort((a,b)=>{for(const spec of order){const key=Object.keys(spec)[0];const d=+new Date(b[key]||0)-+new Date(a[key]||0);if(d)return d;}return 0;});return rows.slice(0,take||rows.length);},
  create:async({data})=>{const row=noticeRow({id:state.rows.length+1,...data});state.rows.push(row);state.writes.push('create');return row;},
  update:async({where,data})=>{const row=state.rows.find(r=>r.id===where.id);Object.assign(row,data,{updated_at:new Date()});state.writes.push('update');return row;},
  updateMany:async({where,data})=>{let count=0;for(const row of state.rows){if(matchesNotice(row,where)){Object.assign(row,data,{updated_at:data.updated_at||new Date()});count++;}}return {count};}
 };return state;
};
const latestNotice=async(role)=>{const res=response();await getLatestPublishedAnnouncement({user:{role}},res);return res;};
const editNotice=async(body)=>{const res=response();await updateAnnouncement({params:{id:'1'},body,user:{id:1}},res);return res;};

test('ANN-QA PASS: drafts are private, due schedules publish, audience and expiry filtering works',async()=>{
 const past=new Date(Date.now()-10000),future=new Date(Date.now()+60000);
 const state=notices([noticeRow({id:1,status:'draft'}),noticeRow({id:2,status:'scheduled',publish_at:future}),noticeRow({id:3,status:'scheduled',publish_at:past,audience:'scholars'}),noticeRow({id:4,expires_at:past}),noticeRow({id:5,audience:'applicants',publish_at:future})]);
 assert.equal((await latestNotice('Applicant')).body.announcement,null);
 assert.equal((await latestNotice('Scholar')).body.announcement.id,3);
 assert.equal(state.rows[2].status,'published');assert.equal(state.rows[1].status,'scheduled');
});

test('ANN-QA PASS: valid draft/create/edit and invalid fields or deceptive links are handled',async()=>{
 const state=notices();let res=response();await createAnnouncement({body:noticePayload(),user:{id:1}},res);assert.equal(res.statusCode,201);
 assert.equal((await editNotice(noticePayload({title:'Edited notice',updatedAt:state.rows[0].updated_at.toISOString()}))).statusCode,200);assert.equal(state.rows[0].title,'Edited notice');
 for(const extra of [{title:''},{content:''},{audience:'unknown'},{status:'scheduled'},{externalUrl:'https://facebook.com.example.test/post'}]){
   res=response();await createAnnouncement({body:noticePayload(extra),user:{id:1}},res);assert.equal(res.statusCode,400);
 }
});

test('ANN-QA PASS: real management/write routes enforce account role and announcement section access',async()=>{
 notices();
 for(const [id,type,expected] of [[null,null,401],[7,'applicant',403],[2,'admin',403],[3,'admin',200],[1,'admin',200]]){
  if(id===3)prisma.admins.findUnique=async({where})=>({id:where.id,is_active:true,auth_version:0,is_super_admin:where.id===1,role:'admin',section_access:where.id===3?['announcements']:['settings']});
  const token=id?jwt.sign({userId:id,accountType:type,authVersion:0},process.env.JWT_SECRET):null;
  const res=await fetch(baseUrl+'/announcements/management',{headers:token?{Authorization:'Bearer '+token}:{}});assert.equal(res.status,expected);
 }
 for(const [id,type,expected] of [[null,null,401],[7,'applicant',403],[2,'admin',403],[3,'admin',201],[1,'admin',201]]){
  const token=id?jwt.sign({userId:id,accountType:type,authVersion:0},process.env.JWT_SECRET):null;
  const res=await fetch(baseUrl+'/announcements',{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(noticePayload())});assert.equal(res.status,expected);
 }
});

test('urgent priority is selected before limiting candidates even behind 50 newer normal records',async()=>{
 const now=Date.now();const rows=Array.from({length:50},(_,i)=>noticeRow({id:i+1,published_at:new Date(now-i*1000)}));rows.push(noticeRow({id:51,priority:'urgent',published_at:new Date(now-1000000)}));notices(rows);
 assert.equal((await latestNotice('Applicant')).body.announcement.id,51);
});
test('expired immediate records can be edited and archived while retaining their historic expiry',async()=>{
 const expiry=new Date(Date.now()-60000);const state=notices([noticeRow({published_at:new Date(Date.now()-86400000),expires_at:expiry})]);
 let res=await editNotice(noticePayload({status:'published',expiresAt:expiry.toISOString(),updatedAt:state.rows[0].updated_at.toISOString()}));assert.equal(res.statusCode,200);
 res=await editNotice(noticePayload({status:'archived',expiresAt:expiry.toISOString(),updatedAt:state.rows[0].updated_at.toISOString()}));assert.equal(res.statusCode,200);assert.equal(+state.rows[0].expires_at,+expiry);assert.equal((await latestNotice('Applicant')).body.announcement,null);
});
test('Post Now immediately publishes new and scheduled records without a future publishing date',async()=>{
 const state=notices();const future=new Date(Date.now()+86400000).toISOString();const body=noticePayload({status:'scheduled',publishAt:future,action:'post-now',audience:'scholars',priority:'urgent'});
 let res=response();await createAnnouncement({body,user:{id:1}},res);assert.equal(res.statusCode,201);assert.equal(res.body.announcement.status,'published');assert.equal(res.body.announcement.publishAt,null);assert.ok(res.body.announcement.publishedAt);assert.equal(res.body.announcement.audience,'scholars');assert.equal(res.body.announcement.priority,'urgent');
 state.rows[0].status='scheduled';state.rows[0].publish_at=new Date(future);state.rows[0].published_at=null;
 res=await editNotice({...body,updatedAt:state.rows[0].updated_at.toISOString()});assert.equal(res.statusCode,200);assert.equal(state.rows[0].publish_at,null);assert.equal(state.rows[0].status,'published');
});
test('stale edits and a competing edit during upload cannot overwrite the saved revision',async()=>{
 const state=notices([noticeRow({status:'draft'})]);const revision=state.rows[0].updated_at.toISOString();
 assert.equal((await editNotice(noticePayload({title:'New staff correction',updatedAt:revision}))).statusCode,200);
 assert.equal((await editNotice(noticePayload({title:'Stale edit',updatedAt:revision}))).statusCode,409);assert.equal(state.rows[0].title,'New staff correction');
 const transaction=prisma.$transaction;const current=state.rows[0].updated_at.toISOString();
 prisma.$transaction=async(cb,options)=>{state.rows[0].updated_at=new Date(+state.rows[0].updated_at+1);return transaction(cb,options);};
 assert.equal((await editNotice(noticePayload({title:'Competing edit',updatedAt:current}))).statusCode,409);assert.equal(state.rows[0].title,'New staff correction');
});
test('missing edit revisions and expired Post Now attempts are rejected without writes',async()=>{
 const state=notices([noticeRow({status:'draft'})]);
 assert.equal((await editNotice(noticePayload())).statusCode,400);
 const res=response();await createAnnouncement({body:noticePayload({action:'post-now',expiresAt:new Date(Date.now()-60000).toISOString()}),user:{id:1}},res);
 assert.equal(res.statusCode,400);assert.equal(state.writes.length,0);
});
test('server rejects decoded images over 3 MiB and mismatched declared types before storage',async()=>{
 const state=notices();
 for(const extra of [{imageData:'data:image/png;base64,'+Buffer.alloc(3*1024*1024+1).toString('base64'),imageType:'image/png'},{imageData:'data:image/png;base64,AAAA',imageType:'text/html'}]){
  const res=response();await createAnnouncement({body:noticePayload(extra),user:{id:1}},res);assert.equal(res.statusCode,400);
 }
 assert.equal(state.writes.length,0);assert.equal(uploads.length,0);
 const res=response();await createAnnouncement({body:noticePayload({imageData:'data:image/png;base64,'+Buffer.alloc(3*1024*1024).toString('base64'),imageType:'image/png'}),user:{id:1}},res);assert.equal(res.statusCode,201);
});
test('new upload is compensated after a rejected revision, and serialization failures return conflict',async(t)=>{
 const state=notices([noticeRow({status:'draft'})]);const transaction=prisma.$transaction;
 const previousToken=process.env.ANNOUNCEMENT_BLOB_READ_WRITE_TOKEN;process.env.ANNOUNCEMENT_BLOB_READ_WRITE_TOKEN='synthetic-test-token';t.after(()=>{if(previousToken===undefined)delete process.env.ANNOUNCEMENT_BLOB_READ_WRITE_TOKEN;else process.env.ANNOUNCEMENT_BLOB_READ_WRITE_TOKEN=previousToken;});
 prisma.$transaction=async()=>{throw Object.assign(new Error('Synthetic conflict'),{code:'P2034'});};
 const res=await editNotice(noticePayload({updatedAt:state.rows[0].updated_at.toISOString(),imageData:'data:image/png;base64,AAAA',imageType:'image/png'}));assert.equal(res.statusCode,409);assert.equal(state.writes.length,0);assert.equal(uploads.length,1);assert.deepEqual(deletions,uploads);prisma.$transaction=transaction;
});
