import {test,expect} from '@playwright/test'
test.use({channel:'chrome'})
test.skip(({browserName})=>browserName!=='chromium','Installed Chrome visual check')
const id='00000000-0000-4000-8000-000000000001'
for(const width of [1440,390])test(`workspace controls and privacy ${width}`,async({page},info)=>{
 test.setTimeout(90000);await page.setViewportSize({width,height:1000})
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message))
 await page.route('**/api/auth/session',r=>r.fulfill({json:{user:{name:'QA',email:'qa@example.invalid'},expires:'2099-01-01'}}))
 let following=false,followers=false
 const profile={id,username:'QA',bio:'갂 뷁 힣',public_profile:true,created_at:'2026-09-01'}
 await page.route('**/api/profile',r=>r.fulfill({json:{profile,email:'qa@example.invalid',decks:[],bookmarkedDecks:[],stats:{deckCount:0,planCount:0,bookmarkCount:0,totalVotesReceived:0}}}))
 await page.route('**/api/community/me',async r=>{if(r.request().method()==='PATCH'){const b=r.request().postDataJSON();following=b.public_following??following;followers=b.public_followers??followers}await r.fulfill({json:{profile,stats:{points:0,deck:0,plan:0,like:0,contribution:0},decks:[],plans:[],eggs:[],settings:{public_profile:true,public_following:following,public_followers:followers,notify_comments:true,notify_follows:true,notify_posts:true}}})})
 await page.route('**/api/community/profiles/*/follows*',r=>r.fulfill({json:{owner:true,following_count:0,follower_count:0,public_following:following,public_followers:followers,can_view:true,is_following:false,items:[]}}))
 await page.goto('/ko/mypage?tab=profile')
 // The site notice opens once per visitor after hydration and hides the page from the accessibility tree. The corner X, not the footer button: on a phone the dev badge covers that one.
 const popup=page.getByRole('dialog').filter({has:page.locator('[data-announcement-popup]')})
 await popup.getByRole('button',{name:'닫기'}).first().click();await expect(popup).toHaveCount(0)
 const toggle=page.getByRole('switch',{name:'팔로잉 목록 공개',exact:true})
 await expect(toggle).toHaveAttribute('aria-checked','false');await toggle.focus();await page.keyboard.press('Space');await expect(toggle).toHaveAttribute('aria-checked','true')
 await expect(page.getByRole('switch',{name:'팔로워 목록 공개',exact:true})).toHaveAttribute('aria-checked','false')
 await page.reload();await expect(toggle).toHaveAttribute('aria-checked','true')
 await page.screenshot({path:info.outputPath(`mypage-${width}.png`),fullPage:true})
 await page.getByRole('tab',{name:/도전과제/}).click();await page.getByRole('button',{name:'팔로워 0',exact:true}).click();await expect(page.getByRole('button',{name:'팔로워',exact:true})).toHaveAttribute('aria-pressed','true');await expect(page.getByRole('region',{name:'팔로우 목록'})).toBeVisible()
 await page.getByRole('button',{name:'팔로워',exact:true}).click();await expect(page.getByText('아직 목록에 관리자가 없습니다.',{exact:true})).toBeVisible()
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1)
 await page.route('**/api/inquiries',r=>r.fulfill({json:[]}))
 await page.goto('/ko/support');await page.getByRole('button',{name:'새 문의',pressed:false}).click()
 await page.getByRole('button',{name:'데이터 수정',exact:true}).click();await expect(page.getByRole('button',{name:'데이터 수정',exact:true})).toHaveAttribute('aria-pressed','true')
 await page.getByLabel('제목',{exact:true}).fill('갂 뷁 힣 한글 제목')
 await page.getByLabel('내용',{exact:true}).fill('한글 입력이 남아 있어야 합니다.')
 await page.screenshot({path:info.outputPath(`support-${width}.png`),fullPage:true})
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1)
 await page.route('**/api/developer/keys',r=>r.fulfill({json:{keys:[{id,name:'QA key',prefix:'lmb_preview',revoked_at:null,developer_usage:[{day:'2026-09-12',requests:24}]}]}}))
 await page.goto('/ko/developers');await page.getByText('QA key',{exact:true}).waitFor()
 const box=await page.locator('[aria-labelledby="api-keys-heading"]').filter({visible:true}).boundingBox(), limits=await page.locator('[aria-labelledby="api-limits-heading"]').filter({visible:true}).boundingBox()
 if(width>1000){expect(Math.abs(box!.height-limits!.height)).toBeLessThan(1);expect(box!.y).toEqual(limits!.y)}
 await page.getByRole('button',{name:'플랜',exact:true}).click();await expect(page.getByText('GET /api/v1/planners?limit=20&offset=0',{exact:false})).toBeVisible()
 await page.getByRole('button',{name:'요청 예시 복사',exact:true}).click();await expect(page.getByRole('status')).toHaveText('복사했습니다.')
 await page.screenshot({path:info.outputPath(`developer-${width}.png`),fullPage:true})
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1)
 await page.getByRole('link',{name:'추가 한도 요청하기',exact:true}).click();await expect(page).toHaveURL(/\/ko\/support\?topic=api-limit$/);await expect(page.getByLabel('제목',{exact:true})).toHaveValue('API 추가 한도 요청');await expect(page.locator('.desk-choice').getByRole('button',{name:'기타',exact:true})).toHaveAttribute('aria-pressed','true');await expect(page.getByLabel('내용',{exact:true})).toBeEmpty();
 await page.goto('/ko/announcements');await page.locator('main a[href*="/announcements/"]').first().click();await expect(page).toHaveURL(/\/ko\/announcements\/[0-9a-f-]{36}$/);await expect(page.locator('article h1')).toBeVisible();await page.getByRole('link',{name:'공지사항',exact:true}).click();await expect(page).toHaveURL(/\/ko\/announcements$/)
 expect(errors).toEqual([])
})
