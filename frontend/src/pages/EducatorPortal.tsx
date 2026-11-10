import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import PageLayout from '../components/PageLayout'
import AssignmentReview from '../components/AssignmentReview'
import { StatusBadge } from '../components/AttemptsPanel'
import { createAssignment, deleteAssignment, listAssignments, type Assignment } from '../api/assignments'
import { listScenarios, type Scenario } from '../api/scenarios'
import { listPersonas, type Persona } from '../api/personas'
import type { Status } from '../api/results'

type PracticeModule = { id: number; name: string; scenarioId: number; personaId: number }
type ClassGroup = { id: string; courseCode: string; section: string; studentIds: string[] }
type LocalAssignment = { id: string; moduleId: number; classId: string; studentId: string; status: Status }
type Modal = 'class' | 'module' | null

const sampleStudents = Array.from({ length: 9 }, (_, i) => ({ id: String(i + 1), name: `Student ${i + 1}` }))
const sampleScenarios = [
  { id: 1, title: 'Initial Patient Assessment' },
  { id: 2, title: 'Patient Communication' },
  { id: 3, title: 'Clinical Interview' },
]
const samplePersonas = [
  { id: 1, title: 'Patient A' },
  { id: 2, title: 'Patient B' },
  { id: 3, title: 'Patient C' },
]
const statuses: Status[] = ['assigned', 'in_progress', 'completed', 'reviewed']

function readStored<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key)
    const value: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(value) ? value as T[] : []
  } catch {
    return []
  }
}

// Both older prototype keys are retained to avoid losing locally created records.
const MODULE_KEY = 'vera-prototype-modules'
const CLASS_KEY = 'vera-prototype-classes-v2'
const LOCAL_ASSIGNMENT_KEY = 'vera-educator-local-assignments-v1'

export default function EducatorPortal() {
  const [modules, setModules] = useState<PracticeModule[]>(() => readStored<PracticeModule>(MODULE_KEY))
  const [classes, setClasses] = useState<ClassGroup[]>(() => readStored<ClassGroup>(CLASS_KEY))
  const [localAssignments, setLocalAssignments] = useState<LocalAssignment[]>(() => readStored<LocalAssignment>(LOCAL_ASSIGNMENT_KEY))
  const [modal, setModal] = useState<Modal>(null)
  const [moduleName, setModuleName] = useState('')
  const [moduleScenarioId, setModuleScenarioId] = useState('')
  const [modulePersonaId, setModulePersonaId] = useState('')
  const [courseCode, setCourseCode] = useState('')
  const [section, setSection] = useState('')
  const [selectedStudents, setSelectedStudents] = useState<string[]>([])
  const [formError, setFormError] = useState('')
  const [selectedModule, setSelectedModule] = useState('')
  const [selectedClass, setSelectedClass] = useState('')
  const [localNotice, setLocalNotice] = useState('')
  const [expandedClasses, setExpandedClasses] = useState<string[]>([])
  const [expandedModules, setExpandedModules] = useState<number[]>([])

  // Existing backend-connected educator features remain available below.
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [personas, setPersonas] = useState<Persona[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [studentId, setStudentId] = useState('')
  const [scenarioId, setScenarioId] = useState('')
  const [personaId, setPersonaId] = useState('')
  const [filterStudentId, setFilterStudentId] = useState('')
  const [filterStatus, setFilterStatus] = useState<Status | ''>('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [apiError, setApiError] = useState('')
  const [apiNotice, setApiNotice] = useState('')

  useEffect(() => { localStorage.setItem(MODULE_KEY, JSON.stringify(modules)) }, [modules])
  useEffect(() => { localStorage.setItem(CLASS_KEY, JSON.stringify(classes)) }, [classes])
  useEffect(() => { localStorage.setItem(LOCAL_ASSIGNMENT_KEY, JSON.stringify(localAssignments)) }, [localAssignments])

  useEffect(() => {
    if (!modal) return
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') setModal(null) }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [modal])

  useEffect(() => {
    let active = true
    // Independent requests ensure a 401 for assignments doesn't hide public/local UI.
    Promise.allSettled([listScenarios(), listPersonas(), listAssignments()]).then(results => {
      if (!active) return
      if (results[0].status === 'fulfilled') setScenarios(results[0].value)
      if (results[1].status === 'fulfilled') setPersonas(results[1].value)
      if (results[2].status === 'fulfilled') setAssignments(results[2].value)
      const failed = results.some(result => result.status === 'rejected')
      if (failed) setApiError('Some live API data is unavailable. Sign-in may be required; local class and module tools still work.')
      setLoading(false)
    })
    return () => { active = false }
  }, [])

  const refresh = useCallback(async (student = '', status: Status | '' = '') => {
    const rows = await listAssignments({
      ...(student.trim() ? { studentId: student.trim() } : {}),
      ...(status ? { status } : {}),
    })
    setAssignments(rows)
  }, [])

  const scenarioOptions = scenarios.length ? scenarios.map(s => ({ id: s.id, title: s.title })) : sampleScenarios
  const personaOptions = personas.length ? personas.map(p => ({ id: p.id, title: p.title || p.identity?.name || `Persona #${p.id}` })) : samplePersonas
  const scenarioTitle = (id: number) => scenarioOptions.find(s => s.id === id)?.title || `Scenario #${id}`
  const personaTitle = (id: number) => personaOptions.find(p => p.id === id)?.title || `Persona #${id}`
  const moduleTitle = (id: number) => modules.find(m => m.id === id)?.name || `Module #${id}`
  const classTitle = (id: string) => classes.find(c => c.id === id)?.id || id

  function openModal(which: Exclude<Modal, null>) {
    setFormError('')
    setModal(which)
  }

  function createModule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const scenario = Number(moduleScenarioId)
    const persona = Number(modulePersonaId)
    if (!moduleName.trim() || !Number.isSafeInteger(scenario) || scenario <= 0 || !Number.isSafeInteger(persona) || persona <= 0) {
      setFormError('Enter a module name and choose both a scenario and a persona.')
      return
    }
    const nextId = Math.max(0, ...modules.map(m => m.id)) + 1
    setModules(old => [...old, { id: nextId, name: moduleName.trim(), scenarioId: scenario, personaId: persona }])
    setModuleName(''); setModuleScenarioId(''); setModulePersonaId('')
    setModal(null)
    setLocalNotice('Module created in browser storage.')
  }

  function createClass(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const course = courseCode.trim().toUpperCase()
    const sec = section.trim().toUpperCase()
    if (!course || !sec || !selectedStudents.length) {
      setFormError('Enter a course and section, then select at least one student.')
      return
    }
    const id = `${course}-${sec}`
    if (classes.some(c => c.id === id)) {
      setFormError('This course section already exists.')
      return
    }
    setClasses(old => [...old, { id, courseCode: course, section: sec, studentIds: [...selectedStudents] }])
    setCourseCode(''); setSection(''); setSelectedStudents([])
    setModal(null)
    setLocalNotice(`Class ${id} created in browser storage.`)
  }

  function deleteClass(id: string) {
    if (!window.confirm(`Delete class ${id} and its local assignment records?`)) return
    setClasses(old => old.filter(c => c.id !== id))
    setLocalAssignments(old => old.filter(a => a.classId !== id))
    if (selectedClass === id) setSelectedClass('')
    setLocalNotice(`Class ${id} removed locally.`)
  }

  function deleteModule(id: number) {
    if (!window.confirm(`Delete ${moduleTitle(id)} and its local assignment records?`)) return
    setModules(old => old.filter(m => m.id !== id))
    setLocalAssignments(old => old.filter(a => a.moduleId !== id))
    if (selectedModule === String(id)) setSelectedModule('')
    setLocalNotice('Module removed locally.')
  }

  function assignModule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const group = classes.find(c => c.id === selectedClass)
    const module = modules.find(m => m.id === Number(selectedModule))
    if (!group || !module) { setLocalNotice('Select an existing class and module.'); return }
    const existing = new Set(localAssignments.map(a => `${a.classId}|${a.moduleId}|${a.studentId}`))
    const newAssignments = group.studentIds.filter(id => !existing.has(`${group.id}|${module.id}|${id}`)).map(id => ({
      id: `${group.id}|${module.id}|${id}`, classId: group.id, moduleId: module.id, studentId: id, status: 'assigned' as Status,
    }))
    setLocalAssignments(old => [...old, ...newAssignments])
    setLocalNotice(`${newAssignments.length} local assignment(s) added. No backend requests were made.`)
  }

  async function handleAssign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setApiError(''); setApiNotice('')
    const scenario = Number(scenarioId), persona = Number(personaId)
    if (!Number.isSafeInteger(scenario) || scenario <= 0 || !Number.isSafeInteger(persona) || persona <= 0 || !/^[1-9]\d*$/.test(studentId.trim())) {
      setApiError('Choose a valid scenario, persona, and student profile ID.'); return
    }
    setSaving(true)
    try {
      await createAssignment(scenario, persona, studentId.trim())
      setStudentId(''); setScenarioId(''); setPersonaId('')
      setApiNotice('Live assignment created successfully.')
      await refresh(filterStudentId, filterStatus)
    } catch (e) { setApiError(e instanceof Error ? e.message : 'Unable to create assignment') }
    finally { setSaving(false) }
  }

  async function handleUnassign(row: Assignment) {
    if (!window.confirm(`Unassign ${scenarioTitle(row.scenarioId)} from student ${row.studentId}? Attempt data may also be affected.`)) return
    setSaving(true); setApiError(''); setApiNotice('')
    try { await deleteAssignment(row.id); setApiNotice(`Assignment #${row.id} removed.`); await refresh(filterStudentId, filterStatus) }
    catch (e) { setApiError(e instanceof Error ? e.message : 'Unable to unassign') }
    finally { setSaving(false) }
  }

  async function applyFilters() {
    setLoading(true); setApiError('')
    try { await refresh(filterStudentId, filterStatus) }
    catch (e) { setApiError(e instanceof Error ? e.message : 'Unable to load assignments') }
    finally { setLoading(false) }
  }

  return (
    <PageLayout>
      <main className="educator-unified">
        <h1>Educator Portal</h1>
        <p className="educator-lead">Create modules, manage classes, and monitor student progress.</p>

        <section className="educator-panel">
          <h2>Class Management</h2>
          <p>Organize students into course sections before assigning modules.</p>
          <div className="educator-actions">
            <button type="button" onClick={() => openModal('class')}>+ Create Class</button>
            <button type="button" onClick={() => openModal('module')}>+ Create Module</button>
            <Link to="/scenario-creator" className="educator-link-button">Scenario Creator</Link>
            <Link to="/persona-creator" className="educator-link-button">Persona Creator</Link>
          </div>
          <p className="educator-help">Classes and modules are saved in this browser until backend storage is available.</p>
          {localNotice && <p className="educator-message" role="status">{localNotice}</p>}
        </section>

        <section className="educator-panel">
          <h2>Assign Module to Class</h2>
          <form className="educator-form" onSubmit={assignModule}>
            <div className="educator-form-grid">
              <label>Module<select value={selectedModule} onChange={e => setSelectedModule(e.target.value)} required><option value="">Choose module</option>{modules.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
              <label>Class<select value={selectedClass} onChange={e => setSelectedClass(e.target.value)} required><option value="">Choose class</option>{classes.map(c => <option key={c.id} value={c.id}>{c.courseCode} — {c.section}</option>)}</select></label>
            </div>
            <button type="submit" disabled={!modules.length || !classes.length}>Assign to Class (Local Preview)</button>
          </form>
          <p className="educator-help">Generates one local assignment per student. This does not write assignments to Supabase.</p>
        </section>

        <details className="educator-panel educator-section-fold">
          <summary className="educator-section-summary">
            <span>Created Classes</span>
            <span className="educator-section-meta">{classes.length} classes</span>
          </summary>
          <div className="educator-section-body">
          {classes.length === 0 ? <p>No classes yet. Select Create Class to get started.</p> : classes.map(group => (
            <div className="educator-record" key={group.id}>
              <div className="educator-record-header">
                <button className="educator-accordion" type="button" aria-expanded={expandedClasses.includes(group.id)} onClick={() => setExpandedClasses(old => old.includes(group.id) ? old.filter(id => id !== group.id) : [...old, group.id])}>
                  <span>{expandedClasses.includes(group.id) ? '▾' : '▸'} {group.courseCode} — Section {group.section}</span>
                  <small>{group.studentIds.length} students</small>
                </button>
                <button type="button" className="educator-danger" onClick={() => deleteClass(group.id)}>Remove</button>
              </div>
              {expandedClasses.includes(group.id) && <div className="educator-record-body"><div className="educator-chips">{group.studentIds.map(id => <span key={id}>Student {id}</span>)}</div></div>}
            </div>
          ))}
          </div>
        </details>

        <details className="educator-panel educator-section-fold">
          <summary className="educator-section-summary">
            <span>Created Modules</span>
            <span className="educator-section-meta">{modules.length} modules</span>
          </summary>
          <div className="educator-section-body">
          <p>Select a module to review its linked scenario and persona.</p>
          {modules.length === 0 ? <p>No modules created yet.</p> : modules.map(module => (
            <div className="educator-record" key={module.id}>
              <div className="educator-record-header">
                <button type="button" className="educator-accordion" aria-expanded={expandedModules.includes(module.id)} onClick={() => setExpandedModules(old => old.includes(module.id) ? old.filter(id => id !== module.id) : [...old, module.id])}>
                  <span>{expandedModules.includes(module.id) ? '▾' : '▸'} {module.name}</span>
                  <small>Module #{module.id}</small>
                </button>
                <button type="button" className="educator-danger" onClick={() => deleteModule(module.id)}>Remove</button>
              </div>
              {expandedModules.includes(module.id) && (
                <div className="educator-record-body">
                  <p>Scenario: {scenarioTitle(module.scenarioId)} (ID {module.scenarioId})</p>
                  <p>Persona: {personaTitle(module.personaId)} (ID {module.personaId})</p>
                  <p className="educator-help">Module details are saved locally.</p>
                  <Link to="/rtc" className="educator-link-button">
                    Start Scenario
                  </Link>
                </div>
              )}
            </div>
          ))}
          </div>
        </details>

        <section className="educator-panel">
          <h2>Module Assignment Status (Local Preview)</h2>
          {localAssignments.length === 0 ? <p>No local module assignments yet.</p> : <div className="educator-scroll"><table className="educator-table"><thead><tr><th>Class</th><th>Student</th><th>Module</th><th>Status</th><th>Action</th></tr></thead><tbody>{localAssignments.map(a => <tr key={a.id}><td>{classTitle(a.classId)}</td><td>Student {a.studentId}</td><td>{moduleTitle(a.moduleId)}</td><td><select aria-label={`Status for Student ${a.studentId}`} value={a.status} onChange={e => setLocalAssignments(old => old.map(row => row.id === a.id ? { ...row, status: e.target.value as Status } : row))}>{statuses.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}</select></td><td><button type="button" className="educator-danger" onClick={() => setLocalAssignments(old => old.filter(row => row.id !== a.id))}>Remove</button></td></tr>)}</tbody></table></div>}
          <p className="educator-help">Statuses here are simulated for UI review, not reported by the backend.</p>
        </section>

        <details className="educator-panel educator-section-fold">
          <summary className="educator-section-summary">
            <span>Preview Scenarios</span>
            <span className="educator-section-meta">{scenarios.length} scenarios</span>
          </summary>
          <div className="educator-section-body">
            <p>Starting a scenario goes to the existing RTC page; this page does not change Unity integration.</p>
            {scenarios.length === 0 ? <p>Scenario previews require API access.</p> : <div className="educator-card-grid">{scenarios.map(s => <article className="educator-record-body" key={s.id}><h3>{s.title}</h3><p>{s.summary}</p><p>Difficulty: {s.difficulty}</p><Link to="/rtc" className="educator-link-button">Start</Link></article>)}</div>}
          </div>
        </details>
          
        <section className="educator-panel" aria-labelledby="live-assignment-title">
          <h2 id="live-assignment-title">Live Assignment API</h2>
          <p>The original educator backend features remain below. A valid login is required for live operations.</p>
          {apiError && <p className="educator-api-error" role="alert">{apiError}</p>}
          {apiNotice && <p className="educator-message" role="status">{apiNotice}</p>}
          <details>
            <summary>Assign an individual scenario and persona</summary>
            <form className="educator-form" onSubmit={handleAssign}>
              <div className="educator-form-grid">
                <label>Student profile ID<input value={studentId} onChange={e => setStudentId(e.target.value)} placeholder="Real student profile ID" required /></label>
                <label>Scenario<select value={scenarioId} onChange={e => setScenarioId(e.target.value)} required><option value="">Choose scenario</option>{scenarios.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}</select></label>
                <label>Persona<select value={personaId} onChange={e => setPersonaId(e.target.value)} required><option value="">Choose persona</option>{personas.map(p => <option key={p.id} value={p.id}>{p.title || p.identity?.name || `Persona #${p.id}`}</option>)}</select></label>
              </div>
              <button type="submit" disabled={saving || loading || !studentId.trim() || !scenarioId || !personaId}>{saving ? 'Assigning...' : 'Assign Scenario (API)'}</button>
            </form>
          </details>
          <details>
            <summary>Current backend assignments</summary>
            <div className="educator-form-grid">
              <label>Student filter<input value={filterStudentId} onChange={e => setFilterStudentId(e.target.value)} placeholder="All students" /></label>
              <label>Status filter<select value={filterStatus} onChange={e => setFilterStatus(e.target.value as Status | '')}><option value="">All statuses</option>{statuses.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}</select></label>
            </div>
            <button type="button" disabled={loading || saving} onClick={applyFilters}>Refresh backend assignments</button>
            {loading ? <p>Loading...</p> : assignments.length === 0 ? <p>No backend assignments loaded.</p> : <div className="educator-scroll"><table className="educator-table"><thead><tr><th>ID</th><th>Student</th><th>Scenario</th><th>Persona</th><th>Status</th><th>Action</th></tr></thead><tbody>{assignments.map(a => <tr key={a.id}><td>#{a.id}</td><td>{a.studentId}</td><td>{scenarioTitle(a.scenarioId)}</td><td>{a.personaId ? personaTitle(a.personaId) : 'Unspecified'}</td><td><StatusBadge status={a.status}/>{a.archived ? ' (Archived)' : ''}</td><td><button type="button" className="educator-danger" disabled={saving} onClick={() => handleUnassign(a)}>Unassign</button></td></tr>)}</tbody></table></div>}
          </details>
        </section>

        <div className="educator-review"><AssignmentReview /></div>

        
      </main>

      {modal && <div className="educator-modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setModal(null) }}>
        <section className="educator-modal" role="dialog" aria-modal="true" aria-labelledby="educator-modal-title">
          <div className="educator-modal-heading"><h2 id="educator-modal-title">{modal === 'module' ? 'Create Module' : 'Create Class'}</h2><button type="button" aria-label="Close dialog" className="educator-close" onClick={() => setModal(null)}>×</button></div>
          {modal === 'module' ? <form className="educator-form" onSubmit={createModule}>
            <label>Module Name<input autoFocus value={moduleName} onChange={e => setModuleName(e.target.value)} required placeholder="Enter module name" /></label>
            <label>Scenario<select value={moduleScenarioId} onChange={e => setModuleScenarioId(e.target.value)} required><option value="">Choose scenario</option>{scenarioOptions.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}</select></label>
            <label>Persona<select value={modulePersonaId} onChange={e => setModulePersonaId(e.target.value)} required><option value="">Choose persona</option>{personaOptions.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}</select></label>
            <p className="educator-help">If signed out, these are labeled demonstration choices. Modules are stored in your browser.</p>
            {formError && <p role="alert" className="educator-api-error">{formError}</p>}
            <div className="educator-actions"><button type="submit">Create Module</button><button type="button" className="educator-cancel" onClick={() => setModal(null)}>Cancel</button></div>
          </form> : <form className="educator-form" onSubmit={createClass}>
            <div className="educator-form-grid"><label>Course Code<input autoFocus value={courseCode} onChange={e => setCourseCode(e.target.value)} placeholder="HLTH-3210" required /></label><label>Section<input value={section} onChange={e => setSection(e.target.value)} placeholder="D01" required /></label></div>
            <fieldset className="educator-students"><legend>Select Students</legend><div className="educator-student-grid">{sampleStudents.map(s => <label key={s.id}><input type="checkbox" checked={selectedStudents.includes(s.id)} onChange={() => setSelectedStudents(old => old.includes(s.id) ? old.filter(id => id !== s.id) : [...old, s.id])}/>{s.name}</label>)}</div></fieldset>
            <p>{selectedStudents.length} students selected</p>
            {formError && <p role="alert" className="educator-api-error">{formError}</p>}
            <div className="educator-actions"><button type="submit">Create Class</button><button type="button" className="educator-cancel" onClick={() => setModal(null)}>Cancel</button></div>
          </form>}
        </section>
      </div>}
    </PageLayout>
  )
}
