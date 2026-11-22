// Local read-only acceptance run: uses a signed test session, never publishes or writes to the DB.
const { chromium } = require('playwright');
const { encode } = require('next-auth/jwt');
const { loadEnvConfig } = require('@next/env');
const { createClient } = require('@supabase/supabase-js');
const { mkdirSync } = require('node:fs');
const assert = require('node:assert/strict');
loadEnvConfig(process.cwd());
(async()=>{
 const base=process.env.BASE_URL || 'http://localhost:3000', out='/tmp/limbus-workspace-preview';mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try {
  const guest=await browser.newPage();
  await guest.goto(base+'/ja/decks/new?fork=abc');assert(guest.url().includes('/ja/login?callbackUrl='));
  await guest.goto(base+'/ko/planner?tab=gift');assert(guest.url().includes('/ko/login?callbackUrl='));await guest.close();
  const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SECRET_KEY).schema('limbus');
  const {data:identities,error}=await db.from('identities').select('id,sinner_id,name_kr').eq('rarity',1);if(error)throw error;
  const unique=[...new Map(identities.map(i=>[i.sinner_id,i])).values()].slice(0,12);
  const draft={title:'거울 던전 편성',contentType:'거던5층',description:'## 운영 노트\n\n편성한 인격의 스킬과 기프트를 추가해 보세요.',deckSlotIds:Object.fromEntries(unique.map(i=>[i.sinner_id,i.id])),formationOrder:[]};
  const context=await browser.newContext({viewport:{width:1536,height:1024}});
  const token=await encode({secret:process.env.NEXTAUTH_SECRET,token:{sub:'local-workspace-acceptance',name:'Local preview',isSuspended:false},maxAge:3600});
  await context.addCookies([{name:'next-auth.session-token',value:token,url:base,httpOnly:true,sameSite:'Lax'}]);
  await context.addInitScript(d=>localStorage.setItem('limbus-deck-draft',JSON.stringify(d)),draft);
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/ko/decks/new',{timeout:120000});
  await page.getByRole('button',{name:/불러오기/}).first().click({timeout:120000});

  await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].filter(i=>i.getBoundingClientRect().top<innerHeight).map(i=>i.decode().catch(()=>{})))});
  await page.screenshot({path:out+'/deck-desktop.png',fullPage:true});
  const buttons=await page.locator('.deck-workspace-actions>button,.deck-workspace-actions>div:first-child>button:first-child').evaluateAll(items=>items.map(item=>{const r=item.getBoundingClientRect();return {y:r.y,width:r.width,height:r.height}}));
  assert.equal(buttons.length,3);assert(buttons.every(r=>Math.abs(r.y-buttons[0].y)<1 && r.height===buttons[0].height));
  await page.getByRole('link',{name:'덱 노트',exact:true}).click();
  await page.locator('.note-document-content').waitFor();
  await page.getByRole('button',{name:'스킬 추가',exact:true}).click();
  await page.locator('.note-direct-item').first().waitFor();
  assert.equal(await page.locator('.note-direct-sidebar>button').count(),13);
  assert.equal(await page.locator('.note-direct-picker .lucide-plus').count(),0);
  assert.equal(await page.locator('.note-direct-preview').count(),0);
  assert.equal((await page.locator('.note-direct-item').first().innerText()).trim(),'스킬 1');
  await page.screenshot({path:out+'/skill-desktop.png'});
  const add=page.locator('.note-direct-item').first();await add.click();
  await page.locator('.note-direct-picker').waitFor({state:'detached'});
  assert.equal(await page.locator('.note-asset-node--skill').count(),1);
  await page.getByRole('button',{name:'스킬 추가',exact:true}).click();await add.focus();await page.keyboard.press('Enter');
  await page.locator('.note-direct-picker').waitFor({state:'detached'});
  assert.equal(await page.locator('.note-asset-node--skill').count(),2);
  await page.getByRole('button',{name:'기프트 추가',exact:true}).click();await page.locator('.note-direct-item').first().waitFor();
  assert.equal(await page.locator('.note-direct-picker select').count(),0);
  await page.getByRole('button',{name:'기프트 등급',exact:true}).click();
  assert.equal(await page.getByRole('menuitem').count(),7);
  await page.getByRole('menuitem',{name:'Ⅲ',exact:true}).click();
  assert.equal(await page.locator('.note-direct-picker section').count(),1);
  assert((await page.locator('.note-direct-picker section h3').innerText()).includes('Ⅲ'));
  await page.getByRole('button',{name:'기프트 등급',exact:true}).click();await page.getByRole('menuitem',{name:'모든 등급',exact:true}).click();
  await page.locator('.note-direct-item').first().focus();await page.evaluate(async()=>{await Promise.all([...document.querySelectorAll('.note-direct-picker img')].filter(i=>i.getBoundingClientRect().top<innerHeight).map(i=>i.decode().catch(()=>{})))});await page.screenshot({path:out+'/gift-desktop.png'});
  await page.locator('.note-direct-item').first().click();await page.locator('.note-direct-picker').waitFor({state:'detached'});assert.equal(await page.locator('.note-asset-node--gift').count(),1);
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:out+'/deck-mobile.png',fullPage:true});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.getByRole('button',{name:'기프트 추가',exact:true}).click();await page.screenshot({path:out+'/gift-mobile.png'});await page.keyboard.press('Escape');
  // Only selected identities are exposed, even without formation numbers.
  const empty=await page.request.get(base+'/api/notes/assets?kind=skill&identities=');assert.deepEqual(await empty.json(),[]);
  const subset=await page.request.get(base+'/api/notes/assets?kind=skill&identities='+unique[11].id);const subsetData=await subset.json();assert(subsetData.length>0);assert(subsetData.every(a=>a.identity.id===unique[11].id));
  await page.reload();await page.locator('.deck-workspace').waitFor();
  const cdp=await context.newCDPSession(page);await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});await page.reload();await page.locator('.deck-workspace').waitFor();await cdp.send('Network.setCacheDisabled',{cacheDisabled:false});

  await page.setViewportSize({width:1536,height:1024});
  await page.goto(base+'/ko/planner',{timeout:120000});
  const card=page.locator('.planner-deck-identity-card').first();await card.focus();
  await card.getByRole('button',{name:'편성 이상',exact:true}).click();
  await page.getByRole('dialog').getByRole('button').filter({hasText:'LCB 수감자'}).first().click();
  await page.getByRole('tab',{name:'E.G.O',exact:true}).click();
  await page.getByRole('button',{name:'E.G.O 선택 이상',exact:true}).click();
  await page.getByRole('dialog').locator('img[src*="ego-stages/5.webp"]').first().waitFor();
  await page.screenshot({path:out+'/planner-ego-v.png'});await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'미리보기',exact:true}).click();
  await page.getByRole('button',{name:'스킬 추가',exact:true}).click();
  await page.locator('.note-direct-item').first().waitFor();
  assert.equal(await page.locator('.note-direct-sidebar>button').count(),2);
  await page.keyboard.press('Escape');
  assert.equal(errors.length,0,errors.join('\n'));

  console.log(JSON.stringify({passed:true,screenshots:out,identities:unique.length}));
 } finally {await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
