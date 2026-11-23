import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const source = await readFile(new URL('../src/sign/liveRecognition.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020}}).outputText;
const {LiveLetterStream,trackingQuality,LETTER_SAMPLE_MS}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
// End-to-end stream scheduling, including confirmation; not a webcam accuracy test.
const fast=new LiveLetterStream();
const fastFrame=Array(66).fill(0);fastFrame[65]=.2;
let firstAccepted=-1;
for(let now=0;now<=2200;now+=10){
  if(fast.sample(fastFrame,now,'ready') && fast.confirm({accepted:true,label:'А'})) firstAccepted=now;
}
assert.equal(LETTER_SAMPLE_MS,100);
assert.equal(firstAccepted,1700,'two agreeing windows should confirm after 1.7 seconds at target cadence');
const sure=new LiveLetterStream();let sureAt=-1;
for(let now=0;now<=2200;now+=10){ if(sure.sample(fastFrame,now,'ready') && sure.confirm({accepted:true,label:'Б',confidence:.9}) && sureAt<0) sureAt=now; }
assert.equal(sureAt,900,'a very confident letter is emitted from the stretched 1 s window');
const fair=new LiveLetterStream();let fairAt=-1;
for(let now=0;now<=2200;now+=10){ if(fair.sample(fastFrame,now,'ready') && fair.confirm({accepted:true,label:'Г',confidence:.75}) && fairAt<0) fairAt=now; }
assert.equal(fairAt,1500,'a confident (≥0.7) full window is emitted at 1.5 seconds without a second vote');
const slower=new LiveLetterStream();let slowAccepted=-1;
for(let now=0;now<=4000;now+=200){
  if(slower.sample(fastFrame,now,'ready') && slower.confirm({accepted:true,label:'А'})) slowAccepted=now;
}
assert.equal(slowAccepted,3400,'slow hardware must still provide all samples, never fake early acceptance');
const stream=new LiveLetterStream();
const frame=Array(66).fill(0);frame[65]=0.2;
let windows=0;
for(let i=0;i<20;i++){if(stream.sample(frame,i*150,'ready')) windows++;}
assert.equal(windows,6,'stretched windows from 10 samples, then a two-sample stride');
const early=new LiveLetterStream();let earlyAt=-1;
for(let now=0;now<=2200;now+=10){ if(early.sample(fastFrame,now,'ready') && early.confirm({accepted:true,label:'В',confidence:.96}) && earlyAt<0) earlyAt=now; }
assert.equal(earlyAt,900,'a held letter the model is very sure of is shown after ~1 second');
const yes=label=>({accepted:true,label});
assert.equal(stream.confirm(yes('А')),false);
assert.equal(stream.confirm(yes('А')),true);
for(let i=0;i<10;i++) assert.equal(stream.confirm(yes('А')),false,'held sign must not spam captions');
assert.equal(stream.confirm(yes('Б')),false);
assert.equal(stream.confirm({accepted:false,label:'Б'}),false);
assert.equal(stream.confirm(yes('Б')),false,'rejection breaks consensus');
assert.equal(stream.confirm(yes('Б')),true,'next sign works without removing hand');
stream.sample(Array(66).fill(0),3000,'missing');
stream.sample(frame,3300,'ready');
assert.equal(stream.confirm(yes('Б')),false);assert.equal(stream.confirm(yes('Б')),false,'brief dropout does not rearm');
for(let t=3450;t<=4200;t+=150) stream.sample(Array(66).fill(0),t,'missing');
assert.equal(stream.confirm(yes('Б')),false);assert.equal(stream.confirm(yes('Б')),true,'deliberate release permits repeated letter');
stream.reset(true);
assert.equal(stream.confirm(yes('Б')),false);
assert.equal(stream.confirm(yes('Б')),false,'hand switch clears window but must not re-emit a held letter');
stream.reset();
assert.equal(stream.progress,0);assert.equal(stream.confirm(yes('Б')),false);
assert.equal(stream.confirm(yes('no_event')),false);
for(let i=0;i<16;i++) stream.sample(frame,5000+i*150,'ready');
assert.equal(stream.sample(frame,9000,'ready'),null,'stalled video must not reuse old window');
const points=Array.from({length:21},(_,i)=>({x:.4+(i%5)*.04,y:.3+Math.floor(i/5)*.05,z:0}));
const hand=ps=>({landmarks:[ps]});
assert.equal(trackingQuality({landmarks:[]}), 'missing');
assert.equal(trackingQuality(hand(points)), 'ready');
assert.equal(trackingQuality(hand(points.map(p=>({...p,x:p.x-.4})))), 'clipped');
assert.equal(trackingQuality(hand(points.map(p=>({...p,x:.4+(p.x-.4)/4,y:.4+(p.y-.3)/4})))), 'distant');
assert.equal(stream.sample(frame,9200,'clipped'),null);assert.equal(stream.progress,0);
const occluded=new LiveLetterStream();
for(let t=0;t<1200;t+=100) occluded.sample(frame,t,'ready');
assert.equal(occluded.sample(Array(66).fill(0),1200,'missing'),null);
assert.equal(occluded.sample(Array(66).fill(0),1300,'missing'),null);
let recovered=-1;
for(let t=1400;t<=2000;t+=100){
  const window=occluded.sample(frame,t,'ready');
  if(window && occluded.confirm(yes('Й'))) recovered=t;
}
assert.equal(recovered,1800,'brief occlusion preserves the temporal window, but never emits on a missing frame');
occluded.sample(Array(66).fill(0),2100,'missing');
assert.equal(occluded.sample(frame,2600,'ready'),null,'long loss restarts even if no intermediate missing sample arrives');
assert.ok(occluded.progress<100);
occluded.acknowledge('А');
assert.equal(occluded.confirm(yes('А')),false);
assert.equal(occluded.confirm(yes('А')),false,'explicit capture must not be appended again by the stream');
console.log('Continuous recognition: timed windows, consensus, rejection, duplicate suppression, deliberate repeats, stalled video and hand quality checks passed.');
