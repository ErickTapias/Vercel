import FinaApp from "@/components/fina-app";
import { getData } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  try {
    const data = await getData();
    return <FinaApp initialData={data} />;
  } catch (error) {
    return (
      <div style={{ padding: '50px', textAlign: 'center', fontFamily: 'Arial' }}>
        <h1>⚠️ Error de Base de Datos</h1>
        <p>No se pudo conectar a la base de datos</p>
        <p style={{ color: 'red', marginTop: '20px', fontSize: '12px' }}>
          {error instanceof Error ? error.message : 'Error desconocido'}
        </p>
      </div>
    );
  }
}