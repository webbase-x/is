const routes = {
  overview: {
    title: "ภาพรวมระบบ",
    copy: "ภาพรวมสถาปัตยกรรมและลำดับการพัฒนาแพลตฟอร์ม LAO-EMS"
  },
  setup: {
    title: "ตั้งค่าพื้นฐาน",
    copy: "ตั้งค่าข้อมูลแกนกลางที่ทุกโมดูลต้องใช้ร่วมกัน ได้แก่ ปีการศึกษา ภาคเรียน ระดับชั้น และค่ามาตรฐาน"
  },
  organization: {
    title: "อปท. และสถานศึกษา",
    copy: "จัดการองค์กรต้นสังกัดและสถานศึกษาหลายแห่ง โดยแยกขอบเขตข้อมูลและสิทธิ์อย่างชัดเจน"
  },
  users: {
    title: "ผู้ใช้และสิทธิ์",
    copy: "ระบบลงทะเบียน การอนุมัติสมาชิก บทบาท และสิทธิ์แบบ Role + Scope"
  },
  personnel: {
    title: "บุคลากร",
    copy: "ข้อมูลบุคลากรต้นทางสำหรับภาระงาน ตารางสอน เว็บไซต์ รายงาน และงานบริหารบุคคล"
  },
  students: {
    title: "นักเรียน",
    copy: "Student master record หนึ่งชุด เชื่อมการลงทะเบียน ห้องเรียน ผู้ปกครอง ผลการเรียน และระบบดูแลช่วยเหลือ"
  },
  academics: {
    title: "วิชาการ",
    copy: "หลักสูตร ระดับชั้น ห้องเรียน รายวิชา โครงสร้างเวลาเรียน และการมอบหมายครูผู้สอน"
  },
  assessment: {
    title: "ทะเบียนและวัดผล",
    copy: "จะเปิดพัฒนาหลังข้อมูลนักเรียน หลักสูตร ห้องเรียน รายวิชา และครูผู้สอนพร้อมใช้งาน"
  },
  documents: {
    title: "เอกสารและไฟล์",
    copy: "ไฟล์จริงเก็บใน Google Drive ส่วนระบบเก็บ File ID, metadata, ความสัมพันธ์ และสิทธิ์การเข้าถึง"
  },
  website: {
    title: "เว็บไซต์สถานศึกษา",
    copy: "เว็บไซต์แต่ละโรงเรียนดึงข้อมูลสาธารณะจากฐานข้อมูลเดียวกันโดยไม่ต้องกรอกข้อมูลบุคลากรหรือสถิติซ้ำ"
  },
  forms: {
    title: "แบบฟอร์มและงาน",
    copy: "สร้างแบบประเมิน แบบสอบถาม แบบทดสอบ และภารกิจแบบยืดหยุ่น พร้อมมอบหมาย ติดตาม และประมวลผล"
  },
  reports: {
    title: "รายงานและ Dashboard",
    copy: "รายงานสร้างจากข้อมูลที่เกิดขึ้นจริงในระบบ พร้อมภาพรวมระดับโรงเรียนและระดับ อปท."
  }
};

const modules = [
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

const sidebar = document.querySelector("#sidebar");
const scrim = document.querySelector("[data-scrim]");
const titleEl = document.querySelector("[data-page-title]");
const main = document.querySelector("#main");
const originalOverview = main.innerHTML;

function openSidebar(){
  sidebar?.classList.add("open");
  scrim?.classList.add("show");
}
function closeSidebar(){
  sidebar?.classList.remove("open");
  scrim?.classList.remove("show");
}
document.querySelector("[data-sidebar-open]")?.addEventListener("click",openSidebar);
document.querySelector("[data-sidebar-close]")?.addEventListener("click",closeSidebar);
scrim?.addEventListener("click",closeSidebar);

function renderModules(){
  const grid = document.querySelector("[data-module-grid]");
  if(!grid) return;
  grid.innerHTML = modules.slice(0,8).map(([icon,title,copy,stage]) => `
    <article class="module-card">
      <div class="module-top"><span class="module-icon">${icon}</span><span class="module-stage">${stage}</span></div>
      <h3>${title}</h3><p>${copy}</p>
    </article>`
  ).join("");
}

function routeName(){
  return (location.hash.replace(/^#\//,"").split("/")[0] || "overview").toLowerCase();
}

function renderRoute(){
  const route = routeName();
  const meta = routes[route] || routes.overview;
  titleEl.textContent = meta.title;

  document.querySelectorAll("[data-route]").forEach(link => {
    link.classList.toggle("active", link.dataset.route === route);
  });

  if(route === "overview"){
    main.innerHTML = originalOverview;
    renderModules();
    document.querySelector("[data-show-roadmap]")?.addEventListener("click",() => {
      const grid = document.querySelector("[data-module-grid]");
      if(!grid) return;
      grid.innerHTML = modules.map(([icon,title,copy,stage]) => `
        <article class="module-card">
          <div class="module-top"><span class="module-icon">${icon}</span><span class="module-stage">${stage}</span></div>
          <h3>${title}</h3><p>${copy}</p>
        </article>`
      ).join("");
    });
  } else {
    const template = document.querySelector("#route-template");
    const node = template.content.cloneNode(true);
    node.querySelector("[data-placeholder-title]").textContent = meta.title;
    node.querySelector("[data-placeholder-copy]").textContent = meta.copy;
    main.replaceChildren(node);
  }
  closeSidebar();
}

window.addEventListener("hashchange",renderRoute);
renderRoute();
