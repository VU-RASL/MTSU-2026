import React, { useState } from 'react'
import type { SubmitEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import Footer from '../components/Footer'
import { supabase } from '../supabase'

const Login: React.FC = () => {
    const navigate = useNavigate()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [submitting, setSubmitting] = useState(false)

    async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
        event.preventDefault()
        setError('')
        setSubmitting(true)

        try {
            const { error: signInError } = await supabase.auth.signInWithPassword({
                email,
                password,
            })
            if (signInError) throw signInError
            navigate('/home', { replace: true })
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Sign in failed')
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <>
            <Header variant="public" />
            <div className="login-container">
                <div className="content">
                    <h1>Login</h1>
                    <form onSubmit={handleSubmit}>
                        <label htmlFor="email">Email</label>
                        <input
                            type="email"
                            id="email"
                            autoComplete="username"
                            required
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                        />
                        <label htmlFor="password">Password</label>
                        <input
                            type="password"
                            id="password"
                            autoComplete="current-password"
                            required
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                        />
                        {error && <p role="alert">{error}</p>}
                        <button type="submit" disabled={submitting}>
                            {submitting ? 'Signing in…' : 'Login'}
                        </button>
                    </form>
                    <p>New here? <Link to="/register">Create an account</Link></p>
                </div>
            </div>
            <Footer />
        </>
    )

}

export default Login