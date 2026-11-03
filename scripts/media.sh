#!/usr/bin/env bash
# Builds every video asset the site uses from the source clips in raw-video/src.
# One warm, low-key grade for all clips so footage from different shoots reads as one film.
# Run from the project root: bash scripts/media.sh
set -euo pipefail
export PYTHONIOENCODING=utf-8
SRC=raw-video/src
G=raw-video/graded
OUT=public/media
SEQ=public/sequences
EXTRACT="${EXTRACT:-C:/Users/USER/.claude/skills/synced/958f9c99-9eb2-4580-bf05-2df9a8ccfc92_6f601f22-013b-485f-9309-bc27f76b1bea/3d-master/scripts/extract_frames.py}"
mkdir -p "$G" "$OUT" "$SEQ"

GRADE="eq=contrast=1.12:brightness=-0.035:saturation=1.14,colorbalance=rs=.05:gs=.012:bs=-.06:rm=.03:bm=-.035,curves=master='0/0 0.1/0.03 0.5/0.47 1/0.97'"
SOFT="eq=contrast=1.06:brightness=-0.03:saturation=0.86,colorbalance=rs=-.02:gs=.0:bs=.01,curves=master='0/0 0.1/0.04 0.5/0.48 1/0.97'"
DARK="eq=contrast=1.08:brightness=-0.07:saturation=1.08,colorbalance=rs=.05:bs=-.06:rm=.03:bm=-.03,curves=master='0/0 0.15/0.03 0.6/0.5 1/0.93'"
ff() { ffmpeg -v error -y "$@"; }

# name, source, start, end, grade, vignette angle
grade() { # landscape 4K -> 1920x1080 and a centred 720x1280 crop for phones
  local name=$1 src=$2 ss=$3 to=$4 g=$5 vig=$6 cx=${7:-0.5}
  ff -ss "$ss" -to "$to" -i "$SRC/$src" -an -vf "scale=1920:-2,$g,vignette=angle=$vig,fps=30" -threads 4 -c:v libx264 -crf 14 -preset medium -pix_fmt yuv420p "$G/$name.mp4"
  ff -ss "$ss" -to "$to" -i "$SRC/$src" -an -vf "crop=ih*9/16:ih:(iw-ih*9/16)*$cx:0,scale=720:1280,$g,vignette=angle=$vig,fps=30" -threads 4 -c:v libx264 -crf 14 -preset medium -pix_fmt yuv420p "$G/$name-9x16.mp4"
}
grade_portrait() { # already 9:16
  local name=$1 src=$2 ss=$3 to=$4 g=$5 vig=$6
  ff -ss "$ss" -to "$to" -i "$SRC/$src" -an -vf "scale=720:1280,$g,vignette=angle=$vig,fps=30" -threads 4 -c:v libx264 -crf 14 -preset medium -pix_fmt yuv420p "$G/$name-9x16.mp4"
}

grade fryer   10823654-hd_3840_2160_24fps.mp4    3.7 11.7 "$GRADE" 'PI/4.4'
grade golden  10823653-hd_3840_2160_24fps.mp4    0.5 8.5  "$GRADE" 'PI/4'
grade egg     13527970_3840_2160_25fps.mp4       0   6.2  "$GRADE" 'PI/5'
grade packed  5336213-uhd_4096_2160_30fps.mp4    0   7.8  "$DARK"  'PI/3.4' 0.42
grade_portrait crumb 15552079_2160_3840_25fps.mp4 0  8.8  "$DARK"  'PI/3.4'
grade_portrait snap  15994005_1080_1920_60fps.mp4 0  3.3  "$SOFT" 'PI/4'

# Scroll-scrubbed sequences
python "$EXTRACT" "$G/fryer.mp4"  --name fryer  --out "$SEQ" --frames 120 --width 1600 --mobile-src "$G/fryer-9x16.mp4"  --mobile-width 720 --quality 62
python "$EXTRACT" "$G/golden.mp4" --name golden --out "$SEQ" --frames 40  --width 1600 --mobile-src "$G/golden-9x16.mp4" --mobile-width 720 --quality 62
python "$EXTRACT" "$G/packed.mp4" --name packed --out "$SEQ" --frames 90  --width 1600 --mobile-src "$G/packed-9x16.mp4" --mobile-width 720 --quality 62
python "$EXTRACT" "$G/snap-9x16.mp4" --name snap --out "$SEQ" --frames 72 --width 720 --no-mobile --quality 66

# Looping clips: small H.264, no audio, keyframe every second so the browser can start anywhere
loop() { local in=$1 out=$2 w=$3
  ff -i "$in" -an -vf "scale=$w:-2" -threads 4 -c:v libx264 -crf 27 -preset slow -profile:v high -pix_fmt yuv420p -g 30 -movflags +faststart "$OUT/$out.mp4"
  ff -i "$in" -vf "scale=$w:-2" -frames:v 1 -q:v 4 "$OUT/$out.jpg"
}
loop "$G/egg.mp4"          egg          1280
loop "$G/egg-9x16.mp4"     egg-m        720
loop "$G/crumb-9x16.mp4"   crumb-m      720
loop "$G/fryer.mp4"        fry          1280
loop "$G/fryer-9x16.mp4"   fry-m        720
loop "$G/golden.mp4"       golden       1280
loop "$G/golden-9x16.mp4"  golden-m     720
for f in "$OUT"/*.jpg; do ffmpeg -v error -y -i "$f" -q:v 70 "${f%.jpg}.webp" && rm "$f"; done
du -sh "$SEQ"/* "$OUT"
