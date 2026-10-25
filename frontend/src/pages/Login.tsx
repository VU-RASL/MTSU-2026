import React from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import Footer from '../components/Footer'

const Login: React.FC = () => {
    const navigate = useNavigate()





    return (
        <>
            <Header />
            <div className="login-container">
                <div className="content">
                    <h1>Login</h1>
                    <form>
                        <label htmlFor="username">Username</label>
                        <input type="text" id="username" /><br></br>
                        <label htmlFor="password">Password</label>
                        <input type="password" id="password" />
                    </form>
                    <button onClick={() => navigate('/home')}>Login</button>
                </div>
            </div>
            <Footer />
        </>
    )

}

export default Login