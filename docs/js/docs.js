// ── Mobile hamburger ──
const hamburger = document.getElementById('hamburger');
const navLinks = document.getElementById('nav-links');
const sidebar = document.getElementById('sidebar');

hamburger?.addEventListener('click', () => {
  navLinks.classList.toggle('open');
  sidebar.classList.toggle('open');
});

// ── Copy buttons ──
document.querySelectorAll('.copy-btn[data-copy]').forEach(btn => {
  btn.addEventListener('click', () => {
    const code = btn.closest('.code-block').querySelector('code');
    navigator.clipboard.writeText(code.textContent).then(() => {
      btn.textContent = 'Copied!';
      btn.classList.add('copied');
      setTimeout(() => {
        btn.textContent = 'Copy';
        btn.classList.remove('copied');
      }, 1500);
    });
  });
});

// ── Sidebar scroll spy ──
const sidebarLinks = document.querySelectorAll('.sidebar-link');
const sections = [];

sidebarLinks.forEach(link => {
  const id = link.getAttribute('href')?.replace('#', '');
  if (id) {
    const el = document.getElementById(id);
    if (el) sections.push({ id, el, link });
  }
});

if (sections.length > 0) {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        sidebarLinks.forEach(l => l.classList.remove('active'));
        const match = sections.find(s => s.el === entry.target);
        if (match) match.link.classList.add('active');
      }
    });
  }, {
    rootMargin: '-100px 0px -60% 0px',
    threshold: 0
  });

  sections.forEach(s => observer.observe(s.el));
}
