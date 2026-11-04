
import PageLayout from '../components/PageLayout'

export default function EducatorPortalPrototype() {
    return (
        <PageLayout>
            <section className="educator-portal">
                <h1>Educator Portal — Prototype</h1>

                <p>
                    Experimental educator interface.
                    Module and class functionality is not
                    connected to the backend yet.
                </p>

                <section className="module-creator">
                    <h2>Create Module</h2>
                    {/* Module name, scenario and persona dropdowns */}
                </section>

                <section className="class-management">
                    <h2>Manage Classes</h2>
                    {/* Create class and enroll students */}
                </section>

                <section className="module-assignment">
                    <h2>Assign Module to Class</h2>
                    {/* Select an existing module and class */}
                </section>

                <section className="assignment-status">
                    <h2>Student Progress</h2>
                    {/* Assigned, in progress, completed */}
                </section>
            </section>
        </PageLayout>
    )
}
