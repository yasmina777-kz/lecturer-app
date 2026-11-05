"""Check the exported skin and every animation independently of Blender."""
import json,struct,math
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'frontend/public/avatars/woman01'
def read(p):
 b=p.read_bytes();magic,version,total=struct.unpack_from('<III',b);assert magic==0x46546c67 and version==2 and total==len(b)
 n=struct.unpack_from('<I',b,12)[0];doc=json.loads(b[20:20+n]);binary=b[28+n:];return doc,binary
SIZES={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16};FORMATS={5126:'f',5125:'I',5123:'H',5121:'B',5122:'h',5120:'b'}
def accessor(doc,binary,i):
 a=doc['accessors'][i];v=doc['bufferViews'][a['bufferView']];count=SIZES[a['type']];fmt='<'+FORMATS[a['componentType']]*count;size=struct.calcsize(fmt);stride=v.get('byteStride',size);off=v.get('byteOffset',0)+a.get('byteOffset',0)
 return [struct.unpack_from(fmt,binary,off+j*stride) for j in range(a['count'])]
def finite(doc,binary):
 for i,a in enumerate(doc.get('accessors',[])):
  if a['componentType']==5126:
   assert all(math.isfinite(v) for row in accessor(doc,binary,i) for v in row),f'nonfinite accessor {i}'
m,b=read(OUT/'woman01.glb');finite(m,b)
attrs=m['meshes'][0]['primitives'][0]['attributes'];assert 'COLOR_0' in attrs
colors=accessor(m,b,attrs['COLOR_0']);assert len(set(colors))>20
weights=accessor(m,b,attrs['WEIGHTS_0']);assert all(abs(sum(v)-1)<.00001 for v in weights)
names={n.get('name') for n in m['nodes']};joints=m['skins'][0]['joints'];assert len(joints)==51
assert sum('Hand' in m['nodes'][i]['name'] and m['nodes'][i]['name'][-1] in '123' for i in joints)==30
catalog=json.loads((OUT/'catalog.json').read_text());assert len(catalog)==212
assert sum(a['id'].startswith('letter-') for a in catalog)==33
for asset in catalog:
 p=OUT/Path(asset['url']).name;d,binary=read(p);finite(d,binary);assert len(d['animations'])==1
 anim=d['animations'][0];assert len(anim['channels'])==153
 for channel in anim['channels']:
  target=channel['target'];assert d['nodes'][target['node']]['name'] in names
  sampler=anim['samplers'][channel['sampler']];times=[v[0] for v in accessor(d,binary,sampler['input'])]
  assert all(a<b for a,b in zip(times,times[1:]))
  assert abs(times[-1]-asset['duration'])<.04
  if target['path']=='rotation':
   assert all(abs(sum(v*v for v in q)-1)<.0001 for q in accessor(d,binary,sampler['output']))
print(f'PASS: colored skin, {len(weights)} normalized vertices, 51 bones / 30 finger bones, {len(catalog)} animations, 33 letters; all finite, bound and duration matched.')
