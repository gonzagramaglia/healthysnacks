import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md w-full space-y-4">
        <div className="text-6xl font-extrabold text-primary">404</div>
        <h1 className="text-2xl font-bold tracking-tight">Página no encontrada</h1>
        <p className="text-muted-foreground text-sm">
          La ruta que buscás no existe o fue movida.
        </p>
        <div className="pt-4">
          <Link href="/">
            <Button className="bg-yellow-500 hover:bg-yellow-600 text-black font-semibold">
              Volver al inicio
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
