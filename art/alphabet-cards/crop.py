"""Crop the user-supplied 1034×1480 chart without redrawing hand shapes."""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'frontend/public/images/rsl-alphabet'
source = Image.open(OUT / 'source-chart.jpg').convert('RGB')
assert source.size == (1034, 1480)
xs = [5, 141, 293, 443, 595, 747, 899, 1034]
ys = [0, 288, 588, 888, 1190, 1480]
rows = ['АБВГДЕЖ', 'ЗИЙКЛМН', 'ОПРСТУФ', 'ХЦЧШЩЪЫ', ' ЬЭЮЯ  ']
previews = []
for row, letters in enumerate(rows):
    for col, letter in enumerate(letters):
        if letter == ' ':
            continue
        # Exclude grid rules; retain the complete diagram, arrows and label.
        top = 34 if letter == 'А' else 18 if letter == 'Ж' else ys[row]+4
        cell = source.crop((xs[col]+4, top, xs[col+1]-4, ys[row+1]-4))
        cell.save(OUT / f'{ord(letter):04x}.webp', lossless=True)
        previews.append(cell)
montage = Image.new('RGB', (7*160, 5*300), '#e9e4db')
for i, cell in enumerate(previews):
    cell.thumbnail((148, 288))
    montage.paste(cell, ((i%7)*160+(160-cell.width)//2, (i//7)*300+6))
montage.save(ROOT / 'art/alphabet-cards/contact-sheet.jpg')
print(f'Saved {len(previews)} illustrations. Ё is absent from the source.')
