# Grab frames from a video at times (s) and tile them. usage: python scripts/grab.py video.mp4 out.png t1 t2 ...
import subprocess, sys, os, tempfile
video, out, *times = sys.argv[1:]
tmp = tempfile.mkdtemp()
paths = []
for t in times:
    p = os.path.join(tmp, f"f{float(t):06.2f}.png")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", t, "-i", video, "-frames:v", "1", p], check=True)
    paths.append(p)
subprocess.run([sys.executable, os.path.join(os.path.dirname(__file__), "sheet.py"), out, *paths], check=True)
