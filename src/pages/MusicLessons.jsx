import { Link } from 'react-router-dom'

export const lessonInstruments = ['Piano', 'Voice', 'Guitar', 'Ukulele', 'Guitalele (guitarlele)', 'Tenor guitar']

export default function MusicLessons() {
  return (
    <div className="home public-site" id="public-main" tabIndex={-1}>
      <section className="hero public-lessons-hero">
        <div className="hero-inner">
          <p className="hero-location">Rainbow Heart Studio · Copperas Cove, Texas 76522</p>
          <h1 className="hero-headline">Private music lessons in Copperas Cove</h1>
          <p className="hero-sub">Piano, voice, guitar, ukulele, guitalele, and tenor guitar lessons for beginners and experienced musicians. All ages and skill levels welcome.</p>
          <a className="btn btn-primary" href="mailto:info@rainbowheart.studio?subject=Music%20lesson%20inquiry">Ask about lessons →</a>
          <p className="public-inquiry-note">Opens your email app. Lessons are by appointment; ask about current availability and pricing.</p>
        </div>
      </section>
      <section className="public-section">
        <div className="container public-intro-grid">
          <div>
            <h2>Choose what you would like to learn</h2>
            <p>One-on-one lessons give you a place to start or a next step with your music. Tell us which instrument interests you and what you hope to work on.</p>
            <ul>{lessonInstruments.map(instrument => <li key={instrument}>{instrument} lessons</li>)}</ul>
          </div>
          <div className="public-lesson-details">
            <h2>How to get started</h2>
            <p>Email <a href="mailto:info@rainbowheart.studio">info@rainbowheart.studio</a> with your instrument, experience level, scheduling needs, and questions.</p>
            <p>We will discuss instructor options, current availability, and pricing with you before arranging a lesson.</p>
            <p>Rainbow Heart Studio welcomes learners of all ages and skill levels.</p>
          </div>
        </div>
      </section>
      <section className="public-section public-tools-intro">
        <div className="container public-intro-grid">
          <div>
            <h2>Where are lessons?</h2>
            <address>Rainbow Heart Studio<br />303 S. Main Street, inside The House on Main<br />Copperas Cove, TX 76522</address>
            <p>Studio lessons are by appointment only. The building's opening hours are separate from lesson availability.</p>
            <a className="public-text-link" href="https://maps.google.com/maps?q=303+S+Main+Street,Copperas+Cove,TX+76522">Get directions →</a>
          </div>
          <div>
            <h2>Questions before your first lesson?</h2>
            <h3>Do I need experience?</h3>
            <p>Beginners and experienced musicians are welcome. Tell us where you are starting.</p>
            <h3>What do lessons cost, and when can I come?</h3>
            <p>Contact the studio for current pricing and appointment availability.</p>
            <h3>Do I need to bring an instrument?</h3>
            <p>Ask about the instrument you want to learn when you inquire, so we can discuss what you will need.</p>
          </div>
        </div>
      </section>
      <section className="public-section">
        <div className="container">
          <h2>More from Rainbow Heart</h2>
          <p><Link className="public-text-link" to="/">Meet the studio and instructors →</Link></p>
          <p><Link className="public-text-link" to="/tools">Explore free music tools →</Link></p>
          <p><a className="public-text-link" href="https://bjrh.band/">Hear Brother Jon and the Rainbow Hearts →</a></p>
        </div>
      </section>
    </div>
  )
}
