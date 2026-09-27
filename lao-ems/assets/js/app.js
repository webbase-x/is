import { supabase, clearLaoAuthSession } from "./supabase.js?v=20260927-2";

const state={session:null,user:null,profile:null,memberships:[],currentMembership:null,organizations:[],schools:[],adminSchools:[],adminSchool:null,orgSchools:[],notifications:[],pendingInvitation:null,lecPreview:null,isPlatformAdmin:false,viewMode:"user"};

const routeMeta={
  overview:["ภาพรวมระบบ","ภาพรวมการเชื่อมข้อมูลและลำดับการพัฒนา"],
  membership:["สิทธิ์การเข้าใช้งาน","ดูสถานศึกษาและบทบาทที่ผู้ดูแลกำหนดให้"],
  activate:["ตั้งค่าบัญชี","ยืนยันโปรไฟล์และกำหนดรหัสผ่านสำหรับบัญชีที่ผู้ดูแลเชิญ"],
  profile:["โปรไฟล์ของฉัน","แก้ไขข้อมูลส่วนตัวและเปลี่ยนรหัสผ่าน"],
  notifications:["การแจ้งเตือน","คำขอ การอนุมัติ และการเปลี่ยนแปลงที่เกี่ยวข้องกับบัญชีของคุณ"],
  setup:["ตั้งค่าพื้นฐาน","ปีการศึกษา ภาคเรียน และสถานะการเชื่อมระบบ"],
  organization:["อปท. และสถานศึกษา","โครงสร้างองค์กรและโรงเรียนในแพลตฟอร์ม"],
  users:["ผู้ใช้และสิทธิ์","คำขอเข้าใช้งาน บทบาท และขอบเขตสิทธิ์"],
  lec:["นำเข้าข้อมูล LEC","นำเข้า XLS/XLSX โดยระบบเลือกชีตที่มีข้อมูลสถานศึกษาครบและรักษาประวัติทุกปีการศึกษา"],
  personnel:["บุคลากร","ข้อมูลบุคลากรต้นทางสำหรับทุกระบบ"],
  students:["นักเรียน","Student master record และความสัมพันธ์ผู้ปกครอง"],
  academics:["วิชาการ","หลักสูตร ชั้นเรียน รายวิชา และครูผู้สอน"],
  assessment:["ทะเบียนและวัดผล","คะแนน ผลการเรียน GPA/GPAX และเอกสารการศึกษา"],
  documents:["เอกสารและไฟล์","Google Drive แยกตามสถานศึกษา พร้อม metadata กลาง"],
  website:["เว็บไซต์สถานศึกษา","เว็บไซต์แต่ละโรงเรียนจากข้อมูลชุดเดียวกัน"],
  forms:["แบบฟอร์มและงาน","แบบประเมิน แบบสอบถาม แบบทดสอบ และ Workflow"],
  reports:["รายงานและ Dashboard","รายงานระดับโรงเรียนและระดับ อปท."]
};
const roleLabels={
  platform_admin:"ผู้ดูแลแพลตฟอร์ม",organization_admin:"ผู้ดูแล อปท.",organization_viewer:"ผู้ดูข้อมูลระดับ อปท.",
  school_admin:"ผู้ดูแลสถานศึกษา",school_executive:"ผู้บริหารสถานศึกษา",registrar:"งานทะเบียน",
  academic_officer:"งานวิชาการ",teacher:"ครู",staff:"บุคลากร",student:"นักเรียน",guardian:"ผู้ปกครอง"
};
const modules=[
  ["🏛","Core Organization","อปท. โรงเรียน ปีการศึกษา ภาคเรียน","Phase 1"],
  ["🛡️","Auth & Permission","ลงทะเบียน อนุมัติ บทบาท และขอบเขตสิทธิ์","Phase 1"],
  ["🪪","Personnel","บุคลากร ตำแหน่ง วิทยฐานะ ภาระงาน","Phase 2"],
  ["🎓","Student Registry","นักเรียน ผู้ปกครอง ห้องเรียน ประวัติการศึกษา","Phase 2"],
  ["📚","Academic","หลักสูตร รายวิชา ตารางเรียน ครูผู้สอน","Phase 3"],
  ["📝","Assessment","คะแนน ผลการเรียน GPA/GPAX และการตัดสินผล","Phase 4"],
  ["📄","ปพ. & Records","เอกสารทางการศึกษาและรายงานผล","Phase 4"],
  ["🌐","School Website","ข่าว กิจกรรม บุคลากร สถิติ และข้อมูลสาธารณะ","Phase 5"],
  ["☑","Forms & Tasks","แบบสอบถาม แบบประเมิน แบบทดสอบ และ Workflow","Phase 5"],
  ["🤝","Student Care","ระบบดูแลช่วยเหลือ เยี่ยมบ้าน และการส่งต่อ","Phase 6"],
  ["✅","QA / SAR","ประกันคุณภาพและหลักฐานจากข้อมูลจริง","Phase 6"],
  ["📊","Executive Dashboard","วิเคราะห์ระดับโรงเรียนและ อปท.","Phase 7"],
  ["🔎","Smart Search / AI","ค้นและสรุปข้อมูลตามสิทธิ์ของผู้ใช้","Phase 8"]
];

const q=(s,r=document)=>r.querySelector(s);
const qa=(s,r=document)=>Array.from(r.querySelectorAll(s));
const esc=v=>String(v==null?"":v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));

function toast(message,type){
  const box=document.createElement("div");
  box.className="toast "+(type||"");
  box.textContent=message;
  q("#toast-region").appendChild(box);
  setTimeout(()=>box.remove(),4200);
}
function setBusy(button,busy,label){
  if(!button)return;
  if(busy){button.dataset.oldLabel=button.textContent;button.disabled=true;button.innerHTML='<span class="spinner"></span>'+(label||"กำลังดำเนินการ...");}
  else{button.disabled=false;button.textContent=button.dataset.oldLabel||button.textContent;}
}
function routeName(){return (location.hash.replace(/^#\//,"").split("/")[0]||"overview").toLowerCase();}
function roleCodes(m){
  const x=m||state.currentMembership;
  return (x&&x.lao_membership_roles||[]).map(v=>v.lao_roles&&v.lao_roles.code).filter(Boolean);
}
function roleNames(m){
  const list=roleCodes(m).map(c=>roleLabels[c]||c);
  if(state.isPlatformAdmin&&!list.includes(roleLabels.platform_admin))list.unshift(roleLabels.platform_admin);
  return list.length?list.join(" · "):"ยังไม่มีบทบาท";
}
function hasRole(){
  const wanted=Array.from(arguments),codes=roleCodes();
  if(state.isPlatformAdmin&&wanted.includes("platform_admin"))return true;
  return codes.some(c=>wanted.includes(c));
}
function displayName(){
  const p=state.profile||{};
  return p.display_name||[p.prefix,p.first_name_th,p.last_name_th].filter(Boolean).join(" ")||(state.user&&state.user.email)||"ผู้ใช้งาน";
}
function initials(name){
  const parts=String(name||"ผู้").trim().split(/\s+/).filter(Boolean);
  return ((parts[0]&&parts[0][0])||"ผู้")+((parts[1]&&parts[1][0])||"");
}
function currentSchool(){
  if(state.isPlatformAdmin&&state.viewMode==="admin")return state.adminSchool||null;
  return state.currentMembership&&state.currentMembership.lao_schools||null;
}
function currentOrg(){
  if(state.isPlatformAdmin&&state.viewMode==="admin")return state.adminSchool&&state.adminSchool.lao_organizations||null;
  return state.currentMembership&&state.currentMembership.lao_organizations||null;
}

function bindStaticUI(){
  q("#signin-form").addEventListener("submit",signIn);
  bindPasswordToggles();
  /* password toggles are bound once by bindPasswordToggles */
  qa("[data-password-toggle]").filter(button=>button.dataset.bound!=="1").forEach(button=>button.addEventListener("click",()=>{
    const field=button.closest(".input-with-action, .password-field");
    const input=field&&field.querySelector("[data-password-input]");
    if(!input)return;
    const show=input.type==="password";
    input.type=show?"text":"password";
    button.classList.toggle("is-visible",show);
    button.setAttribute("aria-pressed",String(show));
    button.setAttribute("aria-label",show?"ซ่อนรหัสผ่าน":"แสดงรหัสผ่าน");
  }));
  qa("[data-view-mode]").forEach(button=>button.addEventListener("click",()=>{
    if(!state.isPlatformAdmin)return;
    state.viewMode=button.dataset.viewMode==="admin"?"admin":"user";
    localStorage.setItem("lao_view_mode",state.viewMode);
    refreshHeader();
    renderTenants();
    if(state.viewMode==="user"&&!["overview","membership","notifications"].includes(routeName())){
      location.hash="#/overview";
    }else{
      renderRoute();
    }
  }));
  const sidebar=q("#sidebar"),scrim=q("[data-scrim]");
  q("[data-sidebar-open]").addEventListener("click",()=>{sidebar.classList.add("open");scrim.classList.add("show");});
  const close=()=>{sidebar.classList.remove("open");scrim.classList.remove("show");};
  q("[data-sidebar-close]").addEventListener("click",close);
  scrim.addEventListener("click",close);
  window.addEventListener("hashchange",()=>{renderRoute();close();});
  q("[data-signout]").addEventListener("click",()=>{
    localStorage.setItem("lao_legacy_session_rejected","1");
    clearLaoAuthSession();
    location.reload();
  });
  const profileButton=q(".profile-btn");
  if(profileButton)profileButton.addEventListener("click",()=>{location.hash="#/profile";});
  q("#tenant-select").addEventListener("change",e=>{
    const value=e.target.value;
    if(state.isPlatformAdmin&&state.viewMode==="admin"){
      const id=value.startsWith("admin:")?value.slice(6):"";
      state.adminSchool=state.adminSchools.find(s=>s.id===id)||null;
      if(state.adminSchool)localStorage.setItem("lao_admin_school",state.adminSchool.id);
      else localStorage.removeItem("lao_admin_school");
      refreshHeader();renderRoute();return;
    }
    const m=state.memberships.find(x=>x.id===value&&x.status==="active");
    if(m){state.currentMembership=m;localStorage.setItem("lao_current_membership",m.id);refreshHeader();renderRoute();}
  });
}

async function signIn(event){
  event.preventDefault();
  const form=event.currentTarget,btn=form.querySelector("button[type=submit]"),fd=new FormData(form);
  const email=String(fd.get("email")).trim();
  const remember=fd.get("remember_login")==="on";
  if(remember){
    localStorage.setItem("lao_remember_login","1");
    localStorage.setItem("lao_saved_email",email);
  }else{
    localStorage.removeItem("lao_remember_login");
    localStorage.removeItem("lao_saved_email");
  }
  setBusy(btn,true,"กำลังเข้าสู่ระบบ...");
  const res=await supabase.auth.signInWithPassword({email:email,password:String(fd.get("password"))});
  setBusy(btn,false);
  if(res.error){toast(authMessage(res.error.message),"error");return;}
  toast("เข้าสู่ระบบสำเร็จ","success");
}
function authMessage(m){
  if(/invalid login credentials/i.test(m))return "อีเมลหรือรหัสผ่านไม่ถูกต้อง";
  if(/already registered/i.test(m))return "อีเมลนี้มีบัญชีอยู่แล้ว";
  return m||"ไม่สามารถดำเนินการได้";
}

async function ensureProfile(){
  const m=(state.user&&state.user.user_metadata)||{};
  const res=await supabase.rpc("lao_ensure_profile",{
    p_prefix:m.prefix||null,p_first_name_th:m.first_name_th||null,p_last_name_th:m.last_name_th||null,
    p_display_name:m.display_name||null,p_phone:m.phone||null
  });
  if(res.error)throw res.error;
}
async function loadOrganizations(){
  const res=await supabase.from("lao_organizations").select("id,name_th,name_en").eq("is_active",true).order("name_th");
  if(res.error)throw res.error;
  state.organizations=res.data||[];
}
async function loadSchools(orgId){
  if(!orgId){state.schools=[];return [];}
  const res=await supabase.from("lao_schools").select("id,organization_id,name_th,name_en,slug").eq("organization_id",orgId).eq("is_active",true).order("name_th");
  if(res.error)throw res.error;
  state.schools=res.data||[];
  return state.schools;
}
async function loadAdminSchools(){
  if(!state.isPlatformAdmin){state.adminSchools=[];state.adminSchool=null;return;}
  const res=await supabase.from("lao_schools")
    .select("id,organization_id,code,name_th,name_en,short_name,slug,phone,email,website_url,address_text,is_active,source_system,lec_synced_at,lec_source_file_name,lao_organizations(id,name_th,name_en)")
    .order("name_th");
  if(res.error)throw res.error;
  state.adminSchools=res.data||[];
  const saved=localStorage.getItem("lao_admin_school");
  state.adminSchool=state.adminSchools.find(s=>s.id===saved)||null;
}
async function loadNotifications(){
  if(!state.user){state.notifications=[];return;}
  const res=await supabase.from("lao_notifications")
    .select("id,organization_id,school_id,notification_type,title,body,entity_type,entity_id,created_at,read_at")
    .eq("user_id",state.user.id).order("created_at",{ascending:false}).limit(100);
  if(res.error)throw res.error;
  state.notifications=res.data||[];
}
async function loadContext(){
  const adminRes=await supabase.rpc("lao_is_platform_admin");
  if(adminRes.error)throw adminRes.error;
  state.isPlatformAdmin=adminRes.data===true;
  const accessRes=await supabase.rpc("lao_has_lao_access");
  if(accessRes.error)throw accessRes.error;
  if(accessRes.data!==true)throw new Error("LAO_ACCESS_REQUIRED");
  localStorage.removeItem("lao_legacy_session_rejected");
  await ensureProfile();
  const profileRes=await supabase.from("lao_profiles").select("*").eq("user_id",state.user.id).maybeSingle();
  if(profileRes.error)throw profileRes.error;
  state.profile=profileRes.data;
  const invitationRes=await supabase.rpc("lao_my_pending_invitation");
  if(invitationRes.error)throw invitationRes.error;
  state.pendingInvitation=invitationRes.data||null;
  const memRes=await supabase.from("lao_memberships").select("id,user_id,organization_id,school_id,requested_role_code,request_note,status,requested_at,reviewed_at,lao_organizations(id,name_th,name_en),lao_schools(id,name_th,name_en,slug),lao_membership_roles(lao_roles(code,name_th))").eq("user_id",state.user.id).order("requested_at",{ascending:false});
  if(memRes.error)throw memRes.error;
  state.memberships=memRes.data||[];
  const active=state.memberships.filter(m=>m.status==="active"),saved=localStorage.getItem("lao_current_membership");
  state.currentMembership=active.find(m=>m.id===saved)||active[0]||null;
  await loadOrganizations();
  await loadAdminSchools();
  await loadNotifications();
  if(state.isPlatformAdmin){
    const savedView=localStorage.getItem("lao_view_mode");
    state.viewMode=savedView==="user"?"user":"admin";
    ensureAdminNavigation();
  }else{
    state.viewMode="user";
  }
  refreshHeader();
  renderTenants();
}
function refreshHeader(){
  const name=displayName();
  q("[data-profile-name]").textContent=name;
  q("[data-avatar]").textContent=initials(name).slice(0,2);
  q("[data-profile-role]").textContent=state.isPlatformAdmin?(state.viewMode==="admin"?"ผู้ดูแลแพลตฟอร์ม · Admin":"ผู้ดูแลแพลตฟอร์ม · มุมมองผู้ใช้"):state.currentMembership?roleNames():state.memberships.some(m=>m.status==="pending")?"รออนุมัติสิทธิ์":"ยังไม่ได้ขอสิทธิ์";

  const switcher=q("[data-view-switch]");
  if(switcher)switcher.classList.toggle("hidden",!state.isPlatformAdmin);
  qa("[data-view-mode]").forEach(button=>button.classList.toggle("active",button.dataset.viewMode===state.viewMode));

  const adminMode=state.isPlatformAdmin&&state.viewMode==="admin";
  qa("[data-admin-menu]").forEach(item=>{
    item.classList.toggle("hidden",!(adminMode||(!state.isPlatformAdmin&&hasRole("organization_admin","school_admin"))));
  });
  qa("[data-lec-menu]").forEach(item=>{
    item.classList.toggle("hidden",!(adminMode||(!state.isPlatformAdmin&&hasRole("school_admin"))));
  });

  const notif=q("[data-notification-count]");
  if(notif){
    const unread=state.notifications.filter(n=>!n.read_at).length;
    notif.textContent=String(unread);
    notif.classList.toggle("hidden",unread===0);
  }

  const nav=q(".nav-list");
  if(nav&&state.isPlatformAdmin){
    nav.querySelectorAll("[data-full-admin]").forEach(item=>item.classList.toggle("hidden",!adminMode));
  }
}
function ensureAdminNavigation(){
  const nav=q(".nav-list");
  if(!nav||nav.querySelector("[data-full-admin]"))return;
  const items=[
    ["personnel","🪪","บุคลากร"],["students","🎓","นักเรียน"],["academics","📚","วิชาการ"],
    ["assessment","📝","ทะเบียนและวัดผล"],["documents","📄","เอกสารและไฟล์"],
    ["website","🌐","เว็บไซต์สถานศึกษา"],["forms","☑","แบบฟอร์มและงาน"],["reports","📊","รายงานและ Dashboard"]
  ];
  items.forEach(item=>{
    const link=document.createElement("a");
    link.href="#/"+item[0];link.dataset.route=item[0];link.dataset.fullAdmin="";
    link.innerHTML="<span>"+item[1]+"</span>"+item[2];
    nav.appendChild(link);
  });
}

function renderTenants(){
  const select=q("#tenant-select");
  if(state.isPlatformAdmin&&state.viewMode==="admin"){
    if(!state.adminSchools.length){
      select.innerHTML='<option value="">ยังไม่มีสถานศึกษาในระบบ</option>';return;
    }
    select.innerHTML='<option value="">ทุกสถานศึกษา · เลือกโรงเรียนเมื่อต้องการจัดการ</option>'+
      state.adminSchools.map(s=>'<option value="admin:'+esc(s.id)+'">'+esc((s.lao_organizations&&s.lao_organizations.name_th? s.lao_organizations.name_th+" · ":"")+s.name_th)+'</option>').join("");
    select.value=state.adminSchool?"admin:"+state.adminSchool.id:"";
    return;
  }
  const active=state.memberships.filter(m=>m.status==="active");
  if(!active.length){select.innerHTML='<option value="">ยังไม่มีสิทธิ์สถานศึกษา</option>';return;}
  select.innerHTML=active.map(m=>{
    const name=m.lao_schools&&m.lao_schools.name_th||m.lao_organizations&&m.lao_organizations.name_th||"สิทธิ์ระดับองค์กร";
    return '<option value="'+esc(m.id)+'">'+esc(name)+'</option>';
  }).join("");
  if(state.currentMembership)select.value=state.currentMembership.id;
}

function adminOverviewHtml(){
  const tenant=(currentSchool()&&currentSchool().name_th)||(currentOrg()&&currentOrg().name_th)||"ยังไม่เลือกสถานศึกษา";
  const active=state.memberships.filter(m=>m.status==="active").length;
  const pending=state.memberships.filter(m=>m.status==="pending").length;
  const moduleHtml=modules.map(m=>'<article class="module-card"><div class="module-top"><span class="module-icon">'+m[0]+'</span><span class="module-stage">'+m[3]+'</span></div><h3>'+esc(m[1])+'</h3><p>'+esc(m[2])+'</p></article>').join("");
  return '<section class="system-banner"><div><span class="badge">Admin Console</span><h2>ศูนย์ควบคุม LAO-EMS</h2><p>มุมมองนี้แสดงสถานะระบบ โครงสร้างข้อมูล และเครื่องมือสำหรับผู้ดูแลแพลตฟอร์มหลัก</p></div><div class="banner-status"><span class="status-pill success">ฐานข้อมูล: เชื่อมแล้ว</span><span class="status-pill success">สิทธิ์ข้อมูล: เปิดใช้งาน</span><span class="status-pill warning">Google Drive: รอเชื่อม</span></div></section>'+
  '<section class="stats-grid">'+
  '<article class="stat-card"><span class="stat-icon">🏫</span><div><small>บริบทปัจจุบัน</small><strong>'+esc(tenant)+'</strong><p>เลือกสถานศึกษาเพื่อบริหารข้อมูลเฉพาะแห่ง</p></div></article>'+
  '<article class="stat-card"><span class="stat-icon">👥</span><div><small>Membership ที่ใช้งาน</small><strong>'+active+'</strong><p>สิทธิ์ที่อนุมัติแล้ว</p></div></article>'+
  '<article class="stat-card"><span class="stat-icon">⏳</span><div><small>คำขอรออนุมัติ</small><strong>'+pending+'</strong><p>ตรวจสอบจากเมนูผู้ใช้และสิทธิ์</p></div></article>'+
  '<article class="stat-card"><span class="stat-icon">🗂️</span><div><small>ไฟล์</small><strong>Google Drive</strong><p>แยก Drive ตามแต่ละสถานศึกษา</p></div></article></section>'+
  '<section class="content-grid"><article class="panel"><div class="panel-head"><div><p class="eyebrow">System setup</p><h2>งานของผู้ดูแลหลัก</h2></div></div><ol class="setup-list">'+
  '<li><span>1</span><div><strong>อปท. และสถานศึกษา</strong><small>สร้างพื้นที่โรงเรียนและใช้ LEC เป็นข้อมูลทางราชการต้นทาง</small></div><em>จัดการได้</em></li>'+
  '<li><span>2</span><div><strong>ผู้ใช้และสิทธิ์</strong><small>ตรวจคำขอ อนุมัติ และกำหนดบทบาท</small></div><em>จัดการได้</em></li>'+
  '<li><span>3</span><div><strong>นำเข้าข้อมูล LEC</strong><small>School Admin นำเข้า XLS/XLSX และระบบสร้างประวัติปี/ภาคเรียนอัตโนมัติ</small></div><em>Source of Truth</em></li>'+
  '<li><span>4</span><div><strong>Google Drive</strong><small>เชื่อมบัญชีแยกตามโรงเรียน</small></div><em>ขั้นถัดไป</em></li></ol></article>'+
  '<article class="panel"><div class="panel-head"><div><p class="eyebrow">System status</p><h2>สถานะทางเทคนิค</h2></div></div><ul class="status-list">'+
  '<li><span>✓</span><div><strong>Supabase ISSQL</strong><small>ใช้ namespace lao_ แยกจากระบบเดิม</small></div><span class="pill success">พร้อม</span></li>'+
  '<li><span>✓</span><div><strong>RLS / Role + Scope</strong><small>แยกสิทธิ์ตาม อปท. และสถานศึกษา</small></div><span class="pill success">พร้อม</span></li>'+
  '<li><span>✓</span><div><strong>Audit Log</strong><small>รองรับการตรวจสอบเหตุการณ์สำคัญ</small></div><span class="pill success">พร้อม</span></li>'+
  '<li><span>→</span><div><strong>Google OAuth</strong><small>ใช้สำหรับเชื่อม Drive ของแต่ละโรงเรียน</small></div><span class="pill warning">รอดำเนินการ</span></li></ul></article></section>'+
  '<section class="module-section"><div class="section-head"><div><p class="eyebrow">Roadmap</p><h2>โมดูลทั้งหมด</h2></div></div><div class="module-grid">'+moduleHtml+'</div></section>';
}

function overviewHtml(){
  const active=state.memberships.filter(m=>m.status==="active").length;
  const pending=state.memberships.filter(m=>m.status==="pending").length;
  const tenant=(currentSchool()&&currentSchool().name_th)||(currentOrg()&&currentOrg().name_th)||"ยังไม่ได้เลือกสถานศึกษา";
  const name=displayName();
  const accessText=state.isPlatformAdmin?"ผู้ดูแลแพลตฟอร์ม":state.currentMembership?roleNames():pending?"กำลังรออนุมัติ":"ยังไม่มีสิทธิ์ใช้งานสถานศึกษา";
  const nextAction=state.isPlatformAdmin
    ? '<a class="primary-btn" href="#/organization">จัดการ อปท. และสถานศึกษา</a>'
    : active
      ? '<a class="primary-btn" href="#/membership">ดูสิทธิ์ของฉัน</a>'
      : '<a class="primary-btn" href="#/membership">'+(pending?"ตรวจสอบสถานะคำขอ":"ขอสิทธิ์เข้าร่วมสถานศึกษา")+'</a>';

  return '<section class="system-banner"><div><span class="badge">LAO-EMS</span><h2>สวัสดี '+esc(name)+'</h2><p>ยินดีต้อนรับสู่ระบบสารสนเทศเพื่อการบริหารจัดการศึกษาขององค์กรปกครองส่วนท้องถิ่น</p></div></section>'+
  '<section class="stats-grid">'+
    '<article class="stat-card"><span class="stat-icon">🏫</span><div><small>สถานศึกษา</small><strong>'+esc(tenant)+'</strong><p>'+(active||state.isPlatformAdmin?"ข้อมูลจะแสดงตามสิทธิ์ของคุณ":"กรุณาขอสิทธิ์เข้าร่วมสถานศึกษา")+'</p></div></article>'+
    '<article class="stat-card"><span class="stat-icon">👤</span><div><small>สิทธิ์การใช้งาน</small><strong>'+esc(accessText)+'</strong><p>'+esc(state.currentMembership?roleNames():"")+'</p></div></article>'+
    '<article class="stat-card"><span class="stat-icon">'+(pending?"⏳":"✓")+'</span><div><small>สถานะคำขอ</small><strong>'+(pending?pending+" คำขอรออนุมัติ":"ไม่มีคำขอค้าง")+'</strong><p>ตรวจสอบได้จากเมนูสิทธิ์การเข้าใช้งาน</p></div></article>'+
  '</section>'+
  '<section class="panel"><div class="panel-head"><div><p class="eyebrow">เริ่มใช้งาน</p><h2>สิ่งที่ต้องดำเนินการ</h2></div></div>'+
  (state.isPlatformAdmin
    ? '<div class="notice">คุณเป็นผู้ดูแลแพลตฟอร์ม สามารถเพิ่ม อปท. สถานศึกษา และตรวจสอบสิทธิ์ผู้ใช้งานได้</div>'
    : active
      ? '<div class="notice success">บัญชีของคุณพร้อมใช้งาน ระบบจะแสดงเมนูและข้อมูลตามหน้าที่ที่ได้รับอนุญาต</div>'
      : pending
        ? '<div class="notice warning">คำขอของคุณถูกส่งแล้ว กรุณารอผู้ดูแลสถานศึกษาตรวจสอบและอนุมัติ</div>'
        : '<div class="notice">บัญชีของคุณสร้างเรียบร้อยแล้ว ขั้นตอนถัดไปคือขอสิทธิ์เข้าร่วมสถานศึกษา</div>')+
  '<div class="action-row">'+nextAction+'</div></section>';
}

function membershipHtml(){
  const statusMap={pending:["รออนุมัติ","warning"],active:["ใช้งานได้","success"],rejected:["ไม่อนุมัติ","danger"],suspended:["ระงับ","danger"],ended:["สิ้นสุด","neutral"]};
  const rows=state.memberships.map(m=>{
    const s=statusMap[m.status]||[m.status,"neutral"];
    return '<tr><td>'+esc(m.lao_organizations&&m.lao_organizations.name_th||"-")+'</td><td>'+esc(m.lao_schools&&m.lao_schools.name_th||"-")+'</td><td>'+esc(roleLabels[m.requested_role_code]||m.requested_role_code||"-")+'</td><td><span class="pill '+s[1]+'">'+s[0]+'</span></td><td>'+new Date(m.requested_at).toLocaleDateString("th-TH")+'</td></tr>';
  }).join("");
  const history=rows?'<div class="table-wrap"><table><thead><tr><th>อปท.</th><th>สถานศึกษา</th><th>บทบาท</th><th>สถานะ</th><th>เริ่มต้น</th></tr></thead><tbody>'+rows+'</tbody></table></div>':'<div class="empty-state"><div class="empty-icon">🔐</div><h3>ยังไม่มีสิทธิ์สถานศึกษา</h3><p>บัญชี LAO-EMS สร้างและกำหนดสิทธิ์โดยผู้ดูแลเท่านั้น</p></div>';
  return '<section class="content-grid"><article class="panel"><div class="panel-head"><div><p class="eyebrow">My access</p><h2>สิทธิ์การเข้าใช้งานของฉัน</h2><p class="panel-sub">ผู้ใช้ไม่ต้องสมัครเข้าร่วมโรงเรียนเอง ผู้ดูแลสถานศึกษาจะเป็นผู้เชิญและกำหนดบทบาทให้</p></div></div>'+history+'</article></section>';
}

function profileNeedsSetup(){
  const p=state.profile||{};
  return !String(p.first_name_th||"").trim()||!String(p.last_name_th||"").trim();
}
function profileFieldsHtml(prefix){
  const p=state.profile||{},pre=esc(p.prefix||""),first=esc(p.first_name_th||""),last=esc(p.last_name_th||""),phone=esc(p.phone||"");
  return '<div class="form-row three"><label class="field">คำนำหน้า<select name="prefix"><option value="">ไม่ระบุ</option>'+["นาย","นาง","นางสาว","เด็กชาย","เด็กหญิง"].map(x=>'<option '+(pre===x?'selected':'')+'>'+x+'</option>').join("")+'</select></label><label class="field">ชื่อ<input name="first_name" value="'+first+'" required autocomplete="given-name"></label><label class="field">นามสกุล<input name="last_name" value="'+last+'" required autocomplete="family-name"></label></div><label class="field">เบอร์โทรศัพท์<input name="phone" type="tel" value="'+phone+'" autocomplete="tel" inputmode="tel"></label>';
}
function passwordFieldsHtml(required){
  return '<div class="form-row"><div class="form-field"><label for="account-password">รหัสผ่านใหม่</label><div class="input-with-action"><input id="account-password" name="password" type="password" autocomplete="new-password" minlength="8" '+(required?'required':'')+' data-password-input><button class="password-toggle" type="button" data-password-toggle aria-label="แสดงรหัสผ่าน" aria-pressed="false"><svg class="eye-open" viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.4-6 9.5-6 9.5 6 9.5 6-3.4 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.7"/></svg><svg class="eye-closed" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18"/><path d="M10.6 6.2A10 10 0 0 1 12 6c6.1 0 9.5 6 9.5 6a16 16 0 0 1-3.1 3.8M6.1 6.1C3.8 7.8 2.5 12 2.5 12s3.4 6 9.5 6c1.7 0 3.2-.5 4.5-1.2"/><path d="M9.9 9.9A3 3 0 0 0 14.1 14.1"/></svg></button></div></div><div class="form-field"><label for="account-password-confirm">ยืนยันรหัสผ่านใหม่</label><div class="input-with-action"><input id="account-password-confirm" name="confirm_password" type="password" autocomplete="new-password" minlength="8" '+(required?'required':'')+' data-password-input><button class="password-toggle" type="button" data-password-toggle aria-label="แสดงรหัสผ่าน" aria-pressed="false"><svg class="eye-open" viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.4-6 9.5-6 9.5 6 9.5 6-3.4 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.7"/></svg><svg class="eye-closed" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18"/><path d="M10.6 6.2A10 10 0 0 1 12 6c6.1 0 9.5 6 9.5 6a16 16 0 0 1-3.1 3.8M6.1 6.1C3.8 7.8 2.5 12 2.5 12s3.4 6 9.5 6c1.7 0 3.2-.5 4.5-1.2"/><path d="M9.9 9.9A3 3 0 0 0 14.1 14.1"/></svg></button></div></div></div>';
}
function bindPasswordToggles(root=document){
  qa("[data-password-toggle]",root).forEach(button=>{
    if(button.dataset.bound==="1")return;
    button.dataset.bound="1";
    button.addEventListener("click",()=>{
      const field=button.closest(".input-with-action, .password-field");
      const input=field&&field.querySelector("[data-password-input]");
      if(!input)return;
      const show=input.type==="password";
      input.type=show?"text":"password";
      button.classList.toggle("is-visible",show);
      button.setAttribute("aria-pressed",String(show));
      button.setAttribute("aria-label",show?"ซ่อนรหัสผ่าน":"แสดงรหัสผ่าน");
    });
  });
}
function activationHtml(){
  const inv=state.pendingInvitation;
  if(!inv)return '<section class="panel"><div class="empty-state"><div class="empty-icon">✓</div><h3>บัญชีพร้อมใช้งานแล้ว</h3><p>ไม่มีคำเชิญที่รอดำเนินการ</p><a class="primary-btn" href="#/overview">ไปหน้าหลัก</a></div></section>';
  const hasActive=state.memberships.some(m=>m.status==="active"),requirePassword=!hasActive;
  return '<section class="onboarding-shell"><article class="panel onboarding-card"><div class="panel-head"><div><p class="eyebrow">Account activation</p><h2>ตั้งค่าบัญชี LAO-EMS</h2><p class="panel-sub">อีเมลของคุณได้รับคำเชิญจากผู้ดูแล กรุณากรอกโปรไฟล์และ'+(requirePassword?'กำหนดรหัสผ่านใหม่':'ตรวจสอบข้อมูลก่อนรับสิทธิ์ใหม่')+'</p></div></div><div class="invite-summary"><div><small>อีเมล</small><strong>'+esc(state.user.email||inv.email||"-")+'</strong></div><div><small>สถานศึกษา</small><strong>'+esc(inv.school_name||"-")+'</strong></div><div><small>บทบาท</small><strong>'+esc(roleLabels[inv.role_code]||inv.role_code)+'</strong></div></div><form id="activation-form" class="form-grid">'+profileFieldsHtml("activation")+passwordFieldsHtml(requirePassword)+'<div class="span-2 notice">'+(requirePassword?'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร และจะใช้เข้าสู่ระบบครั้งถัดไป':'หากต้องการเปลี่ยนรหัสผ่านในครั้งนี้ สามารถกรอกช่องรหัสผ่านใหม่ได้')+'</div><div class="span-2"><button class="primary-btn" type="submit">บันทึกโปรไฟล์และเปิดใช้งานบัญชี</button></div></form></article></section>';
}
function profileHtml(){
  return '<section class="content-grid"><article class="panel form-card"><div class="panel-head"><div><p class="eyebrow">My profile</p><h2>โปรไฟล์ของฉัน</h2><p class="panel-sub">'+esc(state.user&&state.user.email||"")+'</p></div></div><form id="profile-form" class="form-grid" style="margin-top:18px">'+profileFieldsHtml("profile")+'<div class="span-2"><hr class="form-divider"></div><div class="span-2"><strong>เปลี่ยนรหัสผ่าน</strong><p class="panel-sub">เว้นว่างไว้หากไม่ต้องการเปลี่ยน</p></div>'+passwordFieldsHtml(false)+'<div class="span-2"><button class="primary-btn" type="submit">บันทึกการเปลี่ยนแปลง</button></div></form></article></section>';
}

function setupHtml(){
  const school=currentSchool();
  return '<section class="content-grid"><article class="panel"><div class="panel-head"><div><p class="eyebrow">Source of truth</p><h2>ข้อมูลโรงเรียนและนักเรียนมาจาก LEC เท่านั้น</h2></div></div><ul class="status-list"><li><span>✓</span><div><strong>LEC เป็นข้อมูลต้นทาง</strong><small>ไม่มีการแก้ไขข้อมูลนักเรียนหรือข้อมูลทางราชการของโรงเรียนด้วยมือใน LAO-EMS</small></div><span class="pill success">บังคับใช้</span></li><li><span>✓</span><div><strong>ปีการศึกษา / ภาคเรียน</strong><small>ระบบสร้างโครงสร้างปีและภาคเรียนจากรอบที่นำเข้า LEC โดยอัตโนมัติ</small></div><span class="pill success">อัตโนมัติ</span></li><li><span>✓</span><div><strong>ประวัติไม่ถูกลบ</strong><small>นักเรียนที่หายจาก LEC รอบใหม่จะเป็น “ไม่พบใน LEC รอบล่าสุด” ไม่ใช่ย้ายออก</small></div><span class="pill success">รักษาประวัติ</span></li><li><span>→</span><div><strong>Google Drive</strong><small>'+(school?"ไฟล์ต้นฉบับของ "+esc(school.name_th)+" จะเชื่อมเก็บใน Drive เมื่อโมดูล Drive เปิดใช้งาน":"เลือกสถานศึกษาเพื่อดูบริบท")+'</small></div><span class="pill warning">รอเชื่อม</span></li></ul></article><article class="panel"><div class="panel-head"><div><p class="eyebrow">LEC import</p><h2>การปรับข้อมูล</h2></div></div><div class="notice">หากข้อมูลใน LAO-EMS ไม่ตรงกับข้อมูลจริง ให้แก้ที่ <strong>LEC</strong> แล้วดาวน์โหลด XLS/XLSX รอบใหม่มานำเข้า ไม่แก้ค่าต้นทางใน LAO-EMS โดยตรง</div><div class="action-row"><a class="primary-btn" href="#/lec">ไปหน้านำเข้าข้อมูล LEC</a></div></article></section>';
}

async function organizationHtml(){
  const res=await supabase.from("lao_schools")
    .select("id,name_th,name_en,code,slug,organization_id,is_active,source_system,lec_synced_at,lec_source_file_name,lao_organizations(id,name_th)")
    .order("name_th");
  if(res.error)throw res.error;
  const schools=res.data||[];
  state.orgSchools=schools;

  let manage="";
  if(state.isPlatformAdmin){
    manage+='<article class="panel"><div class="panel-head"><div><p class="eyebrow">Platform setup</p><h2>องค์กรปกครองส่วนท้องถิ่น</h2><p class="panel-sub">โครงสร้าง อปท. เป็นการตั้งค่าระดับแพลตฟอร์ม ส่วนข้อมูลทางราชการของโรงเรียนและนักเรียนใช้ LEC เป็นแหล่งต้นทาง</p></div></div><form id="organization-form" class="form-grid" style="margin-top:18px"><label class="field">ชื่อ อปท. (ไทย)<input name="name_th" required></label><label class="field">ชื่อภาษาอังกฤษ<input name="name_en"></label><label class="field">รหัสหน่วยงาน<input name="code"></label><label class="field">ประเภท<select name="organization_type"><option value="municipality">เทศบาล</option><option value="pao">องค์การบริหารส่วนจังหวัด</option><option value="sao">องค์การบริหารส่วนตำบล</option><option value="special_local_government">องค์กรปกครองส่วนท้องถิ่นรูปแบบพิเศษ</option><option value="local_government">อื่น ๆ</option></select></label><div class="span-2"><button class="primary-btn" type="submit">เพิ่ม อปท.</button></div></form></article>';
    const opts=state.organizations.map(o=>'<option value="'+o.id+'">'+esc(o.name_th)+'</option>').join("");
    manage+='<article class="panel"><div class="panel-head"><div><p class="eyebrow">Tenant setup</p><h2>สร้างพื้นที่สถานศึกษา</h2><p class="panel-sub">ขั้นตอนนี้สร้างเพียงพื้นที่ (tenant) เพื่อแต่งตั้ง School Admin คนแรก ข้อมูลทางราชการจริงจะมาจากไฟล์ LEC หลัง School Admin ได้รับอนุมัติ</p></div></div><form id="school-form" class="form-grid" style="margin-top:18px"><label class="field">อปท.<select name="organization_id" required><option value="">เลือก อปท.</option>'+opts+'</select></label><label class="field">ชื่อที่ใช้ระบุพื้นที่โรงเรียน<input name="name_th" required placeholder="ใช้เพื่อระบุโรงเรียนก่อนเชื่อม LEC"></label><label class="field span-2">Slug<input name="slug" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required placeholder="t1-nakhonnok"></label><div class="span-2 notice">หลังนำเข้า LEC แล้ว ข้อมูลที่ LEC เป็นเจ้าของจะถูกล็อก ไม่แก้ไขด้วยมือใน LAO-EMS</div><div class="span-2"><button class="primary-btn" type="submit">สร้างพื้นที่สถานศึกษา</button></div></form></article>';
  }

  const rows=schools.map(s=>{
    const synced=s.source_system==="LEC"&&s.lec_synced_at;
    const source=synced?'<span class="pill success">LEC</span>':'<span class="pill warning">รอนำเข้า LEC</span>';
    const last=s.lec_synced_at?new Date(s.lec_synced_at).toLocaleString("th-TH"):"ยังไม่เคยนำเข้า";
    return '<tr><td>'+esc(s.lao_organizations&&s.lao_organizations.name_th||"-")+'</td><td><strong>'+esc(s.name_th)+'</strong><br><small>'+esc(s.code||"")+'</small></td><td><code>'+esc(s.slug)+'</code></td><td>'+source+'<br><small>'+esc(last)+'</small></td><td><button class="secondary-btn" data-school-lec="'+s.id+'">ดูข้อมูล LEC</button></td></tr>';
  }).join("");
  const list=schools.length
    ? '<article class="panel"><div class="panel-head"><div><p class="eyebrow">Source-controlled schools</p><h2>สถานศึกษาในระบบ</h2><p class="panel-sub">ไม่มีปุ่มแก้ไขข้อมูล LEC หากข้อมูลผิดให้แก้ในระบบ LEC แล้วนำเข้าไฟล์ใหม่</p></div></div><div class="table-wrap"><table><thead><tr><th>อปท.</th><th>สถานศึกษา</th><th>Slug</th><th>ข้อมูลต้นทาง</th><th>ดำเนินการ</th></tr></thead><tbody>'+rows+'</tbody></table></div></article>'
    : '<article class="panel"><div class="empty-state"><div class="empty-icon">🏫</div><h3>ยังไม่มีสถานศึกษา</h3><p>Platform Admin สร้างพื้นที่สถานศึกษาก่อนเพื่อให้สามารถแต่งตั้ง School Admin คนแรกได้</p></div></article>';
  return '<section class="content-grid">'+manage+list+'</section>';
}

async function usersHtml(){
  if(!hasRole("platform_admin","school_admin"))return '<section class="panel"><div class="empty-state"><div class="empty-icon">🛡️</div><h3>เมนูนี้สำหรับผู้ดูแล</h3><p>ผู้ใช้ของ LAO-EMS สร้างโดยผู้ดูแลสถานศึกษาเท่านั้น</p></div></section>';
  const school=currentSchool();
  if(!school)return '<section class="panel"><div class="empty-state"><div class="empty-icon">🏫</div><h3>เลือกสถานศึกษาก่อน</h3><p>เลือกโรงเรียนจากตัวเลือกด้านบนเพื่อจัดการบัญชีผู้ใช้</p></div></section>';

  const hasAdminRes=await supabase.rpc("lao_school_has_admin",{p_school_id:school.id});
  if(hasAdminRes.error)throw hasAdminRes.error;
  const schoolHasAdmin=hasAdminRes.data===true;
  const isLocalAdmin=!state.isPlatformAdmin&&hasRole("school_admin");
  const platformMayInvite=state.isPlatformAdmin&&!schoolHasAdmin;

  const invRes=await supabase.from("lao_user_invitations")
    .select("id,email,role_code,invitation_mode,status,sent_at,accepted_at")
    .eq("school_id",school.id).order("sent_at",{ascending:false}).limit(100);
  if(invRes.error)throw invRes.error;

  const roleOptions=isLocalAdmin
    ? [["school_admin","ผู้ดูแลสถานศึกษาร่วม"],["school_executive","ผู้บริหารสถานศึกษา"],["registrar","งานทะเบียน"],["academic_officer","งานวิชาการ"],["teacher","ครู"],["staff","บุคลากร"],["student","นักเรียน"],["guardian","ผู้ปกครอง"]]
    : [["school_admin","ผู้ดูแลสถานศึกษาคนแรก"]];
  const canInvite=isLocalAdmin||platformMayInvite;
  const inviteForm=canInvite
    ? '<article class="panel form-card"><div class="panel-head"><div><p class="eyebrow">Admin-managed account</p><h2>เชิญผู้ใช้เข้า LAO-EMS</h2><p class="panel-sub">'+(state.isPlatformAdmin?'Platform Admin เชิญเฉพาะ School Admin คนแรก หลังจากนั้น School Admin โรงเรียนจะจัดการผู้ใช้เอง':'กรอกอีเมลและกำหนดบทบาท ระบบจะส่งลิงก์ยืนยันไปยังอีเมล')+'</p></div></div><form id="invite-user-form" class="form-grid" style="margin-top:18px"><label class="field">อีเมลผู้ใช้<input name="email" type="email" autocomplete="off" required placeholder="name@example.com"></label><label class="field">บทบาท<select name="role_code" required>'+roleOptions.map(([v,l])=>'<option value="'+v+'">'+l+'</option>').join("")+'</select></label><div class="span-2 notice">ระบบไม่ส่งรหัสผ่านชั่วคราวเป็นข้อความในอีเมล ผู้รับจะยืนยันอีเมลผ่านลิงก์ที่ปลอดภัย แล้วตั้งรหัสผ่านของตนเองก่อนใช้งาน</div><div class="span-2"><button class="primary-btn" type="submit">ส่งคำเชิญทางอีเมล</button></div></form></article>'
    : '<article class="panel"><div class="notice"><strong>โรงเรียนมี School Admin แล้ว</strong><br>การสร้างผู้ใช้และผู้ดูแลร่วมเป็นหน้าที่ของ School Admin โรงเรียนนี้ Platform Admin ยังตรวจสอบข้อมูลได้ แต่ไม่สร้างผู้ใช้แทนโรงเรียน</div></article>';

  const rows=(invRes.data||[]).map(x=>{
    const status={pending:["รอยืนยัน","warning"],accepted:["เปิดใช้งานแล้ว","success"],revoked:["ยกเลิก","neutral"],failed:["ส่งไม่สำเร็จ","danger"]}[x.status]||[x.status,"neutral"];
    return '<tr><td><strong>'+esc(x.email)+'</strong><br><small>'+new Date(x.sent_at).toLocaleString("th-TH")+'</small></td><td>'+esc(roleLabels[x.role_code]||x.role_code)+'</td><td><span class="pill '+status[1]+'">'+status[0]+'</span></td><td>'+esc(x.invitation_mode==="platform_first_admin"?"Platform Admin · คนแรก":"School Admin")+'</td></tr>';
  }).join("");
  const history='<article class="panel"><div class="panel-head"><div><p class="eyebrow">Invitation history</p><h2>บัญชีและคำเชิญ · '+esc(school.name_th)+'</h2><p class="panel-sub">ไม่มีการสมัครบัญชีด้วยตนเอง ผู้ดูแลเป็นผู้เริ่มต้นบัญชีและกำหนดบทบาท</p></div></div>'+(rows?'<div class="table-wrap"><table><thead><tr><th>อีเมล</th><th>บทบาท</th><th>สถานะ</th><th>ผู้รับผิดชอบ</th></tr></thead><tbody>'+rows+'</tbody></table></div>':'<div class="empty-state"><div class="empty-icon">✉️</div><h3>ยังไม่มีคำเชิญ</h3><p>เริ่มจากกรอกอีเมลผู้ใช้ด้านบน</p></div>')+'</article>';
  return '<section class="content-grid">'+inviteForm+history+'</section>';
}

function notificationsHtml(){
  const rows=state.notifications.map(n=>{
    const unread=!n.read_at;
    return '<article class="notification-card '+(unread?"unread":"")+'"><div class="notification-icon">🔔</div><div class="notification-copy"><div class="notification-title"><strong>'+esc(n.title)+'</strong>'+(unread?'<span class="pill warning">ใหม่</span>':'')+'</div><p>'+esc(n.body||"")+'</p><small>'+new Date(n.created_at).toLocaleString("th-TH")+'</small></div>'+(unread?'<button class="secondary-btn" data-notification-read="'+n.id+'">ทำเครื่องหมายว่าอ่านแล้ว</button>':'')+'</article>';
  }).join("");
  return '<section class="panel"><div class="panel-head"><div><p class="eyebrow">Notifications</p><h2>การแจ้งเตือน</h2><p class="panel-sub">แจ้งคำขอสมาชิก การแต่งตั้งผู้ดูแล และเหตุการณ์สำคัญของระบบ</p></div></div>'+(rows?'<div class="notification-list">'+rows+'</div>':'<div class="empty-state"><div class="empty-icon">🔔</div><h3>ยังไม่มีการแจ้งเตือน</h3><p>เมื่อมีรายการที่ต้องดำเนินการ ระบบจะแสดงที่นี่</p></div>')+'</section>';
}

function lecHeaderText(v){return String(v==null?"":v).replace(/\u00a0/g," ").replace(/\s+/g," ").trim();}
function lecHeaderNorm(v){return lecHeaderText(v).replace(/[\s\/\\:;,.()\[\]{}\-_–—]/g,"").toLowerCase();}
function lecCellText(cell){
  if(cell==null)return "";
  if(typeof cell==="string")return cell.trim();
  if(typeof cell==="number")return String(cell);
  if(cell instanceof Date){
    const d=String(cell.getDate()).padStart(2,"0"),m=String(cell.getMonth()+1).padStart(2,"0");
    const y=cell.getFullYear()+543;
    return d+"/"+m+"/"+y;
  }
  return String(cell).trim();
}
function lecWorksheetMatrix(ws){
  if(!ws||!ws["!ref"])return [];
  const range=XLSX.utils.decode_range(ws["!ref"]);
  const maxRows=Math.min(range.e.r+1,12000),maxCols=Math.min(range.e.c+1,180);
  const matrix=Array.from({length:maxRows},()=>Array(maxCols).fill(""));
  for(let r=0;r<maxRows;r++)for(let col=0;col<maxCols;col++){
    const cell=ws[XLSX.utils.encode_cell({r,col})];
    if(cell)matrix[r][col]=lecCellText(cell.w!=null?cell.w:cell.v);
  }
  (ws["!merges"]||[]).forEach(m=>{
    if(m.s.r>=maxRows||m.s.c>=maxCols)return;
    const value=matrix[m.s.r][m.s.c];
    if(!value)return;
    for(let r=m.s.r;r<=Math.min(m.e.r,maxRows-1);r++){
      for(let col=m.s.c;col<=Math.min(m.e.c,maxCols-1);col++)matrix[r][col]=value;
    }
  });
  return matrix;
}
function lecFindHeaderStart(matrix){
  const limit=Math.min(matrix.length,50);
  for(let r=0;r<limit;r++){
    const n=matrix[r].map(lecHeaderNorm);
    if(n.some(x=>x.includes("ลำดับที่"))&&n.some(x=>x.includes("เลขประจำตัวนักเรียน")))return r;
  }
  return -1;
}
function lecFlattenHeaders(matrix,start){
  let studentNoCol=-1;
  for(let r=start;r<Math.min(matrix.length,start+5);r++){
    const c=matrix[r].findIndex(v=>lecHeaderNorm(v).includes("เลขประจำตัวนักเรียน"));
    if(c>=0){studentNoCol=c;break;}
  }
  if(studentNoCol<0)throw new Error("ไม่พบคอลัมน์เลขประจำตัวนักเรียน");
  let dataStart=-1;
  for(let r=start+1;r<Math.min(matrix.length,start+12);r++){
    const sid=lecHeaderText(matrix[r][studentNoCol]);
    const first=lecHeaderText(matrix[r][0]);
    if(sid&&(!lecHeaderNorm(sid).includes("เลขประจำตัวนักเรียน"))&&(/^\d+$/.test(first)||/^\d+$/.test(sid))){
      dataStart=r;break;
    }
  }
  if(dataStart<0)dataStart=start+2;
  const colCount=Math.max(...matrix.slice(start,Math.min(dataStart+1,matrix.length)).map(row=>row.length),0);
  const headers=[];
  for(let col=0;col<colCount;col++){
    const parts=[];
    for(let r=start;r<dataStart;r++){
      const v=lecHeaderText(matrix[r][col]);
      if(v&&!parts.includes(v))parts.push(v);
    }
    headers.push(parts.join(" / ")||("คอลัมน์ "+(col+1)));
  }
  return {headers,dataStart,studentNoCol};
}
function lecFindCol(headers,{include=[],exclude=[]}){
  const inc=include.map(lecHeaderNorm),exc=exclude.map(lecHeaderNorm);
  return headers.findIndex(h=>{
    const n=lecHeaderNorm(h);
    return inc.every(x=>n.includes(x))&&!exc.some(x=>n.includes(x));
  });
}
function lecBuildMap(headers){
  const map={};
  const topExclude=["บิดา","มารดา","ผู้ปกครอง","ที่อยู่ตามทะเบียนบ้าน","ที่อยู่ปัจจุบัน"];
  const put=(key,include,exclude=[])=>{const x=lecFindCol(headers,{include,exclude});if(x>=0)map[key]=x;};

  // Official school identity columns from the LEC report.
  put("school_province",["จังหวัด"],topExclude);
  put("school_district",["อำเภอ"],topExclude);
  put("organization_name_th",["อปท"]);
  put("school_name_th",["สถานศึกษา"]);
  put("academic_year_be",["ปีการศึกษา"]);
  put("term_no",["ภาคเรียน"]);

  put("student_no",["เลขประจำตัวนักเรียน"]);
  put("prefix",["คำนำหน้า"],topExclude);
  put("first_name_th",["ชื่อ"],["บิดา","มารดา","ผู้ปกครอง","ชื่อเรื่อง"]);
  put("last_name_th",["นามสกุล"],topExclude);
  put("birth_date",["วันเดือนปี","เกิด"]);
  put("race",["เชื้อชาติ"]);
  put("nationality",["สัญชาติ"]);
  put("religion",["ศาสนา"],["บิดา","มารดา","ผู้ปกครอง"]);
  put("citizen_id",["เลขประจำตัวประช"]);
  put("admission_date",["วันเดือนปี","เข้าศึกษา"]);
  put("height_cm",["ส่วนสูง"]);
  put("weight_kg",["น้ำหนัก"]);
  put("student_condition",["สภาพนักเรียน"]);
  put("family_status",["สถานภาพ"]);
  put("tuition_reimbursement",["สิทธิการเบิกค่าเล่าเรียน"]);
  put("medical_reimbursement",["สิทธิการเบิกค่ารักษาพยาบาล"]);
  let x=lecFindCol(headers,{include:["ระดับชั้น"]}); if(x<0)x=lecFindCol(headers,{include:["ชั้น"],exclude:["คำนำหน้า"]}); if(x>=0)map.grade_level=x;
  x=lecFindCol(headers,{include:["ห้องเรียน"]}); if(x<0)x=lecFindCol(headers,{include:["ห้อง"]}); if(x>=0)map.classroom=x;

  for(const [group,key] of [["บิดา","father"],["มารดา","mother"],["ผู้ปกครอง","guardian"]]){
    for(const [field,labels] of [["prefix",["คำนำหน้า"]],["first_name",["ชื่อ"]],["last_name",["นามสกุล"]],["religion",["ศาสนา"]],["occupation",["อาชีพ"]],["monthly_income",["รายได้"]],["phone",["เบอร์โทร"]],["relationship",["ความเกี่ยวข้อง"]]]){
      const col=lecFindCol(headers,{include:[group,...labels]}); if(col>=0)map[key+"."+field]=col;
    }
  }
  for(const [group,key] of [["ที่อยู่ตามทะเบียนบ้าน","registered_address"],["ที่อยู่ปัจจุบัน","current_address"]]){
    for(const [field,labels] of [["house_no",["เลขที่"]],["moo",["หมู่ที่"]],["road",["ถนน"]],["subdistrict",["ตำบล"]],["district",["อำเภอ"]],["province",["จังหวัด"]],["postal_code",["รหัสไปรษณีย์"]]]){
      const col=lecFindCol(headers,{include:[group,...labels]}); if(col>=0)map[key+"."+field]=col;
    }
  }
  return map;
}
function lecRowObject(headers,row){
  const out={},used={};
  headers.forEach((h,idx)=>{
    let k=h||("คอลัมน์ "+(idx+1)); used[k]=(used[k]||0)+1;
    if(used[k]>1)k=k+" ["+used[k]+"]";
    out[k]=lecCellText(row[idx]);
  });
  return out;
}
function lecMappedValue(row,map,key){
  const col=map[key]; return col==null?undefined:lecCellText(row[col]);
}
function lecBuildCanonical(row,map){
  const c={};
  const set=(key)=>{const v=lecMappedValue(row,map,key);if(v!==undefined)c[key]=v;};
  ["school_province","school_district","organization_name_th","school_name_th","academic_year_be","term_no","student_no","prefix","first_name_th","last_name_th","birth_date","race","nationality","religion","citizen_id","admission_date","height_cm","weight_kg","student_condition","family_status","tuition_reimbursement","medical_reimbursement","grade_level","classroom"].forEach(set);
  for(const group of ["father","mother","guardian"]){
    const o={};
    for(const field of ["prefix","first_name","last_name","religion","occupation","monthly_income","phone","relationship"]){
      const v=lecMappedValue(row,map,group+"."+field); if(v!==undefined)o[field]=v;
    }
    if(Object.values(o).some(v=>v))c[group]=o;
  }
  for(const group of ["registered_address","current_address"]){
    const o={};
    for(const field of ["house_no","moo","road","subdistrict","district","province","postal_code"]){
      const v=lecMappedValue(row,map,group+"."+field); if(v!==undefined)o[field]=v;
    }
    if(Object.values(o).some(v=>v))c[group]=o;
  }
  return c;
}
function lecHeaderMapForServer(headers,map){
  return Object.fromEntries(Object.entries(map).map(([key,col])=>[key,headers[col]||("คอลัมน์ "+(col+1))]));
}
async function lecSha256(buffer){
  if(!crypto||!crypto.subtle)return null;
  const digest=await crypto.subtle.digest("SHA-256",buffer);
  return Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,"0")).join("");
}
function lecMetaFind(matrix,headerStart,labels){
  const rows=matrix.slice(0,Math.max(headerStart,0)),normLabels=labels.map(lecHeaderNorm);
  for(const row of rows){
    for(let col=0;col<row.length;col++){
      const raw=lecHeaderText(row[col]); if(!raw)continue;
      const norm=lecHeaderNorm(raw);
      for(let j=0;j<normLabels.length;j++){
        const label=labels[j],nLabel=normLabels[j];
        if(!norm.includes(nLabel))continue;
        const parts=raw.split(/[:：]/);
        if(parts.length>1){
          const tail=parts.slice(1).join(":").trim();
          if(tail)return tail;
        }
        const idx=raw.indexOf(label);
        if(idx>=0){
          const tail=raw.slice(idx+label.length).replace(/^\s*[-–—:]?\s*/,"").trim();
          if(tail)return tail;
        }
        for(let k=col+1;k<Math.min(row.length,col+5);k++){
          const next=lecHeaderText(row[k]); if(next)return next;
        }
      }
    }
  }
  return null;
}
function lecUniqueMappedValues(matrix,dataStart,map,key){
  const values=[],seen=new Set();
  for(let r=dataStart;r<matrix.length;r++){
    const studentNo=lecMappedValue(matrix[r],map,"student_no");
    if(!studentNo)continue;
    const value=lecMappedValue(matrix[r],map,key);
    if(!value)continue;
    const norm=lecHeaderNorm(value);
    if(seen.has(norm))continue;
    seen.add(norm);values.push(value);
    if(values.length>=10)break;
  }
  return values;
}
function lecArabicDigits(value){
  const th="๐๑๒๓๔๕๖๗๘๙";
  return String(value==null?"":value).replace(/[๐-๙]/g,d=>String(th.indexOf(d)));
}
function lecParseAcademicYear(value){
  const text=lecArabicDigits(value);
  const years=(text.match(/(?:24|25|26|27)\d{2}/g)||[]).map(Number);
  return years.find(y=>y>=2400&&y<=2800)||null;
}
function lecParseTerm(value){
  const text=lecArabicDigits(value).trim();
  if(/^[1-4]$/.test(text))return Number(text);
  const m=text.match(/ภาคเรียน(?:ที่)?\s*([1-4])(?:\D|$)/i);
  return m?Number(m[1]):null;
}
function lecPeriodFromSheet(matrix,headerStart,map,dataStart){
  const yearValues=lecUniqueMappedValues(matrix,dataStart,map,"academic_year_be");
  const termValues=lecUniqueMappedValues(matrix,dataStart,map,"term_no");
  const yearFromRows=yearValues.map(lecParseAcademicYear).filter(Boolean);
  const termFromRows=termValues.map(lecParseTerm).filter(Boolean);
  const topText=matrix.slice(0,Math.max(headerStart,0)).flat().map(lecHeaderText).filter(Boolean).join(" ");
  const academicYearBe=yearFromRows[0]||lecParseAcademicYear(lecMetaFind(matrix,headerStart,["ปีการศึกษา"]))||lecParseAcademicYear(topText);
  const termNo=termFromRows[0]||lecParseTerm(lecMetaFind(matrix,headerStart,["ภาคเรียนที่","ภาคเรียน"]))||lecParseTerm(topText);
  return {
    academic_year_be:academicYearBe,
    term_no:termNo,
    period_conflicts:[
      ...(new Set(yearFromRows).size>1?["ปีการศึกษา"]:[]),
      ...(new Set(termFromRows).size>1?["ภาคเรียน"]:[])
    ]
  };
}
function lecDetectMetadata(matrix,headerStart,map,dataStart){
  const topRows=matrix.slice(0,Math.max(headerStart,0));
  const period=lecPeriodFromSheet(matrix,headerStart,map,dataStart);
  const texts=topRows.flat().map(lecHeaderText).filter(Boolean);
  const schoolValues=lecUniqueMappedValues(matrix,dataStart,map,"school_name_th");
  const orgValues=lecUniqueMappedValues(matrix,dataStart,map,"organization_name_th");
  const provinceValues=lecUniqueMappedValues(matrix,dataStart,map,"school_province");
  const districtValues=lecUniqueMappedValues(matrix,dataStart,map,"school_district");
  let schoolName=schoolValues[0]||lecMetaFind(matrix,headerStart,["ชื่อสถานศึกษา","ชื่อโรงเรียน"]);
  if(!schoolName)schoolName=texts.find(x=>/^โรงเรียน/.test(x)&&!x.includes("รายงาน")&&!x.includes("ข้อมูลนักเรียน"))||null;
  const conflicts=[];
  if(schoolValues.length>1)conflicts.push("สถานศึกษา");
  if(orgValues.length>1)conflicts.push("อปท.");
  if(provinceValues.length>1)conflicts.push("จังหวัด");
  if(districtValues.length>1)conflicts.push("อำเภอ");
  return {
    school_code:lecMetaFind(matrix,headerStart,["รหัสสถานศึกษา","รหัสโรงเรียน","รหัสสถานศึกษา LEC"]),
    school_name_th:schoolName,
    organization_name_th:orgValues[0]||null,
    province_name_th:provinceValues[0]||null,
    district_name_th:districtValues[0]||null,
    academic_year_be:period.academic_year_be,
    term_no:period.term_no,
    school_phone:lecMetaFind(matrix,headerStart,["โทรศัพท์สถานศึกษา","โทรศัพท์โรงเรียน","โทรศัพท์","เบอร์โทรศัพท์"]),
    school_email:lecMetaFind(matrix,headerStart,["อีเมลสถานศึกษา","อีเมลโรงเรียน","E-mail","Email"]),
    school_website_url:lecMetaFind(matrix,headerStart,["เว็บไซต์สถานศึกษา","เว็บไซต์โรงเรียน","เว็บไซต์","Website"]),
    school_address_text:lecMetaFind(matrix,headerStart,["ที่อยู่สถานศึกษา","ที่อยู่โรงเรียน"]),
    report_heading:texts.find(x=>x.includes("รายงานรายละเอียดข้อมูลนักเรียน"))||null,
    school_metadata_conflicts:conflicts,
    period_conflicts:period.period_conflicts
  };
}
function lecSheetProfile(wb,sheetName){
  const ws=wb.Sheets[sheetName];
  if(!ws)return null;
  const matrix=lecWorksheetMatrix(ws);
  const headerStart=lecFindHeaderStart(matrix);
  if(headerStart<0)return {sheetName,valid:false,rowCount:0,missing:["หัวตาราง LEC"]};
  let flat;
  try{flat=lecFlattenHeaders(matrix,headerStart);}catch(e){
    return {sheetName,valid:false,rowCount:0,missing:["เลขประจำตัวนักเรียน"]};
  }
  const headers=flat.headers,map=lecBuildMap(headers);
  const required=["school_province","school_district","organization_name_th","school_name_th","student_no","first_name_th","last_name_th"];
  const missing=required.filter(k=>map[k]==null);
  let rowCount=0;
  for(let r=flat.dataStart;r<matrix.length;r++)if(lecMappedValue(matrix[r],map,"student_no"))rowCount++;
  const score=(required.length-missing.length)*100000+Math.min(rowCount,99999);
  return {sheetName,valid:missing.length===0&&rowCount>0,rowCount,missing,score,matrix,headerStart,flat,headers,map};
}
async function parseLecFile(file){
  if(!window.XLSX)throw new Error("ไม่สามารถโหลดตัวอ่านไฟล์ Excel ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่");
  const buffer=await file.arrayBuffer();
  const wb=XLSX.read(buffer,{type:"array",cellDates:true});
  if(!wb.SheetNames.length)throw new Error("ไฟล์ไม่มีแผ่นงาน");

  const profiles=wb.SheetNames.map(name=>lecSheetProfile(wb,name)).filter(Boolean);
  const candidates=profiles.filter(x=>x.valid).sort((a,b)=>b.score-a.score);
  if(!candidates.length){
    const scanned=profiles.map(x=>x.sheetName).join(", ");
    throw new Error("ไม่พบชีตข้อมูล LEC ที่มีข้อมูลสถานศึกษาครบ ต้องมีคอลัมน์ จังหวัด, อำเภอ, อปท., สถานศึกษา, เลขประจำตัวนักเรียน, ชื่อ และนามสกุล"+(scanned?" (ตรวจแล้ว: "+scanned+")":""));
  }

  const selected=candidates[0],matrix=selected.matrix,headers=selected.headers,map=selected.map,flat=selected.flat;
  const missing=["school_province","school_district","organization_name_th","school_name_th","student_no","first_name_th","last_name_th"].filter(k=>map[k]==null);
  const rows=[];
  for(let r=flat.dataStart;r<matrix.length;r++){
    const canonical=lecBuildCanonical(matrix[r],map);
    if(!canonical.student_no)continue;
    rows.push({source_row_no:r+1,raw:lecRowObject(headers,matrix[r]),canonical});
  }
  if(!rows.length)throw new Error("ไม่พบข้อมูลนักเรียนในชีต "+selected.sheetName);

  const metadata=lecDetectMetadata(matrix,selected.headerStart,map,flat.dataStart);
  if(metadata.school_metadata_conflicts&&metadata.school_metadata_conflicts.length){
    throw new Error("ชีต "+selected.sheetName+" มีข้อมูลมากกว่าหนึ่งค่าในช่อง "+metadata.school_metadata_conflicts.join(", ")+" จึงไม่สามารถผูกกับสถานศึกษาเดียวได้");
  }
  if(metadata.period_conflicts&&metadata.period_conflicts.length){
    throw new Error("ชีต "+selected.sheetName+" มี "+metadata.period_conflicts.join(" และ ")+" มากกว่าหนึ่งค่า กรุณาดาวน์โหลดข้อมูล LEC ของรอบที่ถูกต้องใหม่");
  }
  if(!metadata.academic_year_be||!metadata.term_no){
    throw new Error("ไม่พบปีการศึกษาและภาคเรียนครบในข้อมูล LEC ระบบจึงไม่ให้ระบุเองเพื่อป้องกันข้อมูลคลาดเคลื่อน");
  }

  metadata.selected_sheet_name=selected.sheetName;
  metadata.sheet_selection_rule="complete_school_identity_columns";

  return {
    fileName:file.name,fileSize:file.size,sha256:await lecSha256(buffer),
    sheetName:selected.sheetName,
    ignoredSheetCount:Math.max(0,wb.SheetNames.length-1),
    ignoredSheets:wb.SheetNames.filter(name=>name!==selected.sheetName),
    sheetScan:profiles.map(x=>({sheetName:x.sheetName,valid:x.valid,rowCount:x.rowCount,missing:x.missing})),
    headers,map,headerMap:lecHeaderMapForServer(headers,map),
    missingRequired:missing,rows,metadata
  };
}
function lecMaskId(v){
  const s=String(v||"").replace(/\s/g,"");
  if(s.length<8)return s||"-";
  return s.slice(0,4)+"•••••"+s.slice(-4);
}
async function lecHtml(){
  const school=currentSchool();
  if(!school)return '<section class="panel"><div class="empty-state"><div class="empty-icon">🏫</div><h3>เลือกสถานศึกษาก่อน</h3><p>'+(state.isPlatformAdmin?"เลือกโรงเรียนจากตัวเลือกด้านบนเพื่อดูประวัติ LEC":"บัญชีต้องมีสิทธิ์สถานศึกษาก่อนจึงจะนำเข้า LEC ได้")+'</p></div></section>';
  const history=await supabase.from("lao_lec_import_batches")
    .select("id,academic_year_be,term_no,source_file_name,source_sheet_name,source_row_count,imported_row_count,new_student_count,updated_student_count,missing_from_latest_count,issue_count,status,imported_at")
    .eq("school_id",school.id).order("imported_at",{ascending:false}).limit(30);
  if(history.error)throw history.error;
  const canImport=!state.isPlatformAdmin&&hasRole("school_admin");
  const historyRows=(history.data||[]).map(b=>'<tr><td><strong>'+b.academic_year_be+' / '+b.term_no+'</strong><br><small>'+new Date(b.imported_at).toLocaleString("th-TH")+'</small></td><td>'+esc(b.source_file_name)+'<br><small>'+esc(b.source_sheet_name||"ชีตข้อมูล LEC")+'</small></td><td>'+b.imported_row_count+' / '+b.source_row_count+'</td><td>'+b.new_student_count+'</td><td>'+b.updated_student_count+'</td><td>'+b.missing_from_latest_count+'</td><td>'+(b.issue_count?'<span class="pill danger">'+b.issue_count+'</span>':'<span class="pill success">0</span>')+'</td></tr>').join("");
  const importBox=canImport
    ? '<article class="panel"><div class="panel-head"><div><p class="eyebrow">LEC → LAO-EMS</p><h2>นำเข้าข้อมูล LEC</h2><p class="panel-sub">เลือกไฟล์เพียงอย่างเดียว ระบบอ่านข้อมูลทั้งหมดจาก LEC และตรวจสอบก่อนบันทึก · ไม่ใช้ชีต ปพ.8</p></div><span class="source-lock">🔒 LEC เท่านั้น</span></div><form id="lec-import-form" class="form-grid" style="margin-top:18px"><div class="span-2 auto-source-note"><div class="auto-source-icon">✓</div><div><strong>ไม่ต้องกรอกข้อมูลซ้ำ</strong><p>ระบบอ่านสถานศึกษา ปีการศึกษา ภาคเรียน ชั้น ห้อง และข้อมูลนักเรียนจากไฟล์ LEC โดยอัตโนมัติ</p></div></div><label class="lec-drop span-2"><input id="lec-file" name="file" type="file" accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required><span class="lec-drop-icon">⇧</span><strong>เลือกไฟล์ XLS / XLSX จาก LEC</strong><small>ระบบจะตรวจหาและแสดงข้อมูลสถานศึกษา ปีการศึกษา ภาคเรียน และจำนวนนักเรียนให้ตรวจสอบ</small></label><div id="lec-preview" class="span-2"></div><div class="span-2"><button class="primary-btn" type="submit" disabled data-lec-import>ยืนยันนำเข้าจาก LEC</button></div></form></article>'
    : '<article class="panel"><div class="notice"><strong>มุมมองตรวจสอบ</strong><br>'+(state.isPlatformAdmin?"Platform Admin ดูข้อมูลทุกโรงเรียนได้ แต่การนำเข้า LEC เป็นหน้าที่ของ School Admin ของโรงเรียนนั้น":"ต้องมีบทบาท School Admin จึงจะนำเข้าไฟล์ LEC ได้")+'</div></article>';
  const hist='<article class="panel"><div class="panel-head"><div><p class="eyebrow">Import history</p><h2>ประวัติการนำเข้า LEC · '+esc(school.name_th)+'</h2><p class="panel-sub">ข้อมูลเดิมไม่ถูกลบ เมื่อเด็กหายจากไฟล์รอบใหม่จะบันทึกว่า “ไม่พบใน LEC รอบล่าสุด” เท่านั้น</p></div></div>'+(historyRows?'<div class="table-wrap"><table><thead><tr><th>ปี / ภาค</th><th>ไฟล์</th><th>นำเข้า / ทั้งหมด</th><th>นักเรียนใหม่</th><th>อัปเดต</th><th>ไม่พบรอบล่าสุด</th><th>ปัญหา</th></tr></thead><tbody>'+historyRows+'</tbody></table></div>':'<div class="empty-state"><div class="empty-icon">⇧</div><h3>ยังไม่เคยนำเข้า LEC</h3><p>เมื่อ School Admin นำเข้าไฟล์ครั้งแรก ประวัติจะปรากฏที่นี่</p></div>')+'</article>';
  return '<section class="source-banner"><div><span class="badge">Single Source of Truth</span><h2>LEC คือข้อมูลต้นทาง</h2><p>LAO-EMS ใช้ข้อมูลจากไฟล์ LEC โดยตรง ไม่เพิ่ม แก้ หรือลบนักเรียนด้วยมือ และเก็บประวัติแยกตามปีการศึกษา/ภาคเรียน</p></div><div class="banner-status"><span class="status-pill success">XLS/XLSX</span><span class="status-pill success">ไม่ต้องกรอกเอง</span><span class="status-pill success">เลือกชีตอัตโนมัติ</span><span class="status-pill success">ไม่ใช้ ปพ.8</span></div></section><section class="content-grid">'+importBox+hist+'</section>';
}
function lecSchoolFieldLabel(key){
  return {school_code:"รหัสสถานศึกษา",school_name_th:"ชื่อสถานศึกษา",organization_name_th:"อปท.",province_name_th:"จังหวัด",district_name_th:"อำเภอ",school_phone:"โทรศัพท์",school_email:"อีเมล",school_website_url:"เว็บไซต์",school_address_text:"ที่อยู่"}[key]||key;
}
function lecSchoolInfoHtml(preview){
  const check=preview.schoolCheck||{},incoming=check.incoming||preview.metadata||{},diff=check.diff||{};
  const fields=["school_code","school_name_th","organization_name_th","province_name_th","district_name_th","school_phone","school_email","school_website_url","school_address_text"];
  const incomingRows=fields.filter(k=>incoming[k]).map(k=>'<tr><th>'+esc(lecSchoolFieldLabel(k))+'</th><td>'+esc(incoming[k])+'</td></tr>').join("");
  const diffRows=Object.entries(diff).map(([k,v])=>'<tr><th>'+esc(lecSchoolFieldLabel(k))+'</th><td>'+esc(v&&v.current||"-")+'</td><td>'+esc(v&&v.incoming||"-")+'</td></tr>').join("");
  if(check.status==="missing_school_identity"){
    return '<div class="school-verify danger"><strong>ไม่พบชีตข้อมูลสถานศึกษาที่ครบถ้วน</strong><p>ชีตที่นำเข้าต้องมี จังหวัด อำเภอ อปท. สถานศึกษา และข้อมูลนักเรียนครบตามโครงสร้าง LEC</p></div>';
  }
  if(check.status==="school_code_mismatch"||check.status==="school_identity_mismatch"){
    return '<div class="school-verify danger"><strong>ไฟล์นี้อาจเป็นของคนละโรงเรียน</strong><p>ข้อมูลระบุสถานศึกษาใน LEC ไม่ตรงกับโรงเรียนที่ผูกไว้ ระบบจึงหยุดนำเข้าเพื่อป้องกันข้อมูลนักเรียนข้ามโรงเรียน</p>'+(diffRows?'<div class="table-wrap"><table><thead><tr><th>ข้อมูล</th><th>ปัจจุบัน</th><th>จาก LEC</th></tr></thead><tbody>'+diffRows+'</tbody></table></div>':'')+'<small>กรุณาเลือกไฟล์ของโรงเรียนนี้ หรือให้ Platform Admin ตรวจสอบกรณีมีการเปลี่ยนรหัสสถานศึกษาอย่างเป็นทางการ</small></div>';
  }
  if(check.requires_confirmation){
    const accepted=preview.schoolResolution==="accept_new_lec";
    return '<div class="school-verify '+(accepted?"success":"warning")+'"><div class="school-verify-head"><div><strong>'+(check.is_first_import?"ยืนยันการผูกข้อมูลสถานศึกษาครั้งแรก":"พบข้อมูลสถานศึกษาเปลี่ยนจากรอบก่อน")+'</strong><p>'+(accepted?"ยืนยันแล้วว่าจะใช้ข้อมูลจาก LEC รอบใหม่นี้":"ระบบจะไม่ผสมข้อมูลสถานศึกษาเก่ากับข้อมูลนักเรียนจากไฟล์ใหม่")+'</p></div><span class="pill '+(accepted?"success":"warning")+'">'+(accepted?"ยืนยันแล้ว":"ต้องยืนยัน")+'</span></div>'+(diffRows?'<div class="table-wrap"><table><thead><tr><th>ข้อมูล</th><th>ข้อมูลเดิม</th><th>ข้อมูลจาก LEC</th></tr></thead><tbody>'+diffRows+'</tbody></table></div>':'')+(accepted?'<button type="button" class="secondary-btn" data-lec-change-choice>เปลี่ยนการตัดสินใจ</button>':'<div class="choice-grid"><button type="button" class="primary-btn" data-lec-use-new>ใช้ข้อมูลจาก LEC ใหม่และนำเข้าต่อ</button><button type="button" class="secondary-btn" data-lec-keep-old>คงข้อมูลเดิมและยกเลิกการนำเข้ารอบนี้</button></div>')+'</div>';
  }
  const title=check.is_first_import?"ข้อมูลสถานศึกษาที่จะนำเข้าจาก LEC":"ข้อมูลสถานศึกษาตรงกับรอบที่ผูกไว้";
  return '<div class="school-verify success"><strong>'+title+'</strong>'+(incomingRows?'<div class="table-wrap compact-table"><table><tbody>'+incomingRows+'</tbody></table></div>':'')+'</div>';
}
function renderLecPreview(preview){
  const box=q("#lec-preview"),btn=q("[data-lec-import]"); if(!box||!btn)return;
  const missing=preview.missingRequired||[],check=preview.schoolCheck||{};
  const sample=preview.rows.slice(0,5).map(r=>'<tr><td>'+esc(r.canonical.student_no||"-")+'</td><td>'+esc([r.canonical.prefix,r.canonical.first_name_th,r.canonical.last_name_th].filter(Boolean).join(" "))+'</td><td>'+esc(lecMaskId(r.canonical.citizen_id))+'</td><td>'+esc(r.canonical.grade_level||"-")+'</td><td>'+esc(r.canonical.classroom||"-")+'</td></tr>').join("");
  const ignored=preview.ignoredSheets.length?preview.ignoredSheets.map(esc).join(", "):"ไม่มี";
  const sourceOk=check.can_import!==false;
  const confirmOk=!check.requires_confirmation||preview.schoolResolution==="accept_new_lec";
  box.innerHTML='<div class="lec-preview-card"><div class="lec-preview-head"><div><strong>'+esc(preview.fileName)+'</strong><small>แท็บที่ใช้: '+esc(preview.sheetName)+' · '+preview.rows.length+' รายการ</small></div>'+(missing.length||!sourceOk?'<span class="pill danger">ยังนำเข้าไม่ได้</span>':confirmOk?'<span class="pill success">พร้อมนำเข้า</span>':'<span class="pill warning">รอยืนยัน</span>')+'</div><div class="lec-period-summary"><div><small>ปีการศึกษา</small><strong>'+esc(preview.metadata.academic_year_be||"-")+'</strong></div><div><small>ภาคเรียน</small><strong>'+(preview.metadata.term_no?("ภาคเรียนที่ "+esc(preview.metadata.term_no)):"-")+'</strong></div><div><small>นักเรียน</small><strong>'+preview.rows.length+' คน</strong></div></div><div class="lec-facts"><span>เลือกชีตอัตโนมัติ: '+esc(preview.sheetName)+'</span><span>อ่านคอลัมน์ '+preview.headers.length+' ช่อง</span><span>ข้ามชีต: '+ignored+'</span><span>SHA-256: '+esc((preview.sha256||"").slice(0,12))+'…</span></div>'+lecSchoolInfoHtml(preview)+(missing.length?'<div class="notice danger">ไม่พบคอลัมน์จำเป็น: '+missing.map(esc).join(", ")+' กรุณาดาวน์โหลดรายงาน LEC รูปแบบ RPT318 ที่ถูกต้องอีกครั้ง</div>':'<div class="notice success">สถานศึกษา ปีการศึกษา ภาคเรียน และข้อมูลนักเรียนจะนำเข้าตรงจาก LEC ไม่มีช่องให้กรอกหรือแก้ค่าต้นทางก่อนนำเข้า</div>')+'<div class="table-wrap"><table><thead><tr><th>รหัสนักเรียน</th><th>ชื่อ-สกุล</th><th>เลขประชาชน</th><th>ชั้น</th><th>ห้อง</th></tr></thead><tbody>'+sample+'</tbody></table></div></div>';
  btn.disabled=missing.length>0||!sourceOk||!confirmOk;
  const useNew=q("[data-lec-use-new]",box);
  if(useNew)useNew.addEventListener("click",()=>{preview.schoolResolution="accept_new_lec";renderLecPreview(preview);});
  const changeChoice=q("[data-lec-change-choice]",box);
  if(changeChoice)changeChoice.addEventListener("click",()=>{preview.schoolResolution=null;renderLecPreview(preview);});
  const keepOld=q("[data-lec-keep-old]",box);
  if(keepOld)keepOld.addEventListener("click",()=>{
    state.lecPreview=null;
    const input=q("#lec-file"); if(input)input.value="";
    box.innerHTML='<div class="notice">คงข้อมูลสถานศึกษาเดิมไว้และยกเลิกไฟล์รอบนี้แล้ว หากต้องการนำเข้า ให้ดาวน์โหลดไฟล์ LEC ที่ถูกต้องหรือเลือกไฟล์ใหม่</div>';
    btn.disabled=true;
  });
}
function bindLec(){
  const form=q("#lec-import-form"),input=q("#lec-file"); if(!form||!input)return;
  input.addEventListener("change",async()=>{
    state.lecPreview=null; const btn=q("[data-lec-import]"); if(btn)btn.disabled=true;
    const box=q("#lec-preview"); if(box)box.innerHTML='<div class="loading-inline"><span class="spinner"></span>กำลังตรวจโครงสร้างไฟล์ LEC...</div>';
    const file=input.files&&input.files[0]; if(!file){if(box)box.innerHTML="";return;}
    try{
      if(!/\.xlsx?$/i.test(file.name)){throw new Error("รองรับเฉพาะไฟล์ .xls หรือ .xlsx จาก LEC");}
      state.lecPreview=await parseLecFile(file);
      const school=currentSchool();
      if(!school)throw new Error("กรุณาเลือกสถานศึกษาก่อน");
      const schoolCheck=await supabase.rpc("lao_lec_school_check",{p_school_id:school.id,p_metadata:state.lecPreview.metadata});
      if(schoolCheck.error)throw schoolCheck.error;
      state.lecPreview.schoolCheck=schoolCheck.data||{};
      state.lecPreview.schoolResolution=null;
      renderLecPreview(state.lecPreview);
    }catch(e){if(box)box.innerHTML='<div class="notice danger"><strong>อ่านไฟล์ไม่สำเร็จ</strong><br>'+esc(e.message||e)+'</div>';toast(e.message||String(e),"error");}
  });
  form.addEventListener("submit",async e=>{
    e.preventDefault();
    const p=state.lecPreview,school=currentSchool(); if(!p||!school)return;
    if(p.missingRequired.length){toast("โครงสร้างไฟล์ LEC ไม่ครบ","error");return;}
    if(p.schoolCheck&&p.schoolCheck.can_import===false){toast("ข้อมูลสถานศึกษาในไฟล์ไม่ตรงกับโรงเรียนนี้","error");return;}
    if(p.schoolCheck&&p.schoolCheck.requires_confirmation&&p.schoolResolution!=="accept_new_lec"){toast("กรุณายืนยันว่าจะใช้ข้อมูลสถานศึกษาจาก LEC ใหม่ก่อน","error");return;}
    if(!confirm("ยืนยันนำเข้า LEC ปีการศึกษา "+p.metadata.academic_year_be+" ภาคเรียนที่ "+p.metadata.term_no+" จำนวน "+p.rows.length+" คน? ระบบจะรักษาประวัติเดิมไว้"))return;
    const btn=q("[data-lec-import]");
    setBusy(btn,true,"กำลังนำเข้า LEC...");
    const res=await supabase.rpc("lao_import_lec_students_auto",{
      p_school_id:school.id,
      p_file_name:p.fileName,p_file_size:p.fileSize,p_file_sha256:p.sha256,
      p_sheet_name:p.sheetName,p_ignored_sheet_count:p.ignoredSheetCount,
      p_header_map:p.headerMap,p_metadata:{...p.metadata,...(p.schoolResolution?{school_resolution:p.schoolResolution}:{})},p_rows:p.rows
    });
    setBusy(btn,false);
    if(res.error){toast(res.error.message,"error");return;}
    const x=res.data||{};
    toast("นำเข้า LEC สำเร็จ: "+(x.imported_rows||0)+" รายการ","success");
    state.lecPreview=null;await loadAdminSchools();renderTenants();renderRoute();
  });
}

function placeholderHtml(route){
  const meta=routeMeta[route]||routeMeta.overview;
  const phase={personnel:"Phase 2",students:"Phase 2",academics:"Phase 3",assessment:"Phase 4",documents:"Phase 1–5",website:"Phase 5",forms:"Phase 5",reports:"Phase 7"}[route]||"Roadmap";
  return '<section class="placeholder-page"><span class="placeholder-icon">◫</span><p class="eyebrow">'+phase+'</p><h2>'+esc(meta[0])+'</h2><p>'+esc(meta[1])+'<br>โมดูลนี้จะเริ่มหลังข้อมูลต้นทางที่จำเป็นก่อนหน้าพร้อม เพื่อไม่สร้างข้อมูลซ้ำหรือความสัมพันธ์ที่ต้องรื้อภายหลัง</p><a class="primary-btn" href="#/overview">กลับหน้าภาพรวม</a></section>';
}

function bindOrganizationForms(){
  const orgForm=q("#organization-form");
  if(orgForm)orgForm.addEventListener("submit",async e=>{
    e.preventDefault();const fd=new FormData(orgForm),btn=orgForm.querySelector("button[type=submit]");
    setBusy(btn,true,"กำลังบันทึก...");
    const payload={name_th:String(fd.get("name_th")).trim(),name_en:String(fd.get("name_en")||"").trim()||null,code:String(fd.get("code")||"").trim()||null,organization_type:String(fd.get("organization_type"))};
    const res=await supabase.from("lao_organizations").insert(payload);
    setBusy(btn,false);if(res.error){toast(res.error.message,"error");return;}
    toast("เพิ่ม อปท. แล้ว","success");await loadOrganizations();renderRoute();
  });
  const schoolForm=q("#school-form");
  if(schoolForm)schoolForm.addEventListener("submit",async e=>{
    e.preventDefault();const fd=new FormData(schoolForm),btn=schoolForm.querySelector("button[type=submit]");
    const slug=String(fd.get("slug")).trim().toLowerCase();
    if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)){toast("Slug ใช้ได้เฉพาะ a-z, 0-9 และขีดกลาง","error");return;}
    setBusy(btn,true,"กำลังสร้างพื้นที่...");
    const payload={organization_id:fd.get("organization_id"),name_th:String(fd.get("name_th")).trim(),slug:slug};
    const res=await supabase.from("lao_schools").insert(payload);
    setBusy(btn,false);if(res.error){toast(res.error.message,"error");return;}
    toast("สร้างพื้นที่สถานศึกษาแล้ว ขั้นต่อไปคืออนุมัติ School Admin คนแรกและนำเข้า LEC","success");
    await loadAdminSchools();renderTenants();renderRoute();
  });
  qa("[data-school-lec]").forEach(btn=>btn.addEventListener("click",()=>{
    if(state.isPlatformAdmin){
      state.adminSchool=state.adminSchools.find(s=>s.id===btn.dataset.schoolLec)||null;
      if(state.adminSchool)localStorage.setItem("lao_admin_school",state.adminSchool.id);
      renderTenants();
    }
    location.hash="#/lec";
  }));
}

function readFunctionError(error){
  if(error&&error.context&&typeof error.context.json==="function"){
    return error.context.json().then(x=>x&&x.error?x.error:error.message).catch(()=>error.message);
  }
  return Promise.resolve(error&&error.message||"ไม่สามารถดำเนินการได้");
}
function bindInvites(){
  const form=q("#invite-user-form"); if(!form)return;
  form.addEventListener("submit",async e=>{
    e.preventDefault();
    const school=currentSchool(),fd=new FormData(form),btn=form.querySelector("button[type=submit]");
    if(!school)return;
    setBusy(btn,true,"กำลังส่งอีเมล...");
    const res=await supabase.functions.invoke("lao-invite-user",{body:{
      email:String(fd.get("email")||"").trim(),
      school_id:school.id,
      role_code:String(fd.get("role_code")||"")
    }});
    setBusy(btn,false);
    if(res.error){toast(await readFunctionError(res.error),"error");return;}
    toast("ส่งคำเชิญไปที่ "+String(fd.get("email"))+" แล้ว","success");
    form.reset();renderRoute();
  });
}
function bindActivation(){
  const form=q("#activation-form"); if(!form)return;
  bindPasswordToggles(form);
  form.addEventListener("submit",async e=>{
    e.preventDefault();
    const fd=new FormData(form),btn=form.querySelector("button[type=submit]");
    const password=String(fd.get("password")||""),confirmPassword=String(fd.get("confirm_password")||"");
    const mustSet=!state.memberships.some(m=>m.status==="active");
    if(mustSet&&!password){toast("กรุณากำหนดรหัสผ่านใหม่","error");return;}
    if(password&&password.length<8){toast("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร","error");return;}
    if(password!==confirmPassword){toast("รหัสผ่านทั้งสองช่องไม่ตรงกัน","error");return;}
    setBusy(btn,true,"กำลังเปิดใช้งานบัญชี...");
    const prefix=String(fd.get("prefix")||"").trim(),first=String(fd.get("first_name")||"").trim(),last=String(fd.get("last_name")||"").trim(),phone=String(fd.get("phone")||"").trim();
    if(password){
      const authRes=await supabase.auth.updateUser({password,data:{prefix,first_name_th:first,last_name_th:last,display_name:[prefix,first,last].filter(Boolean).join(" "),phone}});
      if(authRes.error){setBusy(btn,false);toast(authMessage(authRes.error.message),"error");return;}
    }
    const complete=await supabase.rpc("lao_complete_invitation",{p_prefix:prefix||null,p_first_name_th:first,p_last_name_th:last,p_phone:phone||null});
    if(complete.error){setBusy(btn,false);toast(complete.error.message,"error");return;}
    toast("เปิดใช้งานบัญชีเรียบร้อย","success");
    await loadContext();location.hash="#/overview";renderRoute();
  });
}
function bindProfile(){
  const form=q("#profile-form"); if(!form)return;
  bindPasswordToggles(form);
  form.addEventListener("submit",async e=>{
    e.preventDefault();
    const fd=new FormData(form),btn=form.querySelector("button[type=submit]");
    const password=String(fd.get("password")||""),confirmPassword=String(fd.get("confirm_password")||"");
    if(password&&password.length<8){toast("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร","error");return;}
    if(password!==confirmPassword){toast("รหัสผ่านทั้งสองช่องไม่ตรงกัน","error");return;}
    const prefix=String(fd.get("prefix")||"").trim(),first=String(fd.get("first_name")||"").trim(),last=String(fd.get("last_name")||"").trim(),phone=String(fd.get("phone")||"").trim();
    setBusy(btn,true,"กำลังบันทึก...");
    const pr=await supabase.rpc("lao_ensure_profile",{p_prefix:prefix||null,p_first_name_th:first,p_last_name_th:last,p_display_name:[prefix,first,last].filter(Boolean).join(" "),p_phone:phone||null});
    if(pr.error){setBusy(btn,false);toast(pr.error.message,"error");return;}
    const update={data:{prefix,first_name_th:first,last_name_th:last,display_name:[prefix,first,last].filter(Boolean).join(" "),phone}};
    if(password)update.password=password;
    const au=await supabase.auth.updateUser(update);
    setBusy(btn,false);
    if(au.error){toast(authMessage(au.error.message),"error");return;}
    await loadContext();toast("บันทึกโปรไฟล์แล้ว","success");renderRoute();
  });
}
function bindNotifications(){
  qa("[data-notification-read]").forEach(btn=>btn.addEventListener("click",async()=>{
    setBusy(btn,true,"กำลังบันทึก...");
    const res=await supabase.from("lao_notifications").update({read_at:new Date().toISOString()}).eq("id",btn.dataset.notificationRead).eq("user_id",state.user.id);
    if(res.error){setBusy(btn,false);toast(res.error.message,"error");return;}
    await loadNotifications();refreshHeader();renderRoute();
  }));
}

async function renderRoute(){
  if(!state.user)return;
  let route=routeName();
  const mustActivate=Boolean(state.pendingInvitation);
  if(mustActivate&&route!=="activate"){location.hash="#/activate";route="activate";}
  const meta=routeMeta[route]||routeMeta.overview,main=q("#main");
  q("[data-page-title]").textContent=meta[0];
  qa("[data-route]").forEach(a=>a.classList.toggle("active",a.dataset.route===route));
  main.innerHTML='<section class="panel"><div class="loading-inline"><span class="spinner"></span>กำลังโหลด...</div></section>';
  try{
    if(route==="overview")main.innerHTML=(state.isPlatformAdmin&&state.viewMode==="admin")?adminOverviewHtml():overviewHtml();
    else if(route==="membership"){main.innerHTML=membershipHtml();}
    else if(route==="activate"){main.innerHTML=activationHtml();bindActivation();}
    else if(route==="profile"){main.innerHTML=profileHtml();bindProfile();}
    else if(route==="notifications"){main.innerHTML=notificationsHtml();bindNotifications();}
    else if(route==="setup"){main.innerHTML=setupHtml();}
    else if(route==="organization"){main.innerHTML=await organizationHtml();bindOrganizationForms();}
    else if(route==="lec"){main.innerHTML=await lecHtml();bindLec();}
    else if(route==="users"){main.innerHTML=await usersHtml();bindInvites();}
    else main.innerHTML=placeholderHtml(route);
  }catch(e){
    console.error(e);
    main.innerHTML='<section class="panel"><div class="notice danger"><strong>โหลดข้อมูลไม่สำเร็จ</strong><br>'+esc(e.message||e)+'</div></section>';
  }
}
async function showApp(session){
  state.session=session;state.user=session.user;
  q("#auth-screen").classList.add("hidden");q("#app-shell").classList.remove("hidden");
  try{await loadContext();if(!location.hash)location.hash=state.pendingInvitation?"#/activate":"#/overview";await renderRoute();}
  catch(e){
    console.error(e);
    if(e&&e.message==="LAO_ACCESS_REQUIRED"){
      localStorage.setItem("lao_legacy_session_rejected","1");
      sessionStorage.setItem("lao_access_denied_notice","1");
      clearLaoAuthSession();
      location.reload();
      return;
    }
    toast("โหลดข้อมูลผู้ใช้ไม่สำเร็จ: "+e.message,"error");
  }
}
function showAuth(){q("#app-shell").classList.add("hidden");q("#auth-screen").classList.remove("hidden");}

async function init(){
  bindStaticUI();
  const savedEmail=localStorage.getItem("lao_saved_email");
  const remember=localStorage.getItem("lao_remember_login")==="1";
  const signInForm=q("#signin-form");
  if(signInForm){
    signInForm.elements.email.value=savedEmail||"";
    signInForm.elements.remember_login.checked=remember;
  }
  const res=await supabase.auth.getSession();
  q("#boot-screen").classList.add("hidden");
  if(res.data.session)await showApp(res.data.session);else{
    showAuth();
    if(sessionStorage.getItem("lao_access_denied_notice")==="1"){
      sessionStorage.removeItem("lao_access_denied_notice");
      toast("บัญชีนี้ยังไม่ได้รับคำเชิญจากผู้ดูแล LAO-EMS","error");
    }
  }
  supabase.auth.onAuthStateChange(async(event,session)=>{
    if(event==="SIGNED_OUT"||!session){state.session=state.user=state.profile=state.currentMembership=null;state.memberships=[];showAuth();return;}
    if(event==="SIGNED_IN")await showApp(session);
  });
}
init();
