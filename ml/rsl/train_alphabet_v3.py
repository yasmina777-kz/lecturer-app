"""Compare temporal classifiers on held-out signers, then evaluate the winner once.
Run extract_alphabet.py first. No raw test example participates in model selection.
"""
from pathlib import Path
import json, hashlib, warnings
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.neural_network import MLPClassifier
from sklearn.metrics import confusion_matrix
from extract_alphabet import aggregate
ROOT=Path(__file__).resolve().parents[2]
DATA=ROOT/'ml/rsl/data/alphabet'; OUT=ROOT/'frontend/public/models/rsl'
labels=list('АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ')+['no_event']
rows=json.loads((DATA/'manifest.json').read_text())
for r in rows:
 frames=json.loads((DATA/'features-v1'/f"{r['attachment_id']}.json").read_text())
 r['features']=aggregate(frames);r['visibility']=sum(f[65]>0 for f in frames)/16
train=[r for r in rows if r['train']=='True'];test=[r for r in rows if r['train']=='False']
trainusers={r['user_id'] for r in train};testusers={r['user_id'] for r in test}
assert not trainusers & testusers
valusers={u for u in trainusers if int(hashlib.sha256(u.encode()).hexdigest()[:8],16)%5==0}
fit=[r for r in train if r['user_id'] not in valusers];val=[r for r in train if r['user_id'] in valusers]
def xy(rs):return np.array([r['features'] for r in rs]),np.array([labels.index(r['text']) for r in rs])
def make(name):
 if name.startswith('linear'):return LogisticRegression(C=float(name.split(':')[1]),max_iter=2000,class_weight='balanced')
 return MLPClassifier(hidden_layer_sizes=(96,),alpha=float(name.split(':')[1]),max_iter=400,random_state=42,early_stopping=False)
x,y=xy(fit);vx,vy=xy(val);mean=x.mean(0);std=np.maximum(x.std(0),.05)
scores=[]
for name in ['linear:0.1','linear:1','linear:10','mlp:1','mlp:5']:
 m=make(name).fit((x-mean)/std,y)
 score=float(np.mean(m.predict((vx-mean)/std)==vy));scores.append({'candidate':name,'accuracy':score})
 print('VALIDATION',name,score,flush=True)
best=max(scores,key=lambda s:s['accuracy'])['candidate']
x,y=xy(train);mean=x.mean(0);std=np.maximum(x.std(0),.05)
m=make(best).fit((x-mean)/std,y);assert list(m.classes_)==list(range(34))
tx,ty=xy(test);probs=m.predict_proba((tx-mean)/std);pred=probs.argmax(1);ranked=np.sort(probs,axis=1)
accepted=(ranked[:,-1]>=.70)&((ranked[:,-1]-ranked[:,-2])>=.20)&(pred!=33)&(np.array([r['visibility'] for r in test])>=.5)
report={'dataset':'Bukva: 33 letters + no_event','labels':labels,'trainVideos':len(train),'testVideos':len(test),'validationVideos':len(val),'trainSigners':len(trainusers),'testSigners':len(testusers),'signerOverlap':0,'selectedModel':best,'validationScores':scores,'accuracy':float((pred==ty).mean()),'acceptedAccuracy':float((pred[accepted]==ty[accepted]).mean()) if accepted.any() else None,'acceptedCoverage':float(accepted.mean()),'acceptedCount':int(accepted.sum()),'confusionMatrix':confusion_matrix(ty,pred,labels=list(range(34))).tolist(),'perClass':[{'label':l,'tested':int((ty==i).sum()),'correct':int(((ty==i)&(pred==i)).sum())} for i,l in enumerate(labels)],'limitations':['Isolated letters only; not continuous fingerspelling, words or grammar.','Pretrained MediaPipe plus locally trained temporal classifier.','16 sampled frames; one dominant hand, no face or body.','Subset metrics are not live-camera or pedagogical accuracy.','Unknown words can be confused with letters; confidence is not proof of correctness.'],'source':'https://github.com/ai-forever/bukva','trainingScript':'ml/rsl/train_alphabet_v3.py','testIdsSha256':hashlib.sha256('\n'.join(sorted(r['attachment_id'] for r in test)).encode()).hexdigest()}
model={'version':3,'kind':'temporal-alphabet','labels':labels,'mean':mean.tolist(),'std':std.tolist(),'threshold':.70,'margin':.20,'frames':16,'source':report['source']}
if best.startswith('mlp'):
 model.update(layers=[{'weights':w.T.tolist(),'bias':b.tolist(),'activation':'relu'} for w,b in zip(m.coefs_[:-1],m.intercepts_[:-1])],weights=m.coefs_[-1].T.tolist(),bias=m.intercepts_[-1].tolist())
else:model.update(weights=m.coef_.tolist(),bias=m.intercept_.tolist())
(OUT/'alphabet-cautious-classifier.json').write_text(json.dumps(model,ensure_ascii=False))
(OUT/'alphabet-cautious-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
indices=[next(i for i,r in enumerate(test) if r['text']==label) for label in labels]
fixtures=[{'label':test[i]['text'],'frames':json.loads((DATA/'features-v1'/f"{test[i]['attachment_id']}.json").read_text()),'features':test[i]['features'].tolist(),'probabilities':probs[i].tolist()} for i in indices]
(OUT/'alphabet-cautious-fixtures.json').write_text(json.dumps(fixtures))
# The exported provenance is regenerated with the model, so data changes remain visible.
previous=DATA/'baseline-manifest.json'
baseline_same=None
if previous.exists():
 baseline_rows=json.loads(previous.read_text())
 baseline_same={r['attachment_id'] for r in baseline_rows if r['train']=='False'}=={r['attachment_id'] for r in test}
provenance={'source':report['source'],'selection':'Up to 90 train and 18 test per class, SHA-256 ID order, official subject split','manifestSha256':hashlib.sha256((DATA/'manifest.json').read_bytes()).hexdigest(),'baselineTestIdsUnchanged':baseline_same,'testIdsSha256':report['testIdsSha256'],'classifier':best,'validation':str(len(val))+' held-out-signer train videos; compare linear C=.1,1,10 and MLP alpha=1,5; select by validation accuracy','pretrainedComponent':'MediaPipe Hand Landmarker (Google)','scripts':['ml/rsl/prepare_alphabet.py --train-per-class 90','ml/rsl/extract_alphabet.py','ml/rsl/train_alphabet_v3.py'],'deployment':'Optional cautious mode; baseline remains default because overall test accuracy did not improve.'}
(OUT/'alphabet-cautious-provenance.json').write_text(json.dumps(provenance,indent=2))
print('TRAINING_COMPLETE',json.dumps({k:v for k,v in report.items() if k not in ['confusionMatrix','perClass','limitations','labels']},ensure_ascii=False),flush=True)
