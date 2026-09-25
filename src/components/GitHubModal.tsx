import React, { useState } from 'react';
import {
  X,
  Github,
  Copy,
  Check,
  GitBranch,
  Terminal,
  ExternalLink,
  Code2,
  FolderGit2,
} from 'lucide-react';

interface GitHubModalProps {
  onClose: () => void;
  onOpenBugReport: () => void;
}

export const GitHubModal: React.FC<GitHubModalProps> = ({ onClose, onOpenBugReport }) => {
  const [copiedClone, setCopiedClone] = useState(false);
  const [copiedRemote, setCopiedRemote] = useState(false);
  const [copiedDns, setCopiedDns] = useState(false);

  const cloneCommand = 'git clone https://github.com/Tokim25/heirloom.git';
  const remoteCommand = 'git remote add origin https://github.com/Tokim25/heirloom.git\ngit branch -M main\ngit push -u origin main';
  const dnsRecord = 'Type: CNAME\nName: heirloom\nValue: cname.vercel-dns.com (or tokim25.github.io)';

  const handleCopyClone = () => {
    navigator.clipboard.writeText(cloneCommand);
    setCopiedClone(true);
    setTimeout(() => setCopiedClone(false), 2000);
  };

  const handleCopyRemote = () => {
    navigator.clipboard.writeText(remoteCommand);
    setCopiedRemote(true);
    setTimeout(() => setCopiedRemote(false), 2000);
  };

  const handleCopyDns = () => {
    navigator.clipboard.writeText('heirloom.tonykim.io');
    setCopiedDns(true);
    setTimeout(() => setCopiedDns(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150">
      <div className="relative w-full max-w-xl bg-[#FAF9F5] rounded-3xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col my-auto max-h-[90vh]">
        {/* Header */}
        <div className="p-6 pb-4 border-b border-stone-200/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-stone-900 text-white shadow-md">
              <Github className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                  Open Source & Launch
                </span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold border border-emerald-200">
                  Domain Ready
                </span>
              </div>
              <h2 className="font-serif text-2xl text-stone-900">
                Git Push & Custom Domain
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-stone-200 text-stone-500 hover:text-stone-900 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 flex flex-col gap-5 text-stone-800 text-xs sm:text-sm overflow-y-auto">
          {/* Custom Domain Banner */}
          <div className="p-4 rounded-2xl bg-stone-900 text-stone-100 flex flex-col gap-3 shadow-md border border-stone-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-bold uppercase tracking-wider text-stone-300">
                  Target Custom Domain
                </span>
              </div>
              <button
                onClick={handleCopyDns}
                className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 transition-colors shrink-0"
              >
                {copiedDns ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedDns ? 'Copied URL' : 'Copy Domain'}</span>
              </button>
            </div>
            <div className="font-mono text-sm sm:text-base font-semibold text-amber-300 tracking-wide">
              https://heirloom.tonykim.io
            </div>
            <p className="text-[11px] text-stone-400 leading-relaxed">
              <code>CNAME</code> file has been generated in <code>/public/CNAME</code>. In your DNS provider (Cloudflare, Namecheap, Google Domains, etc.), add a CNAME record:
            </p>
            <div className="p-2.5 rounded-xl bg-stone-950 font-mono text-[11px] text-stone-300 border border-stone-800 whitespace-pre">
              {dnsRecord}
            </div>
          </div>

          {/* Clone Box */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-stone-700 uppercase tracking-wider flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-stone-500" />
              <span>Clone Repository</span>
            </label>
            <div className="flex items-center justify-between bg-white text-stone-900 font-mono text-xs p-3.5 rounded-xl border border-stone-200 shadow-2xs">
              <span className="truncate mr-2">{cloneCommand}</span>
              <button
                onClick={handleCopyClone}
                className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-800 transition-colors shrink-0"
              >
                {copiedClone ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedClone ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>

          {/* Push to GitHub */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-stone-700 uppercase tracking-wider flex items-center gap-1.5">
              <GitBranch className="w-3.5 h-3.5 text-stone-500" />
              <span>Connect Remote & Push to Git</span>
            </label>
            <div className="relative bg-stone-900 text-stone-200 font-mono text-xs p-3.5 rounded-xl border border-stone-800 whitespace-pre leading-relaxed">
              {remoteCommand}
              <button
                onClick={handleCopyRemote}
                className="absolute top-2.5 right-2.5 flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 transition-colors"
              >
                {copiedRemote ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedRemote ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>

          {/* Issue Tracking Actions */}
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex flex-col gap-2">
            <h4 className="font-semibold text-amber-950 text-xs uppercase tracking-wider">
              Issue Tracking & Telemetry
            </h4>
            <p className="text-xs text-amber-900 leading-relaxed">
              Heirloom includes integrated Sentry diagnostics and GitHub issue tracking templates for swift triage.
            </p>
            <div className="flex items-center gap-3 mt-1">
              <button
                onClick={() => {
                  onClose();
                  onOpenBugReport();
                }}
                className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-xs"
              >
                Open Bug Reporter
              </button>
              <a
                href="https://github.com/issues"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-xs text-stone-700 hover:text-stone-900 font-medium hover:underline"
              >
                <span>GitHub Issues</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-stone-100/70 border-t border-stone-200/80 flex items-center justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
