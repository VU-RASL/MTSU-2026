import React, { useCallback, useEffect, useState } from 'react'
import Footer from '../components/Footer'
import Header from '../components/Header'
import { api } from '../api/http'

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
    description: string
    type: FieldType
    section: string
    sectionDescription: string
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

type PersonaSummary = {
    id: number
    title: string
    summary?: string
    createdAt?: string
}

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
            && typeof field.description === 'string'
            && (field.type === 'text' || field.type === 'number' || field.type === 'textarea')
            && typeof field.section === 'string'
            && typeof field.sectionDescription === 'string'
            && typeof field.required === 'boolean'
            && typeof field.multiple === 'boolean'
    })
}

function isPersonaList(value: unknown): value is PersonaSummary[] {
    return Array.isArray(value) && value.every((persona: unknown) =>
        isObject(persona)
        && Number.isInteger(persona.id)
        && typeof persona.title === 'string'
        && (persona.summary === undefined || typeof persona.summary === 'string')
        && (persona.createdAt === undefined || typeof persona.createdAt === 'string'),
    )
}

function isPersona(value: unknown): value is JsonObject {
    return isObject(value)
        && Number.isInteger(value.id)
        && typeof value.title === 'string'
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

function getNestedValue(root: JsonObject, path: string): JsonValue | undefined {
    let current: JsonValue = root
    for (const part of path.split('.')) {
        if (!isObject(current)) {
            return undefined
        }
        const next: JsonValue | undefined = current[part]
        if (next === undefined) {
            return undefined
        }
        current = next
    }
    return current
}

function getFormValues(schema: FormSchema, persona: JsonObject): Record<string, string> {
    return Object.fromEntries(schema.fields.map((field) => {
        const value = getNestedValue(persona, field.path)
        if (value === undefined) {
            throw new Error(`Persona is missing ${field.label}`)
        }

        if (field.type === 'number' && typeof value === 'number') {
            return [field.path, value < 0 ? '' : String(value)]
        }
        if (field.multiple && Array.isArray(value) && value.every((item) => typeof item === 'string')) {
            return [field.path, value.join('\n')]
        }
        if (typeof value === 'string') {
            return [field.path, value]
        }

        throw new Error(`Persona has invalid data for ${field.label}`)
    }))
}

// the main function that will render the page
const PersonaCreator: React.FC = () => {
    // schema is empty at first until rendered then we set the values in the form
    const [schema, setSchema] = useState<FormSchema | null>(null)
    const [values, setValues] = useState<Record<string, string>>({})
    const [personas, setPersonas] = useState<PersonaSummary[]>([])
    const [editingPersonaId, setEditingPersonaId] = useState<number | null>(null)

    // Separate UI states let the page show the appropriate loading indicator,
    // disable duplicate submissions, and report API or validation problems.
    // mainly just for error handling so we can see if its still loading or if there is an error.
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [listLoading, setListLoading] = useState(true)
    const [loadingPersonaId, setLoadingPersonaId] = useState<number | null>(null)
    const [deletingPersonaId, setDeletingPersonaId] = useState<number | null>(null)
    const [error, setError] = useState('')
    const [listError, setListError] = useState('')
    const [success, setSuccess] = useState('')

    const refreshPersonas = useCallback(async () => {
        setListLoading(true)
        setListError('')
        try {
            const data = await api<unknown>('/api/personas')
            if (!isPersonaList(data)) {
                throw new Error('The backend returned an invalid persona list')
            }
            setPersonas(data)
        } catch (cause) {
            setListError(cause instanceof Error ? cause.message : 'Could not load personas')
        } finally {
            setListLoading(false)
        }
    }, [])

    // We will grab the schema from the backend and will use it to make the form
    // we will also error check for pretty much anything that could go wrong with the fetch and will display it to the user
    useEffect(() => {
        async function loadSchema() {
            // Parse as unknown and validate before storing it as FormSchema.
            const data = await api<unknown>('/api/personas/schema')
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

        void refreshPersonas()
    }, [refreshPersonas])

    async function handleEdit(persona: PersonaSummary) {
        if (!schema) {
            return
        }

        setError('')
        setSuccess('')
        setLoadingPersonaId(persona.id)
        try {
            const result = await api<unknown>(`/api/personas/${persona.id}`)
            if (!isPersona(result) || result.id !== persona.id) {
                throw new Error('The backend returned invalid persona data')
            }

            setValues(getFormValues(schema, result))
            setEditingPersonaId(persona.id)
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Could not load persona')
        } finally {
            setLoadingPersonaId(null)
        }
    }

    async function handleDelete(persona: PersonaSummary) {
        if (!window.confirm(`Delete "${persona.title}"? This cannot be undone.`)) {
            return
        }

        setError('')
        setSuccess('')
        setDeletingPersonaId(persona.id)
        try {
            await api<void>(`/api/personas/${persona.id}`, { method: 'DELETE' })

            setPersonas((current) => current.filter((item) => item.id !== persona.id))
            if (editingPersonaId === persona.id) {
                setEditingPersonaId(null)
                setValues({})
            }
            setSuccess('Persona deleted successfully.')
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Could not delete persona')
        } finally {
            setDeletingPersonaId(null)
        }
    }

    function cancelEdit() {
        setEditingPersonaId(null)
        setValues({})
        setError('')
        setSuccess('')
    }

    const submitLabel = editingPersonaId === null
        ? (submitting ? 'Creating...' : 'Create Persona')
        : (submitting ? 'Saving...' : 'Save Changes')

    // Convert the user's current input values into the nested request JSON and
    // create or update a persona when the form is submitted.
    async function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
        // Keep the browser from navigating/reloading; React handles the submit.
        event.preventDefault()
        if (!schema || submitting || loadingPersonaId !== null || deletingPersonaId !== null) {
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
                // An unset age uses -1 in the backend; send it for updates so
                // clearing the age actually clears the saved value.
                if (rawValue === '') {
                    if (editingPersonaId !== null) {
                        setNestedValue(payload, field.path, -1)
                    }
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
            // POST creates a persona; PUT updates the selected persona.
            await api<unknown>(
                editingPersonaId === null ? '/api/personas' : `/api/personas/${editingPersonaId}`,
                {
                    method: editingPersonaId === null ? 'POST' : 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                },
            )

            // The server-generated id/date remain server-side.
            setValues({})
            setEditingPersonaId(null)
            setSuccess(editingPersonaId === null
                ? 'Persona created successfully.'
                : 'Persona updated successfully.')
            await refreshPersonas()
        } catch (cause) {
            // Network errors and backend validation errors are surfaced in the
            // page instead of silently leaving the user without feedback.
            setError(cause instanceof Error
                ? cause.message
                : editingPersonaId === null ? 'Could not create persona' : 'Could not update persona')
        } finally {
            // Always re-enable the submit button, including after a failure.
            setSubmitting(false)
        }
    }

    return (
        <>
            <Header />
            <div className='persona-container'>
                <div className="pcontent">
                    <div className="persona-creator">
                        <h1 style={{ color: 'white' }}>Persona Creator</h1>

                        {/* Display distinct feedback states above the generated form. */}
                        {loading && <p>Loading form...</p>}
                        {error && <p role="alert">{error}</p>}
                        {success && <p role="status">{success}</p>}

                        <section className="saved-personas" aria-labelledby="saved-personas-heading">
                            <h2 id="saved-personas-heading">Saved Personas</h2>
                            {listLoading && <p>Loading personas...</p>}
                            {listError && <p role="alert">{listError}</p>}
                            {!listLoading && !listError && personas.length === 0
                                && <p>No personas have been created yet.</p>}
                            {personas.length > 0 && (
                                <ul className="saved-persona-list">
                                    {personas.map((persona) => (
                                        <li key={persona.id} className="saved-persona">
                                            <div>
                                                <h3>{persona.title}</h3>
                                                {persona.summary && <p>{persona.summary}</p>}
                                                {persona.createdAt && <small>Created {persona.createdAt}</small>}
                                            </div>
                                            <div className="saved-persona-actions">
                                                <button
                                                    type="button"
                                                    disabled={!schema || loadingPersonaId !== null
                                                        || deletingPersonaId !== null || submitting}
                                                    onClick={() => void handleEdit(persona)}
                                                >
                                                    {loadingPersonaId === persona.id ? 'Loading...' : 'Edit'}
                                                </button>
                                                <button
                                                    type="button"
                                                    className="delete-persona-button"
                                                    disabled={loadingPersonaId !== null
                                                        || deletingPersonaId !== null || submitting}
                                                    onClick={() => void handleDelete(persona)}
                                                >
                                                    {deletingPersonaId === persona.id ? 'Deleting...' : 'Delete'}
                                                </button>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </section>

                        {/* Do not show an empty/static form before its schema arrives. */}
                        {schema && (
                            <form onSubmit={handleSubmit}>
                                <h2>{editingPersonaId === null ? 'Create a Persona' : 'Edit Persona'}</h2>
                                {/* A schema entry creates one labeled input. Using
                                    the backend path as the key/ID keeps labels,
                                    state, and payload mapping tied to that field. */}
                                {schema.fields.map((field, index) => (
                                    <React.Fragment key={field.path}>
                                        {(index === 0 || schema.fields[index - 1].section !== field.section) && (
                                            <section className="persona-form-section">
                                                <h2>{field.section}</h2>
                                                {field.sectionDescription && <p>{field.sectionDescription}</p>}
                                            </section>
                                        )}
                                        <div className="form-group">
                                            <label htmlFor={field.path}>{field.label}</label>
                                            <small>{field.description}</small>
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
                                                    step={field.type === 'number' ? 1 : undefined}
                                                    value={values[field.path] ?? ''}
                                                    onChange={(event) => setValues({
                                                        ...values,
                                                        [field.path]: event.target.value,
                                                    })}
                                                />
                                            )}
                                            {field.multiple && <small>Enter one item per line.</small>}
                                        </div>
                                    </React.Fragment>
                                ))}
                                {/* Disable repeat submits while a save is pending. */}
                                <button
                                    type="submit"
                                    disabled={submitting || loadingPersonaId !== null || deletingPersonaId !== null}
                                >
                                    {submitLabel}
                                </button>
                                {editingPersonaId !== null && (
                                    <button type="button" onClick={cancelEdit} disabled={submitting}>
                                        Cancel
                                    </button>
                                )}
                            </form>
                        )}
                    </div>
                </div>
            </div>

            <Footer />
        </>
    )
}

export default PersonaCreator
