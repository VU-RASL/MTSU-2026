import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import PageLayout from '../components/PageLayout'
import AssignmentReview from '../components/AssignmentReview'
import { StatusBadge } from '../components/AttemptsPanel'
import { createAssignment, deleteAssignment, listAssignments, type Assignment } from '../api/assignments'
import { listScenarios, type Scenario } from '../api/scenarios'
import { listPersonas, type Persona } from '../api/personas'
import {
  listStudents, listModules, listClasses, createModule as createModuleApi,
  createClass as createClassApi, deleteModule as deleteModuleApi,
  deleteClass as deleteClassApi, addStudentToClass, removeStudentFromClass,
  assignModuleToClass, unassignModuleFromClass,
  type Student, type Module, type ClassGroup,
} from '../api/classes'
import type { Status } from '../api/results'

type Modal = 'class' | 'module' | null
const statuses: Status[] = ['assigned', 'in_progress', 'completed', 'reviewed']
const errorText = (e: unknown) => e instanceof Error ? e.message : 'Request failed. Please try again.'

export default function EducatorPortal() {
  const [modules, setModules] = useState<Module[]>([])
  const [classes, setClasses] = useState<ClassGroup[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [personas, setPersonas] = useState<Persona[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [apiError, setApiError] = useState('')
  const [apiNotice, setApiNotice] = useState('')

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
  const [expandedClasses, setExpandedClasses] = useState<number[]>([])
  const [expandedModules, setExpandedModules] = useState<number[]>([])
  const [addStudentSelections, setAddStudentSelections] = useState<Record<number,string>>({})
  const [studentId, setStudentId] = useState('')
  const [scenarioId, setScenarioId] = useState('')
  const [personaId, setPersonaId] = useState('')
  const [filterStudentId, setFilterStudentId] = useState('')
  const [filterStatus, setFilterStatus] = useState<Status | ''>('')

  const refreshAssignments = useCallback(async (student = '', status: Status | '' = '') => {
    const rows = await listAssignments({
      ...(student.trim() ? { studentId: student.trim() } : {}),
      ...(status ? { status } : {}),
    })
    setAssignments(rows)
  }, [])

  const refreshManagement = useCallback(async () => {
    const [newModules, newClasses] = await Promise.all([listModules(), listClasses()])
    setModules(newModules)
    setClasses(newClasses)
  }, [])

  const reloadAll = useCallback(async () => {
    setLoading(true)
    setApiError('')
    const results = await Promise.allSettled([
      listModules(), listClasses(), listStudents(),
      listScenarios(), listPersonas(), listAssignments(),
    ])
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        // Each response goes to its matching typed React state.
        switch (index) {
          case 0: setModules(result.value as Module[]); break
          case 1: setClasses(result.value as ClassGroup[]); break
          case 2: setStudents(result.value as Student[]); break
          case 3: setScenarios(result.value as Scenario[]); break
          case 4: setPersonas(result.value as Persona[]); break
          case 5: setAssignments(result.value as Assignment[]); break
        }
      }
    })
    const failures = results.flatMap((r, i) => r.status === 'rejected'
      ? [`${['Modules', 'Classes', 'Students', 'Scenarios', 'Personas', 'Assignments'][i]}: ${errorText(r.reason)}`]
      : [])
    if (failures.length) setApiError(`Some data could not be loaded. ${failures.join(' | ')}`)
    setLoading(false)
  }, [])

  useEffect(() => { void reloadAll() }, [reloadAll])
  useEffect(() => {
    if (!modal) return
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape' && !saving) setModal(null) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [modal, saving])

  const scenarioTitle = (id: number) => scenarios.find(s => s.id === id)?.title ?? `Scenario #${id}`
  const personaTitle = (id: number) => {
    const p = personas.find(p => p.id === id)
    return p?.title || p?.identity?.name || `Persona #${id}`
  }
  const moduleTitle = (id: number | null) => modules.find(m => m.id === id)?.name ?? (id ? `Module #${id}` : 'Individual assignment')
  const classTitle = (id: number | null) => {
    const group = classes.find(c => c.id === id)
    return group ? `${group.courseCode} — ${group.section}` : (id ? `Class #${id}` : 'Individual')
  }
  const studentTitle = (id: string) => {
    const student = students.find(s => s.id === id)
    return student ? (student.name || student.email || `Student ${id}`) : `Student ${id}`
  }

  function openModal(which: Exclude<Modal, null>) { setFormError(''); setModal(which) }

  async function handleCreateModule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const scenario = Number(moduleScenarioId), persona = Number(modulePersonaId)
    if (!moduleName.trim() || !Number.isSafeInteger(scenario) || scenario < 1 || !Number.isSafeInteger(persona) || persona < 1) {
      setFormError('Enter a module name and select both a scenario and persona.')
      return
    }
    setSaving(true); setFormError(''); setApiError('')
    try {
      await createModuleApi(moduleName.trim(), scenario, persona)
      await refreshManagement()
      setModuleName(''); setModuleScenarioId(''); setModulePersonaId('')
      setModal(null); setApiNotice('Module saved to Supabase successfully.')
    } catch (e) { setFormError(errorText(e)) }
    finally { setSaving(false) }
  }

  async function handleCreateClass(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const course = courseCode.trim().toUpperCase(), sec = section.trim().toUpperCase()
    if (!course || !sec) { setFormError('Enter a course code and section.'); return }
    setSaving(true); setFormError(''); setApiError('')
    try {
      await createClassApi(course, sec, selectedStudents)
      await refreshManagement()
      setCourseCode(''); setSection(''); setSelectedStudents([])
      setModal(null); setApiNotice(`Class ${course} — ${sec} saved to Supabase.`)
    } catch (e) { setFormError(errorText(e)) }
    finally { setSaving(false) }
  }

  async function handleDeleteModule(module: Module) {
    if (!window.confirm(`Delete module "${module.name}"? Unstarted assignments will be removed, but started assignments and their histories will be kept.`)) return
    setSaving(true); setApiError(''); setApiNotice('')
    try {
      const result = await deleteModuleApi(module.id)
      await Promise.all([refreshManagement(), refreshAssignments(filterStudentId, filterStatus)])
      if (selectedModule === String(module.id)) setSelectedModule('')
      setApiNotice(`Module removed. ${result.removed} unstarted assignment(s) removed; ${result.kept} started assignment(s) retained.`)
    } catch (e) { setApiError(errorText(e)) }
    finally { setSaving(false) }
  }

  async function handleDeleteClass(group: ClassGroup) {
    if (!window.confirm(`Delete ${group.courseCode} — ${group.section}? Unstarted assignments will be removed; started assignments and conversation histories will be kept.`)) return
    setSaving(true); setApiError(''); setApiNotice('')
    try {
      const result = await deleteClassApi(group.id)
      await Promise.all([refreshManagement(), refreshAssignments(filterStudentId, filterStatus)])
      if (selectedClass === String(group.id)) setSelectedClass('')
      setApiNotice(`Class deleted. ${result.removed} unstarted assignment(s) removed; ${result.kept} started assignment(s) retained.`)
    } catch (e) { setApiError(errorText(e)) }
    finally { setSaving(false) }
  }

  async function handleAddStudent(group: ClassGroup) {
    const id = addStudentSelections[group.id]
    if (!id) return
    setSaving(true); setApiError(''); setApiNotice('')
    try {
      const result = await addStudentToClass(group.id, id)
      await Promise.all([refreshManagement(), refreshAssignments(filterStudentId, filterStatus)])
      setAddStudentSelections(old => ({ ...old, [group.id]: '' }))
      setApiNotice(`${studentTitle(id)} added. ${result.created} assignment(s) created from existing class modules.`)
    } catch (e) { setApiError(errorText(e)) }
    finally { setSaving(false) }
  }

  async function handleRemoveStudent(group: ClassGroup, id: string) {
    if (!window.confirm(`Remove ${studentTitle(id)} from ${group.courseCode} — ${group.section}? Started assignments and conversation histories will be retained.`)) return
    setSaving(true); setApiError(''); setApiNotice('')
    try {
      const result = await removeStudentFromClass(group.id, id)
      await Promise.all([refreshManagement(), refreshAssignments(filterStudentId, filterStatus)])
      setApiNotice(`Student removed. ${result.removed} unstarted assignment(s) removed; ${result.kept} started assignment(s) retained.`)
    } catch (e) { setApiError(errorText(e)) }
    finally { setSaving(false) }
  }

  async function handleAssignModule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const classId = Number(selectedClass), moduleId = Number(selectedModule)
    if (!Number.isSafeInteger(classId) || classId < 1 || !Number.isSafeInteger(moduleId) || moduleId < 1) {
      setApiError('Choose a valid class and module.'); return
    }
    setSaving(true); setApiError(''); setApiNotice('')
    try {
      const result = await assignModuleToClass(classId, moduleId)
      await Promise.all([refreshManagement(), refreshAssignments(filterStudentId, filterStatus)])
      setApiNotice(`${moduleTitle(moduleId)} assigned to ${classTitle(classId)}. ${result.created} new assignment(s) created.`)
    } catch (e) { setApiError(errorText(e)) }
    finally { setSaving(false) }
  }

  async function handleUnassignClassModule(group: ClassGroup, moduleId: number) {
    if (!window.confirm(`Unassign "${moduleTitle(moduleId)}" from ${classTitle(group.id)}? Unstarted assignments will be removed; started work and history will remain.`)) return
    setSaving(true); setApiError(''); setApiNotice('')
    try {
      const result = await unassignModuleFromClass(group.id, moduleId)
      await Promise.all([refreshManagement(), refreshAssignments(filterStudentId, filterStatus)])
      setApiNotice(`Module unassigned from class. ${result.removed} removed; ${result.kept} retained.`)
    } catch (e) { setApiError(errorText(e)) }
    finally { setSaving(false) }
  }

  async function handleAssignIndividual(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const scenario = Number(scenarioId), persona = Number(personaId)
    if (!Number.isSafeInteger(scenario) || scenario < 1 || !Number.isSafeInteger(persona) || persona < 1 || !students.some(s => s.id === studentId)) {
      setApiError('Choose a scenario, persona, and a real student account.'); return
    }
    setSaving(true); setApiError(''); setApiNotice('')
    try {
      await createAssignment(scenario, persona, studentId)
      await refreshAssignments(filterStudentId, filterStatus)
      setStudentId(''); setScenarioId(''); setPersonaId('')
      setApiNotice('Individual assignment created successfully.')
    } catch (e) { setApiError(errorText(e)) }
    finally { setSaving(false) }
  }

  async function handleUnassignIndividual(row: Assignment) {
    if (!window.confirm(`Remove assignment #${row.id} for ${studentTitle(row.studentId)}? This can affect saved attempts. This action cannot be undone.`)) return
    setSaving(true); setApiError(''); setApiNotice('')
    try {
      await deleteAssignment(row.id)
      await refreshAssignments(filterStudentId, filterStatus)
      setApiNotice(`Assignment #${row.id} removed.`)
    } catch (e) { setApiError(errorText(e)) }
    finally { setSaving(false) }
  }

  async function handleFilter() {
    setLoading(true); setApiError('')
    try { await refreshAssignments(filterStudentId, filterStatus) }
    catch (e) { setApiError(errorText(e)) }
    finally { setLoading(false) }
  }

  const moduleAssignments = assignments.filter(a => a.classId != null && a.moduleId != null)

  return (
    <PageLayout>
      <main className="educator-unified">
        <h1>Educator Portal</h1>
        <p className="educator-lead">Create modules, manage classes, and monitor student progress.</p>

        <section className="educator-panel">
          <h2>Class Management</h2>
          <p>Organize students into course sections before assigning modules.</p>
          <div className="educator-actions">
            <button type="button" disabled={saving || loading} onClick={() => openModal('class')}>+ Create Class</button>
            <button type="button" disabled={saving || loading} onClick={() => openModal('module')}>+ Create Module</button>
            <Link to="/scenario-creator" className="educator-link-button">Scenario Creator</Link>
            <Link to="/persona-creator" className="educator-link-button">Persona Creator</Link>
            <button type="button" disabled={loading || saving} onClick={() => void reloadAll()}>Refresh Data</button>
          </div>
          <p className="educator-help">Classes, modules, and enrollments are stored in Supabase through the authenticated backend.</p>
          {apiError && <p className="educator-api-error" role="alert">{apiError}</p>}
          {apiNotice && <p className="educator-message" role="status">{apiNotice}</p>}
        </section>

        <section className="educator-panel">
          <h2>Assign Module to Class</h2>
          <form className="educator-form" onSubmit={handleAssignModule}>
            <div className="educator-form-grid">
              <label>Module<select value={selectedModule} onChange={e => setSelectedModule(e.target.value)} required><option value="">Choose module</option>{modules.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
              <label>Class<select value={selectedClass} onChange={e => setSelectedClass(e.target.value)} required><option value="">Choose class</option>{classes.map(c => <option key={c.id} value={c.id}>{c.courseCode} — {c.section}</option>)}</select></label>
            </div>
            <button type="submit" disabled={saving || loading || !modules.length || !classes.length || !selectedClass || !selectedModule}>{saving ? 'Saving...' : 'Assign Module to Class'}</button>
          </form>
          <p className="educator-help">This creates real assignments for each enrolled student. Repeating an existing class/module pairing does not duplicate assignments.</p>
        </section>

        <details className="educator-panel educator-section-fold">
          <summary className="educator-section-summary"><span>Created Classes</span><span className="educator-section-meta">{classes.length} {classes.length === 1 ? 'class' : 'classes'}</span></summary>
          <div className="educator-section-body">
            {classes.length === 0 ? <p>No classes found. Create one to get started.</p> : classes.map(group => (
              <div className="educator-record" key={group.id}>
                <div className="educator-record-header">
                  <button className="educator-accordion" type="button" aria-expanded={expandedClasses.includes(group.id)} onClick={() => setExpandedClasses(old => old.includes(group.id) ? old.filter(id => id !== group.id) : [...old, group.id])}>
                    <span>{expandedClasses.includes(group.id) ? '▾' : '▸'} {group.courseCode} — Section {group.section}</span>
                    <small>{group.studentIds.length} students · {group.moduleIds.length} modules</small>
                  </button>
                  <button type="button" className="educator-danger" disabled={saving} onClick={() => void handleDeleteClass(group)}>Remove</button>
                </div>
                {expandedClasses.includes(group.id) && <div className="educator-record-body">
                  <h3>Enrolled Students</h3>
                  <div className="educator-chips">
                    {group.studentIds.length === 0 && <p>No students enrolled.</p>}
                    {group.studentIds.map(id => <span key={id}>{studentTitle(id)} <button className="educator-chip-remove" type="button" disabled={saving} onClick={() => void handleRemoveStudent(group, id)} aria-label={`Remove ${studentTitle(id)}`}>×</button></span>)}
                  </div>
                  <div className="educator-inline-controls">
                    <select aria-label={`Add student to ${classTitle(group.id)}`} value={addStudentSelections[group.id] ?? ''} onChange={e => setAddStudentSelections(old => ({ ...old, [group.id]: e.target.value }))}>
                      <option value="">Choose student to add</option>
                      {students.filter(s => !group.studentIds.includes(s.id)).map(s => <option key={s.id} value={s.id}>{s.name || `Student ${s.id}`} {s.email ? `(${s.email})` : ''}</option>)}
                    </select>
                    <button type="button" disabled={saving || !addStudentSelections[group.id]} onClick={() => void handleAddStudent(group)}>Add Student</button>
                  </div>
                  <h3>Assigned Modules</h3>
                  {group.moduleIds.length === 0 ? <p>No modules assigned yet.</p> : group.moduleIds.map(id => <div className="educator-inline-row" key={id}><span>{moduleTitle(id)}</span><button type="button" className="educator-danger" disabled={saving} onClick={() => void handleUnassignClassModule(group, id)}>Unassign from Class</button></div>)}
                </div>}
              </div>
            ))}
          </div>
        </details>

        <details className="educator-panel educator-section-fold">
          <summary className="educator-section-summary"><span>Created Modules</span><span className="educator-section-meta">{modules.length} {modules.length === 1 ? 'module' : 'modules'}</span></summary>
          <div className="educator-section-body">
            <p>Select a module to review its linked scenario and persona.</p>
            {modules.length === 0 ? <p>No modules found.</p> : modules.map(module => <div className="educator-record" key={module.id}>
              <div className="educator-record-header">
                <button type="button" className="educator-accordion" aria-expanded={expandedModules.includes(module.id)} onClick={() => setExpandedModules(old => old.includes(module.id) ? old.filter(id => id !== module.id) : [...old, module.id])}>
                  <span>{expandedModules.includes(module.id) ? '▾' : '▸'} {module.name}</span><small>Module #{module.id}</small>
                </button>
                <button type="button" className="educator-danger" disabled={saving} onClick={() => void handleDeleteModule(module)}>Remove</button>
              </div>
              {expandedModules.includes(module.id) && <div className="educator-record-body">
                <p>Scenario: {scenarioTitle(module.scenarioId)} (ID {module.scenarioId})</p>
                <p>Persona: {personaTitle(module.personaId)} (ID {module.personaId})</p>
                <p className="educator-help">Module data is saved in Supabase. An actual student assignment is required to start an RTC session.</p>
              </div>}
            </div>)}
          </div>
        </details>

        <section className="educator-panel">
          <h2>Module Assignment Status</h2>
          <p>Live status from Supabase. Audit opens the selected student's saved conversation history.</p>
          <button type="button" disabled={saving || loading} onClick={() => void handleFilter()}>Refresh Assignment Status</button>
          {loading ? <p>Loading assignments...</p> : moduleAssignments.length === 0 ? <p>No class module assignments found.</p> : <div className="educator-scroll"><table className="educator-table">
            <thead><tr><th>Class</th><th>Student</th><th>Module</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>{moduleAssignments.map(a => <tr key={a.id}>
              <td>{classTitle(a.classId)}</td><td>{studentTitle(a.studentId)}</td><td>{moduleTitle(a.moduleId)}</td>
              <td><StatusBadge status={a.status}/>{a.archived ? ' (Archived)' : ''}</td>
              <td><div className="educator-row-actions"><Link to={`/conversations?assignmentId=${a.id}`} className="educator-link-button">Audit</Link><button type="button" className="educator-danger" disabled={saving} onClick={() => void handleUnassignIndividual(a)}>Remove</button></div></td>
            </tr>)}</tbody>
          </table></div>}
          <p className="educator-help">Removing an individual assignment may affect its history. To remove an entire class/module relationship while retaining started work, use Unassign from Class above.</p>
        </section>

        <details className="educator-panel educator-section-fold">
          <summary className="educator-section-summary"><span>Preview Scenarios</span><span className="educator-section-meta">{scenarios.length} scenarios</span></summary>
          <div className="educator-section-body">
            <p>Educators can review scenario details here. Voice sessions start from the Student Portal using a real assignment ID.</p>
            {scenarios.length === 0 ? <p>Scenario previews require API access.</p> : <div className="educator-card-grid">{scenarios.map(s => <article className="educator-record-body" key={s.id}><h3>{s.title}</h3><p>{s.summary}</p><p>Difficulty: {s.difficulty}</p></article>)}</div>}
          </div>
        </details>

        <section className="educator-panel" aria-labelledby="live-assignment-title">
          <h2 id="live-assignment-title">Individual Assignments (API)</h2>
          <p>Educators can still assign a scenario/persona to one student independently of a class.</p>
          <details>
            <summary>Assign an individual scenario and persona</summary>
            <form className="educator-form" onSubmit={handleAssignIndividual}>
              <div className="educator-form-grid">
                <label>Student<select value={studentId} onChange={e => setStudentId(e.target.value)} required><option value="">Choose student</option>{students.map(s => <option key={s.id} value={s.id}>{s.name || `Student ${s.id}`} {s.email ? `(${s.email})` : ''}</option>)}</select></label>
                <label>Scenario<select value={scenarioId} onChange={e => setScenarioId(e.target.value)} required><option value="">Choose scenario</option>{scenarios.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}</select></label>
                <label>Persona<select value={personaId} onChange={e => setPersonaId(e.target.value)} required><option value="">Choose persona</option>{personas.map(p => <option key={p.id} value={p.id}>{p.title || p.identity?.name || `Persona #${p.id}`}</option>)}</select></label>
              </div>
              <button type="submit" disabled={saving || loading || !studentId || !scenarioId || !personaId}>{saving ? 'Assigning...' : 'Assign Scenario (API)'}</button>
            </form>
          </details>
          <details>
            <summary>Current backend assignments ({assignments.length})</summary>
            <div className="educator-form-grid">
              <label>Student filter<input value={filterStudentId} onChange={e => setFilterStudentId(e.target.value)} placeholder="All students" /></label>
              <label>Status filter<select value={filterStatus} onChange={e => setFilterStatus(e.target.value as Status | '')}><option value="">All statuses</option>{statuses.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}</select></label>
            </div>
            <button type="button" disabled={loading || saving} onClick={() => void handleFilter()}>Apply Filters / Refresh</button>
            {loading ? <p>Loading...</p> : assignments.length === 0 ? <p>No assignments loaded.</p> : <div className="educator-scroll"><table className="educator-table">
              <thead><tr><th>ID</th><th>Student</th><th>Scenario</th><th>Persona</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>{assignments.map(a => <tr key={a.id}><td>#{a.id}</td><td>{studentTitle(a.studentId)}</td><td>{scenarioTitle(a.scenarioId)}</td><td>{a.personaId ? personaTitle(a.personaId) : 'Unspecified'}</td><td><StatusBadge status={a.status}/>{a.archived ? ' (Archived)' : ''}</td><td><div className="educator-row-actions"><Link to={`/conversations?assignmentId=${a.id}`} className="educator-link-button">Audit</Link><button type="button" className="educator-danger" disabled={saving} onClick={() => void handleUnassignIndividual(a)}>Unassign</button></div></td></tr>)}</tbody>
            </table></div>}
          </details>
        </section>

        <div className="educator-review"><AssignmentReview /></div>
      </main>

      {modal && <div className="educator-modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget && !saving) setModal(null) }}>
        <section className="educator-modal" role="dialog" aria-modal="true" aria-labelledby="educator-modal-title">
          <div className="educator-modal-heading"><h2 id="educator-modal-title">{modal === 'module' ? 'Create Module' : 'Create Class'}</h2><button type="button" aria-label="Close dialog" className="educator-close" disabled={saving} onClick={() => setModal(null)}>×</button></div>
          {modal === 'module' ? <form className="educator-form" onSubmit={handleCreateModule}>
            <label>Module Name<input autoFocus maxLength={200} value={moduleName} onChange={e => setModuleName(e.target.value)} required placeholder="Enter module name" /></label>
            <label>Scenario<select value={moduleScenarioId} onChange={e => setModuleScenarioId(e.target.value)} required><option value="">Choose scenario</option>{scenarios.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}</select></label>
            <label>Persona<select value={modulePersonaId} onChange={e => setModulePersonaId(e.target.value)} required><option value="">Choose persona</option>{personas.map(p => <option key={p.id} value={p.id}>{p.title || p.identity?.name || `Persona #${p.id}`}</option>)}</select></label>
            <p className="educator-help">Module will be saved to Supabase using your educator account.</p>
            {formError && <p role="alert" className="educator-api-error">{formError}</p>}
            <div className="educator-actions"><button type="submit" disabled={saving || !scenarios.length || !personas.length}>{saving ? 'Saving...' : 'Create Module'}</button><button type="button" disabled={saving} className="educator-cancel" onClick={() => setModal(null)}>Cancel</button></div>
          </form> : <form className="educator-form" onSubmit={handleCreateClass}>
            <div className="educator-form-grid"><label>Course Code<input autoFocus maxLength={100} value={courseCode} onChange={e => setCourseCode(e.target.value)} placeholder="HLTH-3210" required /></label><label>Section<input maxLength={100} value={section} onChange={e => setSection(e.target.value)} placeholder="D01" required /></label></div>
            <fieldset className="educator-students"><legend>Select Students</legend><div className="educator-student-grid">{students.map(s => <label key={s.id}><input type="checkbox" checked={selectedStudents.includes(s.id)} onChange={() => setSelectedStudents(old => old.includes(s.id) ? old.filter(id => id !== s.id) : [...old, s.id])}/><span>{s.name || `Student ${s.id}`}<small>{s.email ? ` · ${s.email}` : ''}</small></span></label>)}</div></fieldset>
            {students.length === 0 && <p className="educator-help">No student profiles are available. You can create an empty class and enroll students later.</p>}
            <p>{selectedStudents.length} students selected</p>
            {formError && <p role="alert" className="educator-api-error">{formError}</p>}
            <div className="educator-actions"><button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Create Class'}</button><button type="button" disabled={saving} className="educator-cancel" onClick={() => setModal(null)}>Cancel</button></div>
          </form>}
        </section>
      </div>}
    </PageLayout>
  )
}
