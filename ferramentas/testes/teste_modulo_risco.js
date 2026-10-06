const { chromium, fs, rotas, extra } = require('./comum');
(async()=>{ const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const ctx=await b.newContext({viewport:{width:1366,height:900}}); const p=await ctx.newPage(); const log=[];
 p.on('pageerror',e=>log.push('ERRO '+e.message)); p.on('console',m=>{ if(m.type()==='error') log.push('CONSOLE '+m.text()); }); p.on('dialog', d=>d.accept()); await rotas(p, log); await extra(p);
 await p.goto('http://localhost:8765/ucs.html?uc=Serra%20do%20Cabral&mod=risco'); await p.waitForTimeout(400);
 await p.fill('#email','rodolfo@teste.br'); await p.fill('#senha','x'); await p.click('#formLogin button'); await p.waitForTimeout(6000);
 console.log('abas:', await p.$$eval('.abas-mod button', x=>x.map(b=>b.textContent.trim()+(b.classList.contains('pronto')?'✓':''))).catch(e=>e.message));
 console.log('cab:', (await p.textContent('.rk-cab').catch(e=>'sem cab: '+e.message)).replace(/\s+/g,' ').slice(0,300));
 console.log('quads:', await p.$$eval('#rkQuads tr', x=>x.length));
 await p.screenshot({path:'/tmp/m6a.png', fullPage:true});
 // clique numa célula
 const mb = await p.$('#mapaRisco').then(e=>e.boundingBox()); await p.mouse.click(mb.x+mb.width/2, mb.y+mb.height/2); await p.waitForTimeout(400);
 console.log('popup:', (await p.textContent('.leaflet-popup-content').catch(()=>'nenhum')).replace(/\s+/g,' '));
 await p.click('[name=rkPar][value=ressalvas]'); await p.fill('#rkNota','Teste de conferência');
 await p.keyboard.press('Escape'); await p.evaluate(()=>document.querySelector('.leaflet-popup-close-button')?.click()); await p.selectOption('#rkTipo','inicio'); await p.click('#rkMarcar'); await p.click('#mapaRisco',{position:{x:mb.width/2+60,y:mb.height/2+40}}); await p.waitForTimeout(300);
 console.log('btn:', await p.textContent('#rkMarcar'), await p.$$eval('#rkMarcas li', x=>x.map(e=>e.textContent.trim().slice(0,60)))); await p.fill('[data-nota="0"]','queima de pasto em agosto');
 await p.selectOption('#rkTipo','agua'); await p.click('#rkMarcar'); await p.click('#mapaRisco',{position:{x:mb.width/2-80,y:mb.height/2-50}}); await p.waitForTimeout(300);
 await p.click('#rkSalvar'); await p.waitForTimeout(1500); console.log('salvar:', await p.textContent('#msg'), await p.textContent('#rkEstado'));
 const [w] = await Promise.all([ctx.waitForEvent('page'), p.click('#rkImprimir')]); await w.waitForTimeout(1500);
 await w.screenshot({path:'/tmp/m6sec14.png', fullPage:true});
 await p.reload(); await p.waitForTimeout(6000);
 console.log('apos reload marcas:', await p.$$eval('#rkMarcas li', x=>x.map(e=>e.textContent.replace(/\s+/g,' ').trim())), await p.$$eval('#rkMarcas input', x=>x.map(e=>e.value)));
 await p.screenshot({path:'/tmp/m6b.png', fullPage:false});
 // UC sem mapa
 await p.goto('http://localhost:8765/ucs.html?uc=Serra%20Verde&mod=risco'); await p.waitForTimeout(5000);
 console.log('sem mapa:', (await p.textContent('#mod-conteudo')).replace(/\s+/g,' ').slice(0,120));
 console.log(log.join('\n')); await b.close(); })();
