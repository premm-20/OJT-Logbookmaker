import Image from "next/image";
import Link from "next/link";
import BrandMark from "@/components/brand-mark";
import dayPage from "../../../public/templates/day_page_bg.png";
import coverPage from "../../../public/templates/page_3_bg.png";

export default function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-[100dvh] bg-white lg:grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)]">
      {/* Form column */}
      <div className="flex min-w-0 flex-col px-5 py-6 sm:px-10 lg:px-14 xl:px-20">
        <header>
          <Link href="/" className="inline-flex rounded-xl" aria-label="OJT Logbook home">
            <BrandMark />
          </Link>
        </header>

        <main id="main" className="flex flex-1 items-center py-12">
          <div className="mx-auto w-full max-w-[400px]">{children}</div>
        </main>

        <footer className="flex flex-wrap items-center justify-between gap-2 text-[13px] text-surface-600">
          <span>Medhavi Skills University</span>
          <Link href="/" className="rounded hover:text-surface-900">
            Back to home
          </Link>
        </footer>
      </div>

      {/* Brand panel: the real logbook pages this app fills in */}
      <aside
        aria-hidden
        className="grain relative m-3 hidden overflow-hidden rounded-[28px] bg-primary-950 lg:block"
      >
        <div className="absolute inset-0 bg-[radial-gradient(90%_70%_at_85%_0%,oklch(0.42_0.09_236)_0%,transparent_65%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(60%_50%_at_0%_100%,oklch(0.3_0.06_236)_0%,transparent_70%)]" />

        <div className="relative z-10 flex h-full flex-col p-12 xl:p-16">
          <p className="max-w-[17ch] text-[40px] font-semibold leading-[1.08] tracking-tight text-white xl:text-[46px]">
            Write it the way it happened.
          </p>
          <p className="mt-5 max-w-[38ch] text-[15px] leading-relaxed text-primary-100/80">
            Your notes go into the right boxes of the university journal, word for word. Nothing is
            rewritten.
          </p>

          <div className="relative mt-auto h-[58%] min-h-[340px]">
            <div className="absolute bottom-[-14%] right-[34%] w-[46%] -rotate-[7deg] rounded-lg shadow-[0_30px_60px_-20px_oklch(0.1_0.03_236/0.7)] ring-1 ring-white/10">
              <Image src={coverPage} alt="" className="rounded-lg" sizes="25vw" placeholder="blur" />
            </div>
            <div className="absolute bottom-[-24%] right-[-2%] w-[52%] rotate-[4deg] rounded-lg shadow-[0_40px_80px_-24px_oklch(0.1_0.03_236/0.8)] ring-1 ring-white/10">
              <Image src={dayPage} alt="" className="rounded-lg" sizes="28vw" placeholder="blur" priority />
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
