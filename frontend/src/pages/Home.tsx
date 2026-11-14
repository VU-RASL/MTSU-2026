import React from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import Footer from '../components/Footer' 


//Basic home page which will be the way to navagate to other pages within the app.
const Home: React.FC = () => {
    //Reacts useNavigate through react router dom will allow us to use the route established in app.tsx to navigate to other pages.
    const navigate = useNavigate()
    //On button press we navigate to the persona creator page.
    function personaButton(){
        navigate('/persona-creator')
    }
    //The returned HTML shows use of multiple components including Header and Footer.
    return (
        <>
        <Header />
        <div className="home-container">
            <div className="content">
                <div className="home-content">
                    <h1>Welcome to Project Vera</h1>
                    <p>Through our platform, users can simulate real time conversations with virtual patients.</p>

                    <p>Our misson is to create a digital environment for medical professionals to practice and create scenarios for autism diagnosis and treatment.</p>
                    <p>This allows instructors to evaluate and provide feedback on the performance of medical professionals in a safe and controlled environment.</p>
                    <p>Studies have shown that medical professionals who had many opportunities to practice in a simulated environment demonstrated improved skills and confidence in real world settings.</p>

                </div>
            </div>
        </div>
        <Footer />
        </>
    )
}

export default Home