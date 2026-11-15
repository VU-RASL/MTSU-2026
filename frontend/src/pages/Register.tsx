import { useState } from 'react'
import type { SubmitEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Footer from '../components/Footer'
import Header from '../components/Header'
import { supabase } from '../supabase'

// New accounts always start as students. An authorized maintainer promotes
// educators by changing public.profiles.role in Supabase; the backend
// ignores any role a sign-up request asks for.
const Register: React.FC = () => {
    const navigate = useNavigate()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [error, setError] = useState('')
    const [message, setMessage] = useState('')
    const [submitting, setSubmitting] = useState(false)

    async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
        event.preventDefault()
        setError('')
        setMessage('')

        if (password !== confirmPassword) {
            setError('Passwords do not match')
            return
        }

        setSubmitting(true)
        try {
            const { data, error: signUpError } = await supabase.auth.signUp({ email, password })
            if (signUpError) throw signUpError

            if (data.session) {
                navigate('/home', { replace: true })
            } else {
                setMessage('Account created. Check your email for a confirmation link, then sign in.')
            }
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Registration failed')
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <>
            <Header variant="public" />
            <main className="login-container">
                <div className="content">
                    <h1>Register</h1>
                    <form onSubmit={handleSubmit}>
                        <label htmlFor="register-email">Email</label>
                        <input
                            type="email"
                            id="register-email"
                            autoComplete="email"
                            required
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                        />
                        <label htmlFor="register-password">Password</label>
                        <input
                            type="password"
                            id="register-password"
                            autoComplete="new-password"
                            required
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                        />
                        <label htmlFor="confirm-password">Confirm password</label>
                        <input
                            type="password"
                            id="confirm-password"
                            autoComplete="new-password"
                            required
                            value={confirmPassword}
                            onChange={(event) => setConfirmPassword(event.target.value)}
                        />
                        <p>New accounts start as students. Educators: ask your program administrator to upgrade your account.</p>
                        {error && <p role="alert">{error}</p>}
                        {message && <p role="status">{message}</p>}
                        <button type="submit" disabled={submitting}>
                            {submitting ? 'Creating account…' : 'Create account'}
                        </button>
                    </form>
                    <p>Already registered? <Link to="/">Log in</Link></p>
                </div>
            </main>
            <Footer />
        </>
    )
}

export default Register
