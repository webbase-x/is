import fitz,json,pathlib
from PIL import Image
import argparse
parser=argparse.ArgumentParser()
parser.add_argument('--source-dir',default='upload')
parser.add_argument('--p1-dir',default='P1')
args=parser.parse_args()
source=pathlib.Path(args.source_dir)
root=pathlib.Path(args.p1_dir); out=root/'workbook/assets';out.mkdir(parents=True,exist_ok=True)
vols={1:fitz.open(source/'แบบฝึกหัดไทย ป.1 เล่ม1.pdf'),2:fitz.open(source/'แบบฝึกหัดภาษาไทย ป.1.pdf')}
ranges={1:[31,33,34,35,36,37,38,41],2:[43,44,45,46,47,48,50,51],3:list(range(53,71)),4:list(range(71,86)),5:list(range(86,97)),6:list(range(97,109)),7:[p for p in range(7,18) if p!=11],8:list(range(18,30)),9:list(range(30,39)),10:list(range(39,52)),11:list(range(52,68)),12:[p for p in range(68,88) if p not in (74,75)]}
titles=['ใบโบก ใบบัว','ภูผา','เพื่อนกัน','ตามหา','ไปโรงเรียน','โรงเรียนลูกช้าง','เพื่อนรัก เพื่อนเล่น','พูดเพราะ','เกือบไป','เพื่อนรู้ใจ','ช้างน้อยน่ารัก','วันสงกรานต์']
def raster(pg,path,width=1100,rotate=0):
 pix=pg.get_pixmap(matrix=fitz.Matrix(width/pg.rect.width,width/pg.rect.width),alpha=False)
 im=Image.frombytes('RGB',[pix.width,pix.height],pix.samples)
 if rotate: im=im.rotate(rotate,expand=True)
 im.save(path,'WEBP',quality=85,method=6)
for v,d in vols.items():raster(d[0],out/f'volume-{v}.webp',650)
chapters=[]
for u,pages in ranges.items():
 v=1 if u<=6 else 2
 rows=[]
 for p in pages:
  rotate=180 if v==2 and p in (32,44,83) else 0
  file=f'volume-{v}-page-{p}.webp';raster(vols[v][p-1],out/file,rotate=rotate)
  rows.append({'pdfPage':p,'image':'assets/'+file,'rotation':rotate})
 chapters.append({'unit':u,'title':titles[u-1],'volume':v,'pages':rows})
(root/'workbook/book.json').write_text(json.dumps({'chapters':chapters},ensure_ascii=False,separators=(',',':')))
# Original literature cover spread, with original text baked into thumbnail only.
lit=fitz.open(source/'วรรณคดีลำนำ.pdf')
for c in json.loads((root/'literature/book.json').read_text())['chapters']:
 images=[]
 for pg in c['pages'][:2]:
  pix=lit[pg['pdfPage']-1].get_pixmap(matrix=fitz.Matrix(1,1),clip=fitz.Rect(35,50 if c['id']==7 else 53,559,787 if c['id']==7 else 790),alpha=False)
  images.append(Image.frombytes('RGB',[pix.width,pix.height],pix.samples))
 spread=Image.new('RGB',(sum(i.width for i in images),max(i.height for i in images)), 'white');x=0
 for i in images:spread.paste(i,(x,0));x+=i.width
 spread.save(root/'literature/assets'/f'cover-{c["id"]}.webp','WEBP',quality=88,method=6)
print('chapters',len(chapters),'worksheets',sum(len(c['pages']) for c in chapters))
