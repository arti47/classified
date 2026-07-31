import { chromium } from "playwright-core";
import { listen } from "./tests/serve.js";
import { existsSync, readdirSync } from "fs"; import { join } from "path";
function find(){const r="/opt/pw-browsers";for(const d of readdirSync(r))for(const rel of ["chrome-linux/chrome","chrome-linux/headless_shell"]){const p=join(r,d,rel);if(existsSync(p))return p;}}
const {server,port}=await listen(0);
const b=await chromium.launch({executablePath:find(),args:["--no-sandbox"]});
const page=await (await b.newContext({viewport:{width:360,height:880}})).newPage();
const errs=[];page.on("pageerror",e=>errs.push(""+e));page.on("console",m=>{if(m.type()==="error")errs.push(m.text());});
await page.route("**/*",r=>r.request().url().startsWith(`http://127.0.0.1:${port}`)?r.continue():r.abort());
await page.goto(`http://127.0.0.1:${port}/index.html`,{waitUntil:"load"});await page.waitForSelector(".nav-btn");
await page.evaluate(()=>localStorage.setItem("classified.settings",JSON.stringify({theme:"dark",solo:true,showHelp:true,gmScreen:true,showUntrained:true,autoConditions:true,heroPointPrompt:true,campaignStyle:"adventurous"})));
await page.reload({waitUntil:"load"});await page.waitForSelector(".nav-btn");
const dir="/tmp/claude-0/-home-user-classified/60712028-8c04-5483-a8f3-e6882dbbcc64/scratchpad/";
await page.evaluate(async()=>{const S=await import("./src/store.js");S.createCharacter("agent");S.updateActive(c=>{c.identity.name="Michelle Jackson";});});
await page.evaluate(()=>{location.hash="#/solo";});await page.waitForTimeout(300);
await page.screenshot({path:dir+"start-before.png"});
await page.evaluate(()=>[...document.querySelectorAll("#screen .btn.primary")].find(b=>/Start an adventure/.test(b.textContent)).click());
await page.waitForTimeout(400);
await page.screenshot({path:dir+"start-after.png"});
console.log("state:",await page.evaluate(async()=>{const S=await import("./src/store.js");const a=S.activeAdventure();return JSON.stringify({name:a.name,phase:a.scenePhase,linked:a.characterId?"yes":"no"});}));
// now roll the codename row and commit, to prove the name lands
await page.evaluate(async()=>{const So=await import("./src/solo.js");const St=await import("./src/store.js");await So.openBriefing(St.activeAdventure());});
await page.waitForTimeout(300);
await page.screenshot({path:dir+"start-briefing.png"});
console.log("errors:",errs.length?errs:"none");
await b.close();server.close();
