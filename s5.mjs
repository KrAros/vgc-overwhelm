import puppeteer from 'puppeteer-core'
const b = await puppeteer.launch({ executablePath:'/usr/bin/google-chrome', headless:'new', args:['--no-sandbox','--disable-gpu','--hide-scrollbars'] })
for (const w of [360, 1280]) {
  const p = await b.newPage()
  await p.setViewport({ width:w, height:900, deviceScaleFactor:2, isMobile:w<640, hasTouch:w<640 })
  await p.evaluateOnNewDocument((s)=>{localStorage.setItem('lang','it');localStorage.setItem('vgc-overwhelm-teams',JSON.stringify(s))}, JSON.parse(process.argv[2]))
  await p.goto('http://localhost:4173/vgc-overwhelm/',{waitUntil:'networkidle0'})
  console.log(w+'px →', await p.evaluate(()=>{
    const righe=[...document.querySelectorAll('select.w-12')].map(s=>{
      const r=s.parentElement.parentElement          // gruppo stadio → StatRow
      return Math.round(r.getBoundingClientRect().height)
    })
    const cur=[...new Set([...document.querySelectorAll('input[type=range]')].filter(e=>e.getBoundingClientRect().width>0).map(e=>Math.round(e.getBoundingClientRect().width)))]
    return `altezze riga statistica ${JSON.stringify([...new Set(righe)])} · cursori ${JSON.stringify(cur)} · scroll ${document.documentElement.scrollWidth-document.documentElement.clientWidth}`
  }))
  await p.close()
}
await b.close()
