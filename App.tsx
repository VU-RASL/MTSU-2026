import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import PersonaCreator from './pages/PersonaCreator'
import Persona from './pages/Persona' //This import statement is for the Persona page, which displays the user's persona information. 
import './App.css'


function App() {
  //Using react router dom to manage routing between pages.
  //currenting Router allows us to make routes to then define the route for each page.
  //We have the home page set as the default route.
  //The PersonaCreator page is accessible via the /persona-creator route.
  return (
    <>
      <Router>
        <Routes>
          <Route path="/persona" element={<Persona />} /> //This route is for the Persona page, which displays the user's persona information.
          <Route path="/" element={<Home />} />
          <Route path="/persona-creator" element={<PersonaCreator />} />
        </Routes>
      </Router>
    </>
  )
}

export default App
