export default function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-inner">
        <span>© {new Date().getFullYear()} Rainbow Heart Studio · Copperas Cove, TX</span>
        <div className="footer-links">
          <a href="https://www.facebook.com/profile.php?id=61560281233918" target="_blank" rel="noreferrer">
            Facebook
          </a>
        </div>
      </div>
    </footer>
  )
}
