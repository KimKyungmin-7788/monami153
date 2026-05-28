import { Routes, Route } from 'react-router-dom'
import Landing from './pages/Landing'
import Tutorial from './pages/Tutorial'
import Assembly from './pages/Assembly'
import TwoPlayer from './pages/TwoPlayer'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/tutorial" element={<Tutorial />} />
      <Route path="/assembly" element={<Assembly />} />
      <Route path="/two-player" element={<TwoPlayer />} />
    </Routes>
  )
}

export default App
