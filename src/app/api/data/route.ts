import { getData } from "@/lib/data";
export const dynamic = "force-dynamic";
export async function GET() {
  try { return Response.json(await getData()); }
  catch (error) { console.error(error); return Response.json({ error: "No se pudieron cargar los datos del negocio." }, { status: 500 }); }
}
