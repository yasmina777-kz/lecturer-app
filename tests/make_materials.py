"""Generate tiny valid text-bearing test documents without using user files."""
from pathlib import Path
from zipfile import ZipFile
root = Path(__file__).parent / 'fixtures'
root.mkdir(exist_ok=True)
text = 'Active recall means explaining a topic from memory and checking the answer against a reliable source.'
with ZipFile(root / 'lesson.docx', 'w') as z:
    z.writestr('word/document.xml', f'<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>{text}</w:t></w:r></w:p></w:body></w:document>')
with ZipFile(root / 'lesson.pptx', 'w') as z:
    z.writestr('ppt/slides/slide1.xml', f'<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:p><a:r><a:t>{text}</a:t></a:r></a:p></p:sld>')
stream = f'BT /F1 10 Tf 30 700 Td ({text}) Tj ET'.encode()
objects = [b'<< /Type /Catalog /Pages 2 0 R >>', b'<< /Type /Pages /Kids [3 0 R] /Count 1 >>', b'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>', b'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', f'<< /Length {len(stream)} >>\nstream\n'.encode() + stream + b'\nendstream']
data = b'%PDF-1.4\n'; offsets = [0]
for i, obj in enumerate(objects, 1):
    offsets.append(len(data)); data += f'{i} 0 obj\n'.encode() + obj + b'\nendobj\n'
xref = len(data); data += b'xref\n0 6\n0000000000 65535 f \n'
for offset in offsets[1:]: data += f'{offset:010d} 00000 n \n'.encode()
data += f'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF'.encode()
(root / 'lesson.pdf').write_bytes(data)
