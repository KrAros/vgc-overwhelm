import OptionsPanel from './components/OptionsPanel'
import FieldsPanel from './components/FieldsPanel'
import ModifiersPanel from './components/ModifiersPanel'
import DamageTable from './components/DamageTable'
import PokemonSelector from './components/PokemonSelector'
import DebugPanel from './components/DebugPanel'

function App() {
  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <h1 className="text-3xl font-bold text-center text-red-500 mb-6">
        VGC Damage Calculator
      </h1>
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-3 gap-4 mb-4">
          <OptionsPanel />
          <FieldsPanel />
          <ModifiersPanel />
        </div>
        <DebugPanel />
        <PokemonSelector />
        <DamageTable />
      </div>
    </div>
  )
}

export default App