import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  CalendarRange,
  ClipboardPaste,
  FileDown,
  FileUp,
  ListChecks,
  PencilLine,
  Sparkles,
  UserRound,
  MessageSquareText,
} from "lucide-react";
import BrandMark from "@/components/brand-mark";
import dayPage from "../../public/templates/day_page_bg.png";
import coverPage from "../../public/templates/page_3_cover.png";

const EXAMPLE_NOTE =
  "Reached the plant at 9 and joined the morning safety briefing. Shadowed the quality team while they inspected the CNC turning batch for job 4471. Learned how to read the tolerance chart and why the first piece is always measured twice. Used a vernier caliper and the bore gauge for the first time. Supervisor let me sign off three pieces on my own.";

const EXAMPLE_SECTIONS = [
  {
    title: "Tasks carried out today",
    lines: [
      "Reached the plant at 9 and joined the morning safety briefing.",
      "Shadowed the quality team while they inspected the CNC turning batch for job 4471.",
    ],
  },
  {
    title: "Key learnings / observations",
    lines: ["Learned how to read the tolerance chart and why the first piece is always measured twice."],
  },
  {
    title: "Tools, equipment or techniques used",
    lines: ["Used a vernier caliper and the bore gauge for the first time."],
  },
  {
    title: "Special achievements",
    lines: ["Supervisor let me sign off three pieces on my own."],
  },
];

const STEPS = [
  {
    icon: ClipboardPaste,
    title: "Paste",
    body: "Drop in today's notes as one block of text. Bullet points and half sentences are fine.",
  },
  {
    icon: ListChecks,
    title: "Sort",
    body: "Each sentence is placed under the logbook heading it belongs to. Nothing is added or reworded.",
  },
  {
    icon: PencilLine,
    title: "Review",
    body: "Move a line, fix a typo, fill a section yourself. You have the last word on every box.",
  },
  {
    icon: FileDown,
    title: "Export",
    body: "Download the day, or the whole journal, printed onto the official template and ready to submit.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-[100dvh] bg-white">
      {/* Navigation */}
      <header className="sticky top-0 z-30 border-b border-surface-200/70 bg-white/85 backdrop-blur-xl">
        <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="rounded-xl" aria-label="OJT Logbook home">
            <BrandMark className="max-[400px]:[&>span:last-child]:hidden" />
          </Link>
          <div className="flex items-center gap-1 whitespace-nowrap sm:gap-2">
            <Link
              href="/try"
              className="hidden h-10 items-center rounded-xl px-3 text-sm font-semibold text-primary-800 hover:bg-primary-50 md:flex md:px-4"
            >
              Try without an account
            </Link>
            <Link
              href="/login"
              className="flex h-10 items-center rounded-xl px-3 text-sm font-semibold text-surface-700 hover:bg-surface-100 hover:text-surface-950 sm:px-4"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="flex h-10 items-center rounded-xl bg-primary-700 px-4 text-sm font-semibold text-white shadow-[inset_0_1px_0_oklch(1_0_0/0.12)] hover:bg-primary-800"
            >
              Create account
            </Link>
          </div>
        </nav>
      </header>

      <main id="main">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_60%_at_85%_10%,oklch(0.945_0.028_236)_0%,transparent_70%)]" />
          <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 pb-16 pt-12 sm:px-6 md:pt-20 lg:grid-cols-12 lg:gap-8 lg:pb-24">
            <div className="lg:col-span-6 xl:col-span-6">
              <Link
                href="/try"
                className="animate-rise group mb-6 inline-flex items-center gap-2 rounded-full bg-primary-50 py-1 pl-1 pr-3 text-[13px] font-semibold text-primary-800 ring-1 ring-inset ring-primary-200 hover:bg-primary-100"
                style={{ "--i": 0 } as React.CSSProperties}
              >
                <span className="rounded-full bg-primary-700 px-2 py-0.5 text-[11px] text-white">No sign-in</span>
                Upload a PRD, get the whole logbook
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
              </Link>
              <h1
                className="animate-rise text-4xl font-semibold leading-[1.05] tracking-tight text-surface-950 md:text-5xl lg:text-6xl"
                style={{ "--i": 0 } as React.CSSProperties}
              >
                Your daily notes, filed into the logbook.
              </h1>
              <p
                className="animate-rise mt-6 max-w-[46ch] text-lg leading-relaxed text-surface-600"
                style={{ "--i": 1 } as React.CSSProperties}
              >
                Paste what you did at your OJT today. It lands in the right sections of your university journal, in
                your own words.
              </p>
              <div
                className="animate-rise mt-9 flex flex-wrap items-center gap-3"
                style={{ "--i": 2 } as React.CSSProperties}
              >
                <Link
                  href="/try"
                  className="group flex h-12 items-center gap-2 rounded-xl bg-primary-700 px-6 text-[15px] font-semibold text-white shadow-[0_8px_24px_-8px_oklch(0.43_0.095_236/0.6),inset_0_1px_0_oklch(1_0_0/0.12)] hover:bg-primary-800"
                >
                  <FileUp className="h-4 w-4" aria-hidden />
                  Upload your PRD
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
                <Link
                  href="/signup"
                  className="flex h-12 items-center rounded-xl px-5 text-[15px] font-semibold text-primary-800 ring-1 ring-inset ring-primary-200 hover:bg-primary-50"
                >
                  Create account
                </Link>
              </div>
              <p
                className="animate-rise mt-3 text-[13px] text-surface-500"
                style={{ "--i": 3 } as React.CSSProperties}
              >
                No sign-in needed to upload a PRD.
              </p>

            </div>

            <div className="relative lg:col-span-6">
              <div className="relative mx-auto aspect-[5/5.2] w-full max-w-[560px]">
                <div
                  className="animate-rise absolute left-[2%] top-[6%] w-[54%] -rotate-[6deg] overflow-hidden rounded-xl shadow-[0_30px_60px_-24px_oklch(0.3_0.058_236/0.45)] ring-1 ring-surface-200"
                  style={{ "--i": 2 } as React.CSSProperties}
                >
                  <Image src={coverPage} alt="Learner's details page of the university OJT logbook" sizes="(min-width: 1024px) 300px, 54vw" placeholder="blur" />
                </div>
                <div
                  className="animate-rise absolute right-[2%] top-0 w-[60%] rotate-[3deg] overflow-hidden rounded-xl shadow-[0_40px_80px_-28px_oklch(0.3_0.058_236/0.55)] ring-1 ring-surface-200"
                  style={{ "--i": 3 } as React.CSSProperties}
                >
                  <Image
                    src={dayPage}
                    alt="Daily activity journal page with sections for tasks, learnings, tools and achievements"
                    sizes="(min-width: 1024px) 340px, 60vw"
                    placeholder="blur"
                    priority
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Highlight: PRD upload, no account needed */}
        <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 md:pb-28">
          <div className="grain relative overflow-hidden rounded-3xl bg-primary-950 px-6 py-10 text-white sm:px-10 md:py-14">
            <div className="absolute inset-0 bg-[radial-gradient(70%_80%_at_100%_0%,oklch(0.42_0.09_236)_0%,transparent_70%)]" aria-hidden />
            <div className="relative grid gap-10 lg:grid-cols-12 lg:items-center">
              <div className="lg:col-span-6">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[12px] font-semibold text-primary-100 ring-1 ring-inset ring-white/15">
                  <Sparkles className="h-3.5 w-3.5" aria-hidden />
                  Fastest way to a full logbook
                </span>
                <h2 className="mt-5 max-w-[20ch] text-3xl font-semibold leading-tight tracking-tight md:text-4xl">
                  Have a PRD? Get every day written in under a minute.
                </h2>
                <p className="mt-4 max-w-[48ch] text-[16px] leading-relaxed text-primary-100/80">
                  Upload your project document and internship dates. Each working day gets its own entry that builds on
                  the last, printed onto the official template. No account needed.
                </p>
                <Link
                  href="/try"
                  className="group mt-8 inline-flex h-12 items-center gap-2 rounded-xl bg-white px-6 text-[15px] font-semibold text-primary-900 hover:bg-primary-50"
                >
                  <FileUp className="h-4 w-4" aria-hidden />
                  Upload your PRD
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </div>
              <ol className="grid gap-3 sm:grid-cols-3 lg:col-span-6">
                {[
                  { icon: FileUp, title: "Upload", body: "Your PRD or project description as PDF, DOCX or TXT." },
                  { icon: CalendarRange, title: "Pick dates", body: "Start and end of your internship. Sundays are skipped." },
                  { icon: FileDown, title: "Download", body: "Review each day, then download the filled logbook PDF." },
                ].map((step, i) => (
                  <li key={step.title} className="rounded-2xl bg-white/[0.06] p-5 ring-1 ring-inset ring-white/10">
                    <span className="font-mono text-xs text-primary-200">0{i + 1}</span>
                    <step.icon className="mt-3 h-5 w-5 text-white" aria-hidden />
                    <h3 className="mt-3 text-[15px] font-semibold">{step.title}</h3>
                    <p className="mt-1 text-[13px] leading-relaxed text-primary-100/75">{step.body}</p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        {/* Worked example: same words, sorted */}
        <section className="border-y border-surface-200 bg-surface-50">
          <div className="reveal mx-auto max-w-7xl px-4 py-20 sm:px-6 md:py-28">
            <h2 className="max-w-[22ch] text-3xl font-semibold leading-tight tracking-tight text-surface-950 md:text-4xl">
              Your sentences go in. The same sentences come out.
            </h2>
            <p className="mt-4 max-w-[60ch] text-[17px] leading-relaxed text-surface-600">
              Your notes aren&apos;t rewritten. Each line moves to the box your logbook asks for, exactly as you wrote it.
            </p>

            <div className="mt-12 grid gap-6 lg:grid-cols-[minmax(0,5fr)_auto_minmax(0,7fr)] lg:items-center">
              <figure className="rounded-2xl bg-white p-6 shadow-[0_1px_0_oklch(0.21_0.016_236/0.05)] ring-1 ring-surface-200 md:p-7">
                <figcaption className="mb-4 flex items-center gap-2 text-sm font-semibold text-surface-900">
                  <ClipboardPaste className="h-4 w-4 text-primary-600" aria-hidden />
                  What a student pasted
                </figcaption>
                <p className="text-[15px] leading-[1.75] text-surface-700">{EXAMPLE_NOTE}</p>
              </figure>

              <div className="flex justify-center text-primary-500" aria-hidden>
                <ArrowRight className="h-6 w-6 rotate-90 lg:rotate-0" />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {EXAMPLE_SECTIONS.map((section, i) => (
                  <div
                    key={section.title}
                    className={`overflow-hidden rounded-xl bg-white ring-1 ring-primary-200 ${i < 2 ? "sm:col-span-2" : ""}`}
                  >
                    <div className="bg-primary-600 px-4 py-2 text-[13px] font-semibold text-white">{section.title}</div>
                    <div className="space-y-1.5 px-4 py-3 text-[14px] leading-relaxed text-surface-800">
                      {section.lines.map((line) => (
                        <p key={line}>{line}</p>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* How a day gets logged */}
        <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 md:py-28">
          <div className="grid gap-12 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <div className="lg:sticky lg:top-28">
                <h2 className="text-3xl font-semibold leading-tight tracking-tight text-surface-950 md:text-4xl">
                  A day logged in four moves
                </h2>
                <p className="mt-4 max-w-[40ch] text-[17px] leading-relaxed text-surface-600">
                  Built around the printed journal your university already uses, so nothing about the format changes.
                </p>
              </div>
            </div>
            <ol className="reveal grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:col-span-8">
              {STEPS.map((step) => (
                <li key={step.title} className="flex flex-col">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-50 text-primary-700">
                    <step.icon className="h-5 w-5" aria-hidden />
                  </span>
                  <h3 className="mt-5 text-xl font-semibold tracking-tight text-surface-950">{step.title}</h3>
                  <p className="mt-2 max-w-[38ch] text-[15px] leading-relaxed text-surface-600">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* What else is in the box */}
        <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 md:pb-28">
          <div className="reveal grid gap-4 md:grid-cols-5 md:grid-rows-2">
            <div className="grain relative overflow-hidden rounded-3xl bg-primary-950 p-8 text-white md:col-span-3 md:row-span-2 md:p-10">
              <div className="absolute inset-0 bg-[radial-gradient(80%_60%_at_100%_0%,oklch(0.42_0.09_236)_0%,transparent_70%)]" aria-hidden />
              <div className="relative max-w-[34ch]">
                <h3 className="text-2xl font-semibold leading-tight tracking-tight md:text-3xl">
                  The whole journal as one PDF
                </h3>
                <p className="mt-3 text-[15px] leading-relaxed text-primary-100/80">
                  Cover page, learner details, every daily page and your supervisor&apos;s feedback, in order and ready to
                  print.
                </p>
              </div>
              <div className="relative mt-8 flex justify-end md:absolute md:bottom-[-18%] md:right-8 md:mt-0 md:w-[46%]">
                <Image
                  src={dayPage}
                  alt=""
                  sizes="(min-width: 768px) 260px, 70vw"
                  className="w-[70%] rotate-[4deg] rounded-lg shadow-[0_30px_60px_-20px_oklch(0.1_0.03_236/0.7)] md:w-full"
                />
              </div>
            </div>

            <div className="rounded-3xl bg-primary-50 p-8 md:col-span-2">
              <UserRound className="h-6 w-6 text-primary-700" aria-hidden />
              <h3 className="mt-4 text-xl font-semibold tracking-tight text-surface-950">Fill your profile once</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-surface-700">
                Registration number, program, industry partner and supervisor go on the cover automatically.
              </p>
            </div>

            <div className="rounded-3xl bg-surface-100 p-8 md:col-span-2">
              <MessageSquareText className="h-6 w-6 text-primary-700" aria-hidden />
              <h3 className="mt-4 text-xl font-semibold tracking-tight text-surface-950">Supervisor feedback, scored</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-surface-700">
                Record the monthly assessment across all ten criteria and the total is worked out for you.
              </p>
            </div>
          </div>
        </section>

        {/* Closing call to action */}
        <section className="border-t border-surface-200 bg-surface-50">
          <div className="mx-auto flex max-w-7xl flex-col items-start gap-6 px-4 py-16 sm:px-6 md:flex-row md:items-center md:justify-between md:py-20">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-surface-950 md:text-3xl">
                Start with today&apos;s notes.
              </h2>
              <p className="mt-2 text-[15px] text-surface-600">
                Sign up with your university Google account or email, or{" "}
                <Link href="/try" className="font-semibold text-primary-700 underline underline-offset-2 hover:text-primary-900">
                  upload a PRD without an account
                </Link>
                .
              </p>
            </div>
            <Link
              href="/signup"
              className="group flex h-12 shrink-0 items-center gap-2 rounded-xl bg-primary-700 px-6 text-[15px] font-semibold text-white hover:bg-primary-800"
            >
              Create account
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-surface-200">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-8 text-sm text-surface-600 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <BrandMark compact className="opacity-80" />
          <p>Built for OJT learners.</p>
        </div>
      </footer>
    </div>
  );
}
