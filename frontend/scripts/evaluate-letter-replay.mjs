import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {build} from 'rolldown';
const dir=await mkdtemp(join(tmpdir(),'letter-replay-'));
const root=new URL('../../',import.meta.url);
const json=async path=>JSON.parse(await readFile(new URL(path,root),'utf8'));
try {
 for(const name of ['liveRecognition','phraseCapture','temporal']) await build({input:fileURLToPath(new URL(`../src/sign/${name}.ts`,import.meta.url)),output:{file:join(dir,name+'.mjs'),format:'es'}});
 const {LiveLetterStream}=await import(pathToFileURL(join(dir,'liveRecognition.mjs')));
 const {agreeLetters}=await import(pathToFileURL(join(dir,'phraseCapture.mjs')));
 const {recognizeSequence,completedLetterFrames}=await import(pathToFileURL(join(dir,'temporal.mjs')));
 const baseline=await json('frontend/public/models/rsl/alphabet-classifier.json');
 const cautious=await json('frontend/public/models/rsl/alphabet-cautious-classifier.json');
 const candidate=await json('frontend/public/models/rsl/alphabet-v4-classifier.json');
 const input=process.argv[2];if(!input)throw Error('Pass a replay-frames.json path');
 const clips=JSON.parse(await readFile(input,'utf8'));
 const cases=clips.map(clip=>{
  const output={label:clip.label,id:clip.id,samples:clip.samples.length};
  const full=completedLetterFrames(clip.samples.map(s=>s.quality==='ready'?s.frame:Array(66).fill(0)));
  const captured=full?recognizeSequence(full,candidate):null;
  output.completed= captured?.accepted ? captured.label : null;
  for(const mode of ['strict','balanced']){
   const stream=new LiveLetterStream(), emitted=[],predictions=[];
   for(const {frame,now,quality} of clip.samples){
    const window=stream.sample(frame,now,quality);
    if(!window)continue;
    const prediction=mode==='strict'?agreeLetters(recognizeSequence(window,baseline),recognizeSequence(window,cautious)):recognizeSequence(window,candidate);
    predictions.push({label:prediction?.label,accepted:prediction?.accepted});
    if(stream.confirm(prediction))emitted.push(prediction.label);
   }
   output[mode]={emitted,windows:predictions.length};
  }
  return output;
 });
 const report={scope:'Eight preselected held-out Bukva clips replayed at camera cadence through Python MediaPipe VIDEO extraction and actual JS streaming code; not a live webcam benchmark',cases};
 if(process.argv[3])await writeFile(process.argv[3],JSON.stringify(report,null,2));
 console.log(JSON.stringify(report,null,2));
}finally{await rm(dir,{recursive:true,force:true})}
