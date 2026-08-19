import puppeteer from 'puppeteer-core'
const b = await puppeteer.launch({ executablePath:'/usr/bin/google-chrome', headless:'new', args:['--no-sandbox','--disable-gpu','--hide-scrollbars'] })
for (const w of [360, 1280]) {
  const p = await b.newPage()
  await p.setViewport({ width:w, height:900, deviceScaleFactor:2, isMobile:w<640, hasTouch:w<640 })
  await p.evaluateOnNewDocument((s)=>{localStorage.setItem('lang','it');localStorage.setItem('vgc-overwhelm-teams',JSON.stringify(s))}, JSON.parse(process.argv[2]))
  await p.goto('http://localhost:4173/vgc-overwhelm/',{waitUntil:'networkidle0'})
  console.log(w+'px →', await p.evaluate(()=>{
    // per ogni select dello stadio, il cursore DELLA STESSA RIGA
    let inLinea=0, aCapo=0, righe=0
    for (const sel of document.querySelectorAll('select.w-12')) {
      const riga = sel.closest('div.flex.items-center')?.parentElement || sel.parentElement?.parentElement
      const cur = riga?.querySelector('input[type=range]')
      if (!cur) continue
      righe++
      Math.abs(sel.getBoundingClientRect().top - cur.getBoundingClientRect().top) < 8 ? inLinea++ : aCapo++
    }
    const alt = document.querySelectorAll('div.p-3')[0]?.getBoundingClientRect().height
    return `righe ${righe} · in linea ${inLinea} · a capo ${aCapo} · altezza pannello ${Math.round(alt||0)}px`
  }))
  await p.close()
}
await b.close()
