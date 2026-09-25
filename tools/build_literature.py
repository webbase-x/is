"""Build exact-position vector text / artwork reader from the teacher's PDF.
Usage: python tools/build_literature.py /path/to/วรรณคดีลำนำ.pdf
No source PDF is committed. Legacy glyph encoding is retained for display only;
Unicode Thai is stored separately for accessible labels, speech and plain reading.
"""
import fitz, io, re, json, sys
from pathlib import Path
from fontTools.cffLib import CFFFontSet
from fontTools.fontBuilder import FontBuilder
from fontTools.ttLib import newTable
from fontTools.pens.boundsPen import BoundsPen
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]/'P1/literature'
FIX={'í':'ั','â':'้','à':'่','å':'์','μ':'ต','ã':'๋','Ñ':'้','ä':'๊','É':'่','ê':'ญ','ô':'้','ç':'“','é':'”','‹':'๔','ì':'็','ï':'ี','ó':'ื','ñ':'ึ'}
def decode(s):
 out=''
 for c in s:
  if c in FIX:out+=FIX[c]
  elif ord(c)<128 or c in '❤✯':out+=c
  else:
   try:out+=c.encode('mac_roman').decode('cp874')
   except (UnicodeError,LookupError):raise ValueError('Unmapped '+repr(c))
 return out

def font(doc,xref):
 name,ext,typ,buf=doc.extract_font(xref)
 if ext!='cff':raise ValueError((name,ext))
 cff=CFFFontSet();cff.decompile(io.BytesIO(buf),None); top=cff.topDictIndex[0]
 enc={i:g for i,g in enumerate(top.Encoding)} if isinstance(top.Encoding,list) else {}
 k,v=doc.xref_get_key(xref,'Encoding')
 if k=='xref':
  obj=doc.xref_object(int(v.split()[0])); diff=re.search(r'/Differences\s*\[(.*?)\]',obj,re.S)
  if diff:
   idx=0
   for token in re.findall(r'/[^\s\[\]]+|\d+',diff[1]):
    if token.startswith('/'):enc[idx]=token[1:];idx+=1
    else:idx=int(token)
 k,v=doc.xref_get_key(xref,'ToUnicode');mapping={}
 if k=='xref':
  cmap=doc.xref_stream(int(v.split()[0])).decode()
  for section in re.findall(r'beginbfchar(.*?)endbfchar',cmap,re.S):
   for a,b in re.findall(r'<([\da-fA-F]+)>\s*<([\da-fA-F]+)>',section):mapping[int(a,16)]=int(b,16)
  for section in re.findall(r'beginbfrange(.*?)endbfrange',cmap,re.S):
   for a,b,c in re.findall(r'<([\da-fA-F]+)>\s*<([\da-fA-F]+)>\s*<([\da-fA-F]+)>',section):
    for n in range(int(a,16),int(b,16)+1):mapping[n]=int(c,16)+n-int(a,16)
 glyphs=top.CharStrings;order=top.charset;metrics={};bounds={}
 for g in order:
  pen=BoundsPen(None);glyphs[g].draw(pen);bounds[g]=pen.bounds;metrics[g]=(round(glyphs[g].width),round(pen.bounds[0]) if pen.bounds else 0)
 cm={u:enc[c] for c,u in mapping.items() if c in enc and enc[c] in order}
 fb=FontBuilder(1000,isTTF=False);fb.setupGlyphOrder(order);fb.setupCharacterMap(cm);fb.setupHorizontalMetrics(metrics);fb.setupHorizontalHeader(ascent=900,descent=-300)
 family='Lit'+str(xref);fb.setupNameTable({'familyName':family,'styleName':'Regular','uniqueFontIdentifier':family,'fullName':family,'psName':family})
 fb.setupOS2(sTypoAscender=900,sTypoDescender=-300,usWinAscent=1100,usWinDescent=400)
 fb.setupPost();t=newTable('CFF ');t.cff=cff;fb.font['CFF ']=t;fb.font.sfntVersion='OTTO';cff.otFont=fb.font;fb.setupMaxp();fb.save(ROOT/'fonts'/f'{family}.otf')
 return family,set(cm),{u:bounds[g] for u,g in cm.items()}

doc=fitz.open(sys.argv[1]);fontmap={};known={}
for p in list(doc)[7:84]:
 for x,_,_,name,_,_ in p.get_fonts():
  if x not in known:known[x]=font(doc,x)
  fontmap[name.split('+')[-1]]=known[x]
titles=['เจ้าเนื้ออ่อน เอย','มา เล่น กัน ไหม','ของ เธอ ของ ฉัน','ฝน ตก แดด ออก','เรา รัก เมืองไทย','ตั้งไข่ ล้ม ต้ม ไข่ กิน','แมว เหมียว','กระต่าย กับ เต่า']
phas=['ตามหา','ไปโรงเรียน','โรงเรียนลูกช้าง','เพื่อนรัก เพื่อนเล่น','พูดเพราะ','เกือบไป','เพื่อนรู้ใจ','ช้างน้อยน่ารัก']
ranges=[(8,17),(18,27),(28,35),(36,45),(46,55),(56,65),(66,73),(74,84)]
result={'chapters':[]};audit=[]
for ch,((start,end),title,ph) in enumerate(zip(ranges,titles,phas),1):
 chapter={'id':ch,'title':title,'pairedUnit':ch+3,'pairedTitle':ph,'workbook':1 if ch<=3 else 2,'pages':[]}
 for n in range(start,end+1):
  p=doc[n-1];lines=[]
  fontmap={name.split('+')[-1]:known[x] for x,_,_,name,_,_ in p.get_fonts()}
  for block in p.get_text('rawdict')['blocks']:
   if block['type']!=0:continue
   for ln in block['lines']:
    tokens=[];cur=[]
    def flush():
     if not cur:return
     text=decode(''.join(c['c'] for c,s in cur));box=fitz.Rect(cur[0][0]['bbox'])
     for c,s in cur:box|=fitz.Rect(c['bbox'])
     chars=[];visual=None
     for c,s in cur:
      fam,codes,bounds=fontmap[s['font']]
      glyph=bounds[ord(c['c'])]
      if glyph:
       ox,oy=c['origin'];scale=s['size']/1000
       gb=fitz.Rect(ox+glyph[0]*scale,oy-glyph[3]*scale,ox+glyph[2]*scale,oy-glyph[1]*scale)
       visual=gb if visual is None else visual|gb
      if ord(c['c']) not in codes:raise ValueError((n,s['font'],repr(c['c']),'missing glyph'))
      chars.append([c['c'],round(c['origin'][0],3),round(c['origin'][1],3),fam,round(s['size'],3),'#%06x'%s['color']])
     tokens.append({'text':text,'box':[round(v,3) for v in (visual or box)],'chars':chars});cur.clear()
    for s in ln['spans']:
     for c in s['chars']:
      # PDF's NBSP glyph is the Thai consonant ส, not whitespace.
      if c['c'] in ' \t\r\n':flush()
      else:cur.append((c,s))
    flush()
    if tokens:
     y=ln['bbox'][1]; body=y>140 and y<740 and n!=start
     # Cover title lettering is in the artwork. Preserve native chapter number.
     lines.append({'read':body,'box':[round(v,3) for v in ln['bbox']],'words':tokens})
  # Native PDF extraction follows columns/frames; geometric line order is the
  # reading order for these pages, verified in the chapter contact sheets.
  lines.sort(key=lambda l:(round(l['box'][1]/4),l['box'][0]))
  audit.append('\n=== PDF %s / chapter %s ===\n%s'%(n,ch,'\n'.join(' '.join(w['text'] for w in l['words']) for l in lines)))
  # Remove text only; images and vector illustrations are explicitly preserved.
  if not (ROOT/'assets'/f'page-{n}.webp').exists():
   art=fitz.open();art.insert_pdf(doc,from_page=n-1,to_page=n-1);ap=art[0]
   for b in ap.get_text('dict')['blocks']:
    if b['type']==0:
     for l in b['lines']:
      for s in l['spans']:ap.add_redact_annot(s['bbox'],fill=False)
   ap.apply_redactions(images=0,graphics=0,text=0)
   pix=ap.get_pixmap(matrix=fitz.Matrix(1.5,1.5),alpha=False)
   Image.frombytes('RGB',[pix.width,pix.height],pix.samples).save(ROOT/'assets'/f'page-{n}.webp',quality=86,method=6)
  spoken=[w for l in lines if l['read'] for w in l['words']]
  for w in spoken:w['highlightBox']=list(w['box'])
  for i,a in enumerate(spoken):
   for b in spoken[i+1:]:
    x,y,r,t=a['highlightBox'];x2,y2,r2,t2=b['highlightBox']
    if min(r,r2)>max(x,x2) and min(t,t2)>max(y,y2):
     if abs(y-y2)>4:
      upper,lower=(a,b) if y<y2 else (b,a)
      edge=(upper['highlightBox'][3]+lower['highlightBox'][1])/2
      upper['highlightBox'][3]=edge-.6;lower['highlightBox'][1]=edge+.6
     else:
      left,right=(a,b) if x<x2 else (b,a)
      edge=(left['highlightBox'][2]+right['highlightBox'][0])/2
      left['highlightBox'][2]=edge-.6;right['highlightBox'][0]=edge+.6
  chapter['pages'].append({'pdfPage':n,'printedPage':None if n==8 else n-8,'width':595,'height':842,'lines':lines})
 result['chapters'].append(chapter)
(ROOT/'book.json').write_text(json.dumps(result,ensure_ascii=False,separators=(',',':')))
(ROOT/'text-audit.txt').write_text('\n'.join(audit))
print('Built',sum(len(c['pages']) for c in result['chapters']),'pages;',len(known),'fonts')
