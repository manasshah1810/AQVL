#!/usr/bin/env bash
# usage: grade.sh in.mp4 out.mp4 [crf] [preset]
# Consistent film grade: tasteful bloom, controlled contrast, restrained chromatic aberration, grain (also dithers banding).
IN="$1"; OUT="$2"; CRF="${3:-16}"; PRESET="${4:-medium}"
ffmpeg -loglevel error -y -i "$IN" -filter_complex "\
[0:v]format=gbrp,split=2[a][b];\
[b]scale=iw/2:ih/2,gblur=sigma=14,eq=brightness=-0.06:contrast=1.15,scale=iw*2:ih*2[bl];\
[a][bl]blend=all_mode=screen:all_opacity=0.32[x];\
[x]format=gbrp,rgbashift=rh=-1:bh=1,eq=contrast=1.05:saturation=1.06:gamma=0.98,noise=alls=7:allf=t,format=yuv420p[v]" \
-map "[v]" -c:v libx264 -crf "$CRF" -preset "$PRESET" -pix_fmt yuv420p -movflags +faststart -an "$OUT"
