const placeholder = {
  t1: [
    { name: "Landorus-T", icon: "🦁" },
    { name: "Amoonguss",  icon: "🍄" },
    { name: "Incineroar", icon: "🔥" },
    { name: "Togekiss",   icon: "🌸" },
    { name: "Urshifu-RS", icon: "💨" },
    { name: "Grimmsnarl", icon: "🌑" },
  ],
  t2: [
    { name: "Charizard-M", icon: "🦎" },
    { name: "Garchomp",    icon: "🦂" },
    { name: "Kyogre",      icon: "🧊" },
    { name: "Raichu",      icon: "⚡" },
    { name: "Venusaur",    icon: "🌿" },
    { name: "Mewtwo",      icon: "🔮" },
  ]
}

const data = [
  [
    [{mv:"Earthquake",dmg:"95–112%",cls:"ko"},{mv:"Heat Wave",dmg:"51–62%",cls:"neutral"}],
    [{mv:"Rock Slide",dmg:"23–28%",cls:"safe"},{mv:"Dragon Claw",dmg:"30–36%",cls:"neutral"}],
    [{mv:"U-turn",dmg:"18–22%",cls:"safe"},{mv:"Water Spout",dmg:"88–105%",cls:"ko"}],
    [{mv:"Earthquake",dmg:"110–130%",cls:"ko"},{mv:"Thunderbolt",dmg:"44–53%",cls:"neutral"}],
    [{mv:"Rock Slide",dmg:"45–54%",cls:"neutral"},{mv:"Sludge Bomb",dmg:"39–47%",cls:"neutral"}],
    [{mv:"Earthquake",dmg:"62–74%",cls:"neutral"},{mv:"Psystrike",dmg:"75–89%",cls:"neutral"}],
  ],
  [
    [{mv:"Sludge Bomb",dmg:"30–36%",cls:"neutral"},{mv:"Heat Wave",dmg:"62–74%",cls:"neutral"}],
    [{mv:"Giga Drain",dmg:"12–15%",cls:"safe"},{mv:"Earthquake",dmg:"55–66%",cls:"neutral"}],
    [{mv:"Sludge Bomb",dmg:"25–30%",cls:"safe"},{mv:"Water Spout",dmg:"70–83%",cls:"neutral"}],
    [{mv:"Sludge Bomb",dmg:"88–105%",cls:"ko"},{mv:"Thunderbolt",dmg:"66–79%",cls:"neutral"}],
    [{mv:"Giga Drain",dmg:"20–24%",cls:"safe"},{mv:"Sludge Bomb",dmg:"30–36%",cls:"neutral"}],
    [{mv:"Spore",dmg:"—",cls:"neutral"},{mv:"Psystrike",dmg:"93–111%",cls:"ko"}],
  ],
  [
    [{mv:"Flare Blitz",dmg:"76–91%",cls:"neutral"},{mv:"Heat Wave",dmg:"44–53%",cls:"neutral"}],
    [{mv:"Knock Off",dmg:"28–34%",cls:"safe"},{mv:"Earthquake",dmg:"72–86%",cls:"neutral"}],
    [{mv:"Fake Out",dmg:"10–13%",cls:"safe"},{mv:"Water Spout",dmg:"95–113%",cls:"ko"}],
    [{mv:"Flare Blitz",dmg:"102–121%",cls:"ko"},{mv:"Thunderbolt",dmg:"55–66%",cls:"neutral"}],
    [{mv:"Knock Off",dmg:"38–46%",cls:"neutral"},{mv:"Sludge Bomb",dmg:"25–30%",cls:"safe"}],
    [{mv:"Flare Blitz",dmg:"55–66%",cls:"neutral"},{mv:"Psystrike",dmg:"80–96%",cls:"neutral"}],
  ],
  [
    [{mv:"Air Slash",dmg:"31–38%",cls:"neutral"},{mv:"Heat Wave",dmg:"30–36%",cls:"neutral"}],
    [{mv:"Dazz. Gleam",dmg:"15–19%",cls:"safe"},{mv:"Dragon Claw",dmg:"44–53%",cls:"neutral"}],
    [{mv:"Air Slash",dmg:"22–27%",cls:"safe"},{mv:"Water Spout",dmg:"62–74%",cls:"neutral"}],
    [{mv:"Dazz. Gleam",dmg:"40–48%",cls:"neutral"},{mv:"Thunderbolt",dmg:"40–48%",cls:"neutral"}],
    [{mv:"Air Slash",dmg:"19–23%",cls:"safe"},{mv:"Sludge Bomb",dmg:"51–62%",cls:"neutral"}],
    [{mv:"Dazz. Gleam",dmg:"98–116%",cls:"ko"},{mv:"Psystrike",dmg:"66–79%",cls:"neutral"}],
  ],
  [
    [{mv:"Close Combat",dmg:"88–105%",cls:"ko"},{mv:"Heat Wave",dmg:"44–53%",cls:"neutral"}],
    [{mv:"Surging Strikes",dmg:"42–51%",cls:"neutral"},{mv:"Earthquake",dmg:"62–74%",cls:"neutral"}],
    [{mv:"Surging Strikes",dmg:"139–166%",cls:"ko"},{mv:"Water Spout",dmg:"44–53%",cls:"neutral"}],
    [{mv:"Close Combat",dmg:"120–143%",cls:"ko"},{mv:"Thunderbolt",dmg:"30–36%",cls:"neutral"}],
    [{mv:"Close Combat",dmg:"35–42%",cls:"neutral"},{mv:"Sludge Bomb",dmg:"44–53%",cls:"neutral"}],
    [{mv:"Close Combat",dmg:"60–72%",cls:"neutral"},{mv:"Psystrike",dmg:"55–66%",cls:"neutral"}],
  ],
  [
    [{mv:"Spirit Break",dmg:"20–24%",cls:"safe"},{mv:"Heat Wave",dmg:"22–27%",cls:"safe"}],
    [{mv:"Darkest Lariat",dmg:"18–22%",cls:"safe"},{mv:"Earthquake",dmg:"40–48%",cls:"neutral"}],
    [{mv:"Spirit Break",dmg:"14–17%",cls:"safe"},{mv:"Water Spout",dmg:"51–62%",cls:"neutral"}],
    [{mv:"Thunder Wave",dmg:"—",cls:"neutral"},{mv:"Thunderbolt",dmg:"22–27%",cls:"safe"}],
    [{mv:"Spirit Break",dmg:"32–39%",cls:"neutral"},{mv:"Sludge Bomb",dmg:"20–24%",cls:"safe"}],
    [{mv:"Darkest Lariat",dmg:"45–54%",cls:"neutral"},{mv:"Psystrike",dmg:"44–53%",cls:"neutral"}],
  ],
]

const cellColor = {
  ko: "bg-red-900/30",
  safe: "bg-green-900/20",
  neutral: "",
}

const dmgColor = {
  ko: "text-red-400",
  safe: "text-green-400",
  neutral: "text-teal-300",
}

export default function DamageTable() {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-700">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <th className="bg-gray-900 p-2 text-gray-500 font-medium text-center w-20">
              T1 \ T2
            </th>
            {placeholder.t2.map((p) => (
              <th key={p.name} className="bg-gray-900 p-2 text-center font-medium">
                <div className="text-lg">{p.icon}</div>
                <div className="text-gray-300 text-xs mt-1">{p.name}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {placeholder.t1.map((row, ri) => (
            <tr key={row.name} className="border-t border-gray-700">
              <td className="bg-gray-900 p-2 text-center">
                <div className="text-lg">{row.icon}</div>
                <div className="text-gray-300 text-xs mt-1">{row.name}</div>
              </td>
              {placeholder.t2.map((_, ci) => {
                const [d1, d2] = data[ri][ci]
                return (
                  <td
                    key={ci}
                    className={`p-1 text-center border-l border-gray-700 ${cellColor[d1.cls]}`}
                  >
                    <div className="mb-1 pb-1 border-b border-gray-700/50">
                      <div className="text-gray-400 truncate">▶ {d1.mv}</div>
                      <div className={`font-medium ${dmgColor[d1.cls]}`}>{d1.dmg}</div>
                    </div>
                    <div>
                      <div className="text-gray-400 truncate">◀ {d2.mv}</div>
                      <div className={`font-medium ${dmgColor[d2.cls]}`}>{d2.dmg}</div>
                    </div>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}