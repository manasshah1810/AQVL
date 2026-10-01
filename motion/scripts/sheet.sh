#!/usr/bin/env bash
# usage: sheet.sh video out.png t1 t2 ... (seconds) -> contact sheet 4 columns
V="$1"; O="$2"; shift 2
EXPR=""; for t in "$@"; do EXPR="$EXPR+lt(abs(t-$t),0.02)"; done
ffmpeg -loglevel error -y -i "$V" -vf "select='${EXPR:1}',scale=480:-1,tile=4x4" -vsync 0 -frames:v 1 "$O"
