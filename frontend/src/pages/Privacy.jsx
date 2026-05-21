export default function Privacy() {
  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', color: 'rgba(255,255,255,0.85)', fontFamily: 'Inter, system-ui, sans-serif', padding: '60px 24px' }}>
      <div style={{ maxWidth: 680, margin: '0 auto' }}>
        <a href="/" style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.3)', textDecoration: 'none', display: 'inline-block', marginBottom: 40 }}>← Back</a>

        <h1 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: 8, letterSpacing: '-0.02em' }}>Privacy Notice</h1>
        <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.3)', marginBottom: 40 }}>Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>

        {[
          {
            title: 'No data is collected or transmitted',
            body: 'FaceRead processes your webcam feed entirely in your browser. No video, images, or biometric data are ever sent to any server. Your camera input never leaves your device.'
          },
          {
            title: 'Face recognition is local only',
            body: 'When you register a face, the resulting descriptor (a numeric representation, not an image) is stored in your browser\'s localStorage. It stays on your device and is never uploaded anywhere. You can delete it at any time from within the app.'
          },
          {
            title: 'Analytics',
            body: 'This site uses Vercel Analytics to count page visits. This collects no personally identifiable information — only anonymous visit counts and general location data (country-level). No cookies are used for tracking.'
          },
          {
            title: 'ASL Recognition',
            body: 'The ASL mode sends hand landmark coordinates (not images) to a local Flask backend for classification. This backend runs locally on your machine and does not transmit data externally.'
          },
          {
            title: 'Contact',
            body: 'Questions? Reach out via GitHub: github.com/LightAnd2/FaceRead'
          }
        ].map(({ title, body }) => (
          <div key={title} style={{ marginBottom: 32, paddingBottom: 32, borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <h2 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: 8 }}>{title}</h2>
            <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.7 }}>{body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
