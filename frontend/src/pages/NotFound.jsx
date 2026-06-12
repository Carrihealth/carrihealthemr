import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      gap: 16,
      background: '#f4f6f9',
      padding: 24,
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 64, fontWeight: 800, color: '#0B1E3D', lineHeight: 1 }}>404</div>
      <p style={{ fontSize: 18, color: '#374151', fontWeight: 600 }}>Page not found</p>
      <p style={{ fontSize: 14, color: '#9ca3af', maxWidth: 320 }}>
        The page you are looking for does not exist or you do not have permission to view it.
      </p>
      <Link to="/dashboard" style={{
        marginTop: 8,
        display: 'inline-block',
        padding: '10px 20px',
        background: '#0B1E3D',
        color: '#fff',
        borderRadius: 6,
        fontWeight: 600,
        fontSize: 14,
      }}>
        ← Back to Dashboard
      </Link>
    </div>
  );
}
