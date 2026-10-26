import FinaApp from "@/components/fina-app";
import { getData } from "@/lib/data";
export const dynamic = "force-dynamic";
export default async function HomePage() {
  const data = await getData();
  return <FinaApp initialData={data} />;
}
