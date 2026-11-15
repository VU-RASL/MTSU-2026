import React, { useCallback, useEffect, useState, type SubmitEvent } from 'react'
import Footer from '../components/Footer'
import Header from '../components/Header'
import { api } from '../api/http'

type FieldType = 'text' | 'number' | 'textarea'

type FormField = {
    path: string
    label: string
    type: FieldType
    required: boolean
    multiple: boolean
}

type FormSchema = {
    fields: FormField[]
}

type JsonObject = { [key: string]: JsonValue }
type JsonValue = string | number | JsonObject | JsonValue[]

type ScenarioSummary = {
    id: number
    title: string
    summary?: string
    createdAt?: string
}

function isObject(value: unknown): value is JsonObject {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isFormSchema(value: unknown): value is FormSchema {
    if (!isObject(value) || !Array.isArray(value.fields)) {
        return false
    }

    return value.fields.every((field: unknown) =>
        isObject(field)
        && typeof field.path === 'string'
        && field.path.length > 0
        && typeof field.label === 'string'
        && (field.type === 'text' || field.type === 'number' || field.type === 'textarea')
        && typeof field.required === 'boolean'
        && typeof field.multiple === 'boolean',
    )
}

function isScenarioList(value: unknown): value is ScenarioSummary[] {
    return Array.isArray(value) && value.every((scenario: unknown) =>
        isObject(scenario)
        && Number.isInteger(scenario.id)
        && typeof scenario.title === 'string'
        && (scenario.summary === undefined || typeof scenario.summary === 'string')
        && (scenario.createdAt === undefined || typeof scenario.createdAt === 'string'),
    )
}

function isScenario(value: unknown): value is JsonObject {
    return isObject(value)
        && Number.isInteger(value.id)
        && typeof value.title === 'string'
}

function setNestedValue(root: JsonObject, path: string, value: JsonValue) {
    const parts = path.split('.')
    let current = root

    parts.forEach((part, index) => {
        if (index === parts.length - 1) {
            current[part] = value
            return
        }

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

function getFormValues(schema: FormSchema, scenario: JsonObject): Record<string, string> {
    return Object.fromEntries(schema.fields.map((field) => {
        const value = getNestedValue(scenario, field.path)
        if (value === undefined) {
            throw new Error(`Scenario is missing ${field.label}`)
        }

        if (field.type === 'number' && typeof value === 'number') {
            return [field.path, String(value)]
        }
        if (field.multiple && Array.isArray(value) && value.every((item) => typeof item === 'string')) {
            return [field.path, value.join('\n')]
        }
        if (typeof value === 'string') {
            return [field.path, value]
        }

        throw new Error(`Scenario has invalid data for ${field.label}`)
    }))
}

const Scenario: React.FC = () => {
    const [schema, setSchema] = useState<FormSchema | null>(null)
    const [values, setValues] = useState<Record<string, string>>({})
    const [scenarios, setScenarios] = useState<ScenarioSummary[]>([])
    const [editingScenarioId, setEditingScenarioId] = useState<number | null>(null)
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [listLoading, setListLoading] = useState(true)
    const [loadingScenarioId, setLoadingScenarioId] = useState<number | null>(null)
    const [deletingScenarioId, setDeletingScenarioId] = useState<number | null>(null)
    const [error, setError] = useState('')
    const [listError, setListError] = useState('')
    const [success, setSuccess] = useState('')

    const refreshScenarios = useCallback(async () => {
        setListLoading(true)
        setListError('')
        try {
            const data = await api<unknown>('/api/scenarios')
            if (!isScenarioList(data)) {
                throw new Error('The backend returned an invalid scenario list')
            }
            setScenarios(data)
        } catch (cause) {
            setListError(cause instanceof Error ? cause.message : 'Could not load scenarios')
        } finally {
            setListLoading(false)
        }
    }, [])

    useEffect(() => {
        async function loadSchema() {
            const data = await api<unknown>('/api/scenarios/schema')
            if (!isFormSchema(data)) {
                throw new Error('The backend returned an invalid scenario form schema')
            }
            setSchema(data)
        }

        loadSchema()
            .catch((cause: unknown) => {
                setError(cause instanceof Error ? cause.message : 'Could not load the scenario form')
            })
            .finally(() => setLoading(false))

        void refreshScenarios()
    }, [refreshScenarios])

    async function handleEdit(scenario: ScenarioSummary) {
        if (!schema) {
            return
        }

        setError('')
        setSuccess('')
        setLoadingScenarioId(scenario.id)
        try {
            const result = await api<unknown>(`/api/scenarios/${scenario.id}`)
            if (!isScenario(result) || result.id !== scenario.id) {
                throw new Error('The backend returned invalid scenario data')
            }
            setValues(getFormValues(schema, result))
            setEditingScenarioId(scenario.id)
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Could not load scenario')
        } finally {
            setLoadingScenarioId(null)
        }
    }

    async function handleDelete(scenario: ScenarioSummary) {
        if (!window.confirm(`Delete "${scenario.title}"? This cannot be undone.`)) {
            return
        }

        setError('')
        setSuccess('')
        setDeletingScenarioId(scenario.id)
        try {
            await api<void>(`/api/scenarios/${scenario.id}`, { method: 'DELETE' })
            setScenarios((current) => current.filter((item) => item.id !== scenario.id))
            if (editingScenarioId === scenario.id) {
                setEditingScenarioId(null)
                setValues({})
            }
            setSuccess('Scenario deleted successfully.')
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Could not delete scenario')
        } finally {
            setDeletingScenarioId(null)
        }
    }

    function cancelEdit() {
        setEditingScenarioId(null)
        setValues({})
        setError('')
        setSuccess('')
    }

    const submitLabel = editingScenarioId === null
        ? (submitting ? 'Creating...' : 'Create Scenario')
        : (submitting ? 'Saving...' : 'Save Changes')

    async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
        event.preventDefault()
        if (!schema || submitting || loadingScenarioId !== null || deletingScenarioId !== null) {
            return
        }

        setError('')
        setSuccess('')

        const payload: JsonObject = {}
        for (const field of schema.fields) {
            const rawValue = values[field.path] ?? ''

            if (field.type === 'number') {
                if (rawValue === '') {
                    if (editingScenarioId !== null) {
                        setNestedValue(payload, field.path, 0)
                    }
                    continue
                }

                const numberValue = Number(rawValue)
                if (!Number.isInteger(numberValue) || numberValue < 0) {
                    setError(`${field.label} must be a non-negative whole number`)
                    return
                }
                setNestedValue(payload, field.path, numberValue)
            } else if (field.multiple) {
                const listValue = rawValue
                    .split('\n')
                    .map((item) => item.trim())
                    .filter((item) => item.length > 0)
                setNestedValue(payload, field.path, listValue)
            } else {
                setNestedValue(payload, field.path, rawValue)
            }
        }

        setSubmitting(true)
        try {
            await api<unknown>(
                editingScenarioId === null ? '/api/scenarios' : `/api/scenarios/${editingScenarioId}`,
                {
                    method: editingScenarioId === null ? 'POST' : 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                },
            )

            const wasCreating = editingScenarioId === null
            setValues({})
            setEditingScenarioId(null)
            setSuccess(wasCreating ? 'Scenario created successfully.' : 'Scenario updated successfully.')
            await refreshScenarios()
        } catch (cause) {
            setError(cause instanceof Error
                ? cause.message
                : editingScenarioId === null ? 'Could not create scenario' : 'Could not update scenario')
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <>
            <Header />
            <div className='persona-container'>
                <div className="pcontent">
                    <div className="persona-creator">
                        <h1 style={{ color: 'var(--text-h)' }}>Scenario Creator</h1>

                        {loading && <p>Loading form...</p>}
                        {error && <p role="alert">{error}</p>}
                        {success && <p role="status">{success}</p>}

                        <section className="saved-personas" aria-labelledby="saved-scenarios-heading">
                            <h2 id="saved-scenarios-heading">Saved Scenarios</h2>
                            {listLoading && <p>Loading scenarios...</p>}
                            {listError && <p role="alert">{listError}</p>}
                            {!listLoading && !listError && scenarios.length === 0
                                && <p>No scenarios have been created yet.</p>}
                            {scenarios.length > 0 && (
                                <ul className="saved-persona-list">
                                    {scenarios.map((scenario) => (
                                        <li key={scenario.id} className="saved-persona">
                                            <div>
                                                <h3>{scenario.title}</h3>
                                                {scenario.summary && <p>{scenario.summary}</p>}
                                                {scenario.createdAt && <small>Created {scenario.createdAt}</small>}
                                            </div>
                                            <div className="saved-persona-actions">
                                                <button
                                                    type="button"
                                                    disabled={!schema || loadingScenarioId !== null
                                                        || deletingScenarioId !== null || submitting}
                                                    onClick={() => void handleEdit(scenario)}
                                                >
                                                    {loadingScenarioId === scenario.id ? 'Loading...' : 'Edit'}
                                                </button>
                                                <button
                                                    type="button"
                                                    className="delete-persona-button"
                                                    disabled={loadingScenarioId !== null
                                                        || deletingScenarioId !== null || submitting}
                                                    onClick={() => void handleDelete(scenario)}
                                                >
                                                    {deletingScenarioId === scenario.id ? 'Deleting...' : 'Delete'}
                                                </button>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </section>

                        {schema && (
                            <form onSubmit={handleSubmit}>
                                <h2>{editingScenarioId === null ? 'Create a Scenario' : 'Edit Scenario'}</h2>
                                {schema.fields.map((field) => (
                                    <div key={field.path} className="form-group">
                                        <label htmlFor={field.path}>{field.label}</label>
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
                                                min={field.type === 'number' ? 0 : undefined}
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
                                ))}
                                <button
                                    type="submit"
                                    disabled={submitting || loadingScenarioId !== null || deletingScenarioId !== null}
                                >
                                    {submitLabel}
                                </button>
                                {editingScenarioId !== null && (
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

export default Scenario
