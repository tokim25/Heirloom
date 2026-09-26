import React, { useState } from 'react';
import {
  X,
  Bug,
  Send,
  AlertCircle,
  CheckCircle2,
  Github,
  ShieldCheck,
  Smartphone,
  ExternalLink,
} from 'lucide-react';
import { reportUserBug, BugReport } from '../utils/sentry.ts';
import { useAuth } from '../context/AuthContext.tsx';

interface BugReportModalProps {
  onClose: () => void;
}

export const BugReportModal: React.FC<BugReportModalProps> = ({ onClose }) => {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<BugReport['category']>('recipe_import');
  const [severity, setSeverity] = useState<BugReport['severity']>('medium');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedReport, setSubmittedReport] = useState<BugReport | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;

    setIsSubmitting(true);

    try {
      const report = reportUserBug({
        title: title.trim(),
        description: description.trim(),
        category,
        severity,
        userEmail: user?.email,
        userName: user?.name,
      });

      setSubmittedReport(report);
    } catch (err) {
      console.error('Failed to submit bug to Sentry:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Generate GitHub issue pre-filled URL
  const getGitHubIssueUrl = () => {
    const issueTitle = encodeURIComponent(`[Bug]: ${title || 'Bug Report'}`);
    const issueBody = encodeURIComponent(
      `### Description\n${description}\n\n### Category\n${category}\n\n### Severity\n${severity}\n\n### User Agent\n${navigator.userAgent}\n\n### URL\n${window.location.href}`
    );
    return `https://github.com/issues/new?title=${issueTitle}&body=${issueBody}`;
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg bg-[#FAF9F5] rounded-3xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col my-auto">
        {/* Header */}
        <div className="p-6 pb-4 border-b border-stone-200/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-rose-100 text-rose-700">
              <Bug className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-rose-700">
                  Sentry Telemetry & Issue Tracker
                </span>
                <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-800 text-[10px] font-bold border border-rose-200">
                  Live Sentry
                </span>
              </div>
              <h2 className="font-serif text-2xl text-stone-900">
                Report a Bug or Feedback
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

        {/* Content */}
        {submittedReport ? (
          <div className="p-8 flex flex-col items-center text-center gap-4">
            <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-sm">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="font-serif text-2xl text-stone-900">
              Bug Sent to Sentry!
            </h3>
            <p className="text-xs text-stone-600 max-w-sm leading-relaxed">
              Your report has been logged with Sentry diagnostic breadcrumbs, browser metadata, and category tags.
            </p>

            <div className="p-3 bg-stone-100 rounded-xl text-left text-xs font-mono text-stone-700 w-full">
              <div><strong>Report ID:</strong> {submittedReport.id}</div>
              <div><strong>Category:</strong> {submittedReport.category}</div>
              <div><strong>Severity:</strong> {submittedReport.severity}</div>
            </div>

            <div className="flex items-center gap-3 w-full pt-2">
              <a
                href={getGitHubIssueUrl()}
                target="_blank"
                rel="noreferrer"
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-medium shadow-sm transition-all"
              >
                <Github className="w-4 h-4" />
                <span>Track on GitHub Issues</span>
                <ExternalLink className="w-3 h-3 text-stone-400" />
              </a>

              <button
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl border border-stone-300 text-xs font-medium text-stone-700 hover:bg-stone-100"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
            <div>
              <label className="text-xs font-semibold text-stone-700 uppercase tracking-wider block mb-1">
                Bug Summary
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. YouTube Shorts recipe timing was missing step 3"
                className="w-full px-3.5 py-2 text-xs sm:text-sm bg-white border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/40"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-stone-700 uppercase tracking-wider block mb-1">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as unknown as BugReport['category'])}
                  className="w-full px-3 py-2 text-xs bg-white border border-stone-300 rounded-xl focus:outline-none"
                >
                  <option value="recipe_import">Recipe Import (URL/YouTube/PDF)</option>
                  <option value="cooking_timer">Cooking Stories & Timer</option>
                  <option value="instacart">Instacart Integration</option>
                  <option value="sync_groceries">Grocery & Multi-user Sync</option>
                  <option value="visual_bug">Visual / Design Slop</option>
                  <option value="other">Other / Feature Suggestion</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-stone-700 uppercase tracking-wider block mb-1">
                  Severity
                </label>
                <select
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value as unknown as BugReport['severity'])}
                  className="w-full px-3 py-2 text-xs bg-white border border-stone-300 rounded-xl focus:outline-none"
                >
                  <option value="low">Low (Minor annoyance)</option>
                  <option value="medium">Medium (Incorrect data)</option>
                  <option value="high">High (Broken feature)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-stone-700 uppercase tracking-wider block mb-1">
                Details & Steps to Reproduce
              </label>
              <textarea
                required
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What happened? What were you expecting to see?"
                className="w-full p-3 text-xs bg-white border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/40 font-mono"
              />
            </div>

            <div className="p-3 rounded-xl bg-stone-100 border border-stone-200/80 flex items-center gap-2 text-[11px] text-stone-600">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                Diagnostic telemetry (browser version, OS, route) will be automatically securely attached to Sentry event.
              </span>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs text-stone-600 hover:text-stone-900"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-sm transition-all"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isSubmitting ? 'Sending to Sentry…' : 'Send Bug Report'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
