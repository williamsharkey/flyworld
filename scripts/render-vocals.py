"""Offline neural vocal production; no model or inference service runs in the game.
python3.12 -m venv /tmp/flyworld-voice-venv
/tmp/flyworld-voice-venv/bin/pip install kokoro-onnx soundfile
Download Kokoro v1.0 and voices-v1.0.bin from the upstream release (see README).
Run with --model /path/model.onnx --voices /path/voices.bin. Requires ffmpeg.
"""
import argparse, hashlib, json, subprocess, tempfile
from pathlib import Path
import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

parser=argparse.ArgumentParser()
parser.add_argument('--model',required=True); parser.add_argument('--voices',required=True)
parser.add_argument('--cache',default='/tmp/flyworld-vocal-cache')
args=parser.parse_args()
root=Path(__file__).resolve().parent.parent
rows=json.loads((root/'src/lyrics.json').read_text())
cache=Path(args.cache);cache.mkdir(exist_ok=True,parents=True)
output=root/'public/audio';output.mkdir(exist_ok=True,parents=True)
k=Kokoro(args.model,args.voices)
rate=24000; slot=3.2; spoken=2.98; atlas=[]; entries={}
def ffmpeg(src, dst, filters):
 subprocess.run(['ffmpeg','-v','error','-y','-i',str(src),'-af',filters,'-ar',str(rate),str(dst)],check=True)
for i,row in enumerate(rows):
 spoken_text=row.get('spokenText',row['text'])
 key=hashlib.sha256((spoken_text+row['voice']+'v2').encode()).hexdigest()[:16]
 raw=cache/(key+'.wav')
 if not raw.exists():
  audio,sr=k.create(spoken_text,voice=row['voice'],speed=1.04,lang='en-us')
  sf.write(raw,audio,sr)
 a,_=sf.read(raw); active=np.flatnonzero(np.abs(a)>.009)
 if len(active):a=a[max(0,active[0]-120):min(len(a),active[-1]+600)]
 clean=cache/(key+'-trim.wav');sf.write(clean,a,rate)
 speed=max(.9,(len(a)/rate)/spoken)
 speech_duration=min(spoken,len(a)/rate/speed)
 fitted=cache/(key+'-fit.wav')
 ffmpeg(clean,fitted,f'atempo={speed:.6f},highpass=f=95,lowpass=f=9000,afade=t=in:d=0.008,afade=t=out:st=2.94:d=0.04,apad=whole_dur=3.2,atrim=duration=3.2')
 lead,_=sf.read(fitted)
 layers=[]
 for tag,factor,tempo in [('low',.5,2),('high',2,.5)]:
  shifted=cache/(key+'-'+tag+'.wav')
  ffmpeg(fitted,shifted,f'asetrate={int(rate*factor)},aresample={rate},atempo={tempo},apad=whole_dur=3.2,atrim=duration=3.2')
  b,_=sf.read(shifted);layers.append(b)
 size=int(slot*rate)
 lead=np.pad(lead,(0,max(0,size-len(lead))))[:size]
 low,high=[np.pad(b,(0,max(0,size-len(b))))[:size] for b in layers]
 # The intelligible lead dominates; octave colors remain beneath it.
 mix=.9*lead+.065*low+.035*high
 rms=np.sqrt(np.mean(mix**2)); mix*=min(.22/max(rms,1e-8),.91/max(np.max(np.abs(mix)),1e-8))
 atlas.append(mix.astype(np.float32))
 entries[row['id']]={'offset':i*slot,'duration':slot,'speechDuration':speech_duration,'text':row['text'],'rms':float(np.sqrt(np.mean(mix**2)))}
 print(f'{i+1}/{len(rows)} {row["id"]} tempo={speed:.2f}',flush=True)
whole=np.concatenate(atlas);wav=cache/'atlas.wav';sf.write(wav,whole,rate)
subprocess.run(['ffmpeg','-v','error','-y','-i',str(wav),'-c:a','libmp3lame','-b:a','80k','-ar',str(rate),str(output/'vocals.mp3')],check=True)
manifest={'version':1,'engine':'Kokoro-82M v1.0 (ONNX)','sampleRate':rate,'bpm':150,'slotSeconds':slot,'layers':{'lead':.9,'lowerOctave':.065,'upperOctave':.035},'clips':entries,'sha256':hashlib.sha256((output/'vocals.mp3').read_bytes()).hexdigest()}
(output/'vocals.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('wrote',len(whole)/rate,'seconds',flush=True)
