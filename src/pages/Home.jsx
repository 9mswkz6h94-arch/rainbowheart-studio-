import { useState } from 'react'

function encode(data) {
  return Object.keys(data)
    .map(k => encodeURIComponent(k) + '=' + encodeURIComponent(data[k]))
    .join('&')
}

function ContactForm() {
  const [fields, setFields] = useState({ name: '', email: '', message: '' })
  const [status, setStatus] = useState('idle') // idle | sending | success | error

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
      {/* honeypot */}
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
          placeholder="Tell us what you're looking for…"
          value={fields.message}
          onChange={handleChange}
        />
      </div>

      <div data-netlify-recaptcha="true" className="recaptcha-wrap" />

      {status === 'error' && (
        <p className="form-error">Something went wrong. Try again or email us directly at crystal@rainbowheart.studio</p>
      )}

      <button type="submit" className="btn btn-primary-inv" disabled={status === 'sending'}>
        {status === 'sending' ? 'Sending…' : 'Send Message'}
      </button>
    </form>
  )
}

const services = [
  {
    emoji: '🎸',
    title: 'Private Lessons',
    description:
      'One-on-one instruction with multiple talented instructors. Guitar, vocals, piano, songwriting, and more — all ages and skill levels welcome.',
    gradient: 'linear-gradient(135deg, #FF6B6B, #FD79A8)',
    cta: 'Book a Lesson',
  },
  {
    emoji: '🎨',
    title: 'Art Parties',
    description:
      'Bring the group — we bring the creativity. Perfect for birthdays, team events, or just a fun night out. All supplies included, no experience needed.',
    gradient: 'linear-gradient(135deg, #FF9F43, #FECA57)',
    cta: 'Book a Party',
  },
  {
    emoji: '🖌️',
    title: 'Murals',
    description:
      'Custom hand-painted murals for homes, businesses, and public spaces. Bold, lasting, and uniquely yours.',
    gradient: 'linear-gradient(135deg, #1DD1A1, #48DBFB)',
    cta: 'Get a Quote',
  },
  {
    emoji: '🖼️',
    title: 'Art Shows',
    description:
      'A home for local artists to exhibit and connect. We host regular shows celebrating the creative community of Central Texas.',
    gradient: 'linear-gradient(135deg, #54A0FF, #A29BFE)',
    cta: 'See Events',
  },
  {
    emoji: '🥁',
    title: 'Kids Performance Band',
    description:
      'Young musicians learning to play, rehearse, and perform together. Builds confidence, teamwork, and a lifelong love of music.',
    gradient: 'linear-gradient(135deg, #A29BFE, #FD79A8)',
    cta: 'Learn More',
  },
]

export default function Home() {
  return (
    <div className="home">

      {/* ── Hero ── */}
      <section className="hero">
        <div className="hero-inner">
          <p className="hero-location">📍 Copperas Cove, Texas</p>
          <h1 className="hero-headline">
            Where <span className="rainbow-text">creativity</span><br />comes alive.
          </h1>
          <p className="hero-sub">
            Lessons, art parties, murals, shows, and a kids performance band —
            all under one colorful roof.
          </p>
          <div className="hero-ctas">
            <a href="#services" className="btn btn-primary">Explore Services</a>
            <a href="#contact" className="btn btn-outline">Get in Touch</a>
          </div>
        </div>
      </section>

      {/* ── Services ── */}
      <section id="services" className="services">
        <div className="container">
          <h2 className="section-title">What We Do</h2>
          <div className="services-grid">
            {services.map((s) => (
              <div
                key={s.title}
                className="service-card"
                style={{ '--card-gradient': s.gradient }}
              >
                <div className="card-icon">{s.emoji}</div>
                <h3>{s.title}</h3>
                <p>{s.description}</p>
                <a href="#contact" className="card-cta">{s.cta} →</a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── About ── */}
      <section id="about" className="about">
        <div className="container about-inner">
          <div className="about-text">
            <h2>Built on community,<br />powered by color.</h2>
            <p>
              Rainbow Heart Studio started from a belief that art and music belong to
              everyone. We're a multidisciplinary creative space in the heart of Central
              Texas — hosting lessons, events, and experiences that bring people together
              and help them discover what they're capable of.
            </p>
            <p>
              Whether you're picking up an instrument for the first time, throwing a
              birthday party with a paintbrush, or looking for a mural that'll stop people
              in their tracks — you found the right place.
            </p>
          </div>
          <div className="about-visual" aria-hidden="true">🌈</div>
        </div>
      </section>

      {/* ── Contact ── */}
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
