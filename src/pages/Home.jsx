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
              Rainbow Hearts Studio started from a belief that art and music belong to
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

      {/* ── Contact CTA ── */}
      <section id="contact" className="contact-cta">
        <div className="container">
          <h2>Ready to create something?</h2>
          <p>Reach out and we'll get you sorted.</p>
          <a href="mailto:hello@rainbowheart.studio" className="btn btn-primary-inv">
            Say Hello
          </a>
        </div>
      </section>

    </div>
  )
}
