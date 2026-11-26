import { BookOpen, ClipboardCheck, GraduationCap, Phone, UserRound } from "lucide-react";

const SAMPLES = [
  { icon: UserRound, text: "Who is the principal of KSRMCE?" },
  { icon: BookOpen, text: "What is the B.Tech intake for CSE and ECE?" },
  { icon: ClipboardCheck, text: "What is the minimum attendance required?" },
  { icon: Phone, text: "What is the admissions helpline number?" },
];

export default function WelcomeScreen({ onPick }) {
  return (
    <div className="flex flex-col items-center px-2 pb-8 pt-10 text-center sm:pt-16">
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-600/15 dark:text-brand-500">
        <GraduationCap size={28} />
      </div>
      <h1 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">How can I help you today?</h1>
      <p className="mt-2 max-w-md text-slate-500 dark:text-slate-400">
        Ask anything about K.S.R.M. College of Engineering, Kadapa: admissions, courses, exam rules, departments or
        placements. Every answer cites the official pages it came from.
      </p>

      <div className="mt-8 grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2">
        {SAMPLES.map(({ icon: Icon, text }) => (
          <button
            key={text}
            onClick={() => onPick(text)}
            className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left text-sm font-medium shadow-sm transition hover:border-brand-500 hover:shadow dark:border-slate-800 dark:bg-slate-900 dark:hover:border-brand-500"
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500 transition group-hover:bg-brand-50 group-hover:text-brand-600 dark:bg-slate-800 dark:text-slate-400 dark:group-hover:bg-brand-600/15 dark:group-hover:text-brand-500">
              <Icon size={18} />
            </span>
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}
