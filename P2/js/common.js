export const ACTIVITIES = Object.freeze([
  { key: "rhythm", icon: "🎵", title: "เพลง มาตรา ก กา", short: "เพลง มาตรา", minutes: 10 },
  { key: "wheel", icon: "🎡", title: "วงล้อเสี่ยงทาย", short: "วงล้อ", minutes: 10 },
  { key: "sound", icon: "🔊", title: "นักสืบเสียงท้ายคำ", short: "นักสืบเสียง", minutes: 7 },
  { key: "sort", icon: "🏠", title: "จัดบ้านให้คำ", short: "จัดบ้าน", minutes: 7 },
  { key: "train", icon: "🚂", title: "รถไฟประโยคแม่ ก กา", short: "รถไฟประโยค", minutes: 6 },
  { key: "vote", icon: "💗", title: "บอร์ดโหวตประโยคฮิต", short: "บอร์ดโหวต", minutes: 10 },
  { key: "exit", icon: "🗝️", title: "ไขกุญแจหีบสมบัติ", short: "แบบทดสอบท้ายคาบ", minutes: 10 },
]);

const freezeActivitySet = activities => Object.freeze(activities.map(activity => Object.freeze(activity)));

export const PLAN_ACTIVITIES = Object.freeze({
  1: ACTIVITIES,
  2: freezeActivitySet([
    { key: "mae-kong-box", icon: "📦", title: "กล่องคำแม่กง", short: "กล่องคำ", minutes: 12 },
    { key: "mae-kong-rocket", icon: "🚀", title: "จรวดประโยคแม่กง", short: "จรวดประโยค", minutes: 12 },
    { key: "mae-kong-exit", icon: "🗝️", title: "ด่านดาวพิชิตแม่กง", short: "แบบทดสอบท้ายคาบ", minutes: 8 },
  ]),
  3: freezeActivitySet([
    { key: "mae-kom-box", icon: "📦", title: "กล่องคำแม่กม", short: "กล่องคำ", minutes: 12 },
    { key: "picture-word", icon: "🖼️", title: "ภาพนี้คำอะไร", short: "ทายคำจากภาพ", minutes: 12 },
    { key: "mae-kom-exit", icon: "🗝️", title: "ด่านพิชิตแม่กม", short: "แบบทดสอบท้ายคาบ", minutes: 8 },
  ]),
  4: freezeActivitySet([
    { key: "yw-sort", icon: "👯", title: "คู่หู ย–ว", short: "แยกแม่เกย–เกอว", minutes: 12 },
    { key: "picture-choice", icon: "🖼️", title: "เลือกคำให้ใช่", short: "เลือกจากภาพ", minutes: 12 },
    { key: "exit", icon: "🗝️", title: "ด่านคู่หู ย–ว", short: "แบบทดสอบท้ายคาบ", minutes: 8 },
  ]),
  5: freezeActivitySet([
    { key: "cave-door", icon: "🗝️", title: "เปิดประตูถ้ำแม่กก", short: "ประตูถ้ำ", minutes: 12 },
    { key: "true-false", icon: "🧩", title: "จริงหรือไม่ แม่กก", short: "จริงหรือไม่", minutes: 12 },
    { key: "exit", icon: "🏆", title: "ด่านพิชิตแม่กก", short: "แบบทดสอบท้ายคาบ", minutes: 8 },
  ]),
  6: freezeActivitySet([
    { key: "treasure-hunt", icon: "💎", title: "ล่าสมบัติแม่กด", short: "ล่าสมบัติ", minutes: 12 },
    { key: "true-false", icon: "🧩", title: "ถอดรหัสแม่กด", short: "ถอดรหัส", minutes: 12 },
    { key: "exit", icon: "🏆", title: "ด่านพิชิตแม่กด", short: "แบบทดสอบท้ายคาบ", minutes: 8 },
  ]),
  7: freezeActivitySet([
    { key: "island-supply", icon: "🏝️", title: "เก็บเสบียงแม่กบ", short: "เก็บเสบียง", minutes: 12 },
    { key: "true-false", icon: "🧩", title: "ปริศนาชาวเกาะแม่กบ", short: "ปริศนาชาวเกาะ", minutes: 12 },
    { key: "exit", icon: "🏆", title: "ด่านพิชิตแม่กบ", short: "แบบทดสอบท้ายคาบ", minutes: 8 },
  ]),
  8: freezeActivitySet([
    { key: "space-fuel", icon: "🚀", title: "เติมเชื้อเพลิงแม่กน", short: "เติมเชื้อเพลิง", minutes: 12 },
    { key: "true-false", icon: "🧩", title: "รหัสลับต่างดาวแม่กน", short: "รหัสลับ", minutes: 12 },
    { key: "exit", icon: "🏆", title: "ด่านพิชิตแม่กน", short: "แบบทดสอบท้ายคาบ", minutes: 8 },
  ]),
});

const freezeLessonFlow = steps => Object.freeze(steps.map(step => Object.freeze({
  ...step,
  teacherNotes: Object.freeze([...(step.teacherNotes || [])]),
  screen: Object.freeze({
    ...(step.screen || {}),
    bullets: Object.freeze([...(step.screen?.bullets || [])]),
    cards: Object.freeze([...(step.screen?.cards || [])].map(card => Object.freeze({ ...card }))),
  }),
})));

const PLAN_1_LESSON_FLOW = freezeLessonFlow([
  {
    key: "p1-song",
    stage: 1,
    kind: "game",
    activityKey: "rhythm",
    icon: "🎵",
    title: "เพลงมาตราแม่ ก กา",
    minutes: 4,
    studentVisibleDefault: true,
    teacherNotes: [
      "ให้นักเรียนร้องตามและสังเกตคำที่เปล่งแสง",
      "ย้ำคำเป้าหมาย: เต่า วัว เสือ หมี งู ไก่ กา ปลาโลมา ม้า ลา จระเข้",
      "ช่วงเกมให้นักเรียนแตะคำ เลือกคำแม่ ก กา และเติมคำที่หายไป",
    ],
    screen: {
      eyebrow: "ขั้นที่ 1 · กระตุ้นความสนใจ",
      title: "ร้องเพลงมาตราแม่ ก กา",
      message: "ร้องตาม สังเกตคำที่เปล่งแสง และเล่นภารกิจให้ตรงจังหวะ",
      icon: "🎤",
      bullets: ["คำเหล่านี้มีอะไรเหมือนกัน?", "ตั้งใจฟังเสียงท้ายคำ"],
    },
  },
  {
    key: "p1-song-reflect",
    stage: 1,
    kind: "media",
    icon: "💭",
    title: "คำถามกระตุ้นคิดหลังเพลง",
    minutes: 1,
    studentVisibleDefault: false,
    teacherNotes: [
      "ถามนักเรียนทั้งห้องและเปิดโอกาสให้ตอบอย่างอิสระ",
      "ยังไม่เฉลยทันที ให้รับฟังเหตุผลของนักเรียน 2-3 คน",
      "คำตอบที่ต้องนำไปสู่ข้อสรุป: ไม่มีเสียงพยัญชนะท้ายคำ",
    ],
    screen: {
      eyebrow: "ชวนคิดหลังจบเพลง",
      title: "คำในเพลงที่เราร้องกัน",
      message: "มีจุดเด่นอะไรที่เหมือนกัน?",
      icon: "🤔",
      bullets: ["ลองออกเสียงคำว่า กา เต่า หมี และม้า", "ฟังเสียงท้ายคำให้ดี"],
    },
  },
  {
    key: "p1-flashcards",
    stage: 2,
    kind: "media",
    icon: "🪪",
    title: "บัตรคำ: คำไหนไม่มีตัวสะกด",
    minutes: 3,
    studentVisibleDefault: false,
    teacherNotes: [
      "ให้นักเรียนอ่านออกเสียงพร้อมกันทีละคำ",
      "ชี้พยัญชนะต้น สระ ตัวสะกด และวรรณยุกต์",
      "คำว่า ใบไม้ ให้แยกดูทีละพยางค์: ใบ มี บ สะกด ส่วน ไม้ ไม่มีตัวสะกด",
    ],
    screen: {
      eyebrow: "ขั้นที่ 2 · สังเกตและเปรียบเทียบ",
      title: "คำไหนไม่มีตัวสะกด?",
      message: "อ่านออกเสียง แล้วสังเกตเสียงท้ายคำ",
      icon: "🔎",
      cards: [
        { word: "ขา", detail: "ข + -า · ไม่มีตัวสะกด" },
        { word: "ปี", detail: "ป + -ี · ไม่มีตัวสะกด" },
        { word: "ดง", detail: "ด + โ-ะ + ง" },
        { word: "โง่", detail: "ง + โ- · ไม่มีตัวสะกด" },
        { word: "แพ", detail: "พ + แ- · ไม่มีตัวสะกด" },
        { word: "ลิง", detail: "ล + -ิ + ง" },
        { word: "ชี้", detail: "ช + -ี · ไม่มีตัวสะกด" },
        { word: "ถ้ำ", detail: "ถ + -ำ · ไม่มีตัวสะกด" },
        { word: "ยาย", detail: "ย + -า + ย" },
        { word: "ใบไม้", detail: "ใบ มี บ สะกด · ไม้ ไม่มีตัวสะกด" },
      ],
    },
  },
  {
    key: "p1-rule-demo",
    stage: 2,
    kind: "media",
    icon: "🧠",
    title: "สรุปหลักและสาธิตเกม",
    minutes: 2,
    studentVisibleDefault: false,
    teacherNotes: [
      "ออกเสียงตัวอย่าง: ขอ-อา-ขา ไม่มีเสียงพยัญชนะท้ายคำ",
      "เปรียบเทียบ: ดง มี ง เป็นตัวสะกด จึงไม่ใช่แม่ ก กา",
      "สาธิตการลากคำเข้าบ้านที่ถูกต้อง 1 รอบก่อนเริ่มเกม",
    ],
    screen: {
      eyebrow: "ข้อสรุปสำคัญ",
      title: "มาตราแม่ ก กา",
      message: "คือคำที่ไม่มีพยัญชนะเป็นตัวสะกด",
      icon: "🏡",
      bullets: ["ไม่มีเสียงพยัญชนะท้ายคำ", "อ่านให้ชัด แล้วสังเกตส่วนประกอบของคำ"],
    },
  },
  {
    key: "p1-sort",
    stage: 3,
    kind: "game",
    activityKey: "sort",
    icon: "🏠",
    title: "ด่านที่ 1 · จัดบ้านให้คำศัพท์",
    minutes: 10,
    studentVisibleDefault: true,
    teacherNotes: [
      "ให้นักเรียนจำแนกคำ 20 คำลงบ้าน 2 หลัง",
      "สังเกตนักเรียนที่ยังแยกคำมีตัวสะกดไม่ได้และให้คำแนะนำรายบุคคล",
      "นาฬิกาเป็นเพียงตัวช่วยกำกับเวลา ครูเป็นผู้กดไปขั้นถัดไป",
    ],
    screen: {
      eyebrow: "ขั้นที่ 3 · เกมที่ 1",
      title: "จัดบ้านให้คำศัพท์",
      message: "แยกคำลงบ้านแม่ ก กา และบ้านคำที่มีตัวสะกด",
      icon: "🏠",
      bullets: ["อ่านคำก่อนทุกครั้ง", "ตรวจเสียงท้ายคำ แล้วจึงเลือกบ้าน"],
    },
  },
  {
    key: "p1-train",
    stage: 3,
    kind: "game",
    activityKey: "train",
    icon: "🚂",
    title: "ด่านที่ 2 · รถไฟประโยคแม่ ก กา",
    minutes: 14,
    studentVisibleDefault: true,
    teacherNotes: [
      "ให้นักเรียนเรียงคำเป็นประโยค 10 ข้อจากง่ายไปยาก",
      "ย้ำให้อ่านประโยคที่เรียงเสร็จแล้วก่อนกดตรวจ",
      "ติดตามผลจากหน้าครูและช่วยนักเรียนที่ติดอยู่ในข้อเดิมนานเกินไป",
    ],
    screen: {
      eyebrow: "ขั้นที่ 3 · เกมที่ 2",
      title: "รถไฟประโยคแม่ ก กา",
      message: "แตะโบกี้ตามลำดับให้เป็นประโยคที่ถูกต้อง",
      icon: "🚂",
      bullets: ["เรียงคำให้สื่อความหมาย", "อ่านทบทวนก่อนกดตรวจคำตอบ"],
    },
  },
  {
    key: "p1-score-check",
    stage: 3,
    kind: "media",
    icon: "🏆",
    title: "ตรวจคะแนนและช่วยเหลือรายบุคคล",
    minutes: 1,
    studentVisibleDefault: false,
    showLeaderboard: true,
    teacherNotes: [
      "ฉายกระดานคะแนนเพื่อสร้างแรงจูงใจ",
      "ดูรายชื่อนักเรียนที่ยังไม่ส่งคำตอบหรือคะแนนต่ำกว่าเกณฑ์",
      "ให้คำแนะนำสั้น ๆ รายบุคคลก่อนเข้าสู่กิจกรรมกลุ่ม",
    ],
    screen: {
      eyebrow: "พักตรวจความก้าวหน้า",
      title: "นักผจญภัยกำลังไปได้ดี!",
      message: "ครูกำลังตรวจผลและช่วยเพื่อนที่ต้องการคำแนะนำ",
      icon: "🏆",
      bullets: ["ปรบมือให้ความพยายามของทุกคน", "เตรียมเข้าสู่กิจกรรมกลุ่ม"],
    },
  },
  {
    key: "p1-gallery-brief",
    stage: 4,
    kind: "media",
    icon: "📝",
    title: "คำชี้แจงแกลเลอรี่ประโยคแม่ ก กา",
    minutes: 2,
    studentVisibleDefault: false,
    teacherNotes: [
      "แบ่งกลุ่มละ 3-4 คน แจกกระดาษ A4 และปากกาเมจิก",
      "แต่ละกลุ่มเลือกคำแม่ ก กา 1 คำจากเกม แล้วแต่งประโยคใหม่",
      "ย้ำให้เขียนตัวบรรจงและตรวจความหมายก่อนติดผลงาน",
    ],
    screen: {
      eyebrow: "ขั้นที่ 4 · กิจกรรมกลุ่ม",
      title: "แกลเลอรี่ประโยคแม่ ก กา",
      message: "เลือก 1 คำที่กลุ่มชอบ แล้วช่วยกันแต่งประโยคใหม่",
      icon: "🖍️",
      bullets: ["กลุ่มละ 3-4 คน", "เขียนประโยคลงกระดาษ A4", "ตรวจคำและความหมายให้ถูกต้อง"],
    },
  },
  {
    key: "p1-gallery-compose",
    stage: 4,
    kind: "media",
    icon: "✍️",
    title: "กลุ่มช่วยกันแต่งประโยค",
    minutes: 6,
    studentVisibleDefault: false,
    teacherNotes: [
      "เดินดูทุกกลุ่ม กระตุ้นให้สมาชิกทุกคนมีส่วนร่วม",
      "ตรวจว่าประโยคสมบูรณ์ สื่อความหมาย และใช้คำแม่ ก กา ตามโจทย์",
      "นาฬิกาหมดเวลาแล้วไม่เปลี่ยนหน้า ครูพิจารณาความพร้อมของห้อง",
    ],
    screen: {
      eyebrow: "ลงมือทำงานกลุ่ม",
      title: "ช่วยกันคิด ช่วยกันเขียน",
      message: "สร้างประโยคแม่ ก กา ของกลุ่มให้สมบูรณ์",
      icon: "✍️",
      bullets: ["ทุกคนเสนอความคิด", "อ่านตรวจประโยคก่อนนำไปติด"],
    },
  },
  {
    key: "p1-gallery-walk",
    stage: 4,
    kind: "media",
    icon: "⭐",
    title: "Gallery Walk และนำเสนอผลงาน",
    minutes: 7,
    studentVisibleDefault: false,
    teacherNotes: [
      "ให้นักเรียนเดินชมผลงานและแปะสติกเกอร์ดาวให้ประโยคที่ชอบ",
      "ตัวแทนแต่ละกลุ่มอ่านประโยคของกลุ่มให้เพื่อนฟัง",
      "ครูแก้ไขคำหรือประโยคที่ผิดทันทีด้วยถ้อยคำเชิงบวก",
    ],
    screen: {
      eyebrow: "เดินชมแกลเลอรี่",
      title: "อ่าน ฟัง และให้ดาว",
      message: "ชมผลงานเพื่อน แล้วเลือกประโยคที่ชอบที่สุด",
      icon: "🌟",
      bullets: ["เดินอย่างเป็นระเบียบ", "อ่านประโยคของทุกกลุ่ม", "แปะดาวให้ผลงานที่ชอบ"],
    },
  },
  {
    key: "p1-review-song",
    stage: 5,
    kind: "game",
    activityKey: "rhythm",
    icon: "🎶",
    title: "ร้องเพลงทบทวนอีกครั้ง",
    minutes: 3,
    studentVisibleDefault: true,
    teacherNotes: [
      "ร้องพร้อมกันอีกครั้งเพื่อทบทวนก่อนประเมิน",
      "ให้นักเรียนพูดข้อสรุปตามครู: แม่ ก กา คือคำที่ไม่มีตัวสะกด",
    ],
    screen: {
      eyebrow: "ขั้นที่ 5 · ทบทวน",
      title: "ร้องเพลงแม่ ก กา อีกครั้ง",
      message: "ร้องให้เต็มเสียง แล้วจำหลักสำคัญให้ได้",
      icon: "🎶",
      bullets: ["แม่ ก กา ไม่มีตัวสะกด"],
    },
  },
  {
    key: "p1-summary",
    stage: 5,
    kind: "media",
    icon: "💡",
    title: "สรุปความรู้ร่วมกัน",
    minutes: 1,
    studentVisibleDefault: false,
    teacherNotes: [
      "ให้นักเรียนช่วยกันบอกลักษณะของแม่ ก กา",
      "เชื่อมโยงว่าเราสามารถนำคำมาเรียงเป็นประโยคสื่อความหมายได้",
    ],
    screen: {
      eyebrow: "จำให้แม่น",
      title: "มาตราแม่ ก กา",
      message: "คำที่ไม่มีตัวสะกด และนำมาเรียงเป็นประโยคได้",
      icon: "💡",
      bullets: ["อ่านออกเสียง", "สังเกตตัวสะกด", "นำคำไปใช้ในประโยค"],
    },
  },
  {
    key: "p1-exit",
    stage: 5,
    kind: "game",
    activityKey: "exit",
    icon: "🗝️",
    title: "แบบทดสอบท้ายบทเรียน",
    minutes: 5,
    studentVisibleDefault: true,
    teacherNotes: [
      "ให้นักเรียนทำ Exit Ticket บนอุปกรณ์ของตนเอง",
      "ใช้ผลบนหน้าครูตรวจความเข้าใจด้านความรู้เรื่องลักษณะคำแม่ ก กา",
      "นาฬิกาเป็นเพียงเวลาที่แนะนำ นักเรียนยังทำต่อได้จนกว่าครูจะเปลี่ยนขั้น",
    ],
    screen: {
      eyebrow: "ประเมินความเข้าใจ",
      title: "ไขกุญแจหีบสมบัติ",
      message: "อ่านคำถามให้ครบ แล้วเลือกคำตอบที่ถูกต้อง",
      icon: "🗝️",
      bullets: ["คิดก่อนตอบ", "ตรวจคำตอบของตนเองทุกข้อ"],
    },
  },
  {
    key: "p1-worksheet",
    stage: 5,
    kind: "media",
    icon: "📄",
    title: "มอบหมายใบงานที่ 1",
    minutes: 1,
    studentVisibleDefault: false,
    teacherNotes: [
      "แจกใบงานที่ 1 เรื่องมาตราแม่ ก กา",
      "แจ้งให้นักเรียนทำเพื่อทบทวนการจำแนกคำและการแต่งประโยค",
      "แจ้งกำหนดส่งก่อนจบคาบ",
    ],
    screen: {
      eyebrow: "ภารกิจทบทวน",
      title: "ใบงานที่ 1 · มาตราแม่ ก กา",
      message: "รับใบงาน ตรวจชื่อ และฟังกำหนดส่งจากคุณครู",
      icon: "📄",
      bullets: ["จำแนกคำ", "วงกลมคำแม่ ก กา", "เรียงคำเป็นประโยค"],
    },
  },
]);

export const PLAN_LESSON_FLOWS = Object.freeze({
  1: PLAN_1_LESSON_FLOW,
});

export function lessonFlowForPlan(planId = 1) {
  const flow = PLAN_LESSON_FLOWS[Number(planId)];
  if (flow) return flow;
  return freezeLessonFlow(activitiesForPlan(planId).map((activity, index) => ({
    key: `plan-${Number(planId)}-${activity.key}`,
    stage: index + 1,
    kind: "game",
    activityKey: activity.key,
    icon: activity.icon,
    title: activity.title,
    minutes: activity.minutes,
    studentVisibleDefault: true,
    teacherNotes: [`เปิด ${activity.title} และติดตามผลจากหน้าควบคุมครู`],
    screen: {
      eyebrow: `กิจกรรมที่ ${index + 1}`,
      title: activity.title,
      message: "ฟังคำชี้แจงจากคุณครู แล้วเริ่มทำกิจกรรม",
      icon: activity.icon,
    },
  })));
}

export function lessonStepForKey(stepKey, planId = 1) {
  return lessonFlowForPlan(planId).find(step => step.key === stepKey) || null;
}

export function activitiesForPlan(planId = 1) {
  return PLAN_ACTIVITIES[Number(planId)] || ACTIVITIES;
}

export function activityForKey(activityKey, planId) {
  const planActivities = activitiesForPlan(planId);
  return planActivities.find(activity => activity.key === activityKey)
    || Object.values(PLAN_ACTIVITIES).flat().find(activity => activity.key === activityKey)
    || null;
}

export const PLAN_TITLES = Object.freeze([
  "รู้จักมาตราตัวสะกดและแม่ ก กา",
  "มาตราแม่กง",
  "มาตราแม่กม",
  "มาตราแม่เกยและแม่เกอว",
  "มาตราแม่กก",
  "มาตราแม่กด",
  "มาตราแม่กบ",
  "มาตราแม่กน",
]);

export const AVATARS = ["⭐", "🦉", "🐯", "🐳", "🐰", "🦊", "🐼", "🦁", "🐸", "🐙", "🦋", "🚀"];

export const GAME_STATE_EVENT = "game-state";
export const GAME_STATE_REQUEST_EVENT = "game-state-request";
// Expert sessions intentionally keep scores out of the database. These events
// carry only the in-memory, live scoreboard for the current class session.
export const EXPERT_SCORE_EVENT = "expert-live-score";
export const EXPERT_SCOREBOARD_EVENT = "expert-live-scoreboard";
export const EXPERT_SCOREBOARD_REQUEST_EVENT = "expert-live-scoreboard-request";

export function gameStateChannelName(sessionId) {
  return `game-session-${sessionId}`;
}

export function gameStatePayload(session, reason = "state-change", extras = {}) {
  return {
    event_id: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`,
    issued_at: Date.now(),
    reason,
    session,
    ...extras,
  };
}

const MIRROR_TAGS = new Set(["SECTION", "HEADER", "DIV", "SPAN", "SMALL", "STRONG", "H1", "H2", "H3", "H4", "P", "BUTTON", "UL", "OL", "LI", "MARK", "I", "B", "LABEL", "OUTPUT"]);
const MIRROR_STYLE_PROPERTIES = ["width", "height", "transform", "text-align", "margin", "margin-top", "margin-right", "margin-bottom", "margin-left", "left", "top", "opacity", "animation-duration"];
const MIRROR_CLASS_PATTERN = /^[a-zA-Z][a-zA-Z0-9_-]{0,60}$/;
const MIRROR_CUSTOM_PROPERTY_PATTERN = /^--[a-zA-Z][a-zA-Z0-9-]{0,48}$/;

function sanitizeMirrorStyle(element, rawStyle) {
  const probe = document.createElement("span");
  probe.style.cssText = String(rawStyle || "").slice(0, 700);
  element.removeAttribute("style");
  const properties = new Set(MIRROR_STYLE_PROPERTIES);
  for (let index = 0; index < probe.style.length; index += 1) {
    const property = probe.style[index];
    if (MIRROR_CUSTOM_PROPERTY_PATTERN.test(property)) properties.add(property);
  }
  properties.forEach(property => {
    const value = probe.style.getPropertyValue(property).trim();
    if (value && value.length <= 90 && !/url\s*\(|expression\s*\(/i.test(value)) element.style.setProperty(property, value);
  });
}

export function sanitizeGameMarkup(markup) {
  if (typeof markup !== "string" || !markup || markup.length > 48000) return "";
  const template = document.createElement("template");
  template.innerHTML = markup;
  [...template.content.querySelectorAll("*")].forEach(element => {
    if (!MIRROR_TAGS.has(element.tagName)) {
      element.remove();
      return;
    }
    const rawStyle = element.getAttribute("style");
    [...element.attributes].forEach(attribute => {
      const name = attribute.name.toLowerCase();
      const keep = name === "class" || name === "style" || name === "disabled" || name === "hidden" || name === "aria-hidden" || /^data-[a-z0-9-]{1,40}$/.test(name);
      if (!keep) element.removeAttribute(attribute.name);
    });
    if (element.hasAttribute("class")) {
      // Script/event attributes are removed and controls are disabled. Keeping
      // safe CSS classes lets every current and future game retain its visual
      // design without a fragile per-game class allow-list.
      const safeClasses = element.className.split(/\s+/).filter(name => MIRROR_CLASS_PATTERN.test(name)).slice(0, 30);
      if (safeClasses.length) element.className = safeClasses.join(" ");
      else element.removeAttribute("class");
    }
    if (rawStyle) sanitizeMirrorStyle(element, rawStyle);
    if (element.matches("button")) element.setAttribute("disabled", "");
  });
  return template.innerHTML;
}

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

export function show(element) { element?.classList.remove("hidden"); }
export function hide(element) { element?.classList.add("hidden"); }

export function setView(active, ...others) {
  show(active);
  others.forEach(hide);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

export function escapeHtml(value = "") {
  return String(value).replace(/[&<>'"]/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[character]);
}

export function formatClass(classroom) {
  if (!classroom) return "—";
  return classroom.label || `ป.${classroom.grade}/${classroom.room_no}`;
}

export function randomAvatar(seed = "") {
  const total = [...seed].reduce((sum, character) => sum + character.charCodeAt(0), 0);
  return AVATARS[total % AVATARS.length];
}

export function debounce(callback, wait = 250) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => callback(...args), wait);
  };
}

let toastTimer;
let legacyThaiByteMap;

function repairThaiMojibake(text) {
  try {
    const legacyDecoder = new TextDecoder("windows-874");
    if (!legacyThaiByteMap) {
      legacyThaiByteMap = new Map();
      for (let byte = 0; byte < 256; byte += 1) {
        const character = legacyDecoder.decode(Uint8Array.of(byte));
        if (character && character !== "\ufffd") legacyThaiByteMap.set(character, byte);
      }
    }
    const bytes = [];
    for (const character of text) {
      const byte = legacyThaiByteMap.get(character);
      if (byte === undefined) return null;
      bytes.push(byte);
    }
    return new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(bytes));
  } catch {
    return null;
  }
}

function readableToastMessage(message) {
  const text = String(message || "").trim();
  if (!text) return "เกิดข้อผิดพลาด กรุณาลองใหม่";
  // Some database messages were saved after UTF-8 bytes were decoded as
  // Windows-874. Repair the original Thai message instead of hiding its cause.
  if (/(?:เน€|เน|เธฃ|เธ|เธ|เธ|เธญ|à¸|à¹|Ã|�)/.test(text)) {
    return repairThaiMojibake(text) || "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง";
  }
  return text;
}

export function toast(message, tone = "default") {
  const element = $("#toast");
  if (!element) return;
  element.textContent = readableToastMessage(message);
  element.dataset.tone = tone;
  element.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => element.classList.remove("show"), 3200);
}

export function roomCodeFromUrl() {
  return new URLSearchParams(location.search).get("room")?.replace(/\D/g, "").slice(0, 6) || "";
}

export function modeLabel(mode) {
  return ({ practice: "รอบทดลอง", real: "รอบจริง" })[mode] || "รอบทดลอง";
}

export function playerStatusLabel(status) {
  return ({ waiting: "รออนุมัติ", approved: "อนุมัติแล้ว", returned: "ส่งคืนแล้ว", removed: "นำออกแล้ว" })[status] || status;
}

export function downloadCsv(filename, rows) {
  const csv = rows.map(row => row.map(value => `"${String(value ?? "").replaceAll('"', '""')}"`).join(",")).join("\r\n");
  const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

export function shuffle(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

export function renderPlanTimeline(container, activePlan = 1) {
  if (!container) return;
  container.innerHTML = PLAN_TITLES.map((title, index) => {
    const flow = lessonFlowForPlan(index + 1);
    return `
    <article class="plan-card ${index + 1 === activePlan ? "active" : ""}">
      <span class="plan-number">${index + 1}</span>
      <span class="lock">${index + 1 === activePlan ? "กำลังใช้" : "พร้อมใช้"}</span>
      <h3>${escapeHtml(title)}</h3>
      <p>${flow.length} ขั้น · ${flow.reduce((sum, step) => sum + step.minutes, 0)} นาที</p>
    </article>
  `;
  }).join("");
}

export function updateConnectionBadge(element, online, label) {
  if (!element) return;
  element.classList.toggle("offline", !online);
  element.innerHTML = `<i></i> ${escapeHtml(label || (online ? "เชื่อมต่อแล้ว" : "ออฟไลน์"))}`;
}
