"use client";

import Image from "next/image";
import Link from "next/link";
import { assetUrl } from "@/lib/assets";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function AdminLoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Simple check: if we can fetch orders, we are an authorized admin
        const res = await fetch("/api/admin/orders");
        if (res.ok) {
          router.push("/admin");
          return;
        }
      } catch {
        // ignore and show login
      }
      setCheckingAuth(false);
    };

    checkAuth();
  }, [router]);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      // Use the existing auth utility
      const { signInWithGoogle } = await import("@/lib/auth-actions");
      await signInWithGoogle("es", "/admin");
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Error al iniciar sesión";
      setError(errorMsg);
      setLoading(false);
    }
  };

  if (checkingAuth) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#050505]">
        <div className="flex flex-col items-center gap-4">
           <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
           <p className="text-muted-foreground font-black uppercase tracking-widest text-xs">Verificando Admin...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#050505] px-4 font-sans">
      <div className="w-full max-w-md space-y-8 animate-in fade-in zoom-in duration-500">
        <div className="flex flex-col items-center gap-6">
          <Link
            href="/es"
            className="relative h-24 w-24 hover:scale-105 transition-transform"
          >
            <Image
              src={assetUrl("/moovimiento-white.png")}
              alt="Moovimiento"
              fill
              className="object-contain"
              priority
            />
          </Link>
          <div className="text-center space-y-2">
             <h1 className="text-4xl font-black tracking-tight text-white uppercase">
               Admin <span className="text-primary italic">Panel</span>
             </h1>
             <p className="text-muted-foreground font-medium">Ingresá con tu cuenta autorizada</p>
          </div>
        </div>

        <Card className="border-2 border-white/10 bg-white/[0.02] backdrop-blur-xl rounded-[2.5rem] overflow-hidden shadow-2xl">
          <CardContent className="p-8 md:p-12 space-y-6">
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-2xl text-sm font-bold text-center">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <Button 
                onClick={handleGoogleSignIn} 
                className="w-full h-16 rounded-2xl bg-white text-black hover:bg-white/90 font-black text-lg shadow-xl flex items-center justify-center gap-4 transition-all active:scale-95" 
                disabled={loading}
              >
                <svg className="w-6 h-6" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                {loading ? "Iniciando..." : "Entrar con Google"}
              </Button>
              
              <p className="text-[10px] text-center text-muted-foreground uppercase font-black tracking-widest opacity-40">
                Solo accesos autorizados por el desarrollador
              </p>
            </div>
          </CardContent>
        </Card>
        
        <div className="text-center">
           <Link href="/" className="text-muted-foreground hover:text-white transition-colors text-xs font-black uppercase tracking-widest opacity-50">
             &larr; Volver a la web
           </Link>
        </div>
      </div>
    </div>
  );
}
