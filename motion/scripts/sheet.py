# Tile review images into one contact sheet. usage: python scripts/sheet.py out.png img1 img2 ...
import sys
from PIL import Image, ImageDraw

out, *imgs = sys.argv[1:]
cols = 4
tw, th = 480, 270
rows = (len(imgs) + cols - 1) // cols
sheet = Image.new('RGB', (cols * tw, rows * (th + 18)), (8, 7, 12))
d = ImageDraw.Draw(sheet)
for i, p in enumerate(imgs):
    im = Image.open(p).convert('RGB').resize((tw, th), Image.LANCZOS)
    x, y = (i % cols) * tw, (i // cols) * (th + 18)
    sheet.paste(im, (x, y))
    d.text((x + 6, y + th + 3), p.replace('\\', '/').split('/')[-1], fill=(235, 192, 163))
sheet.save(out)
