import Link from "next/link";
import {
  BookOpen,
  Sparkles,
  Shield,
  FileText,
  ArrowRight,
  ClipboardPaste,
  ScanSearch,
  CheckCircle,
  Download,
} from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-surface-50 to-primary-100">
      {/* Navigation */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-lg">
            <BookOpen className="w-5 h-5 text-white" />
          </div>
          <span className="text-lg font-bold text-surface-900">OJT Logbook Maker</span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="px-4 py-2 text-sm font-medium text-surface-800/70 hover:text-surface-900"
          >
            Sign In
          </Link>
          <Link
            href="/signup"
            className="px-4 py-2 rounded-xl bg-primary-500 text-white text-sm font-medium hover:bg-primary-600 shadow-md shadow-primary-500/20"
          >
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 pt-16 pb-20 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary-100/60 text-primary-700 text-xs font-medium mb-6">
          <Shield className="w-3.5 h-3.5" />
          Your text, your words — never rewritten
        </div>

        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-surface-900 leading-tight">
          Your OJT Logbook,{" "}
          <span className="bg-gradient-to-r from-primary-500 to-primary-700 bg-clip-text text-transparent">
            Perfectly Organized
          </span>
        </h1>

        <p className="mt-6 text-lg text-surface-800/60 max-w-2xl mx-auto leading-relaxed">
          Paste your daily OJT notes and let AI organize them into the correct logbook sections.
          No rewriting, no paraphrasing — just intelligent text placement.
        </p>

        <div className="mt-8 flex items-center justify-center gap-4">
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-primary-500 to-primary-600 text-white font-semibold text-sm hover:from-primary-600 hover:to-primary-700 shadow-xl shadow-primary-500/25"
          >
            Start Your Logbook
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-surface-200 bg-white text-surface-800 font-medium text-sm hover:bg-surface-50 shadow-sm"
          >
            Sign In
          </Link>
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-5xl mx-auto px-6 pb-20">
        <h2 className="text-2xl font-bold text-center text-surface-900 mb-12">
          How It Works
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[
            {
              icon: ClipboardPaste,
              title: "Paste",
              desc: "Paste your complete daily OJT notes into one text box",
              color: "from-blue-500 to-blue-600",
            },
            {
              icon: ScanSearch,
              title: "Auto Fill",
              desc: "AI classifies your text into the correct logbook sections",
              color: "from-primary-500 to-primary-600",
            },
            {
              icon: CheckCircle,
              title: "Review",
              desc: "Review and edit the results — you have full control",
              color: "from-green-500 to-green-600",
            },
            {
              icon: Download,
              title: "Export",
              desc: "Download a professional A4 PDF of your logbook",
              color: "from-amber-500 to-amber-600",
            },
          ].map((step, i) => (
            <div
              key={i}
              className="bg-white rounded-2xl p-6 border border-surface-200 shadow-sm hover:shadow-md text-center group"
            >
              <div
                className={`w-12 h-12 rounded-xl bg-gradient-to-br ${step.color} flex items-center justify-center mx-auto mb-4 shadow-lg group-hover:scale-110`}
              >
                <step.icon className="w-6 h-6 text-white" />
              </div>
              <div className="text-xs text-surface-800/40 font-semibold mb-1">
                Step {i + 1}
              </div>
              <h3 className="text-base font-semibold text-surface-900 mb-2">{step.title}</h3>
              <p className="text-sm text-surface-800/50">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Key features */}
      <section className="max-w-5xl mx-auto px-6 pb-20">
        <div className="bg-white rounded-3xl border border-surface-200 p-8 md:p-12 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: Shield,
                title: "Exact Text Preservation",
                desc: "Your words are never changed, rewritten, or paraphrased. The AI only determines which section each piece belongs to.",
              },
              {
                icon: Sparkles,
                title: "AI-Powered Classification",
                desc: "Smart extraction that understands tasks, learnings, tools, and achievements from your natural writing style.",
              },
              {
                icon: FileText,
                title: "Professional PDF Output",
                desc: "Generate A4 daily or complete logbooks that match the official OJT format with proper formatting.",
              },
            ].map((feature, i) => (
              <div key={i}>
                <feature.icon className="w-8 h-8 text-primary-500 mb-3" />
                <h3 className="text-base font-semibold text-surface-900 mb-2">{feature.title}</h3>
                <p className="text-sm text-surface-800/50 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-surface-200 py-8">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between text-xs text-surface-800/40">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4" />
            OJT Logbook Maker
          </div>
          <span>AI-powered form filling, not content generation</span>
        </div>
      </footer>
    </div>
  );
}
