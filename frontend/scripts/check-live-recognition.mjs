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
assert.equal(firstAccepted,1900,'two agreeing windows should confirm after 1.9 seconds at target cadence');
const slower=new LiveLetterStream();let slowAccepted=-1;
for(let now=0;now<=4000;now+=200){
  if(slower.sample(fastFrame,now,'ready') && slower.confirm({accepted:true,label:'А'})) slowAccepted=now;
}
assert.equal(slowAccepted,3800,'slow hardware must still provide all samples, never fake early acceptance');
const stream=new LiveLetterStream();
const frame=Array(66).fill(0);frame[65]=0.2;
let windows=0;
for(let i=0;i<20;i++){if(stream.sample(frame,i*150,'ready')) windows++;}
assert.equal(windows,2,'first 16-frame window then four-frame stride');
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
console.log('Continuous recognition: timed windows, consensus, rejection, duplicate suppression, deliberate repeats, stalled video and hand quality checks passed.');
