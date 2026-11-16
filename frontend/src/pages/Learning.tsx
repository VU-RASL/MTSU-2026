import React, { useState } from 'react'
import Header from '../components/Header'
import Footer from '../components/Footer'

interface LearningModule {
  id: number
  title: string
  content: React.ReactNode
}

const Learning: React.FC = () => {
  const [openTopic, setOpenTopic] = useState<number | null>(null)

  const toggleTopic = (id: number) => {
    setOpenTopic(openTopic === id ? null : id)
  }

  const linkStyle = {
    color: '#1f67a5',
    textDecoration: 'underline',
    fontWeight: 500,
  }

  const learningModules: LearningModule[] = [
    {
      id: 1,
      title: 'How to Navigate Providing and Discussing an Autism Diagnosis',
      content: (
        <>
          <p>
            This training is designed to support providers in discussing autism
            characteristics with families - whether they are delivering formal
            diagnoses themselves, or navigating conversations around
            autism-related characteristics and common questions. Model
            scripts/discussion points, audio/video examples, interactive
            learning activities, and links to resources are included.
          </p>

          <p>Providers will learn to:</p>

          <ul>
            <li>
              Structure and lead discussions around autism-related observations
            </li>
            <li>
              Support family understanding across a range of common scenarios
              and cultural contexts
            </li>
            <li>
              Provide support and guidance related to next steps/resources
              aligned with family priorities
            </li>
            <li>
              Respond to frequently asked questions surrounding autism diagnosis
            </li>
          </ul>

          <p>
            The estimated time to complete this training is 30-45 minutes.
          </p>

          <a
            href="https://vkc.vumc.org/trainings/DiscussingAutism/"
            target="_blank"
            rel="noopener noreferrer"
            style={linkStyle}
          >
            Launch the training here ➜
          </a>
        </>
      ),
    },

    {
      id: 2,
      title: 'How to Navigate Post-Diagnostic Care for Young Children',
      content: (
        <>
          <p>
            This training is designed to support primary care providers in
            helping families navigate best practice recommendations following a
            diagnosis of autism. Model scripts/discussion points, audio/video
            examples, interactive learning activities, and links to resources
            are included.
          </p>

          <p>Providers will learn to:</p>

          <ul>
            <li>
              Structure a post-diagnosis follow-up appointment for a family of
              child receiving an initial diagnosis of autism
            </li>
            <li>
              Discuss common referrals, recommendations, and resources related
              to autism and co-occurring developmental challenges
            </li>
            <li>
              Complete a checklist embedded within the electronic health record
              that helps providers align with family priorities and best
              practices related to next steps/resources
            </li>
            <li>
              Document important progress within the health record and review
              standard handouts related to targeted priority areas (e.g.,
              initial care coordination, accessing services, developmental and
              behavioral challenges)
            </li>
          </ul>

          <p>
            The estimated time to complete this training is 20-30 minutes.
          </p>

          <a
            href="https://vkc.vumc.org/trainings/AutismFollowUp"
            target="_blank"
            rel="noopener noreferrer"
            style={linkStyle}
          >
            Launch the training here ➜
          </a>
        </>
      ),
    },

    {
      id: 3,
      title: 'Helping Families Navigate ABA Services',
      content: (
        <>
          <p>
            This webinar reviews therapies derived from Applied Behavioral
            Analysis (ABA) and how providers can assist families in evaluating
            these services and effectively advocating for their child.
            Providers will learn:
          </p>

          <ul>
            <li>Basic teaching and learning principles related to ABA</li>
            <li>
              Important ethical considerations and common misconceptions
            </li>
            <li>Different ways to talk about ABA with families</li>
            <li>Helping families access ABA-based services</li>
            <li>
              How to help families evaluate and navigate ABA providers
            </li>
          </ul>

          <p>The estimated time to complete this webinar is 45 minutes.</p>

          <p>
            <a
              href="https://vkc.vumc.org/assets/files/triad/webinar/ABA_questionnaire_for_parent_interview.pdf"
              target="_blank"
              rel="noopener noreferrer"
              style={linkStyle}
            >
              View or download “Caregiver Interview to Review ABA program” in
              PDF format
            </a>
          </p>

          <p>
            This handout is designed to be used by a provider who is speaking
            with a caregiver about a child’s ABA program. It consists of
            important questions that a provider can ask caregivers to help them
            advocate for appropriate and family-centered programming.
          </p>

          <p>
            <a
              href="https://vkc.vumc.org/assets/files/triad/webinar/Caregiver_Interview_for_new_ABA_provider.pdf"
              target="_blank"
              rel="noopener noreferrer"
              style={linkStyle}
            >
              View or download “Caregiver Questions for ABA Providers” in PDF
              format
            </a>
          </p>

          <p>
            <a
              href="https://vkc.vumc.org/assets/files/triad/webinar/SP-Caregiver_Interview_for_new_ABA_provider.pdf"
              target="_blank"
              rel="noopener noreferrer"
              style={linkStyle}
            >
              A Spanish translation is also available here.
            </a>
          </p>

          <p>
            <a
              href="https://vkc.vumc.org/assets/files/triad/webinar/ARA-Caregiver_Interview_for_new_ABA_provider.pdf"
              target="_blank"
              rel="noopener noreferrer"
              style={linkStyle}
            >
              An Arabic translation is also available here.
            </a>
          </p>

          <p>
            This handout is a supplement to the handout above but is designed
            for use by caregivers. It consists of important questions that a
            caregiver can ask while they are navigating different service
            providers or trying to advocate for more appropriate support for
            their child.
          </p>
        </>
      ),
    },

    {
      id: 4,
      title: 'ASD in Primary Care Education (ASD-PRIME)',
      content: (
        <>
          <p>
            ASD-PRIME is an interactive series of online modules designed to
            increase familiarity with autism diagnosis and provide follow-up
            care for young children their families. Many of the modules contain
            downloadable/printable clinical care guides and family resources.
            Providers will learn to:
          </p>

          <ul>
            <li>
              Understand the major benefits and limits of current diagnostic
              models and tools
            </li>
            <li>
              Become more familiar with the core characteristics of autism
            </li>
            <li>
              Become more familiar with developmental and autism screening and
              diagnostic tools
            </li>
            <li>
              Better develop diagnostic impressions related to multiple sources
              of data
            </li>
            <li>
              Provide support and guidance related to next steps/resources
            </li>
          </ul>

          <p>The estimated time to complete this training is 2 hours.</p>

          <a
            href="https://bit.ly/484mZjn"
            target="_blank"
            rel="noopener noreferrer"
            style={linkStyle}
          >
            Launch the training here ➜
          </a>
        </>
      ),
    },

    {
      id: 5,
      title: 'The Childhood Autism Rating Scale (CARS-2)',
      content: (
        <>
          <p>
            This module is designed for clinicians wanting to embed the CARS-2
            as part of their diagnostic evaluation process and documentation.
            The CARS-2 is a clinician rating scale that can be used to help
            integrate diagnostic information, quantify autism-related
            behaviors, and support next steps in pursuing targeted intervention.
          </p>

          <p>
            <em>
              Due to the proprietary materials included in the CARS-2, this
              module is password protected and reserved for clinicians who have
              completed TRIAD-facilitated training (e.g., workshop or training
              sequence). Please contact your trainer if you have not received
              the password.
            </em>
          </p>

          <p>Providers will learn to:</p>

          <ul>
            <li>
              Integrate clinical information to be able to score and interpret
              the CARS-2 Standard Form
            </li>
            <li>
              Summarize the results of the CARS-2 and embed in your
              documentation report
            </li>
          </ul>

          <a
            href="https://vkc.vumc.org/trainings/cars-2/"
            target="_blank"
            rel="noopener noreferrer"
            style={linkStyle}
          >
            Launch the training here ➜
          </a>
        </>
      ),
    },

    {
      id: 6,
      title: 'Families First Workshops and Training',
      content: (
        <>
          <p>
            TRIAD’s Families First offers free workshops and online trainings
            for families of children with autism. Families First’s goal is to
            equip caregivers with practical tools to support their child and to
            give caregivers an opportunity to talk with other caregivers with
            similar questions or concerns. Workshops are offered live/virtually
            and past workshops are archived for future viewing. Topics include
            addressing challenging behaviors, toilet training, developing
            successful sleep habits, and encouraging play and communication.
            Pediatric providers are encouraged to review example pages with
            families as well as learn strategies on their own.
          </p>

          <p>
            <a
              href="https://vkc.vumc.org/vkc/triad/fam/"
              target="_blank"
              rel="noopener noreferrer"
              style={linkStyle}
            >
              View/register for upcoming trainings here ↗
            </a>
          </p>

          <p>
            <a
              href="https://familiesfirst.vkcsites.org/"
              target="_blank"
              rel="noopener noreferrer"
              style={linkStyle}
            >
              View a sample of prior virtual events and resources here ↗
            </a>
          </p>
        </>
      ),
    },
  ]

  return (
    <>
      <Header />

      <div className="content">
        <div className="persona-creator">
          <h1>Brief Online Modules to Increase Autism-Specific Clinical Skills</h1>

          <p
            style={{
              textAlign: 'center',
              color: 'var(--text)',
              marginBottom: '24px',
            }}
          >
            The online modules below were developed to support pediatric
            providers and primary care providers in helping their patients and
            families through the diagnostic process and autism-specific
            follow-up.
          </p>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              marginTop: '24px',
            }}
          >
            {learningModules.map((module) => (
              <div
                key={module.id}
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  backgroundColor: 'white',
                  overflow: 'hidden',
                }}
              >
                <button
                  type="button"
                  onClick={() => toggleTopic(module.id)}
                  style={{
                    width: '100%',
                    padding: '16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                >
                  <strong>{module.title}</strong>
                  <span>{openTopic === module.id ? '▲' : '▼'}</span>
                </button>

                {openTopic === module.id && (
                  <div
                    style={{
                      padding: '20px',
                      borderTop: '1px solid var(--border)',
                      color: 'var(--text)',
                      lineHeight: 1.6,
                      textAlign: 'left',
                    }}
                  >
                    {module.content}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <Footer />
    </>
  )
}

export default Learning