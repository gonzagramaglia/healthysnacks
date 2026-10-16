"use client";

import { dictionary, Language } from "@/lib/dictionary";
import Image from "next/image";
import { assetUrl } from "@/lib/assets";

interface TrustProps {
    lang: Language;
}

export function Trust({ lang }: TrustProps) {
    const t = dictionary[lang];

    return (
        <section id="trust" className="w-full py-10 bg-primary/5 border-t border-muted/20">
            <div className="mx-auto max-w-4xl px-6 text-center">
                <div className="mb-8 flex justify-center">
                    {/* Using the same logo as header but larger or just text? User prompt says "Logo" then "Hacer pedido" then "Elegido por..." 
                         I'll use the moovimiento-emoji.png or just the icon. Let's use the icon for trust.
                     */}
                    <div className="relative h-16 w-16 md:h-20 md:w-20">
                        {/* Diffused Glow behind the trust logo */}
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 md:w-40 md:h-40 bg-white/50 dark:bg-white/10 rounded-full blur-[40px] md:blur-[60px]" />
                        <Image
                            src={assetUrl("/moovimiento.png")}
                            alt="Moovimiento"
                            fill
                            className="relative object-contain block dark:hidden"
                        />
                        <Image
                            src={assetUrl("/moovimiento-white.png")}
                            alt="Moovimiento"
                            fill
                            className="relative object-contain hidden dark:block"
                        />
                    </div>
                </div>

                <h2 className="text-2xl md:text-3xl font-bold mb-4">
                    {t.trust_slogan}
                </h2>
                <p className="text-lg text-muted-foreground mb-0 max-w-2xl mx-auto">
                    {t.trust_sub}
                </p>

                <div className="flex flex-col items-center gap-4">
                    {/* Button and footer text removed as requested */}
                </div>
            </div>
        </section>
    );
}
