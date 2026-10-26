export default function HomePage() {
  return (
    <div style={{ 
      padding: '50px', 
      textAlign: 'center',
      fontFamily: 'Arial, sans-serif',
      minHeight: '100vh',
      backgroundColor: '#f5f5f5'
    }}>
      <h1 style={{ color: '#0070f3', marginBottom: '20px' }}>
        🎉 ¡Mi Sistema Está Funcionando!
      </h1>
      <p style={{ fontSize: '18px', color: '#666' }}>
        Bienvenido a mi aplicación Next.js
      </p>
      <p style={{ fontSize: '14px', color: '#999', marginTop: '20px' }}>
        Desplegada en Vercel + Base de datos Neon
      </p>
      <div style={{ 
        marginTop: '40px', 
        padding: '20px', 
        backgroundColor: 'white',
        borderRadius: '8px',
        display: 'inline-block'
      }}>
        <h2 style={{ margin: '0 0 10px 0' }}>Estado del Sistema</h2>
        <p style={{ margin: 0, color: 'green' }}>✅ Servidor: Online</p>
        <p style={{ margin: '5px 0 0 0', color: 'green' }}>✅ Base de datos: Conectada</p>
      </div>
    </div>
  );
}