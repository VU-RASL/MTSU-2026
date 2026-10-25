import React, { useEffect, useState } from 'react'
import Footer from '../components/Footer'
import Header from '../components/Header'

// These are the input kinds the backend schema currently supports. Keeping
// this as a union lets TypeScript catch a schema-rendering case that has not
// been implemented in the JSX below.
// Input types will be defined in the backend the front end will use this to render the correcrt type
type FieldType = 'text' | 'number' | 'textarea'

// One schema field describes both how an input should look and where its value
// belongs in the JSON request sent to the backend. For example,
// "identity.age" renders an Age input and maps the value into identity.age.
// Essentially, each feild will have this data
type FormField = {
    path: string
    label: string
    type: FieldType
    required: boolean
    multiple: boolean
}

// The endpoint returns one schema object containing an ordered list of fields.
// This is what will be holding all of our fields and their data.
type FormSchema = {
    fields: FormField[]
}

// This recursive JSON type describes the nested object/array values that a
// persona request may contain, while keeping the payload type-safe.
type JsonObject = { [key: string]: JsonValue }
type JsonValue = string | number | JsonObject | JsonValue[]

// Fetch results start as "unknown"; this guard checks that a value is a
// non-null, non-array object before the code accesses it as an object.
// We want to validate the response during runtime so if a field changes we wont get errors
function isObject(value: unknown): value is JsonObject {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// Validate the response at runtime because TypeScript types do not validate
// network data. If the backend schema shape changes unexpectedly, the page
// reports an error instead of trying to render malformed field definitions.
// This just checks to make sure the JSON we have is actually the schema.
function isFormSchema(value: unknown): value is FormSchema {
    if (!isObject(value) || !Array.isArray(value.fields)) {
        return false
    }

    return value.fields.every((field: unknown) => {
        if (!isObject(field)) {
            return false
        }

        return typeof field.path === 'string'
            && field.path.length > 0
            && typeof field.label === 'string'
            && (field.type === 'text' || field.type === 'number' || field.type === 'textarea')
            && typeof field.required === 'boolean'
            && typeof field.multiple === 'boolean'
    })
}

// Place a value at a dot-separated path in the nested JSON object.
// Example: path "identity.age", value 42 becomes { identity: { age: 42 } }.
// This makes the generated request use the same nested structure expected by
// the backend's Persona JSON parser.
// Just sets the actual value and path to the correct place in JSON objects
function setNestedValue(root: JsonObject, path: string, value: JsonValue) {
    const parts = path.split('.')
    let current = root

    parts.forEach((part, index) => {
        // The final path segment receives the actual form value.
        if (index === parts.length - 1) {
            current[part] = value
            return
        }

        // Create intermediate objects as needed, such as "identity" when
        // processing the "identity.age" path.
        let child = current[part]
        if (!isObject(child)) {
            child = {}
            current[part] = child
        }
        current = child
    })
}
// the main function that will render the page
const PersonaCreator: React.FC = () => {
    // schema is empty at first until rendered then we set the values in the form
    const [schema, setSchema] = useState<FormSchema | null>(null)
    const [values, setValues] = useState<Record<string, string>>({})

    // Separate UI states let the page show the appropriate loading indicator,
    // disable duplicate submissions, and report API or validation problems.
    // mainly just for error handling so we can see if its still loading or if there is an error.
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')

    // We will grab the schema from the backend and will use it to make the form
    // we will also error check for pretty much anything that could go wrong with the fetch and will display it to the user
    useEffect(() => {
        async function loadSchema() {
            const response = await fetch('/api/personas/schema')
            if (!response.ok) {
                throw new Error(`Could not load the persona form (${response.status})`)
            }

            // Parse as unknown and validate before storing it as FormSchema.
            const data: unknown = await response.json()
            if (!isFormSchema(data)) {
                throw new Error('The backend returned an invalid persona form schema')
            }

            setSchema(data)
        }

        // A rejected fetch or invalid schema is shown in the page. The finally
        // handler ensures the loading indicator stops for both success/errors.
        loadSchema()
            .catch((cause: unknown) => {
                setError(cause instanceof Error ? cause.message : 'Could not load the persona form')
            })
            .finally(() => setLoading(false))
    }, [])

    // Convert the user's current input values into the nested request JSON and
    // create a persona when the form is submitted.
    async function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
        // Keep the browser from navigating/reloading; React handles the submit.
        event.preventDefault()
        if (!schema) {
            return
        }

        // Clear prior feedback so the status shown corresponds to this attempt.
        setError('')
        setSuccess('')

        // Start with an empty object and add every submitted schema field at
        // its declared path. Input state is text, so numbers/lists need
        // conversion here before JSON is sent.
        const payload: JsonObject = {}
        for (const field of schema.fields) {
            const rawValue = values[field.path] ?? ''

            if (field.type === 'number') {
                // Blank optional number fields are omitted. This lets the
                // backend retain its own default for an unset age.
                if (rawValue === '') {
                    continue
                }

                // The current backend expects age as an integer, not the
                // string value emitted by a browser input.
                const numberValue = Number(rawValue)
                if (!Number.isInteger(numberValue)) {
                    setError(`${field.label} must be a whole number`)
                    return
                }
                setNestedValue(payload, field.path, numberValue)
            } else if (field.multiple) {
                // Multiple-value textareas use one line per item. Trim
                // whitespace and discard blank lines to create a clean array.
                const listValue = rawValue
                    .split('\n')
                    .map((item) => item.trim())
                    .filter((item) => item.length > 0)
                setNestedValue(payload, field.path, listValue)
            } else {
                // Ordinary text/textarea values remain strings in the payload.
                setNestedValue(payload, field.path, rawValue)
            }
        }

        // Stop a second click from sending the same create request while the
        // backend is processing this one.
        setSubmitting(true)
        try {
            // POST creates a new persona. JSON.stringify serializes the nested
            // payload, and Content-Type tells Crow to expect JSON in the body.
            const response = await fetch('/api/personas', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })

            // The backend returns JSON on both success and API errors; the
            // error response includes an "error" message when available.
            const result: unknown = await response.json()
            if (!response.ok) {
                const message = isObject(result) && typeof result.error === 'string'
                    ? result.error
                    : `Could not create persona (${response.status})`
                throw new Error(message)
            }

            // Clear entered values only after successful creation and give the
            // user confirmation. The server-generated id/date remain server-side.
            setValues({})
            setSuccess('Persona created successfully.')
        } catch (cause) {
            // Network errors and backend validation errors are surfaced in the
            // page instead of silently leaving the user without feedback.
            setError(cause instanceof Error ? cause.message : 'Could not create persona')
        } finally {
            // Always re-enable the submit button, including after a failure.
            setSubmitting(false)
        }
    }

    return (
        <>
            <Header />
            <div className="content">
                <div className="persona-creator">
                    <h1 style={{ color: 'white' }}>Persona Creator</h1>

                    {/* Display distinct feedback states above the generated form. */}
                    {loading && <p>Loading form...</p>}
                    {error && <p role="alert">{error}</p>}
                    {success && <p role="status">{success}</p>}

                    {/* Do not show an empty/static form before its schema arrives. */}
                    {schema && (
                        <form onSubmit={handleSubmit}>
                            {/* A schema entry creates one labeled input. Using
                                the backend path as the key/ID keeps labels,
                                state, and payload mapping tied to that field. */}
                            {schema.fields.map((field) => (
                                <div key={field.path} className="form-group">
                                    <label htmlFor={field.path}>{field.label}</label>
                                    {/* Textareas and inputs share the same state
                                        model; the schema chooses which control
                                        is rendered and whether it is required. */}
                                    {field.type === 'textarea' ? (
                                        <textarea
                                            id={field.path}
                                            required={field.required}
                                            value={values[field.path] ?? ''}
                                            onChange={(event) => setValues({
                                                ...values,
                                                [field.path]: event.target.value,
                                            })}
                                        />
                                    ) : (
                                        <input
                                            id={field.path}
                                            type={field.type}
                                            required={field.required}
                                            // Age uses integer steps to align
                                            // browser input with API validation.
                                            step={field.type === 'number' ? 1 : undefined}
                                            value={values[field.path] ?? ''}
                                            onChange={(event) => setValues({
                                                ...values,
                                                [field.path]: event.target.value,
                                            })}
                                        />
                                    )}
                                    {/* Explain how a list-valued textarea is
                                        converted into an array on submission. */}
                                    {field.multiple && <small>Enter one item per line.</small>}
                                </div>
                            ))}
                            {/* Disable repeat submits while the POST is pending,
                                and make the button label reflect that state. */}
                            <button type="submit" disabled={submitting}>
                                {submitting ? 'Creating...' : 'Create Persona'}
                            </button>
                        </form>
                    )}
                </div>
            </div>
            <Footer />
        </>
    )
}

export default PersonaCreator
