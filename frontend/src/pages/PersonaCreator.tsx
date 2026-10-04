import React from 'react'
import Footer from '../components/Footer'
import Header from '../components/Header'


//basic input of data where we need a name and a type of input
const formData = [
    { name: 'Name', type: 'text' },
    { name: 'Age', type: 'number' },
    { name: 'Bio', type: 'textarea' },
    { name: 'Persona Title', type: 'text'},
    { name: 'Persona Summary', type: 'textarea' },
    { name: 'Goal', type: 'textarea' }
]
//This page component will be were we set up the person creator interface and functionality.
const PersonaCreator: React.FC = () => {
    //functionality goes here
    

    //HTML output goes into the return statement below.
    return (
        <>
            <Header />
                <div className="content">
                    <div className="persona-creator">
                        <h1>Persona Creator</h1>
                        {formData.map((field) => (
                            <div key={field.name} className="form-group">
                                <label>{field.name}</label>
                                {field.type === 'textarea' ? (
                                    <textarea />
                                ) : (
                                    <input type={field.type} />
                                )}
                            </div>
                        ))}
                        <button type="submit">Create Persona</button>
                    </div>
                </div>
            <Footer />
        </>
        
    )
}


//We export the component for use by other parts of the app
export default PersonaCreator