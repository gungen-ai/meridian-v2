import Link from 'next/link'
import { createClient } from '@/backend/supabase/server'

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div className="min-h-screen bg-[#0a0f2e] text-white">

      {/* Nav */}
      <nav className="flex items-center justify-between px-10 py-5 max-w-7xl mx-auto">
        <span className="text-xl font-bold tracking-tight">Meridian</span>
        <div className="hidden md:flex items-center gap-8 text-sm text-blue-200">
          <a href="#features" className="hover:text-white transition-colors">Features</a>
          <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
          <a href="#enterprise" className="hover:text-white transition-colors">Enterprise</a>
          <a href="#about" className="hover:text-white transition-colors">About</a>
          <a href="#contact" className="hover:text-white transition-colors">Contact</a>
        </div>
        <Link href={user ? '/dashboard' : '/auth/login'}
          className="border border-white text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-white hover:text-[#0a0f2e] transition-colors">
          {user ? 'Dashboard' : 'Login'}
        </Link>
      </nav>

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-10 pt-20 pb-32 flex items-center justify-between gap-12">
        <div className="max-w-xl">
          <h1 className="text-5xl md:text-6xl font-extrabold leading-tight mb-6">
            The Smart Engine for Your Knowledge Base.
          </h1>
          <p className="text-lg text-blue-200 mb-10 leading-relaxed">
            AI-powered creation, review, and maintenance<br />for high-performing teams.
          </p>
          <div className="flex items-center gap-4">
            <Link href={user ? '/dashboard' : '/auth/signup'}
              className="bg-blue-600 hover:bg-blue-500 text-white px-7 py-3.5 rounded-lg font-semibold text-sm transition-colors">
              Get Started
            </Link>
            <a href="#features"
              className="border border-white/40 text-white px-7 py-3.5 rounded-lg font-semibold text-sm hover:border-white transition-colors flex items-center gap-2">
              Watch Demo
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd"/>
              </svg>
            </a>
          </div>
        </div>

        {/* Hero graphic */}
        <div className="hidden lg:flex flex-1 items-center justify-center">
          <div className="relative w-96 h-80">
            {/* Glowing orb background */}
            <div className="absolute inset-0 rounded-full bg-blue-600 opacity-20 blur-3xl scale-75" />
            {/* Floating cards */}
            <div className="absolute top-8 right-8 bg-blue-900/60 border border-blue-500/30 rounded-xl p-4 backdrop-blur-sm w-40">
              <div className="text-xs text-blue-300 mb-1">Articles generated</div>
              <div className="text-2xl font-bold text-white">1,284</div>
              <div className="text-xs text-green-400 mt-1">↑ 12% this week</div>
            </div>
            <div className="absolute top-32 left-4 bg-blue-900/60 border border-blue-500/30 rounded-xl p-4 backdrop-blur-sm w-44">
              <div className="text-xs text-blue-300 mb-1">Knowledge health</div>
              <div className="text-2xl font-bold text-white">98%</div>
              <div className="w-full bg-blue-800 rounded-full h-1.5 mt-2">
                <div className="bg-blue-400 h-1.5 rounded-full w-[98%]" />
              </div>
            </div>
            <div className="absolute bottom-8 right-12 bg-blue-900/60 border border-blue-500/30 rounded-xl p-4 backdrop-blur-sm w-36">
              <div className="text-xs text-blue-300 mb-2">Auto-tagged</div>
              <div className="flex flex-wrap gap-1">
                <span className="text-xs bg-blue-700/60 text-blue-200 px-2 py-0.5 rounded-full">API</span>
                <span className="text-xs bg-purple-700/60 text-purple-200 px-2 py-0.5 rounded-full">Auth</span>
                <span className="text-xs bg-teal-700/60 text-teal-200 px-2 py-0.5 rounded-full">Setup</span>
              </div>
            </div>
            {/* Center hexagon decoration */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-20 h-20 bg-blue-500/20 border border-blue-400/30 rounded-2xl rotate-12 flex items-center justify-center">
                <span className="text-3xl font-black text-blue-300 -rotate-12">M</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trusted by */}
      <section className="bg-white/5 border-t border-white/10 py-14">
        <div className="max-w-5xl mx-auto px-10 text-center">
          <p className="text-sm font-semibold text-blue-300 uppercase tracking-widest mb-8">
            Trusted by innovative teams worldwide
          </p>
          <div className="flex flex-wrap items-center justify-center gap-12 text-blue-200/60">
            {['TechNova', 'Apex Solutions', 'Quantum Systems', 'DataFlow', 'Synergy Corp', 'Vertex IO'].map(name => (
              <span key={name} className="text-lg font-semibold hover:text-white transition-colors cursor-default">{name}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="max-w-7xl mx-auto px-10 py-24">
        <h2 className="text-3xl font-bold text-center mb-4">Everything your KB needs</h2>
        <p className="text-blue-200 text-center mb-14 max-w-xl mx-auto">
          From AI-powered drafting to contradiction detection — Meridian keeps your knowledge base healthy and up to date.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { title: 'AI Article Generation', desc: 'Bulk generate, import from URLs, or expand outlines into full articles with Claude.' },
            { title: 'Smart Review Workflow', desc: 'Assign reviewers, get AI-generated briefs, and track approvals end to end.' },
            { title: 'Auto-Tagging', desc: 'Claude reads your articles and suggests relevant tags with confidence scores.' },
            { title: 'Knowledge Gap Detection', desc: 'Identify when your KB can\'t answer common questions before users notice.' },
            { title: 'Freshness Scoring', desc: 'Track article staleness and get nudged when content needs updating.' },
            { title: 'MCP Server Generation', desc: 'Expose your KB to AI agents via scoped, token-authenticated MCP endpoints.' },
          ].map(f => (
            <div key={f.title} className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-blue-500/40 transition-colors">
              <div className="w-10 h-10 bg-blue-600/20 rounded-xl mb-4 flex items-center justify-center">
                <div className="w-4 h-4 bg-blue-400 rounded-sm" />
              </div>
              <h3 className="font-semibold text-white mb-2">{f.title}</h3>
              <p className="text-sm text-blue-200/70 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-3xl mx-auto px-10 py-20 text-center">
        <h2 className="text-4xl font-bold mb-4">Ready to upgrade your KB?</h2>
        <p className="text-blue-200 mb-8">Join teams using Meridian to build smarter, faster knowledge bases.</p>
        <Link href={user ? '/dashboard' : '/auth/signup'}
          className="inline-block bg-blue-600 hover:bg-blue-500 text-white px-10 py-4 rounded-xl font-semibold text-lg transition-colors">
          Get Started Free
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-8 text-center text-sm text-blue-300/50">
        © 2026 Meridian. All rights reserved.
      </footer>

    </div>
  )
}
