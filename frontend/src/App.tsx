import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import PersonaCreator from './pages/PersonaCreator'
import StudentPortal from './pages/StudentPortal'
import Learning from './pages/Learning'
import EducatorPortal from './pages/EducatorPortal'
import './App.css'
import RTC from './pages/RTC'
import TreeDemo from './pages/TreeDemo'
import Conversations from './pages/Conversations'
import Scenario from './pages/Scenario'
import Login from './pages/Login'
import Register from './pages/Register'

function App() {
  //Using react router dom to manage routing between pages.
  //currenting Router allows us to make routes to then define the route for each page.
  //We have the home page set as the default route.
  //The PersonaCreator page is accessible via the /persona-creator route.
  //The StudentPortal page is accessible via the /student-portal route.

  return (
    <>
      <Router>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/home" element={<Home />} />
          <Route path="/scenario-creator" element={<Scenario />} />
          <Route path="/persona-creator" element={<PersonaCreator />} />
          <Route path="/student-portal" element={<StudentPortal />} />
          <Route path="/learning" element={<Learning />} />
          <Route path="/educator-portal" element={<EducatorPortal />} />
          <Route path="/rtc" element={<RTC />} />
          <Route path="/tree-demo" element={<TreeDemo />} />
          <Route path="/conversations" element={<Conversations />} />
        </Routes>
      </Router>
    </>
  )
}

export default App
