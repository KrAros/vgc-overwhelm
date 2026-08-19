import puppeteer from 'puppeteer-core'
const b = await puppeteer.launch({ executablePath:'/usr/bin/google-chrome', headless:'new', args:['--no-sandbox','--disable-gpu','--hide-scrollbars'] })
for (const w of [360, 1280]) {
  const p = await b.newPage()
  await p.setViewport({ width:w, height:900, deviceScaleFactor:2, isMobile:w<640, hasTouch:w<640 })
  await p.evaluateOnNewDocument((s)=>{localStorage.setItem('lang','it');localStorage.setItem('vgc-overwhelm-teams',JSON.stringify(s))}, JSON.parse(process.argv[2]))
  await p.goto('http://localhost:4173/vgc-overwhelm/',{waitUntil:'networkidle0'})
  console.log(w+'px →', await p.evaluate(()=>{
    const cur=[...document.querySelectorAll('input[type=range]')].filter(e=>e.getBoundingClientRect().width>0)
    const sel=document.querySelector('select.w-12')
    const stessaRiga = sel && cur[0] && Math.abs(sel.getBoundingClientRect().top-cur[0].getBoundingClientRect().top)<6
    const larghezze=[...new Set(cur.map(e=>Math.round(e.getBoundingClientRect().width)))]
    return `cursori ${JSON.stringify(larghezze)} · stadio in linea: ${stessaRiga?'sì':'NO'} · scroll ${document.documentElement.scrollWidth-document.documentElement.clientWidth}px`
  }))
  await p.close()
}
await b.close()
