import { useState } from 'react'
import { Link } from 'react-router-dom'
import { STUDIO_TOOLS } from '../lib/tools'

function encode(data) {
  return Object.keys(data)
    .map(k => encodeURIComponent(k) + '=' + encodeURIComponent(data[k]))
    .join('&')
}

function ContactForm() {
  const [fields, setFields] = useState({ name: '', email: '', message: '' })
  const [status, setStatus] = useState('idle')

  function handleChange(e) {
    setFields(f => ({ ...f, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const token = window.grecaptcha?.getResponse()
    if (!token) {
      alert('Please complete the reCAPTCHA before sending.')
      return
    }
    setStatus('sending')
    try {
      await fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: encode({ 'form-name': 'contact', 'g-recaptcha-response': token, ...fields }),
      })
      setStatus('success')
      setFields({ name: '', email: '', message: '' })
      window.grecaptcha?.reset()
    } catch {
      setStatus('error')
    }
  }

  if (status === 'success') {
    return (
      <div className="contact-success">
        <span className="contact-success-icon">🌈</span>
        <h3>Got it! We'll be in touch soon.</h3>
      </div>
    )
  }

  return (
    <form
      className="contact-form"
      onSubmit={handleSubmit}
      data-netlify="true"
      data-netlify-recaptcha="true"
      name="contact"
    >
      <input type="hidden" name="form-name" value="contact" />
      <p hidden><input name="bot-field" /></p>

      <div className="form-row">
        <label htmlFor="cf-name">Name</label>
        <input
          id="cf-name"
          type="text"
          name="name"
          required
          placeholder="Your name"
          value={fields.name}
          onChange={handleChange}
        />
      </div>

      <div className="form-row">
        <label htmlFor="cf-email">Email</label>
        <input
          id="cf-email"
          type="email"
          name="email"
          required
          placeholder="you@example.com"
          value={fields.email}
          onChange={handleChange}
        />
      </div>

      <div className="form-row">
        <label htmlFor="cf-message">Message</label>
        <textarea
          id="cf-message"
          name="message"
          required
          rows={5}
          placeholder="Tell us what you're looking for..."
          value={fields.message}
          onChange={handleChange}
        />
      </div>

      <div data-netlify-recaptcha="true" className="recaptcha-wrap" />

      {status === 'error' && (
        <p className="form-error">Something went wrong. Try again or email us at crystal@rainbowheart.studio</p>
      )}

      <button type="submit" className="btn btn-primary-inv" disabled={status === 'sending'}>
        {status === 'sending' ? 'Sending...' : 'Send Message'}
      </button>
    </form>
  )
}

const services = [
  {
    emoji: '🎸',
    title: 'Private Lessons',
    stinger: 'One-on-one lessons for every age and instrument.',
    description: 'One-on-one instruction with multiple talented instructors. Guitar, vocals, piano, songwriting, and more — all ages and skill levels welcome.',
    gradient: 'linear-gradient(135deg, #FF6B6B, #FD79A8)',
    cta: 'Book a Lesson',
  },
  {
    emoji: '🖌️',
    title: 'Murals',
    stinger: 'Custom hand-painted murals for any space.',
    description: 'Custom hand-painted murals for homes, businesses, and public spaces. Bold, lasting, and uniquely yours.',
    gradient: 'linear-gradient(135deg, #1DD1A1, #48DBFB)',
    cta: 'See Our Work',
    ctaHref: 'https://www.facebook.com/media/set/?set=a.996240916604165&type=3',
    ctaExternal: true,
  },
  {
    emoji: '🥁',
    title: 'The Heart Beats',
    stinger: 'A kids band that builds real musicianship.',
    description: 'Young musicians learning to play, rehearse, and perform together. Builds confidence, teamwork, and a lifelong love of music.',
    gradient: 'linear-gradient(135deg, #A29BFE, #FD79A8)',
    cta: 'Learn More',
  },
  {
    emoji: '🎤',
    title: '4th Saturday Open Mic',
    stinger: 'Live music every 4th Saturday — all welcome.',
    description: 'Live music every 4th Saturday at Nelson Brew Works in Copperas Cove. All performers welcome — come play, come listen, come be part of something.',
    gradient: 'linear-gradient(135deg, #FF9F43, #FF6B6B)',
    cta: 'Sign Up or View Queue',
    ctaHref: '#open-mic',
    ctaExternal: false,
  },
  {
    emoji: '📻',
    title: "Brother Jon's Songwriter Session",
    stinger: 'Monthly songwriter radio show on KTCP 98.7.',
    description: 'A monthly songwriter radio show on KTCP 98.7 — The Voice of Bell County. Featured artists perform live and share the stories behind their songs. Streaming live every 4th Saturday.',
    gradient: 'linear-gradient(135deg, #48DBFB, #6C5CE7)',
    cta: 'Follow for Updates',
    ctaHref: 'https://www.facebook.com/p/Brother-Jon-and-the-Rainbow-Hearts-61560281233918/',
    ctaExternal: true,
  },
  {
    emoji: '🎙️',
    title: 'Brother Jon & The Rainbow Hearts',
    stinger: 'Central Texas roots rock, live around town.',
    description: 'Central Texas roots rock with soul. Catch them live across the area or stream their music — and look for them right here at Rainbow Heart Studio.',
    gradient: 'linear-gradient(135deg, #6C5CE7, #B146C2)',
    cta: 'Visit the Band',
    ctaHref: 'https://bjrh.band',
    ctaExternal: true,
  },
  {
    emoji: '💍',
    title: 'Micro Weddings',
    stinger: 'Intimate ceremonies, scaled to what matters most.',
    description: 'Intimate ceremonies for the couples who want meaningful, personal celebrations. Live music, custom décor, and an unforgettable day — all scaled to what matters most to you.',
    gradient: 'linear-gradient(135deg, #FF1493, #FF69B4)',
    cta: 'Plan Your Day',
  },
  {
    emoji: '🎭',
    title: 'Face Painting',
    stinger: 'Professional face painting for parties and events.',
    description: 'Professional face painting for events, parties, festivals, and celebrations. Custom designs, fast turnaround, and smiles all around.',
    gradient: 'linear-gradient(135deg, #FFD700, #FFA500)',
    cta: 'Book Face Painting',
  },
  {
    emoji: '🎉',
    title: 'Event Packages',
    stinger: 'Curated live-music experiences for your event.',
    description: 'Curated experiences for house shows, art parties, corporate events, and celebrations. Live music, creativity, and connection tailored to your vision.',
    gradient: 'linear-gradient(135deg, #00CEC9, #74B9FF)',
    cta: 'Explore Options',
  },
  {
    emoji: '👨‍🏫',
    title: 'Coaching Sessions',
    stinger: 'Personalized coaching for adult learners and musicians.',
    description: 'Personalized instruction for adult learners and musicians honing a specific skill. Whether you\'re picking up an instrument, refining technique, or unlocking your creative voice — we meet you where you are.',
    gradient: 'linear-gradient(135deg, #A29BFE, #74B9FF)',
    cta: 'Start Learning',
  },
]

function ServiceCard({ s }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      className={'service-card' + (expanded ? ' expanded' : '')}
      style={{ '--card-gradient': s.gradient }}
    >
      <div className="card-icon">{s.emoji}</div>
      <h3>{s.title}</h3>
      <p className="card-stinger">{s.stinger}</p>
      <button
        type="button"
        className="card-expand-btn"
        onClick={() => setExpanded(e => !e)}
        aria-expanded={expanded}
      >
        {expanded ? 'Show less −' : 'Learn more +'}
      </button>
      <div className="card-details-wrap">
        <div className="card-details-inner">
          <p>{s.description}</p>
          {s.ctaExternal ? (
            <a href={s.ctaHref} target="_blank" rel="noopener noreferrer" className="card-cta">{s.cta} →</a>
          ) : (
            <a href="#contact" className="card-cta">{s.cta} →</a>
          )}
        </div>
      </div>
    </div>
  )
}

const staff = [
  {
    name: 'Jonathan Owens',
    role: 'Founder & Instructor',
    avatar: '🎸',
    color: 'linear-gradient(135deg, #6C5CE7, #B146C2)',
  },
  {
    name: 'Crystal Owens',
    role: 'Co-Founder & Studio Director',
    avatar: '🌈',
    color: 'linear-gradient(135deg, #FF6B6B, #FD79A8)',
  },
  {
    name: 'LJ Go',
    role: 'Guitar & Ukulele Instructor',
    avatar: '🎨',
    color: 'linear-gradient(135deg, #1DD1A1, #48DBFB)',
  },
]

export default function Home() {
  return (
    <div className="home">

      {/* Hero */}
      <section className="hero">
        <div className="hero-inner">
          <p className="hero-location">📍 Copperas Cove, Texas</p>
          <h1 className="hero-headline">
            Where <span className="rainbow-text">creativity</span><br />comes alive.
          </h1>
          <p className="hero-sub">
            Lessons, murals, shows, and a kids performance band —
            all under one colorful roof. Everyone welcome. Always. 🏳️‍🌈
          </p>
          <div className="hero-ctas">
            <a href="#services" className="btn btn-primary">Explore Services</a>
            <a href="#contact" className="btn btn-outline">Get in Touch</a>
          </div>
        </div>
      </section>

      {/* Studio Tools Showcase */}
      <section className="studio-showcase">
        <div className="container">
          <div className="studio-showcase-header">
            <div className="studio-showcase-label">🎸 Rainbow Heart Studio</div>
            <h2>A full creative suite for musicians</h2>
            <p>
              Get Studio Access to unlock every tool — built for teachers, students, and performers.
            </p>
            <div className="studio-showcase-ctas">
              <Link to="/login" className="btn btn-primary">Get Studio Access →</Link>
              <Link to="/tools/chord-scale-explorer" className="btn btn-outline">Try Free Tool First</Link>
            </div>
          </div>
          <div className="studio-showcase-grid">
            {STUDIO_TOOLS.map(tool => (
              tool.free ? (
                <Link key={tool.slug} to={tool.href} className="studio-preview-card free">
                  <div className="studio-preview-icon">{tool.emoji}</div>
                  <div className="studio-preview-body">
                    <h3>{tool.title}</h3>
                    <p>{tool.description}</p>
                  </div>
                  <span className="studio-preview-free">✨ Free</span>
                </Link>
              ) : (
                <div key={tool.slug} className="studio-preview-card">
                  <div className="studio-preview-icon">{tool.emoji}</div>
                  <div className="studio-preview-body">
                    <h3>{tool.title}</h3>
                    <p>{tool.description}</p>
                  </div>
                  <span className="studio-preview-lock">🔒 Studio</span>
                </div>
              )
            ))}
          </div>
        </div>
      </section>

      {/* Services */}
      <section id="services" className="services">
        <div className="container">
          <h2 className="section-title">What We Do</h2>
          <div className="services-grid">
            {services.map((s) => (
              <ServiceCard key={s.title} s={s} />
            ))}
          </div>
        </div>
      </section>

      {/* Open Mic */}
      <section id="open-mic" className="open-mic-section">
        <div className="container">
          <div className="open-mic-inner">
            <div className="open-mic-text">
              <p className="open-mic-tag">📅 Every 4th Saturday · 7:00 PM</p>
              <h2>Brother Jon's Open Mic Night</h2>
              <p className="open-mic-venue">📍 Nelson Brew Works · Copperas Cove, TX</p>
              <p className="open-mic-desc">
                All original performers welcome. Sign up at the door, take the stage,
                and share your music with a live audience — and a livestream. Featured
                artists get the chance to be interviewed and aired on KTCP 98.7.
              </p>
              <div className="open-mic-ctas">
                <a
                  href="https://open-mic-queue.netlify.app/signup"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary-inv"
                >
                  Sign Up to Perform →
                </a>
                <a
                  href="https://open-mic-queue.netlify.app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-outline-light"
                >
                  View Tonight's Queue →
                </a>
              </div>
              <p className="open-mic-radio-note">
                📻 Featured artists air on <strong>KTCP 98.7 — The Voice of Bell County</strong>
              </p>
            </div>
            <div className="open-mic-visual" aria-hidden="true">🎤</div>
          </div>
        </div>
      </section>

      {/* About */}
      <section id="about" className="about">
        <div className="container about-inner">
          <div className="about-text">
            <h2>Built on community,<br />powered by creativity.</h2>
            <p>
              Rainbow Heart Studio started from a belief that art and music belong to
              everyone. We're a multidisciplinary creative space in the heart of Central
              Texas — hosting lessons, events, and experiences that bring people together
              and help them discover what they're capable of.
            </p>
            <p>
              Whether you're picking up an instrument for the first time or looking for
              a mural that'll stop people in their tracks — you found the right place.
            </p>
            <p className="about-inclusive">
              🏳️‍🌈 Rainbow Heart Studio is a safe, affirming space for everyone — LGBTQ+ folks,
              people of all races and ethnicities, and all spiritual paths (or none at all).
              Come exactly as you are.
            </p>
          </div>
          <div className="about-visual" aria-hidden="true">🌈</div>
        </div>
      </section>

      {/* Find Us */}
      <section id="find-us" className="find-us">
        <div className="container find-us-inner">
          <div className="find-us-text">
            <h2>Come find us</h2>
            <p className="find-us-address">📍 303 S. Main Street · Copperas Cove, TX 76522</p>
            <p>
              We're inside <strong>The House on Main</strong> — a one-of-a-kind spot right in the
              heart of downtown Copperas Cove. Under one roof you'll find a cozy coffee shop,
              a hair salon, massage therapy, and a charming boutique. Grab a frappe before
              your lesson and treat yourself on the way out.
            </p>
            <div className="find-us-hours-block">
              <div>
                <span className="hours-label">The House on Main</span>
                <span className="hours-value">Mon–Sat 9 am – 6 pm · Sun 12–6 pm</span>
              </div>
              <div>
                <span className="hours-label">Rainbow Heart Studio</span>
                <span className="hours-value">By appointment only · (254) 371-5051</span>
              </div>
            </div>
          </div>
          <div className="find-us-map">
            <a
              href="https://maps.google.com/maps?q=303+S+Main+Street,Copperas+Cove,TX+76522"
              target="_blank"
              rel="noopener noreferrer"
              className="find-us-map-card"
            >
              <div className="find-us-map-pin">📍</div>
              <div className="find-us-map-label">
                <strong>303 S. Main Street</strong>
                <span>Copperas Cove, TX 76522</span>
              </div>
              <div className="find-us-map-cta">Get Directions →</div>
            </a>
          </div>
        </div>
      </section>

      {/* Meet the Team */}
      <section id="team" className="team">
        <div className="container">
          <h2 className="section-title">Meet the Team</h2>
          <div className="team-grid">
            {staff.map((s) => (
              <div key={s.name} className="staff-card">
                <div className="staff-avatar" style={{ background: s.color }}>{s.avatar}</div>
                <h3>{s.name}</h3>
                <p className="staff-role">{s.role}</p>
              </div>
            ))}
          </div>
          <p className="team-note">Full bios coming soon — stay tuned!</p>
        </div>
      </section>

      {/* Facebook Feed */}
      <section className="fb-feed-section">
        <div className="container fb-feed-inner">
          <h2>What's happening</h2>
          <p className="fb-feed-sub">Follow us on <a href="https://www.facebook.com/jowensrainbowheartstudio/" target="_blank" rel="noopener noreferrer">Facebook</a> to stay in the loop.</p>
          <div className="fb-embed-wrap">
            <iframe
              title="Rainbow Heart Studio Facebook feed"
              src="https://www.facebook.com/plugins/page.php?href=https%3A%2F%2Fwww.facebook.com%2Fjowensrainbowheartstudio%2F&tabs=timeline&width=500&height=600&small_header=true&adapt_container_width=true&hide_cover=false&show_facepile=false&lazy=true"
              width="500"
              height="600"
              style={{ border: 'none', overflow: 'hidden' }}
              scrolling="no"
              frameBorder="0"
              allowFullScreen={true}
              allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
            />
          </div>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="contact-cta">
        <div className="container">
          <h2>Ready to create something?</h2>
          <p>Drop us a message and we'll get back to you soon.</p>
          <ContactForm />
        </div>
      </section>

    </div>
  )
}
