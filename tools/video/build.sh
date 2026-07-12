#!/usr/bin/env bash
set -euo pipefail
export PATH="$PATH:$(ls -d "$LOCALAPPDATA/Microsoft/WinGet/Packages/Gyan.FFmpeg"*/ffmpeg-*/bin 2>/dev/null | head -1)"

cd "C:/Users/abhis/Desktop/WD/HackX/tools/video"

# Fontfile: single-quoted inside filtergraph script; escaped drive-letter colon.
FONT="'C\:/Windows/Fonts/segoeui.ttf'"
A="assets"; V="vo"; S="segments"; C="captions"
FPS=24; SZ=1920x1080
FG=/tmp/fg.txt   # filtergraph script (rewritten per segment)

# Common caption drawtext options
CAP="fontfile=${FONT}:fontsize=32:fontcolor=white:box=1:boxcolor=black@0.62:boxborderw=22:line_spacing=8:x=(w-text_w)/2:y=h-160"

# Encoder args (identical across all segments so concat -c copy is safe)
ENC=(-r $FPS -c:v libx264 -preset medium -crf 19 -pix_fmt yuv420p -c:a aac -b:a 192k -ar 48000 -ac 2)

# helper: end time for fade-out
fo() { awk "BEGIN{print $1-0.35}"; }
# helper: frames for zoompan
fr() { awk "BEGIN{print int($1*$FPS)}"; }

echo "=== Building segments ==="

# ---------- SEGMENT 1: seed.mp4 [0->dur], VO01 ----------
DUR=10.4
cat > "$FG" <<EOF
[0:v]trim=0:$DUR,setpts=PTS-STARTPTS,fps=$FPS,scale=$SZ,drawtext=${CAP}:textfile=${C}/cap01.txt,fade=t=in:st=0:d=0.35,fade=t=out:st=$(fo $DUR):d=0.35[v];
[1:a]adelay=400|400,apad,atrim=0:$DUR,asetpts=PTS-STARTPTS,afade=t=in:st=0:d=0.35,afade=t=out:st=$(fo $DUR):d=0.35[a]
EOF
ffmpeg -y -loglevel error -ss 0 -t $DUR -i "$A/seed.mp4" -i "$V/beat01.mp3" -filter_complex_script "$FG" -map "[v]" -map "[a]" -t $DUR "${ENC[@]}" "$S/seg01.mp4"
echo "seg01 done"

# ---------- SEGMENT 2: still_channel slow zoom-in, VO02 ----------
DUR=15.8
cat > "$FG" <<EOF
[0:v]scale=3840:2160,zoompan=z='min(zoom+0.0008,1.06)':d=$(fr $DUR):x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=$SZ:fps=$FPS,drawtext=${CAP}:textfile=${C}/cap02.txt,fade=t=in:st=0:d=0.35,fade=t=out:st=$(fo $DUR):d=0.35[v];
[1:a]adelay=400|400,apad,atrim=0:$DUR,asetpts=PTS-STARTPTS,afade=t=in:st=0:d=0.35,afade=t=out:st=$(fo $DUR):d=0.35[a]
EOF
ffmpeg -y -loglevel error -loop 1 -t $DUR -i "$A/still_channel.png" -i "$V/beat02.mp3" -filter_complex_script "$FG" -map "[v]" -map "[a]" -t $DUR "${ENC[@]}" "$S/seg02.mp4"
echo "seg02 done"

# ---------- SEGMENT 3: still_channel punch-in (2300 line lower third), VO03 ----------
DUR=4.1
cat > "$FG" <<EOF
[0:v]scale=3840:2160,zoompan=z='min(zoom+0.0018,1.14)':d=$(fr $DUR):x='iw*0.5-(iw/zoom/2)':y='ih*0.55-(ih/zoom/2)':s=$SZ:fps=$FPS,drawtext=${CAP}:textfile=${C}/cap03.txt,fade=t=in:st=0:d=0.35,fade=t=out:st=$(fo $DUR):d=0.35[v];
[1:a]adelay=400|400,apad,atrim=0:$DUR,asetpts=PTS-STARTPTS,afade=t=in:st=0:d=0.35,afade=t=out:st=$(fo $DUR):d=0.35[a]
EOF
ffmpeg -y -loglevel error -loop 1 -t $DUR -i "$A/still_channel.png" -i "$V/beat03.mp3" -filter_complex_script "$FG" -map "[v]" -map "[a]" -t $DUR "${ENC[@]}" "$S/seg03.mp4"
echo "seg03 done"

# ---------- SEGMENT 4: still_dm slow zoom top half (header/body), VO04 ----------
DUR=11.2
cat > "$FG" <<EOF
[0:v]scale=3840:2160,zoompan=z='min(zoom+0.0009,1.09)':d=$(fr $DUR):x='iw*0.5-(iw/zoom/2)':y='ih*0.38-(ih/zoom/2)':s=$SZ:fps=$FPS,drawtext=${CAP}:textfile=${C}/cap04.txt,fade=t=in:st=0:d=0.35,fade=t=out:st=$(fo $DUR):d=0.35[v];
[1:a]adelay=400|400,apad,atrim=0:$DUR,asetpts=PTS-STARTPTS,afade=t=in:st=0:d=0.35,afade=t=out:st=$(fo $DUR):d=0.35[a]
EOF
ffmpeg -y -loglevel error -loop 1 -t $DUR -i "$A/still_dm.png" -i "$V/beat04.mp3" -filter_complex_script "$FG" -map "[v]" -map "[a]" -t $DUR "${ENC[@]}" "$S/seg04.mp4"
echo "seg04 done"

# ---------- SEGMENT 5: still_dm slow pan lower half (fields+footer), VO05 ----------
DUR=12.5
cat > "$FG" <<EOF
[0:v]scale=3840:2160,zoompan=z='min(zoom+0.0008,1.08)':d=$(fr $DUR):x='iw*0.5-(iw/zoom/2)':y='ih*0.62-(ih/zoom/2)':s=$SZ:fps=$FPS,drawtext=${CAP}:textfile=${C}/cap05.txt,fade=t=in:st=0:d=0.35,fade=t=out:st=$(fo $DUR):d=0.35[v];
[1:a]adelay=400|400,apad,atrim=0:$DUR,asetpts=PTS-STARTPTS,afade=t=in:st=0:d=0.35,afade=t=out:st=$(fo $DUR):d=0.35[a]
EOF
ffmpeg -y -loglevel error -loop 1 -t $DUR -i "$A/still_dm.png" -i "$V/beat05.mp3" -filter_complex_script "$FG" -map "[v]" -map "[a]" -t $DUR "${ENC[@]}" "$S/seg05.mp4"
echo "seg05 done"

# ---------- SEGMENT 6: ARCHITECTURE CARD, VO06 ----------
DUR=15.8
cat > "$FG" <<EOF
[0:v]drawtext=fontfile=${FONT}:textfile=${C}/card6_title.txt:fontsize=64:fontcolor=white:x=(w-text_w)/2:y=300,drawtext=fontfile=${FONT}:textfile=${C}/card6_l1.txt:fontsize=40:fontcolor=white:x=(w-text_w)/2:y=500,drawtext=fontfile=${FONT}:textfile=${C}/card6_l2.txt:fontsize=40:fontcolor=white:x=(w-text_w)/2:y=590,drawtext=fontfile=${FONT}:textfile=${C}/card6_l3.txt:fontsize=40:fontcolor=white:x=(w-text_w)/2:y=680,drawtext=${CAP}:textfile=${C}/cap06.txt,fade=t=in:st=0:d=0.35,fade=t=out:st=$(fo $DUR):d=0.35[v];
[1:a]adelay=400|400,apad,atrim=0:$DUR,asetpts=PTS-STARTPTS,afade=t=in:st=0:d=0.35,afade=t=out:st=$(fo $DUR):d=0.35[a]
EOF
ffmpeg -y -loglevel error -f lavfi -t $DUR -i "color=c=0x0f1014:s=$SZ:r=$FPS" -i "$V/beat06.mp3" -filter_complex_script "$FG" -map "[v]" -map "[a]" -t $DUR "${ENC[@]}" "$S/seg06.mp4"
echo "seg06 done"

# ---------- SEGMENT 7: still_dm zoom to green button (lower-left), VO07 ----------
DUR=8.1
cat > "$FG" <<EOF
[0:v]scale=3840:2160,zoompan=z='min(zoom+0.0016,1.16)':d=$(fr $DUR):x='iw*0.30-(iw/zoom/2)':y='ih*0.67-(ih/zoom/2)':s=$SZ:fps=$FPS,drawtext=${CAP}:textfile=${C}/cap07.txt,fade=t=in:st=0:d=0.35,fade=t=out:st=$(fo $DUR):d=0.35[v];
[1:a]adelay=400|400,apad,atrim=0:$DUR,asetpts=PTS-STARTPTS,afade=t=in:st=0:d=0.35,afade=t=out:st=$(fo $DUR):d=0.35[a]
EOF
ffmpeg -y -loglevel error -loop 1 -t $DUR -i "$A/still_dm.png" -i "$V/beat07.mp3" -filter_complex_script "$FG" -map "[v]" -map "[a]" -t $DUR "${ENC[@]}" "$S/seg07.mp4"
echo "seg07 done"

# ---------- SEGMENT 8: canvas.mp4 [0->dur], VO08 ----------
DUR=13.0
cat > "$FG" <<EOF
[0:v]trim=0:$DUR,setpts=PTS-STARTPTS,fps=$FPS,scale=$SZ,drawtext=${CAP}:textfile=${C}/cap08.txt,fade=t=in:st=0:d=0.35,fade=t=out:st=$(fo $DUR):d=0.35[v];
[1:a]adelay=400|400,apad,atrim=0:$DUR,asetpts=PTS-STARTPTS,afade=t=in:st=0:d=0.35,afade=t=out:st=$(fo $DUR):d=0.35[a]
EOF
ffmpeg -y -loglevel error -ss 0 -t $DUR -i "$A/canvas.mp4" -i "$V/beat08.mp3" -filter_complex_script "$FG" -map "[v]" -map "[a]" -t $DUR "${ENC[@]}" "$S/seg08.mp4"
echo "seg08 done"

# ---------- SEGMENT 9: canvas.mp4 tail [ (30-dur)->30 ], VO09 ----------
DUR=17.5
START=$(awk "BEGIN{print 30-$DUR}")
cat > "$FG" <<EOF
[0:v]trim=0:$DUR,setpts=PTS-STARTPTS,fps=$FPS,scale=$SZ,drawtext=${CAP}:textfile=${C}/cap09.txt,fade=t=in:st=0:d=0.35,fade=t=out:st=$(fo $DUR):d=0.35[v];
[1:a]adelay=400|400,apad,atrim=0:$DUR,asetpts=PTS-STARTPTS,afade=t=in:st=0:d=0.35,afade=t=out:st=$(fo $DUR):d=0.35[a]
EOF
ffmpeg -y -loglevel error -ss $START -t $DUR -i "$A/canvas.mp4" -i "$V/beat09.mp3" -filter_complex_script "$FG" -map "[v]" -map "[a]" -t $DUR "${ENC[@]}" "$S/seg09.mp4"
echo "seg09 done"

# ---------- SEGMENT 10: CLOSING CARD, VO10 ----------
DUR=7.4
cat > "$FG" <<EOF
[0:v]drawtext=fontfile=${FONT}:textfile=${C}/card10_title.txt:fontsize=96:fontcolor=white:x=(w-text_w)/2:y=400,drawtext=fontfile=${FONT}:textfile=${C}/card10_l1.txt:fontsize=40:fontcolor=white:x=(w-text_w)/2:y=560,drawtext=fontfile=${FONT}:textfile=${C}/card10_l2.txt:fontsize=30:fontcolor=0xaaaaaa:x=(w-text_w)/2:y=650,fade=t=in:st=0:d=0.35,fade=t=out:st=$(fo $DUR):d=0.35[v];
[1:a]adelay=400|400,apad,atrim=0:$DUR,asetpts=PTS-STARTPTS,afade=t=in:st=0:d=0.35,afade=t=out:st=$(fo $DUR):d=0.35[a]
EOF
ffmpeg -y -loglevel error -f lavfi -t $DUR -i "color=c=0x0f1014:s=$SZ:r=$FPS" -i "$V/beat10.mp3" -filter_complex_script "$FG" -map "[v]" -map "[a]" -t $DUR "${ENC[@]}" "$S/seg10.mp4"
echo "seg10 done"

echo "=== ALL SEGMENTS BUILT ==="
ls -la "$S"/seg*.mp4