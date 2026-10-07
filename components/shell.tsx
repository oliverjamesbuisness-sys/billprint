// Layout used by every step: dark navy hero on top, white card sheet sliding up over it.
export function Shell({ hero, children }: { hero: React.ReactNode; children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-page">
      <section className="bg-navy px-6 pb-16 pt-8 text-white">{hero}</section>
      <section className="-mt-8 flex-1 rounded-t-[28px] bg-white px-5 pb-12 pt-6 shadow-[0_-8px_30px_rgba(11,31,51,0.12)] animate-in slide-in-from-bottom-4 duration-300">
        {children}
      </section>
    </main>
  );
}

export function Brand() {
  return <p className="text-sm font-semibold tracking-wide text-white/70">BillPrint</p>;
}

const kgFormat = new Intl.NumberFormat("en-US", { maximumSignificantDigits: 3 });

/** 3 significant figures: our inputs don't support more precision than that. */
export function formatKg(kg: number) {
  return kgFormat.format(kg);
}
