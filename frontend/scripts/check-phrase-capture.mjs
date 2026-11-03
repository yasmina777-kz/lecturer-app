import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {build} from 'rolldown';
const dir=await mkdtemp(join(tmpdir(),'recognition-check-'));
try {
  for(const name of ['phraseCapture','temporal']) await build({input:fileURLToPath(new URL(`../src/sign/${name}.ts`,import.meta.url)),output:{file:join(dir,name+'.mjs'),format:'es'}});
  const {PhraseCapture,agreeLetters}=await import(pathToFileURL(join(dir,'phraseCapture.mjs')));
  const {recognizeSequence}=await import(pathToFileURL(join(dir,'temporal.mjs')));
  const segment=new PhraseCapture();
  const hand=x=>Array.from({length:21},(_,i)=>({x:x+i*.003,y:.4+i*.002}));
  segment.reset(0);
  for(let t=0;t<12000;t+=150) assert.equal(segment.sample(t,[[],[]]),'waiting');
  assert.equal(segment.sample(12000,[[],[]]),'empty');
  segment.reset(0);
  for(let t=0;t<=6000;t+=150) {
    const r=segment.sample(t,[hand(.4+Math.sin(t/300)*.1),[]]);
    assert.ok(['waiting','signing'].includes(r),'must not cut motion at four seconds');
  }
  let decision;
  for(let t=6150;t<=7650;t+=150) decision=segment.sample(t,[hand(.4),[]]);
  assert.equal(decision,'pause');
  segment.reset(0);
  for(let t=0;t<=12000;t+=150) decision=segment.sample(t,[hand(.4+Math.sin(t/300)*.1),[]]);
  assert.equal(decision,'limit','bound recording duration');
  segment.reset(0);
  for(let t=0;t<=6000;t+=150) {
    const pose=Array.from({length:33},()=>({x:.4+Math.sin(t/300)*.1,y:.5,visibility:1}));
    decision=segment.sample(t,[[],[]],pose);
  }
  assert.equal(decision,'signing','upper body motion keeps capture open when hand points are occluded');
  assert.equal(agreeLetters({label:'А',accepted:true},{label:'Б',accepted:true}).accepted,false);
  assert.equal(agreeLetters({label:'А',accepted:true},{label:'А',accepted:false}).accepted,false);
  assert.equal(agreeLetters({label:'А',accepted:true},{label:'А',accepted:true}).accepted,true);
  if(process.argv.includes('--evaluate')) {
  const root=new URL('../../',import.meta.url);
  const json=async path=>JSON.parse(await readFile(new URL(path,root),'utf8'));
  const primary=await json('frontend/public/models/rsl/alphabet-classifier.json');
  const verifier=await json('frontend/public/models/rsl/alphabet-cautious-classifier.json');
  const manifest=await json('ml/rsl/data/alphabet/manifest.json');
  const report={testVideos:0,baseline:{accepted:0,correct:0,wrong:0},agreement:{accepted:0,correct:0,wrong:0},limitations:'Cached isolated-video test only; no new training, no webcam or word-negative evaluation. Agreement trades coverage for fewer accepted errors.'};
  for(const row of manifest.filter(r=>r.train==='False')) {
    const frames=await json(`ml/rsl/data/alphabet/features-v1/${row.attachment_id}.json`);
    const a=recognizeSequence(frames,primary),b=recognizeSequence(frames,verifier);
    report.testVideos++;
    for(const [key,p] of [['baseline',a],['agreement',agreeLetters(a,b)]]) if(p?.accepted) {
      report[key].accepted++;report[key][p.label===row.text?'correct':'wrong']++;
    }
  }
  assert.equal(report.testVideos,612);
  assert.ok(report.agreement.wrong <= report.baseline.wrong);
  await writeFile(new URL('docs/recognition-capture-check.json',root),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report));
  }
  console.log('PASS: idle refusal, complete >4s capture, pause boundary, bounded duration, disagreement rejection');
} finally {await rm(dir,{recursive:true,force:true});}
