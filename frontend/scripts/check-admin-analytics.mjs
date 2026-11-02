import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const source=await readFile(new URL('../src/admin/analytics.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020}}).outputText;
const {userAnalytics}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const users=[
{id:'a',fullName:'A',role:'Student',isDisabled:false,createdAt:'2026-10-31T23:59:59Z'},
{id:'b',fullName:'B',role:'Admin',isDisabled:false,createdAt:'2026-11-01T00:00:00Z'},
{id:'c',fullName:'C',role:'Lecturer',isDisabled:true,createdAt:'2026-10-01T00:00:00Z'},
{id:'d',fullName:'D',role:'Student',isDisabled:false,createdAt:'invalid'}];
const now=new Date('2026-11-01T10:00:00Z');
const a=userAnalytics(users,7,now);
assert.equal(a.total,4); assert.equal(a.enabled,3); assert.equal(a.disabled,1); assert.equal(a.added,2);
assert.deepEqual(a.daily.slice(-2).map(d=>d.count),[1,1]);
assert.equal(a.daily[0].date,'2026-10-26');
assert.deepEqual(a.roles.map(r=>r.count),[2,1,1]);
assert.equal(a.recent[0].id,'b');
assert.equal(userAnalytics(users,90,now).added,3);
const empty=userAnalytics([],30,now);assert.equal(empty.added,0);assert.equal(empty.total,0);assert.equal(empty.daily.length,30);
assert.equal(userAnalytics([{...users[0],createdAt:'2026-11-01T12:00:00Z'}],7,now).added,0,'future dates excluded');
console.log('Admin analytics: actual totals, roles, disabled accounts, date boundaries, periods, empty state and invalid dates passed.');
