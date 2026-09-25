(() => {
const unit=Number(new URLSearchParams(location.search).get('unit'));
if(unit<4||unit>11||!Number.isInteger(unit))return;
const titles=['เจ้าเนื้ออ่อน เอย','มา เล่น กัน ไหม','ของ เธอ ของ ฉัน','ฝน ตก แดด ออก','เรา รัก เมืองไทย','ตั้งไข่ ล้ม ต้ม ไข่ กิน','แมว เหมียว','กระต่าย กับ เต่า'];
const link=document.createElement('a');link.id='pairedLiterature';link.href=`literature/?chapter=${unit-3}`;link.textContent='📖 วรรณคดีลำนำ · '+titles[unit-4];link.style.cssText='display:block;padding:12px;color:#236777;font:inherit;text-align:center;background:#f3faf6;border-radius:12px;margin:10px;';
function attach(){const menu=document.querySelector('.unit1-menu-list');if(menu&&!menu.contains(link))menu.append(link)}
attach();new MutationObserver(attach).observe(document.body,{childList:true,subtree:true});
})();
